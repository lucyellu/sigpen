// Planetary K-index (1-minute estimated Kp). Geomagnetic activity index
// 0–9 derived from a global magnetometer network. SWPC's 1-min variant is
// an estimate published continuously; the 3-hour "official" Kp is the
// retrospective value.

const URL =
  "https://services.swpc.noaa.gov/json/planetary_k_index_1m.json";

// Field naming has drifted (kp_index, estimated_kp, Kp). Accept any.
type Row = {
  time_tag: string;
  kp_index?: number | string;
  estimated_kp?: number | string;
  Kp?: number | string;
};

export type KpSeries = {
  ts: string[];
  values: (number | null)[];
  latest: { value: number; ts: string } | null;
  fetchedAt: string;
  sourceUrl: string;
};

function normalizeTs(s: string): string {
  if (!s) return s;
  if (s.endsWith("Z") || s.includes("+")) return s;
  return s.includes("T") ? `${s}Z` : `${s.replace(" ", "T")}Z`;
}

export async function fetchKp(): Promise<KpSeries> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const rows = (await r.json()) as Row[];

  const ts: string[] = [];
  const values: (number | null)[] = [];
  let latest: { value: number; ts: string } | null = null;
  for (const row of rows) {
    if (!row.time_tag) continue;
    const raw = row.kp_index ?? row.estimated_kp ?? row.Kp;
    const n = raw == null ? null : Number(raw);
    const v = n != null && Number.isFinite(n) && n >= 0 ? n : null;
    const iso = normalizeTs(row.time_tag);
    ts.push(iso);
    values.push(v);
    if (v != null) latest = { value: v, ts: iso };
  }

  return {
    ts,
    values,
    latest,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
