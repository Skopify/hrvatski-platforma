import fs from "node:fs";
import path from "node:path";

/**
 * Leest de Azure-gegevens uit azure.env of .env.local.
 *
 * Next laadt zelf alleen .env-bestanden met vaste namen. Deze loader kijkt ook
 * naar azure.env, zodat het bestand mag blijven staan zoals het uit de portal
 * is overgenomen — met KEY1, KEY2, REGION en ENDPOINT. De sleutel op twee
 * plekken bewaren zou hem twee keer zo makkelijk laten lekken.
 *
 * Wordt één keer gelezen en daarna onthouden; er staat niets in dat tijdens het
 * draaien verandert.
 */

interface AzureEnv {
  key: string | null;
  region: string | null;
}

let cached: AzureEnv | null = null;

/** Namen die in de praktijk voorkomen, in volgorde van voorkeur. */
const KEY_NAMES = ["AZURE_SPEECH_KEY", "KEY1", "KEY", "SPEECH_KEY"];
const REGION_NAMES = ["AZURE_SPEECH_REGION", "REGION", "LOCATION", "SPEECH_REGION"];

function parse(file: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, "utf-8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const i = line.indexOf("=");
    if (i < 0) continue;
    const name = line.slice(0, i).trim();
    const value = line
      .slice(i + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (name && value) out[name] = value;
  }
  return out;
}

/**
 * Uit een endpoint als https://northeurope.api.cognitive.microsoft.com/ valt de
 * regio af te lezen. Handig als er wel een ENDPOINT staat maar geen REGION.
 */
function regionFromEndpoint(endpoint: string | undefined): string | null {
  const m = endpoint?.match(/https?:\/\/([a-z0-9-]+)\.(api\.cognitive|tts\.speech)/i);
  return m ? m[1]!.toLowerCase() : null;
}

export function azureEnv(): AzureEnv {
  if (cached) return cached;

  const files = ["azure.env", ".env.local"].map((f) => path.join(process.cwd(), f));
  const found: Record<string, string> = Object.assign({}, ...files.map(parse).reverse());

  // Wat het proces zelf al meekrijgt wint: zo kun je hem tijdelijk overschrijven
  // zonder een bestand aan te passen.
  const pick = (names: string[]) => {
    for (const n of names) {
      if (process.env[n]) return process.env[n]!;
      if (found[n]) return found[n]!;
    }
    return null;
  };

  const key = pick(KEY_NAMES);
  const region =
    pick(REGION_NAMES) ?? regionFromEndpoint(found.ENDPOINT ?? process.env.AZURE_SPEECH_ENDPOINT);

  cached = { key, region: region?.toLowerCase() ?? null };
  return cached;
}
