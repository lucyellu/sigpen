// OVATION aurora — SWPC's 30-min forecast of auroral oval probability on a
// 1°×1° global grid. The Console shows a single derived scalar: the
// equatorward boundary of the Northern-Hemisphere oval, defined as the
// lowest latitude where any cell on that latitude line meets the threshold
// probability. Lower number ⇒ aurora visible further south ⇒ bigger storm.

const URL =
  "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json";

const PROB_THRESHOLD_PCT = 30;

type Payload = {
  "Observation Time"?: string;
  "Forecast Time"?: string;
  coordinates?: [number, number, number][]; // [lon, lat, prob_percent]
};

export type AuroraResult = {
  observationTs: string | null;
  forecastTs: string | null;
  extentDegN: number | null;
  maxProbN: number | null;
  fetchedAt: string;
  sourceUrl: string;
};

function normalizeTs(s: string | undefined): string | null {
  if (!s) return null;
  if (s.endsWith("Z") || s.includes("+")) return s;
  return s.includes("T") ? `${s}Z` : `${s.replace(" ", "T")}Z`;
}

export async function fetchAurora(): Promise<AuroraResult> {
  const r = await fetch(URL, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const data = (await r.json()) as Payload;

  let extentLat: number | null = null;
  let maxProb: number | null = null;
  for (const c of data.coordinates ?? []) {
    const lat = c[1];
    const prob = c[2];
    if (lat <= 0) continue; // Northern Hemisphere only
    if (maxProb == null || prob > maxProb) maxProb = prob;
    if (prob >= PROB_THRESHOLD_PCT) {
      if (extentLat == null || lat < extentLat) extentLat = lat;
    }
  }

  return {
    observationTs: normalizeTs(data["Observation Time"]),
    forecastTs: normalizeTs(data["Forecast Time"]),
    extentDegN: extentLat,
    maxProbN: maxProb,
    fetchedAt: new Date().toISOString(),
    sourceUrl: URL,
  };
}
