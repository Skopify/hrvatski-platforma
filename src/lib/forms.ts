import { eq } from "drizzle-orm";

import { db } from "./db";
import { items } from "./db/schema";

/**
 * De vormcatalogus: elke woordvorm die het platform kent, opzoekbaar op hoe hij
 * geschreven wordt.
 *
 * De verbuigingsmotor produceert al ruim vijfduizend vormen, maar alleen in de
 * richting lemma → vorm. Voor twee dingen is de ándere richting nodig:
 *
 *   - een fout begrijpen. «kuću» invullen waar «kući» moest is pas een
 *     naamvalsfout als je kunt zien dát «kuću» de accusatief van hetzelfde woord
 *     is. Zonder deze index is het niet meer dan "niet het goede antwoord".
 *   - een tekst ontleden, zonder er een tweede runtime bij te halen.
 *
 * Meerduidigheid wordt bewaard, niet weggepoetst: «kuće» is genitief enkelvoud,
 * nominatief meervoud én accusatief meervoud, en welke ervan het is hangt van de
 * zin af. Een index die één lezing kiest, liegt in twee van de drie gevallen.
 */

/**
 * Kroatische functiewoorden — gesloten klasse.
 *
 * Deze lijst is nodig voor een eerlijke meting. Sommige voorzetsels en
 * voornaamwoorden staan óók in de woordenlijst van een les, en zonder deze lijst
 * zou een verhaal dat toevallig veel «u» en «i» bevat lager scoren dan een veel
 * moeilijkere tekst. Dat is precies wat er gebeurde: het A1.2-verhaal kwam
 * onder het A2.2-verhaal uit.
 *
 * Functiewoorden zijn niet wat een tekst zwaar maakt — ze komen met de
 * grammatica mee en herhalen zich zo vaak dat ze vanzelf blijven zitten. Nation
 * rekent zijn drempels over álle lopende woorden, met de aanname dat de
 * structuurwoorden bekend zijn. Deze lijst maakt die aanname expliciet.
 */
export const FUNCTION_WORDS = new Set<string>([
  // voorzetsels
  "u", "na", "s", "sa", "iz", "od", "do", "za", "po", "pred", "kod", "prije", "poslije",
  "blizu", "o", "pri", "prema", "bez", "nakon", "pokraj", "iznad", "ispod", "između", "zbog",
  // voegwoorden en signaalwoorden
  "i", "a", "ali", "ili", "da", "jer", "nego", "kad", "kada", "dok", "zato", "pa", "te",
  // persoonlijke en wederkerende voornaamwoorden
  "ja", "ti", "on", "ona", "ono", "mi", "vi", "oni", "one", "me", "te", "ga", "ju", "nas",
  "vas", "ih", "mu", "joj", "nam", "vam", "im", "se", "sebe", "si", "njoj", "njemu", "njima",
  "mene", "tebe", "njega", "nje",
  // bezittelijk en aanwijzend
  "moj", "moja", "moje", "mog", "moju", "mojim", "tvoj", "tvoja", "njegov", "njegova",
  "njezin", "njezina", "njezinu", "naš", "naša", "vaš", "njihov", "svoj", "svoja", "svojim",
  "ovo", "to", "ovaj", "ova", "taj", "ta", "onaj",
  // vraagwoorden
  "tko", "što", "koji", "koja", "koje", "koju", "kojim", "gdje", "zašto", "kako", "kakav",
  // biti, htjeti en hun ontkenningen
  "sam", "si", "je", "smo", "ste", "su", "bio", "bila", "bilo", "bili", "bile", "biti",
  "nisam", "nisi", "nije", "nismo", "niste", "nisu", "bit", "budem",
  "ću", "ćeš", "će", "ćemo", "ćete", "hoću", "hoćeš",
  // partikels en ontkenning
  "ne", "ni", "li", "već", "još", "samo", "tek", "baš",
  // onbepaalde woorden
  "sve", "svaki", "svaka", "neki", "nešto", "netko", "nekoliko", "nikada", "ništa",
]);


