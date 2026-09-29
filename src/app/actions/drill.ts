"use server";
import { antwoordtijd, binnen, tekst as begrensTekst } from "@/lib/valideer";
import { eq, sql } from "drizzle-orm";
import { type Exercise, type VocabEntry, loadCaseUsage } from "@/lib/content";
import { highestActiveLesson } from "@/lib/stats";
import { db } from "@/lib/db";
import { type DrillFeedback, type DrillKind, type DrillQuestion } from "@/lib/drills";
import { brojAccepts, brojHr } from "@/lib/numbers";
import { items, lessonProgress } from "@/lib/db/schema";
import { gradeChoice, gradeText, xpFor } from "@/lib/grading";
import { applyReview, ensureCards, ratingFor } from "@/lib/srs";
import { addXp, bumpStreak, record, shuffled } from "@/lib/leerlogboek";

/**
 * Kandidaatwoorden voor een drill: alleen woorden van jouw niveau (lessen die
 * open zijn of af), zodat een drill nooit toekomstige stof verklapt.
 */
function drillPool(kind: DrillKind): { id: string; lesson: number; v: VocabEntry }[] {
  const maxLesson = db
    .select({ lesson: lessonProgress.lesson })
    .from(lessonProgress)
    .where(sql`${lessonProgress.status} in ('done', 'in_progress', 'available')`)
    .all()
    .reduce((n, r) => Math.max(n, r.lesson), 1);

  const rows = db
    .select({ id: items.id, lesson: items.lesson, payload: items.payload })
    .from(items)
    .where(sql`${items.kind} = 'vocab' and ${items.lesson} <= ${maxLesson}`)
    .all();

  return rows
    .map((r) => ({ id: r.id, lesson: r.lesson, v: r.payload as VocabEntry }))
    .filter(({ v }) => {
      switch (kind) {
        case "rod":
          return v.pos === "noun" && !!v.gender;
        case "genitiv":
          return v.pos === "noun" && !!v.gen_sg && v.gen_sg !== v.hr;
        case "mnozina":
          return v.pos === "noun" && !!v.nom_pl && v.nom_pl !== v.hr;
        case "glagol":
          return v.pos === "verb" && !!v.present_1sg && v.present_1sg !== v.hr;
        case "diktat":
          return /[čćđšž]/i.test(v.hr) && !v.hr.includes(" ");
        default:
          return false;
      }
    });
}

const GENDER_LABEL: Record<string, string> = { m: "muški", f: "ženski", n: "srednji" };

/** Een portie vragen, geschud, zonder antwoorden. */
export async function drillBatch(kind: DrillKind, count = 12): Promise<DrillQuestion[]> {
  count = Math.round(binnen(count, 1, 50, 12));
  if (kind === "oblik") {
    // Gelijk verdeeld over de naamvallen. Zomaar trekken uit de hele bak zou de
    // drill laten scheefgroeien naar wat er het meest van is; per naamval een
    // even groot deel trekken houdt alle zeven in beeld.
    //
    // Het trekken gebeurt in SQL. Er zijn duizenden vormkaarten, en die alleen
    // maar inladen om er twaalf van te houden kost meer dan de hele drill waard
    // is. De filters horen dus in de query:
    //   json_extract(...form) != ...lemma  — sluit "žaba → nominatief enkelvoud"
    //   uit, waar het antwoord al in de vraag staat.
    const maxLesson = highestActiveLesson();
    const topics = db
      .select({ topic: items.topic })
      .from(items)
      .where(sql`${items.kind} = 'form' and ${items.lesson} <= ${maxLesson}`)
      .groupBy(items.topic)
      .all()
      .map((r) => r.topic);
    if (topics.length === 0) return [];

    const perTopic = Math.max(1, Math.ceil(count / topics.length));
    const picked: DrillQuestion[] = [];
    for (const topic of shuffled(topics)) {
      const rows = db
        .select({ id: items.id, payload: items.payload })
        .from(items)
        .where(
          sql`${items.kind} = 'form' and ${items.lesson} <= ${maxLesson}
              and ${items.topic} = ${topic}
              and json_extract(${items.payload}, '$.form')
                  != json_extract(${items.payload}, '$.lemma')`,
        )
        .orderBy(sql`random()`)
        .limit(perTopic)
        .all();
      for (const r of rows) {
        const p = r.payload as { lemma: string; description: string };
        picked.push({ ref: r.id, prompt: p.lemma, sub: p.description });
      }
    }
    return shuffled(picked).slice(0, count);
  }

  if (kind === "padezi") {
    const usage = loadCaseUsage();
    const maxLesson = highestActiveLesson();
    // Alleen zinnen waarvan de naamval al is geïntroduceerd; de keuzelijst groeit
    // dus mee met je niveau in plaats van meteen zeven opties te tonen.
    const available = usage.items.filter((i) => i.lesson <= Math.max(maxLesson, 5));
    const cases = usage.cases.filter((c) => c.lesson <= Math.max(maxLesson, 5));
    if (available.length === 0 || cases.length < 2) return [];

    const labels = cases.map((c) => c.label);
    return shuffled(available)
      .slice(0, count)
      .map((i) => ({
        ref: i.id,
        prompt: i.sentence_hr,
        sub: i.sentence_nl,
        focus: i.focus,
        audio: i.sentence_hr,
        choices: labels,
      }));
  }

  if (kind === "brojevi") {
    // Elke portie mengt makkelijk (0-20) en samengesteld (21-100).
    const seen = new Set<number>();
    const out: DrillQuestion[] = [];
    while (out.length < count && seen.size < 100) {
      const n =
        out.length % 3 === 2
          ? 21 + Math.floor(Math.random() * 80)
          : Math.floor(Math.random() * 21);
      if (seen.has(n)) continue;
      seen.add(n);
      out.push({ ref: String(n), prompt: String(n) });
    }
    return out;
  }

  const pool = shuffled(drillPool(kind)).slice(0, count);
  return pool.map(({ id, v }) => {
    switch (kind) {
      case "rod":
      case "genitiv":
      case "mnozina":
      case "glagol":
        return { ref: id, prompt: v.hr, sub: v.nl };
      default:
        // diktat: het woord gaat alleen als audio mee, de vertaling volgt pas
        // in de feedback zodat het oor het werk doet.
        return { ref: id, prompt: "", audio: v.hr };
    }
  });
}

