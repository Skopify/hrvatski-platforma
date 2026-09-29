import { NextResponse, type NextRequest } from "next/server";

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

const PRIVATE_IPV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

function hostnameOf(host: string): string {
  // "[::1]:3000" → "[::1]"; "localhost:3000" → "localhost"
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
}

export function hostToegestaan(host: string | null): boolean {
  if (!host) return false;
  const naam = hostnameOf(host.toLowerCase());
  return (
    naam === "localhost" ||
    naam === "[::1]" ||
    naam.endsWith(".local") ||
    PRIVATE_IPV4.test(naam) ||
    EXTRA.includes(naam)
  );
}

const LEZEN = new Set(["GET", "HEAD", "OPTIONS"]);

export function middleware(req: NextRequest) {
  const host = req.headers.get("host");
  if (!hostToegestaan(host)) {
    return new NextResponse("Deze hostnaam is niet toegestaan.", { status: 403 });
  }

  const site = req.headers.get("sec-fetch-site");
  const isApi = req.nextUrl.pathname.startsWith("/api/");

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
