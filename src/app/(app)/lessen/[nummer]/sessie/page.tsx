import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { loadLesson } from "@/lib/content";
import { planLesson } from "@/lib/planner";
import { present } from "@/lib/present";
import { stepsDoneIn } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function LessonSessionPage({
  params,
}: {
  params: Promise<{ nummer: string }>;
}) {
  const { nummer } = await params;
  const lessonNumber = Number(nummer);
  const lesson = loadLesson(lessonNumber);
  if (!lesson) notFound();

  const planned = planLesson(lessonNumber);

  // Verdergaan waar je gebleven was. De stappen die je al gehad hebt vallen
  // eruit; de volgorde van de rest blijft staan.
  const done = stepsDoneIn(lessonNumber);
  const remaining = done.size ? planned.filter((s) => !done.has(s.exercise.id)) : planned;

  // Was alles al gehad zonder dat de les is afgerond — je sloot het tabblad op
  // de laatste vraag — dan is een lege sessie het slechtste antwoord. Dan maar
  // de hele les opnieuw.
  const steps: Step[] = (remaining.length ? remaining : planned).map((s) => ({
    exercise: present(s.exercise),
    lessonNumber: s.lessonNumber,
    sectionTitle: s.sectionTitle,
    reason: s.reason,
  }));

  return (
    <SessionRunner
      steps={steps}
      kind="lesson"
      lessonNumber={lessonNumber}
      title={`Les ${lesson.number} · ${lesson.title_hr}`}
    />
  );
}
