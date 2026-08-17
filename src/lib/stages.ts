import { and, eq, sql } from "drizzle-orm";

import { db } from "./db";
import { card, items, sentence, srs, type CardKind } from "./db/schema";
import type { VocabEntry } from "./content";
import { analyze } from "./analyze";
import { ensureCards } from "./srs";

/**
 * Een woord kennen is een traject, geen schakelaar.
 *
 * §1.7 en §6.2: herkennen (kuća → huis), de vorm in context invullen, en
 * produceren (huis → kuća) zijn verschillende vaardigheden die op verschillende
 * momenten wegzakken. Je herkent een woord maanden nadat je het niet meer kunt
 * oproepen. Ze verdienen dus aparte kaarten — en ze horen niet tegelijk te
 * beginnen.
 *
 * De klassieke faalmodus die deze ladder voorkomt: alle kaarttypes meteen
 * aanmaken. Dan krijg je productiekaarten van woorden die je nog niet eens
 * herkent, faal je daarop, en groeit de achterstand sneller dan je hem inloopt.
 * Promoveren gebeurt daarom pas als het huidige stadium stevig staat.
 */

/**
 * De ladder. Audio-herkenning (§6.2 stadium 4) is vervallen: het doel is lezen
 * en schrijven, niet luisteren.
 */
export const STAGES: CardKind[] = ["LEX_RECOG", "CLOZE", "LEX_PROD"];

/**
 * Vanaf welke stabiliteit een stadium "stevig" heet, in dagen.
 *
 * Eenentwintig dagen is geen toevallig getal: het is het punt waarop een kaart
 * de dagelijkse rotatie uit is en in de wekelijkse zit. Eerder promoveren
 * betekent een tweede kaart aanmaken van iets wat nog wankelt.
 */
export const PROMOTE_AT = 21;

/** Vanaf hoeveel missers een kaart uit de rotatie gaat (§6.4). */
export const LEECH_AT = 6;

export function startStage(): CardKind {
  return STAGES[0]!;
}

export function nextStage(kind: CardKind): CardKind | null {
  const i = STAGES.indexOf(kind);
  if (i < 0 || i === STAGES.length - 1) return null;
  return STAGES[i + 1]!;
}

/* ----------------------------------------------------------- promotie --- */

interface KaartRij {
  id: number;
  kind: CardKind;
  itemId: string;
  context: string;
}

function kaart(cardId: number): KaartRij | undefined {
  return db
    .select({ id: card.id, kind: card.kind, itemId: card.itemId, context: card.context })
    .from(card)
    .where(eq(card.id, cardId))
    .get() as KaartRij | undefined;
}

/**
 * Promoveert een kaart naar het volgende stadium als hij daar klaar voor is.
 * Geeft de nieuwe kaartsoort terug, of null als er niets is gebeurd.
 *
 * Idempotent: bestaat de volgende kaart al, dan gebeurt er niets.
 */
export function promoteIfReady(cardId: number): CardKind | null {
  const rij = kaart(cardId);
  if (!rij) return null;

  const toestand = db
    .select({ stability: srs.stability, state: srs.state })
    .from(srs)
    .where(eq(srs.cardId, cardId))
    .get();
  if (!toestand || toestand.stability < PROMOTE_AT) return null;

  let doel = nextStage(rij.kind);
  while (doel) {
    // Een stadium overslaan mag, als het niet te bouwen is. Een clozekaart
    // zonder bronzin is een kaart zonder vraag; dan liever door naar productie
    // dan een lege kaart in de planning.
    if (canBuild(rij.itemId, doel)) break;
    doel = nextStage(doel);
  }
  if (!doel) return null;

  const bestaat = db
    .select({ id: card.id })
    .from(card)
    .where(and(eq(card.itemId, rij.itemId), eq(card.kind, doel), eq(card.context, "")))
    .get();
  if (bestaat) return null;

  // Via ensureCards, zodat de nieuwe kaart meteen een FSRS-toestand krijgt.
  ensureCards([rij.itemId], doel);
  return doel;
}

/** Kan er voor dit item een zinnige kaart van deze soort gemaakt worden? */
export function canBuild(itemId: string, kind: CardKind): boolean {
  if (kind === "CLOZE") return Boolean(bronzin(itemId));
  return true;
}

/* -------------------------------------------------------------- leech --- */

export function isSuspended(cardId: number): boolean {
  const rij = db.select({ s: card.suspended }).from(card).where(eq(card.id, cardId)).get();
  return rij?.s === 1;
}

export function suspend(cardId: number, reason: string): void {
  db.update(card)
    .set({ suspended: 1, suspendedAt: Date.now(), suspendedReason: reason })
    .where(eq(card.id, cardId))
    .run();
}

