import io
import os
import sys
from pathlib import Path

os.environ["MOCK_MODEL"] = "1"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np
import pytest
from PIL import Image

import config
import inference
from app import app as flask_app


@pytest.fixture()
def client():
    flask_app.config.update(TESTING=True)
    return flask_app.test_client()


def make_image(size=(96, 96), fmt="JPEG"):
    buffer = io.BytesIO()
    Image.new("RGB", size, (30, 140, 45)).save(buffer, format=fmt)
    buffer.seek(0)
    return buffer


def post_image(client, crop="tomato", mock=None, filename="leaf.jpg", content=None):
    data = {"crop": crop}
    if content is not None:
        data["image"] = (io.BytesIO(content), filename)
    else:
        data["image"] = (make_image(), filename)
    query = f"?mock={mock}" if mock else ""
    return client.post("/api/predict" + query, data=data, content_type="multipart/form-data")


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.get_json() == {"status": "ok", "model_loaded": True, "mock": True,
                                   "model_version": "mnv2-v1"}


def test_crops_lists_both_crops_and_four_classes(client):
    result = client.get("/api/crops").get_json()["crops"]
    assert [(crop["id"], len(crop["classes"])) for crop in result] == [("tomato", 4), ("maize", 4)]


@pytest.mark.parametrize("outcome", ["disease", "healthy", "low_confidence", "crop_mismatch"])
def test_predict_each_mock_outcome(client, outcome):
    response = post_image(client, mock=outcome)
    assert response.status_code == 200
    body = response.get_json()
    assert body["status"] == "ok"
    assert body["outcome"] == outcome
    assert body["crop"] == "tomato"
    if outcome == "disease":
        assert body["prediction"]["class_id"] == "tomato_early_blight"
        assert body["prediction"]["confidence"] == 0.93
        assert body["advice"]["disease_name"] == "Early Blight"
    elif outcome == "healthy":
        assert body["prediction"]["is_healthy"] is True
        assert body["advice"]["severity"] == "low"
    elif outcome == "low_confidence":
        assert body["prediction"] is None and body["advice"] is None
        assert len(body["top_k"]) == 2
    else:
        assert body["prediction"] is None and body["advice"] is None
        assert body["top_k"] == [] and body["detected_crop"] == "maize"


def test_no_file(client):
    response = client.post("/api/predict", data={"crop": "tomato"})
    assert response.status_code == 400
    assert response.get_json()["code"] == "NO_FILE"


@pytest.mark.parametrize("crop", [None, "potato"])
def test_invalid_crop(client, crop):
    data = {"image": (make_image(), "leaf.jpg")}
    if crop is not None:
        data["crop"] = crop
    response = client.post("/api/predict", data=data, content_type="multipart/form-data")
    assert response.status_code == 400
    assert response.get_json()["code"] == "INVALID_CROP"


@pytest.mark.parametrize("filename", ["leaf.gif", "leaf.pdf"])
def test_bad_file_type(client, filename):
    response = post_image(client, filename=filename)
    assert response.status_code == 400
    assert response.get_json()["code"] == "BAD_FILE_TYPE"


def test_corrupt_image(client):
    response = post_image(client, content=b"not an image", filename="leaf.jpg")
    assert response.status_code == 400
    assert response.get_json()["code"] == "CORRUPT_IMAGE"


def test_image_too_small(client):
    response = post_image(client, content=make_image((32, 32)).getvalue())
    assert response.status_code == 400
    assert response.get_json()["code"] == "IMAGE_TOO_SMALL"


def test_file_too_large(client):
    response = post_image(client, content=b"0" * (6 * 1024 * 1024), filename="leaf.jpg")
    assert response.status_code == 413
    assert response.get_json()["code"] == "FILE_TOO_LARGE"


def test_decision_logic_all_outcomes_and_margin(monkeypatch):
    disease = np.array([0, 0, 0, 0, .75, .05, .15, .05])
    assert inference.decide(disease, "tomato")["outcome"] == "disease"
    healthy = np.array([0, 0, 0, 0, .05, .80, .10, .05])
    assert inference.decide(healthy, "tomato")["outcome"] == "healthy"
    unclear = np.array([0, 0, 0, 0, .40, .35, .15, .10])
    assert inference.decide(unclear, "tomato")["outcome"] == "low_confidence"
    mismatch = np.array([.90, .04, .03, .03, 0, 0, 0, 0])
    assert inference.decide(mismatch, "tomato")["outcome"] == "crop_mismatch"

    # The contract's 0.70 confidence gate makes a <0.15 margin impossible
    # for a normalized 4-class distribution; lower the gate to exercise that branch.
    monkeypatch.setattr(config, "CONF_THRESHOLD", 0.40)
    close = np.array([0, 0, 0, 0, .43, .40, .10, .07])
    assert inference.decide(close, "tomato")["outcome"] == "low_confidence"
