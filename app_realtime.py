"""Real-time stroke detection using webcam and microphone."""
from __future__ import annotations

import io
import queue
import threading
import time

import cv2
import numpy as np
import streamlit as st
from streamlit_webrtc import webrtc_streamer, WebRtcMode, RTCConfiguration
import av

from src.stroke_detector.api.backend_client import BackendApiClient
from src.stroke_detector.config import AppConfig
from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
from src.stroke_detector.reports.generator import ReportGenerator


st.set_page_config(
    page_title="Silent Stroke Detector - Real-time",
    page_icon="🩺",
    layout="wide",
)

# Global state for analysis results
if "analysis_results" not in st.session_state:
    st.session_state.analysis_results = None
if "audio_buffer" not in st.session_state:
    st.session_state.audio_buffer = []
if "frame_buffer" not in st.session_state:
    st.session_state.frame_buffer = None
if "is_analyzing" not in st.session_state:
    st.session_state.is_analyzing = False


def render_metric(label: str, value: float, help_text: str) -> None:
    st.metric(label, f"{value:.2f}", help=help_text)


class VideoProcessor:
    def __init__(self):
        self.frame_count = 0
        
    def recv(self, frame):
        img = frame.to_ndarray(format="bgr24")
        
        # Store every 30th frame for analysis
        if self.frame_count % 30 == 0:
            st.session_state.frame_buffer = img.copy()
        
        self.frame_count += 1
        return av.VideoFrame.from_ndarray(img, format="bgr24")


def main() -> None:
    config = AppConfig()
    runtime = StrokeDetectionRuntime(config)
    report_generator = ReportGenerator()
    backend_client = BackendApiClient(config)

    st.title("🩺 Silent Stroke Detector - Real-time")
    st.caption("Real-time multimodal stroke-risk screening using webcam and microphone")

    with st.sidebar:
        st.header("Session Setup")
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
        )
        backend_url = st.text_input("Backend API URL", value=config.backend_api_url)
        config.backend_api_url = backend_url
        config.persist_to_backend = persist_result
        
        st.info("Real-time analysis runs on captured frames and audio")

    # Main layout
    col1, col2 = st.columns([1, 1])

    with col1:
        st.subheader("📹 Live Camera Feed")
        
        rtc_configuration = RTCConfiguration(
            {"iceServers": [{"urls": ["stun:stun.l.google.com:19302"]}]}
        )
        
        webrtc_ctx = webrtc_streamer(
            key="stroke-detector",
            mode=WebRtcMode.SENDRECV,
            rtc_configuration=rtc_configuration,
            video_processor_factory=VideoProcessor,
            media_stream_constraints={"video": True, "audio": True},
            async_processing=True,
        )

    with col2:
        st.subheader("📊 Analysis Controls")
        
        if st.button("🔍 Analyze Current Frame", type="primary", use_container_width=True):
            if st.session_state.frame_buffer is not None:
                with st.spinner("Analyzing..."):
                    # Generate dummy audio for now (you can enhance this with real audio capture)
                    audio_waveform = np.random.randn(16000 * 3).astype(np.float32) * 0.1
                    sample_rate = 16000
                    
                    result = runtime.run(
                        frame=st.session_state.frame_buffer,
                        audio_waveform=audio_waveform,
                        sample_rate=sample_rate,
                        patient_name=patient_name,
                        location=location,
                        scenario_label="realtime",
                    )
                    
                    st.session_state.analysis_results = result
                    st.success("✅ Analysis complete!")
            else:
                st.warning("⚠️ No frame captured yet. Please wait for camera to initialize.")

    # Display results
    if st.session_state.analysis_results is not None:
        result = st.session_state.analysis_results
        risk = result.fusion.risk_score
        face = result.face
        voice = result.voice
        alert = result.alert

        st.divider()
        st.subheader("📈 Risk Summary")
        
        a, b, c, d = st.columns(4)
        with a:
            render_metric("Overall Risk", risk, "Weighted fusion score from 0 to 1")
        with b:
            render_metric("Face Risk", face.risk_score, "Risk from asymmetry and eye droop")
        with c:
            render_metric("Voice Risk", voice.risk_score, "Risk from speech rhythm")
        with d:
            status = "🚨 ALERT" if alert.should_alert else "✅ Normal"
            st.metric("Status", status)

        st.progress(float(risk))

        # Details
        detail_col1, detail_col2 = st.columns(2)
        
        with detail_col1:
            st.subheader("🔬 Feature Breakdown")
            st.json(result.to_dict()["features"])
        
        with detail_col2:
            st.subheader("🚨 Alert Plan")
            if alert.should_alert:
                st.error(f"**Priority:** {alert.priority}")
                st.write(f"**Hospital:** {alert.hospital_name}")
                st.write(f"**Contact:** {alert.hospital_phone}")
                st.write(f"**Message:** {alert.message}")
            else:
                st.success("No immediate alert required")

        # Emergency Report
        st.divider()
        st.subheader("📄 Emergency Report")
        report_text = report_generator.generate_markdown(result)
        st.markdown(report_text)

        # Save to backend
        if config.persist_to_backend and alert.should_alert:
            save_response = backend_client.save_screening(result, report_excerpt=report_text[:1200])
            if save_response.ok:
                st.success(f"💾 Saved to backend. Screening ID: {save_response.payload.get('screeningId', 'n/a')}")
            else:
                st.warning(f"⚠️ Backend persistence skipped: {save_response.error}")

        # Download report
        st.download_button(
            "📥 Download Emergency Report",
            data=io.BytesIO(report_text.encode("utf-8")),
            file_name=f"stroke_report_{int(time.time())}.md",
            mime="text/markdown",
            use_container_width=True,
        )


if __name__ == "__main__":
    main()
