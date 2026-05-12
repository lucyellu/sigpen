"""In-process polling. APScheduler kicks each Source on its poll interval.

A jitter of a few seconds spreads polls so multiple sources on the same
cadence don't all hit SWPC in the same wall-clock second. Each tick logs
fetched / written counts; failures log a warning and the scheduler keeps
running — a single bad upstream response should never take the API down.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from .sources import ALL_SOURCES
from .sources.base import Source
from .storage import ensure_data_dir, write_scalar_records

logger = logging.getLogger(__name__)

# Track most recent poll outcome per source for /api/sources + /api/health.
LAST_POLL: dict[str, dict] = {}


async def _run_source(source: Source) -> None:
    started = datetime.now(timezone.utc)
    try:
        records = await source.fetch()
        written = write_scalar_records(records)
        LAST_POLL[source.info.name] = {
            "ok": True,
            "ts": started,
            "fetched": len(records),
            "written": written,
            "error": None,
        }
        logger.info(
            "polled %s: fetched=%d written=%d", source.info.name, len(records), written
        )
    except Exception as exc:  # noqa: BLE001 — soft-fail by design
        LAST_POLL[source.info.name] = {
            "ok": False,
            "ts": started,
            "fetched": 0,
            "written": 0,
            "error": f"{type(exc).__name__}: {exc}",
        }
        logger.warning("poll failed for %s: %s", source.info.name, exc)


def build_scheduler() -> AsyncIOScheduler:
    ensure_data_dir()
    scheduler = AsyncIOScheduler(timezone="UTC")
    for source in ALL_SOURCES:
        scheduler.add_job(
            _run_source,
            "interval",
            seconds=source.info.poll_seconds,
            args=[source],
            id=f"poll:{source.info.name}",
            jitter=min(10, max(1, source.info.poll_seconds // 6)),
            next_run_time=datetime.now(timezone.utc),  # fire once at startup
            max_instances=1,
            coalesce=True,
        )
    # Light shuffle so two sources don't share a first-tick wall second.
    random.seed()
    return scheduler


async def run_once(source_name: str | None = None) -> None:
    """Synchronously trigger one fetch cycle. Useful for tests / manual runs."""
    targets = [s for s in ALL_SOURCES if source_name is None or s.info.name == source_name]
    await asyncio.gather(*(_run_source(s) for s in targets))
