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

    uit.push({
      fragment: woorden.slice(i, j + 1).join(" "),
      voorzetsel: vz,
      woord,
      wil,
      gevonden,
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

export interface Spelfout {
  woord: string;
  /** De vorm die het waarschijnlijk moest zijn — alleen bij ontbrekende tekens. */
  bedoeld?: string;
  soort: "diakriet" | "onbekend";
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
  const uit: Spelfout[] = [];
  const gezien = new Set<string>();

  for (const ruw of tokens(tekst)) {
    const sleutel = formKey(ruw);
    if (!sleutel || /^\d/.test(sleutel) || gezien.has(sleutel)) continue;
    gezien.add(sleutel);
    if (FUNCTION_WORDS.has(sleutel) || readingsFor(sleutel).length) continue;

    const metTekens = (index.get(kaal(sleutel)) ?? []).filter((v) => v !== sleutel);
    uit.push(
      metTekens.length
        ? { woord: ruw, bedoeld: metTekens[0], soort: "diakriet" }
        : { woord: ruw, soort: "onbekend" },
    );
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
