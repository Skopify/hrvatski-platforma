/**
 * Verhaalzinnen adresseerbaar maken.
 *
 * Een woordkaart zonder bronzin is een woordenlijstje, en woordenlijstjes zijn
 * precies wat er niet blijft hangen. Zodra een woord uit een verhaal wordt
 * bewaard, moet de zin waarin je het tegenkwam mee — dat is de context die het
 * woord vasthoudt, en later ook de basis voor cloze-kaarten uit lopende tekst.
 *
 * Daar is een vaste verwijzing voor nodig. De verhalen stonden als geneste JSON
 * zonder zin-ids; volgnummers zouden verschuiven zodra er ergens een zin bij
 * komt, en dan wijst elke bewaarde kaart naar de verkeerde zin. Vandaar een id
 * in de brondata zelf (`ovo-je-nina.p1.s3`) en deze tabel als index erop.
 *
 * De inhoud komt uit content/stories/*.json en wordt door de seed geplaatst,
 * niet door deze migratie: content hoort in bestanden te staan, niet in een
 * schemawijziging.
 */
export const sql = `
CREATE TABLE sentence (
  id TEXT PRIMARY KEY,
  story_slug TEXT NOT NULL,
  paragraph_id TEXT NOT NULL,
  /** Volgnummer binnen het verhaal, voor "de zin ervóór". */
  idx INTEGER NOT NULL,
  hr TEXT NOT NULL,
  nl TEXT NOT NULL
);
CREATE INDEX sentence_story_idx ON sentence(story_slug);
`;
