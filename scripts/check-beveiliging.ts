/**
 * Acceptatietests voor beveiliging en gegevensveiligheid.
 * Draai met: npm run check:beveiliging
 *
 * Deze tests bewaken afspraken die anders alleen in CLAUDE.md staan en dus
 * bij de eerste haast vergeten worden: geen geheimen in versiebeheer, een
 * back-up vóór elk script dat de database aanraakt, en een poort die alleen het
 * platform zelf doorlaat.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });
const git = (cmd: string) => execSync(`git ${cmd}`, { cwd: root, encoding: "utf8" });

/* ------------------------------------------------------------- geheimen --- */

const gevolgd = git("ls-files").split("\n").filter(Boolean);
const verdacht = gevolgd.filter((f) => /(^|\/)(azure\.env|\.env(\..*)?|secrets\/.*)$/.test(f) && f !== ".env.local.example");
check("B1", "geen enkel omgevingsbestand met geheimen staat in versiebeheer", verdacht.length === 0, verdacht.join(", "));

const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
check("B2", "azure.env, .env-bestanden, de database en de bronboeken staan in .gitignore",
  ["azure.env", "*.env", "data/", "*.pdf"].every((r) => ignore.includes(r)), "");

const geschiedenis = git("log --all --diff-filter=A --name-only --pretty=format:").split("\n").filter(Boolean);
const ooitGevolgd = geschiedenis.filter((f) => /(^|\/)azure\.env$|\.db$|\.pdf$/.test(f));
check("B3", "een geheim of de database heeft nooit in de git-geschiedenis gestaan", ooitGevolgd.length === 0, [...new Set(ooitGevolgd)].join(", "));

// Sleutelachtige waarden in de broncode: een lange hex- of base64-string achter "key".
const brontekst = gevolgd
  .filter((f) => /\.(ts|tsx|json|md|command|mjs)$/.test(f) && !f.startsWith("content/") && !f.startsWith(".claude/") && f !== "package-lock.json")
  .map((f) => ({ f, t: fs.readFileSync(path.join(root, f), "utf8") }));
