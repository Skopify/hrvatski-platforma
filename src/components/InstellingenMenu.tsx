"use client";

import { useEffect, useRef, useState } from "react";

import { Doodle } from "./doodles";
import { useAfsluiten } from "./Levensteken";
import { Paneel } from "./TelefoonPaneel";
import { useThema } from "./ThemeToggle";

/*
  Eén knop onderin de zijbalk met een klein menu: thema, telefoon en iPad koppelen,
  en Hrvatski afsluiten. Telefoon en Afsluiten bestaan alleen in de app die
  Hrvatski.app gestart heeft (beheerd), en Afsluiten alleen op de laptop zelf.
  Het menu opent naar boven, want de knop zit onderaan.
*/
export function InstellingenMenu({ beheerd }: { beheerd: boolean }) {
  const [open, setOpen] = useState(false);
  const [telefoon, setTelefoon] = useState(false);
  const { dark, toggle } = useThema();
  const afsluit = useAfsluiten(beheerd);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const buiten = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) sluit();
    };
    const toets = (e: KeyboardEvent) => e.key === "Escape" && sluit();
    document.addEventListener("pointerdown", buiten);
    document.addEventListener("keydown", toets);
    return () => {
      document.removeEventListener("pointerdown", buiten);
      document.removeEventListener("keydown", toets);
    };
  }, [open]);

  function sluit() {
    setOpen(false);
    afsluit.setZeker(false);
  }

  const rij =
    "flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left text-[15px] font-bold transition-colors hover:bg-plane active:bg-plane";

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        onClick={() => (open ? sluit() : setOpen(true))}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Instellingen"
        title="Instellingen"
        className="group flex h-10 w-10 items-center justify-center rounded-xl border-2 border-transparent transition-colors hover:border-outline hover:bg-surface"
      >
        <span className="block transition-transform duration-150 group-active:scale-90">
          <Doodle name="instellingen" size={24} color="var(--color-pop-lilac)" />
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Instellingen"
          className="animate-pop absolute bottom-full left-0 z-50 mb-2 w-[224px] origin-bottom-left rounded-[20px] border-2 border-outline bg-surface p-1.5 shadow-[3px_3px_0_var(--color-outline)] lg:left-auto lg:right-0 lg:origin-bottom-right"
        >
          <button type="button" role="menuitem" onClick={toggle} className={rij}>
            <Doodle name={dark ? "sun" : "moon"} size={22} color={dark ? "var(--color-pop-yellow)" : "var(--color-pop-lilac)"} />
            {dark ? "Licht thema" : "Donker thema"}
          </button>
          {beheerd ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                sluit();
                setTelefoon(true);
              }}
              className={rij}
            >
              <Doodle name="praat" size={22} color="var(--color-pop-aqua)" />
              Telefoon &amp; iPad
            </button>
          ) : null}
          {afsluit.beschikbaar ? (
            afsluit.zeker ? (
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <button
                  type="button"
                  onClick={afsluit.afsluiten}
                  disabled={afsluit.bezig}
                  className="pill h-9 flex-1 justify-center bg-pop-coral px-3 text-[13.5px] text-on-pop active:scale-95"
                >
                  Ja, sluit af
                </button>
                <button
                  type="button"
                  onClick={() => afsluit.setZeker(false)}
                  className="pill h-9 justify-center bg-surface px-3 text-[13.5px] text-ink active:scale-95"
                >
                  Nee
                </button>
              </div>
            ) : (
              <button type="button" role="menuitem" onClick={() => afsluit.setZeker(true)} className={rij}>
                <Doodle name="cross" size={22} color="var(--color-pop-coral)" />
                Afsluiten
              </button>
            )
          ) : null}
        </div>
      ) : null}

      {telefoon ? <Paneel sluit={() => setTelefoon(false)} /> : null}
    </div>
  );
}
