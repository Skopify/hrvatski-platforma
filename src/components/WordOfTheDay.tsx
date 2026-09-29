"use client";

import { useCroatianTts } from "@/lib/tts";

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
    <div className="h-full rounded-card border-2 border-outline bg-pop-lime px-6 py-5 text-on-pop shadow-[var(--hard)]">
      <div className="flex items-start justify-between gap-3">
        <p className="hand text-[15px] font-bold">Woord van de dag</p>
        <span className="pill rotate-3 bg-white text-on-pop">{word.seen ? "Al gezien" : "Nieuw"}</span>
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <p className="hr-text display text-[38px] leading-none">{word.hr}</p>
        {tts.voice ? (
          <button
            type="button"
            onClick={() => tts.speak(word.hr)}
            title="Uitspreken"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-outline bg-pop-yellow text-on-pop transition-transform duration-150 active:scale-90"
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

      <p className="mt-1.5 text-[16px] font-semibold">{word.nl}</p>

      <dl className="mt-4 space-y-1.5 rounded-[18px] border-2 border-outline bg-white px-4 py-3 text-[14px]">
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-bold">soort</dt>
          <dd className="font-medium">{POS_LABEL[word.pos] ?? word.pos}</dd>
        </div>
        {word.gender ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-bold">geslacht</dt>
            <dd className="font-medium">{GENDER_LABEL[word.gender] ?? word.gender}</dd>
          </div>
        ) : null}
        {word.gen_sg ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-bold">genitief</dt>
            <dd className="hr-text font-extrabold">{word.gen_sg}</dd>
          </div>
        ) : null}
        {word.nom_pl ? (
          <div className="flex gap-2">
            <dt className="w-20 shrink-0 font-bold">meervoud</dt>
            <dd className="hr-text font-extrabold">{word.nom_pl}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-20 shrink-0 font-bold">uit</dt>
          <dd className="font-medium">les {word.lesson}</dd>
        </div>
      </dl>
    </div>
  );
}
