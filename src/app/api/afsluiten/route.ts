import { instelling, sluitAf } from "@/lib/levenscyclus";

export const dynamic = "force-dynamic";

/**
 * De knop "Afsluiten". Alleen in de app die Hrvatski.app gestart heeft: een
 * gewone dev-server zet je uit in je terminal, en hij mag niet op afstand uit
 * kunnen. De eigen kop komt bovenop de controle op herkomst in
 * src/middleware.ts, zodat een vergissing in één van de twee niet genoeg is.
 */
export async function POST(request: Request) {
  if (instelling().beheerd !== true || request.headers.get("x-hrvatski-actie") !== "afsluiten") {
    return Response.json({ ok: false }, { status: 403 });
  }
  // Eerst antwoorden, dan afsluiten: de pagina moet nog kunnen laten zien dat het gelukt is.
  setTimeout(() => void sluitAf(), 400);
  return Response.json({ ok: true });
}
