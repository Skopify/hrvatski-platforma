import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { loadLesson } from "@/lib/content";
import { planLesson } from "@/lib/planner";
import { present } from "@/lib/present";

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

  const steps: Step[] = planLesson(lessonNumber).map((s) => ({
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
