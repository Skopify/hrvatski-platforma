import {
  FUNCTION_WORDS,
  formKey,
  readingsFor,
  type Features,
  type Naamval,
  type Reading,
} from "./forms";

/**
 * Een Kroatische tekst ontleden: welke woorden staan er, van welk lemma, in
 * welke vorm — en wat kan deze ontleder níet thuisbrengen.
 *
 * ── Waarom hier en niet in een Python-service ──────────────────────────────
 * Het herbouwplan schreef CLASSLA voor. Dat is de betere ontleder, maar hij
 * brengt een tweede runtime en een paar honderd megabyte modelbestanden mee, en
 * hij levert pas iets op zodra er tekst is waarvan de woordenlijst niet met de
 * hand geschreven is. Zolang elk verhaal zijn eigen glossary heeft, doet deze
 * ontleder het werk met wat er al ligt: de vijfduizend vormen die de
 * verbuigingsmotor produceert.
 *
 * Wat telt is dat de rest van het platform hier tegenaan praat en niet tegen de
 * implementatie. Blijkt de dekking te laag, dan schuift CLASSLA erachter zonder
 * dat één aanroeper verandert. Meet dat eerst — zie scripts/check-content.ts.
 *
 * ── De onbekend-vlag ───────────────────────────────────────────────────────
 * Elk token zegt of het thuisgebracht kon worden. Dat is geen luxe: wie
 * onbekende woorden stilzwijgend als bekend telt, meet zijn leesdekking te hoog
 * en krijgt teksten voorgeschoteld die te moeilijk zijn. Een ontleder die niet
 * kan zeggen wat hij niet weet, is erger dan geen ontleder.
 */

export type WordClass = "content" | "function" | "proper" | "unknown";

export interface Token {
  /** Het woord zoals het er staat, zonder omringende leestekens. */
  surface: string;
  /** Positie in de tekst, vanaf 0. */
  index: number;
  lemma: string | null;
  lemmaId: string | null;
  /** De gekozen lezing. Null als het woord niet thuisgebracht kon worden. */
  feats: Features | null;
  /** Álle mogelijke lezingen — meerduidigheid wordt bewaard, niet verborgen. */
  readings: Reading[];
  klasse: WordClass;
  /** True als deze ontleder het woord niet kent. Nooit stilzwijgend bekend. */
  unknown: boolean;
}

/* --------------------------------------------------- naamvalregering --- */

/**
 * Welke naamval een voorzetsel oplegt.
 *
 * Sommige regeren er één, en die maken meerduidigheid meteen op: «kod» kan
 * alleen de genitief, dus «kod kuće» is genitief en niet nominatief meervoud.
 * Andere regeren er twee — precies de contrasten die de lessen behandelen — en
 * daar knijpt dit de mogelijkheden alleen maar in.
 */
const PREPOSITIE_NAAMVAL: Record<string, Naamval[]> = {
  // eenduidig — genitief
  od: ["gen"], do: ["gen"], iz: ["gen"], kod: ["gen"], bez: ["gen"], blizu: ["gen"],
  prije: ["gen"], poslije: ["gen"], nakon: ["gen"], oko: ["gen"], pokraj: ["gen"],
  iznad: ["gen"], ispod: ["gen"], između: ["gen"], zbog: ["gen"], umjesto: ["gen"],
  osim: ["gen"], protiv: ["gen"], preko: ["gen"], tijekom: ["gen"],
  // eenduidig — datief
  k: ["dat"], ka: ["dat"], prema: ["dat"], nasuprot: ["dat"], usprkos: ["dat"],
  // eenduidig — accusatief
  kroz: ["acc"], niz: ["acc"], uz: ["acc"],
  // eenduidig — locatief
  o: ["loc"], pri: ["loc"],
  // eenduidig — instrumentalis
  među: ["ins"], nad: ["ins"],
  // tweeduidig: de kern van de lessen 7 en 10
  u: ["acc", "loc"],
  na: ["acc", "loc"],
  po: ["acc", "loc"],
  s: ["ins", "gen"],
  sa: ["ins", "gen"],
  za: ["acc", "ins"],
  pod: ["acc", "ins"],
  pred: ["acc", "ins"],
};

