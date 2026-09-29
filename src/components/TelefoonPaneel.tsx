"use client";

import { useEffect, useState } from "react";

import { Doodle } from "./doodles";

/*
  "Telefoon & iPad": de knop en het paneel op de laptop. Hier zet je het aan,
  zie je het adres en de koppelcode, en ontkoppel je alle apparaten. De app zelf
  blijft op de laptop; een poortwachter laat alleen gekoppelde apparaten door
  (src/lib/lan-proxy.ts).
*/
interface Stand {
  beheerd: boolean;
  aan?: boolean;
  gewenst?: boolean;
  adressen?: string[];
  code?: string | null;
}

const koppen = (actie: string) => ({ "x-hrvatski-actie": actie, "Content-Type": "application/json" });

export function TelefoonKnop({ beheerd, compact = false }: { beheerd: boolean; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  if (!beheerd) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Telefoon & iPad"
        aria-label="Telefoon en iPad"
        className="pill h-8 gap-1.5 bg-surface px-3 text-[13px] text-ink active:scale-95"
      >
        <Doodle name="praat" size={16} color="var(--color-pop-aqua)" />
        {compact ? null : "Telefoon"}
      </button>
      {open ? <Paneel sluit={() => setOpen(false)} /> : null}
    </>
  );
}

function Paneel({ sluit }: { sluit: () => void }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [bezig, setBezig] = useState(false);
  const [meld, setMeld] = useState("");

  const laad = () =>
    fetch("/api/lan", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStand)
      .catch(() => setMeld("Kon de instelling niet lezen."));

  useEffect(() => {
    void laad();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && sluit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sluit]);

  async function zet(aan: boolean) {
    setBezig(true);
    await fetch("/api/lan", { method: "POST", headers: koppen("lan"), body: JSON.stringify({ aan }) });
    await fetch("/api/herstart", { method: "POST", headers: koppen("herstart") });
    window.dispatchEvent(new Event("hr-herstart"));
  }

  async function ontkoppel() {
    setBezig(true);
    await fetch("/api/lan", { method: "POST", headers: koppen("lan"), body: JSON.stringify({ ontkoppel: true }) });
    setBezig(false);
    setMeld("Alle apparaten zijn ontkoppeld. Koppel ze opnieuw met de code.");
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={sluit}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Telefoon en iPad"
        onClick={(e) => e.stopPropagation()}
        className="hero max-h-[90dvh] w-full max-w-md overflow-y-auto bg-pop-aqua p-6 text-on-pop"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-[26px] leading-tight">Telefoon &amp; iPad</h2>
          <button type="button" onClick={sluit} aria-label="Sluiten" className="pill h-9 w-9 justify-center bg-white px-0 text-[16px]">
            ×
          </button>
        </div>

        {!stand ? (
          <p className="mt-4 font-semibold">Even kijken…</p>
        ) : !stand.beheerd ? (
          <p className="mt-4 font-semibold leading-relaxed">
            Dit werkt alleen in de app die je met <b>Hrvatski.app</b> opent, niet in een gewone ontwikkelserver.
          </p>
        ) : stand.aan ? (
          <>
            <p className="mt-3 font-semibold leading-relaxed">
              Open dit adres in Safari op je telefoon of iPad (zelfde wifi als deze laptop) en tik de code in. Kies daarna
              <b> Deel → Zet op beginscherm</b>: dan staat Hrvatski als app op je scherm.
            </p>
            <ul className="mt-4 space-y-2">
              {(stand.adressen ?? []).map((a, i) => (
                <li key={a} className="rounded-[16px] border-2 border-outline bg-white px-3 py-2 font-mono text-[14px] font-bold break-all">
                  {a}
                  {i === 0 ? <span className="hand ml-2 text-[12px] font-bold text-ink-secondary">(dit werkt meestal het best)</span> : null}
                </li>
              ))}
            </ul>
            <p className="hand mt-5 text-[14px] font-bold">Koppelcode</p>
            <p className="num rounded-[20px] border-2 border-outline bg-white py-3 text-center text-[40px] tracking-[0.25em]">
              {stand.code ? `${stand.code.slice(0, 3)} ${stand.code.slice(3)}` : "—"}
            </p>
            <p className="mt-2 text-[13.5px] font-semibold leading-snug">
              De code verandert elke keer dat de app opnieuw start. Een gekoppeld apparaat blijft een half jaar gekoppeld.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={bezig} onClick={ontkoppel} className="btn btn-ghost h-11 px-4 text-[14px]">
                Ontkoppel alle apparaten
              </button>
              <button type="button" disabled={bezig} onClick={() => zet(false)} className="btn btn-ghost h-11 px-4 text-[14px]">
                Zet uit
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-3 font-semibold leading-relaxed">
              Standaard is Hrvatski alleen voor deze laptop. Zet je dit aan, dan kun je het ook op je telefoon en iPad
              gebruiken, zolang de laptop aan staat en op hetzelfde wifi zit.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-[14px] font-semibold leading-snug">
              <li>Alleen apparaten die je koppelt met een code komen erin.</li>
              <li>Het verkeer op je thuiswifi is niet versleuteld: zet dit niet aan op een openbaar netwerk.</li>
              <li>Hrvatski start hierna eenmalig opnieuw op (een paar seconden).</li>
            </ul>
            <div className="mt-5">
              <button type="button" disabled={bezig} onClick={() => zet(true)} className="btn btn-primary h-12 px-6 text-[15px]">
                {stand.gewenst ? "Opnieuw starten" : "Zet aan"}
              </button>
            </div>
          </>
        )}
        {meld ? <p className="mt-4 text-[14px] font-bold">{meld}</p> : null}
      </div>
    </div>
  );
}
