# Build Prompt: Sun-Earth Translator (Project Hail Mary console)

## Goal

A web app that ingests real-time space-weather data from multiple sources,
normalizes it through a backend data manager, tokenizes solar and terrestrial
signals into a constructed "language," and surfaces sun-Earth exchanges
(call-and-response pairings) through a Hail Mary-styled console UI. Mobile
Safari + desktop Chrome both first-class.

## Stack

- **Backend:** Python 3.11+, FastAPI, APScheduler (in-process polling),
  DuckDB + Parquet on disk for time series, SQLite for user state (labels,
  dictionary edits). Use `httpx` for fetches, `pandas` or `polars` for
  resampling.
- **Frontend:** Vite + React + TypeScript. Tailwind for styling. Zustand for
  state. Recharts or uPlot for time series (uPlot if perf matters on mobile).
  No SSR, no Next — keep it a static SPA that talks to the API.
- **Dev environment:** Windows 11. Use `uv` for Python env management (fast,
  works great on Windows). Use `pnpm` for the frontend. Single repo, two
  folders: `/api` and `/web`.

## Data sources (v1)

Wire up these and only these first:

### Sun / interface

- GOES primary X-rays — `https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json` (and `-1-day`, `-3-day`)
- GOES primary integral protons — `https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json`
- Solar wind plasma — `https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json` (and `-1-day`, `-7-day`)
- Solar wind magnetometer — `https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json` (and `-1-day`, `-7-day`)
- Edited events — `https://services.swpc.noaa.gov/json/edited_events.json`

### Terra

- Planetary K-index — `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
- GOES magnetometer (GEO) — `https://services.swpc.noaa.gov/json/goes/primary/magnetometers-6-hour.json`
- OVATION aurora — `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`
- Kyoto Dst quicklook — fetch from WDC Kyoto (text format, parse it; this one
  is rough, handle gracefully if it fails)
- USGS magnetometer Boulder (BOU) — `https://geomag.usgs.gov/ws/data/?id=BOU&format=json&sampling_period=60` (IAGA-2002 JSON variant)

Skip Schumann, INTERMAGNET, SuperMAG for v1. Stub the fetcher interface so
they slot in later.

## Backend architecture