const lekken = brontekst.filter(({ t }) => /(key|secret|token|password)\s*[:=]\s*["'][A-Za-z0-9+/]{32,}["']/i.test(t)).map((x) => x.f);
check("B4", "geen sleutelachtige waarde in de broncode", lekken.length === 0, lekken.join(", "));

/* --------------------------------------------------------- database-schrijven --- */

const scripts = fs.readdirSync(path.join(root, "scripts")).filter((f) => f.endsWith(".ts"));
const schrijvers = scripts.filter((f) => {
  const t = fs.readFileSync(path.join(root, "scripts", f), "utf8");
  const raaktEchteDb = /hrvatski\.db|src\/lib\/db"|\.\.\/src\/lib\/db['"]/.test(t) && !/HRVATSKI_DB\s*=\s*WERK_DB/.test(t);
  const schrijft = /\.(run|exec)\(|db\.(insert|update|delete)\b/.test(t);
  // Scripts die in een eigen tijdelijke map werken raken geen echte voortgang aan.
  const tijdelijk = /HRVATSKI_DATA\s*=|mkdtempSync/.test(t);
  return raaktEchteDb && schrijft && !tijdelijk;
});
const zonderBackup = schrijvers.filter((f) => !/backupDatabase/.test(fs.readFileSync(path.join(root, "scripts", f), "utf8")));
check("B5", "elk script dat naar de echte database schrijft maakt eerst een back-up (CLAUDE.md)",
  zonderBackup.length === 0, `zonder back-up: ${zonderBackup.join(", ")}`);

const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { scripts: Record<string, string> };
const kaalVerwijderen = Object.entries(pkg.scripts).filter(([, v]) => /\brm\b[^&|]*hrvatski\.db/.test(v)).map(([k]) => k);
check("B6", "geen npm-script verwijdert de database zonder kopie", kaalVerwijderen.length === 0, kaalVerwijderen.join(", "));

const dbIndex = fs.readFileSync(path.join(root, "src/lib/db/index.ts"), "utf8");
check("B7", "de database migreert nooit vanuit de draaiende applicatie voor een bestaand bestand",
  /weigert|throw new Error/.test(dbIndex) && /pendingMigrations/.test(dbIndex), "");

/* ------------------------------------------------------------ de poort --- */

const { hostToegestaan } = await import("../src/middleware");
check("B8", "eigen hostnamen worden toegelaten (localhost, loopback, privénetwerk, .local)",
  ["localhost:3000", "127.0.0.1:3000", "[::1]:3000", "192.168.1.20:3000", "10.0.0.5:3000", "172.20.1.1:3000", "mijn-mac.local:3000"].every(hostToegestaan), "");
check("B9", "vreemde hostnamen worden geweigerd (DNS-rebinding)",
  ["evil.com", "localhost.evil.com:3000", "127.0.0.1.evil.com", "8.8.8.8:3000", "172.32.0.1", "", null].every((h) => !hostToegestaan(h as string | null)), "");

const nextConfig = fs.readFileSync(path.join(root, "next.config.ts"), "utf8");
check("B10", "de beveiligingskoppen staan aan (CSP, frame-ancestors, nosniff, geen X-Powered-By)",
  ["Content-Security-Policy", "frame-ancestors 'none'", "nosniff", "poweredByHeader: false", "object-src 'none'"].every((x) => nextConfig.includes(x)), "");
check("B11", "de server luistert standaard alleen op dit apparaat (127.0.0.1)",
  /next dev -H 127\.0\.0\.1/.test(pkg.scripts.dev ?? "") && /next start -H 127\.0\.0\.1/.test(pkg.scripts.start ?? ""), `${pkg.scripts.dev} | ${pkg.scripts.start}`);

/* ------------------------------------------------------------- invoer --- */

const { antwoordtijd, binnen, tekst } = await import("../src/lib/valideer");
check("B12", "vreemde getallen worden begrensd", antwoordtijd(1e15) === 3_600_000 && antwoordtijd(-5) === 0 && antwoordtijd("x") === 0 && binnen(NaN, 1, 9, 5) === 5, "");
check("B13", "tekst wordt afgekapt en niet-tekst wordt leeg", tekst("a".repeat(50), 10).length === 10 && tekst({ x: 1 }, 10) === "", "");

/* -------------------------------------------------------- accounts en toegang --- */

const apiRoutes = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? apiRoutes(path.join(dir, e.name)) : e.name === "route.ts" ? [path.join(dir, e.name)] : [],
  );
const OPENBAAR_API = ["api/auth/inloggen", "api/auth/registreren", "api/auth/vergeten", "api/auth/uitloggen", "api/leven"];
const onbeschermd = apiRoutes("src/app/api")
  .filter((f) => !OPENBAAR_API.some((o) => f.replace(/\\/g, "/").includes(o + "/route.ts")))
  .filter((f) => !/eisGebruiker|eisEigenaar|gebruikerVanRequest/.test(fs.readFileSync(path.join(root, f), "utf8")));
check("B16", "elke API-route vraagt om een ingelogde gebruiker, behalve inloggen, registreren en het teken van leven",
  onbeschermd.length === 0, onbeschermd.join(", "));

const appLayout = fs.readFileSync(path.join(root, "src/app/(app)/layout.tsx"), "utf8");
check("B17", "alles onder (app) zit achter vereisGebruiker() in de layout", /vereisGebruiker\(\)/.test(appLayout), "");

const dbIndexTekst = fs.readFileSync(path.join(root, "src/lib/db/index.ts"), "utf8");
check("B18", "de database geeft zonder gebruiker een fout in plaats van een lege of gedeelde database (faalt dicht)",
  /GeenGebruikerError/.test(dbIndexTekst) && /huidigeGebruikerId\(\)/.test(dbIndexTekst), "");

const mid = fs.readFileSync(path.join(root, "src/middleware.ts"), "utf8");
check("B19", "de middleware stuurt niet-ingelogden naar /inloggen en houdt beheer alleen op de laptop",
  /const PUBLIEK/.test(mid) && /\/inloggen/.test(mid) && /MAC_ALLEEN/.test(mid), "");

const wachtwoordTekst = fs.readFileSync(path.join(root, "src/lib/accounts/wachtwoord.ts"), "utf8");
check("B20", "wachtwoorden gaan door scrypt met eigen zout (geen zwakke of snelle hash)", /scrypt/.test(wachtwoordTekst) && !/createHash\("(md5|sha1)"/.test(wachtwoordTekst), "");

/* -------------------------------------------------------- Azure-instelling --- */

process.env.KEY = "iets-anders-uit-mijn-terminal";
process.env.REGION = "evil.example.com/#";
process.env.AZURE_SPEECH_REGION = "northeurope.evil.com/";
const { azureEnv } = await import("../src/lib/speech/env");
const env = azureEnv();
check("B14", "een algemene omgevingsvariabele (KEY, REGION) wordt nooit als Azure-sleutel gebruikt", env.key !== "iets-anders-uit-mijn-terminal", "");
check("B15", "een regio met een punt of slash wordt afgewezen (de sleutel gaat mee in het adres)", env.region === null, String(env.region));

/* -------------------------------------------------------------- uitslag --- */

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
process.exit(fout.length ? 1 : 0);
