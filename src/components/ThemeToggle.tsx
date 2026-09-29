"use client";

import { useEffect, useState } from "react";

/*
  Licht of donker. Zonder eigen keuze volgt de app het systeem (en wisselt hij
  mee als het systeem 's avonds omschakelt); met één klik leg je het vast.
  Het script in de layout zet het thema al vóór de eerste verf, zodat er
  nooit een witte flits is.
*/
export const THEME_KEY = "hr-thema";

export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function ThemeToggle({ className = "", onDark = false }: { className?: string; /** Op de zwarte navigatiestrook. */ onDark?: boolean }) {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onSystem = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem(THEME_KEY);
      } catch {}
      if (stored) return;
      document.documentElement.dataset.theme = mq.matches ? "dark" : "light";
      setDark(mq.matches);
    };
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, []);

  const toggle = () => {
    const next = !(document.documentElement.dataset.theme === "dark");
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try {
      localStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch {}
    setDark(next);
  };

  const label = dark ? "Licht thema" : "Donker thema";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition-colors ${onDark ? "text-[#fbfbf7]/70 hover:bg-[#fbfbf7]/10 hover:text-[#fbfbf7]" : "text-ink-muted hover:bg-sunken hover:text-ink"} ${className}`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden
        className="transition-transform duration-500 [transition-timing-function:var(--ease-in-out-strong)] group-active:scale-90"
        style={{ transform: dark ? "rotate(180deg)" : "rotate(0deg)" }}
      >
        {/* Een halve maan die een halve slag draait: het donkere deel wisselt van kant. */}
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill="currentColor" stroke="none" />
      </svg>
    </button>
  );
}
