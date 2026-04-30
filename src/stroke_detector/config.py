from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class AppConfig:
    alert_threshold: float = 0.70
    face_weight: float = 0.55
    voice_weight: float = 0.45
    use_trained_fusion_model: bool = False
    fusion_model_path: Path = Path("artifacts/fusion_model.joblib")
    hospital_data_path: Path = Path("data/hospitals.json")
    report_output_dir: Path = Path("artifacts/reports")
    supported_face_landmarks: int = 468
    metadata: dict = field(
        default_factory=lambda: {
            "app_name": "Silent Stroke Detector",
            "prototype_mode": True,
        }
    )
