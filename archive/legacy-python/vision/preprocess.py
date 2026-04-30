from __future__ import annotations

import cv2
import numpy as np


class FramePreprocessor:
    def __init__(self, max_size: int = 640) -> None:
        self.max_size = max_size

    def prepare(self, frame: np.ndarray) -> np.ndarray:
        if frame is None:
            raise ValueError("Frame is required for preprocessing.")

        frame = np.asarray(frame)
        if frame.dtype != np.uint8:
            frame = np.clip(frame, 0, 255).astype(np.uint8)

        if frame.ndim == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2BGR)
        elif frame.ndim == 3 and frame.shape[2] == 4:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)

        height, width = frame.shape[:2]
        max_dim = max(height, width)
        if self.max_size and max_dim > self.max_size:
            scale = self.max_size / float(max_dim)
            new_size = (int(width * scale), int(height * scale))
            frame = cv2.resize(frame, new_size, interpolation=cv2.INTER_AREA)

        return frame
