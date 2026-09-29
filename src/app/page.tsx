import Link from "next/link";

import { Celebrate } from "@/components/Celebrate";
import { Heatmap, LineChart, Meter, Sparkline } from "@/components/charts";
import { SearchButton } from "@/components/CommandMenu";
import { CountUp } from "@/components/CountUp";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Empty, Page, Ring, SectionHead } from "@/components/ui";
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
  const done = statuses.filter((s) => s.status === "done").length;
  const hello = greeting();
  const datum = new Date().toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });

  return (
    <Page>
      <Celebrate when={goalMet} day={today?.date ?? ""} />

      {/* ═══ Kop: de datum klein erboven, de groet groot — zoals Vandaag in iOS ═══ */}
      <header className="mb-7 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-[0.05em] text-bad">{datum}</p>
          <h1 className="hr-text display mt-1 text-[40px] text-ink sm:text-[52px]">{hello.hr}</h1>
          <p className="mt-1 text-[15px] text-ink-muted">{hello.nl}</p>
        </div>
        <div className="flex items-center gap-1 md:hidden">
          <SearchButton compact className="h-10 w-10 justify-center rounded-full" />
          <ThemeToggle />
        </div>
      </header>

      <section className="stagger mb-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-6">
        {/* ═══ Het hoofdvlak: wat je nú doet. Mesh-verloop, witte ring. ═══ */}
        <div
          className="mesh relative col-span-2 overflow-hidden rounded-[28px] p-6 shadow-[0_24px_60px_-28px_rgb(40_60_200/0.7)] sm:p-8 lg:col-span-4"
          style={{ "--i": 0 } as React.CSSProperties}
        >
          <div aria-hidden className="mesh-grain" />
          <div className="relative flex flex-col-reverse gap-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <span className="pill btn-glass">
                {rank.code} · {rank.label}
              </span>
              <p className="display mt-5 text-[34px] leading-[1.05] sm:text-[42px]">
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
              <p className="mt-2.5 max-w-sm text-[15px] leading-relaxed text-white/85">
                {due > 0
                  ? "Wat je nu ophaalt, blijft; wat je laat liggen, zakt weg."
                  : nextLessonData
                    ? "Niets te herhalen. Het goede moment om verder te gaan."
                    : "Lees een verhaal, of kom terug wanneer er herhaling klaarstaat."}
              </p>
              <div className="mt-6 flex flex-wrap gap-2.5">
                {due > 0 ? (
                  <Link href="/oefenen/herhalen" className="btn btn-light h-12 px-6 text-[15px]">
                    Start herhaling
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  </Link>
                ) : null}
                {nextLessonData ? (
                  <Link
                    href={`/lessen/${nextLessonData.number}`}
                    className={`btn h-12 max-w-full px-5 text-[15px] ${due > 0 ? "btn-glass" : "btn-light"}`}
                  >
                    <span className="truncate">
                      {nextLesson?.status === "in_progress" ? "Hervat je les" : "Volgende les"}
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-5 sm:flex-col sm:gap-3">
              <Ring value={todayXp} max={profile.dailyGoalXp} size={150} stroke={16} light>
                <CountUp value={todayXp} className="num text-[34px] leading-none" />
                <span className="mt-1 text-[12px] font-semibold text-white/75">van {profile.dailyGoalXp} XP</span>
              </Ring>
              <p className="text-[13px] font-semibold text-white/85 sm:text-center">
                {goalMet ? "Dagdoel gehaald" : `nog ${profile.dailyGoalXp - todayXp} XP vandaag`}
              </p>
            </div>
          </div>
        </div>

        {/* ═══ De reeks, met de week eronder — elke dag die telde een vlam. ═══ */}
        <div className="card col-span-2 flex flex-col p-6 lg:col-span-2" style={{ "--i": 1 } as React.CSSProperties}>
          <div className="flex items-center justify-between">
            <p className="eyebrow">Reeks</p>
            <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-gradient-to-b from-[#ffb340] to-[#ff6a00] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_14px_-6px_#ff6a00]">
              <svg width="15" height="18" viewBox="0 0 17 20" aria-hidden className={profile.streakCurrent > 0 ? "animate-flicker" : ""}>
                <path d="M8.5 0.5c.9 3.1-.6 4.6-2.1 6.2C4.6 8.6 3 10.4 3 13a5.5 5.5 0 0 0 11 0c0-2-.7-3.3-1.7-4.6-.4 1-1 1.6-1.9 1.9.6-2.6-.2-5.4-1.9-9.8Z" fill="#fff" />
              </svg>
            </span>
          </div>
          <p className="mt-2 leading-none">
            <CountUp value={profile.streakCurrent} className="num text-[52px]" />
            <span className="ml-1.5 text-[16px] font-semibold text-ink-muted">
              {profile.streakCurrent === 1 ? "dag" : "dagen"}
            </span>
          </p>
          <div className="mt-auto flex justify-between gap-1 pt-5">
            {week.map((d, i) => {
              const done = d.xp > 0;
              const isToday = i === week.length - 1;
              return (
                <div key={d.date} className="flex flex-col items-center gap-1.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] ${
                      done
                        ? "bg-gradient-to-b from-[#ffb340] to-[#ff6a00] text-white shadow-[0_4px_10px_-4px_#ff6a00]"
                        : isToday
                          ? "ring-2 ring-inset ring-[#ff9500]"
                          : "bg-sunken"
                    }`}
                    title={`${d.date}: ${d.xp} XP`}
                  >
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden><path d="M3 8.4 6.2 11.6 13 4.8" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : null}
                  </span>
                  <span className={`text-[11px] font-semibold ${isToday ? "text-ink" : "text-ink-muted"}`}>
                    {new Date(d.date).toLocaleDateString("nl-NL", { weekday: "narrow" }).toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-muted">
            {profile.streakCurrent === 0
              ? `Oefen vandaag om een nieuwe reeks te beginnen.${profile.streakLongest > 0 ? ` Je record: ${profile.streakLongest}.` : ""}`
              : profile.streakLongest > profile.streakCurrent
                ? `Je record: ${profile.streakLongest} dagen.`
                : "Dit is je langste reeks tot nu toe."}
          </p>
        </div>

        {/* ═══ Drie cijfers, elk met een lijntje dat laat zien waar het heen gaat. ═══ */}
        <div className="card flex flex-col p-5 lg:col-span-2" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="eyebrow">Goed</p>
          <p className="mt-1.5 leading-none">
            {started ? <CountUp value={Math.round(accuracy.accuracy * 100)} suffix="%" className="num text-[36px]" /> : <span className="num text-[36px]">—</span>}
          </p>
          {/* Alleen dagen waarop je echt oefende: een dag zonder antwoorden is
              geen 0% goed, maar geen meting. */}
          {practiced.length >= 2 ? (
            <div className="mt-auto pt-3">
              <Sparkline data={practiced} tone="var(--color-good)" height={30} />
            </div>
          ) : (
            <div className="mt-auto" />
          )}
          <p className="mt-1.5 text-[12.5px] text-ink-muted">
            {started ? `over ${accuracy.total} antwoorden` : "nog geen antwoorden"}
          </p>
        </div>

        <div className="card flex flex-col p-5 lg:col-span-2" style={{ "--i": 3 } as React.CSSProperties}>
          <p className="eyebrow">Woorden</p>
          <p className="mt-1.5 leading-none">
            <CountUp value={vocab.seen} className="num text-[36px]" />
            <span className="ml-1 text-[14px] font-semibold text-ink-muted">/ {vocab.total}</span>
          </p>
          <div className="mt-auto pt-4">
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className="animate-grow-x h-full origin-left rounded-full bg-gradient-to-r from-[#6aeadb] to-[#12b0a0]"
                style={{ width: `${vocab.total ? Math.max(2, (vocab.seen / vocab.total) * 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-muted">{vocab.solid} stevig in je geheugen</p>
        </div>

        <div className="card col-span-2 flex flex-col p-5 lg:col-span-2" style={{ "--i": 4 } as React.CSSProperties}>
          <p className="eyebrow">Niveau</p>
          <p className="mt-1.5 leading-none">
            <span className="num text-[36px]">{rank.code}</span>
            <span className="ml-1.5 text-[14px] font-semibold text-ink-muted">{rank.label}</span>
          </p>
          <div className="mt-auto pt-4">
            <div className="h-2 overflow-hidden rounded-full bg-sunken">
              <div
                className="animate-grow-x h-full origin-left rounded-full bg-gradient-to-r from-[#a99bff] to-[#5e5ce6]"
                style={{
                  width: `${Math.min(100, Math.max(((profile.xp - rank.from) / ((rank.to ?? profile.xp) - rank.from || 1)) * 100, profile.xp > rank.from ? 2 : 0))}%`,
                }}
              />
            </div>
          </div>
          <p className="mt-2 text-[12.5px] text-ink-muted">
            {next ? `nog ${Math.max(0, next.from - profile.xp).toLocaleString("nl-NL")} XP tot ${next.code}` : "hoogste rang"}
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
