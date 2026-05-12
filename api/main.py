"""FastAPI entry point.

Step 1 surfaces three routes:
    GET /api/health   — liveness + scheduler status
    GET /api/sources  — registered sources, last poll, row count, last ts
    GET /api/grid     — multi-channel time grid (gaps = null)

Run:
    uv run uvicorn api.main:app --reload --port 8000
"""
from __future__ import annotations

import logging
import math
import re
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import DISABLE_SCHEDULER
from .scheduler import LAST_POLL, build_scheduler
from .sources import ALL_SOURCES, channel_to_source
from .storage import ensure_data_dir, query_channel, source_last_ts, source_row_count

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_data_dir()
    scheduler = None
    if not DISABLE_SCHEDULER:
        scheduler = build_scheduler()
        scheduler.start()
        app.state.scheduler = scheduler
        logger.info("scheduler started with %d sources", len(ALL_SOURCES))
    else:
        app.state.scheduler = None
        logger.info("scheduler disabled via SIGPEN_DISABLE_SCHEDULER")
    try:
        yield
    finally:
        if scheduler is not None:
            scheduler.shutdown(wait=False)


app = FastAPI(title="Sun-Earth Translator API", version="0.1.0", lifespan=lifespan)

# The web SPA runs on Vite (5173) in dev and proxies /api/* — so in normal use
# the browser never makes a cross-origin call to FastAPI at all. We still
# allow localhost / loopback / private LAN origins as a safety net for
# direct-fetch tools (curl from another machine, occasional debugging) and
# to keep iPad-on-LAN setups from getting tripped up by a misconfigured proxy.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=(
        r"^https?://("
        r"localhost(:\d+)?|"
        r"127\.0\.0\.1(:\d+)?|"
        r"10(\.\d{1,3}){3}(:\d+)?|"
        r"192\.168(\.\d{1,3}){2}(:\d+)?|"
        r"172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2}(:\d+)?"
        r")$"
    ),
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "scheduler_enabled": not DISABLE_SCHEDULER,
        "now": datetime.now(timezone.utc).isoformat(),
        "sources": [s.info.name for s in ALL_SOURCES],
    }


@app.get("/api/sources")
def sources() -> dict[str, Any]:
    out = []
    for s in ALL_SOURCES:
        last_ts = source_last_ts(s.info.name)
        poll = LAST_POLL.get(s.info.name)
        out.append(
            {
                "name": s.info.name,
                "label": s.info.label,
                "url": s.info.url,
                "poll_seconds": s.info.poll_seconds,
                "channels": [
                    {"name": c.name, "unit": c.unit, "kind": c.kind, "description": c.description}
                    for c in s.info.channels
                ],
                "last_ts": last_ts.isoformat() if last_ts else None,
                "rows": source_row_count(s.info.name),
                "last_poll": _serialize_poll(poll),
            }
        )
    return {"sources": out}


def _serialize_poll(poll: dict | None) -> dict | None:
    if poll is None:
        return None
    return {
        "ok": poll["ok"],
        "ts": poll["ts"].isoformat() if poll.get("ts") else None,
        "fetched": poll.get("fetched", 0),
        "written": poll.get("written", 0),
        "error": poll.get("error"),
    }


_RESOLUTION_RE = re.compile(r"^\s*(\d+)\s*(s|sec|secs|m|min|mins|h|hr|hour|hours)\s*$", re.I)


def _parse_resolution(s: str) -> timedelta:
    m = _RESOLUTION_RE.match(s)
    if not m:
        raise HTTPException(400, f"invalid resolution: {s!r}")
    n = int(m.group(1))
    unit = m.group(2).lower()
    if unit.startswith("s"):
        return timedelta(seconds=n)
    if unit.startswith("m") and unit != "h":
        return timedelta(minutes=n)
    return timedelta(hours=n)


def _parse_time(s: str | None, default: datetime) -> datetime:
    if not s:
        return default
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError as e:
        raise HTTPException(400, f"invalid timestamp: {s!r}") from e
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


@app.get("/api/grid")
def grid(
    from_: str | None = Query(default=None, alias="from"),
    to: str | None = Query(default=None),
    resolution: str = Query(default="1min"),
    channels: str = Query(..., description="comma-separated channel ids"),
) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    end = _parse_time(to, now)
    start = _parse_time(from_, end - timedelta(hours=6))
    if end <= start:
        raise HTTPException(400, "`to` must be after `from`")

    step = _parse_resolution(resolution)
    if step.total_seconds() < 1:
        raise HTTPException(400, "resolution too fine")

    requested = [c.strip() for c in channels.split(",") if c.strip()]
    if not requested:
        raise HTTPException(400, "at least one channel required")

    # Common UTC time grid, inclusive of both endpoints.
    grid_index = pd.date_range(start=start, end=end, freq=step, tz="UTC")
    if len(grid_index) == 0:
        raise HTTPException(400, "empty grid for the requested window")

    series_out: dict[str, list[float | None]] = {}
    units_out: dict[str, str | None] = {}
    missing: list[str] = []

    for ch in requested:
        source = channel_to_source(ch)
        if source is None:
            missing.append(ch)
            series_out[ch] = [None] * len(grid_index)
            units_out[ch] = None
            continue

        df = query_channel(source.info.name, ch, start, end)
        unit = next(
            (c.unit for c in source.info.channels if c.name == ch), None
        )
        units_out[ch] = unit

        if df.empty:
            series_out[ch] = [None] * len(grid_index)
            continue

        s = df.set_index("ts")["value"].sort_index()
        # Resample by mean onto the common grid. Gaps remain NaN, not zero,
        # so eclipse outages and other data holes render as breaks not zeros.
        resampled = s.resample(step, origin=start).mean()
        resampled = resampled.reindex(grid_index)
        series_out[ch] = [_jsonable(v) for v in resampled.tolist()]

    return {
        "start": start.isoformat(),
        "end": end.isoformat(),
        "resolution": resolution,
        "step_seconds": int(step.total_seconds()),
        "ts": [t.isoformat() for t in grid_index.to_pydatetime()],
        "channels": series_out,
        "units": units_out,
        "missing": missing,
    }


def _jsonable(v: Any) -> float | None:
    if v is None:
        return None
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return None
    return float(v)
