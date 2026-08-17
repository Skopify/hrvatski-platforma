/**
 * Op welke trede een oefening werd opgelost.
 *
 * Met escalerende feedback is "goed" niet meer één ding. In één keer goed, goed
 * nadat je een hint kreeg, en goed nadat je uit drie vormen mocht kiezen zijn
 * drie verschillende prestaties — en het verschil is precies wat je wilt kunnen
 * volgen. Zonder deze kolom zouden ze alle drie als "correct" in dezelfde bak
 * vallen en zou het escaleren zelf onzichtbaar zijn.
 *
 *   0  meteen goed
 *   1  goed na de hint
 *   2  goed na de keuze
 *   3  niet opgelost; het antwoord is getoond
 *
 * Bestaande rijen krijgen 0. Dat is niet helemaal waar — die zijn beantwoord
 * toen er nog geen tredes waren — maar het is de enige waarde die de statistiek
 * niet vertekent, en het klopt voor alles wat goed was.
 */
export const sql = `
ALTER TABLE attempts ADD COLUMN stage INTEGER NOT NULL DEFAULT 0;
CREATE INDEX attempts_stage_idx ON attempts(stage);
`;
