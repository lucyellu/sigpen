# Sun-Earth Translator

A console for listening to the conversation between the Sun and Earth.
The backend ingests real-time space-weather feeds (GOES, SWPC, USGS,
WDC Kyoto), normalizes them into a common time-series store, tokenizes
solar and terrestrial signals into a small constructed "language," and
pairs sun → terra exchanges so they can be read like call-and-response.
The frontend is a Project Hail Mary-styled SPA on top of that data.

See `BUILD.md` for the full design brief and build order.

## Status

**Step 1 of 10 complete.** Backend scaffold with one fetcher
(GOES primary X-rays), Parquet/DuckDB storage, and the `/api/sources`
+ `/api/grid` endpoints. No frontend yet.

## Layout

```
/api    FastAPI app, fetchers, storage, scheduler
/web    Vite + React SPA (not scaffolded yet — step 2)
/data   Parquet + SQLite, gitignored
BUILD.md   full design brief
```

## Backend setup

Requires Python 3.11+ and [uv](https://docs.astral.sh/uv/). Run from the
repo root — `api/` is a Python package, and `pyproject.toml` lives at the
top level so `api.main:app` resolves.

```bash
uv sync
uv run uvicorn api.main:app --reload --port 8000
```

The scheduler starts on app boot, polls GOES X-rays every 60 s, and
writes one Parquet file per UTC day under `data/goes_xrays/`. Set
`SIGPEN_DISABLE_SCHEDULER=1` to skip polling (useful for tests).

### Endpoints

- `GET /api/health` — liveness + scheduler status
- `GET /api/sources` — registered sources with last-update timestamps
- `GET /api/grid?from=&to=&resolution=1min&channels=xrs_a,xrs_b` —
  multi-channel time grid; gaps come back as `null`

Examples:

```bash
curl 'http://localhost:8000/api/sources'
curl 'http://localhost:8000/api/grid?channels=xrs_b&resolution=1min'
```

## Data sources (attribution)

v1 will wire up the following. Only GOES X-rays is live right now.

- **NOAA SWPC** — GOES X-rays / protons / magnetometer, solar wind
  plasma + mag, planetary K-index, OVATION aurora, edited events.
  Public domain. <https://www.swpc.noaa.gov/>
- **USGS Geomagnetism Program** — Boulder (BOU) magnetometer.
  Public domain. <https://geomag.usgs.gov/>
- **WDC for Geomagnetism, Kyoto** — Dst quicklook. Used with
  attribution per WDC Kyoto policy. <https://wdc.kugi.kyoto-u.ac.jp/>

## The conceit

Space weather is usually shown as charts. This treats it as dialogue:
the Sun emits something (a flare, a wind gust, a Bz flip), Earth's
magnetosphere and upper atmosphere answer some hours later (a Kp rise,
an auroral expansion, a Dst dip). The "translator" pairs those events,
the "dictionary" lets you assign your own glyphs and English glosses,
and the "hunter" surfaces the exchanges whose answers were unexpected
given the call.
