from __future__ import annotations

from pathlib import Path

import joblib
import numpy as np

from src.stroke_detector.config import AppConfig
from src.stroke_detector.models import FaceAnalysis, FusionResult, VoiceAnalysis


class RiskFusionEngine:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.model = self._try_load_model(config.fusion_model_path) if config.use_trained_fusion_model else None

    def predict(self, face: FaceAnalysis, voice: VoiceAnalysis) -> FusionResult:
        features = np.array(
            [
                face.risk_score,
                face.asymmetry_score,
                face.eye_droop_score,
                face.mouth_tilt_score,
                voice.risk_score,
                voice.rhythm_instability,
                voice.slur_proxy_score,
            ],
            dtype=np.float32,
        ).reshape(1, -1)

        if self.model is not None:
            risk = float(self.model.predict_proba(features)[0][1])
            model_type = "trained_classifier"
        else:
            risk = float(
                np.clip(
                    face.risk_score * self.config.face_weight
                    + voice.risk_score * self.config.voice_weight,
                    0.0,
                    1.0,
                )
            )
            model_type = "weighted_rule_fusion"

        decision = "high_risk" if risk >= self.config.alert_threshold else "monitor"
        explanation = (
            "High multimodal risk detected from combined facial asymmetry and speech cues."
            if decision == "high_risk"
            else "Risk below alert threshold; continue monitoring and repeat screening if symptoms persist."
        )
        return FusionResult(
            risk_score=risk,
            decision=decision,
            explanation=explanation,
            model_type=model_type,
        )

    def _try_load_model(self, model_path: Path):
        if model_path.exists():
            return joblib.load(model_path)
        return None
