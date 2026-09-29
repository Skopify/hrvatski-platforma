import crypto from "node:crypto";

/*
  Koppelen van telefoon en iPad.

  Er is geen account en geen wachtwoord. Wel een code van zes cijfers die alleen
  op de laptop zichtbaar is: wie hem intikt, krijgt een cookie dat de
  poortwachter herkent. Het cookie is niet willekeurig maar ondertekend
  (HMAC met een geheim dat alleen op de laptop staat), zodat niemand er een kan
  bedenken, en je alle apparaten tegelijk ontkoppelt door het geheim te
  vervangen.
*/

export const cookieNaam = "hr_koppel";
export const COOKIE_DAGEN = 180;

const hmac = (geheim: string, tekst: string) => crypto.createHmac("sha256", geheim).update(tekst).digest("hex");

export function maakCookie(geheim: string, verlooptOp: number): string {
  return `${verlooptOp}.${hmac(geheim, `koppel:${verlooptOp}`)}`;
}

export function controleerCookie(geheim: string, waarde: string | undefined, nu = Date.now()): boolean {
  if (!waarde) return false;
  const m = /^(\d{10,16})\.([0-9a-f]{64})$/.exec(waarde);
  if (!m) return false;
  if (Number(m[1]) < nu) return false;
  const verwacht = Buffer.from(hmac(geheim, `koppel:${m[1]}`));
  const gegeven = Buffer.from(m[2]!);
  return verwacht.length === gegeven.length && crypto.timingSafeEqual(verwacht, gegeven);
}

/** Gelijke tijd vergelijken, zodat de duur niet verraadt hoeveel cijfers al goed waren. */
export function codeKlopt(verwacht: string, gegeven: string): boolean {
  const a = Buffer.from(verwacht);
  const b = Buffer.from(gegeven.replace(/\s+/g, ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function nieuweCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

export function nieuwGeheim(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function cookieUit(header: string | undefined, naam = cookieNaam): string | undefined {
  if (!header) return undefined;
  for (const deel of header.split(";")) {
    const i = deel.indexOf("=");
    if (i > 0 && deel.slice(0, i).trim() === naam) return deel.slice(i + 1).trim();
  }
  return undefined;
}

/* --------------------------------------------------------------- gokken --- */

/** Per apparaat: 5 fouten per minuut. Overal samen: 15 fouten en dan tien minuten dicht. */
export class Begrenzing {
  private fouten = new Map<string, number[]>();
  private totaal = 0;
  private dichtTot = 0;

  constructor(
    private readonly perMinuut = 5,
    private readonly maxTotaal = 15,
    private readonly dichtMs = 10 * 60_000,
  ) {}

  toegestaan(bron: string, nu = Date.now()): boolean {
    if (nu < this.dichtTot) return false;
    const lijst = (this.fouten.get(bron) ?? []).filter((t) => nu - t < 60_000);
    this.fouten.set(bron, lijst);
    return lijst.length < this.perMinuut;
  }

  fout(bron: string, nu = Date.now()): void {
    const lijst = this.fouten.get(bron) ?? [];
    lijst.push(nu);
    this.fouten.set(bron, lijst);
    if (++this.totaal >= this.maxTotaal) {
      this.dichtTot = nu + this.dichtMs;
      this.totaal = 0;
    }
  }

  goed(): void {
    this.totaal = 0;
  }
}

/* ----------------------------------------------------------- de pagina --- */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** De koppelpagina. Bewust zelfstandig: er is nog geen sessie en dus geen app-stijl. */
export function koppelPagina(opties: { fout?: string; vergrendeld?: boolean } = {}): string {
  const melding = opties.vergrendeld
    ? "Te veel pogingen. Wacht een paar minuten en vraag de code opnieuw op de laptop."
    : opties.fout ?? "";
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="theme-color" content="#fbfaf7">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png"><title>Hrvatski koppelen</title>
<style>
:root{color-scheme:light}*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:24px;background:#fbfaf7 radial-gradient(circle,rgba(27,26,34,.1) 1.4px,transparent 1.7px) 0 0/24px 24px;font-family:ui-rounded,"SF Pro Rounded",system-ui,sans-serif;color:#1b1a22}
main{width:100%;max-width:380px;background:#ffe45c;border:2.5px solid #1b1a22;border-radius:34px 30px 36px 28px;padding:28px;box-shadow:6px 6px 0 #1b1a22}
h1{margin:0 0 8px;font-size:30px;letter-spacing:-.03em}p{margin:0 0 18px;font-size:16px;line-height:1.45;font-weight:600}
input{width:100%;height:60px;border:2.5px solid #1b1a22;border-radius:999px;background:#fff;text-align:center;font-size:28px;letter-spacing:.3em;font-weight:800;box-shadow:3px 3px 0 #1b1a22}
button{margin-top:16px;width:100%;height:56px;border:2.5px solid #1b1a22;border-radius:999px;background:#3b4cff;color:#fff;font-size:18px;font-weight:800;box-shadow:3px 3px 0 #1b1a22}
button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #1b1a22}
.f{margin:14px 0 0;color:#a01a4d;font-size:15px;font-weight:700}
</style></head><body><main>
<h1>Koppel dit apparaat</h1>
<p>Tik de code van zes cijfers in die je op de laptop ziet, bij <b>Telefoon &amp; iPad</b> in het menu.</p>
<form method="post" action="/koppel" autocomplete="off">
<input name="code" inputmode="numeric" pattern="[0-9 ]*" maxlength="7" autocomplete="one-time-code" placeholder="••••••" autofocus required>
<button type="submit">Koppel</button>
${melding ? `<p class="f">${esc(melding)}</p>` : ""}
</form></main></body></html>`;
}
