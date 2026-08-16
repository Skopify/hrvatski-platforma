import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Kroatische spraak van Azure, met een schijfcache.
 *
 * ── Waarom dit naast de browserstem staat ──────────────────────────────────
 * De Web Speech API gebruikt wat het besturingssysteem toevallig heeft. Op deze
 * machine is dat de compacte Lana: blikkerig, en met een ondergrens waardoor
 * traag afspelen nauwelijks werkt. Azure levert dezelfde neurale stemmen die
 * Edge gebruikt, maar dan als bestand — zodat elke browser ze kan afspelen en
 * de uitspraak elke keer identiek is.
 *
 * ── Waarom een cache ───────────────────────────────────────────────────────
 * Azure rekent per teken, niet per keer afspelen. Eén keer opslaan betekent dus
 * dat een zin die je honderd keer herhaalt precies één keer kost. Alle
 * lesteksten, verhalen en oefeningen samen zijn ongeveer 60.000 tekens; de
 * gratis laag is 500.000 tekens per maand. Je komt er in de praktijk nooit aan.
 *
 * ── Zonder sleutel ─────────────────────────────────────────────────────────
 * Dan doet dit niets en valt alles terug op de browserstem, precies zoals het
 * platform zich daarvoor gedroeg. De sleutel is een verbetering, geen vereiste.
 */

export interface AzureVoice {
  id: string;
  label: string;
  gender: "vrouw" | "man";
}

/** De Kroatische neurale stemmen die Azure aanbiedt. */
export const AZURE_VOICES: AzureVoice[] = [
  { id: "hr-HR-GabrijelaNeural", label: "Gabrijela", gender: "vrouw" },
  { id: "hr-HR-SreckoNeural", label: "Srećko", gender: "man" },
];

export const DEFAULT_AZURE_VOICE = AZURE_VOICES[0]!.id;

const CACHE_DIR = path.join(process.cwd(), "data", "audio");

export function azureConfigured(): boolean {
  return Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION);
}

/**
 * Cachesleutel. Ook de snelheid zit erin, want die bakt Azure in het bestand —
 * anders zou je bij het wisselen van tempo de oude opname terugkrijgen.
 */
function cacheKey(text: string, voice: string, rate: number): string {
  const h = crypto.createHash("sha256").update(`${voice}|${rate}|${text}`).digest("hex");
  return `${h.slice(0, 40)}.mp3`;
}

/** XML-escape; zonder dit breekt een & of < in de lestekst de hele SSML. */
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * De opname ophalen, uit de cache of van Azure.
 *
 * Geeft null terug als er geen sleutel is of als Azure weigert. De aanroeper
 * valt dan terug op de browserstem — een luisteroefening die stilvalt is erger
 * dan een luisteroefening die minder mooi klinkt.
 */
export async function croatianSpeech(
  text: string,
  voice: string = DEFAULT_AZURE_VOICE,
  rate = 1,
): Promise<Buffer | null> {
  const trimmed = text.trim();
  if (!trimmed || !azureConfigured()) return null;
  if (!AZURE_VOICES.some((v) => v.id === voice)) voice = DEFAULT_AZURE_VOICE;

  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const file = path.join(CACHE_DIR, cacheKey(trimmed, voice, rate));
  if (fs.existsSync(file)) return fs.readFileSync(file);

  // Azure drukt de snelheid uit als afwijking van normaal: -50% is half tempo.
  // Anders dan bij de systeemstem wordt dit wél netjes opgevolgd.
  const pct = Math.round((rate - 1) * 100);
  const ssml =
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="hr-HR">` +
    `<voice name="${voice}"><prosody rate="${pct >= 0 ? "+" : ""}${pct}%">` +
    `${escapeXml(trimmed)}</prosody></voice></speak>`;

  const region = process.env.AZURE_SPEECH_REGION;
  const res = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": process.env.AZURE_SPEECH_KEY!,
      "Content-Type": "application/ssml+xml",
      "X-Microsoft-OutputFormat": "audio-24khz-48kbitrate-mono-mp3",
      "User-Agent": "hrvatski-platforma",
    },
    body: ssml,
  });

  if (!res.ok) {
    console.error(`Azure gaf ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return null;
  }

  const audio = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(file, audio);
  return audio;
}

/** Hoeveel er al is opgeslagen — de basis voor de tellers op Voortgang. */
export function cacheStats(): { files: number; bytes: number } {
  if (!fs.existsSync(CACHE_DIR)) return { files: 0, bytes: 0 };
  const files = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith(".mp3"));
  const bytes = files.reduce((n, f) => n + fs.statSync(path.join(CACHE_DIR, f)).size, 0);
  return { files: files.length, bytes };
}
