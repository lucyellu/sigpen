// SWPC edited solar events — flares, radio bursts, particle events. Each
// entry is a discrete event, not a time-series sample. The Console surfaces
// the most recent XRA (X-ray event) with its flare class.
//
// Field naming in this endpoint is the least stable of the SWPC family;
// be defensive about case + key variants.

const URL = "https://services.swpc.noaa.gov/json/edited_events.json";

type RawEvent = Record<string, unknown>;

export type LatestFlare = {
  beginTs: string | null;
  maxTs: string | null;
  endTs: string | null;
  flareClass: string | null;
  region: string | null;
  fetchedAt: string;
  sourceUrl: string;
};

function pick(e: RawEvent, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = e[k];
    if (v != null && v !== "") return String(v);
  }
  return null;
}

function normalizeTs(s: string | null): string | null {
  if (!s) return null;
  if (s.endsWith("Z") || s.includes("+")) return s;
  return s.includes("T") ? `${s}Z` : `${s.replace(" ", "T")}Z`;
}

export async function fetchLatestFlare(): Promise<LatestFlare> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const events = (await r.json()) as RawEvent[];

  const xras = events
    .filter((e) => {
      const t = pick(e, "type", "Type", "event_type");
      return t?.toUpperCase() === "XRA";
    })
    .map((e) => ({
      beginTs: normalizeTs(
        pick(e, "begin_datetime", "BeginDateTime", "begin_time", "BeginTime"),
      ),
      maxTs: normalizeTs(
        pick(e, "max_datetime", "MaxDateTime", "max_time", "MaxTime"),
      ),
      endTs: normalizeTs(
        pick(e, "end_datetime", "EndDateTime", "end_time", "EndTime"),
      ),
      flareClass: pick(
        e,
        "particulars1",
        "Particulars1",
        "particulars",
        "particular_1",
      ),
      region: pick(e, "region", "Region", "registered_no", "RegisteredNo"),
    }))
    .filter((e) => e.beginTs);

  xras.sort((a, b) => (a.beginTs! < b.beginTs! ? 1 : -1));
  const latest = xras[0];

  return {
    beginTs: latest?.beginTs ?? null,
    maxTs: latest?.maxTs ?? null,
    endTs: latest?.endTs ?? null,
    flareClass: latest?.flareClass ?? null,
    region: latest?.region ?? null,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
