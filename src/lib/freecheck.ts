import { formIndex, formKey, readingsFor } from "./forms";
import { stripDiacritics } from "./grading";
import type { Exercise } from "./content";

/*
  Vrije productie nakijken — voor zover dat eerlijk kan.

  Tot nu toe kreeg je bij een schrijfopdracht een modelantwoord en beoordeelde je
  jezelf. Dat is de juiste oplossing voor «is dit een goede zin», want dat kan dit
  platform niet weten zonder een dienst die per aanroep oordeelt, en die is er
  bewust niet.

  Maar een deel van wat er in die criteria staat is helemaal geen oordeel. «Er
  staat een woord met een c in», «er staat een woord zonder klinker», «se komt
  drie keer voor», «geen enkele zin begint met se» — dat zijn feiten over de
  tekst die je hebt getypt, en die kan een programma gewoon vaststellen. Die
  criteria zelf nakijken is nauwkeuriger dan jezelf beoordelen, en het is sneller.

  Twee regels houden dit eerlijk:

  Alles wat hier gecontroleerd wordt, staat er letterlijk bij, met wat er is
  aangetroffen. Geen vinkje zonder aanleiding.

  En wat níét te controleren is, zegt dat. Blijft er ook maar één criterium over
  dat een oordeel vraagt, dan beslis jij en niet het programma. Alleen wanneer
  élk criterium mechanisch is, mag de uitkomst automatisch zijn.
*/

export type FreeCheck =
  /** Minstens één woord bevat een van deze letters. */
  | { kind: "bevat_letter"; letters: string; label: string }
  /** Minstens één woord zonder a, e, i, o of u — de r als klinker. */
  | { kind: "zonder_klinker"; label: string }
  /** Nergens twee dezelfde klinkers naast elkaar. */
  | { kind: "geen_dubbele_klinker"; label: string }
  /** Een van deze woorden komt voor. */
  | { kind: "bevat_woord"; woorden: string[]; label: string }
  /** Een van deze woorden komt minstens n keer voor. */
  | { kind: "min_voorkomens"; woorden: string[]; n: number; label: string }
  /** Minstens n zinnen. */
  | { kind: "min_zinnen"; n: number; label: string }
  /** Minstens n losse woorden. */
  | { kind: "min_woorden"; n: number; label: string }
  /** Geen enkele zin begint met een van deze woorden. */
  | { kind: "niet_vooraan"; woorden: string[]; label: string }
  /**
   * Er staat verleden tijd in: minstens n l-deelwoorden.
   *
   * Vast te stellen omdat de vormcatalogus deelwoorden apart bijhoudt —
   * «radio», «radila», «radili». Voor een schrijfopdracht is dat precies het
   * verschil tussen «schrijf over gisteren» en «schrijf over gisteren in de
   * verleden tijd».
   */
  | { kind: "min_verleden"; n: number; label: string }
  /** Er staat toekomst in: ću/ćeš/će met een infinitief erbij. */
  | { kind: "bevat_toekomst"; label: string }
  /** Minstens n woorden in een bepaalde naamval. */
  | { kind: "min_naamval"; naamval: string; n: number; label: string };

export interface CheckUitkomst {
  label: string;
  ok: boolean;
  detail: string;
}

export interface FreeReport {
  /** Alles nagekeken en alles goed — alleen zinvol als `volledig` waar is. */
  geslaagd: boolean;
  /** Zijn álle criteria mechanisch? Zo niet, dan blijft het oordeel bij de leerder. */
  volledig: boolean;
  checks: CheckUitkomst[];
  /** Woorden die op één teken na een bekende vorm zijn — bijna altijd een tikfout. */
  suggesties: Suggestie[];
  /** Hoeveel woorden er als bekende vorm herkend zijn. */
  herkend: number;
}

const KLINKERS = "aeiouAEIOU";

function woorden(tekst: string): string[] {
  return tekst
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
}

function zinnen(tekst: string): string[] {
  return tekst
    .split(/[.!?]+/)
    .map((z) => z.trim())
    .filter(Boolean);
}

const norm = (w: string) => w.toLocaleLowerCase("hr");

