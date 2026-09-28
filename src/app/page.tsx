import Link from "next/link";

import { Heatmap, LineChart, Meter, StatTile } from "@/components/charts";
import { DayTiles } from "@/components/DayTiles";
import { SahovnicaVeld } from "@/components/SahovnicaVeld";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Bolt, Empty, Flame, Page, Pill, SectionHead } from "@/components/ui";
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

  return (
    <Page>
      {/* ═══ Het vandaag-vlak: links wat je nú moet weten, rechts het veld. ═══ */}
      <section className="hero relative mb-6 overflow-hidden">
        <div className="grid lg:grid-cols-[1.05fr_1fr]">
          <div className="relative z-10 p-6 sm:p-9">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="accent">
                  {rank.code} · {rank.label}
                </Pill>
                {done > 0 ? (
                  <span className="text-[12.5px] text-ink-muted">
                    {done} van {lessons.length} lessen af
                  </span>
                ) : null}
              </div>
              <ThemeToggle className="-mr-2 -mt-2 md:hidden" />
            </div>

            <h1 className="hr-text display mt-5 text-[44px] text-ink sm:text-[58px]">{hello.hr}</h1>
            <p className="mt-1.5 text-[13px] text-ink-muted">{hello.nl}</p>

            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-secondary">
              {due > 0
                ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar om te herhalen. Wat je nu ophaalt, blijft; wat je laat liggen, zakt weg.`
                : nextLessonData
                  ? "Niets te herhalen — het goede moment voor nieuwe stof."
                  : "Alles zit op schema. Lees een verhaal, of kom terug wanneer er herhaling klaarstaat."}
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {due > 0 ? (
                <Link href="/oefenen/herhalen" className="btn btn-primary h-12 px-6 text-[15px]">
                  Herhalen
                  <span className="num rounded-full bg-on-fill/20 px-2 py-0.5 text-[12.5px]">{due}</span>
                </Link>
              ) : null}

              {nextLessonData ? (
                <Link
                  href={`/lessen/${nextLessonData.number}`}
                  className={`btn h-12 px-6 text-[15px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}
                >
                  {nextLesson?.status === "in_progress" ? "Les hervatten" : "Les beginnen"}
                  <span className="hr-text hidden max-w-[16ch] truncate font-normal opacity-70 xl:inline">
                    · {nextLessonData.title_hr}
                  </span>
                </Link>
              ) : (
                <Link
                  href="/lessen"
                  className={`btn h-12 px-6 text-[15px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}
                >
                  Lessen bekijken
                </Link>
              )}
            </div>

            {/* Het dagdoel als šahovnica: elk vakje een twaalfde van het doel. */}
            <div className="mt-9">
              <DayTiles xp={todayXp} goal={profile.dailyGoalXp} day={today?.date ?? ""} />
              <div className="mt-3 flex max-w-[300px] items-baseline justify-between gap-3">
                <span className="text-[13px] text-ink-secondary">
                  <span className="num text-[22px] text-ink">{todayXp}</span> van {profile.dailyGoalXp} XP
                </span>
                {goalMet ? (
                  <span className="text-[12.5px] font-semibold text-good-ink">Dagdoel gehaald ✓</span>
                ) : (
                  <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-warm">
                    <Flame alive={profile.streakCurrent > 0} size={12} />
                    {profile.streakCurrent} {profile.streakCurrent === 1 ? "dag" : "dagen"} op rij
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Het veld. Op de telefoon een band bovenaan, op een scherm de hele
              rechterhelft. Gloeit vanuit het midden naarmate het dagdoel vol raakt. */}
          <SahovnicaVeld
            earned={profile.dailyGoalXp ? todayXp / profile.dailyGoalXp : 0}
            className="order-first h-[210px] cursor-crosshair sm:h-[260px] lg:order-none lg:h-auto lg:min-h-[440px]"
          />
        </div>

        {/* Rangbalk als voet van het vlak — de lange lijn onder de dag. */}
        <div className="border-t border-line px-6 py-4 sm:px-9">
          <div className="mb-2.5 flex items-baseline justify-between gap-4">
            <span className="text-[12.5px] text-ink-secondary">
              {next
                ? `Nog ${Math.max(0, next.from - profile.xp)} XP tot ${next.code} — ${next.label.toLowerCase()}`
                : "Hoogste rang bereikt"}
            </span>
            <span className="num flex items-center gap-1.5 text-[13px] text-ink">
              <Bolt className="text-gold-bright" />
              {profile.xp}
              {next ? <span className="font-normal text-ink-muted">/ {next.from}</span> : null}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="animate-grow-x h-full origin-left rounded-full bg-accent"
              style={{
                width: `${Math.min(100, Math.max(((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100, profile.xp > rank.from ? 3 : 0))}%`,
              }}
            />
          </div>
          {due === 0 && nextReview ? (
            <p className="mt-3 text-[12.5px] text-ink-muted">
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
        </div>
      </section>

      {/* ═══ Kerncijfers ═══ */}
      <section className="stagger mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="h-full" style={{ "--i": 0 } as React.CSSProperties}>
          <StatTile
            label="Reeks"
            value={String(profile.streakCurrent)}
            sub={
              profile.streakLongest > profile.streakCurrent
                ? `langste tot nu toe ${profile.streakLongest}`
                : "dagen achtereen"
            }
            tone="warm"
            icon={<Flame alive={profile.streakCurrent > 0} size={13} />}
          />
        </div>
        <div className="h-full" style={{ "--i": 1 } as React.CSSProperties}>
          <StatTile
            label="XP vandaag"
            value={String(todayXp)}
            sub={goalMet ? "dagdoel gehaald" : `doel ${profile.dailyGoalXp}`}
            tone={goalMet ? "good" : "neutral"}
            icon={<Bolt />}
            meter={Math.min(1, todayXp / profile.dailyGoalXp)}
          />
        </div>
        <div className="h-full" style={{ "--i": 2 } as React.CSSProperties}>
          <StatTile
            label="Woorden"
            value={String(vocab.seen)}
            sub={`${vocab.solid} stevig · ${vocab.total} in de cursus`}
            tone="neutral"
            meter={vocab.total ? vocab.seen / vocab.total : 0}
          />
        </div>
        <div className="h-full" style={{ "--i": 3 } as React.CSSProperties}>
          <StatTile
            label="Accuratesse"
            value={started ? `${Math.round(accuracy.accuracy * 100)}%` : "—"}
            sub={started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
            tone={
              !started ? "neutral" : accuracy.accuracy >= 0.85 ? "good" : accuracy.accuracy >= 0.7 ? "neutral" : "bad"
            }
          />
        </div>
      </section>

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
