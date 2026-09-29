"use client";

import { useEffect, useRef, useState } from "react";

/*
  Een getal dat naar zijn waarde optelt, zoals de tellers in de
  Activiteit-app: je ziet het getal "binnenkomen" in plaats van dat het er
  plotseling staat. Eén keer, bij het laden; daarna gewoon het getal.
  Bij minder beweging staat het er meteen.
*/
export function CountUp({
  value,
  duration = 900,
  suffix = "",
  className = "",
}: {
  value: number;
  duration?: number;
  suffix?: string;
  className?: string;
}) {
  const [shown, setShown] = useState(value);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return setShown(value);
    ran.current = true;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return setShown(value);
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      // Exponentieel uitlopen: snel omhoog, rustig landen.
      const eased = 1 - Math.pow(2, -10 * t);
      setShown(Math.round(value * (t === 1 ? 1 : eased)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <span className={`tabular-nums ${className}`}>
      {shown.toLocaleString("nl-NL")}
      {suffix}
    </span>
  );
}
