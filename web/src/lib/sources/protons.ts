// GOES primary integral protons. Multiple energy bands are reported on
// each timestamp (≥1, ≥5, ≥10, ≥30, ≥50, ≥100, ≥500 MeV). We surface the
// ≥10 MeV channel because that's the threshold for NOAA's S-scale solar
// radiation storm rating (S1 starts at 10 pfu).

const URL =
  "https://services.swpc.noaa.gov/json/goes/primary/integral-protons-6-hour.json";

type Row = {
  time_tag?: string;
  energy?: string;
  flux?: number | null;
  satellite?: number;
};

export type ProtonsSeries = {
  ts: string[];
  values: (number | null)[];
  unit: "pfu";
  energyBand: string;
  latestValue: number | null;
  latestTs: string | null;
  fetchedAt: string;
  sourceUrl: string;
};

const TARGET_MEV = 10;

function isTargetBand(energy: string | undefined): boolean {
  if (!energy) return false;
  // SWPC has rendered the band as ">=10 MeV", ">= 10 MeV", "10 MeV", and
  // occasionally "P >10 MeV". Pull the number and compare.
  const m = energy.match(/(\d+(?:\.\d+)?)\s*MeV/i);
  if (!m) return false;
  return Math.abs(parseFloat(m[1]) - TARGET_MEV) < 0.01;
}

export async function fetchProtons10MeV(): Promise<ProtonsSeries> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const rows = (await r.json()) as Row[];

  const points: { ts: string; value: number | null }[] = [];
  for (const row of rows) {
    if (!row.time_tag || !isTargetBand(row.energy)) continue;
    const v = row.flux;
    const value =
      typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
    points.push({ ts: row.time_tag, value });
  }
  points.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  const seen = new Set<string>();
  const ts: string[] = [];
  const values: (number | null)[] = [];
  for (const p of points) {
    if (seen.has(p.ts)) continue;
    seen.add(p.ts);
    ts.push(p.ts);
    values.push(p.value);
  }

  let latestValue: number | null = null;
  let latestTs: string | null = null;
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) {
      latestValue = values[i];
      latestTs = ts[i];
      break;
    }
  }

  return {
    ts,
    values,
    unit: "pfu",
    energyBand: "≥10 MeV",
    latestValue,
    latestTs,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
