"""Shared record types for fetcher output.

The doc defines four record shapes (Scalar, Vector3, Spectrum, Grid). Step 1
only needs Scalar — GOES X-rays gives one flux value per channel per minute —
but the type hierarchy lives here so subsequent fetchers (magnetometers,
particle spectra, OVATION) can slot in without reshaping anything.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any


@dataclass(frozen=True, slots=True)
class ScalarRecord:
    source: str
    channel: str
    ts: datetime  # UTC
    value: float | None
    unit: str
    quality: str = "ok"  # "ok" | "estimated" | "bad" | "missing"

    def to_row(self) -> dict[str, Any]:
        return {
            "source": self.source,
            "channel": self.channel,
            "ts": self.ts,
            "value": self.value,
            "unit": self.unit,
            "quality": self.quality,
        }
