from __future__ import annotations

import numpy as np

from src.stroke_detector.models import VoiceAnalysis

try:
    import librosa
except Exception:  # pragma: no cover - optional dependency fallback
    librosa = None


class VoiceSlurAnalyzer:
    def analyze(self, waveform: np.ndarray, sample_rate: int) -> VoiceAnalysis:
        waveform = np.asarray(waveform, dtype=np.float32)
        if waveform.ndim > 1:
            waveform = np.mean(waveform, axis=1)
        waveform = waveform / max(np.max(np.abs(waveform)), 1e-6)

        speech_energy = float(np.mean(np.abs(waveform)))
        zero_crossings = float(np.mean(np.abs(np.diff(np.signbit(waveform).astype(np.float32)))))
        pitch_variance = self._pitch_variance(waveform, sample_rate)
        rhythm_instability = float(np.clip(abs(zero_crossings - 0.15) / 0.35, 0.0, 1.0))
        slur_proxy_score = float(np.clip((1.0 - min(pitch_variance / 1200.0, 1.0)) * 0.55 + rhythm_instability * 0.45, 0.0, 1.0))
        risk = float(np.clip(slur_proxy_score * 0.7 + max(0.0, 0.35 - speech_energy), 0.0, 1.0))

        return VoiceAnalysis(
            pitch_variance=pitch_variance,
            speech_energy=speech_energy,
            rhythm_instability=rhythm_instability,
            slur_proxy_score=slur_proxy_score,
            confidence=0.72 if librosa is not None else 0.50,
            risk_score=risk,
        )

    def _pitch_variance(self, waveform: np.ndarray, sample_rate: int) -> float:
        if librosa is not None:
            pitches, magnitudes = librosa.piptrack(y=waveform, sr=sample_rate)
            mask = magnitudes > np.median(magnitudes)
            valid_pitches = pitches[mask]
            if valid_pitches.size > 0:
                return float(np.var(valid_pitches))

        spectrum = np.fft.rfft(waveform)
        magnitude = np.abs(spectrum)
        if magnitude.size < 3:
            return 0.0
        normalized = magnitude / max(np.max(magnitude), 1e-6)
        return float(np.var(normalized) * 1000.0)
