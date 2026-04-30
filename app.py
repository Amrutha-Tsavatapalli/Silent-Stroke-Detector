from __future__ import annotations

import io

import cv2
import numpy as np
import streamlit as st

from src.stroke_detector.api.backend_client import BackendApiClient
from src.stroke_detector.config import AppConfig
from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
from src.stroke_detector.reports.generator import ReportGenerator
from src.stroke_detector.utils.demo_data import build_demo_audio, build_demo_image


st.set_page_config(
    page_title="Silent Stroke Detector",
    page_icon="🩺",
    layout="wide",
)


def uploaded_file_to_bgr(file) -> np.ndarray:
    bytes_data = np.asarray(bytearray(file.read()), dtype=np.uint8)
    image = cv2.imdecode(bytes_data, cv2.IMREAD_COLOR)
    if image is None:
        raise ValueError("Unable to decode uploaded image.")
    return image


def render_metric(label: str, value: float, help_text: str) -> None:
    st.metric(label, f"{value:.2f}", help=help_text)


def main() -> None:
    config = AppConfig()
    runtime = StrokeDetectionRuntime(config)
    report_generator = ReportGenerator()
    backend_client = BackendApiClient(config)

    st.title("Silent Stroke Detector")
    st.caption(
        "Demo pipeline for multimodal stroke-risk screening using face asymmetry and speech cues."
    )

    with st.sidebar:
        st.header("Session Setup")
        mode = st.radio(
            "Input mode",
            options=["Demo simulation", "Upload image + simulated audio"],
            index=0,
        )
        alert_threshold = st.slider(
            "Alert threshold",
            min_value=0.1,
            max_value=0.95,
            value=config.alert_threshold,
            step=0.05,
        )
        config.alert_threshold = alert_threshold

        patient_name = st.text_input("Patient name", value="Anonymous")
        location = st.text_input("Location", value="Rural household")
        persist_result = st.toggle(
            "Save screening to backend",
            value=config.persist_to_backend,
            help="Persists the result to the Express backend and Railway Postgres when available.",
        )
        backend_url = st.text_input("Backend API URL", value=config.backend_api_url)
        config.backend_api_url = backend_url
        config.persist_to_backend = persist_result
        st.info(
            "This scaffold defaults to a rule-based risk score. "
            "Drop in trained models later without changing the UI flow."
        )

    left, right = st.columns([1.2, 1.0])

    with left:
        st.subheader("Face / Camera Input")
        if mode == "Demo simulation":
            scenario = st.selectbox("Scenario", ["normal", "borderline", "high_risk"], index=0)
            image = build_demo_image(scenario)
            st.image(cv2.cvtColor(image, cv2.COLOR_BGR2RGB), channels="RGB")
        else:
            upload = st.file_uploader("Upload front-face image", type=["jpg", "jpeg", "png"])
            if upload is None:
                st.warning("Upload a face image to run the pipeline.")
                return
            image = uploaded_file_to_bgr(upload)
            st.image(cv2.cvtColor(image, cv2.COLOR_BGR2RGB), channels="RGB")
            scenario = "uploaded"

    with right:
        st.subheader("Voice / Audio Input")
        if mode == "Demo simulation":
            audio_waveform, sample_rate = build_demo_audio(scenario)
            st.write(f"Simulated audio generated at {sample_rate} Hz")
        else:
            scenario = "uploaded"
            severity_hint = st.select_slider(
                "Simulated speech condition",
                options=["normal", "borderline", "high_risk"],
                value="borderline",
            )
            audio_waveform, sample_rate = build_demo_audio(severity_hint)
            st.write(
                "Audio placeholder is simulated in this scaffold so the rest of the pipeline stays runnable."
            )

    if st.button("Run Stroke Risk Analysis", type="primary", use_container_width=True):
        result = runtime.run(
            frame=image,
            audio_waveform=audio_waveform,
            sample_rate=sample_rate,
            patient_name=patient_name,
            location=location,
            scenario_label=scenario,
        )

        risk = result.fusion.risk_score
        face = result.face
        voice = result.voice
        alert = result.alert

        st.subheader("Risk Summary")
        a, b, c, d = st.columns(4)
        with a:
            render_metric("Overall risk", risk, "Weighted fusion score from 0 to 1.")
        with b:
            render_metric("Face risk", face.risk_score, "Risk inferred from asymmetry and eye droop.")
        with c:
            render_metric("Voice risk", voice.risk_score, "Risk inferred from speech rhythm and clarity.")
        with d:
            render_metric("Alert trigger", 1.0 if alert.should_alert else 0.0, "1 means escalation recommended.")

        st.progress(float(risk))

        insight_col, alert_col = st.columns(2)
        with insight_col:
            st.subheader("Feature Breakdown")
            st.json(result.to_dict()["features"])
        with alert_col:
            st.subheader("Alert Plan")
            st.json(
                {
                    "should_alert": alert.should_alert,
                    "priority": alert.priority,
                    "hospital": alert.hospital_name,
                    "contact": alert.hospital_phone,
                    "message": alert.message,
                }
            )

        st.subheader("Emergency Report")
        report_text = report_generator.generate_markdown(result)
        st.markdown(report_text)

        if config.persist_to_backend:
            save_response = backend_client.save_screening(result, report_excerpt=report_text[:1200])
            if save_response.ok:
                st.success(f"Saved to backend. Screening ID: {save_response.payload.get('screeningId', 'n/a')}")
            else:
                st.warning(f"Backend persistence skipped: {save_response.error}")

        st.download_button(
            "Download report",
            data=io.BytesIO(report_text.encode("utf-8")),
            file_name="stroke_emergency_report.md",
            mime="text/markdown",
            use_container_width=True,
        )


if __name__ == "__main__":
    main()