function pasToe(check: FreeCheck, antwoord: string): CheckUitkomst {
  const ws = woorden(antwoord);
  const laag = ws.map(norm);

  switch (check.kind) {
    case "bevat_letter": {
      const set = [...check.letters];
      const treffers = ws.filter((w) => set.some((l) => norm(w).includes(norm(l))));
      return {
        label: check.label,
        ok: treffers.length > 0,
        detail: treffers.length ? `gevonden: ${treffers.join(", ")}` : "geen enkel woord met die letter",
      };
    }
    case "zonder_klinker": {
      const treffers = ws.filter((w) => ![...w].some((c) => KLINKERS.includes(c)));
      return {
        label: check.label,
        ok: treffers.length > 0,
        detail: treffers.length ? `gevonden: ${treffers.join(", ")}` : "elk woord heeft een klinker",
      };
    }
    case "geen_dubbele_klinker": {
      const fout = ws.filter((w) => /([aeiou])\1/i.test(w));
      return {
        label: check.label,
        ok: fout.length === 0,
        detail: fout.length ? `dubbele klinker in: ${fout.join(", ")}` : "nergens een dubbele klinker",
      };
    }
    case "bevat_woord": {
      const doel = check.woorden.map(norm);
      const treffers = laag.filter((w) => doel.includes(w));
      return {
        label: check.label,
        ok: treffers.length > 0,
        detail: treffers.length
          ? `gevonden: ${[...new Set(treffers)].join(", ")}`
          : `niet gevonden: ${check.woorden.join(", ")}`,
      };
    }
    case "min_voorkomens": {
      const doel = check.woorden.map(norm);
      const n = laag.filter((w) => doel.includes(w)).length;
      return {
        label: check.label,
        ok: n >= check.n,
        detail: `${n} keer gevonden, ${check.n} nodig`,
      };
    }
    case "min_zinnen": {
      const n = zinnen(antwoord).length;
      return { label: check.label, ok: n >= check.n, detail: `${n} zin(nen), ${check.n} nodig` };
    }
    case "min_woorden": {
      return {
        label: check.label,
        ok: ws.length >= check.n,
        detail: `${ws.length} woord(en), ${check.n} nodig`,
      };
    }
    case "min_verleden": {
      const deelwoorden = woorden(antwoord).filter((w) =>
        readingsFor(w).some((l) => l.feats.participle),
      );
      return {
        label: check.label,
        ok: deelwoorden.length >= check.n,
        detail: deelwoorden.length
          ? `${deelwoorden.length} gevonden: ${[...new Set(deelwoorden)].slice(0, 6).join(", ")}`
          : "geen verleden tijd gevonden",
      };
    }

    case "bevat_toekomst": {
      // Twee vormen: «ću raditi» en het samengetrokken «radit ću».
      const heeft = /\b(ću|ćeš|će|ćemo|ćete)\b/i.test(antwoord) &&
        /\p{L}+(ti|ći)\b/iu.test(antwoord.replace(/\b(ću|ćeš|će|ćemo|ćete)\b/gi, " "));
      const samengetrokken = /\p{L}+t\s+(ću|ćeš|će|ćemo|ćete)\b/iu.test(antwoord);
      return {
        label: check.label,
        ok: heeft || samengetrokken,
        detail: heeft || samengetrokken ? "toekomende tijd gevonden" : "geen toekomende tijd gevonden",
      };
    }

    case "min_naamval": {
      const treffers = woorden(antwoord).filter((w) =>
        readingsFor(w).some((l) => l.feats.case === check.naamval),
      );
      return {
        label: check.label,
        ok: treffers.length >= check.n,
        detail: treffers.length
          ? `${treffers.length} gevonden: ${[...new Set(treffers)].slice(0, 6).join(", ")}`
          : "geen enkele gevonden",
      };
    }

    case "niet_vooraan": {
      const doel = check.woorden.map(norm);
      const fout = zinnen(antwoord).filter((z) => {
        const eerste = woorden(z)[0];
        return eerste ? doel.includes(norm(eerste)) : false;
      });
      return {
        label: check.label,
        ok: fout.length === 0,
        detail: fout.length ? `staat vooraan in: «${fout[0]}»` : "nergens als eerste woord",
      };
    }
  }
}

/**
 * Alleen vergeten diakritische tekens aanwijzen — en verder zwijgen.
 *
 * De eerste opzet meldde elk woord dat de vormenlijst niet kende. Dat leverde
 * onzin op: die lijst bevat de vormen die de leerstof expliciet noemt, en
 * vervoegde werkwoorden zitten daar nauwelijks bij. «Tuširam» werd als onbekend
 * gemeld terwijl het gewoon goed is. Een controle die correcte woorden afkeurt is
 * erger dan geen controle — je leert er wantrouwen van, niet spelling.
 *
 * De tweede opzet suggereerde het dichtstbijzijnde woord op één teken afstand.
 * Dat is nog erger: «lijepa» werd dan «lijeka», en dat is geen tikfout maar een
 * ander woord. Wie zoiets één keer ziet, gelooft de rest ook niet meer.
 *
 * Wat overblijft is de enige fout die met zekerheid vast te stellen is: een woord
 * dat exact een bekende vorm wordt zodra je de dakjes en streepjes meerekent.
 * «Kuca» tegenover «kuća», «caj» tegenover «čaj». Dat is precies de fout die een
 * Nederlands toetsenbord uitlokt, en er is geen andere lezing mogelijk.
 */
export interface Suggestie {
  geschreven: string;
  bedoeld: string;
}

function spellingscontrole(antwoord: string): { suggesties: Suggestie[]; herkend: number } {
  const index = formIndex();
  // De bekende vormen, opgezocht op hun vorm zónder diakritische tekens.
  const kaal = new Map<string, string>();
  for (const vorm of index.keys()) {
    const zonder = stripDiacritics(vorm);
    if (zonder !== vorm && !kaal.has(zonder)) kaal.set(zonder, vorm);
  }

  const suggesties: Suggestie[] = [];
  let herkend = 0;

  for (const w of woorden(antwoord)) {
    if (w.length < 3) continue;
    const sleutel = formKey(w);
    if (index.has(sleutel)) {
      herkend++;
      continue;
    }
    const bedoeld = kaal.get(stripDiacritics(sleutel));
    if (bedoeld && !suggesties.some((s) => formKey(s.geschreven) === sleutel)) {
      suggesties.push({ geschreven: w, bedoeld });
    }
  }
  return { suggesties, herkend };
}

export function checkFree(exercise: Exercise, antwoord: string): FreeReport {
  const lijst = (exercise.checks ?? []) as FreeCheck[];
  const checks = lijst.map((c) => pasToe(c, antwoord));
  const { suggesties, herkend } = spellingscontrole(antwoord);

  // Volledig nagekeken alleen als de opgave dat expliciet zegt. Tellen zou hier
  // fout gaan: drie checks bij drie criteria betekent niet dat ze dezelfde drie
  // dingen controleren.
  const volledig = exercise.auto_check === true && lijst.length > 0;

  return {
    geslaagd: checks.every((c) => c.ok),
    volledig,
    checks,
    suggesties,
    herkend,
  };
}
