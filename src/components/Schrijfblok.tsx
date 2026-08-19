"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { beoordeelSchrijfwerk, bewaarSchrijfwerk } from "@/app/actions";
import type { Opdracht, Schrijfoordeel } from "@/lib/schrijven";

/**
 * Schrijven met terugkoppeling.
 *
 * De volgorde op het scherm is een keuze: eerst wat je zelf moet beoordelen,
 * dan pas wat het programma heeft gevonden. Andersom lees je de lijst met
 * spelfouten en denk je dat je klaar bent als die leeg is — terwijl een tekst
 * zonder spelfouten nog steeds nergens over kan gaan.
 *
 * En het onderscheid tussen «vergeten dakje» en «woord dat ik niet ken» is
 * hier het belangrijkste dat er staat. Het eerste is bijna altijd fout. Het
 * tweede is meestal gewoon een woord dat buiten deze leergang valt, en dat als
 * fout tonen leert je je woordenschat klein te houden.
 */
export function Schrijfblok({
  opdracht,
  begin,
  klaarBegin,
}: {
  opdracht: Opdracht;
  begin: string;
  klaarBegin: boolean;
}) {
  const [tekst, setTekst] = useState(begin);
  const [klaar, setKlaar] = useState(klaarBegin);
  const [oordeel, setOordeel] = useState<Schrijfoordeel | null>(null);
  const [model, setModel] = useState(false);
  const [bewaard, setBewaard] = useState<number | null>(null);
  const [bezig, start] = useTransition();

  const woorden = tekst.trim().split(/\s+/).filter(Boolean).length;

  function nakijken() {
    start(async () => {
      await bewaarSchrijfwerk(opdracht.id, tekst, klaar);
      setOordeel(await beoordeelSchrijfwerk(opdracht.id, tekst));
      setBewaard(Date.now());
    });
  }

  function zetKlaar(waarde: boolean) {
    setKlaar(waarde);
    start(async () => {
      await bewaarSchrijfwerk(opdracht.id, tekst, waarde);
      setBewaard(Date.now());
    });
  }

  const diakriet = oordeel?.taal.spelling.filter((s) => s.soort === "diakriet") ?? [];

  /*
    Een Servische vorm is geen onbekend woord.

    «hleb» kwam eerst twee keer op het scherm: één keer als «dit klopt niet, in
    Kroatië is het kruh» en één keer als «ik ken dit woord niet». Het tweede is
    formeel waar en pedagogisch verkeerd — het zwakt de eerste melding af tot
    een kwestie van woordenschat, terwijl het er juist om gaat dat je hem hier
    niet gebruikt.
  */
  const alGemeld = new Set(
    (oordeel?.taal.servismen ?? []).map((m) => m.fragment.toLowerCase()),
  );
  const onbekend =
    oordeel?.taal.spelling.filter(
      (s) => s.soort === "onbekend" && !alGemeld.has(s.woord.toLowerCase()),
    ) ?? [];

  return (
    <div>
      <textarea
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={opdracht.soort === "verhaal" ? 16 : 7}
        placeholder="Piši ovdje…"
        className="w-full rounded-card border border-line-strong bg-surface px-5 py-4 text-[16px] leading-relaxed text-ink"
      />

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-muted">
        <span>
          {woorden} {woorden === 1 ? "woord" : "woorden"}
          {bewaard ? " · bewaard" : ""}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={nakijken}
            disabled={bezig || !tekst.trim()}
            className="rounded-xl bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-white disabled:opacity-40"
          >
            Nakijken
          </button>
          <button
            type="button"
            onClick={() => setModel((m) => !m)}
            className="rounded-xl border border-line-strong bg-white px-5 py-2.5 text-[13.5px] font-semibold text-ink"
          >
            {model ? "Verberg voorbeeld" : "Toon voorbeeld"}
          </button>
        </div>
      </div>

      {model ? (
        <div className="mt-4 rounded-card border border-line bg-sunken px-5 py-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Eén manier om het te doen
          </p>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-ink">{opdracht.model_nl}</p>
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-secondary">
            Niet hét antwoord — een antwoord. Kijk waar het van het jouwe verschilt en of dat
            verschil een fout is of een keuze.
          </p>
        </div>
      ) : null}

      {oordeel ? (
        <div className="mt-6 space-y-4">
          {/* Eerst wat jij moet wegen. */}
          <section className="rounded-card border border-line bg-surface px-5 py-4">
            <h3 className="display-soft mb-3 text-[16px] text-ink">Waar het om ging</h3>
            <ul className="space-y-2">
              {opdracht.rubriek_nl.map((r) => {
                const check = oordeel.checks.find((c) => c.label === r);
                return (
                  <li key={r} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span
                      className={
                        check
                          ? check.ok
                            ? "text-accent"
                            : "text-warm"
                          : "text-ink-muted"
                      }
                    >
                      {check ? (check.ok ? "✓" : "✗") : "·"}
                    </span>
                    <span className="text-ink-secondary">
                      {r}
                      {check ? (
                        <span className="text-ink-muted"> — {check.detail}</span>
                      ) : (
                        <span className="text-ink-muted"> — beoordeel je zelf</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {oordeel.checks
              .filter((c) => !opdracht.rubriek_nl.includes(c.label))
              .map((c) => (
                <p key={c.label} className="mt-2 text-[13px] text-ink-secondary">
                  <span className={c.ok ? "text-accent" : "text-warm"}>{c.ok ? "✓" : "✗"}</span>{" "}
                  {c.label} — <span className="text-ink-muted">{c.detail}</span>
                </p>
              ))}
          </section>

          {/* Dan wat de machine zeker weet. */}
          {diakriet.length || oordeel.taal.naamvallen.length || oordeel.taal.servismen.length ? (
            <section className="rounded-card border border-warm/30 bg-warm-wash px-5 py-4">
              <h3 className="display-soft mb-3 text-[16px] text-ink">Dit klopt niet</h3>
              {diakriet.length ? (
                <p className="mb-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  Vergeten tekens:{" "}
                  {diakriet.map((s, i) => (
                    <span key={s.woord}>
                      {i > 0 ? ", " : ""}
                      <span className="line-through">{s.woord}</span> → <strong className="text-ink">{s.bedoeld}</strong>
                    </span>
                  ))}
                </p>
              ) : null}
              {oordeel.taal.naamvallen.map((n) => (
                <p key={n.fragment} className="mb-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  «<strong className="text-ink">{n.fragment}</strong>» — {n.uitleg}.
                </p>
              ))}
              {oordeel.taal.servismen.map((s, i) => (
                <p key={i} className="mb-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  «<strong className="text-ink">{s.fout}</strong>» is Servisch of Bosnisch; in
                  Kroatië is het <strong className="text-ink">{s.goed}</strong>.
                </p>
              ))}
            </section>
          ) : null}

          {/* En dan wat het níét weet — expliciet als zodanig. */}
          {onbekend.length ? (
            <section className="rounded-card border border-line bg-surface px-5 py-4">
              <h3 className="display-soft mb-1.5 text-[16px] text-ink">Woorden die ik niet ken</h3>
              <p className="mb-2 text-[12.5px] leading-relaxed text-ink-muted">
                Dat betekent niet dat ze fout zijn. Het Kroatisch is groter dan deze leergang —
                ik zeg alleen dat ik ze niet kan thuisbrengen.
              </p>
              <p className="text-[13.5px] leading-relaxed text-ink-secondary">
                {onbekend.map((s) => s.woord).join(" · ")}
              </p>
            </section>
          ) : null}

          <section className="rounded-card border border-line bg-surface px-5 py-4">
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              {oordeel.woorden} woorden, {oordeel.zinnen} zinnen
              {opdracht.soort === "verhaal" ? `, ${oordeel.alineas} alinea's` : ""}. Van de{" "}
              {oordeel.taal.totaal} woorden herkent het platform er {oordeel.taal.herkend}.
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
