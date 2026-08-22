import fs from "node:fs";
import path from "node:path";

import { FUNCTION_WORDS, formIndex, formKey, NAAMVAL_NAAM, readingsFor, type Naamval } from "./forms";
import { vindServismen, type Melding } from "./servisms";

/**
 * Een stuk Kroatisch nakijken — of het nu uit een contentbestand komt of net
 * door de leerder is getypt.
 *
 * Dit stond eerst alleen in scripts/check-taal.ts, waar het de content bewaakt.
 * Maar de vragen zijn identiek: bestaat dit woord, eist dit voorzetsel deze
 * naamval, is dit een Servische vorm. Wat goed genoeg is om mijn eigen zinnen
 * tegen te houden, is goed genoeg om die van de leerder na te kijken.
 *
 * Wat dit níét doet: zeggen of een zin klópt. «Idem u kuću» en «Idem u kući»
 * zijn allebei goed Kroatisch en betekenen iets anders; welke van de twee je
 * bedoelde, weet alleen jij. De controle wijst aan wat aantoonbaar mis is en
 * zwijgt over de rest.
 */

/** Welke naamval een voorzetsel eist. */
export const VOORZETSEL_NAAMVAL: Record<string, Naamval[]> = {
  iz: ["gen"], od: ["gen"], do: ["gen"], kod: ["gen"], bez: ["gen"], zbog: ["gen"],
  blizu: ["gen"], pokraj: ["gen"], iznad: ["gen"], ispod: ["gen"], ispred: ["gen"],
  iza: ["gen"], između: ["gen"], oko: ["gen"], poslije: ["gen"], prije: ["gen"],
  nakon: ["gen"], tijekom: ["gen"], umjesto: ["gen"], preko: ["gen"], protiv: ["gen"],
  prema: ["dat"], k: ["dat"], ka: ["dat"], usprkos: ["dat"], unatoč: ["dat"],
  o: ["loc"], pri: ["loc"],
  kroz: ["acc"], niz: ["acc"], uz: ["acc"],
  u: ["acc", "loc"], na: ["acc", "loc"],
  pred: ["acc", "ins"], nad: ["acc", "ins"], pod: ["acc", "ins"], među: ["acc", "ins"],
  s: ["ins", "gen"], sa: ["ins", "gen"],
  po: ["loc", "acc"],
  za: ["acc", "gen", "ins"],
};

/** Woorden die tussen voorzetsel en zelfstandig naamwoord mogen staan. */
const TUSSENWOORD =
  /^(taj|ta|to|toga|tom|tim|ovaj|ova|ovo|ovom|ovim|onaj|ona|moj|moja|moje|mom|mojoj|mojim|tvoj|tvoja|tvom|njegov|njezin|naš|naša|našem|vaš|njihov|svoj|svoja|svom|svojoj|svojim|jedan|jedna|jedno|jednom|jednu|cijeli|cijelu|cijelom|prvi|prvu|prvom|drugi|drugu|drugom|neki|neku|nekom|svaki|svaku|svakom)$/;

/** Telwoorden nemen het regeren over van het voorzetsel. */
const TELWOORD =
  /^(dva|dvije|tri|četiri|pet|šest|sedam|osam|devet|deset|jedanaest|dvanaest|trinaest|četrnaest|petnaest|šesnaest|sedamnaest|osamnaest|devetnaest|dvadeset|trideset|četrdeset|pedeset|sto|dvjesto|tisuću|tisuća|milijun|nekoliko|mnogo|malo|puno|koliko)$/;

export interface Naamvalfout {
  fragment: string;
  voorzetsel: string;
  woord: string;
  wil: Naamval[];
  gevonden: Naamval[];
  uitleg: string;
  /** De vorm die het had moeten zijn, als de catalogus die kent. */
  bedoeld?: string;
}

/**
 * De vorm van een woord in een bepaalde naamval opzoeken.
 *
 * De catalogus loopt van vorm naar lemma; hier is de andere kant nodig. Dat
 * maakt het verschil tussen «iz wil de genitief» — waar een leerder niets mee
 * kan als hij de genitief nog niet uit zijn hoofd kent — en «dat is grada».
 *
 * Alleen als het antwoord eenduidig is. Levert het zoeken twee verschillende
 * vormen op, dan wordt er niets voorgesteld: een suggestie die ernaast zit,
 * wordt geloofd.
 */
