// Direct browser fetch of NOAA SWPC's GOES primary X-rays.
//
// SWPC serves its public JSON endpoints with `Access-Control-Allow-Origin: *`,
// so the React app can hit them straight from the iPad without a backend.
// That keeps Netlify a pure static host — no Functions, no proxy.
//
// If SWPC ever drops the CORS header (it has been stable for years; their own
// dashboard at www.swpc.noaa.gov depends on it), the fix is a ~10-line
// Netlify Function that re-exposes the same JSON. The shape returned here is
// the same shape the dropped /api/grid endpoint produced, so a server-side
// proxy could swap in without touching the Console.
//
// Each row in the upstream payload covers one (timestamp, energy band):
//   { time_tag: "2026-05-13T01:42:00Z",
//     energy:   "0.05-0.4nm" | "0.1-0.8nm",
//     flux:     number | null,
//     electron_contaminaton?: boolean }   // sic — typo is upstream
//
// Two energy bands → two canonical channels:
//   xrs_a = 0.05–0.4 nm  (short band)
//   xrs_b = 0.1–0.8  nm  (long  band, flare-class)
// Both are W/m².

const SWPC_URL =
  "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json";

const ENERGY_TO_CHANNEL: Record<string, "xrs_a" | "xrs_b"> = {
  "0.05-0.4nm": "xrs_a",
  "0.1-0.8nm": "xrs_b",
};

type SwpcRow = {
  time_tag?: string;
  energy?: string;
  flux?: number | null;
  electron_contaminaton?: boolean;
};

export type GoesGrid = {
  ts: string[];
  channels: { xrs_a: (number | null)[]; xrs_b: (number | null)[] };
  units: { xrs_a: string; xrs_b: string };
  lastSampleTs: string | null;
  fetchedAt: string;
  sourceUrl: string;
};

export async function fetchGoesXrays(): Promise<GoesGrid> {
  const r = await fetch(SWPC_URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) {
    throw new Error(`SWPC ${r.status} ${r.statusText}`);
  }
  const rows = (await r.json()) as SwpcRow[];

  // Group by time_tag so each timestamp produces one (xrs_a, xrs_b) row.
  // SWPC interleaves the two bands; we don't assume any ordering.
  const byTs = new Map<
    string,
    { xrs_a: number | null; xrs_b: number | null }
  >();
  for (const row of rows) {
    const ts = row.time_tag;
    const channel = row.energy ? ENERGY_TO_CHANNEL[row.energy] : undefined;
    if (!ts || !channel) continue;
    const slot = byTs.get(ts) ?? { xrs_a: null, xrs_b: null };
    const v = row.flux;
    slot[channel] =
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    byTs.set(ts, slot);
  }

  const ts = [...byTs.keys()].sort();
  const xrs_a: (number | null)[] = [];
  const xrs_b: (number | null)[] = [];
  let lastSampleTs: string | null = null;
  for (const t of ts) {
    const slot = byTs.get(t)!;
    xrs_a.push(slot.xrs_a);
    xrs_b.push(slot.xrs_b);
    if (slot.xrs_a !== null || slot.xrs_b !== null) lastSampleTs = t;
  }

  return {
    ts,
    channels: { xrs_a, xrs_b },
    units: { xrs_a: "W/m^2", xrs_b: "W/m^2" },
    lastSampleTs,
    fetchedAt: new Date().toISOString(),
    sourceUrl: SWPC_URL,
  };
}
