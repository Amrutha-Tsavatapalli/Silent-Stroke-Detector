"""
Real-time Silent Stroke Detector with live camera and microphone.
This is the production-ready version for demos.
"""
from __future__ import annotations

import io
import time
from threading import Thread

import cv2
import numpy as np
import streamlit as st

from src.stroke_detector.api.backend_client import BackendApiClient
from src.stroke_detector.audio.recorder import record_audio_sync
from src.stroke_detector.config import AppConfig
from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
from src.stroke_detector.reports.generator import ReportGenerator


st.set_page_config(
    page_title="Silent Stroke Detector",
    page_icon="🩺",
    layout="wide",
    initial_sidebar_state="expanded",
)


class CameraCapture:
    """Manages webcam capture in a background thread."""
    
    def __init__(self, camera_id: int = 0):
        self.cap = cv2.VideoCapture(camera_id)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        self.current_frame = None
        self.running = False
        self.thread = None
        
    def start(self):
        """Start capturing frames in background thread."""
        if not self.running:
            self.running = True
            self.thread = Thread(target=self._capture_loop, daemon=True)
            self.thread.start()
        
    def _capture_loop(self):
        """Background loop to continuously capture frames."""
        while self.running:
            ret, frame = self.cap.read()
            if ret:
                self.current_frame = frame
            time.sleep(0.033)  # ~30 FPS
            
    def get_frame(self):
        """Get the most recent frame."""
        return self.current_frame
    
    def stop(self):
        """Stop capturing and release camera."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
        self.cap.release()


def render_metric(label: str, value: float, help_text: str = "") -> None:
    """Render a metric with formatting."""
    st.metric(label, f"{value:.2f}", help=help_text)


def draw_face_guide(frame: np.ndarray) -> np.ndarray:
    """Draw guide overlay on frame to help user position face."""
    h, w = frame.shape[:2]
    overlay = frame.copy()
    
    # Draw center circle
    cv2.circle(overlay, (w//2, h//2), 8, (0, 255, 0), -1)
    
    # Draw face oval guide
    center = (w//2, h//2)
    axes = (w//4, h//3)
    cv2.ellipse(overlay, center, axes, 0, 0, 360, (0, 255, 0), 2)
    
    # Add text instructions
    cv2.putText(overlay, "Align face with oval", (20, 40), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    cv2.putText(overlay, "Look directly at camera", (20, 75), 
               cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
    
    return overlay


def main() -> None:
    # Initialize config and services
    config = AppConfig()
    runtime = StrokeDetectionRuntime(config)
    report_generator = ReportGenerator()
    backend_client = BackendApiClient(config)

    # Page header
    st.title("🩺 Silent Stroke Detector")
    st.markdown("""
    **Real-time stroke risk screening using AI-powered facial and speech analysis**
    
    This app analyzes micro facial asymmetry, eye droop, and speech patterns to detect potential stroke symptoms.
    """)

    # Initialize session state
    if "camera" not in st.session_state:
        st.session_state.camera = CameraCapture()
        st.session_state.camera.start()
    
    if "analysis_results" not in st.session_state:
        st.session_state.analysis_results = None
    
    if "show_instructions" not in st.session_state:
        st.session_state.show_instructions = True

    # Sidebar configuration
    with st.sidebar:
        st.header("⚙️ Configuration")
        
        st.subheader("Patient Information")
        patient_name = st.text_input("Patient Name", value="Anonymous", key="patient_name")
        location = st.text_input("Location", value="Rural household", key="location")
        
        st.subheader("Detection Settings")
        alert_threshold = st.slider(
            "Alert Threshold",
            min_value=0.1,
            max_value=0.95,
            value=config.alert_threshold,
            step=0.05,
            help="Risk score above this triggers emergency alert",
        )
        config.alert_threshold = alert_threshold
        
        st.subheader("Backend Integration")
        persist_result = st.toggle(
            "Save to Backend Database",
            value=config.persist_to_backend,
            help="Store screening results in hospital database",
        )
        
        if persist_result:
            backend_url = st.text_input(
                "Backend API URL", 
                value=config.backend_api_url,
                key="backend_url"
            )
            config.backend_api_url = backend_url
        
        config.persist_to_backend = persist_result
        
        st.divider()
        
        st.subheader("Camera Controls")
        if st.button("🔄 Restart Camera", use_container_width=True):
            st.session_state.camera.stop()
            st.session_state.camera = CameraCapture()
            st.session_state.camera.start()
            st.rerun()
        
        st.info("💡 **Tip:** Ensure good lighting and face the camera directly")

    # Show instructions on first load
    if st.session_state.show_instructions:
        with st.expander("📖 How to Use", expanded=True):
            st.markdown("""
            ### Instructions:
            
            1. **Position yourself**: Sit comfortably facing the camera with good lighting
            2. **Align your face**: Center your face within the green oval guide
            3. **Click 'Start Analysis'**: The system will capture your image
            4. **Speak when prompted**: Say "Ahhh" clearly for 3 seconds
            5. **Review results**: Check your risk assessment and recommendations
            
            ### What we analyze:
            - **Facial Asymmetry**: Left vs right side differences
            - **Eye Droop**: Vertical alignment of eyes
            - **Mouth Tilt**: Horizontal alignment of mouth corners
            - **Speech Patterns**: Voice rhythm, pitch variance, and clarity
            
            ⚠️ **Important**: This is a screening tool, not a diagnostic device. 
            Always consult medical professionals for proper diagnosis.
            """)
            
            if st.button("Got it! Hide instructions"):
                st.session_state.show_instructions = False
                st.rerun()

    # Main content area
    col1, col2 = st.columns([1.3, 1])

    with col1:
        st.subheader("📹 Live Camera Feed")
        video_placeholder = st.empty()
        
        # Display live feed with guide overlay
        frame = st.session_state.camera.get_frame()
        if frame is not None:
            display_frame = draw_face_guide(frame)
            video_placeholder.image(
                cv2.cvtColor(display_frame, cv2.COLOR_BGR2RGB), 
                channels="RGB", 
                use_container_width=True
            )
        else:
            video_placeholder.error("❌ Camera not available. Please check camera permissions.")

    with col2:
        st.subheader("🎯 Analysis Control")
        
        st.markdown("### Ready to analyze?")
        st.write("The system will:")
        st.write("1. 📸 Capture your current frame")
        st.write("2. 🎤 Record 3 seconds of audio")
        st.write("3. 🔬 Analyze facial features")
        st.write("4. 📊 Generate risk assessment")
        
        st.divider()
        
        analyze_button = st.button(
            "🚀 Start Analysis", 
            type="primary", 
            use_container_width=True,
            help="Capture frame and record audio for analysis"
        )
        
        if analyze_button:
            frame = st.session_state.camera.get_frame()
            
            if frame is None:
                st.error("❌ No camera frame available. Please check your camera.")
            else:
                # Step 1: Capture frame
                with st.status("🔬 Running stroke risk analysis...", expanded=True) as status:
                    st.write("📸 Frame captured successfully")
                    
                    # Step 2: Record audio
                    st.write("🎤 Recording audio... Please say 'Ahhh' for 3 seconds")
                    audio_waveform, sample_rate = record_audio_sync(duration=3.0)
                    st.write("✅ Audio recorded")
                    
                    # Step 3: Run analysis
                    st.write("🧠 Analyzing facial landmarks with MediaPipe...")
                    st.write("🔊 Analyzing speech patterns...")
                    
                    result = runtime.run(
                        frame=frame,
                        audio_waveform=audio_waveform,
                        sample_rate=sample_rate,
                        patient_name=patient_name,
                        location=location,
                        scenario_label="live_capture",
                    )
                    
                    st.session_state.analysis_results = result
                    
                    st.write("✅ Analysis complete!")
                    status.update(label="✅ Analysis complete!", state="complete")
                
                # Show alert if high risk
                if result.alert.should_alert:
                    st.error("🚨 **HIGH RISK DETECTED** - Review results below")
                else:
                    st.success("✅ Analysis complete - Review results below")

    # Display results section
    if st.session_state.analysis_results is not None:
        result = st.session_state.analysis_results
        risk = result.fusion.risk_score
        face = result.face
        voice = result.voice
        alert = result.alert

        st.divider()
        st.header("📊 Analysis Results")
        
        # Risk summary metrics
        st.subheader("Risk Assessment Summary")
        metric_cols = st.columns(4)
        
        with metric_cols[0]:
            risk_emoji = "🔴" if risk > 0.7 else "🟡" if risk > 0.4 else "🟢"
            st.metric(
                "Overall Risk", 
                f"{risk_emoji} {risk:.1%}",
                help="Combined risk score from facial and voice analysis"
            )
        
        with metric_cols[1]:
            render_metric(
                "Facial Risk", 
                face.risk_score, 
                "Risk from asymmetry, eye droop, and mouth tilt"
            )
        
        with metric_cols[2]:
            render_metric(
                "Voice Risk", 
                voice.risk_score, 
                "Risk from speech rhythm and clarity"
            )
        
        with metric_cols[3]:
            if alert.should_alert:
                st.metric("Alert Status", "🚨 URGENT", help="Immediate medical attention recommended")
            else:
                st.metric("Alert Status", "✅ Normal", help="No immediate alert required")

        # Risk progress bar
        st.progress(float(risk), text=f"Overall Risk Level: {risk:.1%}")

        # Detailed analysis tabs
        tab1, tab2, tab3, tab4 = st.tabs(["👁️ Facial Analysis", "🎤 Voice Analysis", "🚨 Emergency Response", "📄 Full Report"])
        
        with tab1:
            st.subheader("Facial Feature Analysis")
            
            face_col1, face_col2 = st.columns(2)
            
            with face_col1:
                st.metric("Asymmetry Score", f"{face.asymmetry_score:.3f}", 
                         help="Difference between left and right facial features")
                st.metric("Eye Droop Score", f"{face.eye_droop_score:.3f}",
                         help="Vertical misalignment of eyes")
                st.metric("Mouth Tilt Score", f"{face.mouth_tilt_score:.3f}",
                         help="Horizontal misalignment of mouth")
            
            with face_col2:
                st.metric("Detection Confidence", f"{face.confidence:.1%}",
                         help="Reliability of facial landmark detection")
                st.metric("Landmarks Detected", f"{face.landmark_count}",
                         help="Number of facial points tracked by MediaPipe")
                st.metric("Analysis Source", "MediaPipe" if face.confidence > 0.8 else "Fallback",
                         help="Detection method used")
        
        with tab2:
            st.subheader("Speech Pattern Analysis")
            
            voice_col1, voice_col2 = st.columns(2)
            
            with voice_col1:
                st.metric("Pitch Variance", f"{voice.pitch_variance:.2f}",
                         help="Variation in voice pitch (Hz²)")
                st.metric("Speech Energy", f"{voice.speech_energy:.3f}",
                         help="Average amplitude of speech signal")
            
            with voice_col2:
                st.metric("Rhythm Instability", f"{voice.rhythm_instability:.3f}",
                         help="Irregularity in speech rhythm")
                st.metric("Slur Proxy Score", f"{voice.slur_proxy_score:.3f}",
                         help="Estimated speech clarity score")
        
        with tab3:
            st.subheader("Emergency Response Plan")
            
            if alert.should_alert:
                st.error("### ⚠️ IMMEDIATE ACTION REQUIRED")
                
                response_col1, response_col2 = st.columns(2)
                
                with response_col1:
                    st.markdown(f"""
                    **Priority Level:** {alert.priority}
                    
                    **Nearest Hospital:** {alert.hospital_name}
                    
                    **Emergency Contact:** {alert.hospital_phone}
                    
                    **Recommended Action:** {alert.message}
                    """)
                
                with response_col2:
                    st.warning("### Next Steps:")
                    st.markdown("""
                    1. Call emergency services immediately
                    2. Note the time symptoms started
                    3. Do not eat or drink anything
                    4. Lie down with head slightly elevated
                    5. Download and share the emergency report
                    """)
                
                st.divider()
                
                call_col1, call_col2 = st.columns(2)
                with call_col1:
                    if st.button("📞 Auto-Call Hospital", type="primary", use_container_width=True):
                        st.info("🔄 Initiating emergency call to " + alert.hospital_phone)
                        st.warning("⚠️ Auto-call feature requires Twilio integration (coming soon)")
                
                with call_col2:
                    if st.button("📱 Send SMS Alert", use_container_width=True):
                        st.info("📤 Sending SMS to emergency contacts...")
                        st.warning("⚠️ SMS feature requires Twilio integration (coming soon)")
            
            else:
                st.success("### ✅ No Immediate Emergency Detected")
                st.info("""
                **Recommendations:**
                - Continue monitoring for any changes
                - Consult a doctor if symptoms develop or persist
                - Maintain a healthy lifestyle
                - Schedule regular health checkups
                """)
        
        with tab4:
            st.subheader("Complete Medical Report")
            
            report_text = report_generator.generate_markdown(result)
            
            st.markdown(report_text)
            
            st.divider()
            
            # Action buttons
            action_col1, action_col2, action_col3 = st.columns(3)
            
            with action_col1:
                st.download_button(
                    "📥 Download Report",
                    data=io.BytesIO(report_text.encode("utf-8")),
                    file_name=f"stroke_report_{patient_name}_{int(time.time())}.md",
                    mime="text/markdown",
                    use_container_width=True,
                    help="Download as Markdown file"
                )
            
            with action_col2:
                if config.persist_to_backend:
                    if st.button("💾 Save to Database", use_container_width=True):
                        with st.spinner("Saving to backend..."):
                            save_response = backend_client.save_screening(
                                result, 
                                report_excerpt=report_text[:1200]
                            )
                            if save_response.ok:
                                st.success(f"✅ Saved! ID: {save_response.payload.get('screeningId', 'n/a')}")
                            else:
                                st.error(f"❌ Save failed: {save_response.error}")
            
            with action_col3:
                if st.button("🔄 New Analysis", use_container_width=True):
                    st.session_state.analysis_results = None
                    st.rerun()

    # Footer
    st.divider()
    st.caption("""
    ⚠️ **Medical Disclaimer**: This is a screening tool for educational and demonstration purposes only. 
    It is not a medical device and should not be used for diagnosis. Always consult qualified healthcare 
    professionals for medical advice, diagnosis, or treatment.
    """)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        st.error(f"Application error: {str(e)}")
        st.exception(e)
