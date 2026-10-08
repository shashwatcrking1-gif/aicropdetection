"""Flask application for the AI Crop-Disease Detector API."""
import json
import io
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS
from PIL import Image, UnidentifiedImageError
from werkzeug.exceptions import RequestEntityTooLarge

import config
import inference


with config.KNOWLEDGE_BASE_PATH.open(encoding="utf-8") as _file:
    KNOWLEDGE_BASE = json.load(_file)


def _error(code, message, status):
    return jsonify({"status": "error", "code": code, "message": message}), status


def create_app():
    app = Flask(__name__)
    app.json.sort_keys = False
    app.config["MAX_CONTENT_LENGTH"] = config.MAX_CONTENT_LENGTH
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS}})
    model = None if config.MOCK_MODEL else inference.load_model()
    model_version = inference.read_model_version()
    app.extensions["crop_model"] = model

    @app.errorhandler(RequestEntityTooLarge)
    def too_large(_error):
        return _error_response("FILE_TOO_LARGE", "Image exceeds the 5 MB limit.", 413)

    def _error_response(code, message, status):
        return jsonify({"status": "error", "code": code, "message": message}), status

    @app.errorhandler(Exception)
    def unexpected(error):
        if isinstance(error, RequestEntityTooLarge):
            return too_large(error)
        app.logger.exception("Unhandled API error", exc_info=error)
        return _error_response("INTERNAL", "An internal error occurred.", 500)

    @app.get("/api/health")
    def health():
        return jsonify({"status": "ok", "model_loaded": bool(config.MOCK_MODEL or model is not None),
                        "mock": config.MOCK_MODEL, "model_version": model_version})

    @app.get("/api/crops")
    def crops():
        result = []
        for crop_id in ("tomato", "maize"):
            crop_classes = [item for item in inference.CLASSES if item["crop"] == crop_id]
            result.append({"id": crop_id, "display_name": crop_id.capitalize(), "classes": [
                {"class_id": item["class_id"], "display_name": item["display_name"],
                 "is_healthy": item["is_healthy"]} for item in crop_classes]})
        return jsonify({"crops": result})

    @app.post("/api/predict")
    def predict_route():
        if "image" not in request.files or not request.files["image"].filename:
            return _error("NO_FILE", "An image file is required.", 400)
        crop = request.form.get("crop", "").strip().lower()
        if crop not in {"tomato", "maize"}:
            return _error("INVALID_CROP", "Crop must be tomato or maize.", 400)
        uploaded = request.files["image"]
        extension = Path(uploaded.filename).suffix.lower().lstrip(".")
        if extension not in config.ALLOWED_EXT:
            return _error("BAD_FILE_TYPE", "Allowed image types are jpg, jpeg, png, and webp.", 400)
        contents = uploaded.read()
        try:
            with Image.open(io.BytesIO(contents)) as image:
                image.verify()
            with Image.open(io.BytesIO(contents)) as image:
                width, height = image.size
                if width < config.MIN_IMAGE_DIMENSION or height < config.MIN_IMAGE_DIMENSION:
                    return _error("IMAGE_TOO_SMALL", "Image must be at least 64x64 pixels.", 400)
        except (UnidentifiedImageError, OSError, ValueError, SyntaxError):
            return _error("CORRUPT_IMAGE", "The uploaded image cannot be read.", 400)

        mock_outcome = None
        if config.MOCK_MODEL:
            requested_mock = request.args.get("mock")
            if requested_mock is not None:
                if requested_mock not in {"disease", "healthy", "low_confidence", "crop_mismatch"}:
                    return _error("INTERNAL", "Unsupported mock outcome.", 500)
                mock_outcome = requested_mock
            else:
                mock_outcome = "disease"
        elif model is None:
            return _error("MODEL_NOT_LOADED", "Prediction model is unavailable.", 503)

        result = inference.predict(contents, crop, model=model, mock_outcome=mock_outcome)
        outcome = result["outcome"]
        prediction = result["prediction"]
        advice = KNOWLEDGE_BASE.get(prediction["class_id"]) if prediction else None
        if outcome == "disease":
            message = f"Likely {prediction['display_name']} on your {crop} leaf."
        elif outcome == "healthy":
            message = f"Your {crop} leaf looks healthy."
        elif outcome == "low_confidence":
            message = "No clear disease detected. Retake the photo in daylight with the leaf flat and filling most of the frame."
        else:
            message = f"This looks like a {result['detected_crop']} leaf, not {crop}. Check your crop selection or retake the photo."
        return jsonify({"status": "ok", "outcome": outcome, "crop": crop,
                        "detected_crop": result["detected_crop"], "prediction": prediction,
                        "top_k": result["top_k"], "advice": advice, "message": message,
                        "latency_ms": result["latency_ms"], "model_version": model_version})

    return app


app = create_app()
