import { antwoord, eisGebruiker, lees, tekst } from "@/lib/accounts/api";
import { wijzigWeergavenaam } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  try {
    wijzigWeergavenaam(r.gebruiker.id, tekst(b?.weergavenaam, 60));
    return antwoord({ ok: true });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Dat lukte niet." }, 400);
  }
}
