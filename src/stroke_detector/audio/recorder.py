"""Real-time audio recording for speech analysis."""
from __future__ import annotations

import numpy as np
import threading
import queue

try:
    import sounddevice as sd
except ImportError:
    sd = None


class AudioRecorder:
    """Records audio from microphone in real-time."""
    
    def __init__(self, sample_rate: int = 16000, channels: int = 1):
        self.sample_rate = sample_rate
        self.channels = channels
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.stream = None
        
    def _audio_callback(self, indata, frames, time_info, status):
        """Callback for audio stream."""
        if status:
            print(f"Audio status: {status}")
        self.audio_queue.put(indata.copy())
    
    def start_recording(self):
        """Start recording audio."""
        if sd is None:
            raise RuntimeError("sounddevice not installed. Install with: pip install sounddevice")
        
        self.is_recording = True
        self.stream = sd.InputStream(
            samplerate=self.sample_rate,
            channels=self.channels,
            callback=self._audio_callback,
            blocksize=1024,
        )
        self.stream.start()
    
    def stop_recording(self):
        """Stop recording audio."""
        self.is_recording = False
        if self.stream:
            self.stream.stop()
            self.stream.close()
    
    def get_audio_buffer(self, duration_seconds: float = 3.0) -> np.ndarray:
        """Get audio buffer of specified duration."""
        num_samples = int(self.sample_rate * duration_seconds)
        audio_data = []
        
        while not self.audio_queue.empty():
            audio_data.append(self.audio_queue.get())
        
        if not audio_data:
            # Return silence if no audio captured
            return np.zeros(num_samples, dtype=np.float32)
        
        audio = np.concatenate(audio_data, axis=0)
        
        # Trim or pad to desired length
        if len(audio) > num_samples:
            audio = audio[:num_samples]
        elif len(audio) < num_samples:
            audio = np.pad(audio, (0, num_samples - len(audio)))
        
        # Convert to mono if stereo
        if audio.ndim > 1:
            audio = np.mean(audio, axis=1)
        
        return audio.astype(np.float32)
    
    def clear_buffer(self):
        """Clear the audio queue."""
        while not self.audio_queue.empty():
            self.audio_queue.get()


def record_audio_sync(duration: float = 3.0, sample_rate: int = 16000) -> tuple[np.ndarray, int]:
    """
    Synchronously record audio for a specified duration.
    
    Args:
        duration: Recording duration in seconds
        sample_rate: Sample rate in Hz
        
    Returns:
        Tuple of (audio_waveform, sample_rate)
    """
    if sd is None:
        # Return simulated audio if sounddevice not available
        print("Warning: sounddevice not installed, returning simulated audio")
        return np.random.randn(int(sample_rate * duration)).astype(np.float32) * 0.1, sample_rate
    
    print(f"Recording for {duration} seconds...")
    audio = sd.rec(
        int(duration * sample_rate),
        samplerate=sample_rate,
        channels=1,
        dtype=np.float32,
    )
    sd.wait()
    print("Recording complete!")
    
    return audio.flatten(), sample_rate
