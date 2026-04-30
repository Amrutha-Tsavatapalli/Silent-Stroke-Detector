from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np


@dataclass
class FaceQuality:
    face_visible: bool
    blur_score: float
    lighting_score: float
    face_size_ratio: float
    yaw_score: float


class FaceQualityGate:
    def __init__(
        self,
        min_blur: float = 60.0,
        min_lighting: float = 0.20,
        min_face_ratio: float = 0.12,
        max_yaw: float = 0.28,
    ) -> None:
        self.min_blur = min_blur
        self.min_lighting = min_lighting
        self.min_face_ratio = min_face_ratio
        self.max_yaw = max_yaw

    def assess(self, frame: np.ndarray, landmarks: np.ndarray | None) -> FaceQuality:
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur_score = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        lighting_score = float(np.mean(gray) / 255.0)

        face_visible = landmarks is not None and len(landmarks) > 0
        face_size_ratio = 0.0
        yaw_score = 0.0

        if face_visible:
            xs = landmarks[:, 0]
            ys = landmarks[:, 1]
            min_x = float(np.min(xs))
            max_x = float(np.max(xs))
            min_y = float(np.min(ys))
            max_y = float(np.max(ys))

            face_area = max(max_x - min_x, 1.0) * max(max_y - min_y, 1.0)
            frame_area = max(frame.shape[0] * frame.shape[1], 1)
            face_size_ratio = float(face_area / frame_area)

            width = max(max_x - min_x, 1e-6)
            center_x = (max_x + min_x) / 2.0
            left_span = center_x - min_x
            right_span = max_x - center_x
            yaw_score = float(abs(left_span - right_span) / width)

        return FaceQuality(
            face_visible=face_visible,
            blur_score=blur_score,
            lighting_score=lighting_score,
            face_size_ratio=face_size_ratio,
            yaw_score=yaw_score,
        )

    def is_usable(self, quality: FaceQuality) -> bool:
        return (
            quality.face_visible
            and quality.blur_score >= self.min_blur
            and quality.lighting_score >= self.min_lighting
            and quality.face_size_ratio >= self.min_face_ratio
            and quality.yaw_score <= self.max_yaw
        )
