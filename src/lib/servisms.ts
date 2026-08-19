/**
 * Servismenfilter — de validatiepoort uit §7 van de spec.
 *
 * Kroatisch en Servisch zijn dicht genoeg bij elkaar dat een Servische vorm er
 * voor een leerder volstrekt normaal uitziet, en ver genoeg uit elkaar dat een
 * Kroaat hem er meteen uithaalt. Dat is de gevaarlijkste combinatie die er is:
 * de fout kost niets bij het leren en alles bij het spreken.
 *
 * Drie soorten staan hieronder, van hard naar zacht.
 *
 *   1. Uitspraak (ekavisch tegenover ijekavisch). `mleko` tegenover `mlijeko`.
 *      Dit is regelmatig en hard: de Kroatische standaard is ijekavisch,
 *      punt.
 *   2. Woordkeuze. `voz` tegenover `vlak`. Hard waar het woord in Kroatië
 *      echt niet gebruikt wordt, zacht waar beide voorkomen.
 *   3. Zinsbouw. `Hoću da idem` tegenover `Hoću ići`. Kroatisch zet de
 *      infinitief na een modaal werkwoord; het Servische `da` + presens wordt
 *      in Kroatië begrepen maar niet geschreven.
 *
 * Wat hier NIET in staat: vormen waarover Kroatische taalkundigen zelf van
 * mening verschillen. Een filter dat correcte content afkeurt, leert je hem
 * negeren — en dan glipt de volgende er ook doorheen.
 */

export interface Servisme {
  /** De Servische vorm, kleine letters. */
  fout: string;
  /** De Kroatische vorm. */
  goed: string;
  soort: "uitspraak" | "woordkeuze" | "zinsbouw";
  /** Bij twijfel niet afkeuren maar melden. */
  zeker: boolean;
}

/*
  Ekavisch tegenover ijekavisch. Alleen de vormen waarvan de Kroatische
  tegenhanger ook echt in de leergang voorkomt of voor de hand ligt — een
  eindeloze lijst zou dit bestand onleesbaar maken zonder er meer mee te vangen.
*/
const UITSPRAAK: [string, string][] = [
  ["lep", "lijep"], ["lepa", "lijepa"], ["lepo", "lijepo"], ["lepi", "lijepi"],
  ["mleko", "mlijeko"], ["dete", "dijete"], ["deca", "djeca"],
  ["vreme", "vrijeme"], ["mesto", "mjesto"], ["reka", "rijeka"],
  ["sneg", "snijeg"], ["beo", "bijel"], ["bela", "bijela"], ["belo", "bijelo"],
  ["sedeti", "sjediti"], ["videti", "vidjeti"], ["želeti", "željeti"],
  ["razumeti", "razumjeti"], ["živeti", "živjeti"], ["voleti", "voljeti"],
  ["nedelja", "nedjelja"], ["čovek", "čovjek"], ["devojka", "djevojka"],
  ["posle", "poslije"], ["pesma", "pjesma"], ["sever", "sjever"],
  ["telo", "tijelo"], ["cvet", "cvijet"], ["svet", "svijet"],
  ["zvezda", "zvijezda"], ["vera", "vjera"], ["mera", "mjera"],
  ["ceo", "cijel"], ["cela", "cijela"], ["uvek", "uvijek"],
  ["negde", "negdje"], ["ovde", "ovdje"], ["gde", "gdje"], ["nigde", "nigdje"],
  ["ovde", "ovdje"], ["obe", "obje"], ["dve", "dvije"], ["nedelju", "nedjelju"],
  ["greška", "pogreška"], ["hteo", "htio"], ["smeo", "smio"],
];

