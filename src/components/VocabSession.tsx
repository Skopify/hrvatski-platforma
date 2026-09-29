"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { submitVocab, type VocabFeedback } from "@/app/actions/woorden";
import type { StageQuestion } from "@/lib/stages";
import { SpecialChars } from "./SpecialChars";
import { Doodle, Sparkle } from "./doodles";
import { StepTiles } from "./ui";
import { XpChip } from "./XpChip";

/** Wat elk stadium van je vraagt, in gewone taal. */
const STAGE_LABEL: Record<string, string> = {
  LEX_RECOG: "Herkennen",
  CLOZE: "In context",
  LEX_PROD: "Produceren",
};

const STAGE_HINT: Record<string, string> = {
  LEX_RECOG: "Wat betekent dit woord?",
  CLOZE: "Vul de juiste vorm in.",
  LEX_PROD: "Hoe zeg je dit in het Kroatisch?",
};

export function VocabSession({
  questions,
  due,
  nieuw,
}: {
  questions: StageQuestion[];
  due: number;
  nieuw: number;
}) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [feedback, setFeedback] = useState<VocabFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [goed, setGoed] = useState(0);
  const [klaar, setKlaar] = useState(false);

  const start = useRef(Date.now());
  const inFlight = useRef(false);
  const invoer = useRef<HTMLInputElement>(null);

  const vraag = questions[index];

  const check = useCallback(async () => {
    if (!vraag || busy || inFlight.current || !value.trim()) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const uitkomst = await submitVocab(vraag.cardId, value, Date.now() - start.current);
      setFeedback(uitkomst);
      setXp((v) => v + uitkomst.xp);
      if (uitkomst.correct) setGoed((v) => v + 1);
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }, [busy, value, vraag]);

  const verder = useCallback(() => {
    setFeedback(null);
    setValue("");
    start.current = Date.now();
    if (index + 1 >= questions.length) {
      setKlaar(true);
      return;
    }
    setIndex((i) => i + 1);
    invoer.current?.focus();
  }, [index, questions.length]);

  if (!questions.length) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 text-center sm:px-8">
        <h1 className="hr-text display text-[34px] text-ink">Niets te doen</h1>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-secondary">
          Er staan geen woorden klaar. Doe een les om nieuwe woorden op te halen, of kom later
          terug voor de herhalingen.
        </p>
        <Link href="/woorden" className="btn btn-primary mt-8 inline-flex px-6 py-3 text-[14.5px]">
          Naar de woordenlijst
        </Link>
      </div>
    );
  }

  if (klaar) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <div className="hero animate-pop relative px-8 py-11 text-center sm:px-10">
          <Sparkle size={30} className="absolute right-9 top-9 rotate-12" color="var(--color-pop-yellow)" />
          <Sparkle size={20} className="absolute left-10 top-12 -rotate-12" color="var(--color-pop-pink)" />
          <p className="hand text-[16px] font-bold text-ink-muted">Woorden afgerond</p>
          <h1 className="hr-text display mt-1 text-[52px] text-ink">Gotovo!</h1>
          <div className="mt-9 grid grid-cols-2 gap-3">
            <div className="rotate-[-1.5deg] rounded-card border-2 border-outline bg-pop-yellow px-4 py-5 text-on-pop shadow-[3px_3px_0_var(--color-outline)]">
              <p className="num text-[32px] leading-none">+{xp}</p>
              <p className="hand mt-2 text-[13px] font-bold">XP</p>
            </div>
            <div className="rotate-[1deg] rounded-card border-2 border-outline bg-pop-mint px-4 py-5 text-on-pop shadow-[3px_3px_0_var(--color-outline)]">
              <p className="num text-[32px] leading-none">
                {goed}/{questions.length}
              </p>
              <p className="hand mt-2 text-[13px] font-bold">Goed</p>
            </div>
          </div>
          <Link href="/woorden" className="btn btn-primary mt-9 inline-flex h-12 px-8 text-[16px]">
            Klaar
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-9 sm:px-8">
      <header className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <Link href="/woorden" className="hand text-[14px] font-bold text-ink-secondary hover:text-accent">
            ← Woorden
          </Link>
          <span className="flex items-center gap-3">
            <span className="hand text-[14px] font-bold text-ink-secondary tabular-nums">
              {index + 1} / {questions.length}
            </span>
            <XpChip xp={xp} />
          </span>
        </div>
        <StepTiles steps={questions.map((_, i) => (i < index ? "done" : i === index ? "current" : "todo"))} />
        <p className="hand mt-3 text-[13.5px] font-semibold text-ink-muted">
          {due} te herhalen · {nieuw} nieuw
        </p>
      </header>

      <div key={vraag.cardId}>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="pill bg-pop-lilac text-on-pop">
            {STAGE_LABEL[vraag.kind] ?? vraag.kind}
          </span>
          <span className="hand text-[13px] font-semibold text-ink-muted">{STAGE_HINT[vraag.kind]}</span>
        </div>

        <p
          className={`mb-6 text-ink ${
            vraag.mode === "receptive" || vraag.kind === "CLOZE"
              ? "hr-text text-[26px] font-semibold leading-snug"
              : "text-[22px] font-semibold leading-snug"
          }`}
        >
          {vraag.prompt}
        </p>
        {vraag.sub ? <p className="-mt-4 mb-6 text-[13px] text-ink-muted">{vraag.sub}</p> : null}

        <input
          ref={invoer}
          type="text"
          value={value}
          autoFocus
          disabled={Boolean(feedback)}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            if (feedback) verder();
            else void check();
          }}
          placeholder={vraag.mode === "productive" ? "Typ het Kroatisch…" : "Typ de betekenis…"}
          className="input w-full px-4 py-3.5 text-[18px]"
        />

        {vraag.mode === "productive" ? (
          <SpecialChars
            onInsert={(teken) => {
              setValue((v) => v + teken);
              invoer.current?.focus();
            }}
          />
        ) : null}

        {feedback ? (
          <div
            className={`mt-6 rounded-card border-2 border-outline px-5 py-5 text-on-pop shadow-[var(--hard)] ${
              feedback.correct
                ? feedback.nearMiss
                  ? "bg-pop-yellow"
                  : "bg-pop-mint"
                : "bg-pop-pink"
            } ${feedback.correct ? "animate-rise" : "animate-shake"}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[16px] font-extrabold">{feedback.message}</p>
              <span className="animate-sticker pill rotate-[3deg] gap-1 bg-white px-2.5 text-on-pop">
                <Doodle name="bolt" size={14} color="var(--color-pop-yellow)" />
                <span className="num text-[14px]">+{feedback.xp} XP</span>
              </span>
            </div>

            {!feedback.correct || feedback.nearMiss ? (
              <p className="hr-text mt-2 text-[17px] font-bold">
                <span className="hand font-bold">Juist: </span>
                {feedback.expected}
              </p>
            ) : null}

            {/* Promotie en schorsing zijn de twee momenten waarop het systeem
                iets over jóu beslist. Dan hoor je te zien wát het besloot. */}
            {feedback.promoted ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                Dit woord staat stevig genoeg voor de volgende stap:{" "}
                <strong className="text-ink">
                  {STAGE_LABEL[feedback.promoted] ?? feedback.promoted}
                </strong>
                . Die kaart komt er vanaf nu bij.
              </p>
            ) : null}

            {feedback.leech ? (
              <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                Dit woord is te vaak misgegaan en gaat uit de rotatie. Het blijft bestaan — je
                kunt het bij de woordenlijst terugzetten wanneer je er met frisse ogen naar wilt
                kijken.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={verder}
            className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink-secondary"
          >
            Overslaan
          </button>
          <button
            type="button"
            disabled={busy || (!feedback && !value.trim())}
            onClick={() => (feedback ? verder() : void check())}
            className="btn btn-primary px-7 py-3 text-[14.5px]"
          >
            {feedback ? (index + 1 >= questions.length ? "Afronden" : "Verder") : "Nakijken"}
          </button>
        </div>
      </div>
    </div>
  );
}
