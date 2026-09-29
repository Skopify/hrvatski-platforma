/**
 * Bewaakt dat de oude, vlakke stijl niet terugkomt.
 * Draai met: npm run check:stijl
 *
 * De site is «Krabbel» (DESIGN.md): inktranden, pastelvlakken, handschrift voor
 * kopjes. Een pagina die het oude grijze of pastelbleke vak, de kleine hoofdletterkop of
 * de haarlijn gebruikt, valt naast de rest op. Dit vangt dat bij het maken op, niet
 * pas als iemand twee pagina's naast elkaar legt.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const bestanden = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? bestanden(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? [path.join(dir, e.name)] : [],
  );
const bron = bestanden("src").map((f) => ({ f, t: fs.readFileSync(path.join(root, f), "utf8") }));

const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });
const vind = (re: RegExp, uitzonderingen: string[] = []) =>
  bron.filter(({ f, t }) => !uitzonderingen.some((u) => f.endsWith(u)) && re.test(t)).map((x) => x.f);

const hoofdletters = vind(/uppercase/);
check("S1", "geen kleine hoofdletterkoppen (handschrift gebruiken)", hoofdletters.length === 0, hoofdletters.join(", "));

const soft = vind(/display-soft/);
check("S2", "geen oude kopstijl (display-soft): .display", soft.length === 0, soft.join(", "));

const wash = bron.filter(({ t }) => /(?<!hover:)(?<!\/)bg-(accent|warn|good|bad|gold)-wash(?!\/)/.test(t)).map((x) => x.f);
check("S3", "geen bleke wash-vakken (pastelvlak met inktrand gebruiken)", wash.length === 0, wash.join(", "));

const haarlijn = vind(/\bborder-[tb] border-line(-soft)?\b/);
check("S4", "geen haarlijnen (border-b border-line): dikke inktlijn of streepjeslijn", haarlijn.length === 0, haarlijn.join(", "));

// Grijs vlak alleen voor wat bewust uitgeschakeld of nog aan het laden is.
const sunken = vind(/bg-sunken/, ["loading.tsx", "lessen/page.tsx", "oefenen/page.tsx", "verhalen/page.tsx", "schrijven/page.tsx", "SpecialChars.tsx", "StoryReader.tsx"]);
check("S5", "een grijs vlak (bg-sunken) alleen voor een uitgeschakelde of ladende staat", sunken.length === 0, sunken.join(", "));

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
process.exit(fout.length ? 1 : 0);
