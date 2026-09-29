import { eisGebruiker } from "@/lib/accounts/api";
import { searchIndex } from "@/lib/zoekindex";

/**
 * De zoekindex voor ⌘K. Vroeger zat hij in elke pagina; nu wordt hij pas
 * opgehaald als je het zoekvenster voor het eerst opent. Dat scheelt
 * tientallen kilobytes op elke pagina en de index verandert toch alleen
 * als de content verandert.
 */
export async function GET(request: Request) {
  const ingelogd = eisGebruiker(request);
  if ("fout" in ingelogd) return ingelogd.fout;
  return Response.json(searchIndex(), { headers: { "Cache-Control": "private, max-age=300" } });
}
