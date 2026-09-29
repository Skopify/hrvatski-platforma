/**
 * Meet hoe goed de gespreksbot is, met een vaste set beurten (content/gesprek/testset.json).
 * Draai met: npm run meet:gesprek            (huidig model)
 *            HRVATSKI_MODEL=qwen3:8b npm run meet:gesprek
 *
 * Per beurt: haalde het antwoord de taalpoorten (en zo ja, na hoeveel pogingen), hoe lang
 * duurde het, en zag het model de fout van de leerder? Een goede zin mag niet «verbeterd»
 * worden. Alleen lezen: het draait op een kopie en schrijft niets naar de leerhistorie.
 * Uitkomst: tabel in de terminal + JSON in data-test/metingen/.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { testBron } from "../src/lib/data";

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-meting-"));
const WERK_DB = path.join(TMP, "werk.db");
{
  const src = new Database(testBron(), { readonly: true });
  await src.backup(WERK_DB);
  src.close();
}
process.env.HRVATSKI_DB = WERK_DB;

const { beurt, loadScenario } = await import("../src/lib/gesprek");
const { MODEL, ollamaChat } = await import("../src/lib/ollama");

interface Case { scenario: string; jij: string; goed?: string }
const set = JSON.parse(fs.readFileSync("content/gesprek/testset.json", "utf8")).beurten as Case[];
const LES = Number(process.env.MEET_LES ?? 8);
const norm = (t: string) => t.toLowerCase().replace(/[.,!?]/g, "").replace(/\s+/g, " ").trim();

const rijen: Record<string, unknown>[] = [];
for (const c of set) {
  const sc = loadScenario(c.scenario);
  if (!sc) throw new Error(`onbekend scenario ${c.scenario}`);
  const start = Date.now();
  const u = await beurt({
    scenario: sc,
    les: LES,
    historie: [
      { rol: "bot", tekst: sc.opening_hr },
      { rol: "jij", tekst: c.jij },
    ],
    generate: (b) => ollamaChat(b),
  });
  const ms = Date.now() - start;
  if (!u.ok) {
    rijen.push({ ...c, gelukt: false, reden: u.reden, ms });
    console.log(`✗ ${c.scenario.padEnd(12)} ${c.jij.padEnd(28)} ${u.reden} (${u.detail?.slice(0, 60) ?? ""})`);
    continue;
  }
  const v = u.verbeterd?.tekst ?? "";
  const fouteInvoer = !!c.goed;
  // Fout gezien = de correctie komt overeen met de bedoelde zin. Vals alarm = een goede zin «verbeterd».
  const gezien = fouteInvoer ? norm(v) === norm(c.goed!) : null;
  const valsAlarm = !fouteInvoer && !!v && norm(v) !== norm(c.jij);
  rijen.push({ ...c, gelukt: true, pogingen: u.pogingen, ms, antwoord: u.hr, verbeterd: v || null, bron: u.verbeterd?.bron ?? null, gezien, valsAlarm });
  console.log(`${u.pogingen === 1 ? "✓" : "~"} ${c.scenario.padEnd(12)} ${c.jij.padEnd(28)} p${u.pogingen} ${String(ms).padStart(5)}ms ${fouteInvoer ? (gezien ? "fout gezien" : "fout gemist") : valsAlarm ? "VALS ALARM" : ""}`);
}

const gelukt = rijen.filter((r) => r.gelukt);
const eerste = gelukt.filter((r) => r.pogingen === 1).length;
const fout = rijen.filter((r) => r.goed);
const gezien = fout.filter((r) => r.gezien).length;
const goed = rijen.filter((r) => !r.goed);
const vals = goed.filter((r) => r.valsAlarm).length;
const ms = gelukt.map((r) => r.ms as number).sort((a, b) => a - b);
const samenvatting = {
  model: MODEL,
  les: LES,
  beurten: rijen.length,
  antwoordGeslaagd: gelukt.length,
  eersteKeerGoed: eerste,
  foutenGezien: `${gezien}/${fout.length}`,
  valseAlarmen: `${vals}/${goed.length}`,
  medianeMs: ms[Math.floor(ms.length / 2)] ?? null,
};
console.log("\n" + JSON.stringify(samenvatting, null, 2));

const dir = path.resolve("data-test", "metingen");
fs.mkdirSync(dir, { recursive: true });
const naam = `${MODEL.replace(/[^\w.-]/g, "_")}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.json`;
fs.writeFileSync(path.join(dir, naam), JSON.stringify({ samenvatting, rijen }, null, 2));
console.log(`Opgeslagen: data-test/metingen/${naam}`);
fs.rmSync(TMP, { recursive: true, force: true });
