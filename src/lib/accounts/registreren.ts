import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { backupDatabase } from "../db/backup";
import { sluitDb } from "../db";
import { alleDbPaden, dataDir, gebruikerDbPad, gebruikerDir, legacyDbPad, zorgVoorSjabloon } from "../data";
import { Begrenzing } from "../koppelen";
import { valideerNaam, valideerWachtwoord, valideerWeergavenaam } from "./regels";
import { controleerWachtwoord, hashWachtwoord, nepHash, nieuweHerstelcode, normaliseerCode } from "./wachtwoord";
import * as store from "./store";
import type { Gebruiker } from "./store";

/*
  De flows: registreren, inloggen, wachtwoord wijzigen en vergeten, beheer, verwijderen.
  Alles wat een uitkomst kan hebben die je de gebruiker moet vertellen, geeft een melding in
  gewone taal terug; alles wat nooit mag gebeuren (rechten, de laatste eigenaar) gooit een fout.
*/

/* ------------------------------------------------------- de database zelf --- */

const telRijen = (d: Database.Database) =>
  ["review_log", "srs", "card", "attempts", "study_sessions", "error_log"].map(
    (t) => `${t}=${(d.prepare(`SELECT count(*) c FROM ${t}`).get() as { c: number }).c}`,
  ).join(",");

/**
 * De bestaande installatie (data/hrvatski.db) wordt van de eerste account.
 *
 * Verplaatsen, niet kopiëren, zodat er één waarheid is. Vooraf een back-up, en achteraf een
 * controle dat er niets verloren is; klopt die niet, dan gaat het bestand terug en mislukt de
 * registratie. Het reviewlogboek is het enige wat je niet terugkrijgt door harder te studeren.
 */
function neemOudeDbOver(gebruikerId: number): boolean {
  const oud = legacyDbPad();
  if (!fs.existsSync(oud)) return false;
  sluitDb(oud);

  const bron = new Database(oud);
  bron.pragma("wal_checkpoint(TRUNCATE)");
  const voor = telRijen(bron);
  backupDatabase(bron, "voor-accounts", oud);
  bron.close();

  const doel = gebruikerDbPad(gebruikerId);
  fs.mkdirSync(gebruikerDir(gebruikerId), { recursive: true });
  fs.renameSync(oud, doel);
  for (const ext of ["-wal", "-shm"]) fs.rmSync(oud + ext, { force: true });

  const controle = new Database(doel, { readonly: true });
  const na = telRijen(controle);
  controle.close();
  if (na !== voor) {
    fs.renameSync(doel, oud);
    throw new Error(`Het overnemen van je voortgang klopte niet (${voor} ≠ ${na}); niets is veranderd.`);
  }
  return true;
}

function kopieerSjabloon(gebruikerId: number): void {
  const sjabloon = zorgVoorSjabloon();
  const doel = gebruikerDbPad(gebruikerId);
  fs.mkdirSync(gebruikerDir(gebruikerId), { recursive: true });
  const b = new Database(sjabloon, { readonly: true });
  try {
    b.prepare("VACUUM INTO ?").run(doel);
  } finally {
    b.close();
  }
}

/* ------------------------------------------------------------ begrenzing --- */

// Per naam: 5 fouten, dan 15 minuten dicht. Per bron (apparaat): 30 fouten per kwartier.
// Geen algemene vergrendeling: dan kan iedereen alle anderen buitensluiten.
type Poging = { tijden: number[]; dichtTot: number };
const perNaam = new Map<string, Poging>();
const perBron = new Begrenzing(30, 10_000, 0);
const KWARTIER = 15 * 60_000;

function vrij(sleutel: string, nu = Date.now()): boolean {
  const p = perNaam.get(sleutel);
  if (!p) return true;
  if (nu < p.dichtTot) return false;
  p.tijden = p.tijden.filter((t) => nu - t < KWARTIER);
  return true;
}
function faal(sleutel: string, nu = Date.now()): boolean {
  const p = perNaam.get(sleutel) ?? { tijden: [], dichtTot: 0 };
  p.tijden = p.tijden.filter((t) => nu - t < KWARTIER);
  p.tijden.push(nu);
  if (p.tijden.length >= 5) p.dichtTot = nu + KWARTIER;
  perNaam.set(sleutel, p);
  return p.tijden.length >= 5;
}
const wisFouten = (naam: string) => {
  for (const k of [naam.toLowerCase(), `vergeten:${naam.toLowerCase()}`]) perNaam.delete(k);
};

/* ----------------------------------------------------------- registreren --- */

export const registratieOpen = () => store.aantalGebruikers() === 0 || store.instelling("registratie", "open") === "open";

