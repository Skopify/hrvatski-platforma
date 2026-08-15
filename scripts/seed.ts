/**
 * Zet de content-JSON om in leerbare items in de database.
 *
 * Idempotent: opnieuw draaien werkt content bij zonder voortgang te raken.
 * Voortgang zit in srs / review_log / attempts en wordt hier niet aangeraakt.
 */
import {
  loadLessons,
  loadStories,
  loadSyllabus,
  topicOf,
  caseOf,
  type Lesson,
} from "../src/lib/content";
import { db, sqlite } from "../src/lib/db";
import { items, lessonProgress } from "../src/lib/db/schema";
import { conjugateVerb, declineNoun } from "../src/lib/morphology";

/**
 * Vanaf welke les een naamval bestaat, volgens de syllabus.
 *
 * Een vormitem hoort bij de láátste van twee momenten: wanneer het woord wordt
 * geïntroduceerd, en wanneer de naamval wordt uitgelegd. De genitief van kuća
 * (een woord uit les 1) is dus pas een les-14-item — anders zou het lijken alsof
 * je in les 1 al genitieven had moeten kennen.
 */
const CASE_FROM: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  const order = loadSyllabus().case_introduction_order;
  const label: Record<string, string> = {
    nominativ: "Nominatief",
    akuzativ: "Accusatief",
    genitiv: "Genitief",
    dativ: "Datief",
    lokativ: "Locatief",
    instrumental: "Instrumentalis",
    vokativ: "Vocatief",
  };
  for (const [key, info] of Object.entries(order)) {
    if (key.startsWith("$") || !label[key]) continue;
    out[label[key]] = info.lesson;
  }
  return out;
})();

interface SeedItem {
  id: string;
  kind: "vocab" | "grammar" | "form";
  lesson: number;
  topic: string;
  grammaticalCase: string | null;
  cefr: string;
  label: string;
  payload: unknown;
}

function collect(lesson: Lesson): SeedItem[] {
  const out: SeedItem[] = [];

  for (const g of lesson.grammar) {
    out.push({
      id: g.id,
      kind: "grammar",
      lesson: lesson.number,
      topic: topicOf({ id: g.id, kind: "grammar" }, lesson),
      grammaticalCase: caseOf(g.id),
      cefr: g.cefr ?? lesson.cefr,
      label: g.title_nl,
      payload: g,
    });
  }

  for (const v of lesson.vocab) {
    out.push({
      id: v.id,
      kind: "vocab",
      lesson: lesson.number,
      topic: topicOf({ id: v.id, kind: "vocab" }, lesson),
      grammaticalCase: null,
      cefr: lesson.cefr,
      label: `${v.hr} — ${v.nl}`,
      payload: v,
    });

    // Vormitems: alleen voor vormen die de brondata daadwerkelijk geeft. Er wordt
    // hier niets verbogen wat we niet weten — een verzonnen naamvalsvorm is erger
    // dan een ontbrekende.
    if (v.pos !== "noun") continue;
    const forms: { suffix: string; form: string; label: string; kaz: string }[] = [
      { suffix: "nom.sg", form: v.hr, label: "nominatief enkelvoud", kaz: "Nominatief" },
    ];
    if (v.nom_pl) {
      forms.push({ suffix: "nom.pl", form: v.nom_pl, label: "nominatief meervoud", kaz: "Nominatief" });
    }
    if (v.gen_sg) {
      forms.push({ suffix: "gen.sg", form: v.gen_sg, label: "genitief enkelvoud", kaz: "Genitief" });
    }

    const stem = v.id.replace(/^v\.\d+\./, "");
    for (const f of forms) {
      const introducedIn = CASE_FROM[f.kaz];
      if (introducedIn === undefined) continue;
      out.push({
        id: `f.${stem}.${f.suffix}`,
        kind: "form",
        lesson: Math.max(lesson.number, introducedIn),
        topic: f.kaz,
        grammaticalCase: f.kaz,
        cefr: lesson.cefr,
        label: `${v.hr} → ${f.form} (${f.label})`,
        payload: { lemma: v.hr, lemmaId: v.id, form: f.form, description: f.label, gender: v.gender },
      });
    }
  }

  // Afgeleide vormen: de vijf naamvallen waar de brondata geen kolom voor heeft,
  // plus de vervoegingen. De motor leidt ze af uit gen_sg, nom_pl en present_1sg
  // en zwijgt waar hij het niet zeker weet — zie src/lib/morphology.ts.
  for (const v of lesson.vocab) {
    const stem = v.id.replace(/^v\.\d+\./, "");
    const derived = v.pos === "noun" ? declineNoun(v) : conjugateVerb(v);
    for (const f of derived) {
      const introducedIn = f.kaz ? CASE_FROM[f.kaz] : undefined;
      if (f.kaz && introducedIn === undefined) continue;
      out.push({
        id: `f.${stem}.${f.suffix}`,
        kind: "form",
        lesson: Math.max(lesson.number, introducedIn ?? 0),
        topic: f.kaz ?? "Werkwoordsvormen",
        grammaticalCase: f.kaz,
        cefr: lesson.cefr,
        label: `${v.hr} → ${f.form} (${f.label})`,
        payload: {
          lemma: v.hr,
          lemmaId: v.id,
          form: f.form,
          description: f.label,
          gender: v.gender,
          derived: true,
        },
      });
    }
  }

  return out;
}

