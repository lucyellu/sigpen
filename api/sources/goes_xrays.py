"""GOES primary X-rays — soft X-ray flux in two bands.

SWPC publishes 1-minute averages on rolling 6h / 1d / 3d JSON files. We poll
the 6h file every 60s; the storage layer dedupes on (channel, ts), so the
overlap is free and a single missed poll never leaves a hole.

Each row in the upstream payload covers one (timestamp, energy band). We
project them onto two canonical channels:
    xrs_a  →  0.05–0.4 nm  ("short")
    xrs_b  →  0.1–0.8 nm   ("long" — flare classification band)

Both are W/m^2.
"""
from __future__ import annotations

from datetime import datetime, timezone

from ..config import goes_xrays_poll_seconds
from ..http import http_client
from ..records import ScalarRecord
from .base import ChannelInfo, Source, SourceInfo

URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json"

ENERGY_TO_CHANNEL = {
    "0.05-0.4nm": "xrs_a",
    "0.1-0.8nm": "xrs_b",
}


class GoesXrays(Source):
    info = SourceInfo(
        name="goes_xrays",
        label="GOES primary X-rays",
        url=URL,
        poll_seconds=goes_xrays_poll_seconds(),
        channels=(
            ChannelInfo("xrs_a", "W/m^2", "GOES XRS-A, 0.05–0.4 nm (short)"),
            ChannelInfo("xrs_b", "W/m^2", "GOES XRS-B, 0.1–0.8 nm (long, flare class)"),
        ),
    )

    async def fetch(self) -> list[ScalarRecord]:
        async with http_client() as client:
            resp = await client.get(URL)
            resp.raise_for_status()
            payload = resp.json()

        out: list[ScalarRecord] = []
        for row in payload:
            energy = row.get("energy")
            channel = ENERGY_TO_CHANNEL.get(energy)
            if not channel:
                continue
            ts_raw = row.get("time_tag")
            if not ts_raw:
                continue
            try:
                ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
            except ValueError:
                continue
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)
            else:
                ts = ts.astimezone(timezone.utc)

            flux = row.get("flux")
            value = float(flux) if flux is not None else None
            quality = "estimated" if row.get("electron_contaminaton") else "ok"
            if value is None:
                quality = "missing"

            out.append(
                ScalarRecord(
                    source=self.info.name,
                    channel=channel,
                    ts=ts,
                    value=value,
                    unit="W/m^2",
                    quality=quality,
                )
            )
        return out
