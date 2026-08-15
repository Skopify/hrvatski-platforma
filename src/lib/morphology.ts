import type { VocabEntry } from "./content";

/*
  De verbuigings- en vervoegingsmotor.

  ── Waarom dit er niet eerder was ──────────────────────────────────────────────
  Het platform hanteerde de regel "genereer geen vorm die de brondata niet geeft".
  Dat is een goed principe — een verzonnen naamvalsvorm is erger dan een
  ontbrekende — maar het had een prijs: van de zeven naamvallen hadden er vijf
  nul vormkaarten. In een taal waar de verbuiging dé moeilijkheid is, mat het
  platform vooral de woordenboekvorm.

  ── Hoe deze motor het principe tóch respecteert ───────────────────────────────
  Er wordt niet geraden vanaf de nominatief. In plaats daarvan wordt de stam
  afgeleid uit vormen die de brondata wél expliciet geeft:

      gen_sg      → de enkelvoudsstam   (kuća → kuće → stam "kuć")
      nom_pl      → de meervoudsstam    (stol → stolovi → stam "stolov")
      present_1sg → de presensstam      (pišem → stam "piše")

  Dat is geen toeval maar precies waarom die drie velden in het contentmodel
  staan: de genitief onthult de vluchtige a, de sibilarisatie en de stamwissel.
  Wie de genitief heeft, heeft de stam — en daarmee de rest van de regelmatige
  verbuiging.

  Waar de uitkomst onzeker is, wordt er niets gegenereerd. Dat geldt voor
  onregelmatige werkwoorden, voor woorden zonder genitief in de data, en voor de
  genitief meervoud van vrouwelijke woorden (žena → žena, maar sestra → sestara
  en majka → majki — dat is niet betrouwbaar af te leiden).
*/

export interface GeneratedForm {
  /** Achtervoegsel voor het item-id, bv. "acc.sg". */
  suffix: string;
  form: string;
  /** Leesbare beschrijving voor het dashboard. */
  label: string;
  /** De naamval zoals topicOf hem noemt, of null bij werkwoordsvormen. */
  kaz: string | null;
}

/* ------------------------------------------------------------- klankregels --- */

/**
 * Stammen die op een palataal eindigen krijgen -em in plaats van -om.
 * De c hoort hier wél bij (otac → ocem), maar níet bij de vocatief hieronder.
 */
const PALATALS = ["č", "ć", "đ", "dž", "j", "lj", "nj", "š", "ž", "c"];

/** Voor de vocatief telt de c niet mee: die palataliseert naar č (otac → oče). */
const VOC_PALATALS = PALATALS.filter((p) => p !== "c");

function isPalatal(stem: string): boolean {
  return PALATALS.some((p) => stem.endsWith(p));
}

function takesVocativeU(stem: string): boolean {
  return VOC_PALATALS.some((p) => stem.endsWith(p));
}

/** Sibilarisatie: k, g, h worden c, z, s vóór -i (vojnik → vojnici, ruka → ruci). */
function sibilarize(stem: string): string {
  const last = stem.slice(-1);
  const map: Record<string, string> = { k: "c", g: "z", h: "s" };
  return map[last] ? stem.slice(0, -1) + map[last] : stem;
}

/**
 * Medeklinkergroepen waarin de sibilarisatie uitblijft: -cka, -čka, -ćka, -tka,
 * -ska, -ška, -zga. Zonder deze uitzondering wordt mačka → *mačci in plaats van
 * mački, en igračka → *igračci in plaats van igrački.
 */
const NO_SIBILARIZE = /(c|č|ć|t|s|š|z|ž)(k|g)$/;

/**
 * Vrouwelijke persoonsnamen op medeklinker + -ka sibilariseren evenmin:
 * Talijanka → Talijanki, Nizozemka → Nizozemki, novinarka → novinarki. Dat is
 * geen willekeur — *Talijanci en *Nizozemci zijn de mánnelijke meervoudsvormen,
 * dus de sibilarisatie zou het woord onherkenbaar maken.
 *
 * De j valt erbuiten, want daar sibilariseert het wél: majka → majci,
 * djevojka → djevojci. En niet-persoonlijke woorden ook: marka → marci.
 */
function isFemaleAgent(v: VocabEntry): boolean {
  return v.gender === "f" && v.animacy === "animate" && /[^aeiouj]ka$/.test(v.hr);
}

/**
 * Woorden die de regel wél zouden volgen maar het in de praktijk niet doen.
 * baka is een koosnaam (baki, net als seka → seki); papiga staat in de
 * woordenboeken met papigi.
 */
const NO_SIBILARIZE_LEMMA = new Set(["baka", "papiga"]);

