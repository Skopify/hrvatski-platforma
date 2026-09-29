import Link from "next/link";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { planReview } from "@/lib/planner";
import { present } from "@/lib/present";
import { nextDueAt } from "@/lib/srs";

export const dynamic = "force-dynamic";

/**
 * De herhaalsessie zelf. Bewust een eigen route en niet de oefenpagina: anders
 * verdwijnt alles ánders (de drills) achter een sessie die je niet gevraagd had.
 */
export default function ReviewSessionPage() {
  const steps: Step[] = planReview(20).map((s) => ({
    exercise: present(s.exercise),
    lessonNumber: s.lessonNumber,
    sectionTitle: s.sectionTitle,
    reason: s.reason,
  }));

  if (steps.length === 0) {
    const next = nextDueAt();
    return (
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="card animate-rise px-8 py-12 text-center sm:px-10">
          <h1 className="display text-[30px] text-ink">Niets te herhalen</h1>
          <p className="mx-auto mt-3 max-w-md text-[14px] leading-relaxed text-ink-secondary">
            {next
              ? "Het eerstvolgende item staat nog op de planning. Eerder herhalen levert nauwelijks iets op en kost wel tijd."
              : "Er staat niets op de planning. Begin een les of lees een verhaal."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/oefenen" className="btn btn-primary px-5 py-2.5 text-[14px]">
              Naar de drills
            </Link>
            <Link href="/lessen" className="btn btn-ghost px-5 py-2.5 text-[14px]">
              Naar de lessen
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SessionRunner
      steps={steps}
      kind="review"
      lessonNumber={null}
      title="Oefenen"
      backHref="/oefenen"
    />
  );
}
