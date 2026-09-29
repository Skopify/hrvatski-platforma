import crypto from "node:crypto";
import fs from "node:fs";

import Database from "better-sqlite3";

import { accountsPad, dataDir } from "../data";

/*
  De opslag van accounts: één klein SQLite-bestand naast de voortgangsdatabases.
  Dit is de enige plek met wachtwoord-hashes en sessies; de voortgang zelf staat er
  nooit in. Een sessietoken staat hier alleen als hash: wie dit bestand leest, kan
  er niet mee inloggen.

  Rol: de eerste account is de eigenaar (beheer, telefoon, afsluiten); de rest gewone gebruikers.
*/
export type Rol = "eigenaar" | "gebruiker";

export interface Gebruiker {
  id: number;
  naam: string;
  weergavenaam: string;
  rol: Rol;
  gemaakt: number;
  laatsteLogin: number | null;
}

export interface GebruikerMetHash extends Gebruiker {
  wachtwoordHash: string;
  herstelHash: string;
}

const SESSIE_DAGEN = 30;
const DAG = 86_400_000;

type Bewaard = { db?: Database.Database; pad?: string };
const g = globalThis as unknown as { __hrvatskiAccounts?: Bewaard };

function open(): Database.Database {
  const pad = accountsPad();
  const b = (g.__hrvatskiAccounts ??= {});
  if (b.db && b.pad === pad && b.db.open) return b.db;
  b.db?.close();

  fs.mkdirSync(dataDir(), { recursive: true });
  const db = new Database(pad);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.pragma("synchronous = NORMAL");
  if ((db.pragma("user_version", { simple: true }) as number) < 1) {
    db.exec(`
      CREATE TABLE gebruiker (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        naam TEXT NOT NULL UNIQUE COLLATE NOCASE,
        weergavenaam TEXT NOT NULL,
        wachtwoord_hash TEXT NOT NULL,
        herstel_hash TEXT NOT NULL,
        rol TEXT NOT NULL CHECK (rol IN ('eigenaar','gebruiker')),
        gemaakt INTEGER NOT NULL,
        laatste_login INTEGER
      );
      CREATE TABLE sessie (
        hash TEXT PRIMARY KEY,
        gebruiker_id INTEGER NOT NULL REFERENCES gebruiker(id) ON DELETE CASCADE,
        gemaakt INTEGER NOT NULL,
        verloopt INTEGER NOT NULL,
        laatst_gezien INTEGER NOT NULL,
        apparaat TEXT
      );
      CREATE INDEX sessie_gebruiker ON sessie(gebruiker_id);
      CREATE TABLE instelling (sleutel TEXT PRIMARY KEY, waarde TEXT NOT NULL);
      PRAGMA user_version = 1;
    `);
  }
  b.db = db;
  b.pad = pad;
  return db;
}

export function sluitAccounts(): void {
  const b = g.__hrvatskiAccounts;
  if (b?.db?.open) {
    try {
      b.db.pragma("wal_checkpoint(TRUNCATE)");
    } catch {
      // niet erg
    }
    b.db.close();
  }
  g.__hrvatskiAccounts = undefined;
}

/** Voor een back-up van het accountsbestand voordat er iets in verandert dat je niet terugkrijgt. */
export const accountsDb = open;

type Rij = {
  id: number;
  naam: string;
  weergavenaam: string;
  rol: Rol;
  gemaakt: number;
  laatste_login: number | null;
  wachtwoord_hash: string;
  herstel_hash: string;
};

const openbaar = (r: Rij): Gebruiker => ({
  id: r.id,
  naam: r.naam,
  weergavenaam: r.weergavenaam,
  rol: r.rol,
  gemaakt: r.gemaakt,
  laatsteLogin: r.laatste_login,
});

/* ---------------------------------------------------------- gebruikers --- */

export const aantalGebruikers = () => (open().prepare("SELECT count(*) c FROM gebruiker").get() as { c: number }).c;

export function maakGebruiker(v: { naam: string; weergavenaam: string; wachtwoordHash: string; herstelHash: string; rol: Rol }): Gebruiker {
  const d = open();
  const info = d
    .prepare("INSERT INTO gebruiker (naam, weergavenaam, wachtwoord_hash, herstel_hash, rol, gemaakt) VALUES (?, ?, ?, ?, ?, ?)")
    .run(v.naam, v.weergavenaam, v.wachtwoordHash, v.herstelHash, v.rol, Date.now());
  return openbaar(d.prepare("SELECT * FROM gebruiker WHERE id = ?").get(info.lastInsertRowid) as Rij);
}

export function vindOpNaam(naam: string): GebruikerMetHash | null {
  const r = open().prepare("SELECT * FROM gebruiker WHERE naam = ?").get(naam) as Rij | undefined;
  return r ? { ...openbaar(r), wachtwoordHash: r.wachtwoord_hash, herstelHash: r.herstel_hash } : null;
}

export function vindOpId(id: number): GebruikerMetHash | null {
  const r = open().prepare("SELECT * FROM gebruiker WHERE id = ?").get(id) as Rij | undefined;
  return r ? { ...openbaar(r), wachtwoordHash: r.wachtwoord_hash, herstelHash: r.herstel_hash } : null;
}

