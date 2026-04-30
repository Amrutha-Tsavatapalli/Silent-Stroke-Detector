from __future__ import annotations

from src.stroke_detector.config import AppConfig
from src.stroke_detector.models import AlertDecision, FusionResult
from src.stroke_detector.services.hospital_locator import HospitalLocatorService


class EmergencyAlertEngine:
    def __init__(self, config: AppConfig) -> None:
        self.config = config
        self.locator = HospitalLocatorService(config.hospital_data_path)

    def build_alert(self, fusion: FusionResult, patient_name: str, location: str) -> AlertDecision:
        top_hospital = self.locator.nearest(location)
        should_alert = fusion.risk_score >= self.config.alert_threshold
        priority = "critical" if fusion.risk_score >= 0.85 else "urgent" if should_alert else "routine"
        message = (
            f"Possible stroke risk detected for {patient_name} at {location}. "
            f"Risk score {fusion.risk_score:.2f}. FAST follow-up and clinical evaluation recommended."
        )
        return AlertDecision(
            should_alert=should_alert,
            priority=priority,
            hospital_name=top_hospital["name"],
            hospital_phone=top_hospital["phone"],
            message=message,
        )
