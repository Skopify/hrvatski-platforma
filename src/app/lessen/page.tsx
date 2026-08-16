import Link from "next/link";

import { CaseTimeline } from "@/components/CaseTimeline";
import { Page, PageHeader, Pill } from "@/components/ui";
import { loadLessons, loadSyllabus } from "@/lib/content";
import { lessonStatuses } from "@/lib/stats";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  done: "Afgerond",
  in_progress: "Bezig",
  available: "Open",
  locked: "Nog dicht",
};

/** De vier niveaubanden waarin de cursus uiteenvalt, in volgorde van de bron. */
const BANDS: { cefr: string; title: string; blurb: string }[] = [
  {
    cefr: "A1.1",
    title: "Eerste woorden",
    blurb: "Klanken, groeten, jezelf voorstellen. De accusatief maakt hier je eerste echte zin.",
  },
  {
    cefr: "A1.2",
    title: "Basiszinnen",
    blurb: "Wonen, eten, de klok. De locatief en de datief komen erbij — plaats en richting.",
  },
  {
    cefr: "A2.1",
    title: "Naamvallen in gebruik",
    blurb: "Genitief en instrumentalis. Nu heb je alle zeven, en gaat het om kiezen.",
  },
  {
    cefr: "A2.2",
    title: "Zelfstandig",
    blurb: "Verleden en toekomst, bevelen, aanspreken. Verhalen vertellen in plaats van zinnen bouwen.",
  },
];

export default function LessonsPage() {
  const syllabus = loadSyllabus();
  const built = new Set(loadLessons().map((l) => l.number));
  const statuses = new Map(lessonStatuses().map((s) => [s.lesson, s.status]));

  // Sleutels die met $ beginnen zijn redactionele notities in de JSON, geen data.
  const cases = Object.entries(syllabus.case_introduction_order)
    .filter(([key]) => !key.startsWith("$"))
    .map(([name, info]) => ({ name, lesson: info.lesson, note: info.note }))
    .sort((a, b) => a.lesson - b.lesson);

  const doneCount = [...statuses.values()].filter((s) => s === "done").length;
  const current =
    syllabus.lessons.find((l) => statuses.get(l.number) === "in_progress")?.number ??
    syllabus.lessons.find((l) => statuses.get(l.number) === "available")?.number ??
    0;

  return (
    <Page>
      <PageHeader
        title="Lessen"
        intro="Eenentwintig eenheden, van het alfabet tot de vocatief. De naamvallen komen in de volgorde van het boek — niet alfabetisch, maar op het moment dat je ze nodig hebt om iets te kunnen zeggen."
      />

      {/* De boog van de cursus in één beeld: waar elke naamval binnenkomt. */}
      <section className="mb-10">
        <CaseTimeline cases={cases} total={syllabus.lessons.length - 1} current={current} />
      </section>

      {/* Per niveauband, zodat de 21 eenheden een vorm hebben in plaats van een lijst. */}
      <div className="space-y-11">
        {BANDS.map((band) => {
          const inBand = syllabus.lessons.filter((l) => l.cefr === band.cefr);
          if (inBand.length === 0) return null;
          const bandDone = inBand.filter((l) => statuses.get(l.number) === "done").length;

          return (
            <section key={band.cefr}>
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5">
                    <Pill tone="accent">{band.cefr}</Pill>
                    <h2 className="display-soft text-[21px] text-ink">{band.title}</h2>
                  </div>
                  <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-ink-secondary">
                    {band.blurb}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-[13px] font-bold text-ink">
                    {bandDone}/{inBand.length}
                  </p>
                  <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full bg-accent transition-[width] duration-700"
                      style={{ width: `${(bandDone / inBand.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <ul className="stagger grid gap-3 sm:grid-cols-2">
                {inBand.map((lesson, i) => {
                  const isBuilt = built.has(lesson.number);
                  const status = statuses.get(lesson.number) ?? "locked";
                  const openable = isBuilt && status !== "locked";
                  const caseHere = cases.find((c) => c.lesson === lesson.number);

                  const inner = (
                    <div
                      className={`card h-full px-5 py-4 ${openable ? "card-lift" : "opacity-70"}`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* De knoop: gevuld als het af is, ring als het openstaat,
                            gestippeld als het nog dicht zit. */}
                        <span
                          className={`tabular mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                            status === "done"
                              ? "bg-accent text-white"
                              : status === "in_progress"
                                ? "border-2 border-accent bg-accent-wash text-accent"
                                : openable
                                  ? "border border-line-strong bg-surface text-ink-secondary"
                                  : "border border-dashed border-line-strong bg-sunken text-ink-muted"
                          }`}
                        >
                          {status === "done" ? (
                            <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
                              <path
                                d="M3 8.4 6.2 11.6 13 4.8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            String(lesson.number).padStart(2, "0")
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <p
                              className={`hr-text truncate text-[15.5px] font-bold ${
                                openable ? "text-ink" : "text-ink-secondary"
                              }`}
                            >
                              {lesson.title_hr}
                            </p>
                            <span
                              className={`shrink-0 text-[11.5px] font-semibold ${
                                status === "done"
                                  ? "text-good-ink"
                                  : status === "in_progress"
                                    ? "text-accent"
                                    : "text-ink-muted"
                              }`}
                            >
                              {isBuilt ? STATUS_LABEL[status] : "Volgt"}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">
                            {lesson.title_nl}
                          </p>

                          <div className="mt-2.5 flex flex-wrap gap-1.5">
                            {caseHere ? (
                              <Pill tone="gold" className="capitalize">
                                ★ {caseHere.name}
                              </Pill>
                            ) : null}
                            {(lesson.grammar ?? []).slice(0, caseHere ? 1 : 2).map((g) => (
                              <span
                                key={g}
                                className="truncate rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-secondary"
                              >
                                {g}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );

                  return (
                    <li key={lesson.number} style={{ "--i": i } as React.CSSProperties}>
                      {openable ? (
                        <Link href={`/lessen/${lesson.number}`} className="block h-full">
                          {inner}
                        </Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-10 text-[12.5px] leading-relaxed text-ink-muted">
        {doneCount} van {syllabus.lessons.length} eenheden afgerond. Lessen gaan pas open als
        de vorige af is: de accusatief in les 5 leunt op het geslacht en de levendheid uit
        de lessen daarvoor.
      </p>
    </Page>
  );
}
