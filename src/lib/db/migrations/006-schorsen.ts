/**
 * Kaarten uit de rotatie kunnen halen.
 *
 * §6.4: een item met zes of meer missers moet uit de normale herhaling. Niet uit
 * mildheid, maar omdat het anders eindeloos frustratie blijft produceren zonder
 * iets op te leveren — je ziet het telkens terug, je weet het telkens niet, en
 * het verdringt woorden die wél zouden blijven hangen.
 *
 * Een geschorste kaart blijft bestaan mét zijn hele historie. Herstellen is een
 * bewuste handeling: nieuwe context, een ezelsbruggetje, of gewoon uitstellen.
 *
 * `suspended_reason` staat erbij zodat later te zien is waaróm iets eruit ging.
 * Nu is dat altijd "leech", maar de plaatsingstoets van Fase 1.5 gaat modules
 * op `beheerst` zetten, en dan is "je kunt dit al" een tweede reden.
 */
export const sql = `
ALTER TABLE card ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
ALTER TABLE card ADD COLUMN suspended_at INTEGER;
ALTER TABLE card ADD COLUMN suspended_reason TEXT;
CREATE INDEX card_suspended_idx ON card(suspended);
`;
