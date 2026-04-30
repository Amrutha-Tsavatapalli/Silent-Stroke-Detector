# Quick Reference Card

## 🚀 Installation (2 minutes)
```bash
pip install -r requirements.txt
streamlit run app_live.py
```

## 📱 Available Apps

| App | Best For | Command |
|-----|----------|---------|
| **app_live.py** ⭐ | Demos, production | `streamlit run app_live.py` |
| app_opencv_realtime.py | Testing, lightweight | `streamlit run app_opencv_realtime.py` |
| app_realtime.py | WebRTC, remote | `streamlit run app_realtime.py` |
| app.py | Static images | `streamlit run app.py` |

## 🎯 Key Features

✅ Real-time webcam capture (30 FPS)  
✅ Live audio recording (3 seconds)  
✅ MediaPipe facial landmarks (468 points)  
✅ Multimodal fusion (face + voice)  
✅ Emergency alert system  
✅ Downloadable medical reports  

## 📊 Risk Metrics

| Metric | Range | Meaning |
|--------|-------|---------|
| Overall Risk | 0.0 - 1.0 | Combined face + voice |
| Face Risk | 0.0 - 1.0 | Asymmetry + droop + tilt |
| Voice Risk | 0.0 - 1.0 | Pitch + rhythm + slur |
| Asymmetry | 0.0 - 1.0 | Left vs right difference |
| Eye Droop | 0.0 - 1.0 | Vertical misalignment |
| Mouth Tilt | 0.0 - 1.0 | Horizontal misalignment |

## 🎨 Risk Levels

| Level | Score | Color | Action |
|-------|-------|-------|--------|
| Low | 0.0 - 0.4 | 🟢 | Monitor |
| Medium | 0.4 - 0.7 | 🟡 | Consult doctor |
| High | 0.7 - 1.0 | 🔴 | Emergency alert |

## 🔧 Troubleshooting

**Camera not working?**
```bash
python -c "import cv2; print(cv2.VideoCapture(0).isOpened())"
```

**Audio not working?**
```bash
python -c "import sounddevice; print(sounddevice.query_devices())"
```

**MediaPipe errors?**
```bash
pip install --upgrade mediapipe
```

**Test everything:**
```bash
python test_setup.py
```

## 📁 Key Files

| File | Purpose |
|------|---------|
| `app_live.py` | Main real-time app |
| `src/stroke_detector/vision/asymmetry.py` | Facial analysis |
| `src/stroke_detector/audio/slur_features.py` | Speech analysis |
| `src/stroke_detector/fusion/risk_fusion.py` | Multimodal fusion |
| `src/stroke_detector/alerts/emergency.py` | Alert system |

## 🎬 Demo Script (30 seconds)

1. **Open app:** `streamlit run app_live.py`
2. **Position face:** Center in green oval
3. **Click:** "Start Analysis"
4. **Speak:** "Ahhh" for 3 seconds
5. **Show results:** Risk score + alert

## 💡 Demo Tips

✅ Good lighting (face the light)  
✅ Stable camera position  
✅ Quiet environment  
✅ Test beforehand  
✅ Have backup screenshots  

## 🏗️ Architecture (1 sentence)

Camera → MediaPipe → Face Features → Fusion Engine ← Voice Features ← Librosa ← Microphone → Risk Score → Alert System

## 📞 Emergency Contacts

**India:** 108 (Ambulance)  
**US:** 911  
**UK:** 999  

## ⚠️ Disclaimer

This is a **screening tool**, not a diagnostic device. Always consult medical professionals.

## 🎯 Success Metrics

- ✅ Working demo in < 5 minutes
- ✅ Real-time analysis (< 6 seconds)
- ✅ Clear risk visualization
- ✅ Emergency report generation

## 📚 Documentation

- `QUICKSTART.md` - Setup guide
- `REALTIME_FEATURES.md` - Technical docs
- `DEMO_GUIDE.md` - Presentation script
- `IMPLEMENTATION_SUMMARY.md` - What was built

## 🚀 Next Steps

1. Test with `python test_setup.py`
2. Run demo with `streamlit run app_live.py`
3. Review `DEMO_GUIDE.md` for presentation
4. Practice demo scenarios

---

**You're ready to demo! Good luck! 🩺**
