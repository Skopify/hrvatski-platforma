/**
 * Verwerkt content/patch-*.json in de lesbestanden. Draai met: npm run patch
 *
 * Twee bewerkingen:
 *   vervang      — overschrijft bestaande oefeningen op id, op hun eigen plek
 *   tekstvragen  — zet nieuwe oefeningen vóóraan in de sectie met de leestekst
 *
 * ── Waarom dit met tekst werkt en niet met JSON.stringify ──────────────────
 * De lesbestanden zijn met de hand opgemaakt: woordenlijsten en paradigmarijen
 * staan op één regel, lange opsommingen juist niet. Geen enkele serializer geeft
 * die mengvorm terug. Alles opnieuw uitschrijven zou lesson-05 van 646 naar 1712
 * regels tillen en het verschil onleesbaar maken — precies wat je niet wilt bij
 * een contentwijziging die je wilt kunnen nalezen.
 *
 * Daarom wordt alleen het fragment vervangen dat verandert. De rest van elk
 * bestand blijft byte voor byte staan.
 *
 * Idempotent: opnieuw draaien geeft hetzelfde resultaat, doordat een tekstvraag
 * die er al staat eerst wordt verwijderd. Oefening-id's blijven bij een
 * vervanging gelijk, zodat eerdere pogingen en foutmeldingen blijven kloppen.
 */
import fs from "node:fs";
import path from "node:path";

interface Exercise {
  id: string;
  [key: string]: unknown;
}

const DIR = path.join(process.cwd(), "content", "lessons");
const read = (f: string) =>
  JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", f), "utf-8"));

const vervang = read("patch-tekstoefeningen.json").vervang as Record<string, Omit<Exercise, "id">>;
const tekstvragen = read("patch-tekstvragen.json") as Record<string, Exercise[]>;

/* ------------------------------------------------------------ opmaak --- */

/** Eén oefening uitschrijven in de stijl van de bestaande bestanden. */
function formatExercise(e: Exercise, indent: string): string {
  const inner = indent + "  ";
  const lines = Object.entries(e).map(([k, v]) => {
    // Rijtjes met alleen tekst blijven op één regel, net als in de bestanden.
    const flat = Array.isArray(v) && v.every((x) => typeof x !== "object" || x === null);
    if (flat) return `${inner}${JSON.stringify(k)}: ${JSON.stringify(v)}`;
    if (Array.isArray(v)) {
      const items = v.map((x) => `${inner}  ${JSON.stringify(x)}`).join(",\n");
      return `${inner}${JSON.stringify(k)}: [\n${items}\n${inner}]`;
    }
    return `${inner}${JSON.stringify(k)}: ${JSON.stringify(v)}`;
  });
  return `${indent}{\n${lines.join(",\n")}\n${indent}}`;
}

/* ------------------------------------------------------- tekstsurgery --- */

/**
 * Zoekt het object waarin `"id": "<id>"` staat en geeft begin- en eindpositie.
 * Telt accolades, en slaat die binnen tekst tussen aanhalingstekens over —
 * anders zou een { in een Nederlandse uitleg de telling laten ontsporen.
 */
function objectSpan(text: string, id: string): { start: number; end: number; indent: string } | null {
  const marker = text.indexOf(`"id": ${JSON.stringify(id)}`);
  if (marker < 0) return null;

  let start = text.lastIndexOf("{", marker);
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) {
        const lineStart = text.lastIndexOf("\n", start) + 1;
        return { start, end: i + 1, indent: text.slice(lineStart, start) };
      }
    }
  }
  return null;
}

/* ---------------------------------------------------------- uitvoeren --- */

let vervangen = 0;
let toegevoegd = 0;
const ongebruikt = new Set(Object.keys(vervang));

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const full = path.join(DIR, file);
  let text = fs.readFileSync(full, "utf-8");
  const lesson = JSON.parse(text);
  const before = text;

  /* 1. Vervangingen, op hun eigen plek in het bestand. */
  for (const [id, patch] of Object.entries(vervang)) {
    const span = objectSpan(text, id);
    if (!span) continue;
    ongebruikt.delete(id);
    const nieuw = formatExercise({ id, ...patch }, span.indent);
    text = text.slice(0, span.start) + nieuw.trimStart() + text.slice(span.end);
    vervangen++;
  }

  /* 2. Tekstvragen vooraan de sectie met de leestekst. */
  const extra = tekstvragen[String(lesson.number)];
  if (extra?.length) {
    const target = lesson.sections.find((s: { text_hr?: string }) => s.text_hr);
    if (!target) {
      console.warn(`  les ${lesson.number}: geen sectie met leestekst — overgeslagen`);
    } else {
      // Eerst eventuele oudere versies weghalen, zodat draaien herhaalbaar is.
      for (const e of extra) {
        const span = objectSpan(text, e.id);
        if (!span) continue;
        // Tot en met de eigen regelovergang wissen. Alle witruimte opslokken zou
        // de inspringing van de vólgende oefening meenemen, en dan schuift het
        // bestand elke keer dat je dit draait een stukje op.
        let end = span.end;
        if (text[end] === ",") end++;
        while (text[end] === " " || text[end] === "\t") end++;
        if (text[end] === "\n") end++;
        const lineStart = text.lastIndexOf("\n", span.start) + 1;
        text = text.slice(0, lineStart) + text.slice(end);
      }

      // De sectie terugvinden en direct achter "exercises": [ invoegen.
      const secAt = text.indexOf(`"id": ${JSON.stringify(target.id)}`);
      const exAt = text.indexOf('"exercises": [', secAt);
      if (secAt < 0 || exAt < 0) {
        console.warn(`  les ${lesson.number}: sectie ${target.id} niet gevonden`);
      } else {
        const insertAt = exAt + '"exercises": ['.length;
        const lineStart = text.lastIndexOf("\n", exAt) + 1;
        const indent = text.slice(lineStart, exAt) + "  ";
        const blok = extra.map((e) => formatExercise(e, indent)).join(",\n");
        const rest = text.slice(insertAt).trimStart().startsWith("]") ? "" : ",";
        text = text.slice(0, insertAt) + "\n" + blok + rest + text.slice(insertAt);
        toegevoegd += extra.length;
      }
    }
  }

  if (text !== before) {
    JSON.parse(text); // vangt een kapot bestand vóór het wordt weggeschreven
    fs.writeFileSync(full, text);
  }
}

console.log(`${vervangen} oefeningen vervangen, ${toegevoegd} tekstvragen geplaatst`);
if (ongebruikt.size) {
  console.log(`\nNiet gevonden in de lessen: ${[...ongebruikt].join(", ")}`);
  process.exit(1);
}
