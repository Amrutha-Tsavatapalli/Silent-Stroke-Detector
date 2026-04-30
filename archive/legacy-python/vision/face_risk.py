from __future__ import annotations

from pathlib import Path

import numpy as np

try:
    import joblib
except Exception:  # pragma: no cover - optional dependency fallback
    joblib = None

from src.stroke_detector.vision.features import FaceFeatures


class FaceRiskModel:
    def __init__(self, model_path: Path | None = None) -> None:
        self.model_path = model_path
        self.model = self._try_load_model(model_path)

    def predict(self, features: FaceFeatures) -> tuple[float, str]:
        feature_vector = np.array(
            [
                features.asymmetry_score,
                features.eye_droop_score,
                features.mouth_tilt_score,
            ],
            dtype=np.float32,
        ).reshape(1, -1)

        if self.model is not None:
            risk = float(self.model.predict_proba(feature_vector)[0][1])
            model_type = "trained_face_classifier"
        else:
            risk = float(
                np.clip(
                    0.45 * features.asymmetry_score
                    + 0.30 * features.eye_droop_score
                    + 0.25 * features.mouth_tilt_score,
                    0.0,
                    1.0,
                )
            )
            model_type = "weighted_rule_face"

        return risk, model_type

    def _try_load_model(self, model_path: Path | None):
        if model_path is None or joblib is None:
            return None
        if model_path.exists():
            return joblib.load(model_path)
        return None
