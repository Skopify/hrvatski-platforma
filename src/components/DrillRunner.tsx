"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { drillBatch, submitDrill } from "@/app/actions/drill";
import { endSession, startSession } from "@/app/actions/les";
import type { DrillFeedback, DrillKind, DrillMeta, DrillQuestion } from "@/lib/drills";
import { TTS_RATES, useCroatianTts } from "@/lib/tts";
import { SpecialChars } from "./SpecialChars";
import { Doodle } from "./doodles";
import { XpChip } from "./XpChip";

/*
  De drill-loop. Anders dan een les is dit eindeloos: porties van twaalf vragen,
  en zodra de portie op is, wordt de volgende gehaald. Stoppen is de enige
  uitgang — en dat is precies goed voor iets dat tempo wil maken.

  De combo-teller is de enige gamification hier: hij beloont ononderbroken
  goed antwoorden, en een diakritische bijna-goed breekt hem wél. Streng, maar
  dat is het punt van een drill.
*/

export function DrillRunner({ meta }: { meta: DrillMeta }) {
  const tts = useCroatianTts();

  const [queue, setQueue] = useState<DrillQuestion[]>([]);
  const [question, setQuestion] = useState<DrillQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<DrillFeedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState({ good: 0, total: 0, xp: 0, combo: 0, best: 0 });
  const [stopped, setStopped] = useState(false);
  const [empty, setEmpty] = useState(false);

  const sessionId = useRef<number | null>(null);
  const started = useRef(Date.now());
  const inputRef = useRef<HTMLInputElement | null>(null);
  const inFlight = useRef(false);

  /* Portie halen; de eerste meteen bij binnenkomst. */
  const refill = useCallback(async (): Promise<DrillQuestion[]> => {
    const batch = await drillBatch(meta.kind, 12);
    if (batch.length === 0) setEmpty(true);
    return batch;
  }, [meta.kind]);

  useEffect(() => {
    let cancelled = false;
    startSession("drill", null).then((id) => {
      if (!cancelled) sessionId.current = id;
    });
    refill().then((batch) => {
      if (cancelled) return;
      setQueue(batch.slice(1));
      setQuestion(batch[0] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [refill]);

  /* Dictee: opgave meteen voorlezen. */
  useEffect(() => {
    if (question?.audio && tts.voice) {
      const t = setTimeout(() => tts.speak(question.audio!), 300);
      return () => clearTimeout(t);
    }
  }, [question, tts.voice]);

  useEffect(() => {
    if (!feedback) inputRef.current?.focus();
  }, [question, feedback]);

  const advance = useCallback(async () => {
    setFeedback(null);
    setAnswer("");
    setPicked(null);
    started.current = Date.now();
    if (queue.length > 0) {
      setQuestion(queue[0]);
      setQueue((q) => q.slice(1));
    } else {
      const batch = await refill();
      setQuestion(batch[0] ?? null);
      setQueue(batch.slice(1));
    }
  }, [queue, refill]);

  const check = useCallback(
    async (value: string) => {
      if (!question || inFlight.current || !value.trim()) return;
      inFlight.current = true;
      setPicked(value);
      setBusy(true);
      try {
        const result = await submitDrill(
          meta.kind,
          question.ref,
          value,
          Date.now() - started.current,
        );
        setFeedback(result);
        setStats((s) => {
          const cleanHit = result.correct && !result.nearMiss;
          const combo = cleanHit ? s.combo + 1 : 0;
          return {
            good: s.good + (result.correct ? 1 : 0),
            total: s.total + 1,
            xp: s.xp + result.xp,
            combo,
            best: Math.max(s.best, combo),
          };
        });
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [meta.kind, question],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || busy) return;
      e.preventDefault();
      if (feedback) void advance();
      else if (meta.input === "text") void check(answer);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, answer, busy, check, feedback, meta.input]);

  const stop = async () => {
    setStopped(true);
    if (sessionId.current !== null) {
      await endSession(sessionId.current, {
        xp: stats.xp,
        correct: stats.good,
        total: stats.total,
      });
    }
  };

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el) return;
    const start = el.selectionStart ?? answer.length;
    const end = el.selectionEnd ?? start;
    setAnswer(answer.slice(0, start) + ch + answer.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  /* ------------------------------------------------------------- randen --- */

  if (empty) {
    return (
      <Shell meta={meta}>
        <div className="card px-8 py-10 text-center">
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            Er zijn nog geen woorden op jouw niveau die deze drill kan gebruiken.
            Werk eerst een paar lessen door — de drill groeit met je mee.
          </p>
          <Link href="/lessen" className="btn btn-primary mt-6 px-5 py-2.5 text-[14px]">
            Naar de lessen
          </Link>
        </div>
      </Shell>
    );
  }

  if (stopped) {
    const pct = stats.total ? Math.round((stats.good / stats.total) * 100) : 0;
    return (
      <Shell meta={meta}>
        <div className="hero animate-rise px-8 py-10 text-center">
          <p className="hand text-[16px] font-bold text-ink-muted">Drill klaar</p>
          <h2 className="display mt-2 text-[32px] text-ink">
            {stats.total === 0 ? "Volgende keer!" : `${pct}% goed`}
          </h2>
          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              { v: `${stats.good}/${stats.total}`, l: "Goed", bg: "bg-pop-mint" },
              { v: `+${stats.xp}`, l: "XP", bg: "bg-pop-yellow" },
              { v: `${stats.best}`, l: "Langste reeks", bg: "bg-pop-sky" },
            ].map((s) => (
              <div key={s.l} className={`rounded-2xl border-2 border-outline py-4 text-on-pop shadow-[3px_3px_0_var(--color-outline)] ${s.bg}`}>
                <p className="num text-[28px] leading-none">{s.v}</p>
                <p className="hand mt-2 text-[13px] font-bold">{s.l}</p>
              </div>
            ))}
          </div>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/oefenen" className="btn btn-primary h-11 px-6 text-[15px]">
              Terug naar oefenen
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (!question) {
    return (
      <Shell meta={meta}>
        <div className="card px-8 py-10 text-center">
          <p className="text-[13px] text-ink-muted">Vragen laden…</p>
        </div>
      </Shell>
    );
  }

  /* -------------------------------------------------------------- vraag --- */

  return (
    <Shell
      meta={meta}
      right={
        <div className="tabular flex items-center gap-3 text-[13px] text-ink-muted">
          {stats.combo >= 3 ? (
            <span className="animate-sticker pill rotate-[-3deg] bg-pop-coral text-on-pop">×{stats.combo}</span>
          ) : null}
          {/* Pas tonen zodra er iets te tellen valt — "0/0" bij de eerste vraag
              leest als een kapotte teller, niet als een lege score. */}
          {stats.total > 0 ? (
            <span className="hand text-[14px] font-bold">
              {stats.good}/{stats.total}
            </span>
          ) : null}
          <XpChip xp={stats.xp} />
        </div>
      }
    >
      <div key={question.ref + stats.total}>
        <div className="card px-7 py-8 shadow-[var(--hard)]">
          <p className="eyebrow">{meta.ask}</p>

          {/* De opgave */}
          {meta.kind === "padezi" ? (
            <>
              {/* Het woord waar de vraag over gaat wordt gemarkeerd — anders zoek
                  je in een hele zin naar wat er precies gevraagd wordt. */}
              <p className="hr-text reading mt-4 text-[24px] leading-snug text-ink">
                {question.prompt.split(/\s+/).map((word, i, all) => {
                  const bare = word.replace(/[.,!?;:„“"]/g, "");
                  const tail = word.slice(bare.length);
                  const isFocus = question.focus && bare === question.focus;
                  return (
                    <span key={i}>
                      {isFocus ? (
                        <>
                          <mark className="rounded bg-pop-yellow px-1 font-bold text-on-pop">
                            {bare}
                          </mark>
                          {tail}
                        </>
                      ) : (
                        word
                      )}
                      {i < all.length - 1 ? " " : ""}
                    </span>
                  );
                })}
              </p>
              {question.sub ? (
                <p className="mt-2 text-[13.5px] text-ink-muted">{question.sub}</p>
              ) : null}
              {tts.voice ? (
                <button
                  type="button"
                  onClick={() => tts.speak(question.audio ?? question.prompt)}
                  className="mt-3 text-[13px] text-ink-muted underline underline-offset-2 transition-colors hover:text-accent"
                >
                  Beluister
                </button>
              ) : null}
            </>
          ) : meta.kind === "diktat" ? (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => tts.speak(question.audio ?? "")}
                disabled={!tts.voice}
                className="btn btn-ghost px-4 py-2.5 text-[13.5px]"
              >
                ▶ Opnieuw
              </button>
              {/* Dezelfde onthouden snelheid als in de lessen — één instelling
                  voor het hele platform, niet per scherm opnieuw kiezen. */}
              <div className="inline-flex items-center gap-1 rounded-lg bg-sunken p-1">
                {TTS_RATES.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => tts.setRate(r.value)}
                    aria-pressed={tts.rate === r.value}
                    className={`rounded-md px-2.5 py-1 text-[13px] font-medium transition-colors ${
                      tts.rate === r.value
                        ? "bg-pop-yellow text-on-pop"
                        : "text-ink-muted hover:text-ink-secondary"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="hr-text display mt-4 text-[44px] leading-tight text-ink">
              {question.prompt}
            </p>
          )}
          {question.sub && meta.kind !== "padezi" ? (
            <p
              className={`mt-1 text-[13.5px] ${
                meta.kind === "oblik" ? "font-semibold text-accent" : "text-ink-muted"
              }`}
            >
              {question.sub}
            </p>
          ) : null}

          {/* Het antwoord */}
          <div className="mt-6">
            {meta.input === "choice" ? (
              <div className="grid gap-2 sm:grid-cols-3">
                {(question.choices ?? meta.choices ?? []).map((c) => {
                  // Na het antwoord staan er twee dingen op het scherm: wat goed
                  // was (groen) en, als die verschilt, wat jij koos (rood).
                  const isRight = Boolean(feedback) && feedback!.expected === c;
                  const isWrongPick = Boolean(feedback) && picked === c && !isRight;
                  return (
                    <button
                      key={c}
                      type="button"
                      disabled={busy || Boolean(feedback)}
                      onClick={() => void check(c)}
                      className={`hr-text rounded-2xl border-2 px-4 py-3.5 text-[16px] font-bold transition-[transform,box-shadow,background-color] duration-150 disabled:cursor-default ${
                        isRight
                          ? "border-outline bg-pop-mint text-on-pop shadow-[3px_3px_0_var(--color-outline)]"
                          : isWrongPick
                            ? "border-outline bg-pop-pink text-on-pop shadow-[3px_3px_0_var(--color-outline)]"
                            : feedback
                              ? "border-line-strong bg-surface text-ink-muted"
                              : "border-outline bg-surface text-ink shadow-[3px_3px_0_var(--color-outline)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-x-px [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-px [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[4px_4px_0_var(--color-outline)]"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={busy || Boolean(feedback)}
                  placeholder="Typ je antwoord…"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  className="input hr-text w-full px-4 py-3.5 text-[19px]"
                />
                {!feedback ? <SpecialChars onInsert={insert} /> : null}
              </div>
            )}
          </div>

          {/* Feedback */}
          {feedback ? (
            <div
              className={`mt-5 rounded-2xl border-2 border-outline px-4 py-3.5 text-on-pop shadow-[3px_3px_0_var(--color-outline)] ${
                feedback.correct
                  ? feedback.nearMiss
                    ? "bg-pop-yellow"
                    : "bg-pop-mint"
                  : "animate-shake bg-pop-pink"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[15.5px] font-extrabold">{feedback.message}</p>
                <span className="animate-sticker pill rotate-[3deg] gap-1 bg-white px-2.5 text-on-pop">
                  <Doodle name="bolt" size={14} color="var(--color-pop-yellow)" />
                  <span className="num text-[13.5px]">+{feedback.xp} XP</span>
                </span>
              </div>
              {!feedback.correct || feedback.nearMiss ? (
                <p className="hr-text mt-1.5 text-[16.5px] font-bold">{feedback.expected}</p>
              ) : null}
              {feedback.explain ? (
                <p className="mt-2 text-[14px] font-medium leading-relaxed">{feedback.explain}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Onderbalk */}
        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            onClick={() => void stop()}
            className="hand text-[14px] font-bold text-ink-muted transition-colors hover:text-ink"
          >
            Stoppen
          </button>
          {meta.input === "text" && !feedback ? (
            <button
              type="button"
              disabled={busy || !answer.trim()}
              onClick={() => void check(answer)}
              className="btn btn-primary h-12 px-7 text-[15.5px]"
            >
              Nakijken
            </button>
          ) : feedback ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void advance()}
              className="btn btn-primary h-12 px-7 text-[15.5px]"
            >
              Verder
            </button>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

function Shell({
  meta,
  right,
  children,
}: {
  meta: DrillMeta;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-12">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link
          href="/oefenen"
          className="hand inline-flex items-center gap-1.5 text-[14px] font-bold text-ink-secondary transition-colors hover:text-accent"
        >
          <span aria-hidden>←</span> Oefenen
        </Link>
        {right}
      </div>
      <h1 className="display mb-1 text-[26px] text-ink">
        {meta.title}
        <span className="hr-text ml-2 font-sans text-[13px] font-normal text-ink-muted">
          {meta.title_hr}
        </span>
      </h1>
      <p className="mb-6 max-w-lg text-[13px] leading-relaxed text-ink-secondary">
        {meta.description}
      </p>
      {children}
    </div>
  );
}
