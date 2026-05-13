// Token + pair types shared across the tokenize and pair modules.
// A token is a discrete event extracted from a time-series source.
// A pair is a (sol token, terra token) match within a plausible lag window.

export type TokenType =
  | "FLARE_C"
  | "FLARE_M"
  | "FLARE_X"
  | "PROTON_EVENT"
  | "BZ_SOUTH"
  | "WIND_GUST"
  | "XRA_EVENT"
  | "KP_RISE"
  | "KP_STORM"
  | "HP_COMPRESSION"
  | "AURORA_EXPANSION"
  | "UNKNOWN";

export type TokenSide = "sol" | "terra";

export type Token = {
  id: string;          // stable, idempotent across re-tokenizations
  type: TokenType;
  side: TokenSide;
  ts: string;          // ISO Z, the event's peak / onset time
  value?: number;      // associated scalar (flux, nT, pfu, Kp, …)
  label: string;       // short human-readable label, e.g. "M2.1", "Kp 6.3"
};

export type Pair = {
  solId: string;
  terraId: string;
  lagMinutes: number;
};

export type TokenMeta = {
  side: TokenSide;
  short: string;       // 1-2 word identifier shown on the card if no value-derived label
  full: string;        // full prose name used in dictionary / hunter
};

export const TOKEN_META: Record<TokenType, TokenMeta> = {
  FLARE_C:          { side: "sol",   short: "C-flare",     full: "GOES C-class soft X-ray flare" },
  FLARE_M:          { side: "sol",   short: "M-flare",     full: "GOES M-class soft X-ray flare" },
  FLARE_X:          { side: "sol",   short: "X-flare",     full: "GOES X-class soft X-ray flare" },
  PROTON_EVENT:     { side: "sol",   short: "protons",     full: "≥10 MeV proton flux crossed 10 pfu (S1)" },
  BZ_SOUTH:         { side: "sol",   short: "Bz south",    full: "IMF Bz sustained southward (< -5 nT)" },
  WIND_GUST:        { side: "sol",   short: "wind gust",   full: "solar wind speed jumped ≥ 100 km/s in 30 min" },
  XRA_EVENT:        { side: "sol",   short: "XRA",         full: "edited solar event (XRA, NOAA report)" },
  KP_RISE:          { side: "terra", short: "Kp ≥ 5",      full: "planetary K-index reached G1 storm" },
  KP_STORM:         { side: "terra", short: "Kp ≥ 7",      full: "planetary K-index reached G3 storm" },
  HP_COMPRESSION:   { side: "terra", short: "Hp drop",     full: "GOES Hp dropped ≥ 30 nT in 15 min (compression / substorm)" },
  AURORA_EXPANSION: { side: "terra", short: "aurora ↓",    full: "OVATION oval moved equatorward ≥ 3°" },
  UNKNOWN:          { side: "sol",   short: "unknown",     full: "anomaly with no matching response" },
};
