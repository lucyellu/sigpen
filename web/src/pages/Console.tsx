import { useQuery } from "@tanstack/react-query";
import { api, GridResponse, HealthResponse, SourcesResponse } from "../lib/api";
import { Readout } from "../components/Readout";
import { Sparkline } from "../components/Sparkline";
import { flareClass, fluxFormat, lastNonNull } from "../lib/flares";
import { localClock, relTime } from "../lib/time";

const REFRESH_MS = 60_000;
const STALE_MINUTES = 10;

// Channels the Console wants to show. Anything that's not yet wired into the
// backend shows up as a placeholder card — keeps the layout honest about the
// build state instead of hiding the missing tiles.
const SOL_PENDING = [
  { key: "wind_speed", label: "Solar wind", unit: "km/s" },
  { key: "bz", label: "IMF Bz", unit: "nT" },
];
const TERRA_PENDING = [
  { key: "kp", label: "Planetary K", unit: "" },
  { key: "aurora_extent", label: "Aurora extent", unit: "°" },
];

type CardState = "live" | "stale" | "empty";

function cardState(
  hasSample: boolean,
  sampleTs: string | null,
  isError: boolean,
  isLoading: boolean,
): CardState {
  if (isError) return "empty";
  if (!hasSample) return isLoading ? "empty" : "empty";
  if (!sampleTs) return "empty";
  const ageMin = (Date.now() - new Date(sampleTs).getTime()) / 60_000;
  return ageMin > STALE_MINUTES ? "stale" : "live";
}

export function Console() {
  const grid = useQuery<GridResponse>({
    queryKey: ["grid", "xrs"],
    queryFn: () => api.grid({ channels: ["xrs_a", "xrs_b"], resolution: "1min" }),
    refetchInterval: REFRESH_MS,
  });

  const sources = useQuery<SourcesResponse>({
    queryKey: ["sources"],
    queryFn: api.sources,
    refetchInterval: REFRESH_MS,
  });

  const health = useQuery<HealthResponse>({
    queryKey: ["health"],
    queryFn: api.health,
    refetchInterval: REFRESH_MS,
  });

  const xrsB = grid.data?.channels.xrs_b ?? [];
  const xrsA = grid.data?.channels.xrs_a ?? [];
  const ts = grid.data?.ts ?? [];

  const lastB = lastNonNull(xrsB);
  const lastA = lastNonNull(xrsA);
  const lastBTs = lastB ? ts[lastB.index] : null;
  const lastATs = lastA ? ts[lastA.index] : null;

  const stateB = cardState(lastB != null, lastBTs, grid.isError, grid.isLoading);
  const stateA = cardState(lastA != null, lastATs, grid.isError, grid.isLoading);

  const goes = sources.data?.sources.find((s) => s.name === "goes_xrays");

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-baseline justify-between border-b border-console-line pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-console-dim">
            Sun-Earth Translator
          </div>
          <h1 className="font-sans text-xl">Console</h1>
        </div>
        <div className="text-right font-mono text-xs text-console-dim tnum">
          <div>{localClock(new Date().toISOString())}</div>
          <div>UTC offset {-new Date().getTimezoneOffset() / 60}h</div>
        </div>
      </header>

      <div>
        <h2 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-sol">Sol</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Readout
            label="GOES XRS-B · flare class"
            accent="sol"
            state={stateB}
            value={lastB ? flareClass(lastB.value) : "—"}
            caption={
              lastB
                ? `${fluxFormat(lastB.value)} W/m² · ${relTime(lastBTs)}`
                : grid.isLoading
                  ? "listening for first sample…"
                  : "no samples yet"
            }
          >
            <Sparkline
              values={xrsB}
              logScale
              yMin={1e-9}
              yMax={1e-4}
              color="#e8a23c"
              height={56}
            />
          </Readout>

          <Readout
            label="GOES XRS-A · short band"
            accent="sol"
            state={stateA}
            value={lastA ? fluxFormat(lastA.value) : "—"}
            unit={lastA ? "W/m²" : undefined}
            caption={
              lastA
                ? `0.05–0.4 nm · ${relTime(lastATs)}`
                : "0.05–0.4 nm · waiting"
            }
          >
            <Sparkline
              values={xrsA}
              logScale
              yMin={1e-10}
              yMax={1e-5}
              color="#e8a23c"
              height={56}
            />
          </Readout>

          {SOL_PENDING.map((p) => (
            <Readout
              key={p.key}
              label={p.label}
              accent="sol"
              state="empty"
              value="—"
              unit={p.unit}
              caption="fetcher not wired yet"
            />
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-terra">Terra</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {TERRA_PENDING.map((p) => (
            <Readout
              key={p.key}
              label={p.label}
              accent="terra"
              state="empty"
              value="—"
              unit={p.unit}
              caption="fetcher not wired yet"
            />
          ))}
        </div>
      </div>

      <StatusLine
        goesLastTs={goes?.last_ts ?? null}
        pollOk={goes?.last_poll?.ok ?? null}
        pollError={goes?.last_poll?.error ?? null}
        schedulerEnabled={health.data?.scheduler_enabled ?? null}
        loading={grid.isLoading || sources.isLoading || health.isLoading}
        fetchError={
          grid.error?.message ?? sources.error?.message ?? health.error?.message ?? null
        }
      />
    </div>
  );
}

function StatusLine(props: {
  goesLastTs: string | null;
  pollOk: boolean | null;
  pollError: string | null;
  schedulerEnabled: boolean | null;
  loading: boolean;
  fetchError: string | null;
}) {
  let msg: string;
  if (props.fetchError) {
    msg = `Backend unreachable — ${props.fetchError}`;
  } else if (props.loading) {
    msg = "Listening…";
  } else if (props.schedulerEnabled === false) {
    msg = "Scheduler is disabled (SIGPEN_DISABLE_SCHEDULER=1). No new polls.";
  } else if (props.pollOk === false) {
    msg = `Last poll failed: ${props.pollError ?? "unknown error"}`;
  } else if (props.goesLastTs) {
    msg = `GOES X-rays current as of ${relTime(props.goesLastTs)}. Remaining sources land in build step 3.`;
  } else {
    msg = "Scheduler running. Waiting for first GOES poll…";
  }
  return (
    <footer className="mt-auto border-t border-console-line pt-3 text-xs text-console-dim">
      <span className="font-mono">[status]</span> {msg}
    </footer>
  );
}
