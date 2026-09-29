import Link from "next/link";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { findExercise } from "@/lib/content";
import { present } from "@/lib/present";
import { mistakeExerciseIds } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Je fouten opnieuw doen.
 *
 * Bewust alleen de échte oefeningen, geen drills: een drillvraag is één willekeurig
 * woord uit een grote bak en komt vanzelf terug. Een lesoefening die je fout had is
 * een specifiek ding dat je nog niet kunt, en die verdient een tweede ronde.
 */
export default function PractiseMistakesPage() {
  const ids = mistakeExerciseIds(20);
  const steps: Step[] = ids.flatMap((id) => {
    const found = findExercise(id);
    if (!found) return [];
    return [
      {
        exercise: present(found.exercise),
        lessonNumber: found.lesson.number,
        sectionTitle: "Eerder fout",
        reason: "herhaling" as const,
      },
    ];
  });

  if (steps.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="card animate-rise px-8 py-12 text-center sm:px-10">
          <h1 className="display text-[30px] text-ink">Niets om over te doen</h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-secondary">
            Er staan geen foute lesoefeningen open. Drillfouten staan hier niet bij: die
            komen vanzelf terug in de drill zelf.
          </p>
          <Link href="/fouten" className="btn btn-primary mt-8 px-5 py-2.5 text-[14px]">
            Terug naar je fouten
          </Link>
        </div>
      </div>
    );
  }

  return (
    <SessionRunner
      steps={steps}
      kind="review"
      lessonNumber={null}
      title="Fouten"
      backHref="/fouten"
    />
  );
}
