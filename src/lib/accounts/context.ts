import { AsyncLocalStorage } from "node:async_hooks";

import { zoekSessie, type Gebruiker } from "./store";

/*
  Wie is de gebruiker die nu iets doet?

  De database (src/lib/db) is per gebruiker, en het lib-werk daaronder (statistieken,
  planner, SRS) roept `db` gewoon aan zonder te weten van wie. Dit bepaalt op dat moment
  wiens database dat is. Volgorde:

    1. Een expliciete context (metGebruiker): scripts en tests.
    2. Het sessiecookie van het lopende verzoek. Next geeft dat via zijn eigen
       verzoekopslag, en cookies() daaruit is asynchroon terwijl de database synchroon is;
       daarom lezen we hier direct uit die opslag. Dat is een interne API van Next, en
       daarom staat ze op één plek: verandert ze bij een update, dan faalt
       check:accounts hard in plaats van dat er iets stil misgaat.
    3. Anders niemand: en dan geeft de database niets (faalt dicht).
*/
export const COOKIE_NAAM = "hr_sessie";

export class GeenGebruikerError extends Error {
  constructor() {
    super("Niet ingelogd.");
    this.name = "GeenGebruikerError";
  }
}

const als = new AsyncLocalStorage<{ gebruikerId: number }>();

export function metGebruiker<T>(gebruikerId: number, fn: () => T): T {
  return als.run({ gebruikerId }, fn);
}

type Opslag = { getStore(): { type?: string; cookies?: { get(naam: string): { value: string } | undefined } } | undefined };
let nextOpslag: Opslag | null | undefined;

function requestOpslag(): Opslag | null {
  if (nextOpslag !== undefined) return nextOpslag;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const m = require("next/dist/server/app-render/work-unit-async-storage.external") as { workUnitAsyncStorage?: Opslag };
    nextOpslag = m.workUnitAsyncStorage ?? null;
  } catch {
    nextOpslag = null; // buiten Next (scripts): geen verzoekopslag
  }
  return nextOpslag;
}

/** Het sessietoken uit het cookie van het lopende verzoek, als er een verzoek loopt. */
export function huidigToken(): string | undefined {
  const store = requestOpslag()?.getStore();
  if (store?.type === "request") return store.cookies?.get(COOKIE_NAAM)?.value;
  return undefined;
}

export function huidigeGebruiker(): Gebruiker | null {
  return zoekSessie(huidigToken());
}

/** De id van wie nu bezig is, of null. */
export function huidigeGebruikerId(): number | null {
  const ctx = als.getStore();
  if (ctx) return ctx.gebruikerId;
  return huidigeGebruiker()?.id ?? null;
}
