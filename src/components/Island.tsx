"use client";

import { useEffect, useRef, useState } from "react";

import { ISLAND_EVENT, type IslandMessage } from "@/lib/island";

/*
  De Dynamic Island: een zwarte pil bovenaan die openvouwt tot een melding en
  na een paar tellen weer dichtklapt. Voor bevestigingen die je niet hoeft
  te lezen om verder te kunnen ("Bewaard", "Dagdoel gehaald") — nooit voor
  fouten die om actie vragen; die staan bij het ding zelf.

  Leest voor schermlezers via aria-live, zodat de melding ook zonder ogen
  aankomt.
*/
const TONE: Record<string, string> = {
  good: "#32d74b",
  info: "#4da3ff",
  warm: "#ff9f0a",
};

export function Island() {
  const [msg, setMsg] = useState<IslandMessage | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const onMsg = (e: Event) => {
      const detail = (e as CustomEvent<IslandMessage>).detail;
      clearTimeout(timer.current);
      setMsg(detail);
      requestAnimationFrame(() => setOpen(true));
      timer.current = setTimeout(() => setOpen(false), 2600);
    };
    window.addEventListener(ISLAND_EVENT, onMsg);
    return () => {
      window.removeEventListener(ISLAND_EVENT, onMsg);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(10px+env(safe-area-inset-top))] z-[60] flex justify-center px-4"
      aria-live="polite"
      role="status"
    >
      <div
        data-open={open}
        className="island flex min-w-[220px] max-w-[92vw] items-center gap-3 rounded-full bg-[#0b0b0c] py-2.5 pl-3 pr-5 text-white shadow-[0_18px_40px_-14px_rgb(0_0_0/0.55)]"
      >
        {msg ? (
          <>
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
              style={{ background: TONE[msg.tone ?? "good"] }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
                <path d="M3 8.4 6.2 11.6 13 4.8" fill="none" stroke="#0b0b0c" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-tight">{msg.text}</span>
              {msg.sub ? <span className="block truncate text-[12px] leading-tight text-white/65">{msg.sub}</span> : null}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
