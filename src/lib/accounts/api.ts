import type { Gebruiker } from "./store";
import { gebruikerVanRequest } from "./sessie";

/* Kleine hulpjes voor de API-routes onder /api/auth en /api/beheer. */

export const antwoord = (data: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers } });

/** De JSON van een verzoek, met een bovengrens: niemand hoeft hier een megabyte naartoe te sturen. */
export async function lees<T extends Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const tekst = await req.text();
    if (tekst.length > 4000) return null;
    const v = JSON.parse(tekst);
    return v && typeof v === "object" ? (v as T) : null;
  } catch {
    return null;
  }
}

export const tekst = (v: unknown, max = 200) => (typeof v === "string" ? v.slice(0, max) : "");

/** Ingelogd, of een 401 om terug te geven. */
export function eisGebruiker(req: Request): { gebruiker: Gebruiker } | { fout: Response } {
  const gebruiker = gebruikerVanRequest(req);
  return gebruiker ? { gebruiker } : { fout: antwoord({ ok: false, melding: "Niet ingelogd." }, 401) };
}

export function eisEigenaar(req: Request): { gebruiker: Gebruiker } | { fout: Response } {
  const r = eisGebruiker(req);
  if ("fout" in r) return r;
  return r.gebruiker.rol === "eigenaar" ? r : { fout: antwoord({ ok: false, melding: "Alleen de eigenaar mag dit." }, 403) };
}
