// GOES geosynchronous magnetometer. At GEO (≈6.6 Re), the field is roughly
// the dipole component along the satellite spin axis. Hp (parallel-to-spin)
// compresses when the dayside magnetopause moves inward (sudden commencement,
// solar-wind ram-pressure spikes) and stretches during substorm growth phase.

const URL =
  "https://services.swpc.noaa.gov/json/goes/primary/magnetometers-6-hour.json";

// Field names have varied across instrument generations. Hp is the canonical
// label for the perpendicular-to-orbital-plane component on GOES-16+.
type Row = {
  time_tag?: string;
  satellite?: number;
  Hp?: number | null;
  hp?: number | null;
  H?: number | null;
};

export type GoesMagSeries = {
  ts: string[];
  hp: (number | null)[];
  latestHp: { value: number; ts: string } | null;
  fetchedAt: string;
  sourceUrl: string;
};

export async function fetchGoesMag(): Promise<GoesMagSeries> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const rows = (await r.json()) as Row[];

  const ts: string[] = [];
  const hp: (number | null)[] = [];
  let latestHp: { value: number; ts: string } | null = null;
  for (const row of rows) {
    if (!row.time_tag) continue;
    const raw = row.Hp ?? row.hp ?? row.H ?? null;
    const v = typeof raw === "number" && Number.isFinite(raw) ? raw : null;
    ts.push(row.time_tag);
    hp.push(v);
    if (v != null) latestHp = { value: v, ts: row.time_tag };
  }
  return {
    ts,
    hp,
    latestHp,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
