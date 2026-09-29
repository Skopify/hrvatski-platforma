/*
  De gespreksbot (BETA).

  §12.4 van de spec schrapte runtime-generatie, om twee redenen: het kost per
  aanroep geld, en wat het zegt is van buitenaf niet te overzien. De eerste
  reden vervalt bij een model dat lokaal draait. De tweede blijft, en daarom
  komt niets van de bot ongecontroleerd op het scherm:

    1. Elke zin gaat langs dezelfde poorten als de content: spelling,
       voorzetsel + naamval, servismen. Daarbovenop een woordenschatgrens.
    2. De bot krijgt alleen de woorden die jij nu hebt kunnen leren.
    3. Halen drie pogingen de poorten niet, dan zegt de app dat. Hij verzint
       zelf geen Kroatisch als vervanging.
    4. Een gesprek schrijft niets naar je leerhistorie. Het is vrije oefening,
       geen meting: wat het model zegt telt nergens als kennis.

  De functie beurt() krijgt het model als parameter. Zo bewijzen de tests de
  poorten zonder dat er een model aan te pas komt.
*/
import fs from "node:fs";
import path from "node:path";

import { analyze } from "./analyze";
import { loadLessons } from "./content";
import { controleer, type Tekstbevindingen } from "./tekstcontrole";

/* ------------------------------------------------------------ scenario's --- */

export interface Scenario {
  id: string;
  titel_nl: string;
  titel_hr: string;
  situatie_nl: string;
  /** Wie de bot is; in het Engels, want dat volgt het model het best. */
  bot_rol: string;
  opening_hr: string;
  opening_nl: string;
  doodle: string;
  /** Extra woorden voor deze situatie, ook als je ze nog niet had. Je krijgt ze vooraf te zien. */
  woorden: { hr: string; nl: string }[];
}

export function loadScenarios(): Scenario[] {
  const bestand = path.join(process.cwd(), "content", "gesprek", "scenarios.json");
  return (JSON.parse(fs.readFileSync(bestand, "utf8")) as { scenarios: Scenario[] }).scenarios;
}

export function loadScenario(id: string): Scenario | undefined {
  return loadScenarios().find((s) => s.id === id);
}

/* --------------------------------------------------------------- lexicon --- */

export interface Woord {
  id: string;
  hr: string;
  nl: string;
  pos: string;
  les: number;
}

/** Alle woorden uit de lessen 0 tot en met `les`. Nooit een woord uit een latere les. */
export function woordenTotLes(les: number): Woord[] {
  const uit: Woord[] = [];
  for (const l of loadLessons()) {
    if (l.number > les) continue;
    for (const v of l.vocab) uit.push({ id: v.id, hr: v.hr, nl: v.nl, pos: v.pos, les: l.number });
  }
  return uit;
}

/** Het hoogste les-nummer waar je aan mag beginnen, als startwaarde voor het lexicon. */
export function standaardLes(beschikbaar: number[]): number {
  const hoogste = beschikbaar.length ? Math.max(...beschikbaar) : 1;
  return Math.min(21, Math.max(3, hoogste + 2));
}

/* ---------------------------------------------------------------- prompt --- */

const MAX_WOORDEN_IN_PROMPT = 450;