/**
 * Terug in de rotatie, met de misserteller op nul.
 *
 * Die nul is het punt. Een hersteld item dat zijn zes missers meeneemt, is na
 * één misstap meteen weer leech — en dan is "herstellen" een lege handeling.
 * De historie blijft in review_log staan; alleen de teller waar de leechregel
 * op kijkt, gaat terug.
 */
export function restore(cardId: number): void {
  db.update(card)
    .set({ suspended: 0, suspendedAt: null, suspendedReason: null })
    .where(eq(card.id, cardId))
    .run();
  db.update(srs).set({ lapses: 0 }).where(eq(srs.cardId, cardId)).run();
}

/** Schorst de kaart als hij de missergrens heeft bereikt. */
export function checkLeech(cardId: number): boolean {
  const rij = db.select({ lapses: srs.lapses }).from(srs).where(eq(srs.cardId, cardId)).get();
  if (!rij || rij.lapses < LEECH_AT) return false;
  if (isSuspended(cardId)) return true;
  suspend(cardId, "leech");
  return true;
}

export interface Leech {
  cardId: number;
  itemId: string;
  kind: CardKind;
  label: string;
  lapses: number;
}

/** Alle kaarten die uit de rotatie zijn gehaald, voor het herstelscherm. */
export function leeches(): Leech[] {
  return db
    .select({
      cardId: card.id,
      itemId: card.itemId,
      kind: card.kind,
      label: items.label,
      lapses: srs.lapses,
    })
    .from(card)
    .innerJoin(items, eq(items.id, card.itemId))
    .innerJoin(srs, eq(srs.cardId, card.id))
    .where(eq(card.suspended, 1))
    .orderBy(sql`${srs.lapses} desc`)
    .all() as Leech[];
}

/* ------------------------------------------------------------- vragen --- */

export interface StageQuestion {
  cardId: number;
  itemId: string;
  kind: CardKind;
  prompt: string;
  answer: string;
  accepts: string[];
  mode: "receptive" | "productive";
  /** Wat er klein onder de vraag staat. */
  sub?: string;
}

/** Een zin uit een verhaal waarin dit woord voorkomt — de bron voor een cloze. */
function bronzin(itemId: string): { hr: string; nl: string; vorm: string } | null {
  const woord = db.select({ payload: items.payload }).from(items).where(eq(items.id, itemId)).get();
  if (!woord) return null;
  const v = woord.payload as VocabEntry;
  if (!v?.hr) return null;

  const zinnen = db.select({ hr: sentence.hr, nl: sentence.nl }).from(sentence).all();
  for (const z of zinnen) {
    for (const token of analyze(z.hr)) {
      if (token.lemmaId === itemId) return { hr: z.hr, nl: z.nl, vorm: token.surface };
    }
  }
  return null;
}

/**
 * De vraag die bij een kaart hoort, opgebouwd uit de woordgegevens zelf.
 *
 * Hier zit de reden dat de woordenschatsectie kan bestaan zonder dat iemand
 * duizenden oefeningen schrijft: een woordkaart draagt alles wat een vraag
 * nodig heeft. Van de 6290 items worden er maar 405 door een geschreven
 * oefening aangesproken; deze functie maakt de rest bereikbaar.
 */
export function questionFor(cardId: number): StageQuestion | null {
  const rij = kaart(cardId);
  if (!rij) return null;

  const woord = db
    .select({ payload: items.payload })
    .from(items)
    .where(eq(items.id, rij.itemId))
    .get();
  if (!woord) return null;
  const v = woord.payload as VocabEntry;
  if (!v?.hr || !v?.nl) return null;

  const basis = { cardId, itemId: rij.itemId, kind: rij.kind };

  switch (rij.kind) {
    case "LEX_RECOG":
      return {
        ...basis,
        prompt: v.hr,
        answer: v.nl,
        // De vertaling staat vaak als "familie, gezin": elk alternatief telt.
        accepts: v.nl.split(/\s*[,;]\s*/).filter(Boolean),
        mode: "receptive",
        sub: v.pos === "noun" && v.gender ? `${v.gender === "m" ? "muški" : v.gender === "f" ? "ženski" : "srednji"}` : undefined,
      };

    case "LEX_PROD":
      return {
        ...basis,
        prompt: v.nl,
        answer: v.hr,
        accepts: [v.hr],
        mode: "productive",
        sub: v.pos === "verb" ? "werkwoord — geef de infinitief" : undefined,
      };

    case "CLOZE": {
      const zin = bronzin(rij.itemId);
      if (!zin) return null;
      // De vorm zoals hij in de zin staat wordt het gat; de betekenis komt als
      // aanwijzing mee, zodat vorm én betekenis tegelijk getoetst worden.
      const gat = zin.hr.replace(zin.vorm, "___");
      if (gat === zin.hr) return null;
      return {
        ...basis,
        prompt: gat,
        answer: zin.vorm,
        accepts: [zin.vorm],
        mode: "productive",
        sub: `${zin.nl} — (${v.nl})`,
      };
    }

    default:
      return null;
  }
}