export async function registreer(v: {
  naam: string;
  weergavenaam: string;
  wachtwoord: string;
  vanLaptop: boolean;
}): Promise<{ gebruiker: Gebruiker; herstelcode: string; overgenomen: boolean }> {
  const naam = (v.naam ?? "").trim();
  const weergave = (v.weergavenaam ?? "").trim() || naam;
  const fout = valideerNaam(naam) ?? valideerWeergavenaam(weergave) ?? valideerWachtwoord(v.wachtwoord, naam);
  if (fout) throw new Error(fout);

  const eerste = store.aantalGebruikers() === 0;
  // De eerste account is de eigenaar en neemt de bestaande voortgang over. Dat mag alleen
  // vanaf de laptop zelf: anders pakt wie het eerst een telefoon in de hand heeft alles.
  if (eerste && !v.vanLaptop) throw new Error("Het eerste account maak je op de laptop zelf.");
  if (!eerste && !registratieOpen()) throw new Error("Nieuwe accounts kunnen nu niet worden aangemaakt.");
  if (store.vindOpNaam(naam)) throw new Error("Die gebruikersnaam is al in gebruik.");

  const herstelcode = nieuweHerstelcode();
  const [wachtwoordHash, herstelHash] = await Promise.all([hashWachtwoord(v.wachtwoord), hashWachtwoord(normaliseerCode(herstelcode))]);

  // Eerst de gebruiker (voor zijn id), dan zijn database. Mislukt die, dan gaat de gebruiker weer weg.
  const gebruiker = store.maakGebruiker({ naam, weergavenaam: weergave, wachtwoordHash, herstelHash, rol: eerste ? "eigenaar" : "gebruiker" });
  try {
    const overgenomen = eerste ? neemOudeDbOver(gebruiker.id) : false;
    if (!overgenomen) kopieerSjabloon(gebruiker.id);
    return { gebruiker, herstelcode, overgenomen };
  } catch (e) {
    store.verwijderGebruikerRij(gebruiker.id);
    fs.rmSync(gebruikerDir(gebruiker.id), { recursive: true, force: true });
    throw e;
  }
}

/* -------------------------------------------------------------- inloggen --- */

const ALGEMEEN = "Gebruikersnaam of wachtwoord klopt niet.";

export type LoginUitkomst =
  | { ok: true; token: string; gebruiker: Gebruiker }
  | { ok: false; melding: string; vergrendeld?: boolean };

export async function inloggen(v: { naam: string; wachtwoord: string; bron: string; apparaat: string }): Promise<LoginUitkomst> {
  const naam = (v.naam ?? "").trim();
  const sleutel = naam.toLowerCase();
  if (!vrij(sleutel) || !perBron.toegestaan(v.bron)) {
    return { ok: false, vergrendeld: true, melding: "Te veel pogingen. Wacht een kwartier en probeer het dan opnieuw." };
  }

  const g = naam.length <= 24 ? store.vindOpNaam(naam) : null;
  // Voor een onbekende naam evenveel rekenwerk als voor een bekende, zodat de tijd niets verraadt.
  const goed = await controleerWachtwoord(v.wachtwoord ?? "", g ? g.wachtwoordHash : await nepHash());
  if (!g || !goed) {
    faal(sleutel);
    perBron.fout(v.bron);
    return { ok: false, melding: ALGEMEEN };
  }
  wisFouten(sleutel);
  store.markeerLogin(g.id);
  const { wachtwoordHash: _w, herstelHash: _h, ...openbaar } = g;
  return { ok: true, token: store.maakSessie(g.id, v.apparaat), gebruiker: openbaar };
}

/* ---------------------------------------------------- wachtwoord wijzigen --- */

export async function wijzigWachtwoord(v: { gebruikerId: number; huidig: string; nieuw: string; behoudToken?: string }): Promise<void> {
  const g = store.vindOpId(v.gebruikerId);
  if (!g) throw new Error("Onbekend account.");
  if (!(await controleerWachtwoord(v.huidig ?? "", g.wachtwoordHash))) throw new Error("Je huidige wachtwoord klopt niet.");
  const fout = valideerWachtwoord(v.nieuw, g.naam);
  if (fout) throw new Error(fout);
  store.zetWachtwoordHash(g.id, await hashWachtwoord(v.nieuw));
  // Wie het wachtwoord verandert omdat een ander het kent, wil die ander buiten hebben.
  store.verwijderSessiesVan(g.id, v.behoudToken);
}

export async function vernieuwHerstelcode(v: { gebruikerId: number; wachtwoord: string }): Promise<string> {
  const g = store.vindOpId(v.gebruikerId);
  if (!g || !(await controleerWachtwoord(v.wachtwoord ?? "", g.wachtwoordHash))) throw new Error("Je wachtwoord klopt niet.");
  const code = nieuweHerstelcode();
  store.zetHerstelHash(g.id, await hashWachtwoord(normaliseerCode(code)));
  return code;
}

export function wijzigWeergavenaam(gebruikerId: number, naam: string): void {
  const fout = valideerWeergavenaam(naam);
  if (fout) throw new Error(fout);
  store.zetWeergavenaam(gebruikerId, naam.trim());
}

