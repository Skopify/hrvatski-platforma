import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { COOKIE_NAAM } from "./context";
import { sessieDagen, zoekSessie, type Gebruiker } from "./store";

/*
  De laag tussen Next en de accounts: cookies zetten en lezen, en "wie ben jij" voor pagina's
  en API's. Alleen op de server.
*/

/** De Set-Cookie voor een nieuwe sessie. Secure alleen als het verzoek https is (op je thuiswifi is het http). */
export function sessieCookie(token: string, https: boolean): string {
  return `${COOKIE_NAAM}=${token}; Path=/; Max-Age=${sessieDagen * 86400}; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;
}

export const wisCookie = (https: boolean) => `${COOKIE_NAAM}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${https ? "; Secure" : ""}`;

export const isHttps = (req: Request) => (req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "")) === "https";

export function tokenUitRequest(req: Request): string | undefined {
  const c = req.headers.get("cookie");
  if (!c) return undefined;
  for (const deel of c.split(";")) {
    const i = deel.indexOf("=");
    if (i > 0 && deel.slice(0, i).trim() === COOKIE_NAAM) return deel.slice(i + 1).trim();
  }
  return undefined;
}

export const gebruikerVanRequest = (req: Request): Gebruiker | null => zoekSessie(tokenUitRequest(req));

/** Komt het verzoek van de laptop zelf? De poortwachter voor telefoon en iPad markeert alles wat hij doorgeeft. */
export const vanLaptop = (req: Request) => !req.headers.get("x-hrvatski-via");

/** Wie doet dit? Het apparaat (voor de begrenzing van foute pogingen): de poortwachter geeft het IP mee. */
export const bronVan = (req: Request) => req.headers.get("x-hrvatski-bron") ?? "laptop";

/** Voor pagina's: de ingelogde gebruiker, of doorsturen naar inloggen. */
export async function vereisGebruiker(): Promise<Gebruiker> {
  const jar = await cookies();
  const g = zoekSessie(jar.get(COOKIE_NAAM)?.value);
  if (!g) redirect("/inloggen");
  return g;
}

export async function vereisEigenaarPagina(): Promise<Gebruiker> {
  const g = await vereisGebruiker();
  if (g.rol !== "eigenaar") redirect("/account");
  return g;
}

/** Een veilige plek om na het inloggen naartoe te gaan: alleen een pad op deze site. */
export function veiligeTerug(t: string | null | undefined): string {
  if (!t || !t.startsWith("/") || t.startsWith("//") || t.includes("\\") || t.startsWith("/inloggen") || t.startsWith("/registreren")) return "/";
  return t;
}
