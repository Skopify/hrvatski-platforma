"use client";

import { useEffect, useState } from "react";

import { Doodle } from "./doodles";

/*
  Licht of donker. Zonder eigen keuze volgt de app het systeem (en wisselt hij
  mee als het systeem 's avonds omschakelt); met één klik leg je het vast.
  Het script in de layout zet het thema al vóór de eerste verf, zodat er
  nooit een witte flits is.

  Het knopje toont waar je heen gaat: een maan in het licht, een zon in het donker.
*/
export const THEME_KEY = "hr-thema";

export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem("${THEME_KEY}");var d=m==="dark"||(m!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;

export function ThemeToggle({ className = "" }: { className?: string }) {
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
      className={`group flex h-10 w-10 items-center justify-center rounded-xl border-2 border-transparent transition-colors hover:border-outline hover:bg-surface ${className}`}
    >
      <span key={dark ? "zon" : "maan"} className="animate-pop block transition-transform duration-150 group-active:scale-90">
        <Doodle name={dark ? "sun" : "moon"} size={24} color={dark ? "var(--color-pop-yellow)" : "var(--color-pop-lilac)"} />
      </span>
    </button>
  );
}
