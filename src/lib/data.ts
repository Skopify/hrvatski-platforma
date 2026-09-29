import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/*
  Waar de databases staan.

    data/accounts.db                 wie er bestaat: namen, wachtwoord-hashes, sessies
    data/gebruikers/<id>/hrvatski.db de voortgang van één gebruiker (hetzelfde schema als altijd)
    data/sjabloon.db                 een verse database zonder voortgang; elke nieuwe gebruiker begint als kopie
    data/hrvatski.db                 alleen op een installatie van vóór de accounts: de eerste account neemt hem over

  Eén bestand per gebruiker betekent dat de scheiding fysiek is: er bestaat geen
  zoekopdracht die per ongeluk de voortgang van een ander kan tonen, omdat die in een
  ander bestand staat. HRVATSKI_DATA verplaatst dit alles, voor tests.
*/
export function dataDir(): string {
  return process.env.HRVATSKI_DATA ? path.resolve(process.env.HRVATSKI_DATA) : path.join(process.cwd(), "data");
}

export const gebruikersDir = () => path.join(dataDir(), "gebruikers");

/** Alleen cijfers: een id kan nooit een pad buiten zijn eigen map opleveren. */
const veiligId = (id: number | string) => {
  const n = Number.parseInt(String(id), 10);
  return Number.isInteger(n) && n > 0 ? String(n) : "ongeldig";
};

export const gebruikerDir = (id: number | string) => path.join(gebruikersDir(), veiligId(id));
export const gebruikerDbPad = (id: number | string) => path.join(gebruikerDir(id), "hrvatski.db");
export const accountsPad = () => path.join(dataDir(), "accounts.db");
export const sjabloonPad = () => path.join(dataDir(), "sjabloon.db");
export const legacyDbPad = () => path.join(dataDir(), "hrvatski.db");

/** Alle voortgangsdatabases die bestaan, voor scripts die ze allemaal moeten bijwerken (seed, migrate). */
export function alleDbPaden(): { naam: string; pad: string }[] {
  const uit: { naam: string; pad: string }[] = [];
  if (fs.existsSync(legacyDbPad())) uit.push({ naam: "hrvatski.db (van vóór de accounts)", pad: legacyDbPad() });
  if (fs.existsSync(sjabloonPad())) uit.push({ naam: "sjabloon", pad: sjabloonPad() });
  if (fs.existsSync(gebruikersDir())) {
    for (const e of fs.readdirSync(gebruikersDir(), { withFileTypes: true })) {
      const pad = path.join(gebruikersDir(), e.name, "hrvatski.db");
      if (e.isDirectory() && fs.existsSync(pad)) uit.push({ naam: `gebruiker ${e.name}`, pad });
    }
  }
  return uit;
}

/** Een verse database zonder voortgang: het sjabloon. Bestaat hij niet, dan bouwen we hem uit de content. */
export function zorgVoorSjabloon(): string {
  const pad = sjabloonPad();
  if (fs.existsSync(pad)) return pad;
  fs.mkdirSync(path.dirname(pad), { recursive: true });
  const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/seed.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, HRVATSKI_DB: pad },
    encoding: "utf8",
    timeout: 180_000,
  });
  if (r.status !== 0 || !fs.existsSync(pad)) {
    throw new Error(`Het sjabloon kon niet worden gebouwd. ${(r.stderr || r.stdout || "").slice(-300)}`);
  }
  return pad;
}

/**
 * Een database om tests van te kopiëren (de tests schrijven nooit naar het origineel):
 * HRVATSKI_TEST_BRON, anders de oude installatie, anders de eerste gebruiker, anders het sjabloon.
 * De tests hebben echte-achtige data nodig, geen lege, maar draaien ook in CI met alleen een sjabloon.
 */
export function testBron(): string {
  if (process.env.HRVATSKI_TEST_BRON) return path.resolve(process.env.HRVATSKI_TEST_BRON);
  const alle = alleDbPaden();
  const voorkeur = alle.find((d) => d.pad === legacyDbPad()) ?? alle.find((d) => d.naam.startsWith("gebruiker")) ?? alle.find((d) => d.naam === "sjabloon");
  return voorkeur?.pad ?? zorgVoorSjabloon();
}
