"use server";
import { antwoordtijd, tekst as begrensTekst } from "@/lib/valideer";
import { type Exercise } from "@/lib/content";
import { gradeText, xpFor } from "@/lib/grading";
import { applyReview, dueCards, newCards, ratingFor } from "@/lib/srs";
import { type StageQuestion, checkLeech, promoteIfReady, questionFor, restore } from "@/lib/stages";
import { addXp, bumpStreak, record } from "@/lib/leerlogboek";

/**
 * De woordenschatsessie: herhalingen eerst, dan een gedoseerde portie nieuw.
 *
 * De cap op nieuw materiaal is geen versiering. §8 noemt overbelasting de
 * belangrijkste reden dat SRS-systemen sneuvelen: zonder rem groeit de
 * herhaalschuld sneller dan je hem inloopt, en dan stopt iemand ermee. Daarom
 * krijgen herhalingen voorrang en staat er een dagplafond op nieuw.
 */
export async function vocabQueue(
  limit = 20,
  nieuwPerDag = 8,
): Promise<{ questions: StageQuestion[]; due: number; nieuw: number }> {
  const vervallen = dueCards(new Date(), limit);
  const ruimte = Math.max(0, limit - vervallen.length);
  const verse = ruimte > 0 ? newCards(Math.min(ruimte, nieuwPerDag)) : [];

  const questions: StageQuestion[] = [];
  for (const kaart of [...vervallen, ...verse]) {
    const vraag = questionFor(kaart.cardId);
    // Een kaart zonder vraag hoort niet in de sessie. Dat kan gebeuren bij een
    // clozekaart waarvan de bronzin uit de content is verdwenen.
    if (vraag) questions.push(vraag);
  }

  return { questions, due: vervallen.length, nieuw: verse.length };
}

export interface VocabFeedback {
  correct: boolean;
  nearMiss: boolean;
  message: string;
  expected: string;
  xp: number;
  /** Naar welk stadium dit woord is doorgeschoven, als dat gebeurde. */
  promoted?: string;
  /** Waar is dit woord uit de rotatie gehaald wegens te veel missers. */
  leech?: boolean;
}

export async function submitVocab(
  cardId: number,
  answer: string,
  durationMs: number,
): Promise<VocabFeedback> {
  durationMs = antwoordtijd(durationMs);
  answer = begrensTekst(answer, 500);
  const vraag = questionFor(cardId);
  if (!vraag) throw new Error(`Onbekende kaart: ${cardId}`);

  const fake = {
    id: `vocab.${cardId}`,
    type: "cloze",
    prompt_nl: vraag.prompt,
    answer: vraag.answer,
    accepts: vraag.accepts,
    mode: vraag.mode,
    difficulty: 1,
  } as Exercise;

  const result = gradeText(fake, answer);
  const xp = xpFor(fake, result);

  record(
    fake.id,
    0,
    `vocab_${vraag.kind.toLowerCase()}`,
    vraag.mode,
    result,
    answer,
    durationMs,
    xp,
    [vraag.itemId],
  );

  const rating = ratingFor(result, fake, durationMs, `vocab_${vraag.kind.toLowerCase()}`);
  applyReview(cardId, rating, durationMs);

  // Volgorde telt: eerst kijken of dit een leech werd, want een geschorste kaart
  // hoort niet ook nog gepromoveerd te worden.
  const leech = checkLeech(cardId);
  const promoted = leech ? null : promoteIfReady(cardId);

  bumpStreak();
  addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    message: result.message,
    expected: vraag.answer,
    xp,
    promoted: promoted ?? undefined,
    leech: leech || undefined,
  };
}

/** Een woord dat uit de rotatie was, terugzetten met een schone lei. */
export async function restoreLeech(cardId: number): Promise<void> {
  restore(cardId);
}
