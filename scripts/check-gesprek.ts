/**
 * Acceptatietests voor de gespreksbot (BETA).
 * Draai met: npm run check:gesprek
 *
 * §12.4 van de spec schrapte runtime-generatie: geen dienst die per aanroep
 * geld kost of van buitenaf niet te overzien is. De gespreksbot is een bewuste,
 * afgebakende uitzondering, en deze tests bewaken de grenzen ervan:
 *
 *   1. Wat de bot zegt komt nooit ongecontroleerd op het scherm: dezelfde
 *      poorten als de content (spelling, naamval, servismen) plus een
 *      woordenschatgrens.
 *   2. De bot krijgt alleen de woorden die jij nu kunt hebben, niet meer.
 *   3. Een gesprek schrijft niets naar je leerhistorie.
 *   4. Als het model er niet is of onzin geeft, zegt de app dat, en verzint
 *      hij zelf geen Kroatisch als vervanging.
 *
 * Het model zelf wordt hier vervangen door een stub: de tests bewijzen de
 * poorten, niet de kwaliteit van Gemma. Draait tegen een kopie van de database.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

const REAL_DB = path.join(process.cwd(), "data", "hrvatski.db");
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-gesprek-"));
const WERK_DB = path.join(TMP, "werk.db");
{
  const src = new Database(REAL_DB, { readonly: true });
  await src.backup(WERK_DB);
  src.close();
}
process.env.HRVATSKI_DB = WERK_DB;

const { beurt, bouwPrompt, gezienVormen, herstelTekst, keurBotAf, loadScenarios, woordenTotLes } = await import("../src/lib/gesprek");
const { controleer } = await import("../src/lib/tekstcontrole");

interface Result {
  punt: string;
  naam: string;
  ok: boolean;
  detail: string;
}
const results: Result[] = [];
function check(punt: string, naam: string, ok: boolean, detail = "") {
  results.push({ punt, naam, ok, detail });
}

const tel = () => {
  const db = new Database(WERK_DB, { readonly: true });
  const tabellen = ["review_log", "srs", "card", "attempts", "study_sessions", "error_log", "schrijfwerk", "encounters"];
  const uit = tabellen.map((t) => `${t}=${(db.prepare(`select count(*) c from ${t}`).get() as { c: number }).c}`);
  const p = db.prepare("select xp from profile").get() as { xp: number };
  db.close();
  return [...uit, `xp=${p.xp}`].join(",");
};

/* ------------------------------------------------------------ scenario's --- */

const scenarios = loadScenarios();
check("G1", "er zijn minstens vijf scenario's met alle velden", scenarios.length >= 5 &&
  scenarios.every((s) => s.id && s.titel_nl && s.titel_hr && s.situatie_nl && s.opening_hr && s.opening_nl),
  `${scenarios.length} scenario's`);

const openingsFout = scenarios.flatMap((s) => {
  const c = controleer(s.opening_hr);
  return c.spelling.length + c.naamvallen.length + c.servismen.length ? [s.id] : [];
});
check("G2", "elke opening van de bot haalt de taalpoorten (zelf geschreven, dus eerst gecontroleerd)",
  openingsFout.length === 0, openingsFout.join(", "));

const extraFout = scenarios.flatMap((sc) =>
  sc.woorden.length >= 5 && sc.woorden.every((w) => w.hr && w.nl) ?
    sc.woorden.flatMap((w) => {
      const c = controleer(w.hr);
      return c.spelling.some((x) => x.soort === "diakriet") || c.servismen.length ? [`${sc.id}:${w.hr}`] : [];
    })
  : [sc.id],
);
check("G2b", "elk scenario heeft vijf of meer eigen woorden met vertaling, zonder servismen of vergeten tekens",
  extraFout.length === 0, extraFout.join(", "));

/* -------------------------------------------------------------- lexicon --- */

const tot3 = woordenTotLes(3);
const tot12 = woordenTotLes(12);
check("G3", "het lexicon groeit met de les en bevat niets uit latere lessen",
  tot3.length > 20 && tot3.length < tot12.length && tot3.every((w) => w.les <= 3),
  `les 3: ${tot3.length}, les 12: ${tot12.length}`);

