import { antwoord } from "@/lib/accounts/api";
import { isHttps, tokenUitRequest, wisCookie } from "@/lib/accounts/sessie";
import { verwijderSessie } from "@/lib/accounts/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const t = tokenUitRequest(req);
  if (t) verwijderSessie(t);
  return antwoord({ ok: true }, 200, { "Set-Cookie": wisCookie(isHttps(req)) });
}
