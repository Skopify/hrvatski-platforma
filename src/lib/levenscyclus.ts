/*
  Starten en stoppen.

  Het platform start met één klik (Hrvatski.app) en moet zichzelf weer
  opruimen, zonder dat je iets typt of afsluit. Dat vraagt twee garanties:

    · Het stopt nooit te vroeg. Een browser geeft niet door dat je een tabblad
      sluit; de pagina stuurt daarom elke halve minuut een teken van leven,
      en pas na tien minuten stilte gaat de app uit. Bij het openen krijgt hij
      diezelfde tijd, dus een trage start wordt nooit afgebroken.
    · Het zet nooit iets uit wat het niet zelf gestart heeft. Draaide Ollama
      al voordat jij op Gesprek klikte (bijvoorbeeld voor iets anders), dan
      blijft het aan. Alleen wat wij starten, stoppen wij.

  De beslissing zelf is een kale functie (beslis) die je kunt testen zonder
  klok of processen: check:levenscyclus.
*/
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ollamaStatus, type OllamaStatus } from "./ollama";

export interface Leven {
  /** Laatste teken van een open pagina (ms sinds epoch). */
  lastSeen: number;
  startedAt: number;
  /** Proces-id van een Ollama die wij gestart hebben; anders null. */
  ollamaPid: number | null;
  ollamaLastUse: number;
}

export interface Instelling {
  /** True als Hrvatski.app de server startte; alleen dan mag hij zichzelf uitzetten. */
  beheerd: boolean;
  idleMs: number;
  ollamaIdleMs: number;
}

/** Wat er nu moet gebeuren. Kaal, zodat het testbaar is. */
export function beslis(nu: number, s: Leven, i: Instelling): { stopServer: boolean; stopOllama: boolean } {
  const laatste = Math.max(s.lastSeen, s.startedAt);
  return {
    stopServer: i.beheerd && nu - laatste > i.idleMs,
    stopOllama: s.ollamaPid !== null && nu - s.ollamaLastUse > i.ollamaIdleMs,
  };
}

export function instelling(): Instelling {
  return {
    beheerd: process.env.HRVATSKI_MANAGED === "1",
    // Met telefoon en iPad aan: een dichtgeklapte telefoon stuurt geen tekens meer, dus dan langer.
    idleMs: (Number(process.env.HRVATSKI_IDLE_SECONDS) || (process.env.HRVATSKI_LAN === "1" ? 1800 : 600)) * 1000,
    ollamaIdleMs: (Number(process.env.HRVATSKI_OLLAMA_IDLE_SECONDS) || 900) * 1000,
  };
}

/* -------------------------------------------------------------- toestand --- */

const PID_BESTAND = path.join(process.cwd(), "data", "ollama-door-app.pid");

type Bewaard = Leven & { timer?: NodeJS.Timeout; stopt?: boolean };
const g = globalThis as unknown as { __hrvatskiLeven?: Bewaard };

function leeft(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Een pid uit een vorige run overnemen, maar alleen als het nog leeft. */
function bewaardePid(): number | null {
  try {
    const pid = Number(fs.readFileSync(PID_BESTAND, "utf8").trim());
    if (Number.isInteger(pid) && pid > 1 && leeft(pid)) return pid;
  } catch {
    // geen bestand: niets gestart
  }
  return null;
}

export function leven(): Bewaard {
  if (!g.__hrvatskiLeven) {
    const nu = Date.now();
    g.__hrvatskiLeven = { lastSeen: nu, startedAt: nu, ollamaPid: bewaardePid(), ollamaLastUse: nu };
  }
  return g.__hrvatskiLeven;
}

/** Een open pagina meldt zich. */
export function teken(): void {
  leven().lastSeen = Date.now();
}

/** Er is iets met de bot gedaan; de Ollama-klok begint opnieuw. */
export function ollamaGebruikt(): void {
  leven().ollamaLastUse = Date.now();
}

/* ---------------------------------------------------------------- Ollama --- */

const KANDIDATEN = [
  process.env.HRVATSKI_OLLAMA_BIN,
  "/opt/homebrew/bin/ollama",
  "/usr/local/bin/ollama",
  "/Applications/Ollama.app/Contents/Resources/ollama",
].filter((x): x is string => Boolean(x));

export type OllamaToestand = OllamaStatus | { staat: "starten" } | { staat: "geen-programma" };

/**
 * De toestand van Ollama, en als hij niet draait: hem starten. Alleen de
 * Gesprek-sectie roept dit aan, dus wie alleen leert start nooit een model.
 * De aanroeper wacht niet: het opstarten duurt een paar seconden en de pagina
 * vraagt daarna opnieuw.
 */
export async function ollamaToestand(): Promise<OllamaToestand> {
  const st = await ollamaStatus();
  if (st.staat !== "offline") {
    if (st.staat === "klaar") ollamaGebruikt();
    return st;
  }

  const s = leven();
  if (s.ollamaPid && leeft(s.ollamaPid)) return { staat: "starten" };

  const bin = KANDIDATEN.find((k) => fs.existsSync(k));
  if (!bin) return { staat: "geen-programma" };

  const kind = spawn(bin, ["serve"], { detached: true, stdio: "ignore" });
  kind.on("error", () => {
    s.ollamaPid = null;
  });
  kind.unref();
  if (!kind.pid) return { staat: "geen-programma" };

  s.ollamaPid = kind.pid;
  s.ollamaLastUse = Date.now();
  try {
    fs.mkdirSync(path.dirname(PID_BESTAND), { recursive: true });
    fs.writeFileSync(PID_BESTAND, String(kind.pid));
  } catch {
    // de pid alleen in het geheugen: dan overleeft hij een herstart van de server niet
  }
  return { staat: "starten" };
}

/** Stopt Ollama, maar alleen als wij hem gestart hebben. */
export function stopOllamaAlsEigen(): void {
  const s = leven();
  const pid = s.ollamaPid;
  s.ollamaPid = null;
  try {
    fs.rmSync(PID_BESTAND, { force: true });
  } catch {
    // niet erg
  }
  if (!pid || !leeft(pid)) return;
  try {
    // Min-teken: de hele procesgroep, want Ollama start een eigen model-proces.
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // al weg
    }
  }
}

/* ------------------------------------------------------------ afsluiten --- */

/**
 * Netjes afsluiten: Ollama (als het van ons is), dan de database (het
 * schrijflogboek leeggemaakt, zodat er niets halfs achterblijft), dan het
 * proces.
 */
export async function sluitAf(): Promise<void> {
  const s = leven();
  if (s.stopt) return;
  s.stopt = true;
  stopOllamaAlsEigen();
  try {
    const { sluitAlleDbs } = await import("./db");
    const { sluitAccounts } = await import("./accounts/store");
    sluitAlleDbs();
    sluitAccounts();
  } catch {
    // de database was niet geopend: dan valt er niets af te sluiten
  }
  process.exit(0);
}

/** Eén klok voor het hele proces; wordt bij het starten van de server aangezet. */
export function startWacht(): void {
  const s = leven();
  if (s.timer) return;
  s.timer = setInterval(() => {
    const b = beslis(Date.now(), s, instelling());
    if (b.stopOllama) stopOllamaAlsEigen();
    if (b.stopServer) void sluitAf();
  }, 5000);
  s.timer.unref();
}