const laat = woordenTotLes(21).find((w) => w.les >= 15 && !tot3.some((x) => x.hr === w.hr));
const prompt3 = bouwPrompt(scenarios[0]!, tot3);
check("G4", "de prompt noemt de toegestane woorden en geen woord uit een latere les",
  Boolean(laat) && tot3.slice(0, 15).every((w) => prompt3.includes(w.hr)) && !prompt3.includes(` ${laat!.hr},`) && !prompt3.includes(` ${laat!.hr} `),
  laat ? `geprobeerd met «${laat.hr}» (les ${laat.les})` : "geen laat woord gevonden");
check("G5", "de prompt eist standaardkroatisch (ijekavisch) en JSON",
  /ijekav|standaardkroat|Kroatisch/i.test(prompt3) && /json/i.test(prompt3), "");

/* ------------------------------------------------------- de poort voor de bot --- */

const naamwoord = tot3.find((w) => w.pos === "noun" && !w.hr.includes(" "));
const goedeZin = naamwoord ? `To je ${naamwoord.hr}.` : "To je.";
check("G6", "een eenvoudige zin binnen het lexicon wordt goedgekeurd",
  keurBotAf(goedeZin, tot3).length === 0, keurBotAf(goedeZin, tot3).join(" | "));
check("G7", "een servisme wordt afgekeurd", keurBotAf("Molim vas, hoću kafu i hleb.", tot3).length > 0, "");
check("G8", "een naamvalfout wordt afgekeurd", keurBotAf("Ja idem u škola.", tot3).length > 0, "");
check("G9", "vergeten diakrieten worden afgekeurd", keurBotAf("Ja hocu cokolada.", tot3).length > 0, "");
check("G10", "een zin vol woorden buiten het lexicon wordt afgekeurd",
  Boolean(laat) && keurBotAf(`${laat!.hr} ${laat!.hr} ${laat!.hr}.`, tot3).length > 0, "");
check("G11", "een lege of veel te lange zin wordt afgekeurd",
  keurBotAf("", tot3).length > 0 && keurBotAf(Array(80).fill("dan").join(" ") + ".", tot3).length > 0, "");

check("G19", "een woord dat de bot zelf al zei mag hij herhalen, ook buiten het lexicon",
  Boolean(laat) &&
    keurBotAf(`${laat!.hr} ${laat!.hr}.`, tot3).length > 0 &&
    keurBotAf(`${laat!.hr} ${laat!.hr}.`, tot3, gezienVormen([{ rol: "bot", tekst: `${laat!.hr}?` }])).length === 0, "");

/* ------------------------------------------------------------------ beurt --- */

const s0 = scenarios[0]!;
const vooraf = tel();
const json = (hr: string) => JSON.stringify({ hr, verbeterd_hr: "" });

let aanroepen = 0;
const eerstFoutDanGoed = async () => {
  aanroepen++;
  return aanroepen === 1 ? json("Molim vas, hoću kafu i hleb.") : json(goedeZin);
};
const r1 = await beurt({
  scenario: s0,
  les: 3,
  historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hocu cokolada." }],
  generate: eerstFoutDanGoed,
});
check("G12b", "een extra scenariowoord in gebogen vorm («ulicu») wordt toegestaan, een vreemd woord niet",
  keurBotAf("Ulicu.", tot3, new Set(), ["ulica"]).length === 0 && keurBotAf(`${laat!.hr}.`, tot3, new Set(), ["ulica"]).length > 0, "");

check("G12", "een afgekeurd antwoord wordt opnieuw gevraagd; alleen het goede komt op het scherm",
  r1.ok && r1.hr === goedeZin && r1.pogingen === 2 && aanroepen === 2, JSON.stringify(r1).slice(0, 120));
check("G13", "jouw eigen zin wordt nagekeken met dezelfde poorten (hocu → hoću)",
  r1.ok && r1.jouw.spelling.some((s) => /hocu/i.test(s.woord)), "");

let n = 0;
const altijdFout = async () => {
  n++;
  return json("Molim vas, hoću kafu i hleb.");
};
const r2 = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Dobar dan." }], generate: altijdFout });
check("G14", "blijft het model fouten maken, dan meldt de app dat en toont hij geen Kroatisch van het model",
  !r2.ok && r2.reden === "geen-goed-antwoord" && !("hr" in r2) && n === 3, `pogingen ${n}`);

const r3 = await beurt({
  scenario: s0,
  les: 3,
  historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Dobar dan." }],
  generate: async () => {
    throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
  },
});
check("G15", "ontbreekt Ollama, dan is het antwoord «offline», geen crash", !r3.ok && r3.reden === "offline", JSON.stringify(r3));