/** Nakijken + attempt + SRS. `ref` is het item-id (of het getal bij brojevi). */
export async function submitDrill(
  kind: DrillKind,
  ref: string,
  answer: string,
  durationMs: number,
): Promise<DrillFeedback> {
  durationMs = antwoordtijd(durationMs);
  answer = begrensTekst(answer, 500);
  let expected: string;
  let accepts: string[];
  let nl = "";
  let targets: string[] = [];
  let lesson = 0;
  let mode: "receptive" | "productive" = "productive";
  let explain: string | undefined;

  if (kind === "oblik") {
    const row = db.select().from(items).where(eq(items.id, ref)).get();
    if (!row) throw new Error(`Onbekende vorm: ${ref}`);
    const p = row.payload as { lemma: string; form: string; description: string };
    expected = p.form;
    accepts = [expected];
    lesson = row.lesson;
    targets = [ref];
    explain = `${p.description} van ${p.lemma}.`;
  } else if (kind === "padezi") {
    const usage = loadCaseUsage();
    const item = usage.items.find((i) => i.id === ref);
    if (!item) throw new Error(`Onbekende zin: ${ref}`);
    expected = usage.cases.find((c) => c.key === item.case)?.label ?? item.case;
    accepts = [expected];
    lesson = item.lesson;
    mode = "receptive";
    // De uitleg ís hier het leerpunt, dus die reist mee terug naar de client.
    explain = item.contrast_nl ? `${item.why_nl} ${item.contrast_nl}` : item.why_nl;
  } else if (kind === "brojevi") {
    const n = Number(ref);
    if (!Number.isInteger(n) || n < 0 || n > 100) throw new Error(`Ongeldig getal: ${ref}`);
    expected = brojHr(n);
    accepts = brojAccepts(n);
    lesson = n <= 10 ? 0 : 17;
  } else {
    const row = db.select().from(items).where(eq(items.id, ref)).get();
    if (!row) throw new Error(`Onbekend item: ${ref}`);
    const v = row.payload as VocabEntry;
    lesson = row.lesson;
    nl = v.nl;
    targets = [ref];

    switch (kind) {
      case "rod":
        expected = GENDER_LABEL[v.gender ?? ""] ?? "";
        accepts = [expected];
        mode = "receptive";
        break;
      case "genitiv": {
        expected = v.gen_sg!;
        accepts = [expected];
        // De geseedde vormkaart bestaat voor leswoorden — die is het echte doel.
        const formId = `f.${ref.replace(/^v\.[^.]+\./, "")}.gen.sg`;
        if (db.select({ id: items.id }).from(items).where(eq(items.id, formId)).get()) {
          targets = [formId, ref];
        }
        break;
      }
      case "mnozina": {
        expected = v.nom_pl!;
        accepts = [expected];
        const formId = `f.${ref.replace(/^v\.[^.]+\./, "")}.nom.pl`;
        if (db.select({ id: items.id }).from(items).where(eq(items.id, formId)).get()) {
          targets = [formId, ref];
        }
        break;
      }
      case "glagol":
        // Bij wederkerende werkwoorden staat se in de brondata mee ("vratim se").
        // Zonder se ook goed rekenen: de vervoeging is wat hier geoefend wordt.
        expected = v.present_1sg!;
        accepts = [expected, expected.replace(/\s+se$/, "")];
        break;
      default:
        expected = v.hr;
        accepts = [expected];
    }
  }

  // Dezelfde beoordelingsladder als de lessen: exact / diakritisch / tikfout.
  const fake = {
    id: `drill.${kind}.${ref}`,
    type: "cloze",
    prompt_nl: "",
    answer: expected,
    accepts,
    mode,
    difficulty: 1,
  } as Exercise;

  const result =
    kind === "rod" || kind === "padezi" ? gradeChoice(fake, answer) : gradeText(fake, answer);
  // Drills zijn korter en kaler dan lesoefeningen; zelfde ladder, lagere koers —
  // anders wordt drillen de goedkoopste weg naar XP en zegt het totaal niets meer.
  const xp = Math.max(1, Math.round(xpFor(fake, result) * 0.6));

  record(fake.id, lesson, `drill_${kind}`, mode, result, answer, durationMs, xp, targets);
  if (targets.length) {
    const kaarten = ensureCards(targets);
    const rating = ratingFor(result, fake, durationMs);
    for (const kaartId of kaarten) applyReview(kaartId, rating, durationMs);
  }
  bumpStreak();
  addXp(xp);

  return {
    correct: result.correct,
    nearMiss: result.nearMiss,
    message: result.message,
    expected: nl && kind === "diktat" ? `${expected} — ${nl}` : expected,
    xp,
    explain,
  };
}