export type Naamval = "nom" | "gen" | "dat" | "acc" | "voc" | "loc" | "ins";
export type Getal = "sg" | "pl";

export interface Features {
  case?: Naamval;
  number?: Getal;
  /** 1 t/m 6: ja, ti, on/ona, mi, vi, oni/one. */
  person?: number;
  /** Het l-deelwoord voor de verleden tijd. */
  participle?: boolean;
  gender?: "m" | "f" | "n" | "pl";
}

export interface Reading {
  /** Het vormitem, bijvoorbeeld f.kuca.loc.sg. */
  itemId: string;
  /** De woordenboekvorm. */
  lemma: string;
  lemmaId: string;
  surface: string;
  feats: Features;
  /** Zoals het in beeld komt: "locatief enkelvoud". */
  label: string;
}

const NAAMVALLEN: Record<string, Naamval> = {
  nom: "nom", gen: "gen", dat: "dat", acc: "acc", voc: "voc", loc: "loc", ins: "ins",
};

/** Van het Nederlandse etiket in de database naar de korte code. */
export const NAAMVAL_CODE: Record<string, Naamval> = {
  Nominatief: "nom",
  Genitief: "gen",
  Datief: "dat",
  Accusatief: "acc",
  Vocatief: "voc",
  Locatief: "loc",
  Instrumentalis: "ins",
};

export const NAAMVAL_NAAM: Record<Naamval, string> = {
  nom: "nominatief",
  gen: "genitief",
  dat: "datief",
  acc: "accusatief",
  voc: "vocatief",
  loc: "locatief",
  ins: "instrumentalis",
};

