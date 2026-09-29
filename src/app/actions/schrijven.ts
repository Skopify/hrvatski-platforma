"use server";
import { MAX_SCHRIJFTEKST, tekst as begrensTekst } from "@/lib/valideer";
import { type Schrijfoordeel, beoordeel, bewaarWerk, loadOpdracht } from "@/lib/schrijven";

export async function bewaarSchrijfwerk(id: string, tekst: string, klaar: boolean): Promise<void> {
  bewaarWerk(id, begrensTekst(tekst, MAX_SCHRIJFTEKST), Boolean(klaar));
}

/**
 * Nakijken wat na te kijken is.
 *
 * Draait op de server omdat de vormcatalogus daar staat: vijfduizend vormen
 * meesturen naar de browser om drie spelfouten te vinden is de verkeerde ruil.
 */
export async function beoordeelSchrijfwerk(id: string, tekst: string): Promise<Schrijfoordeel> {
  const opdracht = loadOpdracht(id);
  if (!opdracht) throw new Error(`Onbekende schrijfopdracht: ${id}`);
  return beoordeel(opdracht, begrensTekst(tekst, MAX_SCHRIJFTEKST));
}
