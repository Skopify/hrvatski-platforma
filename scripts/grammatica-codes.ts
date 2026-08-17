/**
 * Koppelt de grammaticapunten van de 21 lessen aan de curriculummodules.
 * Draai met: npm run codes
 *
 * ── Waarom ─────────────────────────────────────────────────────────────────
 * Onderwerpen werden tot nu toe afgeleid door naar stukjes van een id te kijken
 * (`topicOf()` in src/lib/content.ts): staat er "lokativ" in, dan is het de
 * locatief. Dat werkt tot iemand een punt anders noemt, en het kan niets zeggen
 * over volgorde, voorkennis of dekking.
 *
 * Met een expliciete code hoort elk lespunt bij een module uit
 * content/curriculum.json, en wordt twee dingen zichtbaar die daarvóór niet te
 * zien waren: wat een les vooronderstelt, en welke modules door géén enkele les
 * gedekt worden. Dat laatste is het punt — een gat dat je kunt zien is een
 * planningsprobleem, een gat dat je niet kunt zien is een verrassing.
 *
 * Het script schrijft `code` in de les-JSON en drukt daarna de dekking af.
 * Idempotent: punten die al een code hebben, houden hem.
 */
import fs from "node:fs";
import path from "node:path";

/**
 * Van lespunt naar curriculummodule.
 *
 * Met de hand gelegd en niet geraden. Een enkel lespunt dekt soms twee modules
 * (les 10 doet locatief én sibilarisatie); dan telt de module die het lespunt
 * als hóófdonderwerp heeft, en de andere wordt door een ander punt gedekt.
 */
