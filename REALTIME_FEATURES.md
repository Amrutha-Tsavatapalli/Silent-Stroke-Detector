# Real-Time Features Documentation

## Overview

The Silent Stroke Detector now includes **real-time analysis** capabilities using webcam and microphone input. This enables immediate stroke risk screening without requiring pre-recorded media.

## New Applications

### 1. app_live.py (Production Ready) ⭐

**Best for:** Demos, presentations, and actual use cases

**Features:**
- ✅ Real-time webcam capture with background threading
- ✅ Live audio recording (3-second samples)
- ✅ MediaPipe facial landmark tracking (468 points)
- ✅ Interactive UI with visual guides
- ✅ Comprehensive results dashboard
- ✅ Emergency response planning
- ✅ Downloadable medical reports
- ✅ Backend database integration

**Usage:**
```bash
streamlit run app_live.py
```

**Key Components:**
- `CameraCapture` class: Background thread for continuous frame capture
- `draw_face_guide()`: Visual overlay to help users position correctly
- `record_audio_sync()`: Synchronous 3-second audio recording
- Real-time status updates during analysis

### 2. app_opencv_realtime.py (Lightweight)

**Best for:** Testing, development, simpler deployments

**Features:**
- ✅ OpenCV-based camera capture
- ✅ Simpler implementation
- ⚠️ Simulated audio (for testing without microphone)
- ✅ Basic real-time display

**Usage:**
```bash
streamlit run app_opencv_realtime.py
```

### 3. app_realtime.py (WebRTC-based)

**Best for:** Browser-based deployment, remote access

**Features:**
- ✅ WebRTC streaming (works in browser)
- ✅ No local camera access needed
- ⚠️ Requires streamlit-webrtc
- ⚠️ More complex setup

**Usage:**
```bash
streamlit run app_realtime.py
```

## Technical Implementation

### Facial Analysis Pipeline

```python
# 1. Capture frame from webcam
frame = camera.get_frame()

# 2. Extract facial landmarks using MediaPipe
landmarks = face_mesh.process(frame)
# Returns 468 3D points (x, y, z)

# 3. Calculate asymmetry metrics
left_side = landmarks[x < center_x]
right_side = landmarks[x >= center_x]
asymmetry_score = calculate_difference(left_side, right_side)

# 4. Detect eye droop
eye_droop_score = vertical_alignment(left_eye, right_eye)

# 5. Detect mouth tilt
mouth_tilt_score = horizontal_alignment(mouth_left, mouth_right)

# 6. Compute facial risk
face_risk = weighted_sum(asymmetry, eye_droop, mouth_tilt)
```

### Audio Analysis Pipeline

```python
# 1. Record audio from microphone
audio_waveform, sample_rate = record_audio_sync(duration=3.0)

# 2. Extract pitch features using Librosa
pitches, magnitudes = librosa.piptrack(y=audio_waveform, sr=sample_rate)
pitch_variance = np.var(pitches)

# 3. Calculate speech energy
speech_energy = np.mean(np.abs(audio_waveform))

# 4. Measure rhythm instability
zero_crossings = np.diff(np.signbit(audio_waveform))
rhythm_instability = deviation_from_normal(zero_crossings)

# 5. Compute slur proxy score
slur_score = combine(pitch_variance, rhythm_instability)

# 6. Compute voice risk
voice_risk = weighted_sum(slur_score, speech_energy)
```

### Multimodal Fusion

```python
# Combine face and voice risks
overall_risk = (face_risk * 0.55) + (voice_risk * 0.45)

# Or use trained ML model
if trained_model_available:
    features = [face_risk, asymmetry, eye_droop, mouth_tilt,
                voice_risk, rhythm, slur_score]
    overall_risk = model.predict_proba(features)[0][1]
```

## Key Metrics Explained

### Facial Metrics

| Metric | Range | Description | Stroke Indicator |
|--------|-------|-------------|------------------|
| **Asymmetry Score** | 0.0 - 1.0 | Difference between left/right facial features | Higher = more asymmetric |
| **Eye Droop Score** | 0.0 - 1.0 | Vertical misalignment of eyes | Higher = more droop |
| **Mouth Tilt Score** | 0.0 - 1.0 | Horizontal misalignment of mouth | Higher = more tilt |
| **Landmark Count** | 0 - 468 | Number of facial points detected | Lower = poor detection |
| **Confidence** | 0.0 - 1.0 | Detection reliability | Lower = uncertain |

### Voice Metrics

| Metric | Range | Description | Stroke Indicator |
|--------|-------|-------------|------------------|
| **Pitch Variance** | 0 - ∞ | Variation in voice frequency | Lower = monotone (slurred) |
| **Speech Energy** | 0.0 - 1.0 | Average amplitude of speech | Lower = weak speech |
| **Rhythm Instability** | 0.0 - 1.0 | Irregularity in speech pattern | Higher = irregular |
| **Slur Proxy Score** | 0.0 - 1.0 | Estimated speech clarity | Higher = more slurred |

### Overall Risk

| Risk Level | Score Range | Color | Action |
|------------|-------------|-------|--------|
| **Low** | 0.0 - 0.4 | 🟢 Green | Monitor, no immediate action |
| **Medium** | 0.4 - 0.7 | 🟡 Yellow | Consult doctor, continue monitoring |
| **High** | 0.7 - 1.0 | 🔴 Red | Emergency alert, call hospital |

