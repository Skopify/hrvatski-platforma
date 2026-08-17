/**
 * Verhaaltypes en pure hulpfuncties — bewust zonder node-imports, zodat de
 * clientlezer dit kan gebruiken zonder dat er serverfilesystem in de bundel
 * belandt. Laden gebeurt in content.ts; dit bestand weet niet waar JSON woont.
 */
import type { Exercise, VocabEntry } from "./content";

export interface StorySentence {
  /**
   * Vast id, bijvoorbeeld `kljuc.p1.s3`. Een woord dat je uit een verhaal
   * bewaart, houdt hiermee de zin vast waarin je het tegenkwam — en een
   * volgnummer zou daarvoor niet deugen, want dat schuift zodra er ergens een
   * zin bij komt. Toegekend door scripts/zin-ids.ts.
   */
  id: string;
  hr: string;
  nl: string;
}

export interface StoryParagraph {
  id: string;
  sentences: StorySentence[];
}

/**
 * Eén woordvorm zoals hij in de tekst staat. `info` is de grammaticale plaatsing
 * ("accusatief enkelvoud van kava") — dat is precies wat een woordenlijst in een
 * leesboek níet geeft, en waar het bij het Kroatisch op vastloopt.
 */
export interface Gloss {
  /** De vorm zoals hij in de tekst staat. */
  hr: string;
  nl: string;
  /** Het woordenboekwoord, als de vorm daarvan afwijkt. */
  lemma?: string;
  info?: string;
  /** Verwijzing naar een vocab-item, zodat opzoeken de SRS kan voeden. */
  item?: string;
}

/**
 * De vaardigheden van het begrijpend lezen.
 *
 * Waarom deze als aparte categorie en niet gewoon "vragen": bij begrijpend lezen
 * is de vráág het leerpunt. Wie leert herkennen dát er naar een verwijswoord
 * wordt gevraagd — en niet naar een detail — leest de volgende tekst beter. Het
 * etiket staat daarom bij elke vraag in beeld.
 */
export type ComprehensionSkill =
  | "hoofdgedachte"
  | "detail"
  | "verwijswoord"
  | "afleiden"
  | "woordbetekenis"
  | "verband"
  | "conclusie"
  | "volgorde";

export const SKILL_LABEL: Record<ComprehensionSkill, string> = {
  hoofdgedachte: "Hoofdgedachte",
  detail: "Detail",
  verwijswoord: "Verwijswoord",
  afleiden: "Afleiden",
  woordbetekenis: "Woord uit context",
  verband: "Tekstverband",
  conclusie: "Conclusie",
  volgorde: "Volgorde",
};

/** Korte uitleg van wat elke vraagsoort van je vraagt. */
export const SKILL_HINT: Record<ComprehensionSkill, string> = {
  hoofdgedachte: "Waar gaat de tekst als geheel over? Niet één zin, maar het geheel.",
  detail: "Staat letterlijk in de tekst. Zoek de plek terug.",
  verwijswoord: "Naar wie of wat verwijst dit woord? Kijk naar de zin ervóór.",
  afleiden: "Staat er niet letterlijk. Combineer wat er wél staat.",
  woordbetekenis: "Leid de betekenis af uit de zin eromheen, niet uit een woordenboek.",
  verband: "Welk verband legt dit woord — oorzaak, tegenstelling, of gevolg?",
  conclusie: "Wat volgt hieruit? Ga één stap verder dan de tekst.",
  volgorde: "In welke volgorde gebeurde het?",
};

/**
 * Een begrijpend-lezenvraag. Hergebruikt de bestaande oefentypes voor de
 * werking, maar draagt een vaardigheid en gaat níet de spaced repetition in:
 * deze vragen horen bij één specifieke tekst, dus over drie weken zou je het
 * antwoord herinneren in plaats van de vaardigheid.
 */
export interface ComprehensionQuestion {
  id: string;
  skill: ComprehensionSkill;
  type: "choice" | "translate_hr_nl" | "free_production" | "word_order";
  prompt_nl: string;
  /** Het tekstfragment waar de vraag over gaat, als citaat boven de vraag. */
  given?: string;
  answer?: string;
  accepts?: string[];
  distractors?: string[];
  tokens?: string[];
  model_answer?: string;
  rubric_nl?: string[];
  /** Waaróm dit het antwoord is — bij begrijpend lezen is dat het echte leerpunt. */
  explain_nl: string;
  difficulty?: number;
  placeholder?: string;
}

export interface Story {
  id: string;
  slug: string;
  /** Verhalen in een reeks delen personages; losse verhalen laten dit weg. */
  series?: string;
  part?: number;
  title_hr: string;
  title_nl: string;
  cefr: string;
  /** Beschikbaar zodra deze les is afgerond. */
  requires_lesson: number;
  blurb_nl: string;
  /** Welk motief de kaart krijgt — zie MOTIFS in de verhalenindex. */
  motif: string;
  /** Wat dit verhaal aan grammatica laat werken, voor op de kaart. */
  focus_nl: string[];
  paragraphs: StoryParagraph[];
  /** Sleutel is de woordvorm in kleine letters, zonder leestekens. */
  glossary: Record<string, Gloss>;
  culture_nl?: { title_nl: string; body_nl: string };
  vocab: VocabEntry[];
  /** Begrijpend lezen — over de inhoud. Gaat niet de SRS in. */
  comprehension?: ComprehensionQuestion[];
  /** Taaloefeningen — over de vormen. Voeden wél de SRS. */
  exercises: Exercise[];
  source?: string;
}

/** Een begrijpend-lezenvraag omzetten naar het gewone oefeningformaat. */
export function asExercise(q: ComprehensionQuestion): Exercise {
  return {
    id: q.id,
    type: q.type,
    // Kiezen is receptief, schrijven productief — dat bepaalt de XP-basis.
    mode: q.type === "free_production" || q.type === "word_order" ? "productive" : "receptive",
    prompt_nl: q.prompt_nl,
    given: q.given,
    answer: q.answer,
    accepts: q.accepts,
    distractors: q.distractors,
    tokens: q.tokens,
    model_answer: q.model_answer,
    rubric_nl: q.rubric_nl,
    explain_nl: q.explain_nl,
    placeholder: q.placeholder ?? "Schrijf je antwoord in het Nederlands…",
    // Bewust leeg: begrijpend lezen hoort bij één tekst, niet bij een woordkaart.
    targets: [],
    difficulty: q.difficulty ?? 3,
  };
}

/** De sleutel waaronder een woordvorm in de glossary staat. */
export function glossKey(token: string): string {
  return token
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")
    .replace(/[’']/g, "");
}