function main() {
  const lessons = loadLessons();
  if (!lessons.length) {
    console.error("Geen lessen gevonden in content/lessons/.");
    process.exit(1);
  }

  let count = 0;
  const seen = new Set<string>();
  for (const lesson of lessons) {
    for (const item of collect(lesson)) {
      seen.add(item.id);
      db.insert(items)
        .values({
          id: item.id,
          kind: item.kind,
          lesson: item.lesson,
          topic: item.topic,
          grammaticalCase: item.grammaticalCase,
          cefr: item.cefr,
          label: item.label,
          payload: item.payload,
        })
        .onConflictDoUpdate({
          target: items.id,
          set: {
            kind: item.kind,
            lesson: item.lesson,
            topic: item.topic,
            grammaticalCase: item.grammaticalCase,
            cefr: item.cefr,
            label: item.label,
            payload: item.payload,
          },
        })
        .run();
      count++;
    }

    // Les 1 staat open; de rest gaat open zodra de vorige les af is.
    db.insert(lessonProgress)
      .values({
        lesson: lesson.number,
        status: lesson.number <= 1 ? "available" : "locked",
        sectionsDone: [],
      })
      .onConflictDoNothing()
      .run();
  }

  // Verhalen brengen eigen woorden mee. Die krijgen het lesnummer waarop het
  // verhaal staat, zodat ze in dezelfde bak vallen als de rest van dat niveau.
  const stories = loadStories();
  let storyItems = 0;
  for (const story of stories) {
    for (const v of story.vocab) {
      db.insert(items)
        .values({
          id: v.id,
          kind: "vocab",
          lesson: story.requires_lesson,
          topic: "Woordenschat",
          grammaticalCase: null,
          cefr: story.cefr,
          label: `${v.hr} — ${v.nl}`,
          payload: v,
        })
        .onConflictDoUpdate({
          target: items.id,
          set: {
            kind: "vocab",
            lesson: story.requires_lesson,
            topic: "Woordenschat",
            cefr: story.cefr,
            label: `${v.hr} — ${v.nl}`,
            payload: v,
          },
        })
        .run();
      storyItems++;
    }
  }

  // Vormen die de motor niet meer maakt, moeten weg. Upserten alleen is niet
  // genoeg: toen de vocatief van levenloze woorden verdween, bleven *ručče en
  // *Hrvatsci gewoon in de database staan en dus in de drills opduiken.
  // Alleen vormen worden opgeruimd — woorden en grammatica hebben een
  // handgeschreven id dat niet vanzelf verschijnt of verdwijnt.
  const stale = sqlite
    .prepare("SELECT id FROM items WHERE kind = 'form'")
    .all()
    .map((r) => (r as { id: string }).id)
    .filter((id) => !seen.has(id));

  if (stale.length) {
    const drop = sqlite.transaction((ids: string[]) => {
      const srsDel = sqlite.prepare("DELETE FROM srs WHERE item_id = ?");
      const encDel = sqlite.prepare("DELETE FROM encounters WHERE item_id = ?");
      const itemDel = sqlite.prepare("DELETE FROM items WHERE id = ?");
      for (const id of ids) {
        srsDel.run(id);
        encDel.run(id);
        itemDel.run(id);
      }
    });
    drop(stale);
  }

  const perLesson = lessons
    .map((l) => `  les ${String(l.number).padStart(2, "0")} — ${l.title_hr}`)
    .join("\n");

  console.log(`${count} items geseed uit ${lessons.length} les(sen):\n${perLesson}`);
  if (stale.length) {
    console.log(`\n${stale.length} verouderde vormen verwijderd, bv. ${stale.slice(0, 5).join(", ")}`);
  }
  if (stories.length) {
    console.log(
      `\n${storyItems} woorden geseed uit ${stories.length} verhaal(en):\n` +
        stories
          .map((s) => `  ${s.slug} — ${s.title_hr} (na les ${s.requires_lesson})`)
          .join("\n"),
    );
  }
}

main();
