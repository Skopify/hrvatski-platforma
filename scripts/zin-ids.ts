/**
 * Geeft elke verhaalzin een vast id. Draai met: npm run zin-ids
 *
 * Een gemijnd woord moet de zin kunnen vasthouden waarin je het tegenkwam. Dat
 * kan alleen met een verwijzing die blijft kloppen, en een volgnummer doet dat
 * niet: zodra er ergens een zin bij komt, wijst elke bewaarde kaart naar de
 * verkeerde. Dus staat het id in de brondata.
 *
 * Idempotent: zinnen die al een id hebben, houden het — ook als hun positie
 * intussen is verschoven. Nieuwe zinnen krijgen het eerstvolgende vrije nummer
 * binnen hun alinea, niet hun positienummer.
 *
 * Net als scripts/apply-patch.ts wordt hier met tekst gewerkt en niet met
 * JSON.stringify: de verhaalbestanden zijn met de hand opgemaakt en een
 * serializer gooit die opmaak overboord.
 */
import fs from "node:fs";
import path from "node:path";

const DIR = path.join(process.cwd(), "content", "stories");

let toegevoegd = 0;
let bestond = 0;

for (const bestand of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const volledig = path.join(DIR, bestand);
  const tekst = fs.readFileSync(volledig, "utf-8");
  const verhaal = JSON.parse(tekst) as {
    slug: string;
    paragraphs: { id: string; sentences: { id?: string; hr: string; nl: string }[] }[];
  };

  // Per alinea het hoogste bestaande nummer, zodat nieuwe zinnen erachter komen.
  const hoogste = new Map<string, number>();
  for (const alinea of verhaal.paragraphs) {
    let max = 0;
    for (const zin of alinea.sentences) {
      const m = zin.id?.match(/\.s(\d+)$/);
      if (m) max = Math.max(max, Number(m[1]));
    }
    hoogste.set(alinea.id, max);
  }

  let uit = tekst;
  for (const alinea of verhaal.paragraphs) {
    for (const zin of alinea.sentences) {
      if (zin.id) {
        bestond++;
        continue;
      }

      const volgend = (hoogste.get(alinea.id) ?? 0) + 1;
      hoogste.set(alinea.id, volgend);
      const id = `${verhaal.slug}.${alinea.id}.s${volgend}`;

      // De zin terugvinden en het id als eerste sleutel invoegen.
      //
      // Dit moet exact. Twee eerdere pogingen faalden op bijna-goed zoeken: de
      // ene keek te ver terug en zag het "id" van de alínea aan voor dat van de
      // zin, de andere kon een "hr" uit de glossary raken — en die staat compact
      // op één regel, dus daar een id-regel vóór zetten levert kapotte JSON op.
      //
      // Daarom de harde eis: de gevonden "hr" staat alleen op zijn regel, en de
      // regel erboven is precies de openende accolade van het zinsobject. Alles
      // wat daar niet aan voldoet is geen zin en wordt overgeslagen.
      // De verhalen kennen twee opmaakvormen, allebei met de hand gezet:
      //
      //   uitgeklapt          compact
      //   {                   { "hr": "…", "nl": "…" },
      //     "hr": "…",
      //     "nl": "…"
      //   },
      //
      // Bij de eerste komt het id op een eigen regel, bij de tweede achter de
      // accolade. Beide worden hier afgehandeld; opmaak blijft opmaak.
      const naald = `"hr": ${JSON.stringify(zin.hr)}`;
      let vanaf = 0;
      let invoegPunt = -1;
      let invoegsel = "";

      for (;;) {
        const kandidaat = uit.indexOf(naald, vanaf);
        if (kandidaat < 0) break;
        vanaf = kandidaat + naald.length;

        const rs = uit.lastIndexOf("\n", kandidaat) + 1;
        const re = uit.indexOf("\n", kandidaat);
        const regel = uit.slice(rs, re < 0 ? uit.length : re).trim();

        // Uitgeklapt: alleen deze sleutel op de regel, accolade erboven.
        if (regel === `${naald},`) {
          const vorigeStart = uit.lastIndexOf("\n", rs - 2) + 1;
          if (uit.slice(vorigeStart, rs).trim() !== "{") continue;
          invoegPunt = rs;
          invoegsel = `${uit.slice(rs, kandidaat)}"id": ${JSON.stringify(id)},\n`;
          break;
        }

        // Compact: de hele zin op één regel, beginnend met een accolade.
        if (regel.startsWith("{") && regel.includes(naald) && /}\,?$/.test(regel)) {
          const naAccolade = uit.indexOf("{", rs) + 1;
          if (naAccolade > kandidaat) continue;
          invoegPunt = naAccolade;
          invoegsel = ` "id": ${JSON.stringify(id)},`;
          break;
        }
      }

      if (invoegPunt < 0) {
        console.warn(`  ${bestand}: zin niet gevonden — ${zin.hr.slice(0, 40)}…`);
        continue;
      }

      uit = uit.slice(0, invoegPunt) + invoegsel + uit.slice(invoegPunt);
      toegevoegd++;
    }
  }

  if (uit !== tekst) {
    JSON.parse(uit); // kapot bestand vangen vóór het wordt weggeschreven
    fs.writeFileSync(volledig, uit);
  }
}

console.log(`${toegevoegd} zin-id's toegevoegd, ${bestond} stonden er al.`);
