/**
 * Bewaakt de afspraken voor telefoon en iPad die je niet aan één pagina ziet.
 * Draai met: npm run check:responsive
 *
 * Wat een browser kan meten (afmetingen op een echt scherm) staat in de
 * handmatige controle; dit bewaakt wat je in de code kunt afdwingen, zodat een
 * volgende wijziging het niet stilletjes terugdraait.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const lees = (f: string) => fs.readFileSync(path.join(root, f), "utf8");
const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });

const bronnen = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? bronnen(path.join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );
const alles = bronnen("src").map((f) => ({ f, t: lees(f) }));

const layout = lees("src/app/layout.tsx");
check("R1", "viewport: volledig scherm (notch) en het toetsenbord verkleint de pagina", /viewportFit: "cover"/.test(layout) && /interactiveWidget: "resizes-content"/.test(layout), "");

const vh = alles.filter(({ f, t }) => f !== "src/app/globals.css" && /\bh-screen\b|\bmin-h-screen\b|100vh/.test(t)).map((x) => x.f);
check("R2", "geen 100vh of h-screen (iOS Safari rekent de adresbalk mee): dvh gebruiken", vh.length === 0, vh.join(", "));

const css = lees("src/app/globals.css");
check("R3", "aanraakschermen: velden nooit kleiner dan 16px (anders zoomt iOS in)", /@media \(pointer: coarse\)[\s\S]*font-size:\s*16px\s*!important/.test(css), "");
check("R4", "aanraakschermen: knoppen en velden minstens 44px hoog", /@media \(pointer: coarse\)[\s\S]*min-height:\s*44px/.test(css), "");
check("R5", "geen dubbeltik-zoom of vertraging op knoppen en links", /touch-action:\s*manipulation/.test(css), "");

const png = (f: string) => {
  const b = fs.readFileSync(path.join(root, f));
  return b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a" ? [b.readUInt32BE(16), b.readUInt32BE(20)] : [0, 0];
};
const iconen: [string, number][] = [["public/icons/icon-192.png", 192], ["public/icons/icon-512.png", 512], ["public/icons/icon-maskable-512.png", 512], ["public/icons/apple-touch-icon.png", 180]];
const foutIcoon = iconen.filter(([f, n]) => !fs.existsSync(path.join(root, f)) || png(f)[0] !== n || png(f)[1] !== n).map(([f]) => f);
check("R6", "de iconen voor het beginscherm bestaan en hebben de goede maat", foutIcoon.length === 0, foutIcoon.join(", "));

const manifest = lees("src/app/manifest.ts");
check("R7", "het manifest: standalone, start_url, icoon 192 en 512 en een maskable", /display: "standalone"/.test(manifest) && /icon-192\.png/.test(manifest) && /icon-512\.png/.test(manifest) && /maskable/.test(manifest), "");
check("R8", "de layout verwijst naar apple-touch-icon en zet appleWebApp aan", /apple: "\/icons\/apple-touch-icon\.png"/.test(layout) && /appleWebApp:\s*\{\s*capable: true/.test(layout), "");

const nav = lees("src/components/Nav.tsx");
const tabs = /const TAB_KEYS: SectionKey\[\] = \[([^\]]*)\]/.exec(nav)?.[1]?.split(",").filter((x) => x.trim()).length ?? 99;
check("R9", "de tabbalk op de telefoon heeft hooguit vijf plekken (vier secties en Meer)", tabs + 1 <= 5 && /grid-cols-5/.test(nav), `${tabs} secties`);
check("R10", "de tabbalk respecteert het onderste veilige gebied (home-indicator)", /safe-area-inset-bottom/.test(nav), "");

// Losse terug-links zijn 20px hoog en dus lastig te raken zonder .tap-link.
const terug = alles.filter(({ t }) => /aria-hidden>←<\/span>|>\s*← /.test(t)).filter(({ t }) => !/tap-link/.test(t)).map((x) => x.f);
check("R11", "elke terug-link heeft een ruime raakzone (.tap-link)", terug.length === 0, terug.join(", "));

const woord = alles.find(({ f }) => f.endsWith("StoryReader.tsx"))!.t;
check("R12", "woorden in een verhaal blijven inline tekst en krijgen geen 44px-knop (.no-tap)", /no-tap rounded/.test(woord), "");

check("R13", "de Kroatische lettertoetsen zijn er niet op een aanraakscherm (daar wissel je van toetsenbordtaal)",
  /@media \(pointer: coarse\)[\s\S]*\.special-chars[\s\S]*display:\s*none/.test(css) && /special-chars flex/.test(lees("src/components/SpecialChars.tsx")) && /special-chars-wrap/.test(lees("src/components/GesprekRunner.tsx")), "");

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
process.exit(fout.length ? 1 : 0);
