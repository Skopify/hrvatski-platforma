"use server";
import { eq, sql } from "drizzle-orm";
import { loadStory } from "@/lib/content";
import { recordStoryEncounters } from "@/lib/coverage";
import { db } from "@/lib/db";
import { card, items, srs, storyProgress } from "@/lib/db/schema";
import { ensureCards } from "@/lib/srs";
import { addXp, bumpStreak, record } from "@/lib/leerlogboek";

/**
 * Een opgezocht woord in de herhaling zetten.
 *
 * Dit is bewust een aparte handeling en geen bijwerking van het aantikken: een
 * woord waar je even naar kijkt is iets anders dan een woord dat je wilt leren.
 * Pas als je hier op drukt, krijgt het een FSRS-kaart.
 */
export async function collectWord(slug: string, itemId: string): Promise<{ added: boolean }> {
  const exists = db.select({ id: items.id }).from(items).where(eq(items.id, itemId)).get();
  if (!exists) return { added: false };

  // Had dit woord al een kaart? Zo ja, dan is het geen nieuwe aanwinst maar een
  // woord dat je nog eens opzoekt — dat verdient geen "toegevoegd"-melding.
  const already = db
    .select({ id: card.id })
    .from(card)
    .innerJoin(srs, eq(srs.cardId, card.id))
    .where(eq(card.itemId, itemId))
    .get();
  ensureCards([itemId]);

  db.insert(storyProgress)
    .values({ slug, lookups: 1 })
    .onConflictDoUpdate({
      target: storyProgress.slug,
      set: { lookups: sql`${storyProgress.lookups} + 1` },
    })
    .run();

  return { added: !already };
}

/**
 * Een verhaal als gelezen markeren. Levert eenmalig XP op — lezen is werk, maar
 * hetzelfde verhaal tien keer openen is dat niet.
 */
export async function markStoryRead(
  slug: string,
): Promise<{ xp: number; first: boolean; encountered: number }> {
  const row = db.select().from(storyProgress).where(eq(storyProgress.slug, slug)).get();
  const first = !row?.readAt;

  db.insert(storyProgress)
    .values({ slug, readAt: Date.now() })
    .onConflictDoUpdate({ target: storyProgress.slug, set: { readAt: Date.now() } })
    .run();

  // Elke keer lezen is één blootstelling — ook een herlezing telt, want juist
  // herhaald tegenkomen is wat een woord laat beklijven.
  const story = loadStory(slug);
  const encountered = story ? recordStoryEncounters(story) : 0;

  if (!first) return { xp: 0, first: false, encountered };

  const xp = 20;
  record(
    `story:${slug}`,
    0,
    "story_read",
    "receptive",
    { correct: true, nearMiss: false, verdict: "exact", expected: "", diffPositions: [], message: "" },
    "",
    0,
    xp,
    [],
  );
  bumpStreak();
  addXp(xp);
  return { xp, first: true, encountered };
}

export async function markStoryQuizDone(slug: string): Promise<void> {
  db.insert(storyProgress)
    .values({ slug, quizDoneAt: Date.now() })
    .onConflictDoUpdate({ target: storyProgress.slug, set: { quizDoneAt: Date.now() } })
    .run();
}
