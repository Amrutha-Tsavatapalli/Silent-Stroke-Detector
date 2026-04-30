from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class AudioChunk:
    waveform: np.ndarray
    sample_rate: int
    duration_seconds: float


class MicrophoneCapture:
    """Stub interface for future real-time microphone integration."""

    def get_placeholder_chunk(self, sample_rate: int = 16000, duration_seconds: float = 2.0) -> AudioChunk:
        total_samples = int(sample_rate * duration_seconds)
        waveform = np.zeros(total_samples, dtype=np.float32)
        return AudioChunk(
            waveform=waveform,
            sample_rate=sample_rate,
            duration_seconds=duration_seconds,
        )
