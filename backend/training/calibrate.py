"""Report accepted prediction accuracy and rejection rate by confidence threshold."""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))
import config
import inference
from training.train import _dataset, _load_paths


def main():
    import tensorflow as tf

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--model", default=str(BACKEND_DIR / "model" / "crop_model.keras"))
    args = parser.parse_args()
    _, paths, labels = _load_paths(args.data_dir)
    dataset = _dataset(tf, paths["val"], labels["val"])
    y_true = np.asarray(labels["val"])
    probabilities = tf.keras.models.load_model(args.model).predict(dataset, verbose=0)
    original_threshold = config.CONF_THRESHOLD
    for threshold in np.arange(0.50, 0.901, 0.05):
        config.CONF_THRESHOLD = float(threshold)
        accepted_predictions = []
        accepted_correct = []
        for probability, expected in zip(probabilities, y_true):
            crop = inference.CLASSES[int(expected)]["crop"]
            result = inference.decide(probability, crop)
            if result["outcome"] in {"disease", "healthy"}:
                accepted_predictions.append(True)
                accepted_correct.append(result["prediction"]["class_id"] == inference.CLASSES[int(expected)]["class_id"])
            else:
                accepted_predictions.append(False)
                accepted_correct.append(False)
        accepted = np.asarray(accepted_predictions, dtype=bool)
        correct = np.asarray(accepted_correct, dtype=bool)
        accepted_accuracy = float(correct[accepted].mean()) if accepted.any() else float("nan")
        rejection_rate = float((~accepted).mean())
        print(f"threshold={threshold:.2f} accepted_accuracy={accepted_accuracy:.4f} rejection_rate={rejection_rate:.4f}")
    config.CONF_THRESHOLD = original_threshold


if __name__ == "__main__":
    main()
