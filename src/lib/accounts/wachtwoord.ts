import crypto from "node:crypto";
import { promisify } from "node:util";

/*
  Wachtwoorden en herstelcodes.

  scrypt zit in Node zelf, dus er is geen extra pakket voor nodig. Het is bewust traag
  en geheugenzwaar, zodat proberen van miljoenen wachtwoorden na een gelekt bestand duur
  is. Elk wachtwoord heeft zijn eigen zout, en de hash bevat zijn eigen parameters
  (scrypt$N$r$p$zout$hash), zodat je ze later kunt verzwaren zonder iemand uit te loggen.
*/
const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number, opts: crypto.ScryptOptions) => Promise<Buffer>;

const N = 16384;
const R = 8;
const P = 1;
const LEN = 32;

export async function hashWachtwoord(wachtwoord: string): Promise<string> {
  const zout = crypto.randomBytes(16);
  const hash = await scrypt(wachtwoord.normalize("NFKC"), zout, LEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${zout.toString("base64")}$${hash.toString("base64")}`;
}

export async function controleerWachtwoord(wachtwoord: string, opgeslagen: string): Promise<boolean> {
  const m = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(opgeslagen ?? "");
  if (!m) return false;
  const [n, r, p] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Een beschadigde regel met absurde parameters mag de server niet vastzetten.
  if (n > 1 << 20 || r > 32 || p > 16) return false;
  try {
    const verwacht = Buffer.from(m[5]!, "base64");
    const gekregen = await scrypt(wachtwoord.normalize("NFKC"), Buffer.from(m[4]!, "base64"), verwacht.length, {
      N: n,
      r,
      p,
      maxmem: 128 * 1024 * 1024,
    });
    return verwacht.length === gekregen.length && crypto.timingSafeEqual(verwacht, gekregen);
  } catch {
    return false;
  }
}

/** Voor een naam die niet bestaat: evenveel rekenwerk als voor een echte, zodat de tijd niet verraadt wie er bestaat. */
let nephash: Promise<string> | null = null;
export const nepHash = () => (nephash ??= hashWachtwoord("nep-wachtwoord-voor-gelijke-tijd"));

/* ----------------------------------------------------------- herstelcode --- */

// Zonder 0/O en 1/I: een code die je overschrijft van papier moet niet dubbelzinnig zijn.
const ALFABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function nieuweHerstelcode(): string {
  const tekens = Array.from({ length: 16 }, () => ALFABET[crypto.randomInt(0, ALFABET.length)]!);
  return [0, 4, 8, 12].map((i) => tekens.slice(i, i + 4).join("")).join("-");
}

export function normaliseerCode(code: string): string {
  return (code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}
