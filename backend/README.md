# Crop detector backend

The API and class ordering are defined by [`../docs/API_CONTRACT.md`](../docs/API_CONTRACT.md).

## Setup and run

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
MOCK_MODEL=1 flask --app app run --port 5000
```

With a trained `model/crop_model.keras` present, run the production server with:

```bash
cd backend
gunicorn -w 1 -b 0.0.0.0:5000 app:app
```

Use `MODEL_PATH=/path/to/crop_model.keras` to select a different exported model, and `CORS_ORIGINS=http://localhost:5173` to set allowed origins. `MOCK_MODEL=1` skips TensorFlow and returns deterministic sample predictions while retaining upload validation.

## Train in Google Colab

Upload your Kaggle API token (`kaggle.json`) to the Colab session, then run:

```bash
!pip install -q kaggle
!mkdir -p /root/.kaggle /content/plantvillage
!cp /content/kaggle.json /root/.kaggle/kaggle.json
!chmod 600 /root/.kaggle/kaggle.json
!kaggle datasets download -d abdallahalidev/plantvillage-dataset -p /content/plantvillage --unzip
!find /content/plantvillage -type d -name color -print
```

The training script checks that all eight contract dataset folders exist and each has at least 500 supported images. Copy the project to Colab or mount its Drive folder before running. Find the extracted `color/` directory automatically, then use it for training and analysis:

```bash
%cd /content/crop/backend
!pip install -q -r requirements.txt
import os
from pathlib import Path
data_dir = next(Path("/content/plantvillage").rglob("color"))
!python training/train.py --data-dir "{data_dir}" --output-dir model
!python training/evaluate.py --data-dir "{data_dir}" --model model/crop_model.keras --output-dir model
!python training/calibrate.py --data-dir "{data_dir}" --model model/crop_model.keras
```

Training writes `model/crop_model.keras`, `model/crop_model.weights.h5`, and `model/model_meta.json`. The architecture applies augmentation only during training and performs the same EXIF correction, RGB conversion, 224×224 bilinear resize, and raw 0–255 preprocessing as serving. Scaling to [-1, 1] happens inside the model.

## Test

```bash
cd backend
MOCK_MODEL=1 pytest -q
```

## Advice review

Remedies need review by a local agriculture extension officer before any real-world use.
