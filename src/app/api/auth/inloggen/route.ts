import { antwoord, lees, tekst } from "@/lib/accounts/api";
import { inloggen } from "@/lib/accounts/registreren";
import { bronVan, isHttps, sessieCookie, veiligeTerug } from "@/lib/accounts/sessie";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await lees(req);
  if (!b) return antwoord({ ok: false, melding: "Ongeldig verzoek." }, 400);
  const r = await inloggen({
    naam: tekst(b.naam, 40),
    wachtwoord: tekst(b.wachtwoord, 220),
    bron: bronVan(req),
    apparaat: (req.headers.get("user-agent") ?? "onbekend").slice(0, 120),
  });
  if (!r.ok) return antwoord({ ok: false, melding: r.melding, vergrendeld: r.vergrendeld ?? false }, r.vergrendeld ? 429 : 401);
  return antwoord({ ok: true, terug: veiligeTerug(tekst(b.terug, 300)) }, 200, { "Set-Cookie": sessieCookie(r.token, isHttps(req)) });
}
