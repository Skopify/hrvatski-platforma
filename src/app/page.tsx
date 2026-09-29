import Link from "next/link";

import { Heatmap, LineChart, Meter } from "@/components/charts";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Empty, Flame, Page, Ring, SectionHead } from "@/components/ui";
import { WordOfTheDay } from "@/components/WordOfTheDay";
import { loadLessons } from "@/lib/content";
import {
  dailyStats,
  getProfile,
  lessonStatuses,
  overallAccuracy,
  rankFor,
  vocabStats,
  weakPoints,
  wordOfTheDay,
} from "@/lib/stats";
import { nextReviewableAt, reviewableCount } from "@/lib/planner";

export const dynamic = "force-dynamic";

/**
 * De begroeting is Kroatisch en volgt de klok. Kleine dagelijkse herhaling van
 * iets dat je toch moet kennen — en het maakt meteen duidelijk dat dit een
 * Kroatische omgeving is en geen dashboard met een Kroatische module erin.
 */
function greeting(): { hr: string; nl: string } {
  const h = new Date().getHours();
  if (h < 11) return { hr: "Dobro jutro!", nl: "Goedemorgen" };
  if (h < 18) return { hr: "Dobar dan!", nl: "Goedendag" };
  return { hr: "Dobra večer!", nl: "Goedenavond" };
}

