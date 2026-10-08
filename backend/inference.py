"""Model loading, image preprocessing, and contract decision logic."""
import io
import json

import numpy as np
from PIL import Image, ImageOps

import config


with config.CLASSES_PATH.open(encoding="utf-8") as _file:
    CLASSES = json.load(_file)
CLASS_INDEX = {item["class_id"]: i for i, item in enumerate(CLASSES)}


def load_model():
    """Load the exported model, then try the matching architecture and weights."""
    try:
        import tensorflow as tf
    except Exception:
        return None

    try:
        if config.MODEL_PATH.is_file():
            return tf.keras.models.load_model(config.MODEL_PATH)
    except Exception:
        pass

    weights_path = config.BASE_DIR / "model" / "crop_model.weights.h5"
    if not weights_path.is_file():
        return None
    try:
        from training.train import build_model

        model = build_model()
        model.load_weights(weights_path)
        return model
    except Exception:
        return None


def preprocess(image):
    """Return raw 0–255 RGB pixels; model owns the [-1, 1] rescaling."""
    if isinstance(image, (bytes, bytearray)):
        image = Image.open(io.BytesIO(image))
    image = ImageOps.exif_transpose(image).convert("RGB")
    image = image.resize(config.IMAGE_SIZE, Image.Resampling.BILINEAR)
    return np.asarray(image, dtype=np.float32)[None, ...]


def decide(probabilities, crop):
    """Apply crop mismatch, confidence, and margin rules to eight probabilities."""
    p = np.asarray(probabilities, dtype=np.float64).reshape(-1)
    if p.size != len(CLASSES):
        raise ValueError("Model must return eight class probabilities")
    total = p.sum()
    if not np.isfinite(p).all() or total <= 0:
        raise ValueError("Model returned invalid probabilities")
    p /= total

    selected = [i for i, item in enumerate(CLASSES) if item["crop"] == crop]
    other = [i for i, item in enumerate(CLASSES) if item["crop"] != crop]
    if float(p[other].sum()) >= config.MISMATCH_THRESHOLD:
        detected = CLASSES[int(np.argmax(p))]["crop"]
        return {"outcome": "crop_mismatch", "detected_crop": detected, "prediction": None, "top_k": []}

    crop_mass = float(p[selected].sum())
    if crop_mass <= 0:
        raise ValueError("Selected crop has no model probability mass")
    crop_p = p[selected] / crop_mass
    order = np.argsort(crop_p)[::-1]
    top = []
    for local_index in order[:2]:
        cls = CLASSES[selected[int(local_index)]]
        top.append({"class_id": cls["class_id"], "display_name": cls["display_name"],
                    "confidence": round(float(crop_p[int(local_index)]), 4)})

    top1 = float(crop_p[int(order[0])])
    top2 = float(crop_p[int(order[1])])
    if top1 < config.CONF_THRESHOLD or top1 - top2 < config.MARGIN_THRESHOLD:
        return {"outcome": "low_confidence", "detected_crop": None, "prediction": None, "top_k": top}

    cls = CLASSES[selected[int(order[0])]]
    outcome = "healthy" if cls["is_healthy"] else "disease"
    prediction = {"class_id": cls["class_id"], "display_name": cls["display_name"],
                  "confidence": round(top1, 4), "is_healthy": cls["is_healthy"]}
    return {"outcome": outcome, "detected_crop": None, "prediction": prediction, "top_k": top}


def mock_probabilities(crop, outcome):
    """Deterministic probability vectors for local frontend development."""
    if outcome not in {"disease", "healthy", "low_confidence", "crop_mismatch"}:
        raise ValueError("Unsupported mock outcome")
    selected = [i for i, item in enumerate(CLASSES) if item["crop"] == crop]
    other = [i for i, item in enumerate(CLASSES) if item["crop"] != crop]
    p = np.zeros(len(CLASSES), dtype=np.float64)
    if outcome == "crop_mismatch":
        p[other[0]] = 0.93
        p[other[1]] = 0.05
        p[other[2]] = 0.01
        p[other[3]] = 0.01
    elif outcome == "low_confidence":
        p[selected] = [0.40, 0.35, 0.15, 0.10]
    elif outcome == "healthy":
        healthy = next(i for i in selected if CLASSES[i]["is_healthy"])
        remaining = [i for i in selected if i != healthy]
        p[healthy] = 0.93
        p[remaining] = [0.05, 0.015, 0.005]
    else:
        disease = next(i for i in selected if not CLASSES[i]["is_healthy"])
        remaining = [i for i in selected if i != disease]
        p[disease] = 0.93
        p[remaining] = [0.05, 0.015, 0.005]
    return p


def predict(image, crop, model=None, mock_outcome=None):
    """Preprocess and infer, returning decision plus end-to-end inference time."""
    import time

    started = time.perf_counter()
    pixels = preprocess(image)
    if mock_outcome is not None:
        probabilities = mock_probabilities(crop, mock_outcome)
    else:
        if model is None:
            raise RuntimeError("MODEL_NOT_LOADED")
        probabilities = np.asarray(model.predict(pixels, verbose=0))[0]
    result = decide(probabilities, crop)
    result["latency_ms"] = int(round((time.perf_counter() - started) * 1000))
    return result


def read_model_version():
    meta_path = config.BASE_DIR / "model" / "model_meta.json"
    try:
        with meta_path.open(encoding="utf-8") as file:
            return json.load(file).get("model_version", config.DEFAULT_MODEL_VERSION)
    except (OSError, ValueError, TypeError):
        return config.DEFAULT_MODEL_VERSION
