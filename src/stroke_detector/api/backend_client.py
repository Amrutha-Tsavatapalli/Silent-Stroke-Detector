from __future__ import annotations

from dataclasses import dataclass

import requests

from src.stroke_detector.config import AppConfig
from src.stroke_detector.models import StrokeScreeningResult


@dataclass
class BackendSaveResponse:
    ok: bool
    payload: dict
    error: str | None = None


class BackendApiClient:
    def __init__(self, config: AppConfig) -> None:
        self.config = config

    def save_screening(self, result: StrokeScreeningResult, report_excerpt: str | None = None) -> BackendSaveResponse:
        try:
            payload = result.to_dict()
            payload["report_excerpt"] = report_excerpt
            response = requests.post(
                f"{self.config.backend_api_url.rstrip('/')}/api/screenings",
                json=payload,
                timeout=8,
            )
            response.raise_for_status()
            return BackendSaveResponse(ok=True, payload=response.json())
        except requests.RequestException as exc:
            return BackendSaveResponse(ok=False, payload={}, error=str(exc))
