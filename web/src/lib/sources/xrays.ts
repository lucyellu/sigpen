// GOES primary X-rays — soft X-ray flux in two bands.
//   xrs_a = 0.05–0.4 nm  (short band)
//   xrs_b = 0.1–0.8  nm  (long band, flare-classification band)
// 1-minute cadence, 6-hour rolling window. Both bands are W/m².

const URL =
  "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json";

const ENERGY_TO_CHANNEL: Record<string, "xrs_a" | "xrs_b"> = {
  "0.05-0.4nm": "xrs_a",
  "0.1-0.8nm": "xrs_b",
};

type Row = {
  time_tag?: string;
  energy?: string;
  flux?: number | null;
  electron_contaminaton?: boolean;
};

export type XraysGrid = {
  ts: string[];
  channels: { xrs_a: (number | null)[]; xrs_b: (number | null)[] };
  latest: {
    xrs_a: { value: number; ts: string } | null;
    xrs_b: { value: number; ts: string } | null;
  };
  fetchedAt: string;
  sourceUrl: string;
};

export async function fetchXrays(): Promise<XraysGrid> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const rows = (await r.json()) as Row[];

  const byTs = new Map<
    string,
    { xrs_a: number | null; xrs_b: number | null }
  >();
  for (const row of rows) {
    const ts = row.time_tag;
    const ch = row.energy ? ENERGY_TO_CHANNEL[row.energy] : undefined;
    if (!ts || !ch) continue;
    const slot = byTs.get(ts) ?? { xrs_a: null, xrs_b: null };
    const v = row.flux;
    slot[ch] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    byTs.set(ts, slot);
  }

  const ts = [...byTs.keys()].sort();
  const xrs_a: (number | null)[] = [];
  const xrs_b: (number | null)[] = [];
  let latestA: { value: number; ts: string } | null = null;
  let latestB: { value: number; ts: string } | null = null;
  for (const t of ts) {
    const slot = byTs.get(t)!;
    xrs_a.push(slot.xrs_a);
    xrs_b.push(slot.xrs_b);
    if (slot.xrs_a != null) latestA = { value: slot.xrs_a, ts: t };
    if (slot.xrs_b != null) latestB = { value: slot.xrs_b, ts: t };
  }

  return {
    ts,
    channels: { xrs_a, xrs_b },
    latest: { xrs_a: latestA, xrs_b: latestB },
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
