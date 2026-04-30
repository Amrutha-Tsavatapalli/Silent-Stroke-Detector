from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class VideoFrame:
    frame: np.ndarray
    source: str
    timestamp_ms: int


class CameraFeed:
    """Stub interface for future OpenCV/WebRTC camera streaming."""

    def wrap_frame(self, frame: np.ndarray, source: str = "upload", timestamp_ms: int = 0) -> VideoFrame:
        return VideoFrame(frame=frame, source=source, timestamp_ms=timestamp_ms)