Record shapes (don't force everything into one shape):

- **Scalar:** `{source, channel, ts, value, unit, quality}`
- **Vector3:** same but `value: {x, y, z}` (for magnetometers)
- **Spectrum:** `value: {energies: [...], flux: [...]}` (for particle channels)
- **Grid:** `value: 2D array` (for OVATION)

Store each source as a Parquet file per day under
`data/{source}/{YYYY-MM-DD}.parquet`. Append-only. Use DuckDB to query across
files.

**Fetcher contract:** each source is a class with `fetch() -> list[Record]`
and a poll interval. Scheduler calls them, deduplicates by
`(source, channel, ts)`, writes to Parquet.

### API endpoints (all JSON)

- `GET /api/sources` — list of sources with last update + health
- `GET /api/grid?from=&to=&resolution=1min&channels=xrs_b,wind_speed,bz,kp`
  — multiple channels on a common time grid, gaps marked as null
- `GET /api/tokens?from=&to=&types=` — tokenized events
- `GET /api/exchanges?from=&to=&min_lag=0&max_lag=72h` — paired sun→terra
  exchanges with residual vs baseline
- `GET /api/replay/{date}` — sensible window around a date
- `POST /api/labels` — user annotations on tokens/exchanges
- `GET /api/dictionary` / `PUT /api/dictionary/{token_type}` — user-editable
  translations
- `GET /api/health` — for the GUI status bar

### Tokenizer (pure functions, easy to test)

Define 8–10 token types as a start: `QUIET`, `FLARE_C`, `FLARE_M`, `FLARE_X`,
`PROTON_EVENT`, `WIND_GUST`, `BZ_SOUTH`, `BZ_NORTH`, `KP_RISE`,
`AURORA_EXPANSION`, `UNKNOWN`. Each has a detection function over a time
window. Validate `FLARE_*` against `edited_events.json` and expose the
agreement rate at `/api/health`.

### Pairer + residual model

Simple v1: for each sun-token at time `t`, look in `[t+15min, t+72h]` for
terra-tokens. Baseline expectation table: e.g. M-flare → KP_RISE in ~30% of
cases at lag 24–48h. Compute residual as actual − expected. Return as
exchanges with a `surprise_score`. Keep it dumb and inspectable — the point
is for users to see the residuals, not for the model to be right.

**Run command:** `uv run uvicorn api.main:app --reload --port 8000`.

## Frontend architecture

### Routes / modes

- `/` — Console (Grace's ship vibe): live "now" readouts of XRS, wind speed,
  Bz, Kp, aurora extent. Sparklines under each. Status line at bottom
  narrating the last hour.
- `/translator` — Exchange view: two columns. Left = Sol stream (sun tokens,
  scrolling up). Right = Terra stream (Earth tokens, scrolling up). Tokens
  that pair across the columns are connected by a thin line; click a line to
  see the residual and label it.
- `/dictionary` — User-editable lookup table. Token → glyph → chord →
  English. Three translation layers: Literal / Plain English / Hail Mary
  mode.
- `/hunter` — Anomaly view. Lists exchanges sorted by surprise score. User
  can label UNKNOWN tokens and add them to the dictionary.
- `/replay/:date` — Same translator UI but historical.

### Design language

- Dark background (`#0a0d12`), warm amber (`#e8a23c`) for Sol, desaturated
  teal (`#5fb3a3`) for Terra
- Monospace for numbers (JetBrains Mono), humanist sans for prose
- Hand-designed SVG glyphs per token type (commit to ~10 small custom SVGs)
- Optional CRT scanline overlay, toggleable
- Mobile: stack the two translator columns vertically; pinch-zoom disabled
  on charts, swipe between modes

### Audio (Web Audio API)

Each token plays a 3-note chord on appearance. Quiet ambient drone tuned to
current solar wind speed. Muted by default. Mute toggle in header. Don't
auto-play.

### Data fetching

React Query with 60s polling for live views. Replay routes fetch once on
mount. All requests go to `/api/*` — never fetch NOAA directly from the
browser.

**Run command:** `pnpm dev` (Vite dev server on 5173, proxies `/api` to
localhost:8000).

## Mobile + desktop

- Responsive from 360px up
- Tested target: iOS Safari 16+, Chrome 120+ on Windows
- PWA manifest so it can be added to iOS home screen
- No localStorage for app data — use IndexedDB if anything client-side
  persists, but prefer round-tripping to the API
- Service worker for offline shell only, not data caching

## Repo layout

```
/sun-earth-translator
  /api
    main.py                  # FastAPI app
    sources/                 # one file per data source
    storage.py               # Parquet + DuckDB
    tokenizer.py             # pure functions
    pairer.py                # exchange detection + residuals
    scheduler.py             # APScheduler setup
    pyproject.toml
  /web
    src/
      pages/                 # Console, Translator, Dictionary, Hunter, Replay
      components/
      lib/api.ts             # typed API client
      lib/audio.ts           # Web Audio chord synth
      glyphs/                # SVG components
    package.json
    vite.config.ts
  /data                      # Parquet + SQLite, gitignored
  README.md
  .env.example
```

## Build order (incremental, each step runnable)

1. Scaffold `/api` with FastAPI, one fetcher (GOES X-rays), Parquet storage,
   `/api/sources` and `/api/grid` endpoints.
2. Scaffold `/web` with Vite + Tailwind, a minimal Console page reading from
   `/api/grid`.
3. Add remaining sun fetchers, then terra fetchers. Verify each in isolation.
4. Implement tokenizer + `/api/tokens`. Add Translator page rendering Sol
   column only.
5. Add Terra column to Translator. Implement pairer + `/api/exchanges`. Draw
   connecting lines.
6. Dictionary page + user labels (SQLite).
7. Hunter page (sorted by surprise score).
8. Audio layer, glyphs, CRT polish.
9. Replay route.
10. PWA manifest, mobile testing pass.

## Constraints + gotchas

- Poll intervals: 60s for fast channels (xrays, wind, mag), 5min for
  Kp/OVATION, 1h for Dst. Don't hammer SWPC.
- Handle the primary/secondary GOES switch gracefully — read
  `instrument-sources.json` if you need to know which satellite is live.
- Eclipse seasons (around equinoxes) knock out GOES briefly. Show gaps,
  don't interpolate across them.
- Kyoto Dst format is fixed-width text with day-of-year; isolate that
  parser, expect it to break occasionally, fail soft.
- CORS: backend fetches everything server-side, so the browser never touches
  NOAA. Don't get clever and add browser fetches "for speed."
- Windows path handling: use `pathlib.Path` everywhere, never string concat.
- Timezones: store UTC everywhere internally, render in user's local time
  only at the leaf component.

## Definition of done for v1

- `pnpm dev` and `uv run uvicorn ...` both run cleanly on Windows
- Console page shows live data updating every 60s
- Translator page renders at least 24h of paired exchanges
- Dictionary survives a restart
- App loads and is usable on iPhone Safari over LAN
- README has setup steps, source list with attribution, and a one-paragraph
  explanation of the conceit
