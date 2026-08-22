/**
 * De schrijfopdrachten doen alsof ik de leerder ben.
 *
 * Twee doorlopen per opdracht: één antwoord met de fouten die een
 * Nederlandstalige maakt, en één waar die fouten uit zijn. De eerste hoort
 * meldingen op te leveren, de tweede geen enkele. Levert de tweede toch iets
 * op, dan is de controle te streng en leert hij de leerder dat hij niet klopt.
 */
import { beoordeel, loadOpdracht } from "../src/lib/schrijven";

/** [opdracht, antwoord-met-fouten, hetzelfde-antwoord-goed] */
const PROEVEN: [string, string, string][] = [
  [
    "w.01.voorstellen",
    "Zovem se Antonio. Zivim u Rotterdamu. Radim u banci.",
    "Zovem se Antonio. Živim u Rotterdamu. Radim u banci.",
  ],
  [
    "w.02.obitelj",
    "Moja majka je uciteljica. Moj brat zivi u Zagrebu. On je student. Moja sestra ima macku.",
    "Moja majka je učiteljica. Moj brat živi u Zagrebu. On je student. Moja sestra ima mačku.",
  ],
  [
    "w.03.subota",
    "Subotom ustajem kasno. Idem na trznicu i kupujem hleb. Poslije pijem kafu s prijateljem. Popodne citam knjigu. Navecer gledam film.",
    "Subotom ustajem kasno. Idem na tržnicu i kupujem kruh. Poslije pijem kavu s prijateljem. Popodne čitam knjigu. Navečer gledam film.",
  ],
  [
    "w.04.trznica",
    "Idem na trznicu. Kupujem kruh, sir i mlijeko. Trebam i jednu rajcicu. Za majku kupujem jabuke.",
    "Idem na tržnicu. Kupujem kruh, sir i mlijeko. Trebam i jednu rajčicu. Za majku kupujem jabuke.",
  ],
  [
    "w.05.jucer",
    "Jucer sam ustao rano. Radio sam cijeli dan. Poslije posla sam kupio kruh. Navecer smo gledali film. Bilo je dobro. Legao sam kasno.",
    "Jučer sam ustao rano. Radio sam cijeli dan. Poslije posla sam kupio kruh. Navečer smo gledali film. Bilo je dobro. Legao sam kasno.",
  ],
  [
    "w.06.soba",
    "Moja soba je mala. Na stolu stoji racunalo. Pokraj prozor je stari ormar. U ormaru su knjige. Na zidu visi slika.",
    "Moja soba je mala. Na stolu stoji računalo. Pokraj prozora je stari ormar. U ormaru su knjige. Na zidu visi slika.",
  ],
  [
    "w.07.pozivnica",
    "Bok Marko! U subotu slavim rodendan. Bit ce kod mene, u osam sati. Dodi ako mozes. Javi mi do petka.",
    "Bok Marko! U subotu slavim rođendan. Bit će kod mene, u osam sati. Dođi ako možeš. Javi mi do petka.",
  ],
  [
    "w.08.restoran",
    "Oprostite, ovo nije ono sto sam narucio. Narucio sam ribu, a ovo je meso. Mozete li to promijeniti? I molim vas, mozemo li dobiti vodu?",
    "Oprostite, ovo nije ono što sam naručio. Naručio sam ribu, a ovo je meso. Možete li to promijeniti? I molim vas, možemo li dobiti vodu?",
  ],
  [
    "w.09.eigen-hoofdstuk",
    "Moram da idem u Zagreb.",
    "Moram ići u Zagreb.",
  ],
  [
    "w.10.ander-perspectief",
    "Cekala sam je na kolodvoru. Nije me odmah prepoznala.",
    "Čekala sam je na kolodvoru. Nije me odmah prepoznala.",
  ],
];

interface Telling {
  dakjes: string[];
  naamvallen: string[];
  servismen: string[];
  gezakt: string[];
}

function meet(id: string, tekst: string): Telling {
  const o = loadOpdracht(id)!;
  const r = beoordeel(o, tekst);
  return {
    dakjes: r.taal.spelling.filter((s) => s.soort === "diakriet").map((s) => `${s.woord}→${s.bedoeld}`),
    naamvallen: r.taal.naamvallen.map((n) => n.fragment + (n.bedoeld ? ` → ${n.bedoeld}` : "")),
    servismen: r.taal.servismen.map((s) => `${s.fout}→${s.goed}`),
    gezakt: r.checks.filter((c) => !c.ok).map((c) => `${c.label} (${c.detail})`),
  };
}

let mis = 0;
for (const [id, metFout, zonderFout] of PROEVEN) {
  const o = loadOpdracht(id);
  if (!o) {
    console.log(`ONBEKENDE OPDRACHT ${id}`);
    mis++;
    continue;
  }
  const a = meet(id, metFout);
  const b = meet(id, zonderFout);

  const vondFouten = a.dakjes.length + a.naamvallen.length + a.servismen.length;
  const restFouten = b.dakjes.length + b.naamvallen.length + b.servismen.length;

  console.log(`\n${o.titel_nl}  (${id})`);
  console.log(`  met fouten:    ${vondFouten} melding(en)` +
    (a.dakjes.length ? `\n     dakjes:   ${a.dakjes.join(", ")}` : "") +
    (a.naamvallen.length ? `\n     naamval:  ${a.naamvallen.join(", ")}` : "") +
    (a.servismen.length ? `\n     servisme: ${a.servismen.join(", ")}` : ""));
  console.log(`  verbeterd:     ${restFouten} melding(en)` +
    (restFouten ? `  ← MOET NUL ZIJN: ${[...b.dakjes, ...b.naamvallen, ...b.servismen].join(", ")}` : ""));

  if (!vondFouten) {
    console.log("  ✗ de foute versie leverde niets op — de controle ziet deze fouten niet");
    mis++;
  }
  if (restFouten) {
    console.log("  ✗ de goede versie levert nog meldingen op — te streng");
    mis++;
  }
}

console.log(`\n${mis} probleem(en) in ${PROEVEN.length} proeven.`);
if (mis) process.exit(1);
