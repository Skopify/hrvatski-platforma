"use client";

import { useEffect, useRef } from "react";

/*
  De voortgang van een sessie als één dikke pill in stukjes: één stukje per
  opgave. Is een opgave klaar, dan vult haar stukje zich van links in de kleur
  van de uitkomst — mint (goed), geel (bijna), roze (fout) — en de hele pill
  geeft even mee als gel. Een doorlopende balk zegt "ergens halverwege";
  stukjes zeggen "nog zes, en zo ging het tot nu toe".

  Het meegeven is de bevestiging dat het antwoord aankwam. Het duurt een half
  seconde en blokkeert niets: de volgende vraag staat er al.
*/

export type StepOutcome = "ok" | "near" | "no";
export type StepState = StepOutcome | "done" | "current" | "todo";

export function outcomeOf(correct: boolean, nearMiss?: boolean): StepOutcome {
  return correct ? (nearMiss ? "near" : "ok") : "no";
}

const FILL: Record<StepState, string> = {
  ok: "bg-pop-mint",
  near: "bg-pop-yellow",
  no: "bg-pop-pink",
  done: "bg-pop-sky",
  current: "bg-transparent",
  todo: "bg-transparent",
};

const LABEL: Record<StepState, string> = {
  ok: "goed",
  near: "bijna goed",
  no: "fout",
  done: "gedaan",
  current: "nu",
  todo: "nog te doen",
};

export function StepTiles({ steps }: { steps: StepState[] }) {
  const track = useRef<HTMLDivElement>(null);
  const done = steps.filter((s) => s !== "todo" && s !== "current").length;
  const before = useRef(done);

  // Gel: alleen als er iets bijkomt, en met WAAPI zodat een tweede antwoord
  // vlak na het eerste het gewoon opnieuw start in plaats van te haperen.
  useEffect(() => {
    if (done > before.current && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      track.current?.animate(
        [
          { transform: "scale(1, 1)" },
          { transform: "scale(1.04, 0.86)", offset: 0.25 },
          { transform: "scale(0.985, 1.1)", offset: 0.5 },
          { transform: "scale(1.01, 0.98)", offset: 0.75 },
          { transform: "scale(1, 1)" },
        ],
        { duration: 520, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
      );
    }
    before.current = done;
  }, [done]);

  return (
    <div
      ref={track}
      className="pill-track flex h-[22px]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={steps.length}
      aria-valuenow={done}
      aria-label="Voortgang van de sessie"
    >
      {steps.map((s, i) => (
        <span
          key={i}
          title={`Opgave ${i + 1}: ${LABEL[s]}`}
          className="relative flex-1 overflow-hidden border-r-2 border-outline last:border-r-0"
        >
          <span
            data-on={s !== "todo" && s !== "current"}
            className={`step-fill absolute inset-0 ${FILL[s]}`}
          />
          {s === "current" ? (
            <span
              aria-hidden
              className="absolute left-1/2 top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-outline"
            />
          ) : null}
        </span>
      ))}
    </div>
  );
}
