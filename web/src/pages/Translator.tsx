// Translator — two scrolling columns connected by exchange lines.
// Left column = Sol tokens (sun-side events), right column = Terra
// tokens (Earth/magnetosphere response). Tokens share a vertical time
// axis (now at top, oldest at bottom); SVG curves connect Sol→Terra
// pairs that fit a known causal lag window.
//
// Data dependencies are the same React Query keys the Console uses, so
// when both pages stay open the cache is shared and we don't re-fetch.

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { TokenCard } from "../components/TokenCard";
import { pairTokens } from "../lib/tokens/pair";
import { tokenizeSol, tokenizeTerra } from "../lib/tokens/tokenize";
import { Token, TOKEN_META } from "../lib/tokens/types";
import { fetchGoesMag } from "../lib/sources/goesMag";
import { fetchKp } from "../lib/sources/kp";
import { fetchMag } from "../lib/sources/mag";
import { fetchPlasma } from "../lib/sources/plasma";
import { fetchProtons10MeV } from "../lib/sources/protons";
import { fetchXrays } from "../lib/sources/xrays";
import { relTime } from "../lib/time";

const FAST_MS = 60_000;
const WINDOW_HOURS = 6;
const WINDOW_MS = WINDOW_HOURS * 60 * 60 * 1000;

// Container height ≈ pixel density on the time axis. 200 px/h reads
// comfortably on a 1024-tall iPad and still feels scannable on phone.
const PX_PER_HOUR = 200;
const TOP_PAD = 32;
const BOT_PAD = 32;
const COLUMN_HEIGHT = TOP_PAD + WINDOW_HOURS * PX_PER_HOUR + BOT_PAD;

