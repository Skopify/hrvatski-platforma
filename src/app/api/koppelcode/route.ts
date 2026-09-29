import { instelling } from "@/lib/levenscyclus";
import { koppelcode, lanAan } from "@/lib/telefoon";

export const dynamic = "force-dynamic";

/** De code van zes cijfers om een telefoon of iPad te koppelen. Alleen op de laptop (middleware + poortwachter). */
export async function GET() {
  if (!instelling().beheerd || !lanAan()) return Response.json({ ok: false }, { status: 404 });
  return Response.json({ ok: true, code: koppelcode() }, { headers: { "Cache-Control": "no-store" } });
}
