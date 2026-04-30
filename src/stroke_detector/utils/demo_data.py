from __future__ import annotations

import math

import cv2
import numpy as np


def build_demo_image(scenario: str) -> np.ndarray:
    canvas = np.full((480, 480, 3), 245, dtype=np.uint8)
    center = (240, 240)
    cv2.circle(canvas, center, 140, (225, 210, 190), thickness=-1)
    cv2.circle(canvas, (185, 205), 14, (40, 40, 40), thickness=-1)
    cv2.circle(canvas, (295, 205 if scenario == "normal" else 216), 14, (40, 40, 40), thickness=-1)
    cv2.ellipse(canvas, (240, 290), (70, 28), 0, 15 if scenario == "high_risk" else 0, 180, (70, 70, 120), 4)
    cv2.line(canvas, (170, 330), (310, 330 if scenario == "normal" else 350), (60, 60, 60), 6)
    cv2.rectangle(canvas, (120, 100), (360, 390), (110, 110, 110), 3)
    return canvas


def build_demo_audio(scenario: str, sample_rate: int = 16000) -> tuple[np.ndarray, int]:
    duration = 2.5
    t = np.linspace(0, duration, int(sample_rate * duration), endpoint=False)
    if scenario == "normal":
        waveform = 0.45 * np.sin(2 * math.pi * 220 * t) + 0.15 * np.sin(2 * math.pi * 440 * t)
    elif scenario == "borderline":
        waveform = 0.35 * np.sin(2 * math.pi * 180 * t) + 0.10 * np.sin(2 * math.pi * 220 * t)
        waveform *= np.linspace(1.0, 0.7, waveform.size)
    else:
        waveform = 0.18 * np.sin(2 * math.pi * 140 * t)
        waveform += 0.04 * np.random.default_rng(8).normal(size=t.shape)
        waveform *= np.where((np.arange(t.size) // 1600) % 2 == 0, 1.0, 0.45)
    return waveform.astype(np.float32), sample_rate
