/**
 * Acceptatietests voor starten en stoppen van het platform.
 * Draai met: npm run check:levenscyclus
 *
 * Het platform start met één klik (Hrvatski.app) en zet zichzelf uit als je
 * klaar bent. Dat is alleen prettig als het nooit iets uitzet wat het niet
 * zelf gestart heeft, en nooit te vroeg stopt. Dit bewaakt die twee.
 *
 * Wat hier niet in zit: het echt starten van de app en van Ollama. Dat is
 * getest met een echte productieserver; zie docs/ARCHITECTUUR.md.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });
const leesRoot = (f: string) => fs.readFileSync(path.join(root, f), "utf8");

const { beslis, leven, teken, ollamaGebruikt, stopOllamaAlsEigen } = await import("../src/lib/levenscyclus");

const MIN = 60_000;
const inst = { beheerd: true, idleMs: 10 * MIN, ollamaIdleMs: 15 * MIN };
const basis = { lastSeen: 0, startedAt: 0, ollamaPid: null as number | null, ollamaLastUse: 0 };

/* ------------------------------------------------- wanneer de app stopt --- */

check("L1", "de app stopt na 10 minuten zonder teken van leven",
  beslis(11 * MIN, { ...basis }, inst).stopServer === true, "");
check("L2", "vlak voor de grens stopt hij nog niet", beslis(9 * MIN, { ...basis }, inst).stopServer === false, "");
check("L3", "een teken van leven zet de klok terug",
  beslis(14 * MIN, { ...basis, lastSeen: 8 * MIN }, inst).stopServer === false, "");
check("L4", "een net gestarte app krijgt de volle tijd om te openen (geen teken nodig)",
  beslis(5 * MIN, { ...basis, startedAt: 0 }, inst).stopServer === false, "");
check("L5", "een gewone dev-server (niet beheerd) zet zichzelf nooit uit",
  beslis(999 * MIN, { ...basis }, { ...inst, beheerd: false }).stopServer === false, "");

/* ------------------------------------------------ wanneer Ollama stopt --- */

check("L6", "zelf gestarte Ollama stopt na 15 minuten zonder gesprek",
  beslis(16 * MIN, { ...basis, ollamaPid: 1234, ollamaLastUse: 0 }, inst).stopOllama === true, "");
check("L7", "binnen die tijd blijft hij aan",
  beslis(14 * MIN, { ...basis, ollamaPid: 1234, ollamaLastUse: 0 }, inst).stopOllama === false, "");
check("L8", "Ollama die er al draaide (niet door ons gestart) wordt nooit gestopt",
  beslis(999 * MIN, { ...basis, ollamaPid: null }, inst).stopOllama === false, "");
check("L9", "ook in een niet-beheerde dev-server stopt de zelf gestarte Ollama na 15 minuten",
  beslis(16 * MIN, { ...basis, ollamaPid: 1234, ollamaLastUse: 0 }, { ...inst, beheerd: false }).stopOllama === true, "");

/* --------------------------------------------------------- de toestand --- */

const voor = leven().lastSeen;
await new Promise((r) => setTimeout(r, 15));
teken();
check("L10", "teken() verschuift het laatste levensteken", leven().lastSeen > voor, "");
const voorO = leven().ollamaLastUse;
await new Promise((r) => setTimeout(r, 15));
ollamaGebruikt();
check("L11", "ollamaGebruikt() verschuift het laatste gebruik", leven().ollamaLastUse > voorO, "");

/* -------------------------------------------- echt stoppen, met een proces --- */

const leeft = (pid: number) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const wacht = (ms: number) => new Promise((r) => setTimeout(r, ms));

const eigen = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
eigen.unref();
leven().ollamaPid = eigen.pid!;
stopOllamaAlsEigen();
await wacht(200);
check("L12", "een door ons gestart proces wordt gestopt", !leeft(eigen.pid!), "");
check("L13", "en de administratie is daarna leeg", leven().ollamaPid === null, "");

const vreemd = spawn("sleep", ["60"], { detached: true, stdio: "ignore" });
vreemd.unref();
leven().ollamaPid = null;
stopOllamaAlsEigen();
await wacht(200);
check("L14", "een proces dat wij niet gestart hebben blijft draaien", leeft(vreemd.pid!), "");
try {
  process.kill(vreemd.pid!, "SIGKILL");
} catch {}

/* ------------------------------------------------------- de aansluiting --- */

const afsluiten = leesRoot("src/app/api/afsluiten/route.ts");
check("L15", "afsluiten kan alleen met een eigen kop én alleen in de beheerde app",
  /x-hrvatski-actie/.test(afsluiten) && /instelling\(\)\.beheerd/.test(afsluiten), "");

const starter = leesRoot("scripts/app-start.sh");
check("L16", "de starter kijkt eerst of er al een server draait (nooit twee)", /URL="http:\/\/localhost:3000"/.test(starter) && /curl[^\n]*"\$URL"/.test(starter), "");
check("L17", "de starter zet HRVATSKI_MANAGED=1", /HRVATSKI_MANAGED=1/.test(starter), "");
check("L18", "de starter migreert via npm run migrate (met back-up), niet vanuit de app", /npm run -s migrate|npm run migrate/.test(starter), "");
check("L19", "de starter verwijdert nooit iets uit data/", !/rm\s+[^\n]*data\//.test(starter), "");
check("L20", "de starter luistert alleen op dit apparaat (127.0.0.1)", /-H 127\.0\.0\.1/.test(starter), "");

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
process.exit(fout.length ? 1 : 0);