/**
 * Voorkeursvolgorde als er niets te kiezen valt uit de context.
 *
 * Volstrekt willekeurig kiezen zou de ontleding onbetrouwbaar maken zonder dat
 * je het merkt. Deze volgorde is niet "de waarheid" maar een vaste, uitlegbare
 * gok: de nominatief is de frequentste, en enkelvoud gaat vóór meervoud. Alle
 * lezingen blijven staan in `readings`, dus wie het beter weet kan kiezen.
 */
const VOORKEUR: Naamval[] = ["nom", "acc", "gen", "loc", "dat", "ins", "voc"];

function beste(lezingen: Reading[]): Reading {
  return [...lezingen].sort((a, b) => {
    const ai = a.feats.case ? VOORKEUR.indexOf(a.feats.case) : 99;
    const bi = b.feats.case ? VOORKEUR.indexOf(b.feats.case) : 99;
    if (ai !== bi) return ai - bi;
    const an = a.feats.number === "pl" ? 1 : 0;
    const bn = b.feats.number === "pl" ? 1 : 0;
    return an - bn;
  })[0]!;
}

/* ----------------------------------------------------------- ontleden --- */

/** Tekst in woorden knippen; leestekens vallen weg, de volgorde blijft. */
function tokeniseer(tekst: string): { surface: string; zinBegin: boolean }[] {
  const out: { surface: string; zinBegin: boolean }[] = [];
  let nieuweZin = true;
  for (const ruw of tekst.split(/\s+/)) {
    if (!ruw) continue;
    const surface = ruw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (surface) {
      out.push({ surface, zinBegin: nieuweZin });
      nieuweZin = false;
    }
    if (/[.!?…]/.test(ruw)) nieuweZin = true;
  }
  return out;
}

export function analyze(tekst: string): Token[] {
  const ruw = tokeniseer(tekst);
  const tokens: Token[] = [];

  for (let i = 0; i < ruw.length; i++) {
    const { surface, zinBegin } = ruw[i]!;
    const sleutel = formKey(surface);

    const lezingen = readingsFor(surface);

    if (lezingen.length) {
      // Regeert het vorige woord een naamval, dan snoeit dat de lezingen.
      const vorige = i > 0 ? formKey(ruw[i - 1]!.surface) : "";
      const geregeerd = PREPOSITIE_NAAMVAL[vorige];
      const gesnoeid =
        geregeerd && geregeerd.length
          ? lezingen.filter((l) => l.feats.case && geregeerd.includes(l.feats.case))
          : [];
      const kandidaten = gesnoeid.length ? gesnoeid : lezingen;
      const gekozen = beste(kandidaten);

      tokens.push({
        surface,
        index: i,
        lemma: gekozen.lemma,
        lemmaId: gekozen.lemmaId,
        feats: gekozen.feats,
        readings: lezingen,
        klasse: FUNCTION_WORDS.has(sleutel) ? "function" : "content",
        unknown: false,
      });
      continue;
    }

    if (FUNCTION_WORDS.has(sleutel)) {
      tokens.push({
        surface,
        index: i,
        lemma: sleutel,
        lemmaId: null,
        feats: null,
        readings: [],
        klasse: "function",
        unknown: false,
      });
      continue;
    }

    // Een hoofdletter middenin een zin wijst op een naam: Nina, Zagreb, Dolac.
    // Aan het begin van een zin zegt een hoofdletter niets, dus daar telt het
    // niet — anders zou elk eerste woord een eigennaam worden.
    if (!zinBegin && surface[0] !== surface[0]!.toLowerCase()) {
      tokens.push({
        surface,
        index: i,
        lemma: surface,
        lemmaId: null,
        feats: null,
        readings: [],
        klasse: "proper",
        unknown: false,
      });
      continue;
    }

    tokens.push({
      surface,
      index: i,
      lemma: null,
      lemmaId: null,
      feats: null,
      readings: [],
      klasse: "unknown",
      unknown: true,
    });
  }

  return tokens;
}

/** Hoeveel van een tekst deze ontleder thuisbrengt. Voor het meten zelf. */
export function analyzeRecall(tekst: string): {
  total: number;
  known: number;
  unknown: string[];
} {
  const tokens = analyze(tekst);
  const onbekend = tokens.filter((t) => t.unknown);
  return {
    total: tokens.length,
    known: tokens.length - onbekend.length,
    unknown: onbekend.map((t) => t.surface),
  };
}
