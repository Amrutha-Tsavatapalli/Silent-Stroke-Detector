# Face Detection And Live ML Pipeline Design

## 1. Scope And Goals

This document proposes a clean, modular design for the face detection pipeline, including live video wrappers and ML integration points. It is aligned with the current Python runtime style and keeps rule-based fallbacks for demo reliability.

Goals:
- Provide a single face pipeline that works for single frames and live streams.
- Separate capture, quality gating, landmark extraction, feature extraction, and risk scoring.
- Make it easy to swap rule-based scoring with a trained model.
- Support deterministic results for demos and offline use.

Non-goals:
- Building a production-grade model training pipeline in this repo.
- Adding UI changes or new frontend flows.

## 2. Current Baseline (Summary)

- Face analysis uses a landmark extractor with MediaPipe when available and a simple fallback.
- The face risk is derived from asymmetry, eye droop, and mouth tilt.
- The runtime runs analysis on a single image at a time.

## 3. Proposed Architecture

```
FrameSource  ->  FramePreprocess  ->  FaceQualityGate  ->  LandmarkExtractor
                (resize, color)       (face visible?)    (MediaPipe or fallback)
                                  ->  FaceFeatureExtractor
                                  ->  FaceRiskModel
                                  ->  TemporalAggregator (live only)
                                  ->  FaceResult
```

Two execution modes:
- Single frame mode: direct pass through pipeline, return one FaceResult.
- Live mode: pipeline runs on each frame, results are aggregated over a window for stability.

## 4. Module Layout (Proposed)

```
src/stroke_detector/vision/
  camera_stream.py        # OpenCV based capture wrapper
  frame_sources.py        # FrameSource interface + upload/static sources
  preprocess.py           # resize/color/normalize
  quality_gate.py         # checks for face size, blur, yaw, lighting
  facial_landmarks.py     # existing extractor; keep here
  features.py             # asymmetry, eye droop, mouth tilt
  face_risk.py            # rule-based + model-backed risk scoring
  temporal.py             # rolling median/percentile aggregator
  live_session.py         # session orchestrator for live scan
```

## 5. Data Structures And Interfaces

### 5.1 Frame Contracts

```python
from dataclasses import dataclass
import numpy as np

@dataclass
class VideoFrame:
    frame: np.ndarray
    source: str
    timestamp_ms: int
```

### 5.2 Pipeline Outputs

```python
from dataclasses import dataclass

@dataclass
class FaceQuality:
    face_visible: bool
    blur_score: float
    lighting_score: float
    face_size_ratio: float
    yaw_score: float

@dataclass
class FaceFeatures:
    asymmetry_score: float
    eye_droop_score: float
    mouth_tilt_score: float
    confidence: float
    landmark_count: int

@dataclass
class FaceResult:
    features: FaceFeatures
    risk_score: float
    model_type: str
    decision: str
```

### 5.3 Pipeline Interface

```python
class FacePipeline:
    def analyze_frame(self, frame: np.ndarray) -> FaceResult:
        ...

class LiveFaceSession:
    def start(self) -> None:
        ...

    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> FaceResult:
        ...

    def finalize(self) -> FaceResult:
        ...
```

## 6. Live Capture Wrappers

### 6.1 FrameSource Interface

```python
class FrameSource:
    def open(self) -> None:
        ...

    def read(self) -> VideoFrame | None:
        ...

    def close(self) -> None:
        ...
```

### 6.2 OpenCV Camera Wrapper

```python
import cv2

class OpenCVCameraSource(FrameSource):
    def __init__(self, device_index: int = 0, fps: int = 15) -> None:
        self.device_index = device_index
        self.fps = fps
        self._cap = None

    def open(self) -> None:
        self._cap = cv2.VideoCapture(self.device_index)

    def read(self) -> VideoFrame | None:
        if self._cap is None:
            return None
        ok, frame = self._cap.read()
        if not ok:
            return None
        return VideoFrame(frame=frame, source="camera", timestamp_ms=int(self._cap.get(cv2.CAP_PROP_POS_MSEC)))

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
```

## 7. Face Quality Gate

Before computing features, check if the frame is usable:
- Face presence and minimum face size ratio.
- Blur score (variance of Laplacian).
- Lighting score (mean intensity).
- Yaw score (left-right landmark balance).

Frames that fail the gate are excluded from aggregation, but the live session should still return a low-confidence result so the UI can prompt the user to adjust.

## 8. Feature Extraction

Use the existing asymmetry logic, but move the geometry features into a dedicated module to avoid mixing with risk scoring:

```python
class FaceFeatureExtractor:
    def extract(self, landmarks: np.ndarray, confidence: float) -> FaceFeatures:
        ...
```

## 9. Risk Scoring And ML Integration

### 9.1 Rule-Based Risk (Default)

The current weighted score stays as the fallback. It is stable for demos and runs without model files.

### 9.2 Trained Model Path

Provide a model adapter with a strict input schema:

```python
class FaceRiskModel:
    def predict(self, features: FaceFeatures) -> tuple[float, str]:
        ...
```

- `predict` returns `(risk_score, model_type)`.
- The model path is configured via app config.
- If the model fails to load, fallback to the rule-based method.

### 9.3 Calibration Hook

Provide an optional calibration layer:

```python
class RiskCalibrator:
    def apply(self, risk: float) -> float:
        ...
```

This allows logistic calibration or quantile mapping later without changing the pipeline.

## 10. Temporal Aggregation For Live Runs

Use a rolling window to stabilize live scores:
- Window length: 8 to 15 seconds.
- Use median for feature scores, and a weighted average for final risk.
- Require a minimum count of valid frames before finalizing.

```python
class RollingAggregator:
    def update(self, result: FaceResult) -> None:
        ...

    def summarize(self) -> FaceResult:
        ...
```

## 11. Error Handling And Fallbacks

- If landmarks are missing, return a low-confidence result with decision "insufficient_data".
- If frame quality is poor, include a quality note for UI hints.
- Always return a result so the rest of the pipeline can proceed.

## 12. Telemetry (Optional)

Log per-frame info for debugging:
- frame timestamp
- quality flags
- landmark count
- feature values
- risk score

Keep it in memory for demos; optionally persist in a file or database.

## 13. Testing Plan

Unit tests:
- Quality gate scores on synthetic frames.
- Feature extraction stability with mirrored landmarks.
- Risk scoring with fixed inputs.

Integration tests:
- Live session with a short prerecorded video.
- Fallback to rule-based scoring when model file is missing.

## 14. Implementation Notes

- Keep MediaPipe optional to avoid hard dependency issues.
- Keep data classes in `models.py` if shared across pipeline layers.
- The pipeline should run without network access and without model files.

## 15. Suggested Next Steps

1. Add the new modules and stubs.
2. Refactor current face analysis logic into `features.py` and `face_risk.py`.
3. Add a simple `LiveFaceSession` that processes frames and aggregates results.
4. Wire the live session to Streamlit when a camera mode is enabled.
