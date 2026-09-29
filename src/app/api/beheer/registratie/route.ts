import { antwoord, eisEigenaar, lees } from "@/lib/accounts/api";
import { zetRegistratie } from "@/lib/accounts/registreren";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const r = eisEigenaar(req);
  if ("fout" in r) return r.fout;
  const b = await lees(req);
  await zetRegistratie({ uitvoerderId: r.gebruiker.id, open: b?.open === true });
  return antwoord({ ok: true });
}
