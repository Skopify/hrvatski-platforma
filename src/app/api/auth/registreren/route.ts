import { antwoord, lees, tekst } from "@/lib/accounts/api";
import { registreer } from "@/lib/accounts/registreren";
import { isHttps, sessieCookie, vanLaptop } from "@/lib/accounts/sessie";
import { maakSessie } from "@/lib/accounts/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await lees(req);
  if (!b) return antwoord({ ok: false, melding: "Ongeldig verzoek." }, 400);
  try {
    const r = await registreer({
      naam: tekst(b.naam, 40),
      weergavenaam: tekst(b.weergavenaam, 60),
      wachtwoord: tekst(b.wachtwoord, 220),
      vanLaptop: vanLaptop(req),
    });
    const token = maakSessie(r.gebruiker.id, (req.headers.get("user-agent") ?? "onbekend").slice(0, 120));
    return antwoord(
      { ok: true, herstelcode: r.herstelcode, overgenomen: r.overgenomen, naam: r.gebruiker.weergavenaam },
      200,
      { "Set-Cookie": sessieCookie(token, isHttps(req)) },
    );
  } catch (e) {
    return antwoord({ ok: false, melding: e instanceof Error ? e.message : "Registreren lukte niet." }, 400);
  }
}
