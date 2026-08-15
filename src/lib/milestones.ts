import { sql } from "drizzle-orm";

import { loadStories } from "./content";
import { db } from "./db";
import { attempts } from "./db/schema";
import { getProfile, storyStatuses, vocabStats } from "./stats";

/**
 * Mijlpalen.
 *
 * De regel hier is: een mijlpaal moet iets meten dat je écht verder heeft
 * geholpen, niet iets dat je toevallig aantikte. Daarom geen "log tien dagen in"
 * maar dingen als "vijftig dictees zonder een diakritisch teken te missen" —
 * dat is precies de fout waar een Nederlandstalige jarenlang in blijft hangen,
 * en hem verslaan is een echte mijlpaal.
 *
 * Elke mijlpaal is een teller met een doel, zodat een half behaalde mijlpaal
 * ook iets zegt. Niets is verborgen: je ziet waar je naartoe werkt.
 */

export interface Milestone {
  id: string;
  group: "Volhouden" | "Woordenschat" | "Vakmanschap" | "Verhalen";
  title: string;
  hint: string;
  value: number;
  goal: number;
  /** Hoe de teller wordt afgebeeld: 12/50 of 34%. */
  unit: "count" | "percent";
  done: boolean;
}

export function milestones(): Milestone[] {
  const profile = getProfile();
  const vocab = vocabStats();
  const stories = loadStories();
  const storyState = storyStatuses();

  // Alles wat uit attempts komt in één query, zodat de pagina niet twintig keer
  // dezelfde tabel afloopt.
  const row = db
    .select({
      graded: sql<number>`sum(case when ${attempts.type} != 'teaching_moment' then 1 else 0 end)`,
      productive: sql<number>`sum(case when ${attempts.mode} = 'productive' and ${attempts.type} != 'teaching_moment' then 1 else 0 end)`,
      dictees: sql<number>`sum(case when ${attempts.type} = 'drill_diktat' then 1 else 0 end)`,
      dicteesClean: sql<number>`sum(case when ${attempts.type} = 'drill_diktat' and ${attempts.correct} = 1 and ${attempts.nearMiss} = 0 then 1 else 0 end)`,
      genitief: sql<number>`sum(case when ${attempts.type} = 'drill_genitiv' and ${attempts.correct} = 1 then 1 else 0 end)`,
      vrij: sql<number>`sum(case when ${attempts.type} = 'free_production' and ${attempts.correct} = 1 then 1 else 0 end)`,
    })
    .from(attempts)
    .get();

  const n = (v: unknown) => Number(v ?? 0);
  const storiesRead = [...storyState.values()].filter((s) => s.readAt).length;
  const quizzesDone = [...storyState.values()].filter((s) => s.quizDoneAt).length;

  const defs: Omit<Milestone, "done">[] = [
    {
      id: "streak-7",
      group: "Volhouden",
      title: "Een week op rij",
      hint: "Zeven dagen achter elkaar iets gedaan. Regelmaat verslaat volume.",
      value: Math.max(profile.streakCurrent, profile.streakLongest),
      goal: 7,
      unit: "count",
    },
    {
      id: "streak-30",
      group: "Volhouden",
      title: "Een maand op rij",
      hint: "Dertig dagen. Op dit punt is het geen project meer maar een gewoonte.",
      value: Math.max(profile.streakCurrent, profile.streakLongest),
      goal: 30,
      unit: "count",
    },
    {
      id: "answers-500",
      group: "Volhouden",
      title: "Vijfhonderd antwoorden",
      hint: "Elk antwoord is een ophaalmoment — dát is waar het geheugen van leert.",
      value: n(row?.graded),
      goal: 500,
      unit: "count",
    },
    {
      id: "vocab-100",
      group: "Woordenschat",
      title: "Honderd woorden aangeraakt",
      hint: "Honderd woorden minstens één keer gezien.",
      value: vocab.seen,
      goal: 100,
      unit: "count",
    },
    {
      id: "vocab-solid-100",
      group: "Woordenschat",
      title: "Honderd woorden stevig",
      hint: "Honderd woorden met een stabiliteit van 21 dagen of meer — die zakken niet zomaar weg.",
      value: vocab.solid,
      goal: 100,
      unit: "count",
    },
    {
      id: "vocab-all",
      group: "Woordenschat",
      title: "De hele cursus gezien",
      hint: `Alle ${vocab.total} woorden uit het boek minstens één keer tegengekomen.`,
      value: vocab.seen,
      goal: vocab.total || 1,
      unit: "count",
    },
    {
      id: "diktat-50",
      group: "Vakmanschap",
      title: "Vijftig dictees schoon",
      hint: "Vijftig keer een woord gehoord en foutloos getypt — inclusief č, ć, š, ž en đ.",
      value: n(row?.dicteesClean),
      goal: 50,
      unit: "count",
    },
    {
      id: "genitiv-100",
      group: "Vakmanschap",
      title: "Honderd genitieven",
      hint: "De genitief onthult de stam. Wie hem kent, kent het woord echt.",
      value: n(row?.genitief),
      goal: 100,
      unit: "count",
    },
    {
      id: "productive-200",
      group: "Vakmanschap",
      title: "Tweehonderd keer zelf geproduceerd",
      hint: "Zelf getypt in plaats van herkend. Dit is de moeilijke helft.",
      value: n(row?.productive),
      goal: 200,
      unit: "count",
    },
    {
      id: "free-25",
      group: "Vakmanschap",
      title: "Vijfentwintig vrije teksten",
      hint: "Zelf zinnen bedacht en jezelf eerlijk beoordeeld.",
      value: n(row?.vrij),
      goal: 25,
      unit: "count",
    },
    {
      id: "stories-all",
      group: "Verhalen",
      title: "Alle verhalen gelezen",
      hint: "Elk verhaal minstens één keer uitgelezen.",
      value: storiesRead,
      goal: stories.length || 1,
      unit: "count",
    },
    {
      id: "story-quiz-all",
      group: "Verhalen",
      title: "Alle verhaalvragen af",
      hint: "Niet alleen gelezen, maar ook aangetoond dat het bleef hangen.",
      value: quizzesDone,
      goal: stories.length || 1,
      unit: "count",
    },
  ];

  return defs.map((d) => ({ ...d, done: d.value >= d.goal }));
}