## Camera Setup Best Practices

### Positioning
- **Distance:** 50-70 cm from camera
- **Angle:** Face camera directly (not tilted)
- **Height:** Camera at eye level
- **Framing:** Face fills 60-80% of frame

### Lighting
- ✅ Face the light source
- ✅ Avoid backlighting (window behind you)
- ✅ Even lighting on both sides of face
- ❌ Avoid harsh shadows
- ❌ Avoid direct overhead lighting

### Environment
- ✅ Stable camera position
- ✅ Neutral background
- ✅ Quiet room for audio
- ❌ Avoid moving background
- ❌ Avoid noisy environments

## Audio Recording Best Practices

### Instructions for Users
1. **Say "Ahhh"** continuously for 3 seconds
2. **Maintain steady volume** (don't shout or whisper)
3. **Clear pronunciation** (not mumbled)
4. **Minimize background noise**

### Technical Requirements
- **Sample Rate:** 16,000 Hz (16 kHz)
- **Duration:** 3 seconds minimum
- **Format:** Mono (single channel)
- **Bit Depth:** 32-bit float

## Performance Optimization

### Frame Rate
- **Capture:** 30 FPS
- **Analysis:** Every 30th frame (~1 FPS)
- **Reason:** Balance between responsiveness and CPU usage

### Threading
- **Camera capture:** Background thread
- **Analysis:** Main thread (blocking)
- **UI updates:** Streamlit rerun

### Memory Management
- Frame buffer: Single frame (no history)
- Audio buffer: 3 seconds max
- Results: Single analysis stored

## Error Handling

### Common Issues

**Camera not detected:**
```python
if frame is None:
    st.error("Camera not available")
    # Fallback: Use demo image or file upload
```

**MediaPipe fails:**
```python
if landmarks is None:
    # Fallback to geometric template
    landmarks = generate_fallback_landmarks(frame)
```

**Audio recording fails:**
```python
try:
    audio = record_audio_sync()
except Exception:
    # Fallback to simulated audio
    audio = generate_dummy_audio()
```

## Integration with Backend

### Saving Results

```python
if config.persist_to_backend:
    response = backend_client.save_screening(
        result=analysis_result,
        report_excerpt=report_text[:1200]
    )
    
    if response.ok:
        screening_id = response.payload['screeningId']
        st.success(f"Saved with ID: {screening_id}")
```

### Hospital Routing

```python
# Automatic hospital lookup based on location
hospital = hospital_locator.nearest(location="Rural household")

alert = AlertDecision(
    should_alert=risk > threshold,
    priority="critical" if risk > 0.85 else "urgent",
    hospital_name=hospital['name'],
    hospital_phone=hospital['phone'],
    message=f"Risk score {risk:.2f} detected"
)
```

## Future Enhancements

### Planned Features
- [ ] **Auto-call integration** (Twilio API)
- [ ] **SMS alerts** to emergency contacts
- [ ] **Video recording** of analysis session
- [ ] **Multi-language support**
- [ ] **Offline mode** with local storage
- [ ] **Mobile app** (React Native)
- [ ] **Trained ML models** (replace rule-based)
- [ ] **Real-time continuous monitoring**
- [ ] **Historical trend analysis**
- [ ] **Family member notifications**

### ML Model Training

To replace rule-based fusion with trained model:

```python
# 1. Collect labeled data
# 2. Train classifier
from sklearn.ensemble import RandomForestClassifier

model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

# 3. Save model
import joblib
joblib.dump(model, 'artifacts/fusion_model.joblib')

# 4. Enable in config
config.use_trained_fusion_model = True
```

## Testing

### Unit Tests
```bash
python test_setup.py
```

### Manual Testing Scenarios

**Scenario 1: Normal (Low Risk)**
- Symmetric face
- Clear speech
- Expected: Risk < 0.4

**Scenario 2: Borderline (Medium Risk)**
- Slight facial tilt
- Moderate speech clarity
- Expected: Risk 0.4 - 0.7

**Scenario 3: High Risk**
- Asymmetric features
- Slurred speech
- Expected: Risk > 0.7, Alert triggered

## Deployment

### Local Deployment
```bash
streamlit run app_live.py --server.port 8501
```

### Cloud Deployment (Railway/Heroku)
```bash
# Procfile
web: streamlit run app_live.py --server.port $PORT --server.address 0.0.0.0
```

### Docker
```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["streamlit", "run", "app_live.py"]
```

## Security Considerations

### Privacy
- ⚠️ Camera/audio data processed locally
- ⚠️ No data sent to external servers (unless backend enabled)
- ⚠️ User consent required for recording
- ⚠️ HIPAA compliance needed for medical use

### Data Protection
- Encrypt data in transit (HTTPS)
- Encrypt data at rest (database)
- Anonymize patient data
- Implement access controls

## License & Disclaimer

⚠️ **Medical Disclaimer:**
This is a **screening tool** for educational and demonstration purposes only.
It is **NOT a medical device** and has not been validated for clinical use.
Always consult qualified healthcare professionals for medical advice.

## Support

For issues or questions:
- Check QUICKSTART.md
- Run test_setup.py
- Review code comments
- Check Streamlit logs

---

**Every minute counts in stroke detection. This tool aims to save lives in rural areas with limited medical access.**
