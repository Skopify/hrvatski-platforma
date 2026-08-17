"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";

import { submitVocab, type VocabFeedback } from "@/app/actions";
import type { StageQuestion } from "@/lib/stages";
import { SpecialChars } from "./SpecialChars";
import { Bolt } from "./ui";

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
        <div className="hero animate-rise px-8 py-11 text-center sm:px-10">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink-muted">
            Woorden afgerond
          </p>
          <h1 className="hr-text display mt-2.5 text-[38px] text-ink">Gotovo!</h1>
          <div className="mt-9 grid grid-cols-2 gap-3">
            <div className="rounded-card bg-sunken px-4 py-5">
              <p className="tabular text-[26px] font-bold text-gold">+{xp}</p>
              <p className="mt-1 text-[12px] text-ink-muted">XP</p>
            </div>
            <div className="rounded-card bg-sunken px-4 py-5">
              <p className="tabular text-[26px] font-bold text-ink">
                {goed}/{questions.length}
              </p>
              <p className="mt-1 text-[12px] text-ink-muted">Goed</p>
            </div>
          </div>
          <Link href="/woorden" className="btn btn-primary mt-9 inline-flex px-7 py-3 text-[14.5px]">
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
          <Link href="/woorden" className="text-[13px] text-ink-muted hover:text-ink-secondary">
            ← Woorden
          </Link>
          <span className="tabular flex items-center gap-3 text-[12.5px] text-ink-muted">
            <span>
              {index + 1} / {questions.length}
            </span>
            <span className="flex items-center gap-1 font-bold text-gold">
              <Bolt />
              {xp}
            </span>
          </span>
        </div>
        <div className="flex gap-[3px]">
          {questions.map((q, i) => (
            <span
              key={q.cardId}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < index ? "bg-accent" : i === index ? "bg-accent-bright" : "bg-line"
              }`}
            />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-ink-muted">
          {due} te herhalen · {nieuw} nieuw
        </p>
      </header>

      <div key={vraag.cardId} className="animate-rise">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="pill bg-accent-wash uppercase text-accent">
            {STAGE_LABEL[vraag.kind] ?? vraag.kind}
          </span>
          <span className="text-[12px] text-ink-muted">{STAGE_HINT[vraag.kind]}</span>
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
          className="input w-full px-4 py-3 text-[17px]"
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
            className={`mt-6 rounded-card px-5 py-5 ${
              feedback.correct
                ? feedback.nearMiss
                  ? "bg-gold-wash"
                  : "bg-good-wash"
                : "bg-bad-wash"
            } ${feedback.correct ? "animate-rise" : "animate-shake"}`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p
                className={`text-[14.5px] font-bold ${
                  feedback.correct
                    ? feedback.nearMiss
                      ? "text-gold"
                      : "text-good-ink"
                    : "text-bad-ink"
                }`}
              >
                {feedback.message}
              </p>
              <span className="tabular flex items-center gap-1 text-[12px] font-bold text-gold">
                <Bolt />+{feedback.xp}
              </span>
            </div>

            {!feedback.correct || feedback.nearMiss ? (
              <p className="hr-text mt-2 text-[16px] font-semibold text-ink">
                <span className="font-normal text-ink-muted">Juist: </span>
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
