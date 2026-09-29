import { instelling } from "@/lib/levenscyclus";
import { adressen, koppelcode, lanAan, leesInstellingen, ontkoppelAlles, schrijfInstellingen } from "@/lib/telefoon";

export const dynamic = "force-dynamic";

const toegestaan = (request: Request) => instelling().beheerd && request.headers.get("x-hrvatski-actie") === "lan";

/** Hoe staat "Telefoon & iPad"? Alleen in de app zelf en alleen op de laptop. */
export async function GET() {
  if (!instelling().beheerd) return Response.json({ beheerd: false });
  const aan = lanAan();
  return Response.json(
    { beheerd: true, aan, gewenst: leesInstellingen().lan, adressen: aan ? adressen() : [], code: aan ? koppelcode() : null },
    { headers: { "Cache-Control": "no-store" } },
  );
}

/** Aan of uit zetten (gaat pas in na een herstart), of alle apparaten ontkoppelen. */
export async function POST(request: Request) {
  if (!toegestaan(request)) return Response.json({ ok: false }, { status: 403 });
  let body: { aan?: unknown; ontkoppel?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  if (body.ontkoppel === true) {
    ontkoppelAlles();
    return Response.json({ ok: true });
  }
  if (typeof body.aan === "boolean") {
    schrijfInstellingen({ lan: body.aan });
    return Response.json({ ok: true, gewenst: body.aan });
  }
  return Response.json({ ok: false }, { status: 400 });
}
