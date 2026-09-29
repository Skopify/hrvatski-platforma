import { antwoord, eisEigenaar, lees } from "@/lib/accounts/api";
import { beheerVerwijder } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisEigenaar(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  try {
    await beheerVerwijder({ uitvoerderId: r.gebruiker.id, doelId: Number(b?.id) });
    return antwoord({ ok: true });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Dat lukte niet." }, 400);
  }
}
