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
const HERSTART = "hr-herstart";

export function Levensteken({ beheerd }: { beheerd: boolean }) {
  const [weg, setWeg] = useState<"nee" | "gestopt" | "afgesloten" | "herstart">("nee");
  // Op een telefoon of iPad kun je de app niet zelf opnieuw starten: dat moet op de laptop.
  const opLaptop = typeof location === "undefined" || ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);

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
        if (++mislukt >= 2) setWeg((w) => (w === "afgesloten" || w === "herstart" ? w : "gestopt"));
      }
    };
    void melden();
    const id = setInterval(melden, 30_000);
    const opnieuwZichtbaar = () => document.visibilityState === "visible" && void melden();
    const afgesloten = () => setWeg("afgesloten");
    // Opnieuw starten (Telefoon & iPad aan of uit): wachten tot de app terug is en dan verversen.
    let wacht: ReturnType<typeof setInterval> | undefined;
    const herstart = () => {
      setWeg("herstart");
      clearInterval(id);
      const begin = Date.now();
      wacht = setInterval(async () => {
        if (Date.now() - begin < 4000) return; // de oude app moet eerst echt weg zijn
        try {
          const r = await fetch("/api/leven", { method: "POST", cache: "no-store" });
          if (r.ok) location.reload();
        } catch {
          // nog niet terug
        }
      }, 1500);
    };
    window.addEventListener(HERSTART, herstart);
    document.addEventListener("visibilitychange", opnieuwZichtbaar);
    window.addEventListener(AFGESLOTEN, afgesloten);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", opnieuwZichtbaar);
      window.removeEventListener(AFGESLOTEN, afgesloten);
      window.removeEventListener(HERSTART, herstart);
      clearInterval(wacht);
    };
  }, [beheerd]);

  if (weg === "nee") return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-plane/95 px-6" role="alertdialog" aria-live="assertive">
      <div className="hero max-w-md bg-pop-yellow px-8 py-10 text-center text-on-pop">
        <div className="mx-auto flex h-20 w-20 rotate-3 items-center justify-center rounded-[22px] border-2 border-outline bg-white shadow-[4px_4px_0_#1b1a22]">
          <Doodle name={weg === "afgesloten" ? "check" : weg === "herstart" ? "loop" : "moon"} size={48} color="var(--color-pop-mint)" />
        </div>
        <h1 className="display mt-6 text-[30px]">{weg === "afgesloten" ? "Tot de volgende keer." : weg === "herstart" ? "Even opnieuw starten…" : "Hrvatski is gestopt."}</h1>
        <p className="mt-3 text-[15.5px] font-semibold leading-relaxed">
          {weg === "afgesloten"
            ? "Alles is afgesloten. Je voortgang staat veilig opgeslagen. Je kunt dit tabblad sluiten."
            : weg === "herstart"
              ? "Dit duurt een paar seconden. Deze pagina laadt daarna vanzelf opnieuw."
              : opLaptop
                ? "De app is na een tijdje stilte vanzelf uitgegaan. Je voortgang staat veilig opgeslagen. Open Hrvatski opnieuw via het icoon."
                : "De app op de laptop is gestopt (of de laptop slaapt). Je voortgang staat veilig opgeslagen. Open Hrvatski op de laptop en probeer het dan opnieuw."}
        </p>
      </div>
    </div>
  );
}

/** De knop onderin de zijbalk. Eerst een tweede klik ter bevestiging. */
export function AfsluitKnop({ beheerd, compact = false }: { beheerd: boolean; compact?: boolean }) {
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);
  // Afsluiten kan alleen op de laptop zelf; op een telefoon of iPad is de knop er niet.
  const [laptop, setLaptop] = useState(false);
  useEffect(() => setLaptop(["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)), []);
  if (!beheerd || !laptop) return null;

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
