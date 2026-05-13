// Sticky top nav. One link per built page; future pages get added as
// they ship. Matches the Console's tracking/uppercase header style so it
// reads like a section heading, not a UI chrome strip.

import { Link, useLocation } from "react-router-dom";

const TABS: { path: string; label: string }[] = [
  { path: "/", label: "Console" },
  { path: "/translator", label: "Translator" },
];

export function Nav() {
  const loc = useLocation();
  return (
    <nav className="sticky top-0 z-20 border-b border-console-line bg-console-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-4 px-4 py-2 text-[10px] uppercase tracking-[0.22em] sm:px-6">
        {TABS.map((t) => {
          const active = loc.pathname === t.path;
          return (
            <Link
              key={t.path}
              to={t.path}
              className={
                active
                  ? "text-console-ink"
                  : "text-console-dim transition-colors hover:text-console-ink"
              }
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
