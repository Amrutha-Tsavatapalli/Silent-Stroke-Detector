"""Real-time stroke detection using OpenCV webcam capture."""
from __future__ import annotations

import io
import time
from threading import Thread

import cv2
import numpy as np
import streamlit as st

from src.stroke_detector.api.backend_client import BackendApiClient
from src.stroke_detector.config import AppConfig
from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
from src.stroke_detector.reports.generator import ReportGenerator


st.set_page_config(
    page_title="Silent Stroke Detector - Live",
    page_icon="🩺",
    layout="wide",
)


class CameraCapture:
    def __init__(self):
        self.cap = cv2.VideoCapture(0)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.current_frame = None
        self.running = False
        
    def start(self):
        self.running = True
        Thread(target=self._update, daemon=True).start()
        
    def _update(self):
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.current_frame = frame
            time.sleep(0.03)  # ~30 FPS
            
    def get_frame(self):
        return self.current_frame
    
    def stop(self):
        self.running = False
        self.cap.release()


def render_metric(label: str, value: float, help_text: str) -> None:
    st.metric(label, f"{value:.2f}", help=help_text)


def main() -> None:
    config = AppConfig()
    runtime = StrokeDetectionRuntime(config)
    report_generator = ReportGenerator()
    backend_client = BackendApiClient(config)

    st.title("🩺 Silent Stroke Detector - Live Camera")
    st.caption("Real-time stroke-risk screening using your webcam")

    # Initialize camera
    if "camera" not in st.session_state:
        st.session_state.camera = CameraCapture()
        st.session_state.camera.start()
    
    if "analysis_results" not in st.session_state:
        st.session_state.analysis_results = None

    with st.sidebar:
        st.header("⚙️ Session Setup")
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
        
        st.info("💡 Click 'Capture & Analyze' to run stroke detection")
        
        if st.button("🔄 Restart Camera"):
            st.session_state.camera.stop()
            st.session_state.camera = CameraCapture()
            st.session_state.camera.start()
            st.rerun()

    # Main layout
    col1, col2 = st.columns([1.2, 1])

    with col1:
        st.subheader("📹 Live Camera Feed")
        video_placeholder = st.empty()
        
        # Display live feed
        frame = st.session_state.camera.get_frame()
        if frame is not None:
            # Draw guide overlay
            h, w = frame.shape[:2]
            cv2.circle(frame, (w//2, h//2), 5, (0, 255, 0), -1)
            cv2.putText(frame, "Align face with center", (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            video_placeholder.image(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), 
                                   channels="RGB", use_container_width=True)
        else:
            video_placeholder.warning("⚠️ Camera not available")

    with col2:
        st.subheader("🎯 Analysis Controls")
        
        st.write("**Instructions:**")
        st.write("1. Position your face in the center")
        st.write("2. Look directly at the camera")
        st.write("3. Click 'Capture & Analyze'")
        st.write("4. Say 'Ahhh' for 3 seconds (audio simulated for now)")
        
        if st.button("🔍 Capture & Analyze", type="primary", use_container_width=True):
            frame = st.session_state.camera.get_frame()
            
            if frame is not None:
                with st.spinner("🔬 Analyzing facial features and speech patterns..."):
                    # Simulate audio capture (replace with real mic input later)
                    audio_waveform = np.random.randn(16000 * 3).astype(np.float32) * 0.1
                    sample_rate = 16000
                    
                    result = runtime.run(
                        frame=frame,
                        audio_waveform=audio_waveform,
                        sample_rate=sample_rate,
                        patient_name=patient_name,
                        location=location,
                        scenario_label="realtime_opencv",
                    )
                    
                    st.session_state.analysis_results = result
                    
                    if result.alert.should_alert:
                        st.error("🚨 HIGH RISK DETECTED!")
                    else:
                        st.success("✅ Analysis complete - Low risk")
            else:
                st.error("❌ No frame captured. Check camera connection.")

    # Display results
    if st.session_state.analysis_results is not None:
        result = st.session_state.analysis_results
        risk = result.fusion.risk_score
        face = result.face
        voice = result.voice
        alert = result.alert

        st.divider()
        st.subheader("📈 Risk Assessment Results")
        
        # Risk metrics
        metric_cols = st.columns(4)
        with metric_cols[0]:
            color = "🔴" if risk > 0.7 else "🟡" if risk > 0.4 else "🟢"
            st.metric("Overall Risk", f"{color} {risk:.2%}")
        with metric_cols[1]:
            render_metric("Face Risk", face.risk_score, "Asymmetry + eye droop + mouth tilt")
        with metric_cols[2]:
            render_metric("Voice Risk", voice.risk_score, "Speech rhythm + clarity")
        with metric_cols[3]:
            if alert.should_alert:
                st.metric("Alert Status", "🚨 URGENT")
            else:
                st.metric("Alert Status", "✅ Normal")

        # Progress bar
        st.progress(float(risk), text=f"Risk Level: {risk:.1%}")

        # Detailed breakdown
        detail_col1, detail_col2 = st.columns(2)
        
        with detail_col1:
            st.subheader("🔬 Detailed Features")
            
            with st.expander("👁️ Facial Analysis", expanded=True):
                st.write(f"**Asymmetry Score:** {face.asymmetry_score:.3f}")
                st.write(f"**Eye Droop Score:** {face.eye_droop_score:.3f}")
                st.write(f"**Mouth Tilt Score:** {face.mouth_tilt_score:.3f}")
                st.write(f"**Confidence:** {face.confidence:.2%}")
                st.write(f"**Landmarks Detected:** {face.landmark_count}")
            
            with st.expander("🎤 Voice Analysis", expanded=True):
                st.write(f"**Pitch Variance:** {voice.pitch_variance:.2f}")
                st.write(f"**Speech Energy:** {voice.speech_energy:.3f}")
                st.write(f"**Rhythm Instability:** {voice.rhythm_instability:.3f}")
                st.write(f"**Slur Proxy Score:** {voice.slur_proxy_score:.3f}")
                st.write(f"**Confidence:** {voice.confidence:.2%}")
        
        with detail_col2:
            st.subheader("🚨 Emergency Response")
            
            if alert.should_alert:
                st.error("**⚠️ IMMEDIATE ACTION REQUIRED**")
                st.write(f"**Priority Level:** {alert.priority}")
                st.write(f"**Nearest Hospital:** {alert.hospital_name}")
                st.write(f"**Emergency Contact:** {alert.hospital_phone}")
                st.write(f"**Message:** {alert.message}")
                
                if st.button("📞 Auto-Call Hospital", type="primary", use_container_width=True):
                    st.info("🔄 Initiating emergency call... (Feature in development)")
                    # TODO: Implement Twilio/phone call integration
            else:
                st.success("✅ **No immediate emergency detected**")
                st.info("Continue monitoring. Consult a doctor if symptoms persist.")

        # Emergency Report
        st.divider()
        st.subheader("📄 Medical Emergency Report")
        
        report_text = report_generator.generate_markdown(result)
        
        with st.expander("📋 View Full Report", expanded=False):
            st.markdown(report_text)

        # Actions
        action_col1, action_col2 = st.columns(2)
        
        with action_col1:
            st.download_button(
                "📥 Download Report (PDF-ready)",
                data=io.BytesIO(report_text.encode("utf-8")),
                file_name=f"stroke_emergency_report_{int(time.time())}.md",
                mime="text/markdown",
                use_container_width=True,
            )
        
        with action_col2:
            if config.persist_to_backend:
                if st.button("💾 Save to Hospital Database", use_container_width=True):
                    save_response = backend_client.save_screening(
                        result, 
                        report_excerpt=report_text[:1200]
                    )
                    if save_response.ok:
                        st.success(f"✅ Saved! ID: {save_response.payload.get('screeningId', 'n/a')}")
                    else:
                        st.warning(f"⚠️ Save failed: {save_response.error}")


if __name__ == "__main__":
    main()
