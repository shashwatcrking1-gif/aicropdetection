"""Evaluate a trained model and report quality and CPU latency."""
import argparse
import sys
import time
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
from sklearn.metrics import (accuracy_score, classification_report, confusion_matrix,
                             top_k_accuracy_score)

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
from training.train import _dataset, _load_paths


def main():
    import tensorflow as tf

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--model", default=str(BACKEND_DIR / "model" / "crop_model.keras"))
    parser.add_argument("--output-dir", default=str(BACKEND_DIR / "model"))
    args = parser.parse_args()
    classes, paths, labels = _load_paths(args.data_dir)
    dataset = _dataset(tf, paths["test"], labels["test"])
    model = tf.keras.models.load_model(args.model)
    y_true = np.asarray(labels["test"])
    probabilities = model.predict(dataset, verbose=0)
    y_pred = probabilities.argmax(axis=1)
    print(f"Overall accuracy: {accuracy_score(y_true, y_pred):.4f}")
    print(f"Top-2 accuracy: {top_k_accuracy_score(y_true, probabilities, k=2, labels=np.arange(8)):.4f}")
    print(classification_report(y_true, y_pred, target_names=[c["class_id"] for c in classes], digits=4))
    matrix = confusion_matrix(y_true, y_pred, labels=np.arange(8))
    figure, axis = plt.subplots(figsize=(10, 8))
    axis.imshow(matrix, cmap="Blues")
    axis.set(xticks=np.arange(8), yticks=np.arange(8),
             xticklabels=[c["class_id"] for c in classes], yticklabels=[c["class_id"] for c in classes],
             xlabel="Predicted", ylabel="Actual")
    plt.setp(axis.get_xticklabels(), rotation=45, ha="right", rotation_mode="anchor")
    figure.tight_layout()
    output = Path(args.output_dir)
    output.mkdir(parents=True, exist_ok=True)
    figure.savefig(output / "confusion_matrix.png", dpi=160)
    plt.close(figure)

    image_batch, _ = next(iter(dataset))
    sample = image_batch[:1]
    timings = []
    with tf.device("/CPU:0"):
        model(sample, training=False)
        for _ in range(50):
            started = time.perf_counter()
            model(sample, training=False)
            timings.append((time.perf_counter() - started) * 1000)
    print(f"Median CPU inference latency (50 runs): {np.median(timings):.2f} ms")


if __name__ == "__main__":
    main()
