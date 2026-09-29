import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { maakPoortwachter } from "./lan-proxy";
import { nieuweCode, nieuwGeheim } from "./koppelen";
import { sluitAf } from "./levenscyclus";

/*
  Telefoon en iPad: de schakelaar, het geheim, de code en het opstarten van de
  poortwachter (src/lib/lan-proxy.ts).

  · data/instellingen.json  {"lan": true|false}  — wat je in het paneel kiest;
    scripts/app-start.sh leest het bij het starten.
  · data/geheim.txt  — ondertekent de cookies van gekoppelde apparaten. Het
    bestand is alleen voor jou leesbaar. Vervang je het, dan zijn alle
    apparaten ontkoppeld.
  · De koppelcode is er alleen in het geheugen en verandert bij elke start.
*/

const DATA = path.join(process.cwd(), "data");
const INSTELLINGEN = path.join(DATA, "instellingen.json");
const GEHEIM = path.join(DATA, "geheim.txt");

export const APP_POORT = Number(process.env.HRVATSKI_APP_PORT) || 3000;
export const LAN_POORT = Number(process.env.HRVATSKI_LAN_PORT) || 3001;

export function lanAan(): boolean {
  return process.env.HRVATSKI_LAN === "1";
}

export function leesInstellingen(): { lan: boolean } {
  try {
    return { lan: JSON.parse(fs.readFileSync(INSTELLINGEN, "utf8")).lan === true };
  } catch {
    return { lan: false };
  }
}

export function schrijfInstellingen(i: { lan: boolean }): void {
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(INSTELLINGEN, JSON.stringify(i, null, 2) + "\n");
}

type Geheugen = { geheim?: string; code?: string; server?: import("node:http").Server };
const g = globalThis as unknown as { __hrvatskiTelefoon?: Geheugen };
const geheugen = (): Geheugen => (g.__hrvatskiTelefoon ??= {});

export function geheim(): string {
  const m = geheugen();
  if (m.geheim) return m.geheim;
  try {
    m.geheim = fs.readFileSync(GEHEIM, "utf8").trim();
  } catch {
    // nog geen geheim
  }
  if (!m.geheim || m.geheim.length < 32) {
    m.geheim = nieuwGeheim();
    fs.mkdirSync(DATA, { recursive: true });
    fs.writeFileSync(GEHEIM, m.geheim + "\n", { mode: 0o600 });
  }
  return m.geheim;
}

/** Alle gekoppelde apparaten tegelijk ontkoppelen: een nieuw geheim maakt elke cookie ongeldig. */
export function ontkoppelAlles(): void {
  const m = geheugen();
  m.geheim = nieuwGeheim();
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(GEHEIM, m.geheim + "\n", { mode: 0o600 });
}

export function koppelcode(): string {
  const m = geheugen();
  return (m.code ??= nieuweCode());
}

/** De adressen waarop je telefoon de laptop kan bereiken. De naam met .local werkt op iPhone en iPad zonder iets in te stellen. */
export function adressen(): string[] {
  const uit: string[] = [];
  // De Bonjour-naam die iPhone en iPad kennen: "Naam.local". os.hostname() geeft soms
  // "Naam.home" (de domeinnaam van je router erbij), en dat is niet dezelfde naam.
  let naam = "";
  try {
    naam = execFileSync("scutil", ["--get", "LocalHostName"], { encoding: "utf8", timeout: 1500 }).trim();
  } catch {
    naam = os.hostname().split(".")[0] ?? "";
  }
  if (naam) uit.push(`http://${naam}.local:${LAN_POORT}`);
  for (const lijst of Object.values(os.networkInterfaces())) {
    for (const i of lijst ?? []) {
      if (i.family === "IPv4" && !i.internal) uit.push(`http://${i.address}:${LAN_POORT}`);
    }
  }
  return uit;
}

export function startPoortwachter(): void {
  const m = geheugen();
  if (!lanAan() || m.server) return;
  const extra = (process.env.HRVATSKI_ALLOWED_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);
  m.server = maakPoortwachter({ upstreamPoort: APP_POORT, geheim, code: koppelcode, extraHosts: extra });
  m.server.on("error", (e) => console.error("Poortwachter voor telefoon en iPad kon niet starten:", e));
  m.server.listen(LAN_POORT, "0.0.0.0");
}

/** Sluit af en start dezelfde app opnieuw, zonder Safari nog eens te openen (nieuwe instelling). */
export async function herstart(): Promise<void> {
  const script = path.join(process.cwd(), "scripts", "app-start.sh");
  // De omgeving van deze server mag niet mee: HRVATSKI_LAN en HRVATSKI_MANAGED moeten uit de
  // instellingen komen, anders blijft "uit" per ongeluk aan staan.
  const { HRVATSKI_LAN: _lan, HRVATSKI_MANAGED: _beheerd, ...omgeving } = process.env;
  const kind = spawn("/bin/zsh", ["-c", `sleep 3; exec /bin/zsh "${script}"`], {
    detached: true,
    stdio: "ignore",
    cwd: process.cwd(),
    env: { ...omgeving, HRVATSKI_GEEN_BROWSER: "1" },
  });
  kind.unref();
  await sluitAf();
}
