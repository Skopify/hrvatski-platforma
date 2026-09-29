import { antwoord, eisEigenaar } from "@/lib/accounts/api";
import { registratieOpen } from "@/lib/accounts/registreren";
import { lijstGebruikers } from "@/lib/accounts/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const r = eisEigenaar(req);
  if ("fout" in r) return r.fout;
  return antwoord({ ok: true, gebruikers: lijstGebruikers(), registratieOpen: registratieOpen() });
}