/** Palatalisatie vóór -e: k→č, g→ž, h→š, c→č (vojnik → vojniče, otac → oče). */
function palatalize(stem: string): string {
  const last = stem.slice(-1);
  const map: Record<string, string> = { k: "č", g: "ž", h: "š", c: "č" };
  if (!map[last]) return stem;
  const out = stem.slice(0, -1) + map[last];
  // Een s of z vóór de nieuwe palataal schuift mee: pisac → pišče, niet *pisče.
  return out.replace(/s(č|ž|š)$/, "š$1").replace(/z(č|ž|š)$/, "ž$1");
}

/**
 * Volgt het meervoud de regelmatige patronen?
 *
 * Nodig omdat een woord de genitiefcontrole kan doorstaan en tóch een
 * onvoorspelbaar meervoud hebben: brat → braća, dijete → djeca, čovjek → ljudi.
 * Zulke meervouden zijn eigen woorden met een eigen verbuiging, dus daar wordt
 * niets van afgeleid.
 */
function regularPlural(v: VocabEntry, stem: string): string | null {
  if (!v.nom_pl) return null;
  const pl = v.nom_pl;
  const ok =
    v.gender === "m"
      ? pl === sibilarize(stem) + "i" ||
        pl === stem + (isPalatal(stem) ? "evi" : "ovi") ||
        pl === stem + "ovi"
      : v.gender === "f"
        ? pl === stem + (v.hr.endsWith("a") ? "e" : "i")
        : v.gender === "n"
          ? pl === stem + "a"
          : false;
  return ok ? pl : null;
}

/** De stam uit een gegeven vorm halen door de uitgangsklinker weg te nemen. */
function stemFrom(form: string, ending: string): string | null {
  if (!form.endsWith(ending)) return null;
  const stem = form.slice(0, form.length - ending.length);
  return stem.length >= 2 ? stem : null;
}

const VOWELS = "aeiouAEIOU";

/** Telt lj, nj en dž als één medeklinker, anders is elke digraaf een cluster. */
function endsInCluster(stem: string): boolean {
  const s = stem.replace(/lj|nj|dž/g, "C");
  const [a, b] = [s.slice(-2, -1), s.slice(-1)];
  return a !== "" && !VOWELS.includes(a) && !VOWELS.includes(b);
}

/**
 * De genitief meervoud van een mannelijk woord.
 *
 * Twee dingen gaan hier mis als je botweg -a achter de stam plakt:
 *
 *  1. Woorden met een vluchtige a krijgen die a terug: sastanak → sastanaka,
 *     niet *sastanka (dat is de genitief énkelvoud). Omdat de vluchtige a in de
 *     nominatief zichtbaar is, is de nominatief + a hier het juiste antwoord —
 *     pas → pasa, dvorac → dvoraca, obrazac → obrazaca.
 *  2. Woorden zonder vluchtige a maar mét een eindcluster schuiven er een a
 *     tussen: student → studenata, koncert → koncerata, bicikl → bicikala.
 *     Behalve na st, št, zd en žd, waar het cluster blijft staan:
 *     turist → turista.
 */
function genitivePlural(v: VocabEntry, stem: string): string | null {
  if (IRREGULAR_GEN_PL.has(v.hr)) return null;

  // Vluchtige a: de genitief enkelvoud is korter dan nominatief + a.
  const consonantFinal = !VOWELS.includes(v.hr.slice(-1));
  if (consonantFinal && v.gen_sg !== v.hr + "a") return v.hr + "a";

  if (!endsInCluster(stem) || /(st|št|zd|žd)$/.test(stem)) return stem + "a";
  return stem.slice(0, -1) + "a" + stem.slice(-1) + "a";
}

/**
 * Woorden waarvan de genitief meervoud op -iju gaat en dus niet uit de stam
 * volgt. Ze staan hier bij naam omdat het er weinig zijn en de regel voor de
 * rest wél klopt.
 */
const IRREGULAR_GEN_PL = new Set([
  "gost",
  "prst",
  "sat",
  "mjesec",
  "ruka",
  "noga",
  "oko",
  "uho",
]);

/* ------------------------------------------------- zelfstandige naamwoorden --- */

/**
 * Verbuiging van een zelfstandig naamwoord.
 *
 * Levert alleen de vormen die met zekerheid uit de opgegeven stammen volgen.
 * Ontbreekt gen_sg, dan gebeurt er niets: zonder stam geen verbuiging.
 */
