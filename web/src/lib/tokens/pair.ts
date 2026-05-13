// Pair Sol tokens with Terra tokens within plausible lag windows. The
// windows below are deliberately wide v1 priors — derived from textbook
// space-weather causality, not a learned model. Hunter will refine them.
//
// Each entry: lag window in *minutes* from Sol onset to Terra response.
//   Short windows  : magnetosphere-direct effects (Bz, ram-pressure)
//   Medium windows : CME shock arrivals (hours to ~3 days)

import { Pair, Token, TokenType } from "./types";

const PAIR_WINDOWS: Record<`${TokenType}:${TokenType}`, [number, number]> = {
  // CME-driven storms: hours to days. M and X flares often correlate with
  // halo CMEs; transit time scales with shock speed (typically 1–3 days).
  "FLARE_M:KP_RISE": [60, 60 * 72],
  "FLARE_M:KP_STORM": [60, 60 * 72],
  "FLARE_M:HP_COMPRESSION": [30, 60 * 48],
  "FLARE_X:KP_RISE": [60, 60 * 72],
  "FLARE_X:KP_STORM": [60, 60 * 72],
  "FLARE_X:HP_COMPRESSION": [30, 60 * 48],

  // SEPs travel near light-speed → fast onset, but storm response still
  // depends on the parent CME's arrival, so window is similar.
  "PROTON_EVENT:KP_RISE": [0, 60 * 48],
  "PROTON_EVENT:KP_STORM": [0, 60 * 48],
  "PROTON_EVENT:HP_COMPRESSION": [0, 60 * 24],

  // L1 → Earth solar-wind propagation: ~30–60 min nominal. Once the
  // southward Bz arrives at the magnetopause, response is fast.
  "BZ_SOUTH:KP_RISE": [0, 60 * 12],
  "BZ_SOUTH:KP_STORM": [0, 60 * 12],
  "BZ_SOUTH:HP_COMPRESSION": [0, 60 * 6],

  // Ram-pressure compressions hit the magnetosphere within an hour.
  "WIND_GUST:HP_COMPRESSION": [0, 60 * 3],
  "WIND_GUST:KP_RISE": [30, 60 * 12],
} as Record<`${TokenType}:${TokenType}`, [number, number]>;

export function pairTokens(sol: Token[], terra: Token[]): Pair[] {
  const pairs: Pair[] = [];
  for (const s of sol) {
    const sTime = new Date(s.ts).getTime();
    for (const t of terra) {
      const key = `${s.type}:${t.type}` as `${TokenType}:${TokenType}`;
      const window = PAIR_WINDOWS[key];
      if (!window) continue;
      const lagMin = (new Date(t.ts).getTime() - sTime) / 60_000;
      if (lagMin < window[0] || lagMin > window[1]) continue;
      pairs.push({ solId: s.id, terraId: t.id, lagMinutes: lagMin });
    }
  }
  return pairs;
}
