# Silent Stroke Detector

An end-to-end prototype scaffold for a phone-camera-driven stroke risk screening app.
The project is organized around a multimodal pipeline:

- Face analyzer for facial asymmetry and eye droop heuristics
- Voice analyzer for slur and speech rhythm proxies
- Fusion engine that combines face and voice risk
- Alerting layer for hospital/family escalation
- Report generator for emergency summaries
- Streamlit UI for demo and rapid iteration

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

## Current status

This repo is intentionally scaffolded as a hackathon-ready skeleton:

- The pipeline runs end to end
- MediaPipe/OpenCV/Librosa hooks are in place
- A safe rule-based fusion path is available by default
- Optional trained classifiers can be dropped in later

## Project structure

```text
app.py
requirements.txt
data/hospitals.json
src/stroke_detector/
  alerts/
  audio/
  fusion/
  pipelines/
  reports/
  services/
  utils/
  vision/
```

## Safety note

This is a screening/demo prototype, not a medical device or diagnostic tool.