export function declineNoun(v: VocabEntry): GeneratedForm[] {
  if (v.pos !== "noun" || !v.gen_sg) return [];

  // Woorden die alleen in het meervoud bestaan — cipele, hlače, leđa. De
  // brondata zet hun genitief meervoud in gen_sg, dus zou elke "enkelvouds"-
  // vorm hier verzonnen zijn (*leđu, *leđem).
  if (v.nom_pl && v.nom_pl === v.hr) return [];

  if (v.declension === "adjectival") return declineAdjectival(v);

  const out: GeneratedForm[] = [];
  const add = (suffix: string, form: string, label: string, kaz: string) =>
    out.push({ suffix, form, label, kaz });

  const gender = v.gender;
  const animate = v.animacy === "animate";

  /* ── vrouwelijk op -a (e-verbuiging): žena, kuća, majka ─────────────────── */
  if (gender === "f" && v.hr.endsWith("a")) {
    const stem = stemFrom(v.gen_sg, "e");
    if (!stem) return [];

    add("acc.sg", stem + "u", "accusatief enkelvoud", "Accusatief");
    // Datief en locatief zijn gelijk, en hier slaat de sibilarisatie toe:
    // majka → majci, knjiga → knjizi. Behalve waar ze uitblijft — zie
    // NO_SIBILARIZE, isFemaleAgent en NO_SIBILARIZE_LEMMA hierboven.
    const keepK =
      NO_SIBILARIZE.test(stem) || isFemaleAgent(v) || NO_SIBILARIZE_LEMMA.has(v.hr);
    const datLoc = (keepK ? stem : sibilarize(stem)) + "i";
    add("dat.sg", datLoc, "datief enkelvoud", "Datief");
    add("loc.sg", datLoc, "locatief enkelvoud", "Locatief");
    add("ins.sg", stem + "om", "instrumentalis enkelvoud", "Instrumentalis");
    // De vocatief is er om iemand aan te spreken. Bij een levenloos woord is de
    // vorm hooguit theorie, dus wordt hij alleen voor levende wezens gemaakt.
    // Woorden op -ica krijgen daar -e (prijateljice), de rest -o (majko).
    if (animate) {
      add("voc.sg", stem.endsWith("ic") ? stem + "e" : stem + "o", "vocatief enkelvoud", "Vocatief");
    }

    const nomPl = regularPlural(v, stem);
    if (nomPl) {
      add("acc.pl", nomPl, "accusatief meervoud", "Accusatief");
      const plural = stem + "ama";
      add("dat.pl", plural, "datief meervoud", "Datief");
      add("loc.pl", plural, "locatief meervoud", "Locatief");
      add("ins.pl", plural, "instrumentalis meervoud", "Instrumentalis");
      // Genitief meervoud bewust overgeslagen: žena → žena, maar sestra →
      // sestara en majka → majki. Dat is niet regelmatig genoeg om te durven.
    }
    return out;
  }

  /* ── vrouwelijk op medeklinker (i-verbuiging): riječ, stvar, noć ────────── */
  if (gender === "f") {
    const stem = stemFrom(v.gen_sg, "i");
    if (!stem) return [];

    add("acc.sg", v.hr, "accusatief enkelvoud", "Accusatief");
    add("dat.sg", stem + "i", "datief enkelvoud", "Datief");
    add("loc.sg", stem + "i", "locatief enkelvoud", "Locatief");
    add("ins.sg", stem + "i", "instrumentalis enkelvoud", "Instrumentalis");
    if (animate) add("voc.sg", stem + "i", "vocatief enkelvoud", "Vocatief");

    const nomPl = regularPlural(v, stem);
    if (nomPl) {
      add("acc.pl", nomPl, "accusatief meervoud", "Accusatief");
      add("gen.pl", stem + "i", "genitief meervoud", "Genitief");
      const plural = stem + "ima";
      add("dat.pl", plural, "datief meervoud", "Datief");
      add("loc.pl", plural, "locatief meervoud", "Locatief");
      add("ins.pl", plural, "instrumentalis meervoud", "Instrumentalis");
    }
    return out;
  }

  /* ── onzijdig (a-verbuiging): selo, more, pitanje ───────────────────────── */
  if (gender === "n") {
    const stem = stemFrom(v.gen_sg, "a");
    if (!stem) return [];

    // Onzijdig: nominatief, accusatief en vocatief vallen samen.
    add("acc.sg", v.hr, "accusatief enkelvoud", "Accusatief");
    add("dat.sg", stem + "u", "datief enkelvoud", "Datief");
    add("loc.sg", stem + "u", "locatief enkelvoud", "Locatief");
    // Bij een onzijdig woord bepaalt de nominatiefuitgang de instrumentalis:
    // -o krijgt -om (selo → selom), -e krijgt -em (more → morem,
    // kazalište → kazalištem). De laatste medeklinker van de stam zegt het
    // niet — kazališt eindigt op t en krijgt tóch -em.
    //
    // Behalve bij een uitgebreide stam (jaje → jajet-, ime → imen-): die volgt
    // wél zijn eigen eindmedeklinker, want de -e is daar geen uitgang meer.
    const extended = stem !== v.hr.slice(0, -1);
    const takesEm = extended ? isPalatal(stem) : v.hr.endsWith("e");
    add("ins.sg", stem + (takesEm ? "em" : "om"), "instrumentalis enkelvoud", "Instrumentalis");

    const nomPl = regularPlural(v, stem);
    if (nomPl) {
      add("acc.pl", nomPl, "accusatief meervoud", "Accusatief");
      const plural = sibilarize(stem) + "ima";
      add("dat.pl", plural, "datief meervoud", "Datief");
      add("loc.pl", plural, "locatief meervoud", "Locatief");
      add("ins.pl", plural, "instrumentalis meervoud", "Instrumentalis");
    }
    return out;
  }

  /* ── mannelijk (a-verbuiging): stol, prijatelj, vojnik ──────────────────── */
  if (gender === "m") {
    const stem = stemFrom(v.gen_sg, "a");
    if (!stem) return [];

    // Levendheid bepaalt de accusatief: levend valt samen met de genitief,
    // levenloos met de nominatief. Dit is dé val voor een Nederlandstalige.
    add("acc.sg", animate ? v.gen_sg : v.hr, "accusatief enkelvoud", "Accusatief");
    add("dat.sg", stem + "u", "datief enkelvoud", "Datief");
    add("loc.sg", stem + "u", "locatief enkelvoud", "Locatief");
    add("ins.sg", isPalatal(stem) ? stem + "em" : stem + "om", "instrumentalis enkelvoud", "Instrumentalis");
    // Vocatief: na een palataal -u, na k/g/h palataliseren naar č/ž/š + e.
    // Alleen voor levende wezens — bij ručak of oblak levert de regel een vorm
    // op die niemand ooit gebruikt en die door de vluchtige a ook nog eens
    // onuitspreekbaar wordt (*ručče, *polasče).
    if (animate) {
      add(
        "voc.sg",
        takesVocativeU(stem) ? stem + "u" : palatalize(stem) + "e",
        "vocatief enkelvoud",
        "Vocatief",
      );
    }

    const nomPl = regularPlural(v, stem);
    if (nomPl) {
      // Lang meervoud (stol → stolovi) heeft een eigen stam; kort meervoud
      // (prijatelj → prijatelji) gebruikt de enkelvoudsstam, want de
      // sibilarisatie in jezici geldt niet voor de genitief meervoud (jezika).
      const longPlural = /(ovi|evi)$/.test(nomPl);
      const plStem = longPlural ? nomPl.slice(0, -1) : stem;

      add("acc.pl", plStem + "e", "accusatief meervoud", "Accusatief");
      const genPl = longPlural ? plStem + "a" : genitivePlural(v, stem);
      if (genPl) add("gen.pl", genPl, "genitief meervoud", "Genitief");
      const plural = (longPlural ? plStem : sibilarize(plStem)) + "ima";
      add("dat.pl", plural, "datief meervoud", "Datief");
      add("loc.pl", plural, "locatief meervoud", "Locatief");
      add("ins.pl", plural, "instrumentalis meervoud", "Instrumentalis");
      if (animate) add("voc.pl", nomPl, "vocatief meervoud", "Vocatief");
    }
    return out;
  }

  return out;
}

