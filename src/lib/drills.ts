/**
 * Drilldefinities — gedeeld tussen server (vragen maken, nakijken) en client
 * (weergave). Bewust zonder node-imports.
 *
 * Een drill is het tegenovergestelde van een les: geen opbouw, geen uitleg,
 * alleen tempo op één smal vaardigheidje. De vragen komen uit de bestaande
 * woordenschat (of, bij getallen, uit regels) — er wordt niets verzonnen, en
 * elk antwoord voedt de FSRS-kaart van het onderliggende woord.
 */

export type DrillKind =
  | "oblik"
  | "padezi"
  | "rod"
  | "genitiv"
  | "mnozina"
  | "glagol"
  | "brojevi"
  | "diktat";

export interface DrillMeta {
  kind: DrillKind;
  title: string;
  title_hr: string;
  description: string;
  /** choice toont knoppen, text een invoerveld. */
  input: "choice" | "text";
  choices?: string[];
  /** Wat er boven de opgave staat. */
  ask: string;
  needsVoice?: boolean;
}

export const DRILLS: Record<DrillKind, DrillMeta> = {
  oblik: {
    kind: "oblik",
    title: "Naamvalsvormen",
    title_hr: "oblici",
    description:
      "Zie een woord en de gevraagde vorm, en typ hem. Dit is de enige drill die je écht laat produceren wat de naamvalstabellen beloven — alle zeven naamvallen, enkelvoud en meervoud.",
    input: "text",
    ask: "Typ de gevraagde vorm",
  },
  padezi: {
    kind: "padezi",
    title: "Naamvalkeuze",
    title_hr: "padeži",
    description:
      "Zie een échte zin en kies welke naamval de context vraagt. Niet de uitgang oefenen, maar de keuze — dat is waar het Kroatisch op vastloopt.",
    input: "choice",
    ask: "Welke naamval vraagt deze zin?",
  },
  rod: {
    kind: "rod",
    title: "Geslacht",
    title_hr: "rod",
    description:
      "Zie een zelfstandig naamwoord, kies muški, ženski of srednji. Het geslacht bepaalt élke verbuiging erna — dit moet automatisch worden.",
    input: "choice",
    choices: ["muški", "ženski", "srednji"],
    ask: "Welk geslacht heeft dit woord?",
  },
  genitiv: {
    kind: "genitiv",
    title: "Genitief",
    title_hr: "genitiv",
    description:
      "Typ de genitief enkelvoud. De genitief onthult de stam: vluchtige a, sibilarisatie — wie de genitief kent, kent het woord.",
    input: "text",
    ask: "Typ de genitief enkelvoud",
  },
  mnozina: {
    kind: "mnozina",
    title: "Meervoud",
    title_hr: "množina",
    description:
      "Typ het meervoud. Korte woorden krijgen -ovi/-evi, k/g/h verspringen naar c/z/s — precies de plekken waar het misgaat.",
    input: "text",
    ask: "Typ de nominatief meervoud",
  },
  glagol: {
    kind: "glagol",
    title: "Werkwoorden",
    title_hr: "glagoli",
    description:
      "Zie de infinitief, typ de ja-vorm. Die ene vorm legt de hele vervoeging vast — en -ovati wordt -ujem, niet -ovam.",
    input: "text",
    ask: "Typ de vorm bij ja (1e persoon enkelvoud)",
  },
  brojevi: {
    kind: "brojevi",
    title: "Getallen",
    title_hr: "brojevi",
    description:
      "Zie een getal, schrijf het uit. Van nula tot sto, inclusief de samenstellingen — dvadeset jedan of dvadeset i jedan, allebei goed.",
    input: "text",
    ask: "Schrijf dit getal uit in het Kroatisch",
  },
  diktat: {
    kind: "diktat",
    title: "Dictee",
    title_hr: "diktat",
    description:
      "Hoor een woord, typ het mét de juiste tekens. Hét wapen tegen de ene structurele fout van een Nederlandstalige: č, ć, š, ž en đ weglaten.",
    input: "text",
    ask: "Typ wat je hoort",
    needsVoice: true,
  },
};

export const DRILL_KINDS = Object.keys(DRILLS) as DrillKind[];

/** Eén opgave zoals de client hem krijgt — zonder het antwoord. */
export interface DrillQuestion {
  /** Waarmee de server het antwoord kan terugvinden: item-id of het getal. */
  ref: string;
  /** Wat er groot in beeld staat. */
  prompt: string;
  /** Kleine toelichting eronder (vertaling bijvoorbeeld). */
  sub?: string;
  /** Alleen bij dictee: wat de TTS uitspreekt. */
  audio?: string;
  /** Het woord in de zin waar de vraag over gaat, om te markeren. */
  focus?: string;
  /** Keuzes die per vraag verschillen — bij naamvallen hangen ze van je niveau af. */
  choices?: string[];
}

export interface DrillFeedback {
  correct: boolean;
  nearMiss: boolean;
  message: string;
  expected: string;
  xp: number;
  /** Waarom dit het antwoord is — bij naamvalkeuze is dat de hele les. */
  explain?: string;
}
