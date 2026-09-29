import { antwoord, eisGebruiker, lees, tekst } from "@/lib/accounts/api";
import { wijzigWachtwoord } from "@/lib/accounts/registreren";
import { tokenUitRequest } from "@/lib/accounts/sessie";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  if (!b) return antwoord({ ok: false, melding: "Ongeldig verzoek." }, 400);
  try {
    await wijzigWachtwoord({ gebruikerId: r.gebruiker.id, huidig: tekst(b.huidig, 220), nieuw: tekst(b.nieuw, 220), behoudToken: tokenUitRequest(req) });
    return antwoord({ ok: true });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Wijzigen lukte niet." }, 400);
  }
}