/* ------------------------------------------------------ adjectivische namen --- */

/**
 * Landnamen als Hrvatska en maandnamen als studeni zijn geen zelfstandige
 * naamwoorden maar verzelfstandigde bijvoeglijke naamwoorden. Ze verbuigen dus
 * als een adjectief, niet als kuća: u Hrvatskoj, niet *u Hrvatsci.
 *
 * Dat verschil is niet cosmetisch — "in Kroatië" is een van de eerste zinnen
 * die een leerder nodig heeft, en de gewone e-verbuiging maakt er onzin van.
 */
function declineAdjectival(v: VocabEntry): GeneratedForm[] {
  const add = (suffix: string, form: string, label: string, kaz: string): GeneratedForm => ({
    suffix,
    form,
    label,
    kaz,
  });

  if (v.gender === "f" && v.hr.endsWith("a")) {
    const stem = v.hr.slice(0, -1); // Hrvatsk
    return [
      add("acc.sg", stem + "u", "accusatief enkelvoud", "Accusatief"),
      add("dat.sg", stem + "oj", "datief enkelvoud", "Datief"),
      add("loc.sg", stem + "oj", "locatief enkelvoud", "Locatief"),
      add("ins.sg", stem + "om", "instrumentalis enkelvoud", "Instrumentalis"),
    ];
  }

  if (v.gender === "m" && v.hr.endsWith("i")) {
    const stem = v.hr.slice(0, -1); // studen
    return [
      add("dat.sg", stem + "ome", "datief enkelvoud", "Datief"),
      add("loc.sg", stem + "ome", "locatief enkelvoud", "Locatief"),
      add("ins.sg", stem + "im", "instrumentalis enkelvoud", "Instrumentalis"),
    ];
  }

  return [];
}

