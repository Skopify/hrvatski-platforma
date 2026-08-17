import { caseOf, type ExerciseType } from "./content";
import { db } from "./db";
import { errorLog } from "./db/schema";
import {
  NAAMVAL_CODE,
  NAAMVAL_NAAM,
  formIndex,
  formKey,
  readingsFor,
  type Features,
  type Naamval,
  type Reading,
} from "./forms";
import { levenshtein, normalize, stripDiacritics } from "./grading";

/**
 * Fouten ontleden in plaats van tellen.
 *
 * `attempts` hield al bij dát een antwoord fout was. Wat er niet stond is wat
 * voor fout het was, en dat is precies het verschil dat ertoe doet: «kuću» waar
 * «kući» moest is een naamval die niet zit, «kuca» waar «kuća» moest is een
 * teken dat je vergeet. Hetzelfde percentage, twee totaal verschillende
 * remedies.
 *
 * De ontleding kan hier omdat de vormcatalogus bestaat: een fout antwoord wordt
 * opgezocht tussen de vormen van hetzelfde woord, en dan is te zien wélke vorm
 * je koos. Dat is ook wat de escalerende feedback voedt — zonder categorie kun
 * je geen hint geven die de categorie benoemt zonder het antwoord te verklappen.
 */

export type ErrorType =
  | "empty"
  | "diacritic"
  | "wrong_case"
  | "wrong_number"
  | "wrong_person"
  | "wrong_participle"
  | "wrong_form"
  | "word_order"
  | "lexical"
  | "spelling"
  | "unknown";

export interface ErrorContext {
  exerciseId: string;
  type: ExerciseType | string;
  /** De items die de oefening aanspreekt — woord én grammaticapunt. */
  targets: string[];
  expected: string;
  given: string;
  attemptId?: number;
}

export interface Classification {
  type: ErrorType;
  /** Het vormitem dat gevraagd werd, als dat te bepalen was. */
  itemId?: string;
  lemmaId?: string;
  grammarPointId?: string;
  expectedFeatures?: Features;
  givenFeatures?: Features;
}

/* ------------------------------------------------------------- kiezen --- */

/**
 * Uit meerdere lezingen de bedoelde kiezen.
 *
 * «kući» is zowel datief als locatief enkelvoud; welke van de twee de oefening
 * bedoelt, staat niet in het woord maar in de oefening. De doelen dragen dat:
 * een oefening over de locatief noemt g.10.lokativ. Die aanwijzing is er al —
 * hij werd alleen nooit gebruikt.
 */
function kiesLezing(lezingen: Reading[], targets: string[]): Reading | undefined {
  if (lezingen.length <= 1) return lezingen[0];

  // 1. Een lezing van een woord dat de oefening noemt.
  const vanDoel = lezingen.filter((l) => targets.includes(l.lemmaId));
  const kandidaten = vanDoel.length ? vanDoel : lezingen;
  if (kandidaten.length === 1) return kandidaten[0];

  // 2. De naamval die het grammaticapunt van de oefening aanwijst.
  for (const t of targets) {
    const label = caseOf(t);
    const code = label ? NAAMVAL_CODE[label] : undefined;
    if (!code) continue;
    const raak = kandidaten.find((l) => l.feats.case === code);
    if (raak) return raak;
  }

  return kandidaten[0];
}

/** Het grammaticapunt waar deze oefening over gaat. */
function grammaticapunt(targets: string[]): string | undefined {
  return targets.find((t) => t.startsWith("g."));
}

/* -------------------------------------------------------- classificeren --- */