/*
  Woordkeuze. `zeker: false` bij woorden die in Kroatië wél voorkomen maar niet
  de standaardkeuze zijn — die worden gemeld, niet afgekeurd.
*/
const WOORDKEUZE: [string, string, boolean][] = [
  ["hleb", "kruh", true],
  ["voz", "vlak", true],
  ["talas", "val", true],
  ["vazduh", "zrak", true],
  ["hiljada", "tisuća", true],
  ["hiljadu", "tisuću", true],
  ["fudbal", "nogomet", true],
  ["kafa", "kava", true],
  ["kafu", "kavu", true],
  ["porodica", "obitelj", true],
  ["uslov", "uvjet", true],
  ["opšte", "opće", true],
  ["opština", "općina", true],
  ["saobraćaj", "promet", true],
  ["ostrvo", "otok", true],
  ["bioskop", "kino", true],
  ["pozorište", "kazalište", true],
  ["lekar", "liječnik", true],
  ["apoteka", "ljekarna", true],
  ["sopstveni", "vlastiti", true],
  ["šargarepa", "mrkva", true],
  ["paradajz", "rajčica", true],
  ["pasulj", "grah", true],
  ["viljuška", "vilica", true],
  ["kašika", "žlica", true],
  ["šolja", "šalica", true],
  ["peškir", "ručnik", true],
  ["ćebe", "deka", true],
  ["sprat", "kat", true],
  ["patike", "tenisice", true],
  ["dugme", "gumb", true],
  ["sedmica", "tjedan", true],
  ["ko", "tko", true],
  ["neko", "netko", true],
  ["niko", "nitko", true],
  ["šta", "što", true],
  ["izvinite", "oprostite", true],
  ["hoćeš li da", "hoćeš li", true],
  // De maanden. Kroatisch heeft eigen namen; de Latijnse worden begrepen maar
  // staan niet in een Kroatisch leerboek.
  ["januar", "siječanj", true], ["februar", "veljača", true], ["mart", "ožujak", true],
  ["april", "travanj", true], ["maj", "svibanj", true], ["jun", "lipanj", true],
  ["jul", "srpanj", true], ["avgust", "kolovoz", true], ["septembar", "rujan", true],
  ["oktobar", "listopad", true], ["novembar", "studeni", true], ["decembar", "prosinac", true],
  // -isati tegenover -irati.
  ["organizovati", "organizirati", true],
  ["informisati", "informirati", true],
  ["interesovati", "interesirati", true],
  ["studirati", "studirati", false],
];

export const SERVISMEN: Servisme[] = [
  ...UITSPRAAK.map(([fout, goed]): Servisme => ({ fout, goed, soort: "uitspraak", zeker: true })),
  ...WOORDKEUZE.filter(([f, g]) => f !== g).map(
    ([fout, goed, zeker]): Servisme => ({ fout, goed, soort: "woordkeuze", zeker }),
  ),
];

const OP_WOORD = new Map(SERVISMEN.map((s) => [s.fout, s]));

/**
 * Modale en wenswerkwoorden. Daarna hoort in het Kroatisch een infinitief te
 * staan; `da` + presens op die plek is de bekendste Servische zinsbouw.
 *
 * Buiten deze werkwoorden is `da` + presens gewoon Kroatisch («Mislim da je
 * dobro»), dus de controle kijkt alleen hier.
 */
const MODAAL =
  /\b(hoću|hoćeš|hoće|hoćemo|hoćete|želim|želiš|želi|želimo|želite|žele|mogu|možeš|može|možemo|možete|moram|moraš|mora|moramo|morate|moraju|trebam|trebaš|treba|volim|voliš|voli|počinjem|počinje|idem|ideš|ide|umijem|znam|zna)\s+da\s+\p{L}+/giu;

export interface Melding {
  fout: string;
  goed: string;
  soort: Servisme["soort"];
  zeker: boolean;
  fragment: string;
}

/** Alle Servische vormen in een stuk Kroatische tekst. */
export function vindServismen(tekst: string): Melding[] {
  const uit: Melding[] = [];
  // Opmaaktekens gaan er spoorloos uit. Nadruk staat vaak midden in een woord
  // om een uitgang te laten zien — «maj**ka**» — en wie daarop splitst houdt
  // «maj» over en meldt dat als de Servische naam voor mei.
  const schoon = tekst.replace(/[*_]/g, "");

  for (const ruw of schoon.split(/[^\p{L}\p{N}]+/u)) {
    const woord = ruw.toLowerCase();
    const hit = OP_WOORD.get(woord);
    if (hit) uit.push({ ...hit, fragment: ruw });
  }

  for (const m of schoon.matchAll(MODAAL)) {
    const fragment = m[0];
    uit.push({
      fout: fragment,
      goed: "modaal werkwoord + infinitief",
      soort: "zinsbouw",
      zeker: true,
      fragment,
    });
  }

  return uit;
}
