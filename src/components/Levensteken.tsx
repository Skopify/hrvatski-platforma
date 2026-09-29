"use client";

import { useEffect, useState } from "react";

import { Doodle } from "./doodles";

/*
  De pagina meldt zich elke halve minuut bij de server ("ik ben er nog"). Zonder
  dat weet de server niet of je nog kijkt, want een browser geeft niet door dat
  een tabblad dicht is; na tien minuten stilte zet hij zichzelf uit
  (src/lib/levenscyclus.ts).

  Is de server weg (afgesloten, of de Mac sliep te lang), dan zie je dat meteen
  en in gewone taal, in plaats van een pagina die stilletjes niets meer doet.
  Alleen actief in de app die Hrvatski.app gestart heeft.
*/
const AFGESLOTEN = "hr-afgesloten";

export function Levensteken({ beheerd }: { beheerd: boolean }) {
  const [weg, setWeg] = useState<"nee" | "gestopt" | "afgesloten">("nee");

  useEffect(() => {
    if (!beheerd) return;
    let mislukt = 0;
    const melden = async () => {
      try {
        const r = await fetch("/api/leven", { method: "POST", cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        mislukt = 0;
      } catch {
        // Twee keer achter elkaar: één haperende verbinding is geen afgesloten server.
        if (++mislukt >= 2) setWeg((w) => (w === "afgesloten" ? w : "gestopt"));
      }
    };
    void melden();
    const id = setInterval(melden, 30_000);
    const opnieuwZichtbaar = () => document.visibilityState === "visible" && void melden();
    const afgesloten = () => setWeg("afgesloten");
    document.addEventListener("visibilitychange", opnieuwZichtbaar);
    window.addEventListener(AFGESLOTEN, afgesloten);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", opnieuwZichtbaar);
      window.removeEventListener(AFGESLOTEN, afgesloten);
    };
  }, [beheerd]);

  if (weg === "nee") return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-plane/95 px-6" role="alertdialog" aria-live="assertive">
      <div className="hero max-w-md bg-pop-yellow px-8 py-10 text-center text-on-pop">
        <div className="mx-auto flex h-20 w-20 rotate-3 items-center justify-center rounded-[22px] border-2 border-outline bg-white shadow-[4px_4px_0_#1b1a22]">
          <Doodle name={weg === "afgesloten" ? "check" : "moon"} size={48} color="var(--color-pop-mint)" />
        </div>
        <h1 className="display mt-6 text-[30px]">{weg === "afgesloten" ? "Tot de volgende keer." : "Hrvatski is gestopt."}</h1>
        <p className="mt-3 text-[15.5px] font-semibold leading-relaxed">
          {weg === "afgesloten"
            ? "Alles is afgesloten. Je voortgang staat veilig opgeslagen. Je kunt dit tabblad sluiten."
            : "De app is na een tijdje stilte vanzelf uitgegaan. Je voortgang staat veilig opgeslagen. Open Hrvatski opnieuw via het icoon."}
        </p>
      </div>
    </div>
  );
}

/** De knop onderin de zijbalk. Eerst een tweede klik ter bevestiging. */
export function AfsluitKnop({ beheerd, compact = false }: { beheerd: boolean; compact?: boolean }) {
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);
  if (!beheerd) return null;

  async function afsluiten() {
    setBezig(true);
    try {
      await fetch("/api/afsluiten", { method: "POST", headers: { "x-hrvatski-actie": "afsluiten" } });
    } finally {
      window.dispatchEvent(new Event(AFGESLOTEN));
    }
  }

  return zeker ? (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={afsluiten} disabled={bezig} className="pill h-8 bg-pop-coral px-3 text-[13px] text-on-pop active:scale-95">
        Ja, sluit af
      </button>
      <button type="button" onClick={() => setZeker(false)} className="pill h-8 bg-white px-3 text-[13px] text-on-pop active:scale-95">
        Nee
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setZeker(true)}
      title="Hrvatski afsluiten"
      aria-label="Hrvatski afsluiten"
      className="pill h-8 gap-1.5 bg-white px-3 text-[13px] text-on-pop active:scale-95"
    >
      <Doodle name="moon" size={16} color="var(--color-pop-lilac)" />
      {compact ? null : "Afsluiten"}
    </button>
  );
}