export function classifyError(ctx: ErrorContext): Classification {
  const verwacht = normalize(ctx.expected);
  const gegeven = normalize(ctx.given);
  const punt = grammaticapunt(ctx.targets);

  if (!gegeven) return { type: "empty", grammarPointId: punt };

  // Alleen de tekens mis. Apart gehouden omdat het de structurele fout van een
  // Nederlandstalige is en een eigen remedie heeft.
  if (stripDiacritics(verwacht) === stripDiacritics(gegeven)) {
    return { type: "diacritic", grammarPointId: punt };
  }

  // Woordvolgorde: dezelfde woorden, andere volgorde.
  const woorden = (s: string) => s.split(/\s+/).filter(Boolean).sort().join(" ");
  if (verwacht.includes(" ") && woorden(verwacht) === woorden(gegeven)) {
    return { type: "word_order", grammarPointId: punt };
  }

  const verwachtLezingen = readingsFor(ctx.expected);
  const gegevenLezingen = readingsFor(ctx.given);
  const v = kiesLezing(verwachtLezingen, ctx.targets);

  const basis: Omit<Classification, "type"> = {
    itemId: v?.itemId,
    lemmaId: v?.lemmaId,
    grammarPointId: punt,
    expectedFeatures: v?.feats,
  };

  if (v && gegevenLezingen.length) {
    // Is het gegeven antwoord een andere vorm van hetzelfde woord? Dan is het
    // geen woordfout maar een vormfout, en is te zeggen wélke.
    const zelfdeWoord = gegevenLezingen.filter((l) => l.lemmaId === v.lemmaId);
    if (zelfdeWoord.length) {
      // Kies de lezing die het mínst van de verwachte afwijkt.
      //
      // Dat klinkt als een detail maar bepaalt de diagnose. «stranci» voor
      // «stranac» is nominatief meervoud — een getalfout. Maar het is óók de
      // accusatief meervoud, en wie die lezing pakt noemt het een naamvalsfout
      // en geeft een hint over naamvallen waar niets aan de hand is met de
      // naamval. De mildste verklaring die past, is de juiste.
      const zelfdeNaamval = zelfdeWoord.filter((l) => l.feats.case === v.feats.case);
      const g = (zelfdeNaamval.length ? zelfdeNaamval : zelfdeWoord)[0]!;

      const type: ErrorType =
        g.feats.case && v.feats.case && g.feats.case !== v.feats.case
          ? "wrong_case"
          : g.feats.number !== v.feats.number
            ? "wrong_number"
            : g.feats.person !== v.feats.person
              ? "wrong_person"
              : g.feats.participle || v.feats.participle
                ? "wrong_participle"
                : "wrong_form";

      return { ...basis, type, givenFeatures: g.feats };
    }

    // Een bestaand Kroatisch woord, maar het verkeerde.
    return { ...basis, type: "lexical", givenFeatures: gegevenLezingen[0]!.feats };
  }

  // Niet in de catalogus. Dicht bij goed is een schrijffout, ver ervandaan niet.
  if (formKey(verwacht).length > 3 && levenshtein(verwacht, gegeven) <= 2) {
    return { ...basis, type: "spelling" };
  }

  return { ...basis, type: "unknown" };
}

/* -------------------------------------------------------------- hints --- */

/** Naamvalsparen die stelselmatig door elkaar gaan, met hun kernvraag. */
const CONTRASTEN: { paar: [Naamval, Naamval]; vraag: string }[] = [
  {
    paar: ["acc", "loc"],
    vraag:
      "Bij u en na hangt de naamval af van de betekenis: gaat er iets ergens heen (accusatief) " +
      "of is er iets ergens (locatief)? Kijk welke van de twee deze zin vraagt.",
  },
  {
    paar: ["dat", "loc"],
    vraag:
      "Datief en locatief zien er hetzelfde uit, maar doen iets anders: de datief is de " +
      "ontvanger, de locatief hoort bij een voorzetsel van plaats. Welke van de twee staat hier?",
  },
  {
    paar: ["gen", "acc"],
    vraag:
      "Let op of het woord levend is: bij mannelijke levende wezens ziet de accusatief " +
      "eruit als de genitief. Gaat het hier om een lijdend voorwerp of om bezit?",
  },
  {
    paar: ["nom", "acc"],
    vraag:
      "Wie doet er iets, en met wat? Het onderwerp staat in de nominatief, het lijdend " +
      "voorwerp in de accusatief.",
  },
];

/**
 * Trede 1 van de escalerende feedback.
 *
 * De hint benoemt de categorie en stelt de vraag terug — hij geeft nooit de
 * vorm. Dat is het hele punt: als de eerste reactie op een fout het juiste
 * antwoord is, hoeft er niets meer opgehaald te worden, en juist dat ophalen is
 * wat het onthouden doet. Pas als dit niet helpt, komt de keuze uit twee vormen,
 * en daarna pas het antwoord met uitleg.
 */