/** Sleutel waaronder een vorm in de index staat. */
export function formKey(woord: string): string {
  return woord
    .normalize("NFC")
    .toLowerCase()
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Het achtervoegsel van een vormitem ontleden: f.kuca.loc.sg → locatief ev.
 * De id draagt de ontleding al, dus die hoeft niet uit het Nederlandse
 * omschrijvingsveld geraden te worden.
 */
function featuresUitId(itemId: string): Features | null {
  const delen = itemId.split(".");
  if (delen.length < 3) return null;
  const a = delen[delen.length - 2]!;
  const b = delen[delen.length - 1]!;

  if (NAAMVALLEN[a] && (b === "sg" || b === "pl")) {
    return { case: NAAMVALLEN[a], number: b };
  }
  if (a === "pres") {
    const n = Number(b);
    return Number.isInteger(n) ? { person: n, number: n <= 3 ? "sg" : "pl" } : null;
  }
  if (a === "part") {
    const geslacht = b === "m" || b === "f" || b === "n" ? b : b === "pl" ? "pl" : undefined;
    return { participle: true, gender: geslacht, number: b === "pl" ? "pl" : "sg" };
  }
  return null;
}

interface FormPayload {
  lemma: string;
  lemmaId: string;
  form: string;
  description: string;
}

let index: Map<string, Reading[]> | null = null;

/** De hele catalogus, één keer opgebouwd en daarna hergebruikt. */
export function formIndex(): Map<string, Reading[]> {
  if (index) return index;
  const map = new Map<string, Reading[]>();

  const rijen = db
    .select({ id: items.id, payload: items.payload })
    .from(items)
    .where(eq(items.kind, "form"))
    .all();

  for (const rij of rijen) {
    const p = rij.payload as FormPayload;
    if (!p?.form) continue;
    const feats = featuresUitId(rij.id);
    if (!feats) continue;

    const sleutel = formKey(p.form);
    if (!sleutel) continue;

    const lezing: Reading = {
      itemId: rij.id,
      lemma: p.lemma,
      lemmaId: p.lemmaId,
      surface: p.form,
      feats,
      label: p.description,
    };

    const lijst = map.get(sleutel);
    if (lijst) lijst.push(lezing);
    else map.set(sleutel, [lezing]);
  }

  // De vormen die in de woordenlijst zelf staan en die de motor niet opnieuw
  // aflevert: de infinitief, en de ja-vorm van het presens. Die laatste is de
  // ínvoer van de vervoeging, dus er is geen vormitem voor — terwijl het een van
  // de frequentste vormen in lopende tekst is.
  const woorden = db
    .select({ id: items.id, payload: items.payload })
    .from(items)
    .where(eq(items.kind, "vocab"))
    .all();

  const voegToe = (vorm: string | null | undefined, lezing: Omit<Reading, "surface">) => {
    if (!vorm) return;
    const sleutel = formKey(vorm);
    if (!sleutel) return;
    const lijst = map.get(sleutel);
    const nieuw = { ...lezing, surface: vorm };
    if (!lijst) map.set(sleutel, [nieuw]);
    else if (!lijst.some((l) => l.lemmaId === nieuw.lemmaId && gelijk(l.feats, nieuw.feats))) {
      lijst.push(nieuw);
    }
  };

  /*
    Uitdrukkingen leveren ook losse woorden op.

    Vijfentachtig woordenlijstitems bestaan uit meer dan één woord: «Dobar
    dan!», «bijela kava», «Vidimo se!». Die stonden alleen als geheel in de
    catalogus, en daardoor kende het platform «dan» niet — een van de
    frequentste woorden van de taal — terwijl het er in vier uitdrukkingen in
    zit. Bij het nakijken van eigen tekst kwam dat eruit als «woord dat ik niet
    ken», en dat was gewoon onwaar.

    De losse woorden krijgen het etiket van de uitdrukking waar ze uit komen,
    zodat zichtbaar blijft waar ze vandaan komen.
  */
  const uitUitdrukking = (zin: string, lezing: Omit<Reading, "surface">) => {
    if (!zin.includes(" ")) return;
    for (const deel of zin.split(/\s+/)) {
      const schoon = deel.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if (schoon.length < 2) continue;
      voegToe(schoon, { ...lezing, label: `uit «${zin}»` });
    }
  };

  for (const rij of woorden) {
    const v = rij.payload as { hr?: string; pos?: string; present_1sg?: string | null };
    if (!v?.hr) continue;
    if (v.pos === "verb") {
      voegToe(v.hr, {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: {},
        label: "infinitief",
      });
      voegToe(v.present_1sg, {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: { person: 1, number: "sg" },
        label: "presens ja",
      });
      // «zovem se» hoort ook onder «zovem» te vinden zijn.
      uitUitdrukking(v.present_1sg ?? "", {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: { person: 1, number: "sg" },
        label: "presens ja",
      });
      uitUitdrukking(v.hr, {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: {},
        label: "infinitief",
      });
    } else if (v.pos !== "noun") {
      // Bijvoeglijke naamwoorden, bijwoorden en de rest: alleen de vorm zoals hij
      // in de woordenlijst staat. Er wordt niets verbogen wat we niet weten.
      voegToe(v.hr, {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: {},
        label: "woordenboekvorm",
      });
      uitUitdrukking(v.hr, {
        itemId: rij.id,
        lemma: v.hr,
        lemmaId: rij.id,
        feats: {},
        label: "woordenboekvorm",
      });
    }
  }

  index = map;
  return map;
}

function gelijk(a: Features, b: Features): boolean {
  return (
    a.case === b.case &&
    a.number === b.number &&
    a.person === b.person &&
    a.participle === b.participle &&
    a.gender === b.gender
  );
}

/** Alle lezingen van een woordvorm. Leeg als de catalogus hem niet kent. */
export function readingsFor(woord: string): Reading[] {
  return formIndex().get(formKey(woord)) ?? [];
}

/** Voor de tests en de seed: de opgebouwde index weggooien. */
export function resetFormIndex(): void {
  index = null;
}