export function vormVan(lemmaId: string, naamval: Naamval, getal: "sg" | "pl" = "sg"): string | undefined {
  const treffers = new Set<string>();
  for (const lezingen of formIndex().values()) {
    for (const l of lezingen) {
      if (l.lemmaId !== lemmaId) continue;
      if (l.feats.case === naamval && l.feats.number === getal) treffers.add(l.surface);
    }
  }
  return treffers.size === 1 ? [...treffers][0] : undefined;
}

export function tokens(tekst: string): string[] {
  return tekst.replace(/[*_]/g, "").split(/[^\p{L}\p{N}\-]+/u).filter(Boolean);
}

/** Voorzetsels met een naamval die er niet bij past. */
export function naamvalfouten(zin: string): Naamvalfout[] {
  if (/_{2,}/.test(zin)) return [];
  const uit: Naamvalfout[] = [];
  const woorden = tokens(zin);

  for (let i = 0; i < woorden.length - 1; i++) {
    const vz = formKey(woorden[i]!);
    const wil = VOORZETSEL_NAAMVAL[vz];
    if (!wil) continue;

    let j = i + 1;
    while (j < woorden.length && TUSSENWOORD.test(formKey(woorden[j]!))) j++;
    if (j >= woorden.length) continue;

    const woord = formKey(woorden[j]!);
    if (!woord || /^\d/.test(woord) || TELWOORD.test(woord)) continue;

    const lezingen = readingsFor(woord).filter((l) => l.feats.case);
    if (!lezingen.length) continue;

    const gevonden = [...new Set(lezingen.map((l) => l.feats.case!))];
    if (gevonden.some((c) => wil.includes(c))) continue;

    const fragment = woorden.slice(i, j + 1).join(" ");
    if (nagekeken().naamval.has(fragment.toLowerCase())) continue;

    // Wat had er moeten staan? Alleen bij één ondubbelzinnige naamval te zeggen.
    const getal = lezingen[0]!.feats.number === "pl" ? "pl" : "sg";
    const bedoeld =
      wil.length === 1 ? vormVan(lezingen[0]!.lemmaId, wil[0]!, getal) : undefined;

    uit.push({
      fragment,
      voorzetsel: vz,
      woord,
      wil,
      gevonden,
      bedoeld,
      uitleg:
        `«${vz}» wil ${wil.map((c) => NAAMVAL_NAAM[c]).join(" of ")}, ` +
        `maar «${woord}» is ${gevonden.map((c) => NAAMVAL_NAAM[c]).join(" of ")}`,
    });
  }
  return uit;
}

/* ------------------------------------------------------------- spelling --- */

let kaalIndex: Map<string, string[]> | null = null;

function kaal(woord: string): string {
  return woord.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").toLowerCase();
}

function bouwKaalIndex(): Map<string, string[]> {
  if (kaalIndex) return kaalIndex;
  const map = new Map<string, string[]>();
  const voegToe = (vorm: string) => {
    const k = kaal(vorm);
    const lijst = map.get(k);
    if (lijst) {
      if (!lijst.includes(vorm)) lijst.push(vorm);
    } else map.set(k, [vorm]);
  };
  for (const sleutel of formIndex().keys()) voegToe(sleutel);
  for (const w of FUNCTION_WORDS) voegToe(w);
  kaalIndex = map;
  return map;
}

/* --------------------------------------------------------------- namen --- */

let namenCache: Set<string> | null = null;

/**
 * Eigennamen en klankvoorbeelden uit content/namen.json.
 *
 * Zonder deze lijst meldde het nakijken «Rotterdamu» en «Antonio» als onbekende
 * woorden. Dat is voor een leerder die over zichzelf schrijft de eerste zin al,
 * en een programma dat je eigen naam afkeurt geloof je bij de volgende melding
 * ook niet meer.
 */
function namen(): Set<string> {
  if (namenCache) return namenCache;
  const bestand = path.join(process.cwd(), "content", "namen.json");
  if (!fs.existsSync(bestand)) {
    namenCache = new Set();
    return namenCache;
  }
  const raw = JSON.parse(fs.readFileSync(bestand, "utf8")) as {
    namen?: string[];
    klankvoorbeelden?: string[];
  };
  namenCache = new Set([...(raw.namen ?? []), ...(raw.klankvoorbeelden ?? [])].map(formKey));
  return namenCache;
}

