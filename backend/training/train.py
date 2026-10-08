"""Train the eight-class MobileNetV2 model; runnable locally or from Colab."""
import argparse
import json
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
import config


SUPPORTED_IMAGES = {".jpg", ".jpeg", ".png", ".webp"}


def build_model(weights=None):
    import tensorflow as tf

    augmentation = tf.keras.Sequential([
        tf.keras.layers.RandomFlip("horizontal_and_vertical"),
        tf.keras.layers.RandomRotation(0.08),
        tf.keras.layers.RandomZoom(0.25),
        tf.keras.layers.RandomTranslation(0.1, 0.1),
        tf.keras.layers.RandomBrightness(0.25, value_range=(0, 255)),
        tf.keras.layers.RandomContrast(0.25),
    ], name="augmentation")
    inputs = tf.keras.Input(shape=(224, 224, 3), name="pixels_0_255")
    x = augmentation(inputs)
    x = tf.keras.layers.Rescaling(1 / 127.5, offset=-1, name="rescaling")(x)
    base = tf.keras.applications.MobileNetV2(weights=weights, include_top=False,
                                              input_shape=(224, 224, 3))
    base.trainable = False
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(8, activation="softmax", name="class_probabilities")(x)
    return tf.keras.Model(inputs, outputs, name="crop_mobilenetv2")


def _decode_image(path):
    if isinstance(path, (bytes, np.bytes_)):
        path = path.decode("utf-8")
    with Image.open(path) as source:
        image = ImageOps.exif_transpose(source).convert("RGB")
        image = image.resize((224, 224), Image.Resampling.BILINEAR)
        return np.asarray(image, dtype=np.float32)


def _load_paths(data_dir):
    """Take up to 500 deterministic examples per contract class, in class order."""
    root = Path(data_dir)
    if not root.is_dir():
        raise FileNotFoundError(f"Data folder does not exist: {root}")
    classes = json.loads(config.CLASSES_PATH.read_text(encoding="utf-8"))
    found_folders = {entry.name: entry for entry in root.iterdir() if entry.is_dir()}
    rng = random.Random(42)
    paths, labels = [], []
    split_paths = {key: [] for key in ("train", "val", "test")}
    split_labels = {key: [] for key in ("train", "val", "test")}
    for label, cls in enumerate(classes):
        folder_name = cls["dataset_folder"]
        if folder_name not in found_folders:
            raise FileNotFoundError(f"Required class folder missing from {root}: {folder_name}")
        files = sorted(path for path in found_folders[folder_name].rglob("*")
                       if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGES)
        if len(files) < 500:
            raise ValueError(f"{folder_name} has {len(files)} images; 500 are required for the specified split")
        rng.shuffle(files)
        chosen = files[:500]
        assignments = (("train", chosen[:350]), ("val", chosen[350:425]), ("test", chosen[425:]))
        for split, split_files in assignments:
            split_paths[split].extend(str(path) for path in split_files)
            split_labels[split].extend([label] * len(split_files))
    return classes, split_paths, split_labels


def _dataset(tf, paths, labels, training=False):
    dataset = tf.data.Dataset.from_tensor_slices((paths, labels))

    def load(path, label):
        image = tf.numpy_function(_decode_image, [path], tf.float32)
        image.set_shape((224, 224, 3))
        return image, label

    dataset = dataset.map(load, num_parallel_calls=tf.data.AUTOTUNE).cache()
    if training:
        dataset = dataset.shuffle(len(paths), seed=42, reshuffle_each_iteration=True)
    return dataset.batch(32).prefetch(tf.data.AUTOTUNE)


def train(data_dir, output_dir):
    import tensorflow as tf

    tf.keras.utils.set_random_seed(42)
    classes, paths, labels = _load_paths(data_dir)
    output = Path(output_dir)
    output.mkdir(parents=True, exist_ok=True)
    datasets = {key: _dataset(tf, paths[key], labels[key], training=(key == "train"))
                for key in ("train", "val", "test")}
    model = build_model(weights="imagenet")
    checkpoint = str(output / "crop_model.keras")
    callbacks = [
        tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=3, restore_best_weights=True),
        tf.keras.callbacks.ModelCheckpoint(checkpoint, monitor="val_loss", save_best_only=True),
    ]

    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
                 loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(datasets["train"], validation_data=datasets["val"], epochs=5, callbacks=callbacks)

    base = next(layer for layer in model.layers if isinstance(layer, tf.keras.Model)
                and "mobilenetv2" in layer.name.lower())
    base.trainable = True
    for index, layer in enumerate(base.layers):
        layer.trainable = index >= 100 and not isinstance(layer, tf.keras.layers.BatchNormalization)
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-5),
                 loss="sparse_categorical_crossentropy", metrics=["accuracy"])
    model.fit(datasets["train"], validation_data=datasets["val"], epochs=8, callbacks=callbacks)

    best_model = tf.keras.models.load_model(checkpoint)
    test_loss, test_accuracy = best_model.evaluate(datasets["test"], verbose=0)
    best_model.save(checkpoint)
    best_model.save_weights(output / "crop_model.weights.h5")
    metadata = {
        "model_version": "mnv2-v1",
        "tensorflow_version": tf.__version__,
        "keras_version": tf.keras.__version__ if hasattr(tf.keras, "__version__") else "unknown",
        "class_order": [item["class_id"] for item in classes],
        "split_counts": {key: len(paths[key]) for key in paths},
        "per_class_split_counts": {item["class_id"]: {key: 350 if key == "train" else 75 for key in paths}
                                   for item in classes},
        "test_accuracy": float(test_accuracy),
        "test_loss": float(test_loss),
    }
    (output / "model_meta.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True, help="Path to PlantVillage color/ folder")
    parser.add_argument("--output-dir", default=str(BACKEND_DIR / "model"))
    args = parser.parse_args()
    train(args.data_dir, args.output_dir)
