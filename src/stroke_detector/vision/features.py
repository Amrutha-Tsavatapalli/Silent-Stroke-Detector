from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class FaceFeatures:
    asymmetry_score: float
    eye_droop_score: float
    mouth_tilt_score: float
    confidence: float
    landmark_count: int


class FaceFeatureExtractor:
    def extract(self, landmarks: np.ndarray, confidence: float) -> FaceFeatures:
        if landmarks is None or len(landmarks) == 0:
            return FaceFeatures(
                asymmetry_score=0.5,
                eye_droop_score=0.5,
                mouth_tilt_score=0.5,
                confidence=float(confidence),
                landmark_count=0,
            )

        points = np.asarray(landmarks, dtype=np.float32)
        x_coords = points[:, 0]
        center_x = float(np.mean(x_coords))

        asymmetry_score = self._asymmetry_score(points, center_x)
        eye_droop_score = self._eye_droop_score(points, center_x)
        mouth_tilt_score = self._mouth_tilt_score(points)

        return FaceFeatures(
            asymmetry_score=float(asymmetry_score),
            eye_droop_score=float(eye_droop_score),
            mouth_tilt_score=float(mouth_tilt_score),
            confidence=float(confidence),
            landmark_count=int(len(points)),
        )

    def _asymmetry_score(self, points: np.ndarray, center_x: float) -> float:
        left = points[points[:, 0] < center_x]
        right = points[points[:, 0] >= center_x]
        if len(left) == 0 or len(right) == 0:
            return 0.5
        left_spread = np.std(left[:, 1]) + np.std(left[:, 0])
        right_spread = np.std(right[:, 1]) + np.std(right[:, 0])
        return float(min(abs(left_spread - right_spread) / max(left_spread, right_spread, 1e-6), 1.0))

    def _eye_droop_score(self, points: np.ndarray, center_x: float) -> float:
        left = points[points[:, 0] < center_x]
        right = points[points[:, 0] >= center_x]
        if len(left) == 0 or len(right) == 0:
            return 0.5
        left_eye_level = float(np.percentile(left[:, 1], 30))
        right_eye_level = float(np.percentile(right[:, 1], 30))
        eye_diff = abs(left_eye_level - right_eye_level)
        face_height = max(float(np.max(points[:, 1]) - np.min(points[:, 1])), 1.0)
        return float(np.clip(eye_diff / (face_height * 0.15), 0.0, 1.0))

    def _mouth_tilt_score(self, points: np.ndarray) -> float:
        if len(points) < 7:
            return 0.5
        mouth_left = points[-2]
        mouth_right = points[-1]
        tilt = abs(float(mouth_left[1] - mouth_right[1]))
        face_height = max(float(np.max(points[:, 1]) - np.min(points[:, 1])), 1.0)
        return float(np.clip(tilt / (face_height * 0.12), 0.0, 1.0))