/* -------------------------------------------------------------- werkwoorden --- */

const PERSONS = ["ja", "ti", "on/ona", "mi", "vi", "oni/one"];

/**
 * Presens en het deelwoord van een werkwoord.
 *
 * De presensstam komt uit present_1sg (pišem → piše), en de klinker daarvan
 * bepaalt het type: -a, -i of -e. Onregelmatige werkwoorden worden overgeslagen;
 * die staan expliciet in de lessen omdat er niets aan af te leiden valt.
 */
export function conjugateVerb(v: VocabEntry): GeneratedForm[] {
  if (v.pos !== "verb" || !v.present_1sg) return [];
  if (v.verb_class === "onregelmatig") return [];

  // Wederkerende werkwoorden dragen "se" mee; die hangt er los achter.
  const reflexive = / se$/.test(v.present_1sg);
  const base = v.present_1sg.replace(/ se$/, "");
  if (!base.endsWith("m")) return [];

  const stem = base.slice(0, -1);
  const vowel = stem.slice(-1);
  if (!["a", "i", "e"].includes(vowel)) return [];

  const root = stem.slice(0, -1);
  const forms =
    vowel === "a"
      ? [stem + "m", stem + "š", stem, stem + "mo", stem + "te", stem + "ju"]
      : vowel === "i"
        ? [stem + "m", stem + "š", stem, stem + "mo", stem + "te", root + "e"]
        : [stem + "m", stem + "š", stem, stem + "mo", stem + "te", root + "u"];

  const tail = reflexive ? " se" : "";
  const out: GeneratedForm[] = forms.slice(1).map((form, i) => ({
    // De 1e persoon staat al als present_1sg in de data; die niet dubbel doen.
    suffix: `pres.${i + 2}`,
    form: form + tail,
    label: `presens ${PERSONS[i + 1]}`,
    kaz: null,
  }));

  // Deelwoord voor de perfekt. Alleen bij infinitieven op -ti met een
  // doorzichtige stam; -ći en -sti zijn onregelmatig (reći → rekao).
  const inf = v.hr.replace(/ se$/, "");
  if (/[aiu]ti$/.test(inf) && !/(ći|sti)$/.test(inf)) {
    const pStem = inf.slice(0, -2);
    out.push({ suffix: "part.m", form: pStem + "o" + tail, label: "deelwoord mannelijk", kaz: null });
    out.push({ suffix: "part.f", form: pStem + "la" + tail, label: "deelwoord vrouwelijk", kaz: null });
    out.push({ suffix: "part.pl", form: pStem + "li" + tail, label: "deelwoord meervoud", kaz: null });
  }

  return out;
}

/* ------------------------------------------------------------- zelfcontrole --- */

/**
 * Toetst de motor tegen de brondata: kan hij vanuit de nominatief de opgeslagen
 * gen_sg en nom_pl terugvinden? Waar dat lukt, volgt het woord de regelmatige
 * patronen en zijn de overige vormen te vertrouwen. Waar het misgaat, staat het
 * woord in de uitkomst zodat het handmatig nagelopen kan worden.
 */
export function validateNoun(v: VocabEntry): { ok: boolean; expected?: string; got?: string } {
  if (v.pos !== "noun" || !v.gen_sg) return { ok: true };

  // Voorspel gen_sg uit de nominatief en vergelijk met wat er staat.
  let predicted: string | null = null;
  if (v.gender === "f" && v.hr.endsWith("a")) predicted = v.hr.slice(0, -1) + "e";
  else if (v.gender === "n" && /[oe]$/.test(v.hr)) predicted = v.hr.slice(0, -1) + "a";
  else if (v.gender === "m" && !/[aoe]$/.test(v.hr)) predicted = v.hr + "a";

  if (!predicted) return { ok: true };
  return predicted === v.gen_sg
    ? { ok: true }
    : { ok: false, expected: predicted, got: v.gen_sg };
}