const KOPPELING: Record<string, string> = {
  // Eén lespunt kan meer dan één module raken; zie OOK_GEDEKT hieronder.
  // fase 0 — klank en schrift
  "g.00.abeceda": "PHON-ALPHABET",
  "g.00.palatali": "PHON-DIACRITICS",
  "g.00.izgovor": "PHON-R",
  "g.00.brojevi": "NUM-CARD",

  // fase 1 — nominatief en werkwoordskader
  "g.pron.personal": "PRON-PERS",
  "g.biti.present.short": "BITI-CLITIC",
  "g.biti.present.long": "BITI-FULL",
  "g.biti.present.negative": "BITI-NEG",
  "g.noun.gender.nom.sg": "NOM-GENDER",
  "g.pron.demonstrative": "PRON-PERS",
  "g.02.nominativ": "NOM-GENDER",
  "g.02.zanimanja": "NOM-GENDER",
  "g.02.nacionalnosti": "NOM-GENDER",
  "g.02.nego": "COMPARISON",
  "g.03.zvati_se": "REFLEXIVE",
  "g.03.posvojne_zamjenice": "POSS-PRON",
  "g.03.duga_mnozina": "PLURAL-LONG",
  "g.03.sibilarizacija": "SOUND-SIBIL",
  "g.03.nepostojano_a": "SOUND-FLEET-A",
  "g.03.nepravilna_mnozina": "PLURAL-IRREG",
  "g.04.pridjevi": "ADJ-AGREE",
  "g.04.kakav": "ADJ-AGREE",
  "g.04.nepostojano_a_pridjevi": "SOUND-FLEET-A",
  "g.04.l_o": "SOUND-IJE-JE",
  "g.04.posvojni_pridjevi_zivo": "POSS-ADJ",
  "g.04.posvojni_pridjevi_nezivo": "POSS-ADJ",
  "g.05.prezent.ati": "PRES-CLASSES",
  "g.05.prezent.irati": "PRES-CLASSES",
  "g.09.prezent.iti": "PRES-CLASSES",
  "g.09.prezent.jeti": "PRES-CLASSES",
  "g.10.prezent.ovati": "PRES-CLASSES",
  "g.09.treca_mnozina": "PRES-CLASSES",
  "g.05.imati": "PRES-BIG4",
  "g.07.ici": "PRES-BIG4",
  "g.06.htjeti": "PRES-BIG4",
  "g.08.jesti": "PRES-CLASSES",
  "g.08.piti": "PRES-CLASSES",
  "g.13.slati_pisati": "PRES-CLASSES",
  "g.06.modalni": "MODAL",
  "g.06.moci": "MODAL",
  "g.06.morati_smjeti": "MODAL",

  // fase 2 — accusatief
  "g.05.akuzativ.nezivo": "ACC-OBJECT",
  "g.05.akuzativ.zivo": "ACC-ANIM",
  "g.05.akuzativ.mnozina": "ACC-FEM",
  "g.08.akuzativ.objekt": "ACC-OBJECT",
  "g.07.u_na_akuzativ": "ACC-MOTION",
  "g.07.po_akuzativ": "ACC-MOTION",
  "g.07.za_akuzativ": "ACC-OBJECT",
  "g.07.zamjenice_akuzativ": "PRON-PERS",
  "g.18.alergican": "ACC-OBJECT",
  "g.19.zaljubljen_u": "ACC-OBJECT",

  // fase 3 — locatief en datief
  "g.10.lokativ": "LOCDAT-FORM",
  "g.10.prijedlozi_lokativ": "LOC-PREP",
  "g.10.gdje_kamo": "LOC-VS-ACC",
  "g.10.sibilarizacija_lokativ": "SOUND-SIBIL",
  "g.10.lokativ_ska": "LOC-PREP",
  "g.12.dativ": "LOCDAT-FORM",
  "g.12.prijedlozi_dativ": "DAT-GOAL",

  // fase 4 — genitief
  "g.14.genitiv": "GEN-POSS",
  "g.14.genitiv_kolicina": "GEN-QUANT",
  "g.14.genitiv_jd_mn": "GEN-NUM",
  "g.16.genitiv_prijedlozi": "GEN-PREP",
  "g.16.iz_od": "GEN-PREP",
  "g.16.genitiv_mnozina": "GEN-PL",
  "g.17.brojevi_padez": "GEN-NUM",
  "g.19.bojati_se": "GEN-POSS",

  // fase 5 — datief als ontvanger en ervaarder
  "g.13.dativ_objekt": "DAT-IOBJ",
  "g.13.glagoli_dativ": "DAT-IOBJ",
  "g.13.red_klitika": "CLITIC-ORDER",
  "g.19.dativ_dug_kratak": "DAT-CLITIC",
  "g.19.dativ_dozivljavaca": "DAT-EXPERIENCER",
  "g.19.svidati_se": "DAT-EXPERIENCER",
  "g.18.boljeti": "DAT-EXPERIENCER",

  // fase 6 — instrumentalis
  "g.15.instrumental": "INS-MEANS",
  "g.15.sredstvo": "INS-MEANS",
  "g.15.s_instrumental": "INS-COMPANY",
  "g.15.instrumental_zamjenice": "INS-COMPANY",
  "g.18.baviti_se": "INS-MEANS",

  // fase 7 — vocatief
  "g.20.vokativ": "VOC-ADDRESS",

  // dwarsdoorsnijdend
  "g.11.perfekt": "PERFEKT",
  "g.11.particip": "PERFEKT",
  "g.11.perfekt_negacija": "PERFEKT",
  "g.11.perfekt_nepravilni": "PERFEKT",
  "g.12.futur": "FUTUR-1",
  "g.12.futur_negacija": "FUTUR-1",
  "g.20.imperativ": "IMPERATIVE",
  "g.20.imperativ_nepravilni": "IMPERATIVE",
  "g.20.imperativ_negacija": "IMPERATIVE",
  "g.20.neka": "IMPERATIVE",
  "g.14.povratni": "REFLEXIVE",
  "g.17.dva_dvije": "NUM-CARD",
  "g.17.redni_brojevi": "NUM-ORD",
  "g.17.sati_datum": "NUM-ORD",
  "g.07.dani": "NUM-ORD",
  "g.10.mjeseci": "NUM-ORD",
  "g.18.zenski_suglasnik": "NOM-GENDER",
  "g.19.ost": "NOM-GENDER",
};

/**
 * Modules die een lespunt naast zijn hoofdmodule óók behandelt.
 *
 * Nodig omdat een dekkingsoverzicht anders liegt. `g.00.izgovor` heet
 * "uitspraakregels" en telde als klemtoonmodule, waardoor de vocalische r als
 * gat verscheen — terwijl de uitleg letterlijk *prst*, *vrt* en *krv* behandelt.
 * Een gat dat er niet is, is net zo schadelijk als een gat dat je niet ziet:
 * allebei sturen ze het schrijfwerk de verkeerde kant op.
 */
