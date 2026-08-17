import { inArray } from "drizzle-orm";

import {
  caseOf,
  lessonExercises,
  loadLesson,
  loadLessons,
  loadStories,
  type Exercise,
  type Lesson,
  type Section,
} from "./content";
import { db } from "./db";
import { items } from "./db/schema";
import { dueItemIds, upcomingCards } from "./srs";

export interface PlannedStep {
  exercise: Exercise;
  lessonNumber: number;
  sectionId: string;
  sectionTitle: string;
  /** Waarom deze oefening nu langskomt — zichtbaar voor de leerder. */
  reason: "introductie" | "oefening" | "herhaling";
}

/* ------------------------------------------------------------------ index --- */

let exerciseIndex: Map<string, PlannedStep[]> | null = null;

/** itemId → alle oefeningen die dat item aanspreken, over lessen én verhalen heen. */
function index(): Map<string, PlannedStep[]> {
  if (exerciseIndex) return exerciseIndex;
  const map = new Map<string, PlannedStep[]>();
  const add = (target: string, step: PlannedStep) => {
    const list = map.get(target);
    if (list) list.push(step);
    else map.set(target, [step]);
  };

  for (const lesson of loadLessons()) {
    for (const section of lesson.sections) {
      for (const exercise of section.exercises) {
        if (exercise.type === "teaching_moment" || exercise.type === "reading") continue;
        for (const target of exercise.targets ?? []) {
          add(target, {
            exercise,
            lessonNumber: lesson.number,
            sectionId: section.id,
            sectionTitle: section.title_nl,
            reason: "herhaling",
          });
        }
      }
    }
  }

  // Verhaaloefeningen tellen mee: een woord dat je uit een verhaal hebt bewaard,
  // moet ook een oefening hébben waarmee de herhaling het kan toetsen.
  for (const story of loadStories()) {
    for (const exercise of story.exercises) {
      for (const target of exercise.targets ?? []) {
        add(target, {
          exercise,
          lessonNumber: story.requires_lesson,
          sectionId: story.slug,
          sectionTitle: story.title_hr,
          reason: "herhaling",
        });
      }
    }
  }

  exerciseIndex = map;
  return map;
}

/* ------------------------------------------------------------ interleaving --- */

function topicKey(step: PlannedStep): string {
  const targets = step.exercise.targets ?? [];
  for (const t of targets) {
    const c = caseOf(t);
    if (c) return c;
  }
  return targets[0]?.split(".").slice(0, 2).join(".") ?? step.sectionId;
}

/**
 * Interleaving met een rem erop.
 *
 * Het populaire advies "meng altijd alles door elkaar" is te grof. Geblokt oefenen
 * geeft juist hógere accuratesse tijdens het leren; interleaving wint pas op de
 * uitgestelde toets, en onderzoek uit 2025 laat zien dat zwakkere leerders eerst
 * een geblokte fase nodig hebben om declaratieve kennis op te bouwen.
 *
 * Daarom: nieuwe stof wordt geblokt aangeboden (zie planLesson), en pas de
 * herhaling wordt gemengd. Deze functie zorgt dat opeenvolgende oefeningen zoveel
 * mogelijk van onderwerp wisselen — dat is het discriminative-contrast-effect:
 * je leert een naamval niet door hem tien keer los te oefenen, maar door hem
 * telkens tegen een andere naamval af te moeten zetten.
 */
export function interleave(steps: PlannedStep[]): PlannedStep[] {
  const buckets = new Map<string, PlannedStep[]>();
  for (const s of steps) {
    const k = topicKey(s);
    const b = buckets.get(k);
    if (b) b.push(s);
    else buckets.set(k, [s]);
  }

  const out: PlannedStep[] = [];
  let lastKey: string | null = null;

  while (buckets.size > 0) {
    // Kies telkens de grootste bak die niet dezelfde is als de vorige.
    const entries = [...buckets.entries()].sort((a, b) => b[1].length - a[1].length);
    const pick = entries.find(([k]) => k !== lastKey) ?? entries[0];
    const [key, list] = pick;
    out.push(list.shift()!);
    lastKey = key;
    if (list.length === 0) buckets.delete(key);
  }

  return out;
}

/* --------------------------------------------------------------- planning --- */

function stepsOfSection(lesson: Lesson, section: Section): PlannedStep[] {
  const reason: PlannedStep["reason"] =
    section.kind === "input" || section.kind === "grammar" ? "introductie" : "oefening";

  const steps: PlannedStep[] = section.exercises.map((exercise) => ({
    exercise,
    lessonNumber: lesson.number,
    sectionId: section.id,
    sectionTitle: section.title_nl,
    reason,
  }));

  // Comprehensible input gaat vóór de uitleg: eerst de taal in gebruik zien, dan
  // pas horen hoe hij in elkaar zit. Andersom leer je de regel zonder de zaak.
  if (section.text_hr) {
    steps.unshift({
      exercise: {
        id: `${section.id}.tekst`,
        type: "reading",
        mode: "receptive",
        prompt_nl: section.title_nl,
        given: section.text_hr,
        body_nl: section.translation_nl,
        source: section.source,
        targets: [],
      },
      lessonNumber: lesson.number,
      sectionId: section.id,
      sectionTitle: section.title_nl,
      reason: "introductie",
    });
  }

  return steps;
}

