// Helpers shared by the SWPC "products" endpoints (solar-wind/plasma,
// solar-wind/mag, …). Those endpoints return an array of arrays with the
// first row as column names, and numeric values come back as strings.

export async function fetchSwpcTable<T extends Record<string, string>>(
  url: string,
): Promise<T[]> {
  const r = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!r.ok) throw new Error(`SWPC ${r.status} ${r.statusText}`);
  const raw = (await r.json()) as unknown;
  if (!Array.isArray(raw) || raw.length < 2) return [];
  const header = raw[0] as string[];
  return (raw.slice(1) as unknown[][]).map((row) => {
    const obj: Record<string, string> = {};
    header.forEach((h, i) => {
      const v = row[i];
      obj[h] = v == null ? "" : String(v);
    });
    return obj as T;
  });
}

// "2026-05-13 12:34:56.000" → "2026-05-13T12:34:56.000Z". Pass-through if
// already ISO-with-T. Always returns UTC (SWPC publishes everything in UTC).
export function spaceTsToIso(ts: string): string | null {
  if (!ts) return null;
  if (ts.includes("T")) {
    return ts.endsWith("Z") || ts.includes("+") ? ts : `${ts}Z`;
  }
  const iso = ts.replace(" ", "T");
  return iso.endsWith("Z") || iso.includes("+") ? iso : `${iso}Z`;
}

// SWPC sometimes emits "-1.00e+05" / "-100000" as a fill value when the
// instrument is offline. Treat those (and empty / NaN) as null so the
// Sparkline draws a gap, not a spike to the floor.
export function parseSwpcNumber(s: string | undefined): number | null {
  if (s == null || s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n <= -1e5) return null;
  return n;
}
