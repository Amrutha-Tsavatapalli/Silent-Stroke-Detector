from __future__ import annotations

import base64
import io
import logging
from dataclasses import asdict
from typing import Any

import cv2
import numpy as np
import soundfile as sf
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel, Field

from src.stroke_detector.api.backend_client import BackendApiClient
from src.stroke_detector.audio.slur_features import VoiceSlurAnalyzer
from src.stroke_detector.config import AppConfig
from src.stroke_detector.pipelines.runtime import StrokeDetectionRuntime
from src.stroke_detector.reports.generator import ReportGenerator
from src.stroke_detector.utils.demo_data import build_demo_audio, build_demo_image
from src.stroke_detector.vision.asymmetry import FaceAsymmetryAnalyzer

# Configure logging for deprecation warnings
logger = logging.getLogger(__name__)

app = FastAPI(title="Silent Stroke Detector API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DeprecationMiddleware(BaseHTTPMiddleware):
    """Middleware to add deprecation headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Add deprecation headers to all responses
        response.headers["Deprecation"] = "true"
        response.headers["Link"] = "</api/v1/migration>; rel=\"deprecation\""
        response.headers["Sunset"] = "Sat, 30 Oct 2026 00:00:00 GMT"

        # Log deprecation warning for API calls (excluding health and migration endpoints)
        if request.url.path not in ("/api/health", "/api/v1/migration", "/docs", "/openapi.json"):
            logger.warning(
                f"Deprecated API endpoint called: {request.url.path} "
                f"- This API will be sunset on 2026-10-30"
            )

        return response


app.add_middleware(DeprecationMiddleware)


class AnalyzeRequest(BaseModel):
    image_base64: str | None = Field(default=None, description="Base64 image or data URL")
    audio_base64: str | None = Field(default=None, description="Base64 audio or data URL")
    audio_waveform: list[float] | None = Field(default=None, description="PCM waveform array")
    sample_rate: int | None = Field(default=None, description="Sample rate for audio_waveform")
    scenario: str | None = Field(default=None, description="normal, borderline, or high_risk")
    patient_name: str = "Anonymous"
    location: str = "Unknown"
    persist_to_backend: bool | None = None
    backend_api_url: str | None = None


class FaceAnalyzeRequest(BaseModel):
    image_base64: str | None = Field(default=None, description="Base64 image or data URL")
    scenario: str | None = Field(default=None, description="normal, borderline, or high_risk")


class VoiceAnalyzeRequest(BaseModel):
    audio_base64: str | None = Field(default=None, description="Base64 audio or data URL")
    audio_waveform: list[float] | None = Field(default=None, description="PCM waveform array")
    sample_rate: int | None = Field(default=None, description="Sample rate for audio_waveform")
    scenario: str | None = Field(default=None, description="normal, borderline, or high_risk")


def _decode_base64_payload(payload: str) -> bytes:
    if "base64," in payload:
        payload = payload.split("base64,", 1)[1]
    try:
        return base64.b64decode(payload)
    except Exception as exc:  # pragma: no cover - defensive decode path
        raise HTTPException(status_code=400, detail=f"Invalid base64 payload: {exc}")


def _decode_image(image_base64: str) -> np.ndarray:
    raw = _decode_base64_payload(image_base64)
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Unable to decode image payload.")
    return image


def _decode_audio(audio_base64: str) -> tuple[np.ndarray, int]:
    raw = _decode_base64_payload(audio_base64)
    try:
        waveform, sample_rate = sf.read(io.BytesIO(raw), dtype="float32")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Unable to decode audio payload: {exc}")

    if waveform.ndim > 1:
        waveform = np.mean(waveform, axis=1)
    return waveform.astype(np.float32), int(sample_rate)


def _resolve_scenario(scenario: str | None) -> str | None:
    if scenario is None:
        return None
    scenario = scenario.strip().lower()
    if scenario not in {"normal", "borderline", "high_risk"}:
        raise HTTPException(status_code=400, detail="Scenario must be normal, borderline, or high_risk.")
    return scenario


def _build_config(request: AnalyzeRequest) -> AppConfig:
    config = AppConfig()
    if request.backend_api_url:
        config.backend_api_url = request.backend_api_url
    if request.persist_to_backend is not None:
        config.persist_to_backend = request.persist_to_backend
    return config


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "app": "Silent Stroke Detector",
        "version": "0.1.0",
    }


@app.get("/api/v1/migration")
def migration_guide() -> dict[str, Any]:
    """Migration guide endpoint for deprecated API users."""
    return {
        "message": "This API is deprecated",
        "sunset_date": "2026-10-30",
        "new_api": "http://localhost:3001/api",
        "migration_guide": "/docs/MIGRATION.md",
        "endpoints": {
            "/api/analyze": "Use POST /api/sessions and PWA face/speech screens",
            "/api/face/analyze": "Use PWA FaceScan screen",
            "/api/voice/analyze": "Use PWA SpeechCheck screen",
        },
    }


@app.post("/api/analyze")
def analyze(request: AnalyzeRequest) -> dict[str, Any]:
    config = _build_config(request)
    runtime = StrokeDetectionRuntime(config)
    report_generator = ReportGenerator()

    scenario = _resolve_scenario(request.scenario)

    if request.image_base64:
        frame = _decode_image(request.image_base64)
        scenario_label = scenario or "uploaded"
    elif scenario:
        frame = build_demo_image(scenario)
        scenario_label = scenario
    else:
        raise HTTPException(status_code=400, detail="Provide image_base64 or scenario.")

    if request.audio_waveform is not None:
        if not request.sample_rate:
            raise HTTPException(status_code=400, detail="sample_rate is required with audio_waveform.")
        audio_waveform = np.asarray(request.audio_waveform, dtype=np.float32)
        sample_rate = int(request.sample_rate)
    elif request.audio_base64:
        audio_waveform, sample_rate = _decode_audio(request.audio_base64)
    elif scenario:
        audio_waveform, sample_rate = build_demo_audio(scenario)
    else:
        audio_waveform = np.zeros(32000, dtype=np.float32)
        sample_rate = 16000

    result = runtime.run(
        frame=frame,
        audio_waveform=audio_waveform,
        sample_rate=sample_rate,
        patient_name=request.patient_name,
        location=request.location,
        scenario_label=scenario_label,
    )

    report_text = report_generator.generate_markdown(result)

    backend_save: dict[str, Any] | None = None
    if config.persist_to_backend:
        client = BackendApiClient(config)
        save_response = client.save_screening(result, report_excerpt=report_text[:1200])
        backend_save = {
            "ok": save_response.ok,
            "payload": save_response.payload,
            "error": save_response.error,
        }

    return {
        "ok": True,
        "result": result.to_dict(),
        "report_markdown": report_text,
        "backend_save": backend_save,
    }


@app.post("/api/face/analyze")
def analyze_face(request: FaceAnalyzeRequest) -> dict[str, Any]:
    scenario = _resolve_scenario(request.scenario)

    if request.image_base64:
        frame = _decode_image(request.image_base64)
        scenario_label = scenario or "uploaded"
    elif scenario:
        frame = build_demo_image(scenario)
        scenario_label = scenario
    else:
        raise HTTPException(status_code=400, detail="Provide image_base64 or scenario.")

    analyzer = FaceAsymmetryAnalyzer()
    face = analyzer.analyze(frame)

    return {
        "ok": True,
        "scenario": scenario_label,
        "face": asdict(face),
    }


@app.post("/api/voice/analyze")
def analyze_voice(request: VoiceAnalyzeRequest) -> dict[str, Any]:
    scenario = _resolve_scenario(request.scenario)

    if request.audio_waveform is not None:
        if not request.sample_rate:
            raise HTTPException(status_code=400, detail="sample_rate is required with audio_waveform.")
        audio_waveform = np.asarray(request.audio_waveform, dtype=np.float32)
        sample_rate = int(request.sample_rate)
        scenario_label = scenario or "uploaded"
    elif request.audio_base64:
        audio_waveform, sample_rate = _decode_audio(request.audio_base64)
        scenario_label = scenario or "uploaded"
    elif scenario:
        audio_waveform, sample_rate = build_demo_audio(scenario)
        scenario_label = scenario
    else:
        raise HTTPException(status_code=400, detail="Provide audio_base64, audio_waveform, or scenario.")

    analyzer = VoiceSlurAnalyzer()
    voice = analyzer.analyze(audio_waveform, sample_rate)

    return {
        "ok": True,
        "scenario": scenario_label,
        "voice": asdict(voice),
    }
