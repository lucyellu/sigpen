"""Shared httpx client factory.

SWPC and several other public data providers reject requests with the
default `python-httpx/x.y` user agent. They are also volunteer-run, so it's
polite to identify ourselves with a contact-ish UA. Every fetcher should
pull its client from here so the UA stays consistent.
"""
from __future__ import annotations

import httpx

USER_AGENT = (
    "SunEarthTranslator/0.1 (+https://github.com/lucyellu/sigpen) httpx"
)


def http_client(timeout: float = 20.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=timeout,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json,text/plain;q=0.9"},
        follow_redirects=True,
    )