export function bouwPrompt(scenario: Scenario, woorden: Woord[]): string {
  // Bij een groot lexicon eerst de eerste lessen: die heb je het langst geoefend.
  // Alleen het Kroatische woord: de Nederlandse glossen kosten ongeveer een derde
  // van de prompt en het model kent de betekenis toch. Elk token minder scheelt
  // seconden bij het eerste antwoord op een gewone laptop.
  const lijst = woorden
    .slice(0, MAX_WOORDEN_IN_PROMPT)
    .map((w) => w.hr)
    .join(", ");

  return [
    `You are role-playing a short conversation in Croatian. You play: ${scenario.bot_rol}.`,
    `Situation: ${scenario.situatie_nl}`,
    `The learner is a Dutch speaker at beginner level (A1). Speak standard Croatian (ijekavian, as spoken in Croatia). Never use Serbian forms (write "kava" not "kafa", "kruh" not "hleb", "mlijeko" not "mleko"). Always write the diacritics č ć đ š ž.`,
    `Rules:`,
    `- Answer in one or two SHORT sentences, at most 12 words each.`,
    `- Use ONLY words from the allowed list below, forms of those words, and basic function words (i, je, sam, u, na, s, ne, da, li, što, kako, gdje, and similar). Do not use any other content words.`,
    `- End with one simple question so that the conversation continues.`,
    `- React naturally to what the learner just said (answer their question, confirm their order), like a real person in this situation would. Do not repeat yourself.`,
    `- Facts: Croatia uses the euro (euro/eura), not the kuna. Stay realistic.`,
    `- Stay in your role. Do not explain grammar in Croatian.`,
    `Example of the style (café): learner "Kavu, molim." -> {"hr": "Naravno. Želite li i vodu?", "nl": "Natuurlijk. Wilt u ook water?", "tip_nl": ""}`,
    `Reply ONLY with a JSON object of this exact shape:`,
    `{"hr": "your Croatian reply", "nl": "Dutch translation of your reply", "tip_nl": "if the learner's last message contained a mistake, one short friendly tip in Dutch, otherwise an empty string"}`,
    `Extra allowed words for this situation: ${scenario.woorden.map((w) => w.hr).join(", ")}`,
    `Allowed words: ${lijst}`,
  ].join("\n");
}

/* ------------------------------------------------------------ de poort --- */

const MAX_ZINSWOORDEN = 40;
/** Aandeel inhoudswoorden buiten het lexicon dat we nog accepteren. */
const MAX_BUITEN = 0.34;

/**
 * Hoort dit woord bij een van de extra woorden van het scenario? Kroatisch
 * buigt, dus we vergelijken de stam: «ulicu» hoort bij «ulica». Een stam is het
 * woord minus de laatste één of twee letters, minimaal drie letters.
 */
function dektExtra(surface: string, extra: readonly string[]): boolean {
  const w = surface.toLowerCase();
  return extra.some((e) =>
    e
      .toLowerCase()
      .split(/\s+/)
      .some((deel) => {
        const stam = deel.slice(0, Math.max(3, deel.length - 2));
        return w === deel || (stam.length >= 3 && w.startsWith(stam));
      }),
  );
}

/** De woordvormen uit eerdere zinnen van de bot, kleine letters. */
export function gezienVormen(historie: Bericht[]): Set<string> {
  const uit = new Set<string>();
  for (const b of historie) {
    if (b.rol !== "bot") continue;
    for (const t of analyze(b.tekst)) uit.add(t.surface.toLowerCase());
  }
  return uit;
}

/** Redenen om een zin van de bot niet te tonen. Leeg = goed. */
export function keurBotAf(
  hr: string,
  woorden: Woord[],
  gezien: ReadonlySet<string> = new Set(),
  extra: readonly string[] = [],
): string[] {
  const redenen: string[] = [];
  const tekst = hr.trim();
  if (!tekst) return ["leeg antwoord"];

  const aantal = tekst.split(/\s+/).length;
  if (aantal > MAX_ZINSWOORDEN) redenen.push(`te lang (${aantal} woorden)`);

  const c = controleer(tekst);
  // Eigennamen (Ana, Zagreb) zijn geen fout; een woord dat de catalogus niet kent wel:
  // dat kunnen we niet controleren en dus tonen we het niet.
  for (const s of c.spelling.filter((x) => x.soort !== "naam")) redenen.push(`spelling: ${s.woord}`);
  for (const n of c.naamvallen) redenen.push(`naamval: ${JSON.stringify(n).slice(0, 80)}`);
  for (const s of c.servismen) redenen.push(`servisme: ${s.fout} → ${s.goed}`);

  // Woordenschat: een woord dat de ontleder niet kent telt nooit stilzwijgend als bekend.
  const toegestaan = new Set(woorden.map((w) => w.id));
  const inhoud = analyze(tekst).filter((t) => t.klasse !== "function" && t.klasse !== "proper");
  // Wat de bot zelf al eerder zei (en jij dus al hebt gezien) mag hij herhalen.
  const buiten = inhoud.filter(
    (t) =>
      !gezien.has(t.surface.toLowerCase()) &&
      !dektExtra(t.surface, extra) &&
      (t.unknown || !t.lemmaId || !toegestaan.has(t.lemmaId)),
  );
  if (inhoud.length && buiten.length / inhoud.length > MAX_BUITEN) {
    redenen.push(`woorden buiten je lexicon: ${buiten.map((t) => t.surface).join(", ")}`);
  }
  return redenen;
}

