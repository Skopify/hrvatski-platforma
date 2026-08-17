"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgeTeaching,
  completeLesson,
  endSession,
  markStepDone,
  markStoryQuizDone,
  selfAssess,
  startSession,
  submitAnswer,
  type Feedback,
} from "@/app/actions";
import type { PresentedExercise } from "@/lib/present";
import { useCroatianTts } from "@/lib/tts";
import { Answer, ExerciseView, emptyAnswer, isAnswered } from "./ExerciseView";
import { Bolt } from "./ui";

export interface Step {
  exercise: PresentedExercise;
  lessonNumber: number;
  sectionTitle: string;
  reason: "introductie" | "oefening" | "herhaling";
  /**
   * Vervangt het etiket linksboven. Bij begrijpend lezen staat daar de
   * vaardigheid ("Verwijswoord") plus wat die van je vraagt — het soort vraag
   * herkennen is daar het halve werk.
   */
  badge?: { label: string; hint?: string };
}

const REASON_STYLE: Record<Step["reason"], string> = {
  introductie: "bg-accent-wash text-accent",
  oefening: "bg-sunken text-ink-secondary",
  herhaling: "bg-gold-wash text-gold",
};

export function SessionRunner({
  steps,
  kind,
  lessonNumber,
  title,
  storySlug,
  backHref,
}: {
  steps: Step[];
  kind: "lesson" | "review";
  lessonNumber: number | null;
  title: string;
  /** Bij een verhaalquiz: markeert de quiz als afgerond bij het einde. */
  storySlug?: string;
  backHref?: string;
}) {
  const router = useRouter();
  const tts = useCroatianTts();

  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState<Answer>(() =>
    steps.length ? emptyAnswer(steps[0].exercise) : { kind: "text", value: "" },
  );
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [busy, setBusy] = useState(false);
  const [xp, setXp] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [graded, setGraded] = useState(0);
  const [finished, setFinished] = useState(false);
  /**
   * Op welke trede van de escalatie deze oefening staat. 0 = eerste poging.
   * Leeft hier en niet op de server: de server bepaalt wát er op een trede
   * gedeeld mag worden, de client alleen waar je bent.
   */
  const [stage, setStage] = useState(0);

  const sessionId = useRef<number | null>(null);
  const stepStart = useRef<number>(Date.now());
  const totals = useRef({ xp: 0, correct: 0, total: 0 });
  const inFlight = useRef(false);

  const step = steps[index];
  const isLast = index >= steps.length - 1;
  const awaitingSelfAssess = Boolean(feedback?.selfAssess);
  /** Feedback die om een nieuwe poging vraagt in plaats van om doorschakelen. */
  const escalating = feedback?.stage === "hint" || feedback?.stage === "choice";

  useEffect(() => {
    let cancelled = false;
    startSession(kind, lessonNumber).then((id) => {
      if (!cancelled) sessionId.current = id;
    });
    return () => {
      cancelled = true;
    };
  }, [kind, lessonNumber]);

  useEffect(() => {
    stepStart.current = Date.now();
  }, [index]);

  const finish = useCallback(async () => {
    setFinished(true);
    if (sessionId.current !== null) {
      await endSession(sessionId.current, totals.current);
    }
    if (kind === "lesson" && lessonNumber !== null) {
      await completeLesson(lessonNumber);
    }
    if (storySlug) {
      await markStoryQuizDone(storySlug);
    }
    router.refresh();
  }, [kind, lessonNumber, router, storySlug]);

  const advance = useCallback(() => {
    setFeedback(null);
    setStage(0);
    // Vastleggen dat deze stap gehad is, vóór het doorschakelen. Sluit je nu
    // het tabblad, dan pakt "Les hervatten" hier weer op.
    if (kind === "lesson" && lessonNumber !== null && step) {
      void markStepDone(lessonNumber, step.exercise.id);
    }
    if (isLast) {
      void finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    setAnswer(emptyAnswer(steps[next].exercise));
  }, [finish, index, isLast, kind, lessonNumber, step, steps]);

  /** Terug naar het invoerveld voor de volgende trede; het antwoord blijft staan. */
  const retry = useCallback(() => {
    setStage((t) => t + 1);
    setFeedback(null);
  }, []);

  const check = useCallback(async () => {
    // setBusy werkt pas bij de volgende render, dus een ref is de enige betrouwbare
    // grendel tegen twee inzendingen van hetzelfde antwoord.
    if (busy || inFlight.current || !step) return;
    inFlight.current = true;
    const duration = Date.now() - stepStart.current;

    try {
      // Lezen wordt niet gescoord: input is er om te begrijpen, niet te presteren.
      if (step.exercise.type === "reading") {
        advance();
        return;
      }

      if (step.exercise.type === "teaching_moment") {
        setBusy(true);
        await acknowledgeTeaching(step.exercise.id);
        totals.current.xp += 2;
        setXp((v) => v + 2);
        setBusy(false);
        advance();
        return;
      }

      if (!isAnswered(answer)) return;

      setBusy(true);
      const payload =
        answer.kind === "text"
          ? ({ kind: "text", value: answer.value } as const)
          : answer.kind === "choice"
            ? ({ kind: "choice", value: answer.value } as const)
            : answer.kind === "order"
              ? ({ kind: "order", value: answer.value } as const)
              : ({ kind: "match", value: answer.value } as const);

      const result = await submitAnswer(step.exercise.id, payload, duration, stage);
      setFeedback(result);

      // Een hint of keuze is geen uitkomst: pas als de oefening is opgelost
      // telt hij mee, anders zou één opgave drie keer in de score belanden.
      if (!result.selfAssess && result.stage !== "hint" && result.stage !== "choice") {
        totals.current.xp += result.xp;
        totals.current.total += 1;
        if (result.correct) totals.current.correct += 1;
        setXp((v) => v + result.xp);
        setGraded((v) => v + 1);
        if (result.correct) setCorrect((v) => v + 1);
      }
      setBusy(false);
    } finally {
      inFlight.current = false;
    }
  }, [advance, answer, busy, stage, step]);

  /**
   * Trede 2: de leerder kiest een van de aangeboden vormen.
   *
   * Gaat als trede 2 naar de server, dus goed rekenen levert de laagste XP op en
   * telt voor de planning als een misser. Kiezen uit drie vormen is herkennen,
   * niet oproepen — en dat is precies het verschil dat de planning moet weten.
   */
  const pick = useCallback(
    async (value: string) => {
      if (!step || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        const duration = Date.now() - stepStart.current;
        const result = await submitAnswer(step.exercise.id, { kind: "text", value }, duration, 2);
        setStage(2);
        setFeedback(result);
        totals.current.xp += result.xp;
        totals.current.total += 1;
        if (result.correct) totals.current.correct += 1;
        setXp((v) => v + result.xp);
        setGraded((v) => v + 1);
        if (result.correct) setCorrect((v) => v + 1);
      } finally {
        setBusy(false);
        inFlight.current = false;
      }
    },
    [step],
  );

  const assess = useCallback(
    async (ok: boolean) => {
      if (!step || inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      const duration = Date.now() - stepStart.current;
      const value = answer.kind === "text" ? answer.value : "";
      const result = await selfAssess(step.exercise.id, ok, value, duration);
      totals.current.xp += result.xp;
      totals.current.total += 1;
      if (ok) totals.current.correct += 1;
      setXp((v) => v + result.xp);
      setGraded((v) => v + 1);
      if (ok) setCorrect((v) => v + 1);
      setBusy(false);
      inFlight.current = false;
      advance();
    },
    [advance, answer, step],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || busy || awaitingSelfAssess) return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      e.preventDefault();
      if (escalating) retry();
      else if (feedback) advance();
      else void check();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advance, awaitingSelfAssess, busy, check, escalating, feedback, retry]);

  /* ------------------------------------------------------------ afgerond --- */

  if (finished || !step) {
    const accuracy = graded ? Math.round((correct / graded) * 100) : 0;
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="hero animate-rise px-8 py-11 text-center sm:px-10">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-good-wash">
            <svg width="26" height="26" viewBox="0 0 16 16" aria-hidden className="animate-pop">
              <path
                d="M3 8.4 6.2 11.6 13 4.8"
                fill="none"
                stroke="var(--color-good)"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <p className="text-[11.5px] font-bold uppercase tracking-[0.09em] text-ink-muted">
            {kind === "lesson" ? "Les afgerond" : "Herhaling afgerond"}
          </p>
          <h1 className="hr-text display mt-2.5 text-[38px] text-ink">Bravo!</h1>

          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              { v: `+${xp}`, l: "XP", tone: "text-gold" },
              { v: `${correct}/${graded}`, l: "Goed", tone: "text-ink" },
              { v: `${accuracy}%`, l: "Accuratesse", tone: "text-ink" },
            ].map((s) => (
              <div key={s.l} className="rounded-2xl border border-line bg-surface py-4">
                <p className={`display tabular text-[30px] leading-none ${s.tone}`}>{s.v}</p>
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {s.l}
                </p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-md text-[13.5px] leading-relaxed text-ink-secondary">
            Wat je vandaag goed had, komt op het juiste moment terug — niet morgen
            allemaal tegelijk. Wat misging, komt eerder.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary px-5 py-2.5 text-[14px]">
              Naar overzicht
            </Link>
            <Link href="/voortgang" className="btn btn-ghost px-5 py-2.5 text-[14px]">
              Voortgang bekijken
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- sessie --- */

  const passive = step.exercise.type === "teaching_moment" || step.exercise.type === "reading";
  const canCheck = passive || isAnswered(answer);

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 sm:px-8 sm:py-10">
      <header className="sticky top-16 z-30 -mx-5 mb-8 bg-plane/85 px-5 pb-4 pt-2 backdrop-blur-md sm:-mx-8 sm:px-8 md:top-0 md:pt-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <Link
            href={backHref ?? (kind === "lesson" ? "/lessen" : "/")}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-accent"
          >
            <span aria-hidden>←</span> {title}
          </Link>
          <span className="tabular flex items-center gap-3 text-[12.5px] text-ink-muted">
            <span>
              {index + 1} / {steps.length}
            </span>
            <span className="flex items-center gap-1 font-bold text-gold">
              <Bolt />
              {xp}
            </span>
          </span>
        </div>

        {/* Eén segment per stap. Een doorlopende balk zegt "ergens halverwege";
            segmenten zeggen "nog zes" — dat is wat je tijdens een sessie wilt weten. */}
        <div className="flex gap-[3px]">
          {steps.map((s, i) => (
            <span
              key={s.exercise.id}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
                i < index ? "bg-accent" : i === index ? "bg-accent-bright" : "bg-line"
              }`}
            />
          ))}
        </div>
      </header>

      <div key={step.exercise.id} className="animate-rise">
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`pill uppercase ${step.badge ? "bg-accent-wash text-accent" : REASON_STYLE[step.reason]}`}
            >
              {step.badge?.label ?? step.reason}
            </span>
            <span className="text-[12px] text-ink-muted">{step.sectionTitle}</span>
          </div>
          {step.badge?.hint ? (
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">{step.badge.hint}</p>
          ) : null}
        </div>

        {!passive ? (
          <h2 className="mb-5 text-[17px] font-bold leading-snug text-ink">
            {step.exercise.prompt_nl}
          </h2>
        ) : null}

        <ExerciseView
          exercise={step.exercise}
          answer={answer}
          setAnswer={setAnswer}
          locked={Boolean(feedback) && !escalating}
          tts={tts}
        />

        {feedback ? <FeedbackPanel feedback={feedback} onAssess={assess} onPick={pick} busy={busy} /> : null}

        <div className="mt-7 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={advance}
            className="text-[13px] font-medium text-ink-muted transition-colors hover:text-ink-secondary"
          >
            Overslaan
          </button>

          {!awaitingSelfAssess ? (
            <button
              type="button"
              disabled={busy || (!feedback && !canCheck)}
              onClick={() => (escalating ? retry() : feedback ? advance() : void check())}
              className="btn btn-primary px-7 py-3 text-[14.5px]"
            >
              {escalating
                ? "Nog een poging"
                : feedback
                ? isLast
                  ? "Afronden"
                  : "Verder"
                : step.exercise.type === "teaching_moment"
                  ? "Begrepen"
                  : step.exercise.type === "reading"
                    ? "Verder"
                    : "Nakijken"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeedbackPanel({
  feedback,
  onAssess,
  onPick,
  busy,
}: {
  feedback: Feedback;
  onAssess: (ok: boolean) => void;
  /** Trede 2: de leerder kiest een van de aangeboden vormen. */
  onPick?: (value: string) => void;
  busy: boolean;
}) {
  if (feedback.selfAssess) {
    return (
      <div className="animate-rise mt-6 rounded-card border border-line bg-sunken px-5 py-5">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          Modelantwoord
        </p>
        <p className="hr-text reading mt-2 text-[18px] text-ink">
          {feedback.selfAssess.model_answer}
        </p>
        {feedback.selfAssess.rubric_nl?.length ? (
          <ul className="mt-3 space-y-1 text-[12.5px] text-ink-secondary">
            {feedback.selfAssess.rubric_nl.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">
          Voldeed jouw antwoord hieraan? Wees streng — dit oordeel bepaalt wanneer dit
          terugkomt.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAssess(true)}
            className="btn btn-primary px-5 py-2.5 text-[14px] disabled:opacity-50"
          >
            Dat had ik
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAssess(false)}
            className="btn btn-ghost px-5 py-2.5 text-[14px] hover:border-bad hover:bg-bad-wash hover:text-bad-ink disabled:opacity-50"
          >
            Nog niet
          </button>
        </div>
      </div>
    );
  }

  /**
   * Trede 1 en 2: wél zeggen dat het mis is, niet wát het moest zijn.
   *
   * Bewust in de gouden tint en niet in de rode: dit is geen eindoordeel maar
   * een tussenstap. Rood zegt "fout, klaar"; goud zegt "bijna, kijk nog eens" —
   * en dat is precies wat er aan de hand is zolang je nog een poging krijgt.
   */
  if (feedback.stage === "hint" || feedback.stage === "choice") {
    return (
      <div className="animate-rise mt-6 rounded-card bg-gold-wash px-5 py-5">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold-bright text-[13px] font-bold text-white"
            aria-hidden
          >
            ?
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-bold text-gold">{feedback.message}</p>
            {feedback.hint ? (
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                {feedback.hint}
              </p>
            ) : null}

            {feedback.stage === "choice" && feedback.options?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {feedback.options.map((optie) => (
                  <button
                    key={optie}
                    type="button"
                    disabled={busy}
                    onClick={() => onPick?.(optie)}
                    className="hr-text btn btn-ghost px-4 py-2 text-[15px] font-semibold hover:border-accent hover:bg-accent-wash hover:text-accent disabled:opacity-50"
                  >
                    {optie}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  const tone = feedback.correct
    ? feedback.nearMiss
      ? "bg-gold-wash"
      : "bg-good-wash"
    : "bg-bad-wash";
  const textTone = feedback.correct
    ? feedback.nearMiss
      ? "text-gold"
      : "text-good-ink"
    : "text-bad-ink";
  const badge = feedback.correct
    ? feedback.nearMiss
      ? "bg-gold-bright"
      : "bg-good"
    : "bg-bad";

  return (
    <div
      className={`mt-6 rounded-card px-5 py-5 ${tone} ${feedback.correct ? "animate-rise" : "animate-shake"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${badge}`}
          aria-hidden
        >
          {feedback.correct ? (
            feedback.nearMiss ? (
              <span className="text-[13px] font-bold">!</span>
            ) : (
              <svg width="13" height="13" viewBox="0 0 16 16">
                <path
                  d="M3 8.4 6.2 11.6 13 4.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )
          ) : (
            <span className="text-[13px] font-bold">✕</span>
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={`text-[14.5px] font-bold ${textTone}`}>{feedback.message}</p>
            <span
              className={`tabular flex shrink-0 items-center gap-1 text-[12px] font-bold ${textTone}`}
            >
              <Bolt />+{feedback.xp}
            </span>
          </div>

          {!feedback.correct || feedback.nearMiss ? (
            <p className="hr-text mt-2 text-[16px] font-semibold text-ink">
              <span className="font-normal text-ink-muted">Juist: </span>
              {feedback.expected}
            </p>
          ) : null}

          {feedback.explain_nl ? (
            <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
              {feedback.explain_nl}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
