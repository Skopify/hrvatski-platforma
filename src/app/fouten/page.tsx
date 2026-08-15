import Link from "next/link";

import { Empty, Page, PageHeader, Pill } from "@/components/ui";
import { errorPatterns, mistakeExerciseIds, mistakes } from "@/lib/stats";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = {
  cloze: "invullen",
  translate_nl_hr: "vertalen naar HR",
  translate_hr_nl: "vertalen naar NL",
  word_order: "woordvolgorde",
  listen_type: "luisteren",
  error_correction: "fout verbeteren",
  free_production: "vrij schrijven",
  choice: "meerkeuze",
  match: "koppelen",
  drill_rod: "drill geslacht",
  drill_genitiv: "drill genitief",
  drill_mnozina: "drill meervoud",
  drill_glagol: "drill werkwoorden",
  drill_brojevi: "drill getallen",
  drill_diktat: "dictee",
  drill_padezi: "drill naamvalkeuze",
  drill_oblik: "drill naamvalsvormen",
};

function whenLabel(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "vandaag";
  if (days === 1) return "gisteren";
  if (days < 7) return `${days} dagen geleden`;
  return new Date(ms).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export default function MistakesPage() {
  const all = mistakes(60);
  const wrong = all.filter((m) => !m.nearMiss);
  const near = all.filter((m) => m.nearMiss);
  const patterns = errorPatterns();
  const redoable = mistakeExerciseIds(20).length;

  return (
    <Page>
      <PageHeader
        title="Fouten"
        intro="Alles wat je ooit fout had, teruggehaald uit je eigen antwoorden. Een fout die drie keer terugkomt staat bovenaan — die zegt iets over een patroon, niet over een verschrijving."
      />

      {/* Patronen vóór de lijst: een diagnose is meer waard dan een inventaris. */}
      {patterns.length > 0 ? (
        <section className="mb-10">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="display-soft text-[20px] text-ink">Patronen</h2>
            <span className="text-[12.5px] text-ink-muted">
              Wat er structureel misgaat, niet wat er één keer misging
            </span>
          </div>

          <ul className="stagger space-y-3">
            {patterns.map((p, i) => (
              <li key={p.id} style={{ "--i": i } as React.CSSProperties}>
                <div className="card px-5 py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <h3 className="text-[15.5px] font-bold text-ink">{p.title}</h3>
                    <Pill tone="bad">{p.count}×</Pill>
                  </div>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                    {p.diagnosis}
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">{p.advice}</p>

                  {p.examples.length > 0 ? (
                    <ul className="mt-3.5 flex flex-wrap gap-x-4 gap-y-1.5">
                      {p.examples.map((e, j) => (
                        <li key={j} className="text-[12.5px]">
                          <span className="hr-text text-ink-muted line-through decoration-bad/50">
                            {e.given || "—"}
                          </span>
                          <span aria-hidden className="mx-1.5 text-ink-muted">
                            →
                          </span>
                          <span className="hr-text font-semibold text-ink">{e.expected}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {p.href ? (
                    <Link
                      href={p.href}
                      className="link-sweep mt-3.5 inline-block text-[13px] font-semibold text-accent"
                    >
                      Hier oefenen →
                    </Link>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {all.length === 0 ? (
        <Empty>
          Nog geen fouten om te tonen. Zodra je iets misgaat, verschijnt het hier — met
          wat jij typte naast wat er moest staan.
        </Empty>
      ) : (
        <div className="space-y-10">
          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="display-soft text-[20px] text-ink">Echt fout</h2>
              <span className="tabular text-[12.5px] text-ink-muted">{wrong.length} stuks</span>
            </div>

            {wrong.length === 0 ? (
              <Empty>Niets fout gehad — alleen bijna-goede antwoorden. Sterk.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {wrong.map((m) => (
                  <li key={m.exerciseId} className="card px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone="accent">{m.topic}</Pill>
                      <span className="text-[11.5px] text-ink-muted">
                        {TYPE_LABEL[m.type] ?? m.type}
                      </span>
                      {m.times > 1 ? (
                        <Pill tone="bad">{m.times}× fout</Pill>
                      ) : null}
                      <span className="ml-auto text-[11.5px] text-ink-muted">
                        {whenLabel(m.lastAt)}
                      </span>
                    </div>

                    {m.subject ? (
                      <p className="hr-text reading mt-2.5 text-[16px] leading-snug text-ink">
                        {m.subject}
                      </p>
                    ) : null}

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl bg-bad-wash px-3.5 py-2.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-bad-ink">
                          Jij schreef
                        </p>
                        <p className="hr-text mt-1 text-[15px] text-ink">
                          {m.given || <span className="text-ink-muted">— niets —</span>}
                        </p>
                      </div>
                      <div className="rounded-xl bg-good-wash px-3.5 py-2.5">
                        <p className="text-[10.5px] font-bold uppercase tracking-[0.06em] text-good-ink">
                          Het moest zijn
                        </p>
                        <p className="hr-text mt-1 text-[15px] font-semibold text-ink">
                          {m.expected}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Bijna goed is een ander soort fout en verdient een eigen kop: hier
              wist je het antwoord wel, maar miste je een teken. */}
          {near.length > 0 ? (
            <section>
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <h2 className="display-soft text-[20px] text-ink">Bijna goed</h2>
                  <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-secondary">
                    Je wist het antwoord, maar miste een diakritisch teken of één letter.
                    Deze zijn goedgekeurd — ze staan hier omdat het weglaten van č, ć, š, ž
                    en đ dé structurele fout van een Nederlandstalige is.
                  </p>
                </div>
                <span className="tabular shrink-0 text-[12.5px] text-ink-muted">
                  {near.length} stuks
                </span>
              </div>

              <ul className="space-y-2">
                {near.map((m) => (
                  <li key={m.exerciseId} className="card px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="hr-text text-[15px] text-ink-secondary line-through decoration-bad/50">
                        {m.given}
                      </span>
                      <span aria-hidden className="text-ink-muted">
                        →
                      </span>
                      <span className="hr-text text-[15px] font-semibold text-ink">
                        {m.expected}
                      </span>
                      <span className="ml-auto truncate text-[11.5px] text-ink-muted">
                        {m.subject || m.topic}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      )}

      <div className="mt-10 flex flex-wrap gap-3">
        {redoable > 0 ? (
          <Link href="/fouten/oefenen" className="btn btn-primary px-5 py-2.5 text-[14px]">
            Deze fouten overdoen ({redoable})
          </Link>
        ) : null}
        <Link
          href="/oefenen"
          className={`btn px-5 py-2.5 text-[14px] ${redoable > 0 ? "btn-ghost" : "btn-primary"}`}
        >
          Naar oefenen
        </Link>
        <Link href="/woorden" className="btn btn-ghost px-5 py-2.5 text-[14px]">
          Woorden opzoeken
        </Link>
      </div>
    </Page>
  );
}
