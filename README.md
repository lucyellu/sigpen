# Sun-Earth Translator

A console for listening to the conversation between the Sun and Earth.
The backend ingests real-time space-weather feeds (GOES, SWPC, USGS,
WDC Kyoto), normalizes them into a common time-series store, tokenizes
solar and terrestrial signals into a small constructed "language," and
pairs sun → terra exchanges so they can be read like call-and-response.
The frontend is a Project Hail Mary-styled SPA on top of that data.

See `BUILD.md` for the full design brief and build order.

## Status

**Steps 1–2 of 10 complete.** Backend scaffold (GOES primary X-rays
fetcher, Parquet/DuckDB storage, `/api/sources` + `/api/grid` + `/api/health`),
plus a Vite + React + Tailwind SPA with a Console page that polls
`/api/grid` every 60 s. The web app is responsive from 360 px up and
configured to be reached from an iPad over LAN.

## Layout

```
/api    FastAPI app, fetchers, storage, scheduler
/web    Vite + React + Tailwind SPA (Console page only for now)
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

## Frontend setup

Requires Node 20+ and [pnpm](https://pnpm.io/).

```bash
cd web
pnpm install
pnpm dev
```

Vite serves on port 5173, binds to all interfaces (`host: true`), and
proxies `/api/*` to `http://127.0.0.1:8000`, so the browser only ever
talks to the Vite host — no CORS, no exposing NOAA to clients.

Available scripts (run from `web/`):

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with HMR on `0.0.0.0:5173`. |
| `pnpm build` | Type-check and produce a production bundle in `web/dist`. |
| `pnpm preview` | Serve the production bundle on `0.0.0.0:4173`. |
| `pnpm typecheck` | TypeScript only, no emit. |

## Using it on an iPad (over LAN)

1. On the dev machine, run **both** servers in two terminals:
   ```bash
   uv run uvicorn api.main:app --reload --port 8000     # terminal 1
   cd web && pnpm dev                                   # terminal 2
   ```
2. Find the dev machine's LAN IP (e.g. `192.168.1.42`). On macOS:
   `ipconfig getifaddr en0`. On Windows: `ipconfig`.
3. Put the iPad on the same Wi-Fi network.
4. In Safari on the iPad, visit `http://192.168.1.42:5173/` (substitute
   your LAN IP). The Console page will load with live GOES X-rays.
5. Optional: tap the share icon → **Add to Home Screen**. The PWA
   manifest + Apple touch icon give it its own dark-themed app tile.

### LAN troubleshooting

- **Browser shows "can't reach server":** your dev machine's firewall
  is probably blocking inbound 5173. On macOS, allow `node` in System
  Settings → Network → Firewall. On Windows, the first time Vite binds
  the port you'll get a Windows Defender Firewall prompt — accept it
  for **Private networks**.
- **You're on a captive / "guest" Wi-Fi:** many of those isolate
  clients from each other; switch both devices to your main network.
- **Vite's IP autodetect printed two addresses** (e.g. one for Wi-Fi
  and one for a VPN tunnel): pick the Wi-Fi one.
- The FastAPI server itself only binds loopback (`127.0.0.1`) — the
  iPad never speaks to it directly, only through Vite. Don't expose
  port 8000 to the LAN unless you actually need to.

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