let m = 0;
const r4 = await beurt({
  scenario: s0,
  les: 3,
  historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Dobar dan." }],
  generate: async () => (++m === 1 ? "dit is geen json {" : json(goedeZin)),
});
check("G16", "ongeldige JSON van het model telt als een mislukte poging, niet als crash", r4.ok && m === 2, "");

/* ----------------------------------------------------------- verbeterde zin --- */

const h1 = herstelTekst("Ja hocu cokolada.", controleer("Ja hocu cokolada."));
check("G20", "vergeten tekens worden hersteld in de zin van de leerder", h1 === "Ja hoću čokolada.", String(h1));
const h2 = herstelTekst("Ja idem iz škola.", controleer("Ja idem iz škola."));
check("G21", "een verkeerde naamval wordt hersteld als de catalogus de vorm kent", h2 === "Ja idem iz škole.", String(h2));
const h3 = herstelTekst("Molim vas, hoću kafu.", controleer("Molim vas, hoću kafu."));
check("G22", "een servisme wordt vervangen door de Kroatische vorm", h3 === "Molim vas, hoću kavu.", String(h3));
check("G23", "een goede zin blijft ongemoeid", herstelTekst("Idem u školu.", controleer("Idem u školu.")) === null, "");

const metCorrectie = (verbeterd: string) => async () => JSON.stringify({ hr: goedeZin, verbeterd_hr: verbeterd });
const r5 = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hocu cokolada." }], generate: metCorrectie("Ja hoću čokoladu.") });
check("G24", "een voorstel van het model dat de poorten haalt is vollediger dan alleen de zekere herstellingen",
  r5.ok && r5.verbeterd?.bron === "bot" && r5.verbeterd.tekst === "Ja hoću čokoladu.", JSON.stringify(r5.ok && r5.verbeterd));
const r5b = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hocu cokolada." }], generate: metCorrectie("Ja hocu čokoladu.") });
check("G24b", "haalt het voorstel de poorten niet, dan blijft de zekere herstelling staan",
  r5b.ok && r5b.verbeterd?.bron === "controle" && r5b.verbeterd.tekst === "Ja hoću čokolada.", JSON.stringify(r5b.ok && r5b.verbeterd));
const r6 = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hoću vodu i sok." }], generate: metCorrectie("Ja hoću vodu i sok.") });
check("G25", "een «verbetering» die gelijk is aan je eigen zin wordt niet getoond", r6.ok && r6.verbeterd === null, "");
const r7 = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hoću kavu molim." }], generate: metCorrectie("Molim vas, hoću kafu i hleb.") });
check("G26", "een verbetering van het model die de poorten niet haalt, wordt niet getoond", r7.ok && r7.verbeterd === null, "");
const r8 = await beurt({ scenario: s0, les: 3, historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Ja hoću kava, molim." }], generate: metCorrectie("Ja hoću kavu, molim.") });
check("G27", "een goede verbetering van het model wordt getoond, met de bron erbij",
  r8.ok && r8.verbeterd?.bron === "bot" && r8.verbeterd.tekst === "Ja hoću kavu, molim.", JSON.stringify(r8.ok && r8.verbeterd));
check("G28", "het antwoord van de bot hoeft geen vertaling mee te leveren (die komt op verzoek)", r8.ok && r8.nl === "", "");

let gezien = "";
let k = 0;
await beurt({
  scenario: s0,
  les: 3,
  historie: [{ rol: "bot", tekst: s0.opening_hr }, { rol: "jij", tekst: "Dobar dan." }],
  generate: async (berichten) => {
    k++;
    gezien = berichten.map((b) => b.content).join("\n");
    return k === 1 ? json("Molim vas, hoću kafu i hleb.") : json(goedeZin);
  },
});
check("G18", "bij een nieuwe poging hoort het model waarom de vorige is afgekeurd", /Rejected by the checker/.test(gezien) && /kafu|hleb|servisme/.test(gezien), "");

const nadien = tel();
check("G17", "een gesprek schrijft niets naar je leerhistorie", vooraf === nadien, `${vooraf} → ${nadien}`);

/* ------------------------------------------------------------------ uitslag --- */

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) {
  console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
}
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fout.length ? 1 : 0);
