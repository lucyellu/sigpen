"""Parquet-on-disk storage with DuckDB query layer.

Layout:
    data/{source}/{YYYY-MM-DD}.parquet

Each Parquet file is append-only for its UTC day. Writes deduplicate on
(channel, ts) so re-polling overlapping windows is safe. Reads go through
DuckDB so the API can glob across days and channels in one query.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Iterable

import duckdb
import pandas as pd

from .config import DATA_DIR
from .records import ScalarRecord

# DuckDB connections aren't thread-safe for concurrent writes, and the
# scheduler may race with API reads. One coarse lock is fine at v1 volumes
# (a few thousand rows per source per day).
_write_lock = Lock()


def _day_path(source: str, day: datetime) -> Path:
    return DATA_DIR / source / f"{day.strftime('%Y-%m-%d')}.parquet"


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def write_scalar_records(records: Iterable[ScalarRecord]) -> int:
    """Append records, dedup on (channel, ts). Returns rows newly written."""
    rows = [r.to_row() for r in records]
    if not rows:
        return 0

    df = pd.DataFrame(rows)
    df["ts"] = pd.to_datetime(df["ts"], utc=True)

    # Group by source + UTC date so one batch can span days.
    df["_day"] = df["ts"].dt.tz_convert("UTC").dt.floor("D")
    written = 0
    with _write_lock:
        for (source, day), chunk in df.groupby(["source", "_day"]):
            chunk = chunk.drop(columns=["_day"])
            day_dt = day.to_pydatetime().replace(tzinfo=timezone.utc)
            path = _day_path(source, day_dt)
            path.parent.mkdir(parents=True, exist_ok=True)

            if path.exists():
                existing = pd.read_parquet(path)
                existing["ts"] = pd.to_datetime(existing["ts"], utc=True)
                combined = pd.concat([existing, chunk], ignore_index=True)
            else:
                combined = chunk

            before = len(combined)
            combined = combined.drop_duplicates(subset=["channel", "ts"], keep="last")
            combined = combined.sort_values("ts").reset_index(drop=True)
            new_rows = len(combined) - (before - len(chunk))
            combined.to_parquet(path, index=False)
            written += max(new_rows, 0)
    return written


def list_source_files(source: str) -> list[Path]:
    root = DATA_DIR / source
    if not root.exists():
        return []
    return sorted(root.glob("*.parquet"))


def source_last_ts(source: str) -> datetime | None:
    files = list_source_files(source)
    if not files:
        return None
    # Newest file by name (YYYY-MM-DD sorts lexicographically).
    latest = files[-1]
    df = pd.read_parquet(latest, columns=["ts"])
    if df.empty:
        return None
    ts = pd.to_datetime(df["ts"], utc=True).max()
    return ts.to_pydatetime()


def source_row_count(source: str) -> int:
    files = list_source_files(source)
    if not files:
        return 0
    con = duckdb.connect()
    try:
        pattern = str(DATA_DIR / source / "*.parquet")
        row = con.execute(
            "select count(*) from read_parquet(?)", [pattern]
        ).fetchone()
        return int(row[0]) if row else 0
    finally:
        con.close()


def query_channel(
    source: str,
    channel: str,
    start: datetime,
    end: datetime,
) -> pd.DataFrame:
    """Return rows for one channel in [start, end]. Empty if no files."""
    files = list_source_files(source)
    if not files:
        return pd.DataFrame(columns=["ts", "value", "unit", "quality"])

    pattern = str(DATA_DIR / source / "*.parquet")
    con = duckdb.connect()
    try:
        df = con.execute(
            """
            select ts, value, unit, quality
            from read_parquet(?)
            where channel = ?
              and ts >= ?
              and ts <= ?
            order by ts
            """,
            [pattern, channel, start, end],
        ).df()
    finally:
        con.close()
    if not df.empty:
        df["ts"] = pd.to_datetime(df["ts"], utc=True)
    return df
