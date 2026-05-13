import { useQuery } from "@tanstack/react-query";
import { ReactNode } from "react";
import { Readout } from "../components/Readout";
import { Sparkline } from "../components/Sparkline";
import { flareClass, fluxFormat } from "../lib/flares";
import { fetchAurora, AuroraResult } from "../lib/sources/aurora";
import { fetchLatestFlare, LatestFlare } from "../lib/sources/events";
import { fetchGoesMag, GoesMagSeries } from "../lib/sources/goesMag";
import { fetchKp, KpSeries } from "../lib/sources/kp";
import { fetchMag, MagSeries } from "../lib/sources/mag";
import { fetchPlasma, PlasmaSeries } from "../lib/sources/plasma";
import { fetchProtons10MeV, ProtonsSeries } from "../lib/sources/protons";
import { fetchXrays, XraysGrid } from "../lib/sources/xrays";
import { localClock, relTime } from "../lib/time";

const FAST_MS = 60_000;
const SLOW_MS = 5 * 60_000;
const STALE_MIN = 10;

type CardState = "live" | "stale" | "empty";

function cardState(sampleTs: string | null | undefined, isError: boolean): CardState {
  if (isError || !sampleTs) return "empty";
  const ageMin = (Date.now() - new Date(sampleTs).getTime()) / 60_000;
  return ageMin > STALE_MIN ? "stale" : "live";
}

function fmt(v: number | null | undefined, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(decimals);
}

function fmtSigned(v: number | null | undefined, decimals: number): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return (v > 0 ? "+" : "") + v.toFixed(decimals);
}

