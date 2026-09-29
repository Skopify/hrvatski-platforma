"use client";

import { useEffect, useRef, useState } from "react";

import { ISLAND_EVENT, type IslandMessage } from "@/lib/island";
import { Doodle } from "./doodles";

/*
  Het eiland: een gele sticker bovenaan die openvouwt tot een melding en na
  een paar tellen weer dichtklapt. Voor bevestigingen die je niet hoeft te
  lezen om verder te kunnen ("Bewaard", "Dagdoel gehaald") — nooit voor
  fouten die om actie vragen; die staan bij het ding zelf.

  Leest voor schermlezers via aria-live, zodat de melding ook zonder ogen
  aankomt.
*/
const TONE: Record<string, string> = {
  good: "var(--color-pop-mint)",
  info: "var(--color-pop-sky)",
  warm: "var(--color-pop-peach)",
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
      timer.current = setTimeout(() => setOpen(false), 2800);
    };
    window.addEventListener(ISLAND_EVENT, onMsg);
    return () => {
      window.removeEventListener(ISLAND_EVENT, onMsg);
      clearTimeout(timer.current);
    };
  }, []);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[60] flex justify-center px-4"
      aria-live="polite"
      role="status"
    >
      <div
        data-open={open}
        className="island flex min-w-[230px] max-w-[92vw] items-center gap-3 border-2 border-outline bg-pop-yellow py-2 pl-2.5 pr-5 text-on-pop shadow-[4px_4px_0_var(--color-outline)]"
        style={{ borderRadius: 999 }}
      >
        {msg ? (
          <>
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-outline"
              style={{ background: TONE[msg.tone ?? "good"] }}
            >
              <Doodle name="check" size={18} stroke={2.6} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14.5px] font-extrabold leading-tight">{msg.text}</span>
              {msg.sub ? <span className="hand block truncate text-[13px] font-semibold leading-tight">{msg.sub}</span> : null}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}
