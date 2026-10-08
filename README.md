# AI Crop-Disease Detector

Backend implementation for the API contract in [docs/API_CONTRACT.md](docs/API_CONTRACT.md).

**Remedies need review by a local agriculture extension officer before any real-world use.**

## Assumptions

- The API contract supplied in the project brief is the complete source of truth; the matching pasted contract was used to create `docs/API_CONTRACT.md` because the repository folder was initially empty.
- PlantVillage mirror images are provided by the user through Kaggle; the training script expects the extracted `color/` folder as its `--data-dir` input.
- No trained weights or PlantVillage dataset were present. The real-model Gunicorn acceptance check requires running the documented training flow first; until then, non-mock prediction returns the contract's `MODEL_NOT_LOADED` response.
