import { AZURE_VOICES, azureConfigured, cacheStats } from "@/lib/speech/azure";

/**
 * Vertelt de client of er neurale stemmen beschikbaar zijn.
 *
 * Eén keer opvragen bij het laden is genoeg; zonder dit zou elke luisteroefening
 * eerst de server moeten bevragen om te ontdekken dat er geen sleutel is.
 */
export async function GET() {
  const on = azureConfigured();
  return Response.json({
    available: on,
    voices: on ? AZURE_VOICES : [],
    cache: on ? cacheStats() : { files: 0, bytes: 0 },
  });
}