const OOK_GEDEKT: Record<string, string[]> = {
  "g.00.izgovor": ["PHON-STRESS"],
  "g.20.vokativ": ["SOUND-PALAT"],
};

interface Module {
  code: string;
  titel_nl: string;
  prerequisites: string[];
}
interface Fase {
  fase: number | null;
  titel_nl: string;
  modules: Module[];
}

const curriculum = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "content", "curriculum.json"), "utf-8"),
) as { fases: Fase[] };

const alleModules = new Map<string, { module: Module; fase: Fase }>();
for (const fase of curriculum.fases) {
  for (const module of fase.modules) alleModules.set(module.code, { module, fase });
}

/* ------------------------------------------------------------ controle --- */

const onbekend = [
  ...Object.entries(KOPPELING),
  ...Object.entries(OOK_GEDEKT).flatMap(([id, codes]) => codes.map((c) => [id, c] as [string, string])),
].filter(([, code]) => !alleModules.has(code));
if (onbekend.length) {
  console.error("Koppeling verwijst naar modules die niet bestaan:");
  for (const [id, code] of onbekend) console.error(`  ${id} → ${code}`);
  process.exit(1);
}

/* ------------------------------------------------------------ schrijven --- */

const DIR = path.join(process.cwd(), "content", "lessons");
let gezet = 0;
let bestond = 0;
const zonderCode: string[] = [];
const gedekt = new Set<string>();

for (const bestand of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const volledig = path.join(DIR, bestand);
  let tekst = fs.readFileSync(volledig, "utf-8");
  const les = JSON.parse(tekst) as { grammar: { id: string; code?: string }[] };

  for (const punt of les.grammar) {
    const code = KOPPELING[punt.id];
    if (!code) {
      zonderCode.push(punt.id);
      continue;
    }
    gedekt.add(code);
    for (const extra of OOK_GEDEKT[punt.id] ?? []) gedekt.add(extra);

    if (punt.code) {
      bestond++;
      continue;
    }

    // Het id staat altijd als eerste sleutel op zijn eigen regel; de code komt
    // er direct achter, zodat de bestaande opmaak intact blijft.
    const naald = `"id": ${JSON.stringify(punt.id)},`;
    const plek = tekst.indexOf(naald);
    if (plek < 0) {
      console.warn(`  ${bestand}: ${punt.id} niet gevonden`);
      continue;
    }
    const regelStart = tekst.lastIndexOf("\n", plek) + 1;
    const inspringing = tekst.slice(regelStart, plek);
    tekst =
      tekst.slice(0, plek + naald.length) +
      `\n${inspringing}"code": ${JSON.stringify(code)},` +
      tekst.slice(plek + naald.length);
    gezet++;
  }

  JSON.parse(tekst);
  fs.writeFileSync(volledig, tekst);
}

/* --------------------------------------------------------------- gaten --- */

console.log(`${gezet} codes gezet, ${bestond} stonden er al.`);
if (zonderCode.length) {
  console.log(`\nZonder koppeling (${zonderCode.length}): ${zonderCode.join(", ")}`);
}

console.log("\nDekking van het curriculum door de 21 lessen");
console.log("─".repeat(64));
let totaal = 0;
let dekt = 0;
for (const fase of curriculum.fases) {
  const gaten = fase.modules.filter((m) => !gedekt.has(m.code));
  totaal += fase.modules.length;
  dekt += fase.modules.length - gaten.length;
  const kop = fase.fase === null ? "dwarsdoorsnijdend" : `fase ${fase.fase}`;
  console.log(
    `\n${kop} — ${fase.titel_nl}` +
      `  (${fase.modules.length - gaten.length}/${fase.modules.length})`,
  );
  for (const gat of gaten) console.log(`   ontbreekt: ${gat.code} — ${gat.titel_nl}`);
}
console.log("\n" + "─".repeat(64));
console.log(`${dekt} van ${totaal} modules gedekt; ${totaal - dekt} gat(en).`);
