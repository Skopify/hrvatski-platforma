import { antwoord, eisEigenaar, lees } from "@/lib/accounts/api";
import { beheerResetWachtwoord } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisEigenaar(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  try {
    return antwoord({ ok: true, ...(await beheerResetWachtwoord({ uitvoerderId: r.gebruiker.id, doelId: Number(b?.id) })) });
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Dat lukte niet." }, 400);
  }
}