export function Console() {
  const xrays = useQuery<XraysGrid>({
    queryKey: ["xrays"],
    queryFn: fetchXrays,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const protons = useQuery<ProtonsSeries>({
    queryKey: ["protons"],
    queryFn: fetchProtons10MeV,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const plasma = useQuery<PlasmaSeries>({
    queryKey: ["plasma"],
    queryFn: fetchPlasma,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const mag = useQuery<MagSeries>({
    queryKey: ["mag"],
    queryFn: fetchMag,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const kp = useQuery<KpSeries>({
    queryKey: ["kp"],
    queryFn: fetchKp,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const goesMag = useQuery<GoesMagSeries>({
    queryKey: ["goesMag"],
    queryFn: fetchGoesMag,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const aurora = useQuery<AuroraResult>({
    queryKey: ["aurora"],
    queryFn: fetchAurora,
    refetchInterval: SLOW_MS,
    staleTime: SLOW_MS,
  });
  const events = useQuery<LatestFlare>({
    queryKey: ["events"],
    queryFn: fetchLatestFlare,
    refetchInterval: SLOW_MS,
    staleTime: SLOW_MS,
  });

  const lastB = xrays.data?.latest.xrs_b ?? null;
  const lastA = xrays.data?.latest.xrs_a ?? null;
  const xrsB = xrays.data?.channels.xrs_b ?? [];
  const xrsA = xrays.data?.channels.xrs_a ?? [];

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
            state={cardState(lastB?.ts, xrays.isError)}
            value={lastB ? flareClass(lastB.value) : "—"}
            caption={captionFor(lastB ? `${fluxFormat(lastB.value)} W/m² · ${relTime(lastB.ts)}` : null, xrays)}
          >
            <Sparkline values={xrsB} logScale yMin={1e-9} yMax={1e-4} color="#e8a23c" height={56} />
          </Readout>

          <Readout
            label="GOES XRS-A · short band"
            accent="sol"
            state={cardState(lastA?.ts, xrays.isError)}
            value={lastA ? fluxFormat(lastA.value) : "—"}
            unit={lastA ? "W/m²" : undefined}
            caption={captionFor(lastA ? `0.05–0.4 nm · ${relTime(lastA.ts)}` : null, xrays)}
          >
            <Sparkline values={xrsA} logScale yMin={1e-10} yMax={1e-5} color="#e8a23c" height={56} />
          </Readout>

          <Readout
            label="Solar wind · speed"
            accent="sol"
            state={cardState(plasma.data?.latestSpeed?.ts, plasma.isError)}
            value={fmt(plasma.data?.latestSpeed?.value, 0)}
            unit="km/s"
            caption={captionFor(
              plasma.data?.latestSpeed
                ? `DSCOVR @ L1 · ${relTime(plasma.data.latestSpeed.ts)}`
                : null,
              plasma,
            )}
          >
            <Sparkline
              values={plasma.data?.speed ?? []}
              yMin={200}
              yMax={900}
              color="#e8a23c"
              height={56}
            />
          </Readout>

          <Readout
            label="IMF Bz · GSM"
            accent="sol"
            state={cardState(mag.data?.latestBz?.ts, mag.isError)}
            value={fmtSigned(mag.data?.latestBz?.value, 1)}
            unit="nT"
            caption={captionFor(
              mag.data?.latestBz
                ? `southward → reconnection · ${relTime(mag.data.latestBz.ts)}`
                : null,
              mag,
            )}
          >
            <Sparkline
              values={mag.data?.bz ?? []}
              yMin={-20}
              yMax={20}
              color="#e8a23c"
              height={56}
            />
          </Readout>

          <Readout
            label="Protons · ≥10 MeV"
            accent="sol"
            state={cardState(protons.data?.latestTs, protons.isError)}
            value={fmt(protons.data?.latestValue, 2)}
            unit="pfu"
            caption={captionFor(
              protons.data?.latestTs
                ? `S1 storm @ 10 pfu · ${relTime(protons.data.latestTs)}`
                : null,
              protons,
            )}
          >
            <Sparkline
              values={protons.data?.values ?? []}
              logScale
              yMin={1e-2}
              yMax={1e4}
              color="#e8a23c"
              height={56}
            />
          </Readout>

          <Readout
            label="Latest flare event"
            accent="sol"
            state={cardState(events.data?.beginTs, events.isError)}
            value={events.data?.flareClass ?? "—"}
            caption={captionFor(
              events.data?.beginTs && events.data.flareClass
                ? `${events.data.region ? `AR ${events.data.region} · ` : ""}${relTime(events.data.maxTs ?? events.data.beginTs)}`
                : events.data && !events.data.flareClass
                  ? "no recent XRA in window"
                  : null,
              events,
            )}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-terra">Terra</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Readout
            label="Planetary K"
            accent="terra"
            state={cardState(kp.data?.latest?.ts, kp.isError)}
            value={fmt(kp.data?.latest?.value, 2)}
            caption={captionFor(
              kp.data?.latest
                ? `0–9 scale, 1-min estimate · ${relTime(kp.data.latest.ts)}`
                : null,
              kp,
            )}
          >
            <Sparkline
              values={kp.data?.values ?? []}
              yMin={0}
              yMax={9}
              color="#5fb3a3"
              height={56}
            />
          </Readout>

          <Readout
            label="GOES mag · Hp"
            accent="terra"
            state={cardState(goesMag.data?.latestHp?.ts, goesMag.isError)}
            value={fmtSigned(goesMag.data?.latestHp?.value, 0)}
            unit="nT"
            caption={captionFor(
              goesMag.data?.latestHp
                ? `GEO field · ${relTime(goesMag.data.latestHp.ts)}`
                : null,
              goesMag,
            )}
          >
            <Sparkline
              values={goesMag.data?.hp ?? []}
              yMin={-100}
              yMax={200}
              color="#5fb3a3"
              height={56}
            />
          </Readout>

          <Readout
            label="Aurora · equatorward extent N"
            accent="terra"
            state={cardState(aurora.data?.observationTs, aurora.isError)}
            value={
              aurora.data?.extentDegN != null
                ? `${aurora.data.extentDegN.toFixed(0)}°`
                : "—"
            }
            caption={captionFor(
              aurora.data?.observationTs
                ? `OVATION 30-min · ${relTime(aurora.data.forecastTs ?? aurora.data.observationTs)}`
                : null,
              aurora,
            )}
          />

          <Readout
            label="USGS Boulder mag"
            accent="terra"
            state="empty"
            value="—"
            unit="nT"
            caption="needs Netlify Function (USGS CORS unverified)"
          />

          <Readout
            label="Kyoto Dst quicklook"
            accent="terra"
            state="empty"
            value="—"
            unit="nT"
            caption="needs Netlify Function (WDC Kyoto, no CORS)"
          />
        </div>
      </div>

      <StatusLine
        queries={[
          ["xrays", xrays],
          ["protons", protons],
          ["plasma", plasma],
          ["mag", mag],
          ["kp", kp],
          ["goesMag", goesMag],
          ["aurora", aurora],
          ["events", events],
        ]}
      />
    </div>
  );
}

type QueryLike = {
  isError: boolean;
  isLoading: boolean;
  error: Error | null;
};

function captionFor(text: string | null, q: QueryLike): ReactNode {
  if (text) return text;
  if (q.isError) return `fetch failed: ${q.error?.message ?? "unknown"}`;
  if (q.isLoading) return "listening…";
  return "no samples yet";
}

function StatusLine(props: { queries: [string, QueryLike][] }) {
  const errors = props.queries.filter(([, q]) => q.isError);
  const loading = props.queries.filter(([, q]) => q.isLoading);
  let msg: string;
  if (errors.length === props.queries.length) {
    msg = `All ${errors.length} sources unreachable — check network / SWPC CORS.`;
  } else if (errors.length > 0) {
    const names = errors.map(([n]) => n).join(", ");
    msg = `${errors.length}/${props.queries.length} sources failing: ${names}`;
  } else if (loading.length > 0) {
    msg = `Listening (${props.queries.length - loading.length}/${props.queries.length} live)…`;
  } else {
    msg = `All ${props.queries.length} sources current. Boulder + Dst pending (need backend).`;
  }
  return (
    <footer className="mt-auto border-t border-console-line pt-3 text-xs text-console-dim">
      <span className="font-mono">[status]</span> {msg}
    </footer>
  );
}
