import fs from "node:fs";
import path from "node:path";

/* ---------------------------------------------------------------- types --- */

export type ExerciseType =
  | "reading"
  | "teaching_moment"
  | "match"
  | "choice"
  | "cloze"
  | "translate_nl_hr"
  | "translate_hr_nl"
  | "word_order"
  | "listen_type"
  | "error_correction"
  | "free_production";

export type ExerciseMode = "receptive" | "productive";

export interface Exercise {
  id: string;
  type: ExerciseType;
  mode?: ExerciseMode;
  prompt_nl: string;
  body_nl?: string;
  given?: string;
  hint?: string;
  tokens?: string[];
  pairs?: { hr: string; nl: string }[];
  answer?: string;
  accepts?: string[];
  distractors?: string[];
  model_answer?: string;
  rubric_nl?: string[];
  explain_nl?: string;
  /** Overschrijft de placeholder — begrijpend lezen beantwoord je in het Nederlands. */
  placeholder?: string;
  targets?: string[];
  difficulty?: number;
  audio?: string;
  source?: string;
}

export interface Paradigm {
  caption_nl: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
}

export interface GrammarPoint {
  id: string;
  title_nl: string;
  cefr: string;
  explanation_nl: string;
  contrast_nl?: string;
  paradigm?: Paradigm;
  pitfalls_nl?: string[];
  prerequisites?: string[];
  source?: string;
}

export interface VocabEntry {
  id: string;
  hr: string;
  nl: string;
  pos: string;
  gender?: "m" | "f" | "n";
  animacy?: "animate" | "inanimate";
  declension?: string;
  gen_sg?: string;
  nom_pl?: string;
  aspect?: string | null;
  present_1sg?: string | null;
  verb_class?: string | null;
  tags?: string[];
  source?: string;
}

export interface Section {
  id: string;
  title_nl: string;
  kind: "input" | "grammar" | "practice" | "mixed_review";
  text_hr?: string;
  translation_nl?: string;
  exercises: Exercise[];
  source?: string;
}

export interface Lesson {
  id: string;
  number: number;
  title_hr: string;
  title_nl: string;
  cefr: string;
  source: { udzbenik_pages?: string; vjezbenica_pages?: string };
  can_do_nl: string[];
  grammar: GrammarPoint[];
  vocab: VocabEntry[];
  sections: Section[];
}

/* --------------------------------------------------------------- verhaal --- */
/* De verhaaltypes leven in story.ts (fs-vrij, ook bruikbaar in de client);
   hier worden ze doorgegeven zodat serverkant alles op één plek importeert. */

export type {
  ComprehensionQuestion,
  ComprehensionSkill,
  Gloss,
  Story,
  StoryParagraph,
  StorySentence,
} from "./story";
export { asExercise, glossKey, SKILL_HINT, SKILL_LABEL } from "./story";
import { asExercise } from "./story";
import type { Story, StorySentence } from "./story";

export interface SyllabusEntry {
  number: number;
  title_hr: string;
  title_nl: string;
  cefr: string;
  udzbenik_pages?: string;
  vjezbenica_pages?: string;
  communicative_goals_nl?: string[];
  grammar?: string[];
  culture?: string[];
}

export interface Syllabus {
  cefr_mapping: Record<string, number[]>;
  case_introduction_order: Record<string, { lesson: number; note: string }>;
  lessons: SyllabusEntry[];
  source: Record<string, unknown>;
}

/* --------------------------------------------------------------- loading --- */

const CONTENT_DIR = path.join(process.cwd(), "content");

let syllabusCache: Syllabus | null = null;
let lessonsCache: Lesson[] | null = null;

export function loadSyllabus(): Syllabus {
  if (syllabusCache) return syllabusCache;
  const raw = fs.readFileSync(path.join(CONTENT_DIR, "syllabus.json"), "utf-8");
  syllabusCache = JSON.parse(raw) as Syllabus;
  return syllabusCache;
}

