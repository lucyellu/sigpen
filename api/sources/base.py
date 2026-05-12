"""Fetcher contract. Each source declares its channels and a fetch() coroutine."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Sequence

from ..records import ScalarRecord


@dataclass(frozen=True, slots=True)
class ChannelInfo:
    name: str  # canonical short id used in API queries (e.g. "xrs_b")
    unit: str
    description: str
    kind: str = "scalar"  # "scalar" | "vector3" | "spectrum" | "grid"


@dataclass(frozen=True, slots=True)
class SourceInfo:
    name: str  # directory name under data/
    label: str  # human-facing
    url: str
    poll_seconds: int
    channels: Sequence[ChannelInfo] = field(default_factory=tuple)


class Source:
    """Base class. Subclasses set .info and implement async fetch()."""

    info: SourceInfo

    async def fetch(self) -> list[ScalarRecord]:  # pragma: no cover - abstract
        raise NotImplementedError