/**
 * Een lessessie: geblokte introductie, daarna gemengde herhaling.
 *
 * De volgorde binnen een les is altijd input → grammatica → oefening → gemengde
 * herhaling. Nieuwe stof komt dus geblokt binnen; de laatste sectie trekt er
 * vervallen items van vroeger doorheen.
 */
export function planLesson(lessonNumber: number, reviewSlots = 6): PlannedStep[] {
  const lesson = loadLesson(lessonNumber);
  if (!lesson) return [];

  const order: Section["kind"][] = ["input", "grammar", "practice", "mixed_review"];
  const sections = [...lesson.sections].sort(
    (a, b) => order.indexOf(a.kind) - order.indexOf(b.kind),
  );

  const steps: PlannedStep[] = [];
  for (const section of sections) {
    if (section.kind === "mixed_review") {
      const own = stepsOfSection(lesson, section);
      const older = dueStepsBefore(lessonNumber, reviewSlots);
      steps.push(...interleave([...own, ...older]));
    } else {
      steps.push(...stepsOfSection(lesson, section));
    }
  }
  return steps;
}

/** Vervallen items uit eerdere lessen, vertaald naar oefeningen. */
function dueStepsBefore(lessonNumber: number, limit: number): PlannedStep[] {
  const due = dueItemIds(new Date(), 200);
  if (!due.length) return [];

  const rows = db
    .select({ id: items.id, lesson: items.lesson })
    .from(items)
    .where(inArray(items.id, due))
    .all();

  const earlier = rows.filter((r) => r.lesson < lessonNumber).map((r) => r.id);
  const idx = index();
  const picked: PlannedStep[] = [];
  const seen = new Set<string>();

  for (const itemId of earlier) {
    for (const step of idx.get(itemId) ?? []) {
      if (seen.has(step.exercise.id)) continue;
      seen.add(step.exercise.id);
      picked.push({ ...step, reason: "herhaling" });
      break;
    }
    if (picked.length >= limit) break;
  }
  return picked;
}

/**
 * Een pure herhaalsessie: alles wat vandaag vervalt, gemengd. Dit is de dagelijkse
 * routine; lessen zijn de uitbreiding.
 */
export function planReview(limit = 20): PlannedStep[] {
  const due = dueItemIds(new Date(), 400);
  const idx = index();
  const picked: PlannedStep[] = [];
  const seen = new Set<string>();

  for (const itemId of due) {
    const candidates = idx.get(itemId) ?? [];
    // Voorkeur voor productieve oefeningen: herkennen is te makkelijk om iets
    // over beheersing te bewijzen.
    const sorted = [...candidates].sort((a, b) => {
      const ap = a.exercise.mode === "productive" ? 0 : 1;
      const bp = b.exercise.mode === "productive" ? 0 : 1;
      return ap - bp;
    });
    for (const step of sorted) {
      if (seen.has(step.exercise.id)) continue;
      seen.add(step.exercise.id);
      picked.push({ ...step, reason: "herhaling" });
      break;
    }
    if (picked.length >= limit) break;
  }

  return interleave(picked);
}

/** Alle oefeningen die een bepaald item aanspreken (voor de itemdetailweergave). */
export function exercisesForItem(itemId: string): PlannedStep[] {
  return index().get(itemId) ?? [];
}

/* --------------------------------------------------- wat er klaarstaat --- */

/**
 * Hoeveel herhalingen de sessie je werkelijk gaat voorschotelen.
 *
 * Dit is niet hetzelfde als het aantal vervallen kaarten, en dat verschil was
 * een bug die elke dag zichtbaar was: de balk telde álles wat vervallen was,
 * terwijl `planReview()` per vervallen item een oefening opzoekt en het
 * overslaat als die niet bestaat. Er stond dus "12 te herhalen" waar de sessie
 * er zeven gaf, en dat verschil groeit: van de 6290 items worden er maar 405
 * door een oefening aangesproken. Alle vormkaarten die via een drill zijn
 * ontstaan, vallen erbuiten.
 *
 * Het getal op het scherm hoort te beloven wat het waarmaakt. Tot de
 * oefeningengenerator van Fase 2 er is, is dit het eerlijke getal.
 */
export function reviewableCount(now = new Date()): number {
  const idx = index();
  return dueItemIds(now, 10_000).filter((id) => idx.has(id)).length;
}

/** Wanneer de eerstvolgende herhaling klaarstaat die ook écht te oefenen is. */
export function nextReviewableAt(now = new Date()): Date | null {
  const idx = index();
  for (const kaart of upcomingCards(now, 1000)) {
    if (idx.has(kaart.itemId)) return new Date(kaart.due);
  }
  return null;
}

/**
 * Vervallen kaarten waar geen enkele oefening bij hoort. Puur informatief: dit
 * getal hoort nul te zijn en is het niet, en dat verdient zichtbaarheid in
 * plaats van stilte.
 */
export function unreachableDueCount(now = new Date()): number {
  const idx = index();
  return dueItemIds(now, 10_000).filter((id) => !idx.has(id)).length;
}

export function totalExerciseCount(): number {
  return loadLessons().reduce(
    (n, l) => n + lessonExercises(l).filter((e) => e.type !== "teaching_moment").length,
    0,
  );
}
