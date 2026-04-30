from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np

try:
    import mediapipe as mp
except Exception:  # pragma: no cover - optional dependency fallback
    mp = None


@dataclass
class FaceLandmarkOutput:
    landmarks: np.ndarray
    confidence: float
    source: str


class FaceLandmarkExtractor:
    def __init__(self) -> None:
        self._mesh = None
        if mp is not None:
            self._mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=True,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
            )

    def extract(self, frame: np.ndarray) -> FaceLandmarkOutput:
        if self._mesh is not None:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            result = self._mesh.process(rgb)
            if result.multi_face_landmarks:
                face_landmarks = result.multi_face_landmarks[0]
                height, width = frame.shape[:2]
                points = np.array(
                    [
                        [landmark.x * width, landmark.y * height, landmark.z]
                        for landmark in face_landmarks.landmark
                    ],
                    dtype=np.float32,
                )
                return FaceLandmarkOutput(points, confidence=0.92, source="mediapipe")

        points = self._fallback_landmarks(frame)
        return FaceLandmarkOutput(points, confidence=0.45, source="fallback")

    def _fallback_landmarks(self, frame: np.ndarray) -> np.ndarray:
        height, width = frame.shape[:2]
        cx = width / 2.0
        cy = height / 2.0
        template = [
            (cx - width * 0.16, cy - height * 0.12),
            (cx + width * 0.16, cy - height * 0.12),
            (cx - width * 0.18, cy + height * 0.05),
            (cx + width * 0.18, cy + height * 0.05),
            (cx, cy + height * 0.12),
            (cx - width * 0.10, cy + height * 0.18),
            (cx + width * 0.10, cy + height * 0.19),
        ]
        return np.array([[x, y, 0.0] for x, y in template], dtype=np.float32)