/* -------------------------------------------------------- al nagekeken --- */

let nagekekenCache: { spelling: Set<string>; naamval: Set<string> } | null = null;

/**
 * De uitzonderingen uit content/taalcontrole.json.
 *
 * Datzelfde bestand houdt `npm run check:taal` rustig over gevallen die bij
 * inspectie goed bleken. Dat de motor het niet las, was een gat met scherpe
 * randen: «na hrvatskom» — locatief van het bijvoeglijk naamwoord, dat de
 * catalogus als instrumentalis van het land Hrvatska leest — werd in de content
 * terecht doorgelaten en bij de leerder alsnog afgekeurd. Eén lijst, twee
 * gebruikers.
 */
function nagekeken() {
  if (nagekekenCache) return nagekekenCache;
  const bestand = path.join(process.cwd(), "content", "taalcontrole.json");
  const leeg = { spelling: new Set<string>(), naamval: new Set<string>() };
  if (!fs.existsSync(bestand)) {
    nagekekenCache = leeg;
    return leeg;
  }
  const raw = JSON.parse(fs.readFileSync(bestand, "utf8")) as {
    spelling_nagekeken?: Record<string, string>;
    naamval_nagekeken?: Record<string, string>;
  };
  /*
    Alleen de naamvaluitzonderingen gelden ook hier.

    Die zijn algemeen waar: «od Marka» is de genitief van een naam, wie dat ook
    schrijft. De spellinguitzonderingen niet. Daar staat «sto bestaat, het is
    honderd» — waar in de content, maar een leerder die «sto» typt bedoelt
    negen van de tien keer «što», en die had de melding juist nodig.
  */
  nagekekenCache = {
    spelling: new Set<string>(),
    naamval: new Set(Object.keys(raw.naamval_nagekeken ?? {}).map((k) => k.toLowerCase())),
  };
  return nagekekenCache;
}

/* ------------------------------------------------------------- stammen --- */

let stamCache: Set<string> | null = null;

/** Elk beginstuk van elk lemma dat het platform kent, vanaf drie letters. */
function stammen(): Set<string> {
  if (stamCache) return stamCache;
  const set = new Set<string>();
  for (const lezingen of formIndex().values()) {
    for (const l of lezingen) {
      const lemma = formKey(l.lemma);
      for (let n = 3; n <= lemma.length; n++) set.add(lemma.slice(0, n));
    }
  }
  stamCache = set;
  return set;
}

/** Het langste bekende lemma waar dit woord op lijkt te zijn gebouwd. */
function verwantLemma(woord: string): string | null {
  const set = stammen();
  for (let n = Math.min(woord.length, 9); n >= 4; n--) {
    const stam = woord.slice(0, n);
    if (!set.has(stam)) continue;
    for (const lezingen of formIndex().values()) {
      for (const l of lezingen) {
        if (formKey(l.lemma).startsWith(stam)) return l.lemma;
      }
    }
  }
  return null;
}

/**
 * Een vergeten teken in de stám opsporen.
 *
 * De gewone diakrietcontrole zoekt de hele vorm op in de catalogus, en die
 * kent lang niet alles: «naručio» staat er niet in, dus «narucio» kwam er
 * ongemoeid doorheen. Maar het lemma «naručivati» staat er wél, en dat draagt
 * de č op precies de plek waar de leerder hem vergat.
 *
 * Dus: vergelijk de kale vormen, neem het gemeenschappelijke begin, en plak
 * daar de geschreven staart aan vast. «naruč» + «io» wordt «naručio».
 *
 * Alleen als het gemeenschappelijke begin minstens vier letters lang is en
 * daar echt een teken in zit. Korter is te vaak toeval.
 */
function stamDiakriet(woord: string, lemma: string): string | undefined {
  const kw = kaal(woord);
  const kl = kaal(lemma);
  let n = 0;
  while (n < kw.length && n < kl.length && kw[n] === kl[n]) n++;
  if (n < 4) return undefined;
  const echteStam = lemma.slice(0, n);
  if (kaal(echteStam) === echteStam) return undefined; // geen teken in de stam
  return echteStam + woord.slice(n);
}

