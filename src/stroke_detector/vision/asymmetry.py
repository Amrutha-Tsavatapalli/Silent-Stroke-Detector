from __future__ import annotations

from pathlib import Path

import numpy as np

from src.stroke_detector.models import FaceAnalysis
from src.stroke_detector.vision.face_risk import FaceRiskModel
from src.stroke_detector.vision.facial_landmarks import FaceLandmarkExtractor
from src.stroke_detector.vision.features import FaceFeatureExtractor
from src.stroke_detector.vision.preprocess import FramePreprocessor
from src.stroke_detector.vision.quality_gate import FaceQualityGate


class FaceAsymmetryAnalyzer:
    def __init__(self, model_path: Path | None = None) -> None:
        self.preprocessor = FramePreprocessor()
        self.extractor = FaceLandmarkExtractor()
        self.quality_gate = FaceQualityGate()
        self.feature_extractor = FaceFeatureExtractor()
        self.risk_model = FaceRiskModel(model_path=model_path)

    def analyze(self, frame: np.ndarray) -> FaceAnalysis:
        prepared = self.preprocessor.prepare(frame)
        landmark_output = self.extractor.extract(prepared)
        points = landmark_output.landmarks

        quality = self.quality_gate.assess(prepared, points)
        features = self.feature_extractor.extract(points, landmark_output.confidence)
        risk, _ = self.risk_model.predict(features)

        usable = self.quality_gate.is_usable(quality)
        confidence = float(features.confidence if usable else min(features.confidence, 0.4))

        quality_payload = {
            "face_visible": 1.0 if quality.face_visible else 0.0,
            "blur_score": quality.blur_score,
            "lighting_score": quality.lighting_score,
            "face_size_ratio": quality.face_size_ratio,
            "yaw_score": quality.yaw_score,
            "usable": 1.0 if usable else 0.0,
        }

        return FaceAnalysis(
            asymmetry_score=float(features.asymmetry_score),
            eye_droop_score=float(features.eye_droop_score),
            mouth_tilt_score=float(features.mouth_tilt_score),
            confidence=confidence,
            risk_score=float(risk),
            landmark_count=int(features.landmark_count),
            quality=quality_payload,
        )
