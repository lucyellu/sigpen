// GOES soft X-ray flare classification.
//   A: <1e-7   B: 1e-7..1e-6   C: 1e-6..1e-5   M: 1e-5..1e-4   X: >=1e-4 W/m^2
// The trailing digit is the mantissa scaled to that decade, capped at 9.9.
// X-class is unbounded so we keep going (X12, X28, etc.).

export function flareClass(fluxWm2: number | null | undefined): string {
  if (fluxWm2 == null || !isFinite(fluxWm2) || fluxWm2 <= 0) return "—";
  const bands: { letter: string; floor: number }[] = [
    { letter: "X", floor: 1e-4 },
    { letter: "M", floor: 1e-5 },
    { letter: "C", floor: 1e-6 },
    { letter: "B", floor: 1e-7 },
  ];
  for (const b of bands) {
    if (fluxWm2 >= b.floor) {
      const mantissa = fluxWm2 / b.floor;
      const rounded = Math.round(mantissa * 10) / 10;
      const display = b.letter === "X"
        ? rounded.toFixed(1)
        : Math.min(rounded, 9.9).toFixed(1);
      return `${b.letter}${display}`;
    }
  }
  // Below B floor → A class.
  const mantissa = (fluxWm2 / 1e-8); // A1.0 corresponds to ~1e-8
  return `A${Math.max(1, Math.min(9.9, Math.round(mantissa * 10) / 10)).toFixed(1)}`;
}

export function fluxFormat(v: number | null | undefined): string {
  if (v == null || !isFinite(v)) return "—";
  // Scientific notation with one decimal: 5.4e-7
  const exp = Math.floor(Math.log10(Math.abs(v)));
  const mant = v / Math.pow(10, exp);
  return `${mant.toFixed(1)}e${exp >= 0 ? "+" : ""}${exp}`;
}

export function lastNonNull<T>(arr: (T | null)[]): { value: T; index: number } | null {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] != null) return { value: arr[i] as T, index: i };
  }
  return null;
}
