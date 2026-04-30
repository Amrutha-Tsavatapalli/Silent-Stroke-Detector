from __future__ import annotations

import json
from pathlib import Path


class HospitalLocatorService:
    """Placeholder for future geolocation or government hospital API lookup."""

    def __init__(self, data_path: Path) -> None:
        self.data_path = data_path

    def nearest(self, location_hint: str) -> dict:
        hospitals = self._load()
        if hospitals:
            return hospitals[0]
        return {
            "name": "Nearest Government Hospital",
            "city": location_hint,
            "phone": "108",
        }

    def _load(self) -> list[dict]:
        if not self.data_path.exists():
            return []
        with self.data_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
