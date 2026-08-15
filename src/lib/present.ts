import type { Exercise, ExerciseMode, ExerciseType } from "./content";

/**
 * Wat de browser te zien krijgt. Het juiste antwoord zit hier bewust NIET in:
 * beoordelen gebeurt op de server, zodat een oefening niet uit de netwerkrespons
 * of de React-props af te lezen is.
 */
export interface PresentedExercise {
  id: string;
  type: ExerciseType;
  mode: ExerciseMode;
  prompt_nl: string;
  body_nl?: string;
  given?: string;
  hint?: string;
  audio?: string;
  difficulty: number;
  source?: string;
  placeholder?: string;
  /** choice */
  options?: string[];
  /** match */
  matchHr?: string[];
  matchNl?: string[];
  /** word_order */
  tokens?: string[];
  /** free_production */
  rubric_nl?: string[];
}

/** Stabiele hash → dezelfde volgorde bij elke render, en reproduceerbaar. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const out = [...arr];
  let state = hash(seed) || 1;
  const rnd = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function present(exercise: Exercise): PresentedExercise {
  const base: PresentedExercise = {
    id: exercise.id,
    type: exercise.type,
    mode: exercise.mode ?? "receptive",
    prompt_nl: exercise.prompt_nl,
    body_nl: exercise.body_nl,
    given: exercise.given,
    hint: exercise.hint,
    audio: exercise.audio,
    difficulty: exercise.difficulty ?? 1,
    source: exercise.source,
    placeholder: exercise.placeholder,
  };

  switch (exercise.type) {
    case "choice": {
      const options = [exercise.answer ?? "", ...(exercise.distractors ?? [])].filter(Boolean);
      return { ...base, options: seededShuffle(options, exercise.id) };
    }
    case "match": {
      const pairs = exercise.pairs ?? [];
      return {
        ...base,
        matchHr: pairs.map((p) => p.hr),
        matchNl: seededShuffle(
          pairs.map((p) => p.nl),
          exercise.id + "nl",
        ),
      };
    }
    case "word_order": {
      const tokens = exercise.tokens ?? [];
      return { ...base, tokens: seededShuffle(tokens, exercise.id + "tok") };
    }
    case "free_production":
      return { ...base, rubric_nl: exercise.rubric_nl };
    default:
      return base;
  }
}
