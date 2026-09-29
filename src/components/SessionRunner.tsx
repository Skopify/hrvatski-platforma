"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { acknowledgeTeaching, selfAssess, submitAnswer } from "@/app/actions/oefenen";
import { completeLesson, endSession, markStepDone, startSession } from "@/app/actions/les";
import { completeModule, markModuleStepDone } from "@/app/actions/modules";
import { markStoryQuizDone } from "@/app/actions/verhalen";
import { type Feedback } from "@/lib/leerlogboek";
import type { PresentedExercise } from "@/lib/present";
import { useCroatianTts } from "@/lib/tts";
import { Answer, ExerciseView, emptyAnswer, isAnswered } from "./ExerciseView";
import { Doodle, Sparkle, Squiggle } from "./doodles";
import { StepTiles, outcomeOf, type StepOutcome } from "./ui";
import { XpChip } from "./XpChip";

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
  introductie: "bg-pop-sky text-on-pop",
  oefening: "bg-surface text-ink",
  herhaling: "bg-pop-yellow text-on-pop",
};

export function SessionRunner({
  steps,
  kind,
  lessonNumber,
  title,
  storySlug,
  moduleCode,
  backHref,
  doneLabel,
}: {
  steps: Step[];
  kind: "lesson" | "review";
  lessonNumber: number | null;
  title: string;
  /**
   * Bij een grammaticamodule: waar de voortgang naartoe gaat. Zonder deze
   * onthoudt de sessie niets en begin je na het sluiten van het tabblad weer
   * vooraan — de bug die modules ononderbroken uitzitten verplicht maakte.
   */
  moduleCode?: string;
  /** Bij een verhaalquiz: markeert de quiz als afgerond bij het einde. */
  storySlug?: string;
  backHref?: string;
  /** Wat er op het eindscherm staat. Standaard hangt het af van `kind`. */
  doneLabel?: string;
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
  /** Uitkomst per opgave, voor de tegels bovenaan: welke kleur kantelt er om. */
  const [outcomes, setOutcomes] = useState<Record<string, StepOutcome>>({});
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
    if (moduleCode) {
      await completeModule(moduleCode);
    }
    if (storySlug) {
      await markStoryQuizDone(storySlug);
    }
    router.refresh();
  }, [kind, lessonNumber, moduleCode, router, storySlug]);

  const advance = useCallback(() => {
    setFeedback(null);
    setStage(0);
    // Vastleggen dat deze stap gehad is, vóór het doorschakelen. Sluit je nu
    // het tabblad, dan pakt "Les hervatten" hier weer op.
    if (kind === "lesson" && lessonNumber !== null && step) {
      void markStepDone(lessonNumber, step.exercise.id);
    }
    if (moduleCode && step) {
      void markModuleStepDone(moduleCode, step.exercise.id);
    }
    if (isLast) {
      void finish();
      return;
    }
    const next = index + 1;
    setIndex(next);
    setAnswer(emptyAnswer(steps[next].exercise));
  }, [finish, index, isLast, kind, lessonNumber, moduleCode, step, steps]);

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
        setOutcomes((o) => ({ ...o, [step.exercise.id]: outcomeOf(result.correct, result.nearMiss) }));
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
        setOutcomes((o) => ({ ...o, [step.exercise.id]: outcomeOf(result.correct, result.nearMiss) }));
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
      setOutcomes((o) => ({ ...o, [step.exercise.id]: ok ? "ok" : "no" }));
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
        <div className="hero animate-pop relative px-8 py-11 text-center sm:px-10">
          <Sparkle size={26} className="absolute left-8 top-8 -rotate-12" color="var(--color-pop-pink)" />
          <Sparkle size={34} className="absolute right-9 top-10 rotate-12" color="var(--color-pop-yellow)" />
          <Sparkle size={16} className="absolute right-24 top-24" color="var(--color-pop-sky)" />
          <div className="animate-sticker mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <Doodle name="star" size={80} color="var(--color-pop-yellow)" stroke={1.7} />
          </div>

          <p className="hand text-[16px] font-bold text-ink-muted">
            {doneLabel ?? (kind === "lesson" ? "Les afgerond" : "Herhaling afgerond")}
          </p>
          <h1 className="hr-text display mt-1 text-[52px] text-ink">
            <span className="relative inline-block pb-3">
              Bravo!
              <Squiggle slow color="var(--color-ring)" className="absolute -bottom-0.5 left-0 h-[14px] w-full" />
            </span>
          </h1>

          <div className="mt-9 grid grid-cols-3 gap-3">
            {[
              { v: `+${xp}`, l: "XP", bg: "bg-pop-yellow", r: "-rotate-2" },
              { v: `${correct}/${graded}`, l: "Goed", bg: "bg-pop-mint", r: "rotate-1" },
              { v: `${accuracy}%`, l: "Accuratesse", bg: "bg-pop-sky", r: "-rotate-1" },
            ].map((s) => (
              <div
                key={s.l}
                className={`rounded-2xl border-2 border-outline py-4 text-on-pop shadow-[3px_3px_0_var(--color-outline)] ${s.bg} ${s.r}`}
              >
                <p className="num text-[32px] leading-none">{s.v}</p>
                <p className="hand mt-2 text-[13px] font-bold">{s.l}</p>
              </div>
            ))}
          </div>

          <p className="mx-auto mt-8 max-w-md text-[13.5px] leading-relaxed text-ink-secondary">
            Wat je vandaag goed had, komt op het juiste moment terug — niet morgen
            allemaal tegelijk. Wat misging, komt eerder.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/" className="btn btn-primary h-11 px-6 text-[15px]">
              Naar overzicht
            </Link>
            <Link href="/voortgang" className="btn btn-ghost h-11 px-6 text-[15px]">
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
      <header className="sticky top-0 z-30 -mx-5 mb-8 border-b-2 border-dashed border-line-strong bg-plane px-5 pb-4 pt-3 sm:-mx-8 sm:px-8 md:pt-4">
        <div className="mb-3 flex items-center justify-between gap-4">
          <Link
            href={backHref ?? (kind === "lesson" ? "/lessen" : "/")}
            className="hand inline-flex min-w-0 items-center gap-1.5 text-[14px] font-bold text-ink-secondary transition-colors hover:text-accent"
          >
            <span aria-hidden>←</span> <span className="truncate">{title}</span>
          </Link>
          <span className="flex shrink-0 items-center gap-3">
            <span className="hand text-[14px] font-bold text-ink-secondary tabular-nums">
              {index + 1} / {steps.length}
            </span>
            <XpChip xp={xp} />
          </span>
        </div>

        {/* Eén stukje per stap. Een doorlopende balk zegt "ergens halverwege";
            stukjes zeggen "nog zes" — dat is wat je tijdens een sessie wilt weten. */}
        <StepTiles
          steps={steps.map((s, i) =>
            outcomes[s.exercise.id] ?? (i < index ? "done" : i === index ? "current" : "todo"),
          )}
        />
      </header>

      <div key={step.exercise.id}>
        <div className="mb-4">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`pill ${step.badge ? "bg-pop-lilac text-on-pop" : REASON_STYLE[step.reason]}`}
            >
              {step.badge?.label ?? step.reason}
            </span>
            <span className="hand text-[13px] font-semibold text-ink-muted">{step.sectionTitle}</span>
          </div>
          {step.badge?.hint ? (
            <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{step.badge.hint}</p>
          ) : null}
        </div>

        {!passive ? (
          <h2 className="display-soft mb-5 text-[24px] leading-snug text-ink">
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
            className="hand text-[14px] font-bold text-ink-muted transition-colors hover:text-ink"
          >
            Overslaan
          </button>

          {!awaitingSelfAssess ? (
            <button
              type="button"
              disabled={busy || (!feedback && !canCheck)}
              onClick={() => (escalating ? retry() : feedback ? advance() : void check())}
              className="btn btn-primary h-12 px-8 text-[16px]"
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

/**
 * Wat het programma zelf heeft vastgesteld.
 *
 * Elk punt staat er met zijn bevinding bij — «gevonden: prst» in plaats van
 * alleen een vinkje. Zonder die bevinding is een vinkje een bewering, en dan kun
 * je niet zien of het over jouw zin gaat of over iets anders.
 */
function CheckLijst({ report }: { report?: import("@/lib/leerlogboek").Feedback["report"] }) {
  if (!report || (!report.checks.length && !report.suggesties.length)) return null;
  return (
    <div className="mb-4">
      {report.checks.length ? (
        <>
          <p className="text-[12px] font-bold uppercase tracking-[0.07em] text-ink-muted">
            Nagekeken
          </p>
          <ul className="mt-2 space-y-1.5">
            {report.checks.map((c) => (
              <li key={c.label} className="flex gap-2 text-[13px] leading-snug">
                <span
                  aria-hidden
                  className={`mt-[3px] shrink-0 font-bold ${c.ok ? "text-good" : "text-bad-ink"}`}
                >
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className="text-ink-secondary">
                  {c.label}
                  <span className="text-ink-muted"> — {c.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {report.suggesties.length ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
          Bedoelde je{" "}
          {report.suggesties.map((s, i) => (
            <span key={s.geschreven}>
              {i > 0 ? ", " : ""}
              <span className="hr-text font-semibold text-ink-secondary">{s.bedoeld}</span> in plaats
              van <span className="hr-text">{s.geschreven}</span>
            </span>
          ))}
          ? Dat scheelt één teken.
        </p>
      ) : null}
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
      <div className="animate-rise mt-6 rounded-card border-2 border-outline bg-surface px-5 py-5 shadow-[var(--hard)]">
        <CheckLijst report={feedback.report} />
        <p className="eyebrow">Modelantwoord</p>
        <p className="hr-text reading mt-2 text-[18px] text-ink">
          {feedback.selfAssess.model_answer}
        </p>
        {feedback.selfAssess.rubric_nl?.length ? (
          <ul className="mt-3 space-y-1 text-[13px] text-ink-secondary">
            {feedback.selfAssess.rubric_nl.map((r) => (
              <li key={r}>· {r}</li>
            ))}
          </ul>
        ) : null}
        <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">
          {feedback.report?.checks.length
            ? "De rest gaat over of het een goede zin is, en dat beoordeel jij. Wees streng — dit oordeel bepaalt wanneer dit terugkomt."
            : "Voldeed jouw antwoord hieraan? Wees streng — dit oordeel bepaalt wanneer dit terugkomt."}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAssess(true)}
            className="btn btn-primary h-11 px-6 text-[15px] disabled:opacity-50"
          >
            Dat had ik
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAssess(false)}
            className="btn btn-ghost h-11 px-6 text-[15px] disabled:opacity-50"
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
      <div className="animate-rise mt-6 rounded-card border-2 border-outline bg-pop-yellow px-5 py-5 text-on-pop shadow-[var(--hard)]">
        <div className="flex items-start gap-3">
          <Doodle name="question" size={30} color="#ffffff" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold">{feedback.message}</p>
            {feedback.hint ? (
              <p className="mt-2 text-[14.5px] font-medium leading-relaxed">{feedback.hint}</p>
            ) : null}

            {feedback.stage === "choice" && feedback.options?.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {feedback.options.map((optie) => (
                  <button
                    key={optie}
                    type="button"
                    disabled={busy}
                    onClick={() => onPick?.(optie)}
                    className="hr-text btn btn-ghost h-11 px-5 text-[16px] disabled:opacity-50"
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
      ? "bg-pop-yellow"
      : "bg-pop-mint"
    : "bg-pop-pink";
  const badge = feedback.correct ? (feedback.nearMiss ? "question" : "check") : "cross";

  return (
    <div
      className={`mt-6 rounded-card border-2 border-outline px-5 py-5 text-on-pop shadow-[var(--hard)] ${tone} ${feedback.correct ? "animate-rise" : "animate-shake"}`}
    >
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-outline bg-white"
          aria-hidden
        >
          <Doodle name={badge} size={20} stroke={2.6} color="transparent" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[16px] font-extrabold">{feedback.message}</p>
            {/* De XP-sticker: springt binnen met een kleine overshoot en blijft liggen. */}
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

          <div className="mt-3">
            <CheckLijst report={feedback.report} />
          </div>
          {feedback.explain_nl ? (
            <p className="mt-2.5 text-[14px] font-medium leading-relaxed">
              {feedback.explain_nl}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
