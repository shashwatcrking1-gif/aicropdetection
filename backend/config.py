"""Contract constants and runtime settings."""
import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
CLASSES_PATH = BASE_DIR / "classes.json"
KNOWLEDGE_BASE_PATH = BASE_DIR / "knowledge_base.json"
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(BASE_DIR / "model" / "crop_model.keras")))
MOCK_MODEL = os.getenv("MOCK_MODEL", "0").strip().lower() in {"1", "true", "yes"}
CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if origin.strip()]
MAX_CONTENT_LENGTH = 5 * 1024 * 1024
ALLOWED_EXT = {"jpg", "jpeg", "png", "webp"}
IMAGE_SIZE = (224, 224)
MIN_IMAGE_DIMENSION = 64
CONF_THRESHOLD = 0.70
MARGIN_THRESHOLD = 0.15
MISMATCH_THRESHOLD = 0.80
DEFAULT_MODEL_VERSION = "mnv2-v1"
