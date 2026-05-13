// DSCOVR (L1) interplanetary magnetic field. We surface the GSM Bz component
// (north-south, the one that matters for reconnection at the dayside) and
// the total field magnitude Bt. 1-min cadence, 2h rolling window. Units: nT.

import { fetchSwpcTable, parseSwpcNumber, spaceTsToIso } from "./_table";

const URL =
  "https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json";

// Upstream columns vary slightly with format revisions — be lenient about
// names. The bare minimum we care about is bz_gsm and bt.
type Row = {
  time_tag: string;
  bx_gsm?: string;
  by_gsm?: string;
  bz_gsm?: string;
  bt?: string;
};

export type MagSeries = {
  ts: string[];
  bz: (number | null)[];
  bt: (number | null)[];
  latestBz: { value: number; ts: string } | null;
  latestBt: { value: number; ts: string } | null;
  fetchedAt: string;
  sourceUrl: string;
};

export async function fetchMag(): Promise<MagSeries> {
  const rows = await fetchSwpcTable<Row>(URL);
  const ts: string[] = [];
  const bz: (number | null)[] = [];
  const bt: (number | null)[] = [];
  let latestBz: { value: number; ts: string } | null = null;
  let latestBt: { value: number; ts: string } | null = null;
  for (const row of rows) {
    const iso = spaceTsToIso(row.time_tag);
    if (!iso) continue;
    const z = parseSwpcNumber(row.bz_gsm);
    const t = parseSwpcNumber(row.bt);
    ts.push(iso);
    bz.push(z);
    bt.push(t);
    if (z != null) latestBz = { value: z, ts: iso };
    if (t != null) latestBt = { value: t, ts: iso };
  }
  return {
    ts,
    bz,
    bt,
    latestBz,
    latestBt,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
