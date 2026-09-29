import { antwoord, lees, tekst } from "@/lib/accounts/api";
import { wachtwoordVergeten } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await lees(req);
  if (!b) return antwoord({ ok: false, melding: "Ongeldig verzoek." }, 400);
  const r = await wachtwoordVergeten({ naam: tekst(b.naam, 40), herstelcode: tekst(b.herstelcode, 60), nieuw: tekst(b.nieuw, 220) });
  return r.ok ? antwoord({ ok: true, nieuweHerstelcode: r.nieuweHerstelcode }) : antwoord({ ok: false, melding: r.melding, vergrendeld: r.vergrendeld ?? false }, r.vergrendeld ? 429 : 400);
}
