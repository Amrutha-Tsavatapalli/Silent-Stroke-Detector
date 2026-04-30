from __future__ import annotations

import cv2

from src.stroke_detector.vision.camera import VideoFrame
from src.stroke_detector.vision.frame_sources import FrameSource


class OpenCVCameraSource(FrameSource):
    def __init__(self, device_index: int = 0, fps: int = 15) -> None:
        self.device_index = device_index
        self.fps = fps
        self._cap: cv2.VideoCapture | None = None
        self._frame_index = 0

    def open(self) -> None:
        self._cap = cv2.VideoCapture(self.device_index)
        self._frame_index = 0

    def read(self) -> VideoFrame | None:
        if self._cap is None:
            return None
        ok, frame = self._cap.read()
        if not ok:
            return None

        timestamp_ms = int(self._cap.get(cv2.CAP_PROP_POS_MSEC))
        if timestamp_ms <= 0:
            timestamp_ms = int((self._frame_index / max(self.fps, 1)) * 1000)
        self._frame_index += 1

        return VideoFrame(frame=frame, source="camera", timestamp_ms=timestamp_ms)

    def close(self) -> None:
        if self._cap is not None:
            self._cap.release()
            self._cap = None