export const lijstGebruikers = (): Gebruiker[] =>
  (open().prepare("SELECT * FROM gebruiker ORDER BY id").all() as Rij[]).map(openbaar);

export function zetWachtwoordHash(id: number, hash: string): void {
  open().prepare("UPDATE gebruiker SET wachtwoord_hash = ? WHERE id = ?").run(hash, id);
}
export function zetHerstelHash(id: number, hash: string): void {
  open().prepare("UPDATE gebruiker SET herstel_hash = ? WHERE id = ?").run(hash, id);
}
export function zetWeergavenaam(id: number, naam: string): void {
  open().prepare("UPDATE gebruiker SET weergavenaam = ? WHERE id = ?").run(naam, id);
}
export function markeerLogin(id: number): void {
  open().prepare("UPDATE gebruiker SET laatste_login = ? WHERE id = ?").run(Date.now(), id);
}

export function verwijderGebruikerRij(id: number): void {
  open().prepare("DELETE FROM gebruiker WHERE id = ?").run(id);
  cache.clear();
}

/* ------------------------------------------------------------ instelling --- */

export function instelling(sleutel: string, terugval: string): string {
  const r = open().prepare("SELECT waarde FROM instelling WHERE sleutel = ?").get(sleutel) as { waarde: string } | undefined;
  return r?.waarde ?? terugval;
}
export function zetInstelling(sleutel: string, waarde: string): void {
  open().prepare("INSERT INTO instelling (sleutel, waarde) VALUES (?, ?) ON CONFLICT(sleutel) DO UPDATE SET waarde = excluded.waarde").run(sleutel, waarde);
}

/* --------------------------------------------------------------- sessies --- */

const hashToken = (t: string) => crypto.createHash("sha256").update(t).digest("hex");

// Een korte geheugencache: elke query van een pagina zoekt zijn gebruiker op, en dat
// hoeft niet elke keer naar de schijf. Twee seconden is kort genoeg voor uitloggen.
const cache = new Map<string, { gebruiker: Gebruiker | null; tot: number }>();
const CACHE_MS = 2000;

export function maakSessie(gebruikerId: number, apparaat: string): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const nu = Date.now();
  open()
    .prepare("INSERT INTO sessie (hash, gebruiker_id, gemaakt, verloopt, laatst_gezien, apparaat) VALUES (?, ?, ?, ?, ?, ?)")
    .run(hashToken(token), gebruikerId, nu, nu + SESSIE_DAGEN * DAG, nu, apparaat.slice(0, 120));
  return token;
}

export function zoekSessie(token: string | undefined | null): Gebruiker | null {
  if (!token || token.length < 20 || token.length > 200) return null;
  const nu = Date.now();
  const sleutel = hashToken(token);
  const bewaard = cache.get(sleutel);
  if (bewaard && bewaard.tot > nu) return bewaard.gebruiker;

  const d = open();
  const s = d.prepare("SELECT gebruiker_id, verloopt, laatst_gezien FROM sessie WHERE hash = ?").get(sleutel) as
    | { gebruiker_id: number; verloopt: number; laatst_gezien: number }
    | undefined;
  let gebruiker: Gebruiker | null = null;
  if (s && s.verloopt > nu) {
    const r = d.prepare("SELECT * FROM gebruiker WHERE id = ?").get(s.gebruiker_id) as Rij | undefined;
    gebruiker = r ? openbaar(r) : null;
    // Schuivend: wie actief is, blijft ingelogd; bijwerken hoogstens elk uur.
    if (gebruiker && nu - s.laatst_gezien > 3_600_000) {
      d.prepare("UPDATE sessie SET laatst_gezien = ?, verloopt = ? WHERE hash = ?").run(nu, nu + SESSIE_DAGEN * DAG, sleutel);
    }
  } else if (s) {
    d.prepare("DELETE FROM sessie WHERE hash = ?").run(sleutel);
  }
  cache.set(sleutel, { gebruiker, tot: nu + CACHE_MS });
  return gebruiker;
}

export function verwijderSessie(token: string): void {
  open().prepare("DELETE FROM sessie WHERE hash = ?").run(hashToken(token));
  cache.clear();
}

/** Alle sessies van een gebruiker weg, behalve (optioneel) het apparaat waarmee hij nu bezig is. */
export function verwijderSessiesVan(gebruikerId: number, behalveToken?: string): void {
  const d = open();
  if (behalveToken) d.prepare("DELETE FROM sessie WHERE gebruiker_id = ? AND hash != ?").run(gebruikerId, hashToken(behalveToken));
  else d.prepare("DELETE FROM sessie WHERE gebruiker_id = ?").run(gebruikerId);
  cache.clear();
}

/** Voor tests en beheer: laat een sessie op een gegeven moment verlopen. */
export function verloopSessieOp(token: string, tijd: number): void {
  open().prepare("UPDATE sessie SET verloopt = ? WHERE hash = ?").run(tijd, hashToken(token));
  cache.clear();
}

export function opruimenSessies(): number {
  return open().prepare("DELETE FROM sessie WHERE verloopt < ?").run(Date.now()).changes;
}

export const sessieDagen = SESSIE_DAGEN;
