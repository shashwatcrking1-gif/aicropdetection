# API Contract v1 (source of truth for frontend and backend)

Dev base URL: http://localhost:5000   Frontend dev origin: http://localhost:5173 (CORS allowed)

## Crops and classes (8 classes, one model)
Class index order is FIXED (alphabetical by class_id) and lives in backend/classes.json:

| idx | class_id | crop | display_name | dataset folder | is_healthy |
|---|---|---|---|---|---|
| 0 | maize_common_rust | maize | Common Rust | Corn_(maize)___Common_rust_ | false |
| 1 | maize_gray_leaf_spot | maize | Gray Leaf Spot | Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot | false |
| 2 | maize_healthy | maize | Healthy | Corn_(maize)___healthy | true |
| 3 | maize_northern_leaf_blight | maize | Northern Leaf Blight | Corn_(maize)___Northern_Leaf_Blight | false |
| 4 | tomato_early_blight | tomato | Early Blight | Tomato___Early_blight | false |
| 5 | tomato_healthy | tomato | Healthy | Tomato___healthy | true |
| 6 | tomato_late_blight | tomato | Late Blight | Tomato___Late_blight | false |
| 7 | tomato_septoria_leaf_spot | tomato | Septoria Leaf Spot | Tomato___Septoria_leaf_spot | false |

## Decision constants
CONF_THRESHOLD = 0.70 (top-1 prob after renormalising over the selected crop's classes)
MARGIN_THRESHOLD = 0.15 (top-1 minus top-2)
MISMATCH_THRESHOLD = 0.80 (raw softmax mass on the OTHER crop's classes)

## GET /api/health
200: {"status":"ok","model_loaded":true,"mock":false,"model_version":"mnv2-v1"}

## GET /api/crops
200: {"crops":[{"id":"tomato","display_name":"Tomato","classes":[{"class_id":"tomato_early_blight","display_name":"Early Blight","is_healthy":false}]}]}

## POST /api/predict   (multipart/form-data)
Fields: image (file: jpg/jpeg/png/webp, max 5 MB, min 64x64 px), crop ("tomato" | "maize")
Dev-only (MOCK_MODEL=1): query ?mock=disease|healthy|low_confidence|crop_mismatch forces the outcome.

200 body (outcome is one of "disease" | "healthy" | "low_confidence" | "crop_mismatch"):
```json
{
  "status": "ok",
  "outcome": "disease",
  "crop": "tomato",
  "detected_crop": null,
  "prediction": {"class_id": "tomato_early_blight", "display_name": "Early Blight", "confidence": 0.93, "is_healthy": false},
  "top_k": [
    {"class_id": "tomato_early_blight", "display_name": "Early Blight", "confidence": 0.93},
    {"class_id": "tomato_late_blight", "display_name": "Late Blight", "confidence": 0.05}
  ],
  "advice": {
    "disease_name": "Early Blight",
    "causal_agent": "Alternaria solani (fungus)",
    "severity": "moderate",
    "symptoms": ["Brown spots with ring-like marks", "Yellowing around spots", "Lower leaves affected first"],
    "organic_remedy": "Remove infected lower leaves; spray neem oil or copper-based fungicide every 7 days.",
    "chemical_remedy": "Chlorothalonil or mancozeb; follow the local label dose.",
    "prevention": ["Rotate crops every season", "Water at the base, not on leaves", "Stake plants for airflow"]
  },
  "message": "Likely Early Blight on your tomato leaf.",
  "latency_ms": 142,
  "model_version": "mnv2-v1"
}
```
Per outcome:
- healthy: prediction.is_healthy=true, advice = care tips (same shape; severity "low"), message "Your {crop} leaf looks healthy."
- low_confidence: prediction=null, advice=null, top_k still filled (2 items), message "No clear disease detected. Retake the photo in daylight with the leaf flat and filling most of the frame."
- crop_mismatch: prediction=null, advice=null, top_k=[], detected_crop set, message "This looks like a {detected_crop} leaf, not {crop}. Check your crop selection or retake the photo."
- disease message: "Likely {display_name} on your {crop} leaf."

## Errors (all: {"status":"error","code":"...","message":"..."})
| HTTP | code | when |
|---|---|---|
| 400 | NO_FILE | no image field |
| 400 | INVALID_CROP | crop missing or not tomato/maize |
| 400 | BAD_FILE_TYPE | extension not allowed |
| 400 | CORRUPT_IMAGE | Pillow cannot open or verify |
| 400 | IMAGE_TOO_SMALL | under 64x64 |
| 413 | FILE_TOO_LARGE | over 5 MB |
| 503 | MODEL_NOT_LOADED | model file missing and MOCK_MODEL not set |
| 500 | INTERNAL | anything else |

## Advice object shape (knowledge_base.json, keyed by class_id)
disease_name, causal_agent, severity ("low"|"moderate"|"high"), symptoms (2-3 strings), organic_remedy (string), chemical_remedy (string, generic active ingredient only, no brand names), prevention (2-4 strings).
