# Sun-Earth Translator

A console for listening to the conversation between the Sun and Earth.
The app pulls real-time space-weather feeds (GOES, SWPC, USGS, WDC
Kyoto), tokenizes solar and terrestrial signals into a small constructed
"language," and pairs sun → terra exchanges so they can be read like
call-and-response. The frontend is a Project Hail Mary-styled SPA.

See `BUILD.md` for the full design brief and build order.

## Status

**Steps 1–2 of 10 complete.** A Vite + React + Tailwind SPA with a
Console page that fetches NOAA SWPC's GOES primary X-rays directly
from the browser every 60 s. Responsive from 360 px up; deployed to
Netlify as a static bundle. No backend in production.

## Layout

```
/web         Vite + React + Tailwind SPA (Console page only for now)
/api         Legacy FastAPI scaffold — see "About the /api folder" below
netlify.toml Netlify build config
BUILD.md     full design brief
```

## Frontend setup (the whole app)

Requires Node 20+ and [pnpm](https://pnpm.io/).

```bash
cd web
pnpm install
pnpm dev
```

Vite serves on port 5173 and binds to all interfaces (`host: true`) so
the dev server is reachable on LAN and via tunnels.

Available scripts (run from `web/`):

| Script | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server with HMR on `0.0.0.0:5173`. |
| `pnpm build` | Type-check and produce a production bundle in `web/dist`. |
| `pnpm preview` | Serve the production bundle on `0.0.0.0:4173`. |
| `pnpm typecheck` | TypeScript only, no emit. |
| `pnpm tunnel` | `cloudflared tunnel --url http://localhost:5173` — see iPad section. |
| `pnpm tunnel:preview` | Same, against the preview server on 4173. |

### How data gets in

The Console queries
`https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json`
directly from the browser. SWPC serves that endpoint with
`Access-Control-Allow-Origin: *`, so no proxy is needed — the iPad,
LAN browsers, and the production Netlify build all hit NOAA the same
way. The fetch + normalization lives in `web/src/lib/swpc.ts`; React
Query handles the 60 s refetch cycle and dedup.

If SWPC ever drops the CORS header (years of stable history, but it's
their dashboard's dependency too, so unlikely), the fix is a ~10-line
Netlify Function that re-exposes the JSON.

## Deploying to Netlify

The repo is wired for **<https://sigpenapp.netlify.app/>**. `netlify.toml`
at the root sets:

```toml
[build]
base    = "web"
command = "pnpm install --frozen-lockfile && pnpm build"
publish = "dist"
```

Netlify auto-deploys on every push to the branch the site is linked to.
SPA routes fall through to `index.html` via the catch-all redirect in
`netlify.toml`, so future client-side routing works without further
config.

**No environment variables needed** — the SWPC URL is hard-coded and
public.

## Using it on an iPad

Three paths, in order of friction:

### Path A — the deployed Netlify URL

Open <https://sigpenapp.netlify.app/> in Safari on the iPad. That's it.
Add-to-Home-Screen gives it its own dark-themed app tile.

### Path B — Cloudflare quick tunnel (live dev preview on the iPad)

If you want to see uncommitted local changes on the iPad without
deploying, expose your Vite dev server via Cloudflare's free quick
tunnel.

**One-time install** of `cloudflared`:

| OS | Install |
| --- | --- |
| macOS | `brew install cloudflare/cloudflare/cloudflared` |
| Windows | Download `cloudflared-windows-amd64.exe` from <https://github.com/cloudflare/cloudflared/releases>, rename to `cloudflared.exe`, put it on `PATH`. |
| Linux (deb) | `curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && sudo dpkg -i /tmp/cloudflared.deb` |

**Each session,** two terminals:

```bash
cd web && pnpm dev      # terminal 1 — Vite on :5173
cd web && pnpm tunnel   # terminal 2 — public https URL
```

`pnpm tunnel` prints `https://<random>.trycloudflare.com` after a few
seconds. Paste into Safari on the iPad. Stop with Ctrl-C; the URL dies
with the tunnel.

HMR over a tunneled origin sometimes fails to upgrade — if a save
doesn't auto-refresh the iPad, hard-refresh manually or use
`pnpm build && pnpm preview && pnpm tunnel:preview` for a stable
static bundle.

### Path C — LAN (same Wi-Fi only)

1. `cd web && pnpm dev` on the dev machine.
2. Find the dev machine's LAN IP. macOS: `ipconfig getifaddr en0`.
   Windows: `ipconfig` (IPv4 under the Wi-Fi adapter).
3. iPad on the same Wi-Fi.
4. Safari → `http://192.168.x.x:5173/`.

If the iPad can't reach the dev machine: firewall blocking 5173
(macOS: allow `node` in System Settings → Network → Firewall; Windows:
accept the Defender prompt for Private networks), or captive/guest
Wi-Fi isolating clients (switch networks or use Path B).

## About the `/api` folder

The `/api` directory holds an earlier FastAPI scaffold (APScheduler
polling, Parquet/DuckDB storage, `/api/sources` + `/api/grid` +
`/api/health`). It's no longer wired into the frontend — the browser
fetches NOAA directly — and isn't deployed anywhere. It stays in the
tree as a reference implementation for sources that need server-side
caching, secrets, or non-CORS endpoints (USGS Boulder, WDC Kyoto Dst).
When the time comes, those sources will either move into Netlify
Functions or this scaffold gets resurrected on a small VM. Until then,
the SPA in `/web` is the whole app.

You don't need Python or `uv` to develop or deploy the live app.

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
