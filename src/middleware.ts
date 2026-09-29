import { NextResponse, type NextRequest } from "next/server";

import { hostToegestaan as hostToegestaanBasis } from "@/lib/host";

/*
  De poort naar het platform.

  Twee aanvallen die op een lokale server werken, en die dit afvangt:

  1. DNS-rebinding. Een kwaadaardige pagina laat zijn eigen domeinnaam naar
     127.0.0.1 wijzen; je browser stuurt dan verzoeken met dát domein als Host
     naar jouw server, en beschouwt ze als "zelfde site" als de pagina zelf.
     Daarom accepteren we alleen Host-namen die van jezelf zijn: localhost, het
     loopback-adres, een IP-adres uit een privé-netwerk (telefoon via wifi) of
     een .local-naam. Een aanvaller kan geen van die vier laten resolven naar
     zijn eigen server.

  2. Cross-site verzoeken. Een andere website mag geen antwoorden of acties
     op je database uitlokken, en geen betaalde spraakaanroepen doen. Alles
     behalve het openen van een pagina moet daarom van het platform zelf komen.

  Extra namen (bijvoorbeeld een eigen hostnaam in je netwerk) zet je in
  HRVATSKI_ALLOWED_HOSTS, komma-gescheiden.
*/

const EXTRA = (process.env.HRVATSKI_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

export function hostToegestaan(host: string | null): boolean {
  return hostToegestaanBasis(host, EXTRA);
}

/*
  Wie niet ingelogd is, komt alleen bij de inlogpagina's. Deze poort kan in de Edge-runtime de
  sessie niet tegen de database controleren; ze kijkt alleen of er een sessiecookie is.
  De echte controle staat in (app)/layout.tsx, in elke API-route, en in de database zelf: zonder
  geldige sessie geeft `db` niets (src/lib/db). Deze poort is dus het eerste net, niet het enige.
*/
const PUBLIEK = [
  /^\/inloggen(\/|$)/,
  /^\/registreren(\/|$)/,
  /^\/wachtwoord-vergeten(\/|$)/,
  /^\/api\/auth\/(inloggen|registreren|vergeten)$/,
  /^\/api\/leven$/,
  /^\/manifest\.webmanifest$/,
  /^\/icons\//,
];
const SESSIE_COOKIE = "hr_sessie";

const MAC_ALLEEN = ["/api/afsluiten", "/api/koppelcode", "/api/lan", "/api/herstart"];

const LEZEN = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (!hostToegestaan(host)) {
    return new NextResponse("Deze hostnaam is niet toegestaan.", { status: 403 });
  }

  // Beheer (afsluiten, koppelcode, telefoon aan/uit) is er alleen op de laptop zelf.
  // De poortwachter voor telefoon en iPad zet x-hrvatski-via op elk verzoek dat
  // hij doorgeeft; een verzoek met die kop komt dus van een ander apparaat.
  if (req.headers.get("x-hrvatski-via") && MAC_ALLEEN.some((p) => req.nextUrl.pathname === p)) {
    return new NextResponse("Alleen op de laptop zelf.", { status: 403 });
  }

  const site = req.headers.get("sec-fetch-site");
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (!PUBLIEK.some((r) => r.test(req.nextUrl.pathname)) && !req.cookies.get(SESSIE_COOKIE)?.value) {
    if (isApi) return NextResponse.json({ ok: false, melding: "Niet ingelogd." }, { status: 401 });
    const naar = req.nextUrl.clone();
    const terug = req.nextUrl.pathname + req.nextUrl.search;
    naar.pathname = "/inloggen";
    naar.search = terug !== "/" ? `?terug=${encodeURIComponent(terug)}` : "";
    return NextResponse.redirect(naar);
  }

  // Acties en API's: alleen van het platform zelf. "none" is een adres dat je
  // zelf intypt; dat mag voor een pagina, niet voor iets wat data verandert.
  if (!LEZEN.has(req.method) || isApi) {
    if (site && site !== "same-origin" && !(site === "none" && LEZEN.has(req.method))) {
      return new NextResponse("Verzoek van een andere herkomst geweigerd.", { status: 403 });
    }
    const origin = req.headers.get("origin");
    if (origin && !LEZEN.has(req.method)) {
      try {
        if (new URL(origin).host !== host) {
          return new NextResponse("Verzoek van een andere herkomst geweigerd.", { status: 403 });
        }
      } catch {
        return new NextResponse("Ongeldige herkomst.", { status: 403 });
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|fonts/).*)"],
};
