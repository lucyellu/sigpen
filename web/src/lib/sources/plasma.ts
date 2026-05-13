// DSCOVR (L1) solar-wind plasma — speed (km/s), density (n/cc), temperature (K).
// We surface speed + density; temperature isn't used in the Console yet.
// 1-min cadence, 2h rolling window.

import { fetchSwpcTable, parseSwpcNumber, spaceTsToIso } from "./_table";

const URL =
  "https://services.swpc.noaa.gov/products/solar-wind/plasma-2-hour.json";

type Row = {
  time_tag: string;
  density: string;
  speed: string;
  temperature: string;
};

export type PlasmaSeries = {
  ts: string[];
  speed: (number | null)[];
  density: (number | null)[];
  latestSpeed: { value: number; ts: string } | null;
  latestDensity: { value: number; ts: string } | null;
  fetchedAt: string;
  sourceUrl: string;
};

export async function fetchPlasma(): Promise<PlasmaSeries> {
  const rows = await fetchSwpcTable<Row>(URL);
  const ts: string[] = [];
  const speed: (number | null)[] = [];
  const density: (number | null)[] = [];
  let latestSpeed: { value: number; ts: string } | null = null;
  let latestDensity: { value: number; ts: string } | null = null;
  for (const row of rows) {
    const iso = spaceTsToIso(row.time_tag);
    if (!iso) continue;
    const s = parseSwpcNumber(row.speed);
    const d = parseSwpcNumber(row.density);
    ts.push(iso);
    speed.push(s);
    density.push(d);
    if (s != null) latestSpeed = { value: s, ts: iso };
    if (d != null) latestDensity = { value: d, ts: iso };
  }
  return {
    ts,
    speed,
    density,
    latestSpeed,
    latestDensity,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