/* ---------------------------------------------------------------- beurt --- */

export interface Bericht {
  rol: "bot" | "jij";
  tekst: string;
}

/** Vraagt het model om één JSON-antwoord. */
export type Generator = (
  berichten: { role: "system" | "user" | "assistant"; content: string }[],
) => Promise<string>;

export type BeurtUitkomst =
  | {
      ok: true;
      hr: string;
      nl: string;
      /** Een tip van het model. Niet nagekeken: de app toont hem als tip, niet als regel. */
      tip_nl: string;
      /** Wat de poorten van jouw eigen laatste zin vonden. */
      jouw: Tekstbevindingen;
      pogingen: number;
    }
  | { ok: false; reden: "offline" | "model-ontbreekt" | "geen-goed-antwoord" | "fout"; detail?: string };

function alsJson(ruw: string): { hr?: unknown; nl?: unknown; tip_nl?: unknown } | null {
  const zonderHek = ruw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    const v = JSON.parse(zonderHek);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function storingsReden(e: unknown): "offline" | "model-ontbreekt" | "fout" {
  const err = e as { message?: string; status?: number; cause?: { code?: string } };
  if (err.status === 404) return "model-ontbreekt";
  const code = err.cause?.code ?? "";
  if (code === "ECONNREFUSED" || code === "ECONNRESET" || code === "UND_ERR_CONNECT_TIMEOUT") return "offline";
  if (/fetch failed|ECONNREFUSED/i.test(err.message ?? "")) return "offline";
  return "fout";
}

export async function beurt(opties: {
  scenario: Scenario;
  les: number;
  historie: Bericht[];
  generate: Generator;
  maxPogingen?: number;
}): Promise<BeurtUitkomst> {
  const { scenario, les, historie, generate } = opties;
  const maxPogingen = opties.maxPogingen ?? 3;
  const woorden = woordenTotLes(les);
  const system = bouwPrompt(scenario, woorden);

  const gezien = gezienVormen(historie);
  const laatste = historie.at(-1);
  const jouw = controleer(laatste?.rol === "jij" ? laatste.tekst : "");

  const berichten = [
    { role: "system" as const, content: system },
    ...historie.map((b) => ({
      role: b.rol === "bot" ? ("assistant" as const) : ("user" as const),
      content: b.tekst,
    })),
  ];

  let laatsteReden = "";
  // Bij een nieuwe poging krijgt het model te horen waarom de vorige werd afgekeurd.
  // Zonder dat maakt het dezelfde fout drie keer.
  const correcties: typeof berichten = [];
  for (let poging = 1; poging <= maxPogingen; poging++) {
    let ruw: string;
    try {
      ruw = await generate([...berichten, ...correcties]);
    } catch (e) {
      return { ok: false, reden: storingsReden(e), detail: e instanceof Error ? e.message : String(e) };
    }

    const data = alsJson(ruw);
    const hr = typeof data?.hr === "string" ? data.hr.trim() : "";
    if (!data || !hr) {
      laatsteReden = "geen bruikbare JSON";
      correcties.push(
        { role: "assistant", content: ruw.slice(0, 300) },
        { role: "user", content: 'That was not valid JSON. Reply ONLY with {"hr": "...", "nl": "...", "tip_nl": "..."}.' },
      );
      continue;
    }
    const redenen = keurBotAf(hr, woorden, gezien, scenario.woorden.map((w) => w.hr));
    if (redenen.length) {
      laatsteReden = redenen.join("; ");
      correcties.push(
        { role: "assistant", content: JSON.stringify({ hr, nl: "", tip_nl: "" }) },
        {
          role: "user",
          content: `Rejected by the checker: ${redenen.join("; ")}. Answer again in ONE very short, simple sentence, using ONLY words from the allowed list and basic function words. Same JSON format.`,
        },
      );
      continue;
    }
    return {
      ok: true,
      hr,
      nl: typeof data.nl === "string" ? data.nl.trim() : "",
      tip_nl: typeof data.tip_nl === "string" ? data.tip_nl.trim() : "",
      jouw,
      pogingen: poging,
    };
  }
  return { ok: false, reden: "geen-goed-antwoord", detail: laatsteReden };
}
