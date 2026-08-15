"use client";

import { useCroatianTts } from "@/lib/tts";
import { Pill } from "./ui";

/*
  Woord van de dag. Eén woord, met precies de gegevens die het Kroatisch nodig
  heeft — geslacht en genitief — in plaats van alleen een vertaling. Een woord
  zonder die twee moet je later opnieuw leren.
*/

const POS_LABEL: Record<string, string> = {
  noun: "zelfstandig naamwoord",
  verb: "werkwoord",
  adj: "bijvoeglijk naamwoord",
  adv: "bijwoord",
  pron: "voornaamwoord",
  prep: "voorzetsel",
  num: "telwoord",
  phrase: "uitdrukking",
  interj: "tussenwerpsel",
  conj: "voegwoord",
};

const GENDER_LABEL: Record<string, string> = {
  m: "muški rod — mannelijk",
  f: "ženski rod — vrouwelijk",
  n: "srednji rod — onzijdig",
};

export function WordOfTheDay({
  word,
}: {
  word: {
    hr: string;
    nl: string;
    pos: string;
    gender?: string;
    gen_sg?: string;
    nom_pl?: string;
    lesson: number;
    seen: boolean;
  };
}) {
  const tts = useCroatianTts();

  return (
    <div className="card h-full px-6 py-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted">
          Woord van de dag
        </p>
        {word.seen ? <Pill tone="good">Al gezien</Pill> : <Pill tone="accent">Nieuw</Pill>}
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <p className="hr-text display text-[34px] leading-none text-ink">{word.hr}</p>
        {tts.voice ? (
          <button
            type="button"
            onClick={() => tts.speak(word.hr)}
            title="Uitspreken"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition-colors hover:border-accent-ring hover:bg-accent-wash hover:text-accent"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path d="M3 6v4h2.5L9 13V3L5.5 6H3Z" fill="currentColor" />
              <path
                d="M11 5.5a3.5 3.5 0 0 1 0 5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
          </button>
        ) : null}
      </div>

      <p className="mt-1.5 text-[15px] text-ink-secondary">{word.nl}</p>

      <dl className="mt-4 space-y-1.5 border-t border-line-soft pt-3.5 text-[12.5px]">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-muted">soort</dt>
          <dd className="text-ink-secondary">{POS_LABEL[word.pos] ?? word.pos}</dd>
        </div>
        {word.gender ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">geslacht</dt>
            <dd className="text-ink-secondary">{GENDER_LABEL[word.gender] ?? word.gender}</dd>
          </div>
        ) : null}
        {word.gen_sg ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">genitief</dt>
            <dd className="hr-text font-medium text-ink">{word.gen_sg}</dd>
          </div>
        ) : null}
        {word.nom_pl ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 text-ink-muted">meervoud</dt>
            <dd className="hr-text font-medium text-ink">{word.nom_pl}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 text-ink-muted">uit</dt>
          <dd className="text-ink-secondary">les {word.lesson}</dd>
        </div>
      </dl>
    </div>
  );
}
