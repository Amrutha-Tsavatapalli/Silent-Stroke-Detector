from __future__ import annotations

from src.stroke_detector.models import StrokeScreeningResult


class ReportGenerator:
    def generate_markdown(self, result: StrokeScreeningResult) -> str:
        return f"""# Stroke Emergency Screening Report

## Patient
- Name: {result.patient_name}
- Location: {result.location}
- Scenario: {result.scenario_label}
- Timestamp: {result.created_at}

## Risk Summary
- Overall risk: {result.fusion.risk_score:.2f}
- Decision: {result.fusion.decision}
- Alert required: {result.alert.should_alert}
- Fusion model: {result.fusion.model_type}

## Face Analysis
- Asymmetry score: {result.face.asymmetry_score:.2f}
- Eye droop score: {result.face.eye_droop_score:.2f}
- Mouth tilt score: {result.face.mouth_tilt_score:.2f}
- Face risk: {result.face.risk_score:.2f}
- Landmark count: {result.face.landmark_count}

## Voice Analysis
- Pitch variance: {result.voice.pitch_variance:.2f}
- Speech energy: {result.voice.speech_energy:.2f}
- Rhythm instability: {result.voice.rhythm_instability:.2f}
- Slur proxy score: {result.voice.slur_proxy_score:.2f}
- Voice risk: {result.voice.risk_score:.2f}

## Alert Recommendation
- Priority: {result.alert.priority}
- Hospital: {result.alert.hospital_name}
- Phone: {result.alert.hospital_phone}
- Message: {result.alert.message}

## Disclaimer
This prototype is not a diagnosis. Immediate medical evaluation is required for suspected stroke symptoms.
"""
