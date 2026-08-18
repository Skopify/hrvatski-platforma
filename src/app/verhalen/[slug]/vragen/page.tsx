import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { asExercise, loadStory, SKILL_HINT, SKILL_LABEL } from "@/lib/content";
import { present } from "@/lib/present";

export const dynamic = "force-dynamic";

/**
 * De vragen bij een verhaal — begrijpend lezen en taal in één doorloop.
 *
 * Dit waren twee losse knoppen, en dat werkte tegen zichzelf. Je kon de
 * taaloefeningen doen en het verhaal stond op «af» terwijl je de leesvragen had
 * overgeslagen; deed je alleen de leesvragen, dan stond er nooit iets. Erger dan
 * de boekhouding is wat het met de volgorde deed: begrijpen hoort vóór vormen.
 * Eerst kijk je wat er staat en wat je eruit kunt afleiden, en pas daarna waaróm
 * het zo geschreven is.
 *
 * Dus één rij: eerst de leesvragen, met bij elke vraag welke vaardigheid hij van
 * je vraagt — dat onderscheid zien is bij begrijpend lezen het halve werk — en
 * daarna de taaloefeningen. Afgerond ben je pas aan het eind.
 */
export default async function StoryQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = loadStory(slug);
  if (!story) notFound();

  const lezen: Step[] = (story.comprehension ?? []).map((q) => ({
    exercise: present(asExercise(q)),
    lessonNumber: story.requires_lesson,
    sectionTitle: story.title_hr,
    reason: "oefening",
    badge: { label: SKILL_LABEL[q.skill], hint: SKILL_HINT[q.skill] },
  }));

  const taal: Step[] = story.exercises.map((e) => ({
    exercise: present(e),
    lessonNumber: story.requires_lesson,
    sectionTitle: story.title_hr,
    reason: "oefening",
    badge: { label: "Taal", hint: "Nu naar de vormen: waaróm staat het er zo?" },
  }));

  const steps = [...lezen, ...taal];
  if (!steps.length) notFound();

  return (
    <SessionRunner
      steps={steps}
      kind="review"
      lessonNumber={null}
      title={story.title_hr}
      storySlug={story.slug}
      backHref={`/verhalen/${story.slug}`}
      doneLabel="Verhaal afgerond"
    />
  );
}
