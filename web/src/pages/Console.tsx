import { useQuery } from "@tanstack/react-query";
import { Readout } from "../components/Readout";
import { Sparkline } from "../components/Sparkline";
import { flareClass, fluxFormat, lastNonNull } from "../lib/flares";
import { fetchGoesXrays, GoesGrid } from "../lib/swpc";
import { localClock, relTime } from "../lib/time";

const REFRESH_MS = 60_000;
const STALE_MINUTES = 10;

// Channels that aren't fetched yet — render as placeholders so the layout
// stays honest about the build state instead of hiding the missing tiles.
const SOL_PENDING = [
  { key: "wind_speed", label: "Solar wind", unit: "km/s" },
  { key: "bz", label: "IMF Bz", unit: "nT" },
];
const TERRA_PENDING = [
  { key: "kp", label: "Planetary K", unit: "" },
  { key: "aurora_extent", label: "Aurora extent", unit: "°" },
];

type CardState = "live" | "stale" | "empty";

function cardState(sampleTs: string | null, isError: boolean): CardState {
  if (isError || !sampleTs) return "empty";
  const ageMin = (Date.now() - new Date(sampleTs).getTime()) / 60_000;
  return ageMin > STALE_MINUTES ? "stale" : "live";
}

export function Console() {
  const goes = useQuery<GoesGrid>({
    queryKey: ["goes_xrays"],
    queryFn: fetchGoesXrays,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
  });

  const xrsB = goes.data?.channels.xrs_b ?? [];
  const xrsA = goes.data?.channels.xrs_a ?? [];
  const ts = goes.data?.ts ?? [];

  const lastB = lastNonNull(xrsB);
  const lastA = lastNonNull(xrsA);
  const lastBTs = lastB ? ts[lastB.index] : null;
  const lastATs = lastA ? ts[lastA.index] : null;

  const stateB = cardState(lastBTs, goes.isError);
  const stateA = cardState(lastATs, goes.isError);

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
                : goes.isLoading
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
        lastSampleTs={goes.data?.lastSampleTs ?? null}
        loading={goes.isLoading}
        fetchError={goes.error?.message ?? null}
      />
    </div>
  );
}

function StatusLine(props: {
  lastSampleTs: string | null;
  loading: boolean;
  fetchError: string | null;
}) {
  let msg: string;
  if (props.fetchError) {
    msg = `SWPC unreachable — ${props.fetchError}`;
  } else if (props.loading) {
    msg = "Listening…";
  } else if (props.lastSampleTs) {
    msg = `GOES X-rays current as of ${relTime(props.lastSampleTs)}. Remaining sources land in build step 3.`;
  } else {
    msg = "Waiting for first GOES sample…";
  }
  return (
    <footer className="mt-auto border-t border-console-line pt-3 text-xs text-console-dim">
      <span className="font-mono">[status]</span> {msg}
    </footer>
  );
}
