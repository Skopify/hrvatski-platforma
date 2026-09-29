import Link from "next/link";

import { Doodle, SHAPES, type DoodleName } from "@/components/doodles";
import { Page, PageHeader, Pill } from "@/components/ui";
import { loadStories, storyMinutes, storyWordCount } from "@/lib/content";
import {
  allCoverage,
  verdictOf,
  VERDICT_TEXT,
  type CoverageVerdict,
} from "@/lib/coverage";
import { highestActiveLesson, storyStatuses } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Kleur en label per dekkingsoordeel — de meter moet in één blik te lezen zijn. */
const VERDICT_STYLE: Record<CoverageVerdict, { tone: string; bar: string }> = {
  ideaal: { tone: "text-good-ink", bar: "var(--color-good)" },
  goed: { tone: "text-accent", bar: "var(--color-accent-fill)" },
  pittig: { tone: "text-gold", bar: "var(--color-gold-bright)" },
  // Boven je niveau is een waarschuwing, geen fout: oranje, geen rood.
  hoog: { tone: "text-warm", bar: "var(--color-warm-bright)" },
};

/** De volgorde van de niveaus, zodat A1.1 boven B1 staat en niet andersom. */
const BANDEN = ["A1.1", "A1.2", "A2.1", "A2.2", "B1", "B2"];

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

      {BANDEN.filter((band) => stories.some((s) => s.cefr === band)).map(
        (band) => {
          const inBand = stories.filter((s) => s.cefr === band);
          const gelezen = inBand.filter(
            (s) => statuses.get(s.slug)?.quizDoneAt,
          ).length;

          return (
            <section key={band} className="mb-8">
              <div className="mb-3 flex items-center gap-3">
                <h2 className="display rounded-lg border-2 border-outline bg-pop-peach px-3 py-0.5 text-[17px] text-on-pop">
                  {band}
                </h2>
                <span className="h-0.5 flex-1 border-t-2 border-dashed border-line-strong" />
                <span className="hand text-[13.5px] font-semibold text-ink-muted">
                  {gelezen} van {inBand.length} afgerond
                </span>
              </div>

              <ul className="stagger space-y-4">
                {inBand.map((story, i) => {
                  const st = statuses.get(story.slug);
                  const words = storyWordCount(story);
                  const minutes = storyMinutes(story);
                  const onLevel = level >= story.requires_lesson;
                  const cov = coverage.get(story.slug);
                  const verdict = cov ? verdictOf(cov.coverage) : null;

                  return (
                    <li
                      key={story.slug}
                      style={{ "--i": i } as React.CSSProperties}
                    >
                      <Link href={`/verhalen/${story.slug}`} className="block">
                        <article className="card card-lift px-6 py-5">
                          <div className="flex items-start gap-5">
                            {/* Motief: een sticker met een krabbel. Boven je niveau is hij grijs. */}
                            <span
                              aria-hidden
                              className={`mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-tile border-2 border-outline ${
                                onLevel ? "bg-pop-peach shadow-[3px_3px_0_var(--color-outline)]" : "bg-sunken"
                              } ${i % 2 ? "rotate-2" : "-rotate-2"}`}
                            >
                              <Doodle
                                name={(story.motif in SHAPES ? story.motif : "izlet") as DoodleName}
                                size={34}
                                color={onLevel ? "#ffffff" : "var(--color-line-strong)"}
                              />
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                {story.series ? (
                                  <span className="hand text-[13.5px] font-bold text-accent">
                                    {story.series} ·{" "}
                                    {String(story.part).padStart(2, "0")}
                                  </span>
                                ) : null}
                                <Pill>{story.cefr}</Pill>
                                {st?.quizDoneAt ? (
                                  <Pill tone="mint">✓ Afgerond</Pill>
                                ) : st?.readAt ? (
                                  <Pill tone="yellow">
                                    Gelezen — vragen nog niet
                                  </Pill>
                                ) : null}
                              </div>

                              <h2 className="hr-text display mt-2 text-[22px] text-ink">
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
                                    <span className="hand text-[13px] font-bold text-ink-secondary">
                                      Woorddekking
                                    </span>
                                    <span
                                      className={`tabular text-[13px] font-bold ${VERDICT_STYLE[verdict].tone}`}
                                    >
                                      {Math.round(cov.coverage * 100)}%
                                    </span>
                                  </div>
                                  <div className="relative mt-1.5 h-3.5 w-full overflow-hidden rounded-full border-2 border-outline bg-surface">
                                    <div
                                      className="animate-grow-x h-full origin-left rounded-full"
                                      style={{
                                        width: `${Math.max(cov.coverage * 100, 3)}%`,
                                        background: VERDICT_STYLE[verdict].bar,
                                      }}
                                    />
                                    {/* De 95%-drempel van Hu & Nation, als streepje in de balk. */}
                                    <span
                                      aria-hidden
                                      title="95% — de grens voor vlot lezen"
                                      className="absolute top-0 h-full w-0.5 bg-outline"
                                      style={{ left: "95%" }}
                                    />
                                  </div>
                                  <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">
                                    {VERDICT_TEXT[verdict]}
                                  </p>
                                </div>
                              ) : null}

                              <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-2">
                                <span className="tabular text-[13px] text-ink-muted">
                                  ± {minutes} min · {words} woorden
                                </span>
                                {(story.comprehension?.length ?? 0) +
                                  story.exercises.length >
                                0 ? (
                                  <span className="tabular text-[13px] font-semibold text-accent">
                                    {(story.comprehension?.length ?? 0) +
                                      story.exercises.length}{" "}
                                    vragen
                                  </span>
                                ) : null}
                                <span
                                  className="text-[13px] text-ink-muted"
                                  aria-hidden
                                >
                                  ·
                                </span>
                                <span className="text-[13px] text-ink-muted">
                                  {onLevel
                                    ? "Op jouw niveau"
                                    : `Op niveau na les ${story.requires_lesson}`}
                                </span>
                                <span className="hidden flex-wrap gap-1.5 sm:flex">
                                  {story.focus_nl.slice(0, 3).map((f) => (
                                    <span
                                      key={f}
                                      className="rounded-full border-[1.5px] border-outline bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-ink-secondary"
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
            </section>
          );
        },
      )}

      <p className="mt-9 text-[13px] leading-relaxed text-ink-muted">
        Verhalen boven je niveau zijn niet op slot — maar verwacht dat je er
        meer in moet opzoeken. Opgezochte woorden kun je met één tik in je
        herhaling zetten.
      </p>
    </Page>
  );
}
