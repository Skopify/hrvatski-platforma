import Link from "next/link";

import { Heatmap, LineChart, Meter } from "@/components/charts";
import { DayTiles } from "@/components/DayTiles";
import { FitTitle } from "@/components/FitTitle";
import { SahovnicaVeld } from "@/components/SahovnicaVeld";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Empty, Page, SectionHead } from "@/components/ui";
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
      {/* ═══ De voorpagina: een mozaïek van affichevlakken ═══════════════════
          Rood is vandaag (begroeting en de volgende stap), blauw is het veld,
          geel het dagdoel, zwart de reeks, papier de kerncijfers. Elk vlak één
          boodschap; de volgorde op de telefoon is die van belang. */}
      <section className="stagger mb-10 grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-12">
        <div
          className="tone-crvena block-tone flex flex-col border-[3px] border-crna p-5 sm:p-8 lg:col-span-7"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <div className="flex items-start justify-between gap-3">
            <span className="pill bg-crna text-papir">
              {rank.code} · {rank.label}
            </span>
            <ThemeToggle className="-mr-2 -mt-2 text-[var(--on-tone)] md:hidden" />
          </div>

          <FitTitle text={hello.hr} max={150} className="animate-type mt-10" />
          <p className="label-caps mt-3 opacity-85">{hello.nl}</p>

          <p className="mt-6 max-w-md text-[16px] font-medium leading-relaxed">
            {due > 0
              ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar om te herhalen. Wat je nu ophaalt, blijft; wat je laat liggen, zakt weg.`
              : nextLessonData
                ? "Niets te herhalen — het goede moment voor nieuwe stof."
                : "Alles zit op schema. Lees een verhaal, of kom terug wanneer er herhaling klaarstaat."}
          </p>

          <div className="mt-auto flex flex-wrap gap-3 pt-8">
            {due > 0 ? (
              <Link href="/oefenen/herhalen" className="btn btn-primary h-12 px-6 text-[15px]">
                Herhalen
                <span className="num bg-zuta px-1.5 text-[14px] text-[#121212]">{due}</span>
              </Link>
            ) : null}
            {nextLessonData ? (
              <Link
                href={`/lessen/${nextLessonData.number}`}
                className={`btn h-12 px-6 text-[15px] ${due > 0 ? "btn-on-tone" : "btn-primary"}`}
              >
                {nextLesson?.status === "in_progress" ? "Les hervatten" : "Les beginnen"}
              </Link>
            ) : (
              <Link
                href="/lessen"
                className={`btn h-12 px-6 text-[15px] ${due > 0 ? "btn-on-tone" : "btn-primary"}`}
              >
                Lessen bekijken
              </Link>
            )}
          </div>
        </div>

        {/* Het veld: rood-witte tegels in een blauwe zee. Waar je komt, slaan
            ze geel aan; het midden staat geel naarmate het dagdoel vol raakt. */}
        <div
          className="tone-plava block-tone relative min-h-[280px] overflow-hidden border-[3px] border-crna sm:min-h-[340px] lg:col-span-5"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <SahovnicaVeld
            fog="--color-plava"
            earned={profile.dailyGoalXp ? todayXp / profile.dailyGoalXp : 0}
            className="absolute inset-0 cursor-crosshair"
          />
          <p className="label-caps pointer-events-none absolute bottom-4 left-4 bg-plava px-1">
            Beweeg of klik
          </p>
        </div>

        <div
          className="tone-zuta block-tone border-[3px] border-crna p-5 sm:p-8 lg:col-span-5"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <p className="label-caps">Dagdoel</p>
          <div className="mt-5 flex flex-wrap items-end justify-between gap-6">
            <DayTiles xp={todayXp} goal={profile.dailyGoalXp} day={today?.date ?? ""} />
            <p className="leading-none">
              <span className="num text-[72px]">{todayXp}</span>
              <span className="num text-[22px]"> / {profile.dailyGoalXp} XP</span>
            </p>
          </div>
          <p className="mt-5 text-[14px] font-semibold">
            {goalMet ? "Gehaald. Alles wat je nu nog doet, is winst." : `Nog ${profile.dailyGoalXp - todayXp} XP vandaag.`}
          </p>
        </div>

        <div
          className="tone-crna block-tone flex flex-col border-[3px] border-crna p-5 sm:p-8 lg:col-span-3"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <p className="label-caps">Reeks</p>
          <p className="num mt-4 text-[112px] leading-[0.8] text-crvena">{profile.streakCurrent}</p>
          <p className="mt-auto pt-4 text-[14px] font-semibold">
            {profile.streakCurrent === 1 ? "dag" : "dagen"} op rij
            {profile.streakLongest > profile.streakCurrent ? (
              <span className="block font-normal opacity-75">langste {profile.streakLongest}</span>
            ) : null}
          </p>
        </div>

        <div
          className="grid grid-cols-2 border-[3px] border-crna bg-surface lg:col-span-4"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          <div className="p-5 sm:p-7">
            <p className="label-caps text-ink-muted">Woorden</p>
            <p className="num mt-3 text-[56px] leading-none">{vocab.seen}</p>
            <p className="mt-2 text-[13px] leading-snug text-ink-secondary">
              {vocab.solid} stevig · {vocab.total} in de cursus
            </p>
          </div>
          <div className="border-l-[3px] border-crna p-5 sm:p-7">
            <p className="label-caps text-ink-muted">Goed</p>
            <p className="num mt-3 text-[56px] leading-none">
              {started ? `${Math.round(accuracy.accuracy * 100)}%` : "—"}
            </p>
            <p className="mt-2 text-[13px] leading-snug text-ink-secondary">
              {started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
            </p>
          </div>
        </div>

        {/* De rang: één lange balk over de hele breedte — de lange lijn onder de dag. */}
        <div
          className="border-[3px] border-crna bg-surface p-5 sm:px-8 lg:col-span-12"
          style={{ "--i": 5 } as React.CSSProperties}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <span className="label-caps">
              {rank.code} {next ? `→ ${next.code}` : ""}
            </span>
            <span className="num text-[18px]">
              {profile.xp}
              {next ? <span className="text-ink-muted"> / {next.from} XP</span> : " XP"}
            </span>
          </div>
          <div className="mt-3 h-5 border-[3px] border-crna bg-plane">
            <div
              className="animate-grow-x h-full origin-left bg-plava"
              style={{
                width: `${Math.min(100, Math.max(((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100, profile.xp > rank.from ? 2 : 0))}%`,
              }}
            />
          </div>
          <p className="mt-2.5 text-[13px] text-ink-secondary">
            {next
              ? `Nog ${Math.max(0, next.from - profile.xp)} XP tot ${next.code} — ${next.label.toLowerCase()}.`
              : "Hoogste rang bereikt."}
            {due === 0 && nextReview
              ? ` Eerstvolgende herhaling: ${nextReview.toLocaleString("nl-NL", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : ""}
          </p>
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
