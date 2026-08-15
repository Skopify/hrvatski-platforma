import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { loadStory } from "@/lib/content";
import { present } from "@/lib/present";

export const dynamic = "force-dynamic";

/**
 * De vragen bij een verhaal lopen door dezelfde SessionRunner als lessen en
 * herhaling: zelfde beoordeling, zelfde XP, zelfde SRS-koppeling. Een verhaal
 * is geen apart eiland — wat je hier fout doet, komt in de herhaling terug.
 */
export default async function StoryQuizPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = loadStory(slug);
  if (!story || story.exercises.length === 0) notFound();

  const steps: Step[] = story.exercises.map((e) => ({
    exercise: present(e),
    lessonNumber: story.requires_lesson,
    sectionTitle: story.title_hr,
    reason: "oefening",
  }));

  return (
    <SessionRunner
      steps={steps}
      kind="review"
      lessonNumber={null}
      title={story.title_hr}
      storySlug={story.slug}
      backHref={`/verhalen/${story.slug}`}
    />
  );
}
