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

## Using it on an iPad

Two supported paths. **Cloudflare tunnel** is recommended — the iPad can be
on any network (not just your home Wi-Fi), no firewall opening, no IP to
look up. **LAN** is faster to spin up if your iPad and dev machine share
Wi-Fi anyway.

### Path A — Cloudflare quick tunnel (recommended)

A free temporary `https://*.trycloudflare.com` URL that proxies straight
to the Vite dev server on the dev machine. No Cloudflare account needed,
no DNS, no port forwarding. The URL rotates every time you start the
tunnel — paste the new one into Safari on the iPad.

**One-time:** install `cloudflared` on the dev machine.

| OS | Install |
| --- | --- |
| macOS | `brew install cloudflare/cloudflare/cloudflared` |
| Windows | Download `cloudflared-windows-amd64.exe` from <https://github.com/cloudflare/cloudflared/releases>, rename to `cloudflared.exe`, put it on `PATH`. |
| Linux (deb) | `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && sudo dpkg -i /tmp/cloudflared.deb` |

Verify with `cloudflared --version`.

**Each session:** three terminals on the dev machine.

```bash
# terminal 1 — backend
uv run uvicorn api.main:app --reload --port 8000

# terminal 2 — frontend
cd web && pnpm dev

# terminal 3 — public tunnel (start *after* Vite is up on :5173)
cd web && pnpm tunnel
```

`pnpm tunnel` is a wrapper for `cloudflared tunnel --url http://localhost:5173`.
After a few seconds it prints a line like:

```
2026-05-12T20:21:55Z INF +--------------------------------------------------------------------------------------------+
2026-05-12T20:21:55Z INF |  Your quick Tunnel has been created! Visit it at (it may take a few seconds):              |
2026-05-12T20:21:55Z INF |  https://example-words-here.trycloudflare.com                                              |
2026-05-12T20:21:55Z INF +--------------------------------------------------------------------------------------------+
```

Paste that URL into Safari on the iPad. Console loads, GOES X-rays
update every 60 s. Add-to-Home-Screen also works.

**Notes:**

- The Cloudflare edge terminates TLS; your local Vite server stays HTTP.
- Vite HMR over a tunneled origin sometimes fails to upgrade — if the
  page loads but doesn't auto-refresh on save, that's it; just hard-refresh
  the iPad tab. For a more robust static preview, run `pnpm build`,
  then `pnpm preview` (binds 4173), then `pnpm tunnel:preview`.
- The tunnel only exposes Vite on 5173. FastAPI on 8000 stays on loopback;
  the iPad never reaches it directly, only via Vite's `/api/*` proxy.
- Stop the tunnel with Ctrl-C. The URL dies with it.

### Path B — LAN (same Wi-Fi only)

1. Run both servers as in Path A (terminals 1 and 2 only — no tunnel).
2. Find the dev machine's LAN IP. macOS: `ipconfig getifaddr en0`.
   Windows: `ipconfig` (look for the IPv4 entry under your Wi-Fi adapter).
3. Put the iPad on the same Wi-Fi.
4. Safari → `http://192.168.x.x:5173/` (substitute your LAN IP).

**LAN troubleshooting:**

- *"Can't reach server":* your dev machine's firewall is blocking inbound
  5173. On macOS, allow `node` in System Settings → Network → Firewall.
  On Windows, the first time Vite binds the port you'll get a Windows
  Defender Firewall prompt — accept it for **Private networks**.
- *Captive / "guest" Wi-Fi* isolates clients; switch both devices to your
  main network or use Path A.
- *Vite printed two LAN IPs* (e.g. Wi-Fi + VPN tunnel): pick the Wi-Fi one.

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
