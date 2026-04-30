from __future__ import annotations

import numpy as np

from src.stroke_detector.alerts.emergency import EmergencyAlertEngine
from src.stroke_detector.audio.slur_features import VoiceSlurAnalyzer
from src.stroke_detector.config import AppConfig
from src.stroke_detector.fusion.risk_fusion import RiskFusionEngine
from src.stroke_detector.models import StrokeScreeningResult
from src.stroke_detector.vision.asymmetry import FaceAsymmetryAnalyzer


class StrokeDetectionRuntime:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.face_analyzer = FaceAsymmetryAnalyzer()
        self.voice_analyzer = VoiceSlurAnalyzer()
        self.fusion_engine = RiskFusionEngine(config)
        self.alert_engine = EmergencyAlertEngine(config)

    def run(
        self,
        frame: np.ndarray,
        audio_waveform: np.ndarray,
        sample_rate: int,
        patient_name: str,
        location: str,
        scenario_label: str,
    ) -> StrokeScreeningResult:
        face = self.face_analyzer.analyze(frame)
        voice = self.voice_analyzer.analyze(audio_waveform, sample_rate)
        fusion = self.fusion_engine.predict(face, voice)
        alert = self.alert_engine.build_alert(fusion, patient_name=patient_name, location=location)

        features = {
            "face": {
                "asymmetry_score": face.asymmetry_score,
                "eye_droop_score": face.eye_droop_score,
                "mouth_tilt_score": face.mouth_tilt_score,
                "confidence": face.confidence,
                "landmark_count": face.landmark_count,
                "quality": face.quality,
            },
            "voice": {
                "pitch_variance": voice.pitch_variance,
                "speech_energy": voice.speech_energy,
                "rhythm_instability": voice.rhythm_instability,
                "slur_proxy_score": voice.slur_proxy_score,
                "confidence": voice.confidence,
            },
        }

        return StrokeScreeningResult.now(
            patient_name=patient_name,
            location=location,
            scenario_label=scenario_label,
            face=face,
            voice=voice,
            fusion=fusion,
            alert=alert,
            features=features,
        )