export interface Spelfout {
  woord: string;
  /** De vorm die het waarschijnlijk moest zijn — alleen bij ontbrekende tekens. */
  bedoeld?: string;
  /** Het woord waar deze vorm bij lijkt te horen — alleen bij soort "vorm". */
  verwant?: string;
  soort: "diakriet" | "vorm" | "naam" | "onbekend";
}

/**
 * Woorden die het platform niet thuis kan brengen.
 *
 * «Onbekend» betekent hier precies dat en niet «fout»: het Kroatisch is groter
 * dan deze leergang. Alleen bij een woord dat mét diakrieten wél bestaat wordt
 * gezegd wat het waarschijnlijk moest zijn — «kuca» naast «kuća» is in negen
 * van de tien gevallen een vergeten dakje en niet het werkwoord kloppen.
 */
export function spelfouten(tekst: string): Spelfout[] {
  const index = bouwKaalIndex();
  const lijst = namen();
  const uit: Spelfout[] = [];
  const gezien = new Set<string>();

  // Waar begint een zin? Een hoofdletter middenin een zin is meestal een naam.
  const zinsbegin = new Set<string>();
  for (const zin of tekst.split(/(?<=[.!?])\s+|\n+/)) {
    const eerste = tokens(zin)[0];
    if (eerste) zinsbegin.add(eerste);
  }

  for (const ruw of tokens(tekst)) {
    const sleutel = formKey(ruw);
    if (!sleutel || /^\d/.test(sleutel) || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    if (FUNCTION_WORDS.has(sleutel) || readingsFor(sleutel).length) continue;
    if (lijst.has(sleutel) || nagekeken().spelling.has(sleutel)) continue;

    /*
      Vier uitkomsten, van zeker naar onzeker — en die volgorde is het punt.

      Een vergeten dakje is vrijwel altijd fout. Een naam is helemaal geen
      fout. Een vorm van een woord dat ik ken, is waarschijnlijk goed maar
      buiten wat de verbuigingsmotor maakt. En pas als niets daarvan opgaat,
      is het echt een woord waar ik niets van weet.

      Eén bak van alles maken — zoals eerst — zet je eigen naam naast een
      tikfout, en dan lees je de lijst niet meer.
    */
    const metTekens = (index.get(kaal(sleutel)) ?? []).filter((v) => v !== sleutel);
    if (metTekens.length) {
      uit.push({ woord: ruw, bedoeld: metTekens[0], soort: "diakriet" });
      continue;
    }

    // Hoofdletter die niet aan het begin van een zin staat: vrijwel zeker een naam.
    if (/^\p{Lu}/u.test(ruw) && !zinsbegin.has(ruw)) {
      uit.push({ woord: ruw, soort: "naam" });
      continue;
    }

    const verwant = verwantLemma(sleutel);
    if (verwant) {
      // Zit het verschil met het bekende woord in een vergeten teken?
      const hersteld = stamDiakriet(ruw, verwant);
      if (hersteld && hersteld !== ruw) {
        uit.push({ woord: ruw, bedoeld: hersteld, soort: "diakriet" });
        continue;
      }
      uit.push({ woord: ruw, verwant, soort: "vorm" });
      continue;
    }
    uit.push({ woord: ruw, soort: "onbekend" });
  }
  return uit;
}

/* ------------------------------------------------------------- bij elkaar --- */

export interface Tekstbevindingen {
  spelling: Spelfout[];
  naamvallen: Naamvalfout[];
  servismen: Melding[];
  /** Aantal woorden dat de vormcatalogus herkent, en het totaal. */
  herkend: number;
  totaal: number;
}

export function controleer(tekst: string): Tekstbevindingen {
  const alle = tokens(tekst);
  const herkend = alle.filter((w) => {
    const k = formKey(w);
    return Boolean(k) && (FUNCTION_WORDS.has(k) || readingsFor(k).length > 0);
  }).length;

  return {
    spelling: spelfouten(tekst),
    naamvallen: tekst.split(/(?<=[.!?])\s+/).flatMap((z) => naamvalfouten(z)),
    servismen: vindServismen(tekst),
    herkend,
    totaal: alle.length,
  };
}
