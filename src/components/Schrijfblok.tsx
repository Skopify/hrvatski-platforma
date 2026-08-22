"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";

import { beoordeelSchrijfwerk, bewaarSchrijfwerk } from "@/app/actions";
import { SpecialChars } from "./SpecialChars";
import type { Bankwoord, Opdracht, Schrijfoordeel } from "@/lib/schrijven";

/**
 * Schrijven met terugkoppeling.
 *
 * De opbouw volgt wat er over schrijfdidactiek bekend is: eerst een voorbeeld
 * bekijken, dan de bouwstenen krijgen, dan zelf schrijven, en pas daarna
 * feedback — en die feedback gericht en niet allesomvattend.
 *
 * Twee dingen die de eerste versie fout deed.
 *
 * Het voorbeeld zat achter een knop die «Toon voorbeeld» heette, en dat leest
 * als spieken. Het hoort er juist vóór te staan: je kijkt hoe iemand anders het
 * doet en schrijft dan iets van jezelf. Bij de vrije verhalen blijft het dicht,
 * want daar is het model wél een antwoord.
 *
 * En de fouten werden meteen verbeterd — «Zivim → živim». Dat is tegen de regel
 * die overal elders in dit platform geldt: feedback escaleert, en het antwoord
 * komt nooit als eerste. Wie de verbetering krijgt aangereikt, leest hem en
 * vergeet hem; wie hem zelf moet vinden, moet de regel ophalen. De goede vorm
 * staat er nog steeds, één klik verderop, voor als het niet lukt.
 */
