import { instelling } from "@/lib/levenscyclus";
import { herstart } from "@/lib/telefoon";

export const dynamic = "force-dynamic";

/** Opnieuw starten, bijvoorbeeld na het aan- of uitzetten van Telefoon & iPad. Alleen in de beheerde app. */
export async function POST(request: Request) {
  if (!instelling().beheerd || request.headers.get("x-hrvatski-actie") !== "herstart") {
    return Response.json({ ok: false }, { status: 403 });
  }
  setTimeout(() => void herstart(), 400);
  return Response.json({ ok: true });
}
