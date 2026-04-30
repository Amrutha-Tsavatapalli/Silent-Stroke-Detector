from __future__ import annotations

from collections import deque

import numpy as np

from src.stroke_detector.models import FaceAnalysis


class RollingAggregator:
    def __init__(self, window_size: int = 120, min_samples: int = 30) -> None:
        self.window_size = window_size
        self.min_samples = min_samples
        self._buffer: deque[FaceAnalysis] = deque(maxlen=window_size)

    def update(self, result: FaceAnalysis) -> None:
        self._buffer.append(result)

    @property
    def sample_count(self) -> int:
        return len(self._buffer)

    def summarize(self) -> FaceAnalysis:
        if not self._buffer:
            return FaceAnalysis(
                asymmetry_score=0.5,
                eye_droop_score=0.5,
                mouth_tilt_score=0.5,
                confidence=0.0,
                risk_score=0.0,
                landmark_count=0,
                quality={},
            )

        def median(values: list[float]) -> float:
            return float(np.median(values)) if values else 0.0

        asymmetry = median([result.asymmetry_score for result in self._buffer])
        eye_droop = median([result.eye_droop_score for result in self._buffer])
        mouth_tilt = median([result.mouth_tilt_score for result in self._buffer])
        confidence = median([result.confidence for result in self._buffer])
        risk = median([result.risk_score for result in self._buffer])
        landmark_count = int(np.median([result.landmark_count for result in self._buffer]))
        quality = self._aggregate_quality()

        return FaceAnalysis(
            asymmetry_score=asymmetry,
            eye_droop_score=eye_droop,
            mouth_tilt_score=mouth_tilt,
            confidence=confidence,
            risk_score=risk,
            landmark_count=landmark_count,
            quality=quality,
        )

    def _aggregate_quality(self) -> dict[str, float]:
        quality_entries = [result.quality for result in self._buffer if result.quality]
        if not quality_entries:
            return {}

        keys = set(quality_entries[0].keys())
        for entry in quality_entries[1:]:
            keys &= set(entry.keys())

        aggregated: dict[str, float] = {}
        for key in keys:
            values = [entry[key] for entry in quality_entries if key in entry]
            aggregated[key] = float(np.median(values)) if values else 0.0
        return aggregated
