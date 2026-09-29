import { instelling, teken } from "@/lib/levenscyclus";

export const dynamic = "force-dynamic";

/**
 * Een open pagina meldt zich. Zonder deze tekens weet de server niet of je nog
 * kijkt, want een browser geeft niet door dat een tabblad dicht is.
 */
export async function POST() {
  teken();
  return Response.json({ ok: true, beheerd: instelling().beheerd });
}