export function Translator() {
  const xrays = useQuery({
    queryKey: ["xrays"],
    queryFn: fetchXrays,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const protons = useQuery({
    queryKey: ["protons"],
    queryFn: fetchProtons10MeV,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const mag = useQuery({
    queryKey: ["mag"],
    queryFn: fetchMag,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const plasma = useQuery({
    queryKey: ["plasma"],
    queryFn: fetchPlasma,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const kp = useQuery({
    queryKey: ["kp"],
    queryFn: fetchKp,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });
  const goesMag = useQuery({
    queryKey: ["goesMag"],
    queryFn: fetchGoesMag,
    refetchInterval: FAST_MS,
    staleTime: FAST_MS,
  });

  const solTokens = useMemo(
    () =>
      tokenizeSol({
        xrays: xrays.data,
        protons: protons.data,
        mag: mag.data,
        plasma: plasma.data,
      }),
    [xrays.data, protons.data, mag.data, plasma.data],
  );
  const terraTokens = useMemo(
    () => tokenizeTerra({ kp: kp.data, goesMag: goesMag.data }),
    [kp.data, goesMag.data],
  );

  // "Now" is pinned to query refetch cadence — re-derive when any
  // dependency updates, so card positions and lines stay aligned.
  const now = useMemo(
    () => Date.now(),
    [xrays.dataUpdatedAt, protons.dataUpdatedAt, mag.dataUpdatedAt, plasma.dataUpdatedAt, kp.dataUpdatedAt, goesMag.dataUpdatedAt],
  );
  const startMs = now - WINDOW_MS;

  const inWindow = (t: Token) => {
    const ms = new Date(t.ts).getTime();
    return ms >= startMs && ms <= now;
  };
  const visibleSol = useMemo(() => solTokens.filter(inWindow), [solTokens, now]);
  const visibleTerra = useMemo(() => terraTokens.filter(inWindow), [terraTokens, now]);

  const visibleIds = new Set<string>([
    ...visibleSol.map((t) => t.id),
    ...visibleTerra.map((t) => t.id),
  ]);
  const visiblePairs = useMemo(
    () =>
      pairTokens(visibleSol, visibleTerra).filter(
        (p) => visibleIds.has(p.solId) && visibleIds.has(p.terraId),
      ),
    [visibleSol, visibleTerra],
  );

  const yFor = (ts: string): number => {
    const t = new Date(ts).getTime();
    const frac = (now - t) / WINDOW_MS;
    return TOP_PAD + frac * (COLUMN_HEIGHT - TOP_PAD - BOT_PAD);
  };

  // Hour ticks: now, now-1h, …, now-6h
  const ticks = useMemo(() => {
    const out: { y: number; label: string; major: boolean }[] = [];
    for (let h = 0; h <= WINDOW_HOURS; h++) {
      const dt = new Date(now - h * 60 * 60 * 1000);
      const hm = dt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
      out.push({
        y: yFor(dt.toISOString()),
        label: h === 0 ? "now" : hm,
        major: h === 0,
      });
    }
    return out;
  }, [now]);

  const fetching = [xrays, protons, mag, plasma, kp, goesMag];
  const loading = fetching.every((q) => q.isLoading);
  const errors = fetching.filter((q) => q.isError);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 sm:px-6">
      <header className="border-b border-console-line pb-3">
        <div className="text-[10px] uppercase tracking-[0.22em] text-console-dim">
          Sun-Earth Translator
        </div>
        <h1 className="font-sans text-xl">Translator</h1>
        <p className="mt-2 font-mono text-xs text-console-dim tnum">
          Last {WINDOW_HOURS}h · {visibleSol.length} sol{" "}
          {visibleSol.length === 1 ? "signal" : "signals"} · {visibleTerra.length}{" "}
          terra {visibleTerra.length === 1 ? "response" : "responses"} ·{" "}
          {visiblePairs.length}{" "}
          {visiblePairs.length === 1 ? "exchange" : "exchanges"} paired
        </p>
      </header>

      {loading && (
        <p className="font-mono text-xs text-console-dim">Listening…</p>
      )}
      {!loading && errors.length === fetching.length && (
        <p className="font-mono text-xs text-amber-400">
          All sources unreachable — {errors[0].error?.message ?? "fetch failed"}
        </p>
      )}

      <div
        className="grid grid-cols-[44px_1fr_72px_1fr] gap-0 sm:grid-cols-[56px_1fr_88px_1fr]"
        style={{ height: COLUMN_HEIGHT }}
      >
        {/* Time-axis column */}
        <div className="relative">
          {ticks.map((t) => (
            <div key={t.label} style={{ top: t.y }} className="absolute right-2">
              <span
                className={`font-mono text-[10px] tnum ${
                  t.major ? "text-console-ink" : "text-console-dim"
                }`}
              >
                {t.label}
              </span>
            </div>
          ))}
          {/* vertical axis tick line */}
          <div className="absolute right-0 top-0 h-full w-px bg-console-line" />
        </div>

        {/* Sol column */}
        <div className="relative pr-2">
          {visibleSol.length === 0 && !loading && (
            <EmptyColumn side="sol" />
          )}
          {visibleSol.map((t) => (
            <div
              key={t.id}
              style={{ top: yFor(t.ts) }}
              className="absolute right-0 -translate-y-1/2"
            >
              <TokenCard token={t} align="right" />
            </div>
          ))}
        </div>

        {/* Centre column — SVG exchange lines */}
        <div className="relative">
          <svg
            width="100%"
            height={COLUMN_HEIGHT}
            viewBox={`0 0 100 ${COLUMN_HEIGHT}`}
            preserveAspectRatio="none"
            className="absolute inset-0"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="solToTerra" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#e8a23c" stopOpacity="0.75" />
                <stop offset="100%" stopColor="#5fb3a3" stopOpacity="0.75" />
              </linearGradient>
            </defs>
            {visiblePairs.map((p) => {
              const sol = visibleSol.find((t) => t.id === p.solId);
              const terra = visibleTerra.find((t) => t.id === p.terraId);
              if (!sol || !terra) return null;
              const ys = yFor(sol.ts);
              const yt = yFor(terra.ts);
              return (
                <path
                  key={`${p.solId}->${p.terraId}`}
                  d={`M0 ${ys} C50 ${ys} 50 ${yt} 100 ${yt}`}
                  stroke="url(#solToTerra)"
                  strokeWidth="1.2"
                  fill="none"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
            {/* faint hourly grid ticks across the centre column */}
            {ticks.map((t) => (
              <line
                key={`grid-${t.label}`}
                x1="0"
                x2="100"
                y1={t.y}
                y2={t.y}
                stroke="#1b212c"
                strokeWidth="0.5"
                strokeDasharray={t.major ? "" : "2 4"}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>

        {/* Terra column */}
        <div className="relative pl-2">
          {visibleTerra.length === 0 && !loading && (
            <EmptyColumn side="terra" />
          )}
          {visibleTerra.map((t) => (
            <div
              key={t.id}
              style={{ top: yFor(t.ts) }}
              className="absolute left-0 -translate-y-1/2"
            >
              <TokenCard token={t} align="left" />
            </div>
          ))}
        </div>
      </div>

      <PairLegend pairs={visiblePairs} sol={visibleSol} terra={visibleTerra} />

      {visibleSol.length === 0 &&
        visibleTerra.length === 0 &&
        !loading &&
        errors.length < fetching.length && (
          <p className="font-mono text-xs text-console-dim">
            The conversation is quiet — no tokens fired in the last{" "}
            {WINDOW_HOURS}h. Thresholds: C-flare ≥ 1e-6 W/m², Bz ≤ -5 nT
            sustained, wind Δ ≥ 100 km/s in 30 min, Kp ≥ 5, Hp Δ ≤ -30 nT in
            15 min.
          </p>
        )}
    </div>
  );
}

function EmptyColumn({ side }: { side: "sol" | "terra" }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-console-dim">
        {side === "sol" ? "sun is quiet" : "magnetosphere quiet"}
      </span>
    </div>
  );
}

function PairLegend({
  pairs,
  sol,
  terra,
}: {
  pairs: { solId: string; terraId: string; lagMinutes: number }[];
  sol: Token[];
  terra: Token[];
}) {
  if (pairs.length === 0) return null;
  // List the exchanges textually for screen readers + tokenless review.
  return (
    <details className="rounded border border-console-line bg-console-surface/40 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-mono uppercase tracking-[0.18em] text-console-dim">
        {pairs.length} exchange{pairs.length === 1 ? "" : "s"}
      </summary>
      <ul className="mt-2 flex flex-col gap-1 font-mono text-xs">
        {pairs.map((p) => {
          const s = sol.find((x) => x.id === p.solId);
          const t = terra.find((x) => x.id === p.terraId);
          if (!s || !t) return null;
          const lag = formatLag(p.lagMinutes);
          return (
            <li key={`${p.solId}->${p.terraId}`}>
              <span className="text-sol">{TOKEN_META[s.type].short}</span>
              <span className="text-console-dim"> · {s.label} · {relTime(s.ts)}</span>
              <span className="text-console-dim"> → </span>
              <span className="text-terra">{TOKEN_META[t.type].short}</span>
              <span className="text-console-dim"> · {t.label} · lag {lag}</span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function formatLag(min: number): string {
  if (min < 60) return `${min.toFixed(0)} min`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)} h`;
  return `${(h / 24).toFixed(1)} d`;
}
