/**
 * Kroatische hoofdtelwoorden, 0 tot en met 100.
 *
 * Getallen zijn het enige stuk taal dat het platform durft te génereren in
 * plaats van uit de brondata te lezen: ze zijn volledig regelmatig, en de
 * regels staan in les 0 (1-10) en les 17 (tientallen, samenstellingen).
 */

const ONES = [
  "nula",
  "jedan",
  "dva",
  "tri",
  "četiri",
  "pet",
  "šest",
  "sedam",
  "osam",
  "devet",
];

const TEENS = [
  "deset",
  "jedanaest",
  "dvanaest",
  "trinaest",
  "četrnaest",
  "petnaest",
  "šesnaest",
  "sedamnaest",
  "osamnaest",
  "devetnaest",
];

const TENS = [
  "",
  "",
  "dvadeset",
  "trideset",
  "četrdeset",
  "pedeset",
  "šezdeset",
  "sedamdeset",
  "osamdeset",
  "devedeset",
];

/** Canonieke schrijfwijze: "dvadeset jedan" (zonder i). */
export function brojHr(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 100) {
    throw new Error(`Buiten bereik: ${n}`);
  }
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  if (n === 100) return "sto";
  const tens = TENS[Math.floor(n / 10)];
  const rest = n % 10;
  return rest === 0 ? tens : `${tens} ${ONES[rest]}`;
}

/**
 * Alle geaccepteerde schrijfwijzen. In spreektaal is "dvadeset i jedan" net zo
 * gewoon als "dvadeset jedan" — beide goed rekenen, anders leert de oefening
 * spelling in plaats van getallen.
 */
export function brojAccepts(n: number): string[] {
  const canonical = brojHr(n);
  const rest = n % 10;
  if (n > 20 && n < 100 && rest !== 0) {
    const tens = TENS[Math.floor(n / 10)];
    return [canonical, `${tens} i ${ONES[rest]}`];
  }
  return [canonical];
}
