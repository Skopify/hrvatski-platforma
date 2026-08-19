/**
 * Wat je zelf geschreven hebt.
 *
 * Eén rij per opdracht, en die wordt overschreven als je hem herschrijft. Het
 * gaat hier niet om een logboek van elke toetsaanslag maar om het stuk tekst
 * zelf: je kunt terug naar wat je schreef, het naast het modelantwoord leggen,
 * en over een half jaar zien hoe ver je gekomen bent.
 *
 * `klaar` staat los van de inhoud. Een schrijfopdracht is af wanneer jij zegt
 * dat hij af is — bij de meeste opdrachten kan het programma maar een deel van
 * de criteria vaststellen, en dan hoort het oordeel niet bij de automaat te
 * liggen. Waar élk criterium mechanisch is, zet het scherm het vinkje voor je,
 * maar de kolom blijft van jou.
 */
export const sql = `
CREATE TABLE schrijfwerk (
  opdracht TEXT PRIMARY KEY,
  tekst TEXT NOT NULL,
  klaar INTEGER NOT NULL DEFAULT 0,
  woorden INTEGER NOT NULL DEFAULT 0,
  bijgewerkt INTEGER NOT NULL,
  afgerond INTEGER
);
`;