export function loadLessons(): Lesson[] {
  if (lessonsCache) return lessonsCache;
  const dir = path.join(CONTENT_DIR, "lessons");
  if (!fs.existsSync(dir)) return (lessonsCache = []);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  lessonsCache = files.map(
    (f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Lesson,
  );
  return lessonsCache;
}

export function loadLesson(nr: number): Lesson | undefined {
  return loadLessons().find((l) => l.number === nr);
}

/** Alle oefeningen van een les, plat, in secties-volgorde. */
export function lessonExercises(lesson: Lesson): Exercise[] {
  return lesson.sections.flatMap((s) => s.exercises);
}

/* ------------------------------------------------------- naamvalgebruik --- */

export interface CaseUsageItem {
  id: string;
  sentence_hr: string;
  sentence_nl: string;
  /** Het woord waar de vraag over gaat. */
  focus: string;
  case: string;
  lesson: number;
  why_nl: string;
  contrast_nl?: string;
}

export interface CaseUsage {
  cases: { key: string; label: string; lesson: number }[];
  items: CaseUsageItem[];
}

let caseUsageCache: CaseUsage | null = null;

export function loadCaseUsage(): CaseUsage {
  if (caseUsageCache) return caseUsageCache;
  const file = path.join(CONTENT_DIR, "case-usage.json");
  if (!fs.existsSync(file)) return (caseUsageCache = { cases: [], items: [] });
  caseUsageCache = JSON.parse(fs.readFileSync(file, "utf-8")) as CaseUsage;
  return caseUsageCache;
}

let storiesCache: Story[] | null = null;

export function loadStories(): Story[] {
  if (storiesCache) return storiesCache;
  const dir = path.join(CONTENT_DIR, "stories");
  if (!fs.existsSync(dir)) return (storiesCache = []);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();
  storiesCache = files
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8")) as Story)
    .sort((a, b) => a.requires_lesson - b.requires_lesson || (a.part ?? 0) - (b.part ?? 0));
  return storiesCache;
}

export function loadStory(slug: string): Story | undefined {
  return loadStories().find((s) => s.slug === slug);
}

/** Alle zinnen van een verhaal, plat — voor woordtelling en voorlezen. */
export function storySentences(story: Story): StorySentence[] {
  return story.paragraphs.flatMap((p) => p.sentences);
}

export function storyWordCount(story: Story): number {
  return storySentences(story).reduce((n, s) => n + s.hr.split(/\s+/).filter(Boolean).length, 0);
}

/**
 * Leestijd in minuten. 90 woorden per minuut is traag voor een moedertaalspreker
 * en ongeveer goed voor een A2-lezer die woorden opzoekt.
 */
export function storyMinutes(story: Story): number {
  return Math.max(1, Math.round(storyWordCount(story) / 90));
}

/**
 * Oefeningen leven in lessen én in verhalen. De server moet er één van kunnen
 * maken zonder te weten waar hij vandaan komt, dus geeft deze functie altijd een
 * lesnummer terug — bij een verhaal is dat het niveau waarop het verhaal staat.
 */
let exerciseIndex: Map<string, { exercise: Exercise; lesson: { number: number } }> | null = null;

export function findExercise(
  id: string,
): { exercise: Exercise; lesson: { number: number } } | undefined {
  // Gebouwd bij de eerste vraag en daarna hergebruikt. De foutenpagina zoekt per
  // fout één oefening op; zonder index betekende dat per fout een lineaire
  // doorloop van alle lessen én verhalen.
  if (!exerciseIndex) {
    exerciseIndex = new Map();
    for (const lesson of loadLessons()) {
      for (const exercise of lessonExercises(lesson)) {
        exerciseIndex.set(exercise.id, { exercise, lesson });
      }
    }
    for (const story of loadStories()) {
      const lesson = { number: story.requires_lesson };
      for (const exercise of story.exercises) exerciseIndex.set(exercise.id, { exercise, lesson });
      for (const q of story.comprehension ?? []) {
        exerciseIndex.set(q.id, { exercise: asExercise(q), lesson });
      }
    }
  }
  return exerciseIndex.get(id);
}

/* ---------------------------------------------------------------- topics --- */

/**
 * Het onderwerp waaronder een item op het dashboard valt. Afgeleid uit de id,
 * zodat nieuwe content zonder codewijziging in de juiste bak valt.
 */
const CASE_KEYS: Record<string, string> = {
  nominativ: "Nominatief",
  akuzativ: "Accusatief",
  genitiv: "Genitief",
  dativ: "Datief",
  lokativ: "Locatief",
  instrumental: "Instrumentalis",
  vokativ: "Vocatief",
};

export function caseOf(itemId: string): string | null {
  for (const [key, label] of Object.entries(CASE_KEYS)) {
    if (itemId.includes(key)) return label;
  }
  return null;
}

export function topicOf(item: { id: string; kind: string }, lesson: Lesson): string {
  const c = caseOf(item.id);
  if (c) return c;
  if (item.kind === "vocab") return "Woordenschat";
  if (item.kind === "form") return "Vormen";

  const parts = item.id.split(".");
  if (parts[0] !== "g") return `Les ${lesson.number}`;

  // Id's komen in twee vormen voor: g.<thema>.… (les 1) en g.<lesnummer>.<thema>.…
  // (les 2 en verder). Het themadeel is dus het eerste segment dat geen getal is.
  const key = /^\d+$/.test(parts[1] ?? "") ? parts[2] : parts[1];

  const map: Record<string, string> = {
    biti: "Werkwoord biti",
    imati: "Werkwoorden",
    zvati_se: "Werkwoorden",
    prezent: "Werkwoorden",
    verb: "Werkwoorden",
    pron: "Voornaamwoorden",
    posvojne_zamjenice: "Bezit",
    posvojni_pridjevi_zivo: "Bezit",
    posvojni_pridjevi_nezivo: "Bezit",
    noun: "Zelfstandig naamwoord",
    duga_mnozina: "Meervoud",
    sibilarizacija: "Meervoud",
    nepostojano_a: "Meervoud",
    nepravilna_mnozina: "Meervoud",
    pridjevi: "Bijvoeglijk naamwoord",
    kakav: "Bijvoeglijk naamwoord",
    nepostojano_a_pridjevi: "Bijvoeglijk naamwoord",
    l_o: "Bijvoeglijk naamwoord",
    adj: "Bijvoeglijk naamwoord",
    zanimanja: "Beroepen",
    nacionalnosti: "Nationaliteiten",
    nego: "Voegwoorden",
    num: "Getallen",
    prep: "Voorzetsels",
    perfekt: "Verleden tijd",
    futur: "Toekomende tijd",
    imperativ: "Imperatief",
  };
  return map[key ?? ""] ?? `Les ${lesson.number}`;
}
