// Tokenizers — pure functions over the time-series shapes produced by
// each source fetcher. Each tokenizer scans for threshold crossings,
// sustained excursions, or large deltas and emits Token records.
//
// All thresholds are conservative v1 defaults; tune in BUILD step 5 once
// we have real exchanges to calibrate against. Token IDs are derived from
// (type, ts) so re-running on the same payload yields stable IDs — that
// keeps React keys stable and prevents card flicker across polls.

import { flareClass } from "../flares";
import { GoesMagSeries } from "../sources/goesMag";
import { KpSeries } from "../sources/kp";
import { MagSeries } from "../sources/mag";
import { PlasmaSeries } from "../sources/plasma";
import { ProtonsSeries } from "../sources/protons";
import { XraysGrid } from "../sources/xrays";
import { Token } from "./types";

// ─── Sol ────────────────────────────────────────────────────────────────

// FLARE_C/M/X — segment XRS-B into runs above 1e-6 W/m², emit one token
// per run at the run's peak, classified by peak flux.
export function tokenizeFlares(x: XraysGrid | undefined): Token[] {
  if (!x) return [];
  const { ts, channels } = x;
  const b = channels.xrs_b;
  const out: Token[] = [];
  const CFLOOR = 1e-6;

  let inRun = false;
  let peakIdx = -1;
  let peakVal = 0;

  const flush = () => {
    if (peakIdx < 0) return;
    const type = peakVal >= 1e-4 ? "FLARE_X" : peakVal >= 1e-5 ? "FLARE_M" : "FLARE_C";
    out.push({
      id: `${type}-${ts[peakIdx]}`,
      type,
      side: "sol",
      ts: ts[peakIdx],
      value: peakVal,
      label: flareClass(peakVal),
    });
    peakIdx = -1;
    peakVal = 0;
  };

  for (let i = 0; i < b.length; i++) {
    const v = b[i];
    if (v != null && v >= CFLOOR) {
      if (!inRun) inRun = true;
      if (v > peakVal) {
        peakVal = v;
        peakIdx = i;
      }
    } else if (inRun) {
      flush();
      inRun = false;
    }
  }
  if (inRun) flush();
  return out;
}

// PROTON_EVENT — ≥10 MeV crosses 10 pfu upward (S1 threshold).
export function tokenizeProtons(p: ProtonsSeries | undefined): Token[] {
  if (!p) return [];
  const { ts, values } = p;
  const out: Token[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (prev != null && v != null && prev < 10 && v >= 10) {
      out.push({
        id: `PROTON_EVENT-${ts[i]}`,
        type: "PROTON_EVENT",
        side: "sol",
        ts: ts[i],
        value: v,
        label: `${v.toFixed(1)} pfu`,
      });
    }
    if (v != null) prev = v;
  }
  return out;
}

// BZ_SOUTH — Bz ≤ -5 nT for ≥ 5 consecutive samples (~5 min at 1-min cadence).
// Emit one token per run, anchored at the run's minimum (most southward) sample.
export function tokenizeBzSouth(m: MagSeries | undefined): Token[] {
  if (!m) return [];
  const { ts, bz } = m;
  const out: Token[] = [];
  const THR = -5;
  const MIN = 5;

  let runLen = 0;
  let runMinVal = 0;
  let runMinIdx = -1;
  let runEmitted = false;

  for (let i = 0; i < bz.length; i++) {
    const v = bz[i];
    if (v != null && v <= THR) {
      runLen++;
      if (runMinIdx < 0 || v < runMinVal) {
        runMinVal = v;
        runMinIdx = i;
        runEmitted = false;
      }
    } else {
      if (runLen >= MIN && !runEmitted) {
        out.push({
          id: `BZ_SOUTH-${ts[runMinIdx]}`,
          type: "BZ_SOUTH",
          side: "sol",
          ts: ts[runMinIdx],
          value: runMinVal,
          label: `Bz ${runMinVal.toFixed(1)} nT`,
        });
        runEmitted = true;
      }
      runLen = 0;
      runMinIdx = -1;
    }
  }
  if (runLen >= MIN && !runEmitted) {
    out.push({
      id: `BZ_SOUTH-${ts[runMinIdx]}`,
      type: "BZ_SOUTH",
      side: "sol",
      ts: ts[runMinIdx],
      value: runMinVal,
      label: `Bz ${runMinVal.toFixed(1)} nT`,
    });
  }
  return out;
}

