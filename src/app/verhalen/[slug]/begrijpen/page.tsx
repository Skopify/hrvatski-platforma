import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { asExercise, loadStory, SKILL_HINT, SKILL_LABEL } from "@/lib/content";
import { present } from "@/lib/present";

export const dynamic = "force-dynamic";

/**
 * Begrijpend lezen.
 *
 * Dezelfde motor als de rest, maar met één verschil dat er echt toe doet: bij
 * elke vraag staat wélke leesvaardigheid gevraagd wordt. Dat is precies wat het
 * Nederlandse begrijpend lezen aanleert — een verwijswoordvraag los je anders op
 * dan een hoofdgedachtevraag, en dat onderscheid zien is het halve werk.
 */
export default async function ComprehensionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const story = loadStory(slug);
  if (!story || !story.comprehension?.length) notFound();

  const steps: Step[] = story.comprehension.map((q) => ({
    exercise: present(asExercise(q)),
    lessonNumber: story.requires_lesson,
    sectionTitle: story.title_hr,
    reason: "oefening",
    badge: { label: SKILL_LABEL[q.skill], hint: SKILL_HINT[q.skill] },
  }));

  return (
    <SessionRunner
      steps={steps}
      kind="review"
      lessonNumber={null}
      title={story.title_hr}
      backHref={`/verhalen/${story.slug}`}
    />
  );
}
