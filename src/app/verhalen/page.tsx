import Link from "next/link";

import { Page, PageHeader, Pill } from "@/components/ui";
import { loadStories, storyMinutes, storyWordCount } from "@/lib/content";
import { allCoverage, verdictOf, VERDICT_TEXT, type CoverageVerdict } from "@/lib/coverage";
import { highestActiveLesson, storyStatuses } from "@/lib/stats";

export const dynamic = "force-dynamic";

/* Eén plat motieficoon per verhaal — 22px, één lijndikte. */
const MOTIFS: Record<string, React.ReactNode> = {
  obitelj: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3.5 20c0-3.3 2.2-5.5 5-5.5s5 2.2 5 5.5" />
      <circle cx="16.5" cy="9.5" r="2.4" />
      <path d="M14.5 20c.3-2.8 2-4.4 4.2-4.4 1 0 1.9.3 2.6.9" />
    </>
  ),
  trznica: (
    <>
      <path d="M4 9.5 5.2 4h13.6L20 9.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  izlet: (
    <>
      <circle cx="16.5" cy="7" r="2.8" />
      <path d="M2.5 19.5 8 11l4.2 6.3L15 14l6 5.5" />
    </>
  ),
  knjiga: (
    <>
      <path d="M4.5 4.5h11a2 2 0 0 1 2 2v13H6.5a2 2 0 0 1-2-2v-13Z" />
      <path d="M17.5 15.5h2v4h-2" />
      <path d="M8 9h6M8 12.5h6" />
    </>
  ),
  more: (
    <>
      <path d="M3 14c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0" />
      <path d="M3 18.5c1.5-1.6 3-1.6 4.5 0s3 1.6 4.5 0 3-1.6 4.5 0 3 1.6 4.5 0" />
      <path d="M12 10V4l4.5 3.2L12 9" />
    </>
  ),
};

/** Kleur en label per dekkingsoordeel — de meter moet in één blik te lezen zijn. */
const VERDICT_STYLE: Record<CoverageVerdict, { tone: string; bar: string }> = {
  ideaal: { tone: "text-good-ink", bar: "var(--color-good)" },
  goed: { tone: "text-accent", bar: "var(--color-accent)" },
  pittig: { tone: "text-gold", bar: "var(--color-gold-bright)" },
  hoog: { tone: "text-bad-ink", bar: "var(--color-bad)" },
};

export default function StoriesPage() {
  const stories = loadStories();
  const statuses = storyStatuses();
  const level = highestActiveLesson();
  const coverage = allCoverage();

  return (
    <Page>
      <PageHeader
        title="Verhalen"
        intro="Doorlopende tekst is waar een taal echt begint: woorden die je in een verhaal tegenkomt, onthoud je anders dan woorden uit een lijstje. Elk verhaal is geschreven binnen de grammatica van een lespunt — tik een woord aan en je ziet niet alleen wat het betekent, maar ook welke vorm het is."
      />

      <ul className="stagger space-y-4">
        {stories.map((story, i) => {
          const st = statuses.get(story.slug);
          const words = storyWordCount(story);
          const minutes = storyMinutes(story);
          const onLevel = level >= story.requires_lesson;
          const cov = coverage.get(story.slug);
          const verdict = cov ? verdictOf(cov.coverage) : null;

          return (
            <li key={story.slug} style={{ "--i": i } as React.CSSProperties}>
              <Link href={`/verhalen/${story.slug}`} className="block">
                <article className="card card-lift px-6 py-5">
                  <div className="flex items-start gap-5">
                    {/* Motiefblok: plat accentvlak met lijnicoon. */}
                    <span
                      aria-hidden
                      className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                        onLevel ? "bg-accent text-white" : "bg-sunken text-ink-muted"
                      }`}
                    >
                      <svg
                        width="22"
                        height="22"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        {MOTIFS[story.motif] ?? MOTIFS.izlet}
                      </svg>
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {story.series ? (
                          <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-accent">
                            {story.series} · {String(story.part).padStart(2, "0")}
                          </span>
                        ) : null}
                        <Pill>{story.cefr}</Pill>
                        {st?.quizDoneAt ? (
                          <Pill tone="good">✓ Afgerond</Pill>
                        ) : st?.readAt ? (
                          <Pill tone="gold">Gelezen — vragen nog niet</Pill>
                        ) : null}
                      </div>

                      <h2 className="hr-text display-soft mt-2 text-[22px] text-ink">
                        {story.title_hr}
                        <span className="ml-2.5 font-sans text-[13px] font-normal text-ink-muted">
                          {story.title_nl}
                        </span>
                      </h2>

                      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">
                        {story.blurb_nl}
                      </p>

                      {/* De dekkingsmeter: welk deel van deze tekst je al kent. */}
                      {cov && verdict ? (
                        <div className="mt-3.5 max-w-md">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[11.5px] font-semibold text-ink-secondary">
                              Woorddekking
                            </span>
                            <span
                              className={`tabular text-[12.5px] font-bold ${VERDICT_STYLE[verdict].tone}`}
                            >
                              {Math.round(cov.coverage * 100)}%
                            </span>
                          </div>
                          <div className="relative mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                            <div
                              className="h-full rounded-full transition-[width] duration-700"
                              style={{
                                width: `${Math.max(cov.coverage * 100, 3)}%`,
                                background: VERDICT_STYLE[verdict].bar,
                              }}
                            />
                            {/* De 95%-drempel van Hu & Nation, als streepje in de balk. */}
                            <span
                              aria-hidden
                              title="95% — de grens voor vlot lezen"
                              className="absolute top-0 h-full w-px bg-ink-muted/50"
                              style={{ left: "95%" }}
                            />
                          </div>
                          <p className="mt-1.5 text-[11.5px] leading-snug text-ink-muted">
                            {VERDICT_TEXT[verdict]}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <span className="tabular text-[12px] text-ink-muted">
                          ± {minutes} min · {words} woorden
                        </span>
                        {(story.comprehension?.length ?? 0) + story.exercises.length > 0 ? (
                          <span className="tabular text-[12px] font-semibold text-accent">
                            {(story.comprehension?.length ?? 0) + story.exercises.length} vragen
                          </span>
                        ) : null}
                        <span className="text-[12px] text-ink-muted" aria-hidden>
                          ·
                        </span>
                        <span className="text-[12px] text-ink-muted">
                          {onLevel ? "Op jouw niveau" : `Op niveau na les ${story.requires_lesson}`}
                        </span>
                        <span className="hidden flex-wrap gap-1.5 sm:flex">
                          {story.focus_nl.slice(0, 3).map((f) => (
                            <span
                              key={f}
                              className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-ink-secondary"
                            >
                              {f}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>

                    <span
                      aria-hidden
                      className="mt-2 hidden shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 sm:block"
                    >
                      →
                    </span>
                  </div>
                </article>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-9 text-[12.5px] leading-relaxed text-ink-muted">
        Verhalen boven je niveau zijn niet op slot — maar verwacht dat je er meer in moet
        opzoeken. Opgezochte woorden kun je met één tik in je herhaling zetten.
      </p>
    </Page>
  );
}
