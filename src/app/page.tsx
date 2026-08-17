import Link from "next/link";

import { Heatmap, LineChart, Meter, StatTile } from "@/components/charts";
import { Bolt, Checker, Empty, Flame, Page, Pill, ProgressRing, SectionHead } from "@/components/ui";
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
      {/* ═══ Het vandaag-vlak: alles wat je nú moet weten, in één frisse kaart. ═══ */}
      <section className="hero animate-rise mb-8 p-7 sm:p-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <Checker className="mb-4" />
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent" className="bg-surface">
                {rank.code} · {rank.label}
              </Pill>
              {done > 0 ? (
                <span className="text-[12px] text-ink-muted">
                  {done} van {lessons.length} lessen af
                </span>
              ) : null}
            </div>

            <h1 className="hr-text display mt-4 text-[42px] text-ink sm:text-[52px]">
              {hello.hr}
            </h1>
            <p className="mt-1.5 text-[13px] text-ink-muted">{hello.nl}</p>

            <p className="mt-5 max-w-lg text-[14.5px] leading-relaxed text-ink-secondary">
              {due > 0
                ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar om te herhalen. Wat je nu ophaalt, blijft; wat je laat liggen, zakt weg.`
                : nextLessonData
                  ? "Niets te herhalen — het goede moment voor nieuwe stof."
                  : "Alles zit op schema. Lees een verhaal, of kom terug wanneer er herhaling klaarstaat."}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              {due > 0 ? (
                <Link href="/oefenen/herhalen" className="btn btn-primary px-6 py-3 text-[14.5px]">
                  Herhalen
                  <span className="tabular rounded-full bg-white/22 px-2 py-0.5 text-[12px]">
                    {due}
                  </span>
                </Link>
              ) : null}

              {nextLessonData ? (
                <Link
                  href={`/lessen/${nextLessonData.number}`}
                  className={`btn px-6 py-3 text-[14.5px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}
                >
                  {nextLesson?.status === "in_progress" ? "Les hervatten" : "Les beginnen"}
                  <span className="hr-text hidden font-normal opacity-70 sm:inline">
                    · {nextLessonData.title_hr}
                  </span>
                </Link>
              ) : (
                <Link
                  href="/lessen"
                  className={`btn px-6 py-3 text-[14.5px] ${due > 0 ? "btn-ghost" : "btn-primary"}`}
                >
                  Lessen bekijken
                </Link>
              )}

              <Link href="/verhalen" className="btn btn-ghost px-6 py-3 text-[14.5px]">
                Verhalen lezen
              </Link>
            </div>
          </div>

          {/* De dagring. Eén blik zegt of vandaag al geteld heeft. */}
          <div className="flex shrink-0 items-center gap-7 lg:flex-col lg:gap-5">
            <ProgressRing
              value={todayXp}
              max={profile.dailyGoalXp}
              size={148}
              stroke={12}
              tone={goalMet ? "good" : "accent"}
              track="rgba(14, 94, 199, 0.12)"
            >
              <span className="display text-[36px] leading-none text-ink">{todayXp}</span>
              <span className="mt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                van {profile.dailyGoalXp} XP
              </span>
            </ProgressRing>

            <div className="space-y-2 lg:text-center">
              <div className="flex items-center gap-2 text-ink lg:justify-center">
                <Flame days={profile.streakCurrent} alive={profile.streakCurrent > 0} />
                <span className="text-[12.5px] text-ink-secondary">
                  {profile.streakCurrent === 1 ? "dag" : "dagen"} op rij
                </span>
              </div>
              {goalMet ? (
                <p className="text-[12px] font-semibold text-good-ink">Dagdoel gehaald ✓</p>
              ) : (
                <p className="text-[12px] text-ink-muted">
                  Nog {profile.dailyGoalXp - todayXp} XP vandaag
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Rangbalk als voet van het vlak — de lange lijn onder de dag. */}
        <div className="mt-8 border-t border-accent-ring/60 pt-5">
          <div className="mb-2.5 flex items-baseline justify-between gap-4">
            <span className="text-[12.5px] text-ink-secondary">
              {next
                ? `Nog ${Math.max(0, next.from - profile.xp)} XP tot ${next.code} — ${next.label.toLowerCase()}`
                : "Hoogste rang bereikt"}
            </span>
            <span className="tabular flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
              <Bolt className="text-gold-bright" />
              {profile.xp}
              {next ? <span className="font-normal text-ink-muted">/ {next.from}</span> : null}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-700"
              style={{
                width: `${Math.min(100, Math.max(((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100, profile.xp > rank.from ? 3 : 0))}%`,
              }}
            />
          </div>
        </div>

        {due === 0 && nextReview ? (
          <p className="mt-5 text-[12.5px] text-ink-muted">
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
      </section>

      {/* ═══ Kerncijfers ═══ */}
      <section className="stagger mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="h-full" style={{ "--i":0 } as React.CSSProperties}>
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
        <div className="h-full" style={{ "--i":1 } as React.CSSProperties}>
          <StatTile
            label="XP vandaag"
            value={String(todayXp)}
            sub={goalMet ? "dagdoel gehaald" : `doel ${profile.dailyGoalXp}`}
            tone={goalMet ? "good" : "gold"}
            icon={<Bolt />}
            meter={Math.min(1, todayXp / profile.dailyGoalXp)}
          />
        </div>
        <div className="h-full" style={{ "--i":2 } as React.CSSProperties}>
          <StatTile
            label="Woorden"
            value={String(vocab.seen)}
            sub={`${vocab.solid} stevig · ${vocab.total} in de cursus`}
            tone="accent"
            meter={vocab.total ? vocab.seen / vocab.total : 0}
          />
        </div>
        <div className="h-full" style={{ "--i":3 } as React.CSSProperties}>
          <StatTile
            label="Accuratesse"
            value={started ? `${Math.round(accuracy.accuracy * 100)}%` : "—"}
            sub={started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
            tone={
              !started ? "neutral" : accuracy.accuracy >= 0.85 ? "good" : accuracy.accuracy >= 0.7 ? "gold" : "bad"
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
