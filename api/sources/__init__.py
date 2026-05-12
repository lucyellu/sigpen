"""Source registry. Each fetcher subclasses Source and registers its channels."""
from __future__ import annotations

from .base import Source, SourceInfo, ChannelInfo
from .goes_xrays import GoesXrays

ALL_SOURCES: list[Source] = [
    GoesXrays(),
]


def by_name(name: str) -> Source | None:
    for s in ALL_SOURCES:
        if s.info.name == name:
            return s
    return None


def channel_to_source(channel: str) -> Source | None:
    for s in ALL_SOURCES:
        if any(c.name == channel for c in s.info.channels):
            return s
    return None


__all__ = [
    "ALL_SOURCES",
    "ChannelInfo",
    "GoesXrays",
    "Source",
    "SourceInfo",
    "by_name",
    "channel_to_source",
]
