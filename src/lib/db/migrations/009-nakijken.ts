/**
 * Het nakijkregister.
 *
 * §7 van de spec vraagt een statusladder `generated → validated →
 * human_approved` en een scherm waarop een moedertaalspreker items goedkeurt.
 * Dit is de opslag daarvoor.
 *
 * De sleutel is de zin zelf, niet de oefening waar hij in staat. Twee redenen.
 *
 * Ten eerste komt dezelfde zin in meer dan één oefening voor — «Idem u kino»
 * staat in de accusatiefmodule én in de module over voorzetsels. Die hoeft
 * niemand twee keer te beoordelen.
 *
 * Ten tweede, en dat is de belangrijkste: als ik de zin verander, is het
 * oordeel erover niet meer geldig. Met de zin als sleutel gebeurt dat vanzelf —
 * de gewijzigde zin is een nieuwe sleutel en staat weer ongecontroleerd in de
 * rij. Met een oefening-id als sleutel zou een goedkeuring blijven plakken aan
 * tekst die niemand ooit gezien heeft, en dat is precies het soort stille
 * onwaarheid waar dit register tegen moet beschermen.
 */
export const sql = `
CREATE TABLE zin_review (
  hash TEXT PRIMARY KEY,
  hr TEXT NOT NULL,
  status TEXT NOT NULL,
  correctie TEXT,
  opmerking TEXT,
  nagekeken_op INTEGER NOT NULL
);

CREATE INDEX zin_review_status ON zin_review (status);
`;