export default function DashboardPage() {
  const profile = getProfile();
  const { rank, next } = rankFor(profile.xp);
  const due = reviewableCount();
  const nextReview = nextReviewableAt();
  const vocab = vocabStats();
  const accuracy = overallAccuracy();
  const days = dailyStats(30);
  const weak = weakPoints();
  const statuses = lessonStatuses();
  const lessons = loadLessons();
  const daily = wordOfTheDay();

  const today = days[days.length - 1];
  const todayXp = today?.xp ?? 0;
  const goalMet = todayXp >= profile.dailyGoalXp;
  const nextLesson =
    statuses.find((s) => s.status === "in_progress") ??
    statuses.find((s) => s.status === "available");
  const nextLessonData = nextLesson
    ? lessons.find((l) => l.number === nextLesson.lesson)
    : undefined;

  const started = accuracy.total > 0;
  const done = statuses.filter((s) => s.status === "done").length;
  const hello = greeting();
  const datum = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Page>
      {/* ═══ Kop: de datum klein erboven, de groet groot — zoals Vandaag in iOS ═══ */}
      <header className="mb-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.04em] text-bad">{datum}</p>
          <h1 className="hr-text display mt-1 text-[38px] text-ink sm:text-[46px]">{hello.hr}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">
            {hello.nl} · {rank.code} {rank.label}
          </p>
        </div>
        <ThemeToggle className="md:hidden" />
      </header>

      {/* ═══ Widgets. Groot: vandaag. Klein: wat je nu kunt doen en waar je staat. ═══ */}
      <section className="stagger mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div
          className="card col-span-2 flex flex-col gap-6 p-5 sm:flex-row sm:items-center sm:p-6 lg:row-span-2"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <Ring value={todayXp} max={profile.dailyGoalXp} size={156} stroke={20}>
            <span className="num text-[34px] leading-none">{todayXp}</span>
            <span className="mt-1 text-[12px] font-semibold text-ink-muted">van {profile.dailyGoalXp} XP</span>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">Vandaag</p>
            <p className="mt-1 text-[20px] font-bold leading-snug tracking-tight">
              {goalMet
                ? "Dagdoel gehaald."
                : `Nog ${profile.dailyGoalXp - todayXp} XP tot je dagdoel.`}
            </p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-ink-secondary">
              {due > 0
                ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar. Wat je nu ophaalt, blijft; wat je laat liggen, zakt weg.`
                : nextLessonData
                  ? "Niets te herhalen — het goede moment voor nieuwe stof."
                  : "Alles zit op schema."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {due > 0 ? (
                <Link href="/oefenen/herhalen" className="btn btn-primary h-11 px-5 text-[15px]">
                  Herhalen
                  <span className="num rounded-full bg-on-fill/20 px-2 text-[13px] leading-[20px]">{due}</span>
                </Link>
              ) : null}
              {nextLessonData ? (
                <Link
                  href={`/lessen/${nextLessonData.number}`}
                  className={`btn h-11 px-5 text-[15px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}
                >
                  {nextLesson?.status === "in_progress" ? "Les hervatten" : "Les beginnen"}
                </Link>
              ) : (
                <Link href="/lessen" className={`btn h-11 px-5 text-[15px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}>
                  Lessen bekijken
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="card p-5" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="eyebrow flex items-center gap-1.5">
            <Flame alive={profile.streakCurrent > 0} size={12} /> Reeks
          </p>
          <p className="num mt-2 text-[40px] leading-none">{profile.streakCurrent}</p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {profile.streakCurrent === 1 ? "dag" : "dagen"} op rij
            {profile.streakLongest > profile.streakCurrent ? ` · langste ${profile.streakLongest}` : ""}
          </p>
        </div>

        <div className="card p-5" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="eyebrow">Goed</p>
          <p className="num mt-2 text-[40px] leading-none">
            {started ? `${Math.round(accuracy.accuracy * 100)}%` : "—"}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
          </p>
        </div>

        <div className="card p-5" style={{ "--i": 3 } as React.CSSProperties}>
          <p className="eyebrow">Woorden</p>
          <p className="num mt-2 text-[40px] leading-none">{vocab.seen}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className="animate-grow-x h-full origin-left rounded-full bg-accent-fill"
              style={{ width: `${vocab.total ? Math.max(2, (vocab.seen / vocab.total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {vocab.solid} stevig · {vocab.total} in de cursus
          </p>
        </div>

        <div className="card p-5" style={{ "--i": 4 } as React.CSSProperties}>
          <p className="eyebrow">Niveau</p>
          <p className="num mt-2 text-[40px] leading-none">{rank.code}</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-sunken">
            <div
              className="animate-grow-x h-full origin-left rounded-full bg-accent-fill"
              style={{
                width: `${Math.min(100, Math.max(((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100, profile.xp > rank.from ? 2 : 0))}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-[13px] text-ink-muted">
            {next ? `nog ${Math.max(0, next.from - profile.xp)} XP tot ${next.code}` : "hoogste rang"}
          </p>
        </div>
      </section>

      {due === 0 && nextReview ? (
        <p className="-mt-4 mb-8 text-[13px] text-ink-muted">
          Eerstvolgende herhaling:{" "}
          {nextReview.toLocaleString("nl-NL", {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </p>
      ) : null}

      {/* ═══ Verloop ═══ */}
      <section className="mb-8 grid gap-4 lg:grid-cols-2">
        <LineChart
          data={days.slice(-14).map((d) => ({ label: d.date.slice(5), value: d.accuracy }))}
          title="Accuratesse"
          hint="Laatste veertien dagen. Een dip na een nieuwe les is normaal."
          percent
        />
        <Heatmap
          data={dailyStats(126).map((d) => ({ date: d.date, value: d.xp }))}
          title="Activiteit"
          hint="Regelmaat verslaat volume — twee korte sessies zijn beter dan één lange."
          weeks={18}
        />
      </section>

      {/* ═══ Diagnose en het woord van vandaag ═══ */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div>
          <SectionHead
            title="Zwakke punten"
            hint="Onderwerpen waar je het vaakst struikelt. De herhaalsessie geeft deze voorrang."
            action={{ href: "/voortgang", label: "Alle cijfers" }}
          />
          {weak.length > 0 ? (
            <ul className="stagger grid gap-3 sm:grid-cols-2">
              {weak.map((w, i) => (
                <li key={w.topic} style={{ "--i": i } as React.CSSProperties}>
                  <div className="card px-5 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-[14px] font-semibold text-ink">{w.topic}</span>
                      <span className="tabular shrink-0 text-[14px] font-bold text-bad-ink">
                        {Math.round(w.accuracy * 100)}%
                      </span>
                    </div>
                    <div className="mt-2.5">
                      <Meter value={w.accuracy} max={1} height={6} />
                    </div>
                    <p className="mt-2 text-[12px] text-ink-muted">over {w.attempts} pogingen</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>
              {started
                ? "Geen zwakke punten: elk onderwerp met genoeg antwoorden staat op 90% of hoger. Zodra iets begint te zakken, verschijnt het hier."
                : "Zwakke punten verschijnen zodra er genoeg antwoorden zijn om een patroon uit te lezen — vanaf ongeveer vier pogingen per onderwerp."}
            </Empty>
          )}
        </div>

        {daily ? (
          <div className="lg:pt-[52px]">
            <WordOfTheDay word={daily} />
          </div>
        ) : null}
      </section>
    </Page>
  );
}