export function hintFor(c: Classification): string {
  switch (c.type) {
    case "empty":
      return "Er staat nog niets. Gok gerust — een mis levert meer op dan overslaan.";

    case "diacritic":
      return "Bijna. Kijk naar de tekens: č, ć, š, ž en đ zijn eigen letters, geen versiering.";

    case "wrong_case": {
      const verwacht = c.expectedFeatures?.case;
      const gegeven = c.givenFeatures?.case;
      if (verwacht && gegeven) {
        const contrast = CONTRASTEN.find(
          ({ paar }) => paar.includes(verwacht) && paar.includes(gegeven),
        );
        if (contrast) return `Je schreef een ${NAAMVAL_NAAM[gegeven]}. ${contrast.vraag}`;
        return (
          `Je schreef een ${NAAMVAL_NAAM[gegeven]}, maar deze zin vraagt de ` +
          `${NAAMVAL_NAAM[verwacht]}. Welke rol heeft het woord hier in de zin?`
        );
      }
      return "De vorm bestaat, maar het is niet de naamval die deze zin vraagt.";
    }

    case "wrong_number":
      return c.expectedFeatures?.number === "pl"
        ? "De naamval klopt, het getal niet — er wordt naar meer dan één gevraagd."
        : "De naamval klopt, het getal niet — er wordt naar één ding gevraagd.";

    case "wrong_person":
      return "Goed werkwoord, andere persoon. Wie doet het hier?";

    case "wrong_participle":
      return "Het deelwoord past zich aan aan wie het deed — man, vrouw of meervoud.";

    case "word_order":
      return "Alle woorden kloppen, de volgorde nog niet. Let op waar de korte vormen staan.";

    case "lexical":
      return "Dit is een bestaand woord, maar niet het gevraagde. Lees de opdracht nog eens.";

    case "spelling":
      return "Je zit er één of twee tekens naast. Kijk nog eens goed naar de letters.";

    case "wrong_form":
      return "De juiste woordsoort, maar niet de juiste vorm.";

    default:
      return "Nog niet. Kijk welke vorm de zin vraagt.";
  }
}

/* -------------------------------------------------------- keuzevormen --- */

/**
 * Trede 2: een keuze uit een handvol vormen.
 *
 * §7 stelt de eis dat afleiders plausibel zijn — echte verkeerde naamvalsvormen
 * van hetzelfde woord, geen willekeurige woorden. Dat is geen nettigheid: kiezen
 * uit «kući, stol, zelen» is geen naamvalstoets maar een spelletje uitsluiten,
 * en het levert dus geen enkel bewijs dat je de naamval kent.
 *
 * De vorm die de leerder zélf invulde gaat altijd mee als die van hetzelfde
 * woord is. Precies díe verwarring moet uitgezocht worden.
 *
 * Geeft een lege lijst als er niets plausibels te maken valt — dan slaat de
 * escalatie trede 2 over in plaats van een slechte keuze voor te schotelen.
 */
export function choicesFor(c: Classification, expected: string, given: string): string[] {
  if (!c.lemmaId) return [];

  const juist = expected.trim();
  const anders = new Map<string, Reading>();
  for (const lezingen of formIndex().values()) {
    for (const l of lezingen) {
      if (l.lemmaId !== c.lemmaId) continue;
      if (formKey(l.surface) === formKey(juist)) continue;
      if (!anders.has(formKey(l.surface))) anders.set(formKey(l.surface), l);
    }
  }
  if (anders.size === 0) return [];

  const uit: string[] = [];
  const eigen = [...anders.values()].find((l) => formKey(l.surface) === formKey(given));
  if (eigen) uit.push(eigen.surface);

  for (const l of anders.values()) {
    if (uit.length >= 2) break;
    if (uit.some((s) => formKey(s) === formKey(l.surface))) continue;
    uit.push(l.surface);
  }

  // Vaste volgorde uit de vormen zelf, zodat dezelfde fout dezelfde keuze geeft
  // en het antwoord niet aan zijn positie te herkennen is.
  return [juist, ...uit].sort((a, b) => a.localeCompare(b, "hr"));
}

/* ---------------------------------------------------------- vastleggen --- */

export function recordError(c: Classification, ctx: ErrorContext): void {
  db.insert(errorLog)
    .values({
      ts: Date.now(),
      exerciseId: ctx.exerciseId,
      attemptId: ctx.attemptId ?? null,
      itemId: c.itemId ?? null,
      lemmaId: c.lemmaId ?? null,
      grammarPointId: c.grammarPointId ?? null,
      errorType: c.type,
      expectedCase: c.expectedFeatures?.case ?? null,
      givenCase: c.givenFeatures?.case ?? null,
      expectedNumber: c.expectedFeatures?.number ?? null,
      givenNumber: c.givenFeatures?.number ?? null,
      expected: ctx.expected,
      given: ctx.given,
    })
    .run();
}