// WIND_GUST — solar-wind speed rose by ≥ 100 km/s over a 30-min window.
// Emit one token at the rising edge (suppress duplicates on neighbouring i).
export function tokenizeWindGusts(p: PlasmaSeries | undefined): Token[] {
  if (!p) return [];
  const { ts, speed } = p;
  const out: Token[] = [];
  const WINDOW = 30;
  const JUMP = 100;

  const delta = (i: number) => {
    if (i < WINDOW) return null;
    const a = speed[i - WINDOW];
    const b = speed[i];
    if (a == null || b == null) return null;
    return b - a;
  };

  for (let i = WINDOW; i < speed.length; i++) {
    const d = delta(i);
    const dPrev = delta(i - 1);
    const cur = speed[i];
    if (d != null && cur != null && d >= JUMP && (dPrev == null || dPrev < JUMP)) {
      out.push({
        id: `WIND_GUST-${ts[i]}`,
        type: "WIND_GUST",
        side: "sol",
        ts: ts[i],
        value: cur,
        label: `+${d.toFixed(0)} km/s`,
      });
    }
  }
  return out;
}

// ─── Terra ──────────────────────────────────────────────────────────────

// KP_RISE / KP_STORM — Kp crosses 5 / 7 upward.
export function tokenizeKp(k: KpSeries | undefined): Token[] {
  if (!k) return [];
  const { ts, values } = k;
  const out: Token[] = [];
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (prev != null && v != null) {
      if (prev < 5 && v >= 5) {
        const type = v >= 7 ? "KP_STORM" : "KP_RISE";
        out.push({
          id: `${type}-${ts[i]}`,
          type,
          side: "terra",
          ts: ts[i],
          value: v,
          label: `Kp ${v.toFixed(2)}`,
        });
      } else if (prev < 7 && v >= 7) {
        out.push({
          id: `KP_STORM-${ts[i]}`,
          type: "KP_STORM",
          side: "terra",
          ts: ts[i],
          value: v,
          label: `Kp ${v.toFixed(2)}`,
        });
      }
    }
    if (v != null) prev = v;
  }
  return out;
}

// HP_COMPRESSION — GOES Hp dropped ≥ 30 nT in 15 min. Same rising-edge
// dedup pattern as WIND_GUST.
export function tokenizeHp(g: GoesMagSeries | undefined): Token[] {
  if (!g) return [];
  const { ts, hp } = g;
  const out: Token[] = [];
  const WINDOW = 15;
  const DROP = 30;

  const delta = (i: number) => {
    if (i < WINDOW) return null;
    const a = hp[i - WINDOW];
    const b = hp[i];
    if (a == null || b == null) return null;
    return b - a;
  };

  for (let i = WINDOW; i < hp.length; i++) {
    const d = delta(i);
    const dPrev = delta(i - 1);
    if (d != null && d <= -DROP && (dPrev == null || dPrev > -DROP)) {
      out.push({
        id: `HP_COMPRESSION-${ts[i]}`,
        type: "HP_COMPRESSION",
        side: "terra",
        ts: ts[i],
        value: hp[i] ?? undefined,
        label: `Δ${d.toFixed(0)} nT`,
      });
    }
  }
  return out;
}

// ─── Aggregators ────────────────────────────────────────────────────────

export function tokenizeSol(opts: {
  xrays?: XraysGrid;
  protons?: ProtonsSeries;
  mag?: MagSeries;
  plasma?: PlasmaSeries;
}): Token[] {
  return [
    ...tokenizeFlares(opts.xrays),
    ...tokenizeProtons(opts.protons),
    ...tokenizeBzSouth(opts.mag),
    ...tokenizeWindGusts(opts.plasma),
  ].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

export function tokenizeTerra(opts: {
  kp?: KpSeries;
  goesMag?: GoesMagSeries;
}): Token[] {
  return [
    ...tokenizeKp(opts.kp),
    ...tokenizeHp(opts.goesMag),
  ].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}
