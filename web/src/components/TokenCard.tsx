// Single-token card used inside the Translator's two columns. Compact
// (glyph + label + UTC time) so 6h of tokens fits without scrolling.

import { forwardRef } from "react";
import { Token, TOKEN_META } from "../lib/tokens/types";
import { Glyph } from "./Glyph";

type Props = {
  token: Token;
  align: "right" | "left"; // "right" = card hugs centre line on the Sol side
};

const sideClasses = {
  sol: { border: "border-sol/40", text: "text-sol" },
  terra: { border: "border-terra/40", text: "text-terra" },
};

function hm(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export const TokenCard = forwardRef<HTMLDivElement, Props>(function TokenCard(
  { token, align },
  ref,
) {
  const meta = TOKEN_META[token.type];
  const c = sideClasses[meta.side];
  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 rounded border ${c.border} bg-console-surface/70 px-2 py-1.5 shadow-sm ${
        align === "right" ? "flex-row" : "flex-row-reverse text-right"
      }`}
    >
      <span className={c.text}>
        <Glyph type={token.type} size={16} />
      </span>
      <div className="flex min-w-0 flex-col leading-tight">
        <span className={`font-mono text-xs ${c.text}`}>{token.label}</span>
        <span className="font-mono text-[10px] text-console-dim tnum">
          {hm(token.ts)}
        </span>
      </div>
    </div>
  );
});
