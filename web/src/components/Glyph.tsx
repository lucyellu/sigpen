// Hand-drawn 24×24 SVG glyphs, one per token type. Stroke colour is
// driven by `currentColor` so the parent decides Sol amber vs Terra teal.
// Strokes only (no fills) keeps them legible at 12px and 24px alike.

import { TokenType } from "../lib/tokens/types";

type Props = {
  type: TokenType;
  size?: number;
  className?: string;
};

export function Glyph({ type, size = 18, className = "" }: Props) {
  const stroke = 1.5;
  const base = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: stroke,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    className,
  };

  switch (type) {
    case "FLARE_C":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="4" x2="12" y2="7" />
          <line x1="12" y1="17" x2="12" y2="20" />
          <line x1="4" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="20" y2="12" />
        </svg>
      );
    case "FLARE_M":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2" x2="12" y2="7" />
          <line x1="12" y1="17" x2="12" y2="22" />
          <line x1="2" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="22" y2="12" />
          <line x1="5" y1="5" x2="8.5" y2="8.5" />
          <line x1="15.5" y1="15.5" x2="19" y2="19" />
          <line x1="5" y1="19" x2="8.5" y2="15.5" />
          <line x1="15.5" y1="8.5" x2="19" y2="5" />
        </svg>
      );
    case "FLARE_X":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="5" strokeWidth="2.25" />
          <line x1="12" y1="1" x2="12" y2="6" strokeWidth="2" />
          <line x1="12" y1="18" x2="12" y2="23" strokeWidth="2" />
          <line x1="1" y1="12" x2="6" y2="12" strokeWidth="2" />
          <line x1="18" y1="12" x2="23" y2="12" strokeWidth="2" />
          <line x1="3.5" y1="3.5" x2="7.5" y2="7.5" strokeWidth="2" />
          <line x1="16.5" y1="16.5" x2="20.5" y2="20.5" strokeWidth="2" />
          <line x1="3.5" y1="20.5" x2="7.5" y2="16.5" strokeWidth="2" />
          <line x1="16.5" y1="7.5" x2="20.5" y2="3.5" strokeWidth="2" />
        </svg>
      );
    case "PROTON_EVENT":
      return (
        <svg {...base}>
          <circle cx="6" cy="12" r="1.4" fill="currentColor" />
          <circle cx="11" cy="7" r="1.4" fill="currentColor" />
          <circle cx="11" cy="17" r="1.4" fill="currentColor" />
          <circle cx="16" cy="11" r="1.4" fill="currentColor" />
          <circle cx="17" cy="17" r="1.4" fill="currentColor" />
          <path d="M3 12 Q9 6 21 6" strokeDasharray="2 2" opacity="0.6" />
          <path d="M3 12 Q9 18 21 18" strokeDasharray="2 2" opacity="0.6" />
        </svg>
      );
    case "BZ_SOUTH":
      return (
        <svg {...base}>
          <line x1="12" y1="3" x2="12" y2="19" />
          <path d="M7 14 L12 20 L17 14" />
          <text x="12" y="3" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">N</text>
          <text x="12" y="24" fontSize="6" textAnchor="middle" fill="currentColor" stroke="none">S</text>
        </svg>
      );
    case "WIND_GUST":
      return (
        <svg {...base}>
          <path d="M2 8 Q6 4 10 8 T18 8 L22 8" />
          <path d="M2 14 Q6 10 10 14 T18 14 L22 14" opacity="0.7" />
          <path d="M2 20 Q6 16 10 20 T18 20 L22 20" opacity="0.4" />
        </svg>
      );
    case "XRA_EVENT":
      return (
        <svg {...base}>
          <polygon points="12,4 21,20 3,20" />
          <line x1="12" y1="10" x2="12" y2="15" />
          <circle cx="12" cy="18" r="0.5" fill="currentColor" stroke="none" />
        </svg>
      );
    case "KP_RISE":
      return (
        <svg {...base}>
          <path d="M3 20 L8 20 L8 15 L13 15 L13 10 L18 10 L18 5 L21 5" />
        </svg>
      );
    case "KP_STORM":
      return (
        <svg {...base}>
          <path d="M3 20 L7 20 L7 14 L11 14 L11 8 L15 8 L15 3 L19 3" strokeWidth="2.25" />
          <line x1="19" y1="3" x2="22" y2="3" strokeWidth="2.25" />
        </svg>
      );
    case "HP_COMPRESSION":
      return (
        <svg {...base}>
          <path d="M5 4 L5 20" />
          <path d="M9 6 L9 18" />
          <path d="M13 8 L13 16" />
          <path d="M17 10 L17 14" />
          <path d="M21 11 L21 13" />
        </svg>
      );
    case "AURORA_EXPANSION":
      return (
        <svg {...base}>
          <path d="M3 19 Q12 4 21 19" />
          <path d="M3 19 Q12 10 21 19" opacity="0.6" />
          <line x1="12" y1="3" x2="12" y2="7" />
          <line x1="10" y1="5" x2="14" y2="5" />
        </svg>
      );
    case "UNKNOWN":
      return (
        <svg {...base}>
          <circle cx="12" cy="12" r="9" strokeDasharray="3 2" />
          <text x="12" y="16" fontSize="11" textAnchor="middle" fill="currentColor" stroke="none">?</text>
        </svg>
      );
  }
}
