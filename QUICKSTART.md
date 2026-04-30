# Quick Start Guide - Silent Stroke Detector

## 🚀 Get Running in 5 Minutes

### Prerequisites
- Python 3.8+
- Webcam
- Microphone
- Windows/Mac/Linux

### Installation

1. **Install Python dependencies:**
```bash
cd Silent-Stroke-Detector
pip install -r requirements.txt
```

2. **Run the real-time app:**
```bash
streamlit run app_live.py
```

The app will open in your browser at `http://localhost:8501`

### Alternative Apps

We have 3 versions depending on your needs:

#### 1. **app_live.py** (RECOMMENDED for demos)
- ✅ Real-time webcam capture
- ✅ Live audio recording
- ✅ Best UI/UX
- ✅ Full feature set

```bash
streamlit run app_live.py
```

#### 2. **app_opencv_realtime.py** (Lightweight)
- ✅ OpenCV-based camera
- ✅ Simpler implementation
- ⚠️ Simulated audio (for testing)

```bash
streamlit run app_opencv_realtime.py
```

#### 3. **app.py** (Original - Static)
- ✅ Upload images
- ✅ Demo scenarios
- ⚠️ No real-time camera

```bash
streamlit run app.py
```

### Usage Instructions

1. **Allow camera/microphone permissions** when prompted
2. **Position your face** in the center of the green oval
3. **Click "Start Analysis"**
4. **Say "Ahhh"** for 3 seconds when prompted
5. **Review results** and download report if needed

### Features

✅ **Real-time facial landmark tracking** with MediaPipe  
✅ **Facial asymmetry scoring** (left vs right)  
✅ **Eye droop detection**  
✅ **Mouth tilt analysis**  
✅ **Speech pattern analysis** (pitch, rhythm, clarity)  
✅ **Multimodal fusion** (face + voice combined)  
✅ **Emergency alert system** with hospital routing  
✅ **Downloadable medical reports**  
✅ **Backend database integration** (optional)  

### Backend Setup (Optional)

If you want to save results to a database:

1. **Start the Node.js backend:**
```bash
cd backend
npm install
npm run dev
```

2. **Configure in the app:**
- Toggle "Save to Backend Database" in sidebar
- Enter backend URL: `http://localhost:8080`

### Troubleshooting

**Camera not working?**
- Check browser permissions
- Try a different browser (Chrome recommended)
- Restart the app

**Audio not recording?**
- Install sounddevice: `pip install sounddevice`
- Check microphone permissions
- Test with: `python -c "import sounddevice; print(sounddevice.query_devices())"`

**MediaPipe errors?**
- Reinstall: `pip install --upgrade mediapipe`
- Check Python version (3.8-3.11 recommended)

**Streamlit issues?**
- Clear cache: `streamlit cache clear`
- Update: `pip install --upgrade streamlit`

### Demo Tips

For impressive demos:
1. Use **good lighting** (face the light source)
2. **Stable camera** position
3. **Clear audio** environment
4. Test with **different scenarios**:
   - Normal: Symmetric face, clear speech
   - Borderline: Slight tilt, moderate speech
   - High risk: Asymmetric features, slurred speech

### Architecture

```
Frontend (Streamlit)
    ↓
Vision Module (MediaPipe + OpenCV)
    ↓
Audio Module (Librosa + sounddevice)
    ↓
Fusion Engine (Weighted/ML)
    ↓
Alert System (Hospital routing)
    ↓
Backend API (Node.js + Postgres) [Optional]
```

### Key Files

- `app_live.py` - Main real-time application
- `src/stroke_detector/vision/asymmetry.py` - Facial analysis
- `src/stroke_detector/audio/slur_features.py` - Speech analysis
- `src/stroke_detector/fusion/risk_fusion.py` - Multimodal fusion
- `src/stroke_detector/alerts/emergency.py` - Alert generation

### Next Steps

1. **Train a custom model**: See `src/stroke_detector/training/`
2. **Add Twilio integration**: For auto-calling hospitals
3. **Deploy to cloud**: Railway, Heroku, or AWS
4. **Collect real data**: With proper medical oversight

### Medical Disclaimer

⚠️ This is a **screening tool** for educational purposes only.  
It is **NOT a medical device** and should not be used for diagnosis.  
Always consult qualified healthcare professionals.

### Support

For issues or questions:
- Check the main README.md
- Review code comments
- Test with demo scenarios first

---

**Built for rapid stroke detection in rural areas where every minute counts.**
