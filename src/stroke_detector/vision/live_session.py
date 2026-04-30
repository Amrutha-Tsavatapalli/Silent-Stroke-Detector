from __future__ import annotations

from src.stroke_detector.models import FaceAnalysis
from src.stroke_detector.vision.asymmetry import FaceAsymmetryAnalyzer
from src.stroke_detector.vision.temporal import RollingAggregator


class LiveFaceSession:
    def __init__(
        self,
        analyzer: FaceAsymmetryAnalyzer | None = None,
        window_size: int = 120,
        min_samples: int = 30,
    ) -> None:
        self.analyzer = analyzer or FaceAsymmetryAnalyzer()
        self.window_size = window_size
        self.min_samples = min_samples
        self.aggregator = RollingAggregator(window_size=window_size, min_samples=min_samples)

    def start(self) -> None:
        self.aggregator = RollingAggregator(window_size=self.window_size, min_samples=self.min_samples)

    def process_frame(self, frame, timestamp_ms: int = 0) -> FaceAnalysis:
        result = self.analyzer.analyze(frame)
        self.aggregator.update(result)
        return result

    def finalize(self) -> FaceAnalysis:
        return self.aggregator.summarize()
