"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { collectWord, markStoryRead } from "@/app/actions";
import { glossKey, type Gloss, type Story } from "@/lib/story";
import { useCroatianTts } from "@/lib/tts";
import { Bolt, Checker, Pill } from "./ui";

/*
  De verhaallezer.

  Het ontwerpprincipe: lezen mag nooit stuklopen op één woord. Elk woord is aan
  te tikken en legt zichzelf uit — niet alleen met een vertaling, maar met zijn
  grammaticale plaats ("accusatief enkelvoud van kava"). Dat laatste is wat een
  papieren woordenlijst niet kan en wat het Kroatisch juist nodig heeft: het
  woord in de tekst is zelden het woord uit het woordenboek.

  De uitleg staat in een vast paneel onder aan het scherm in plaats van in een
  zwevende popover: het werkt op aanraakschermen, het springt niet, en de tekst
  blijft op zijn plek.
*/

interface ActiveWord {
  key: string;
  gloss: Gloss;
}

export function StoryReader({
  story,
  comprehensionCount,
  exerciseCount,
}: {
  story: Story;
  comprehensionCount: number;
  exerciseCount: number;
}) {
  const router = useRouter();
  const tts = useCroatianTts();

  const [showNl, setShowNl] = useState(false);
  const [active, setActive] = useState<ActiveWord | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [justRead, setJustRead] = useState<{ xp: number; encountered: number } | null>(null);
  const [busy, setBusy] = useState(false);

  /* Doorlopend voorlezen per alinea: een ketting van speak-aanroepen. */
  const [playing, setPlaying] = useState<string | null>(null);
  const cancelRef = useRef(false);

  const playParagraph = useCallback(
    (pid: string) => {
      const para = story.paragraphs.find((p) => p.id === pid);
      if (!para || !tts.voice) return;
      cancelRef.current = false;
      setPlaying(pid);
      let i = 0;
      const next = () => {
        if (cancelRef.current || i >= para.sentences.length) {
          setPlaying(null);
          return;
        }
        tts.speak(para.sentences[i++].hr, 0.88, next);
      };
      next();
    },
    [story.paragraphs, tts],
  );

  const stopPlayback = useCallback(() => {
    cancelRef.current = true;
    tts.stop();
    setPlaying(null);
  }, [tts]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  const tapWord = (token: string) => {
    const key = glossKey(token);
    const gloss = story.glossary[key];
    if (!gloss) return;
    setActive((cur) => (cur?.key === key ? null : { key, gloss }));
  };

  const save = async () => {
    if (!active?.gloss.item || busy) return;
    setBusy(true);
    await collectWord(story.slug, active.gloss.item);
    setSaved((s) => new Set(s).add(active.gloss.item!));
    setBusy(false);
  };

  const finishReading = async () => {
    if (busy) return;
    setBusy(true);
    const res = await markStoryRead(story.slug);
    setJustRead({ xp: res.xp, encountered: res.encountered });
    setBusy(false);
    router.refresh();
  };

  /** Eén zin, woord voor woord aanklikbaar. */
  const renderSentence = (hr: string) => {
    const parts = hr.split(/(\s+)/);
    return parts.map((part, i) => {
      if (/^\s+$/.test(part) || part === "") return <span key={i}>{part}</span>;
      const key = glossKey(part);
      const known = key && story.glossary[key];
      if (!known) return <span key={i}>{part}</span>;
      const isActive = active?.key === key;
      return (
        <button
          key={i}
          type="button"
          onClick={() => tapWord(part)}
          className={`rounded-[4px] transition-colors duration-100 ${
            isActive
              ? "bg-accent text-white"
              : "hover:bg-accent-wash hover:text-accent"
          }`}
        >
          {part}
        </button>
      );
    });
  };

  return (
    <div className="pb-40">
      {/* Leesstand-schakelaar */}
      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] text-ink-muted">
          Tik een woord aan voor de betekenis en zijn vorm.
        </p>
        <div className="flex rounded-full border border-line bg-surface p-0.5">
          {([
            [false, "Kroatisch"],
            [true, "Met vertaling"],
          ] as const).map(([val, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setShowNl(val)}
              className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                showNl === val ? "bg-accent text-white" : "text-ink-secondary hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* De tekst */}
      <div className="space-y-7">
        {story.paragraphs.map((p) => (
          <div key={p.id} className="group relative">
            {/* Voorleesknop in de marge van de alinea. */}
            {tts.voice ? (
              <button
                type="button"
                onClick={() => (playing === p.id ? stopPlayback() : playParagraph(p.id))}
                title={playing === p.id ? "Stop" : "Lees deze alinea voor"}
                className={`absolute -left-11 top-1 hidden h-8 w-8 items-center justify-center rounded-full border transition-colors md:flex ${
                  playing === p.id
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-surface text-ink-muted opacity-0 hover:border-accent-ring hover:text-accent group-hover:opacity-100"
                }`}
              >
                {playing === p.id ? (
                  <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
                    <rect width="10" height="10" rx="2" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="11" height="12" viewBox="0 0 11 12" aria-hidden>
                    <path d="M0 0 11 6 0 12 Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            ) : null}

            <div className="space-y-3">
              {p.sentences.map((s, si) => (
                <div key={si}>
                  <p className="hr-text reading text-[19px] leading-[1.85] text-ink">
                    {renderSentence(s.hr)}
                  </p>
                  {showNl ? (
                    <p className="mt-0.5 text-[13.5px] leading-relaxed text-ink-muted">{s.nl}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cultuurnoot */}
      {story.culture_nl ? (
        <aside className="card mt-10 px-6 py-5">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-warm">
            {story.culture_nl.title_nl}
          </p>
          <p className="mt-2 text-[13.5px] leading-[1.7] text-ink-secondary">
            {story.culture_nl.body_nl}
          </p>
        </aside>
      ) : null}

      {/* Afronden */}
      <div className="mt-10 border-t border-line pt-7">
        {justRead ? (
          <div className="hero animate-pop px-6 py-5">
            <p className="flex items-center gap-2 text-[14.5px] font-bold text-ink">
              Gelezen!
              {justRead.xp > 0 ? (
                <span className="tabular flex items-center gap-1 text-[13px] font-bold text-gold">
                  <Bolt />+{justRead.xp} XP
                </span>
              ) : null}
            </p>
            {justRead.encountered > 0 ? (
              <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                <span className="font-semibold text-ink">{justRead.encountered} woorden</span>{" "}
                kwamen hier in context langs. Een woord dat je acht tot tien keer in een
                echte tekst tegenkomt, blijft hangen zonder dat je het hoeft te studeren.
              </p>
            ) : null}
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
              Twee soorten vragen: begrijpend lezen gaat over wat er staat en wat je
              eruit kunt afleiden, de taaloefeningen over de vormen.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {comprehensionCount > 0 ? (
                <Link
                  href={`/verhalen/${story.slug}/begrijpen`}
                  className="btn btn-primary px-5 py-2.5 text-[14px]"
                >
                  Begrijpend lezen ({comprehensionCount})
                </Link>
              ) : null}
              {exerciseCount > 0 ? (
                <Link
                  href={`/verhalen/${story.slug}/vragen`}
                  className={`btn px-5 py-2.5 text-[14px] ${
                    comprehensionCount > 0 ? "btn-ghost" : "btn-primary"
                  }`}
                >
                  Taaloefeningen ({exerciseCount})
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={finishReading}
              disabled={busy}
              className="btn btn-primary px-6 py-3 text-[14.5px]"
            >
              Klaar met lezen
            </button>
            <p className="text-[12.5px] text-ink-muted">
              Eerste keer lezen levert 20 XP op; daarna kun je door naar de vragen.
            </p>
          </div>
        )}
      </div>

      {/* Het glossariumpaneel — vast onderin, verspringt niet. */}
      {active ? (
        <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-8 md:pl-[120px]">
          <div className="card animate-rise mx-auto max-w-2xl px-5 py-4 shadow-[var(--lift-3)]">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="hr-text text-[19px] font-bold text-ink">{active.gloss.hr}</span>
                  {active.gloss.lemma && active.gloss.lemma !== active.gloss.hr ? (
                    <span className="hr-text text-[13px] text-ink-muted">
                      ← {active.gloss.lemma}
                    </span>
                  ) : null}
                  <span className="text-[15px] text-ink-secondary">{active.gloss.nl}</span>
                </div>
                {active.gloss.info ? (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
                    {active.gloss.info}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {tts.voice ? (
                  <button
                    type="button"
                    onClick={() => tts.speak(active.gloss.hr)}
                    title="Uitspreken"
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-secondary transition-colors hover:border-accent-ring hover:text-accent"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
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
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  title="Sluiten"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
                >
                  ✕
                </button>
              </div>
            </div>

            {active.gloss.item ? (
              <div className="mt-3 border-t border-line-soft pt-3">
                {saved.has(active.gloss.item) ? (
                  <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-good-ink">
                    <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden>
                      <path
                        d="M3 8.4 6.2 11.6 13 4.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    In je herhaling — komt terug via de planning.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy}
                    className="text-[12.5px] font-semibold text-accent transition-colors hover:text-accent-hover disabled:opacity-50"
                  >
                    + Bewaar voor herhaling
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** De kop boven de lezer — server-vriendelijke data, maar met TTS-knop. */
export function StoryHeader({ story, minutes, words }: { story: Story; minutes: number; words: number }) {
  return (
    <header className="mb-8">
      <Link
        href="/verhalen"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> Verhalen
      </Link>

      <div className="mt-5">
        <Checker className="mb-3.5" />
        <div className="flex flex-wrap items-center gap-2">
          {story.series ? (
            <Pill tone="accent">
              {story.series} · deel {story.part}
            </Pill>
          ) : null}
          <Pill>{story.cefr}</Pill>
          <span className="tabular text-[12px] text-ink-muted">
            ± {minutes} min · {words} woorden
          </span>
        </div>
        <h1 className="hr-text display mt-3.5 text-[36px] text-ink sm:text-[44px]">
          {story.title_hr}
        </h1>
        <p className="mt-1.5 text-[15px] text-ink-secondary">{story.title_nl}</p>
      </div>
    </header>
  );
}
