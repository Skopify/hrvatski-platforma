import { antwoord, eisGebruiker, lees, tekst } from "@/lib/accounts/api";
import { verwijderAccount } from "@/lib/accounts/registreren";
import { isHttps, wisCookie } from "@/lib/accounts/sessie";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  try {
    await verwijderAccount({ gebruikerId: r.gebruiker.id, wachtwoord: tekst(b?.wachtwoord, 220) });
    return antwoord({ ok: true }, 200, { "Set-Cookie": wisCookie(isHttps(req)) });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Verwijderen lukte niet." }, 400);
  }
}
