// Typed client for /api/*. Everything runs through the Vite proxy in dev,
// so URLs stay relative and CORS never enters the picture.

export type SourcePoll = {
  ok: boolean;
  ts: string | null;
  fetched: number;
  written: number;
  error: string | null;
};

export type SourceChannel = {
  name: string;
  unit: string;
  kind: string;
  description: string;
};

export type Source = {
  name: string;
  label: string;
  url: string;
  poll_seconds: number;
  channels: SourceChannel[];
  last_ts: string | null;
  rows: number;
  last_poll: SourcePoll | null;
};

export type SourcesResponse = { sources: Source[] };

export type GridResponse = {
  start: string;
  end: string;
  resolution: string;
  step_seconds: number;
  ts: string[];
  channels: Record<string, (number | null)[]>;
  units: Record<string, string | null>;
  missing: string[];
};

export type HealthResponse = {
  ok: boolean;
  scheduler_enabled: boolean;
  now: string;
  sources: string[];
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`${path} → ${r.status} ${r.statusText}`);
  return r.json() as Promise<T>;
}

export const api = {
  health: () => get<HealthResponse>("/api/health"),
  sources: () => get<SourcesResponse>("/api/sources"),
  grid: (params: {
    from?: string;
    to?: string;
    resolution?: string;
    channels: string[];
  }) => {
    const q = new URLSearchParams();
    q.set("channels", params.channels.join(","));
    if (params.resolution) q.set("resolution", params.resolution);
    if (params.from) q.set("from", params.from);
    if (params.to) q.set("to", params.to);
    return get<GridResponse>(`/api/grid?${q.toString()}`);
  },
};
