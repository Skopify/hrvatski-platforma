import Link from "next/link";

import { Celebrate } from "@/components/Celebrate";
import { Heatmap, LineChart, Meter, Sparkline } from "@/components/charts";
import { SearchButton } from "@/components/CommandMenu";
import { CountUp } from "@/components/CountUp";
import { Arrow, Doodle, Sparkle, Squiggle } from "@/components/doodles";
import { PillMeter } from "@/components/PillMeter";
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
  const week = dailyStats(7).slice(-7);
  const practiced = days.filter((d) => d.attempts > 0).slice(-14).map((d) => d.accuracy);
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
  const hello = greeting();
  const datum = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
  const rankPct = Math.min(
    100,
    Math.max(
      ((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100,
      profile.xp > rank.from ? 2 : 0,
    ),
  );

  return (
    <Page>
      <Celebrate when={goalMet} day={today?.date ?? ""} />

      {/* ═══ Kop: de datum in handschrift, de groet groot met een golf eronder ═══ */}
      <header className="mb-9 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="hand text-[18px] font-bold text-warm">{datum}</p>
          <h1 className="hr-text display mt-1 text-[46px] text-ink sm:text-[74px]">
            <span className="relative inline-block pb-3.5">
              {hello.hr}
              <Squiggle slow color="var(--color-ring)" className="absolute -bottom-0.5 left-0 h-[16px] w-full" />
            </span>
          </h1>
          <p className="hand mt-2 text-[16px] text-ink-muted">{hello.nl}</p>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <SearchButton compact className="h-10 w-10 justify-center rounded-xl" />
          <ThemeToggle />
        </div>
      </header>

      <section className="stagger mb-10 grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* ═══ Het hoofdvlak: wat je nú doet, met het dagdoel als pill onderaan ═══ */}
        <div
          className="relative col-span-2 overflow-hidden rounded-card border-[2.5px] border-outline bg-pop-lilac p-6 text-on-pop shadow-[6px_6px_0_var(--color-outline)] sm:p-8 lg:col-span-4"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <Sparkle size={30} className="absolute right-6 top-5 rotate-12" color="var(--color-pop-yellow)" />
          <Sparkle size={18} className="absolute right-[72px] top-12 -rotate-6" color="#ffffff" />

          <span className="pill bg-white text-on-pop">
            {rank.code} · {rank.label}
          </span>
          <p className="display mt-5 max-w-[16ch] text-[36px] leading-[1.02] sm:text-[52px]">
            {due > 0 ? (
              <>
                <CountUp value={due} /> {due === 1 ? "item wacht" : "items wachten"} op je.
              </>
            ) : nextLessonData ? (
              "Tijd voor nieuwe stof."
            ) : (
              "Alles zit op schema."
            )}
          </p>

          <div className="relative mt-4">
            <p className="hand max-w-[30ch] rotate-[-1.5deg] text-[16px] font-bold">
              {due > 0
                ? "wat je nu ophaalt, blijft. wat je laat liggen, zakt weg."
                : nextLessonData
                  ? "niets te herhalen. tijd om verder te gaan!"
                  : "lees een verhaal, of kom later terug."}
            </p>
            <Arrow className="absolute -bottom-9 left-[17rem] hidden h-11 w-14 sm:block" />
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {due > 0 ? (
              <Link href="/oefenen/herhalen" className="btn btn-primary h-[52px] px-7 text-[16px]">
                Start herhaling
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ) : null}
            {nextLessonData ? (
              <Link
                href={`/lessen/${nextLessonData.number}`}
                className={`btn ${due > 0 ? "btn-ghost h-11 px-5 text-[14.5px]" : "btn-primary h-[52px] px-6 text-[16px]"}`}
              >
                {nextLesson?.status === "in_progress" ? "Hervat je les" : "Volgende les"}
              </Link>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <p className="hand text-[15px] font-bold">Dagdoel</p>
              <p className="text-[13.5px] font-semibold">
                {goalMet ? "gehaald!" : `nog ${profile.dailyGoalXp - todayXp} XP vandaag`}
              </p>
            </div>
            <PillMeter value={todayXp} max={profile.dailyGoalXp} color="var(--color-pop-yellow)" height={38} />
          </div>
        </div>

        {/* ═══ De reeks, met de week eronder ═══ */}
        <div
          className="relative col-span-2 flex flex-col overflow-hidden rounded-card border-[2.5px] border-outline bg-pop-yellow p-6 text-on-pop shadow-[6px_6px_0_var(--color-outline)] lg:col-span-2"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <div className="flex items-start justify-between">
            <p className="hand text-[16px] font-bold">Reeks</p>
            <Doodle
              name="flame"
              size={54}
              color={profile.streakCurrent > 0 ? "var(--color-warm-bright)" : "#ffffff"}
              className={`-mr-1 -mt-1 rotate-6 ${profile.streakCurrent > 0 ? "animate-flicker" : ""}`}
            />
          </div>
          <p className="-mt-3 leading-none">
            <CountUp value={profile.streakCurrent} className="num text-[76px]" />
            <span className="hand ml-2 text-[18px] font-bold">{profile.streakCurrent === 1 ? "dag" : "dagen"}</span>
          </p>

          <div className="mt-auto grid grid-cols-7 gap-1 pt-6">
            {week.map((d, i) => {
              const did = d.xp > 0;
              const isToday = i === week.length - 1;
              return (
                <div key={d.date} className="flex min-w-0 flex-col items-center gap-1.5">
                  <span
                    title={`${d.date}: ${d.xp} XP`}
                    className={`flex aspect-square w-full max-w-9 items-center justify-center rounded-full border-2 ${
                      did
                        ? "border-outline bg-warm-bright"
                        : isToday
                          ? "border-dashed border-outline bg-white/60"
                          : "border-outline/40 bg-white/50"
                    }`}
                  >
                    {did ? <Doodle name="check" size={16} stroke={2.6} /> : null}
                  </span>
                  <span className="hand text-[13px] font-bold">
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "narrow" }).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[13.5px] font-semibold">
            {profile.streakCurrent === 0
              ? `Eén ronde vandaag start je reeks.${profile.streakLongest > 0 ? ` Je record: ${profile.streakLongest}.` : ""}`
              : profile.streakLongest > profile.streakCurrent
                ? `Je record: ${profile.streakLongest} dagen.`
                : "Dit is je langste reeks tot nu toe!"}
          </p>
        </div>

        {/* ═══ Drie cijfers, elk in een eigen stift ═══ */}
        <div
          className="flex flex-col rounded-card border-2 border-outline bg-pop-mint p-5 text-on-pop shadow-[var(--hard)] lg:col-span-2"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <p className="hand text-[15px] font-bold">Goed</p>
          <p className="mt-1.5 leading-none">
            {started ? (
              <CountUp value={Math.round(accuracy.accuracy * 100)} suffix="%" className="num text-[46px]" />
            ) : (
              <span className="num text-[46px]">—</span>
            )}
          </p>
          {practiced.length >= 2 ? (
            <div className="mt-auto pt-3">
              <Sparkline data={practiced} tone="var(--color-outline)" height={30} />
            </div>
          ) : (
            <div className="mt-auto" />
          )}
          <p className="mt-2 text-[13.5px] font-semibold">
            {started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
          </p>
        </div>

        <div
          className="flex flex-col rounded-card border-2 border-outline bg-pop-sky p-5 text-on-pop shadow-[var(--hard)] lg:col-span-2"
          style={{ "--i": 3 } as React.CSSProperties}
        >
          <p className="hand text-[15px] font-bold">Woorden</p>
          <p className="mt-1.5 leading-none">
            <CountUp value={vocab.seen} className="num text-[46px]" />
            <span className="hand ml-1.5 text-[15px] font-bold">/ {vocab.total}</span>
          </p>
          <div className="mt-auto pt-4">
            <PillMeter value={vocab.seen} max={vocab.total} color="var(--color-pop-yellow)" height={22} showBurst={false}>
              {vocab.total ? Math.round((vocab.seen / vocab.total) * 100) : 0}%
            </PillMeter>
          </div>
          <p className="mt-2 text-[13.5px] font-semibold">{vocab.solid} stevig in je geheugen</p>
        </div>

        <div
          className="col-span-2 flex flex-col rounded-card border-2 border-outline bg-pop-pink p-5 text-on-pop shadow-[var(--hard)] lg:col-span-2"
          style={{ "--i": 4 } as React.CSSProperties}
        >
          <p className="hand text-[15px] font-bold">Niveau</p>
          <p className="mt-1.5 leading-none">
            <span className="num text-[46px]">{rank.code}</span>
            <span className="hand ml-2 text-[15px] font-bold">{rank.label}</span>
          </p>
          <div className="mt-auto pt-4">
            <PillMeter value={Math.round(rankPct)} max={100} color="var(--color-pop-lilac)" height={22} showBurst={false}>
              {Math.round(rankPct)}%
            </PillMeter>
          </div>
          <p className="mt-2 text-[13.5px] font-semibold">
            {next ? `nog ${Math.max(0, next.from - profile.xp).toLocaleString("nl-NL")} XP tot ${next.code}` : "hoogste rang"}
          </p>
        </div>
      </section>

      {due === 0 && nextReview ? (
        <p className="hand -mt-6 mb-10 text-[14.5px] font-semibold text-ink-secondary">
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
                    <p className="mt-2 text-[13px] text-ink-muted">over {w.attempts} pogingen</p>
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