export function Schrijfblok({
  opdracht,
  bank,
  begin,
  klaarBegin,
}: {
  opdracht: Opdracht;
  bank: Bankwoord[];
  begin: string;
  klaarBegin: boolean;
}) {
  const veld = useRef<HTMLTextAreaElement>(null);
  const [tekst, setTekst] = useState(begin);
  const [klaar, setKlaar] = useState(klaarBegin);
  const [oordeel, setOordeel] = useState<Schrijfoordeel | null>(null);
  const [vorigeFouten, setVorigeFouten] = useState<number | null>(null);
  const [model, setModel] = useState(opdracht.soort !== "verhaal");
  const [onthuld, setOnthuld] = useState<Set<string>>(new Set());
  const [bewaard, setBewaard] = useState(false);
  const [bezig, start] = useTransition();

  const woorden = tekst.trim().split(/\s+/).filter(Boolean).length;

  const invoegen = (ch: string) => {
    const el = veld.current;
    if (!el) return;
    const van = el.selectionStart ?? tekst.length;
    const tot = el.selectionEnd ?? van;
    setTekst(tekst.slice(0, van) + ch + tekst.slice(tot));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(van + ch.length, van + ch.length);
    });
  };

  function nakijken() {
    start(async () => {
      await bewaarSchrijfwerk(opdracht.id, tekst, klaar);
      const nieuw = await beoordeelSchrijfwerk(opdracht.id, tekst);
      setVorigeFouten(oordeel ? telFouten(oordeel) : null);
      setOordeel(nieuw);
      setOnthuld(new Set());
      setBewaard(true);
    });
  }

  function zetKlaar(waarde: boolean) {
    setKlaar(waarde);
    start(async () => {
      await bewaarSchrijfwerk(opdracht.id, tekst, waarde);
      setBewaard(true);
    });
  }

  const onthul = (sleutel: string) => setOnthuld((s) => new Set(s).add(sleutel));

  const diakriet = oordeel?.taal.spelling.filter((s) => s.soort === "diakriet") ?? [];
  const namen = oordeel?.taal.spelling.filter((s) => s.soort === "naam") ?? [];
  const vormen = oordeel?.taal.spelling.filter((s) => s.soort === "vorm") ?? [];
  const alGemeld = new Set((oordeel?.taal.servismen ?? []).map((m) => m.fragment.toLowerCase()));
  const onbekend =
    oordeel?.taal.spelling.filter(
      (s) => s.soort === "onbekend" && !alGemeld.has(s.woord.toLowerCase()),
    ) ?? [];

  const fouten = oordeel ? telFouten(oordeel) : 0;
  const vooruit = vorigeFouten !== null && fouten < vorigeFouten;

  return (
    <div>
      {/* 1. Zo doet iemand anders het. */}
      <section className="mb-5">
        <button
          type="button"
          onClick={() => setModel((m) => !m)}
          className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-sunken px-5 py-3 text-left"
        >
          <span className="text-[13.5px] font-semibold text-ink">
            {opdracht.soort === "verhaal" ? "Een voorbeeld — pas openen als je vastzit" : "Zo doet iemand anders het"}
          </span>
          <span className="text-[12px] text-ink-muted">{model ? "verbergen" : "bekijken"}</span>
        </button>
        {model ? (
          <div className="mt-2 rounded-card border border-line bg-surface px-5 py-4">
            <p className="hr-text whitespace-pre-line text-[15.5px] leading-relaxed text-ink">
              {opdracht.model_nl}
            </p>
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
              Niet hét antwoord — een antwoord. Kijk hoe de zinnen gebouwd zijn, schrijf dan
              iets van jezelf.
            </p>
          </div>
        ) : null}
      </section>

      {/* 2. De bouwstenen. */}
      {bank.length ? (
        <section className="mb-5 rounded-card border border-line bg-surface px-5 py-4">
          <p className="mb-2.5 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Woorden die je hier kunt gebruiken
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {bank.map((w) => (
              <li
                key={w.hr}
                className="rounded-lg bg-sunken px-2.5 py-1 text-[13px] text-ink-secondary"
              >
                <span className="hr-text font-semibold text-ink">{w.hr}</span>{" "}
                <span className="text-ink-muted">{w.nl}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-[12px] text-ink-muted">
            Woordenboekvormen — de juiste uitgang moet je zelf maken.
          </p>
        </section>
      ) : null}

      {/* 3. Zelf schrijven. */}
      <textarea
        ref={veld}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={opdracht.soort === "verhaal" ? 16 : 7}
        placeholder="Piši ovdje…"
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="hr-text w-full rounded-card border border-line-strong bg-surface px-5 py-4 text-[16px] leading-relaxed text-ink outline-none transition-all focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-ring)]"
      />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <SpecialChars onInsert={invoegen} />
        <span className="text-[12.5px] text-ink-muted">
          {woorden} van {opdracht.streef_woorden} woorden
          {bewaard ? " · bewaard" : ""}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={nakijken}
          disabled={bezig || !tekst.trim()}
          className="rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-40"
        >
          {oordeel ? "Opnieuw nakijken" : "Nakijken"}
        </button>
      </div>

      {/* 4. Terugkoppeling. */}
      {oordeel ? (
        <div className="mt-6 space-y-4">
          {vooruit ? (
            <p className="rounded-card border border-accent-ring bg-accent-wash px-5 py-3 text-[13.5px] font-semibold text-accent">
              Beter: {vorigeFouten} → {fouten} {fouten === 1 ? "ding" : "dingen"} om naar te kijken.
            </p>
          ) : null}

          <section className="rounded-card border border-line bg-surface px-5 py-4">
            <h3 className="display-soft mb-3 text-[16px] text-ink">Waar het om ging</h3>
            <ul className="space-y-2">
              {opdracht.rubriek_nl.map((r) => {
                const check = oordeel.checks.find((c) => c.label === r);
                return (
                  <li key={r} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className={check ? (check.ok ? "text-accent" : "text-warm") : "text-ink-muted"}>
                      {check ? (check.ok ? "✓" : "✗") : "·"}
                    </span>
                    <span className="text-ink-secondary">
                      {r}
                      <span className="text-ink-muted">
                        {check ? ` — ${check.detail}` : " — beoordeel je zelf"}
                      </span>
                    </span>
                  </li>
                );
              })}
              {oordeel.checks
                .filter((c) => !opdracht.rubriek_nl.includes(c.label))
                .map((c) => (
                  <li key={c.label} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className={c.ok ? "text-accent" : "text-warm"}>{c.ok ? "✓" : "✗"}</span>
                    <span className="text-ink-secondary">
                      {c.label}
                      <span className="text-ink-muted"> — {c.detail}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>

          {fouten ? (
            <section className="rounded-card border border-warm/30 bg-warm-wash px-5 py-4">
              <h3 className="display-soft mb-1 text-[16px] text-ink">Kijk hier nog eens naar</h3>
              <p className="mb-3 text-[12.5px] text-ink-muted">
                Ik zeg wat er aan de hand is, niet meteen wat het moet zijn. Kom je er niet uit,
                klik dan door.
              </p>
              <ul className="space-y-2.5">
                {diakriet.map((s) => (
                  <li key={s.woord} className="text-[13.5px] leading-relaxed text-ink-secondary">
                    «<strong className="hr-text text-ink">{s.woord}</strong>» — hier hoort een
                    teken op een letter dat je toetsenbord niet geeft.{" "}
                    {onthuld.has(s.woord) ? (
                      <strong className="hr-text text-ink">{s.bedoeld}</strong>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onthul(s.woord)}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        toon
                      </button>
                    )}
                  </li>
                ))}
                {oordeel.taal.naamvallen.map((n) => (
                  <li key={n.fragment} className="text-[13.5px] leading-relaxed text-ink-secondary">
                    «<strong className="hr-text text-ink">{n.fragment}</strong>» — {n.uitleg}.
                    {n.bedoeld ? (
                      onthuld.has(n.fragment) ? (
                        <>
                          {" "}
                          Het moet <strong className="hr-text text-ink">{n.bedoeld}</strong> zijn.
                        </>
                      ) : (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={() => onthul(n.fragment)}
                            className="font-semibold text-accent underline underline-offset-2"
                          >
                            toon de vorm
                          </button>
                        </>
                      )
                    ) : null}
                  </li>
                ))}
                {oordeel.taal.servismen.map((s, i) => (
                  <li key={i} className="text-[13.5px] leading-relaxed text-ink-secondary">
                    «<strong className="hr-text text-ink">{s.fout}</strong>» wordt begrepen, maar
                    hoort bij het Servisch en Bosnisch.{" "}
                    {onthuld.has(s.fragment) ? (
                      <>
                        In Kroatië: <strong className="hr-text text-ink">{s.goed}</strong>.
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onthul(s.fragment)}
                        className="font-semibold text-accent underline underline-offset-2"
                      >
                        toon het Kroatische woord
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="rounded-card border border-line bg-surface px-5 py-4 text-[13.5px] text-ink-secondary">
              Geen vergeten tekens, geen voorzetsel met de verkeerde naamval, geen Servische
              vormen. Dat is alles wat ik kan zien — of de zinnen ook klinken zoals een Kroaat ze
              zou zeggen, kan ik niet beoordelen.
            </p>
          )}

          {(vormen.length || onbekend.length || namen.length) ? (
            <section className="rounded-card border border-line bg-surface px-5 py-4">
              <h3 className="display-soft mb-1.5 text-[16px] text-ink">Wat ik niet kon plaatsen</h3>
              <p className="mb-2.5 text-[12.5px] leading-relaxed text-ink-muted">
                Geen fouten — dingen waar ik niets over kan zeggen. Het Kroatisch is groter dan
                deze leergang.
              </p>
              {namen.length ? (
                <p className="mb-1.5 text-[13.5px] text-ink-secondary">
                  <span className="text-ink-muted">Namen: </span>
                  <span className="hr-text">{namen.map((s) => s.woord).join(" · ")}</span>
                </p>
              ) : null}
              {vormen.length ? (
                <p className="mb-1.5 text-[13.5px] text-ink-secondary">
                  <span className="text-ink-muted">Vormen die ik niet ken, van woorden die ik wél ken: </span>
                  {vormen.map((s, i) => (
                    <span key={s.woord} className="hr-text">
                      {i > 0 ? " · " : ""}
                      {s.woord} <span className="font-sans text-ink-muted">({s.verwant})</span>
                    </span>
                  ))}
                </p>
              ) : null}
              {onbekend.length ? (
                <p className="text-[13.5px] text-ink-secondary">
                  <span className="text-ink-muted">Onbekend: </span>
                  <span className="hr-text">{onbekend.map((s) => s.woord).join(" · ")}</span>
                </p>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-card border border-line bg-surface px-5 py-4">
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              {oordeel.woorden} woorden, {oordeel.zinnen} zinnen
              {opdracht.soort === "verhaal" ? `, ${oordeel.alineas} alinea's` : ""}.
            </p>
            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-ink">
              <input
                type="checkbox"
                checked={klaar}
                onChange={(e) => zetKlaar(e.target.checked)}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {oordeel.volledig && oordeel.geslaagd
                ? "Alles wat ik kon nakijken klopt — zet hem op af"
                : "Ik ben er tevreden over — zet hem op af"}
            </label>
          </section>
        </div>
      ) : null}

      <p className="mt-8 text-[13px] text-ink-secondary">
        <Link href="/schrijven" className="link-sweep font-semibold text-accent">
          ← Alle schrijfopdrachten
        </Link>
      </p>
    </div>
  );
}

/** Hoeveel dingen er aantoonbaar mis zijn — de teller voor «beter dan net». */
function telFouten(o: Schrijfoordeel): number {
  return (
    o.taal.spelling.filter((s) => s.soort === "diakriet").length +
    o.taal.naamvallen.length +
    o.taal.servismen.length
  );
}
