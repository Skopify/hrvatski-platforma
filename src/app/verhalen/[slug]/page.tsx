import { notFound } from "next/navigation";

import { StoryHeader, StoryReader } from "@/components/StoryReader";
import { loadStory, storyMinutes, storyWordCount } from "@/lib/content";
import { Page } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = loadStory(slug);
  if (!story) notFound();

  // De vragen gaan niet mee naar de browser: antwoorden blijven op de server.
  // De lezer krijgt alleen de aantallen, voor de knoppen na afloop.
  const clientStory = { ...story, exercises: [], comprehension: [] };

  return (
    <Page width="focus">
      <StoryHeader story={story} minutes={storyMinutes(story)} words={storyWordCount(story)} />
      <StoryReader
        story={clientStory}
        comprehensionCount={story.comprehension?.length ?? 0}
        exerciseCount={story.exercises.length}
      />
    </Page>
  );
}