export type VergetenUitkomst =
  | { ok: true; nieuweHerstelcode: string }
  | { ok: false; melding: string; vergrendeld?: boolean };

/** Wachtwoord vergeten: zonder mail is de herstelcode het bewijs dat jij het bent. Eén keer bruikbaar. */
export async function wachtwoordVergeten(v: { naam: string; herstelcode: string; nieuw: string }): Promise<VergetenUitkomst> {
  const naam = (v.naam ?? "").trim();
  const sleutel = `vergeten:${naam.toLowerCase()}`;
  if (!vrij(sleutel)) return { ok: false, vergrendeld: true, melding: "Te veel pogingen. Wacht een kwartier en probeer het dan opnieuw." };

  const g = naam.length <= 24 ? store.vindOpNaam(naam) : null;
  const goed = await controleerWachtwoord(normaliseerCode(v.herstelcode ?? ""), g ? g.herstelHash : await nepHash());
  if (!g || !goed) {
    faal(sleutel);
    return { ok: false, melding: "Die combinatie van naam en herstelcode klopt niet." };
  }
  const fout = valideerWachtwoord(v.nieuw, g.naam);
  if (fout) return { ok: false, melding: fout };

  const code = nieuweHerstelcode();
  store.zetWachtwoordHash(g.id, await hashWachtwoord(v.nieuw));
  store.zetHerstelHash(g.id, await hashWachtwoord(normaliseerCode(code)));
  store.verwijderSessiesVan(g.id);
  wisFouten(naam);
  return { ok: true, nieuweHerstelcode: code };
}

/* ----------------------------------------------------------------- beheer --- */

function eisEigenaar(uitvoerderId: number) {
  const u = store.vindOpId(uitvoerderId);
  if (!u || u.rol !== "eigenaar") throw new Error("Alleen de eigenaar mag dit.");
  return u;
}

/** Een kopie van iemands database in data/backups, buiten zijn eigen map (die wordt straks verwijderd). */
function back(naam: string, pad: string, reden: string): void {
  if (!fs.existsSync(pad)) return;
  const dir = path.join(dataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-");
  const veilig = naam.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
  const d = new Database(pad);
  try {
    d.pragma("wal_checkpoint(TRUNCATE)");
    d.prepare("VACUUM INTO ?").run(path.join(dir, `${reden}-${veilig}-${stamp}.db`));
  } finally {
    d.close();
  }
}

export async function beheerResetWachtwoord(v: { uitvoerderId: number; doelId: number }): Promise<{ tijdelijkWachtwoord: string }> {
  eisEigenaar(v.uitvoerderId);
  const doel = store.vindOpId(v.doelId);
  if (!doel) throw new Error("Onbekend account.");
  const tijdelijk = nieuweHerstelcode().replace(/-/g, "").slice(0, 12).toLowerCase() + "!A7";
  store.zetWachtwoordHash(doel.id, await hashWachtwoord(tijdelijk));
  store.verwijderSessiesVan(doel.id);
  wisFouten(doel.naam);
  return { tijdelijkWachtwoord: tijdelijk };
}

export async function beheerVerwijder(v: { uitvoerderId: number; doelId: number }): Promise<void> {
  eisEigenaar(v.uitvoerderId);
  if (v.uitvoerderId === v.doelId) throw new Error("De eigenaar kan zichzelf niet verwijderen.");
  await verwijderGebruikerEnData(v.doelId);
}

export async function zetRegistratie(v: { uitvoerderId: number; open: boolean }): Promise<void> {
  eisEigenaar(v.uitvoerderId);
  store.zetInstelling("registratie", v.open ? "open" : "gesloten");
}

export async function verwijderAccount(v: { gebruikerId: number; wachtwoord: string }): Promise<void> {
  const g = store.vindOpId(v.gebruikerId);
  if (!g || !(await controleerWachtwoord(v.wachtwoord ?? "", g.wachtwoordHash))) throw new Error("Je wachtwoord klopt niet.");
  if (g.rol === "eigenaar" && store.lijstGebruikers().length > 1) {
    throw new Error("Draag eerst het beheer over: er zijn nog andere accounts en er moet een eigenaar blijven.");
  }
  await verwijderGebruikerEnData(g.id);
}

/** Verwijderen kan niet terug, dus: eerst een kopie van zijn database in data/backups, dan pas weg. */
async function verwijderGebruikerEnData(id: number): Promise<void> {
  const g = store.vindOpId(id);
  if (!g) return;
  const pad = gebruikerDbPad(id);
  sluitDb(pad);
  back(g.naam, pad, "verwijderd");
  store.verwijderSessiesVan(id);
  fs.rmSync(gebruikerDir(id), { recursive: true, force: true });
  store.verwijderGebruikerRij(id);
}

export { alleDbPaden };
