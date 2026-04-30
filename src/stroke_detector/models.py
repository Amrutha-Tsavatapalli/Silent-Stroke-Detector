from __future__ import annotations

from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class FaceAnalysis:
    asymmetry_score: float
    eye_droop_score: float
    mouth_tilt_score: float
    confidence: float
    risk_score: float
    landmark_count: int
    quality: dict[str, float] = field(default_factory=dict)


@dataclass
class VoiceAnalysis:
    pitch_variance: float
    speech_energy: float
    rhythm_instability: float
    slur_proxy_score: float
    confidence: float
    risk_score: float


@dataclass
class FusionResult:
    risk_score: float
    decision: str
    explanation: str
    model_type: str


@dataclass
class AlertDecision:
    should_alert: bool
    priority: str
    hospital_name: str
    hospital_phone: str
    message: str


@dataclass
class StrokeScreeningResult:
    patient_name: str
    location: str
    scenario_label: str
    created_at: str
    face: FaceAnalysis
    voice: VoiceAnalysis
    fusion: FusionResult
    alert: AlertDecision
    features: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    @classmethod
    def now(
        cls,
        patient_name: str,
        location: str,
        scenario_label: str,
        face: FaceAnalysis,
        voice: VoiceAnalysis,
        fusion: FusionResult,
        alert: AlertDecision,
        features: dict[str, Any],
    ) -> "StrokeScreeningResult":
        return cls(
            patient_name=patient_name,
            location=location,
            scenario_label=scenario_label,
            created_at=datetime.utcnow().isoformat(timespec="seconds") + "Z",
            face=face,
            voice=voice,
            fusion=fusion,
            alert=alert,
            features=features,
        )
