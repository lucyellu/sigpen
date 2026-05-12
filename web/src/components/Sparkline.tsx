// Hand-rolled SVG sparkline. Renders flat on mobile Safari with no chart lib
// weight, and respects null gaps as actual breaks (no zero-fill).

type Props = {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  logScale?: boolean;
  yMin?: number;
  yMax?: number;
};

export function Sparkline({
  values,
  width = 320,
  height = 64,
  color = "#e8a23c",
  logScale = false,
  yMin,
  yMax,
}: Props) {
  if (!values.length) {
    return <svg width={width} height={height} aria-hidden="true" />;
  }

  const clean = values.map((v) => {
    if (v == null || !isFinite(v)) return null;
    if (logScale) return v > 0 ? Math.log10(v) : null;
    return v;
  });

  const present = clean.filter((v): v is number => v != null);
  if (!present.length) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line
          x1="0"
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#1b212c"
          strokeDasharray="2 4"
        />
      </svg>
    );
  }

  let lo = yMin ?? Math.min(...present);
  let hi = yMax ?? Math.max(...present);
  if (logScale) {
    lo = yMin != null ? Math.log10(yMin) : lo;
    hi = yMax != null ? Math.log10(yMax) : hi;
  }
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }

  const xStep = clean.length > 1 ? width / (clean.length - 1) : width;
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo);
    return height - t * (height - 2) - 1;
  };

  // Build path with gap-aware segments. M starts each unbroken run.
  let d = "";
  let inRun = false;
  clean.forEach((v, i) => {
    const x = i * xStep;
    if (v == null) {
      inRun = false;
      return;
    }
    if (!inRun) {
      d += `M${x.toFixed(1)} ${y(v).toFixed(1)}`;
      inRun = true;
    } else {
      d += ` L${x.toFixed(1)} ${y(v).toFixed(1)}`;
    }
  });

  let lastIdx = -1;
  for (let i = clean.length - 1; i >= 0; i--) {
    if (clean[i] != null) {
      lastIdx = i;
      break;
    }
  }
  const lastV = lastIdx >= 0 ? clean[lastIdx]! : null;

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      className="block"
    >
      <line
        x1="0"
        y1={height - 1}
        x2={width}
        y2={height - 1}
        stroke="#1b212c"
        strokeWidth="1"
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {lastV != null && (
        <circle
          cx={(lastIdx * xStep).toFixed(1)}
          cy={y(lastV).toFixed(1)}
          r="2.5"
          fill={color}
        />
      )}
    </svg>
  );
}
