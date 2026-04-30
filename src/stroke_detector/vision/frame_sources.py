from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np

from src.stroke_detector.vision.camera import VideoFrame


class FrameSource(ABC):
    @abstractmethod
    def open(self) -> None:
        raise NotImplementedError

    @abstractmethod
    def read(self) -> VideoFrame | None:
        raise NotImplementedError

    @abstractmethod
    def close(self) -> None:
        raise NotImplementedError


class StaticFrameSource(FrameSource):
    def __init__(self, frame: np.ndarray, source: str = "static") -> None:
        self.frame = frame
        self.source = source
        self._used = False

    def open(self) -> None:
        self._used = False

    def read(self) -> VideoFrame | None:
        if self._used:
            return None
        self._used = True
        return VideoFrame(frame=self.frame, source=self.source, timestamp_ms=0)

    def close(self) -> None:
        self._used = True
