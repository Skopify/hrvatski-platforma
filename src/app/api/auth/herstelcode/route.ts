import { antwoord, eisGebruiker, lees, tekst } from "@/lib/accounts/api";
import { vernieuwHerstelcode } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  try {
    return antwoord({ ok: true, herstelcode: await vernieuwHerstelcode({ gebruikerId: r.gebruiker.id, wachtwoord: tekst(b?.wachtwoord, 220) }) });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Dat lukte niet." }, 400);
  }
}
