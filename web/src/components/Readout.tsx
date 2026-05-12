import { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  accent?: "sol" | "terra" | "neutral";
  state?: "live" | "stale" | "empty";
  children?: ReactNode;
};

const accentText: Record<NonNullable<Props["accent"]>, string> = {
  sol: "text-sol",
  terra: "text-terra",
  neutral: "text-console-ink",
};

const accentBorder: Record<NonNullable<Props["accent"]>, string> = {
  sol: "border-sol/30",
  terra: "border-terra/30",
  neutral: "border-console-line",
};

export function Readout({
  label,
  value,
  unit,
  caption,
  accent = "neutral",
  state = "live",
  children,
}: Props) {
  return (
    <section
      className={`rounded-md border bg-console-surface/60 px-4 py-3 ${accentBorder[accent]}`}
    >
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-console-dim">
        <span>{label}</span>
        {state === "live" && (
          <span className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full pulse-dot ${
                accent === "sol" ? "bg-sol" : accent === "terra" ? "bg-terra" : "bg-console-ink"
              }`}
            />
            live
          </span>
        )}
        {state === "stale" && <span className="text-amber-400">stale</span>}
        {state === "empty" && <span className="text-console-dim">no data</span>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`tnum font-mono text-3xl leading-none ${accentText[accent]}`}>
          {value}
        </span>
        {unit && (
          <span className="font-mono text-xs text-console-dim tnum">{unit}</span>
        )}
      </div>
      {caption && (
        <div className="mt-1 text-xs text-console-dim tnum">{caption}</div>
      )}
      {children && <div className="mt-3">{children}</div>}
    </section>
  );
}
