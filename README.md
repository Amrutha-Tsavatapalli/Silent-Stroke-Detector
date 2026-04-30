# Silent Stroke Detector

An end-to-end prototype scaffold for a phone-camera-driven stroke risk screening app.

## Stack

- Frontend/demo app: Streamlit
- ML/inference layer: Python, MediaPipe, OpenCV, Librosa, scikit-learn
- Backend API: Node.js, Express
- Database: Railway Postgres
- Reporting and orchestration: Python service modules

## Architecture

- Streamlit captures image/audio demo input and runs the multimodal inference pipeline
- Python modules score face asymmetry, eye droop, voice rhythm, and slur proxies
- Express exposes API routes for health, hospital lookup, and screening persistence
- Railway Postgres stores screening sessions, alert outcomes, and report metadata
- The frontend can save completed screenings to the backend over HTTP

## Quick start

### 1. Python app

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
streamlit run app.py
```

### 2. Node backend

```bash
cd backend
npm install
npm run dev
```

## Environment

### Python

Set these if you want the Streamlit app to talk to the backend:

```bash
BACKEND_API_URL=http://localhost:8080
PERSIST_TO_BACKEND=true
```

### Node / Railway

Use Railway's provided Postgres connection string:

```bash
PORT=8080
DATABASE_URL=postgresql://...
ALERT_THRESHOLD=0.70
```

See [backend/.env.example](C:/Users/kesav/OneDrive/Desktop/internal_hackathon/backend/.env.example).

## Project structure

```text
app.py
requirements.txt
backend/
  package.json
  sql/
  src/
data/
src/stroke_detector/
  alerts/
  api/
  audio/
  fusion/
  pipelines/
  reports/
  services/
  utils/
  vision/
```

## Database tables

- `screenings`: patient/session level records and risk outcomes
- `alert_events`: alert routing decisions and hospital contact details

## Safety note

This is a screening/demo prototype, not a medical device or diagnostic tool.
