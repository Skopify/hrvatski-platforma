import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, Pill } from "@/components/ui";
import { loadLesson, type Paradigm } from "@/lib/content";
import { lessonStatuses } from "@/lib/stats";

export const dynamic = "force-dynamic";

function ParadigmTable({ paradigm }: { paradigm: Paradigm }) {
  return (
    <div className="thin-scroll mt-4 overflow-x-auto rounded-2xl border border-line bg-plane/60 p-1">
      <table className="w-full border-collapse text-[13.5px]">
        <caption className="px-3 pb-2 pt-2.5 text-left text-[12px] text-ink-muted">
          {paradigm.caption_nl}
        </caption>
        <thead>
          <tr>
            <th className="w-14 py-2 pl-3 pr-3 text-left font-medium text-ink-muted" />
            {paradigm.columns.map((c) => (
              <th
                key={c}
                className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Labels mogen herhalen (twee rijen 'muški'), dus de index is hier de sleutel. */}
          {paradigm.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="odd:bg-surface">
              <td className="rounded-l-lg py-2.5 pl-3 pr-3 text-[12px] font-medium text-ink-muted">
                {row.label}
              </td>
              {row.cells.map((cell, i) => (
                <td
                  key={i}
                  className="hr-text px-3 py-2.5 font-medium text-ink last:rounded-r-lg"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const POS_LABEL: Record<string, string> = {
  noun: "zelfstandig naamwoord",
  verb: "werkwoord",
  adj: "bijvoeglijk naamwoord",
  adv: "bijwoord",
  pron: "voornaamwoord",
  prep: "voorzetsel",
  num: "telwoord",
  phrase: "uitdrukking",
  interj: "tussenwerpsel",
  conj: "voegwoord",
};

export default async function LessonPage({
  params,
}: {
  params: Promise<{ nummer: string }>;
}) {
  const { nummer } = await params;
  const lesson = loadLesson(Number(nummer));
  if (!lesson) notFound();

  const status = lessonStatuses().find((s) => s.lesson === lesson.number)?.status ?? "available";
  const exerciseCount = lesson.sections.reduce(
    (n, s) => n + s.exercises.filter((e) => e.type !== "teaching_moment").length,
    0,
  );
  const nouns = lesson.vocab.filter((v) => v.pos === "noun");
  const phrases = lesson.vocab.filter((v) => v.pos === "phrase");
  const rest = lesson.vocab.filter((v) => v.pos !== "noun" && v.pos !== "phrase");

  return (
    <Page width="detail">
      <Link
        href="/lessen"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-accent"
      >
        <span aria-hidden>←</span> Lessen
      </Link>

      {/* Kop. Het nummer staat in een massief blok naast de titel — een vaste
          bladwijzer, geen decoratie. */}
      <header className="card animate-rise mt-4 mb-9 px-6 py-7 sm:px-8">
        <div className="flex items-start gap-5">
          <span
            aria-hidden
            className="display flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-accent text-[20px] text-white"
          >
            {String(lesson.number).padStart(2, "0")}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone="accent">{lesson.cefr}</Pill>
              <span className="text-[12px] text-ink-muted">Eenheid {lesson.number}</span>
              {status === "done" ? <Pill tone="good">Afgerond</Pill> : null}
              {status === "in_progress" ? <Pill tone="gold">Bezig</Pill> : null}
            </div>

            <h1 className="hr-text display mt-3 text-[34px] text-ink sm:text-[40px]">
              {lesson.title_hr}
            </h1>
            <p className="mt-1.5 text-[15px] text-ink-secondary">{lesson.title_nl}</p>
          </div>
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line-soft pt-5">
          <Link
            href={`/lessen/${lesson.number}/sessie`}
            className="btn btn-primary px-6 py-3 text-[14.5px]"
          >
            {status === "done" ? "Nog een keer" : status === "in_progress" ? "Hervatten" : "Start les"}
          </Link>
          <span className="tabular text-[12.5px] text-ink-muted">
            {exerciseCount} oefeningen · {lesson.vocab.length} woorden ·{" "}
            {lesson.grammar.length} grammaticapunten
          </span>
        </div>
      </header>

      {/* Leerdoelen */}
      <section className="mb-10">
        <h2 className="display-soft mb-4 text-[20px] text-ink">Na deze les kun je</h2>
        <ul className="stagger grid gap-2.5">
          {lesson.can_do_nl.map((c, i) => (
            <li
              key={c}
              style={{ "--i": i } as React.CSSProperties}
              className="flex gap-3 rounded-2xl border border-line bg-surface px-4 py-3"
            >
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-wash text-accent"
                aria-hidden
              >
                <svg width="11" height="11" viewBox="0 0 16 16">
                  <path
                    d="M3 8.4 6.2 11.6 13 4.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[13.5px] leading-relaxed text-ink-secondary">{c}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Grammatica */}
      <section className="mb-10">
        <h2 className="display-soft mb-4 text-[20px] text-ink">Grammatica</h2>
        <div className="space-y-4">
          {lesson.grammar.map((g) => (
            <article key={g.id} className="card px-6 py-6">
              <h3 className="hr-text text-[16px] font-bold text-ink">{g.title_nl}</h3>
              <p className="mt-2.5 text-[13.5px] leading-[1.72] text-ink-secondary">
                {g.explanation_nl}
              </p>

              {g.contrast_nl ? (
                <div className="mt-4 overflow-hidden rounded-2xl bg-accent-wash px-4 py-3.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-accent">
                    Tegenover het Nederlands
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                    {g.contrast_nl}
                  </p>
                </div>
              ) : null}

              {g.paradigm ? <ParadigmTable paradigm={g.paradigm} /> : null}

              {g.pitfalls_nl?.length ? (
                <div className="mt-5 rounded-2xl bg-warn-wash px-4 py-3.5">
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-warn">
                    Valkuilen
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {g.pitfalls_nl.map((p) => (
                      <li
                        key={p}
                        className="flex gap-2.5 text-[13px] leading-relaxed text-ink-secondary"
                      >
                        <span className="mt-[1px] shrink-0 font-bold text-warn" aria-hidden>
                          !
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {g.source ? (
                <p className="mt-4 text-[11.5px] text-ink-muted">Bron: {g.source}</p>
              ) : null}
            </article>
          ))}
        </div>
      </section>

      {/* Woordenschat */}
      <section className="mb-10">
        <h2 className="display-soft mb-4 text-[20px] text-ink">Woordenschat</h2>

        {phrases.length > 0 ? (
          <div className="card mb-4 px-6 py-5">
            <h3 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              Uitdrukkingen
            </h3>
            <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {phrases.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="hr-text font-medium text-ink">{v.hr}</span>
                  <span className="shrink-0 text-right text-ink-muted">{v.nl}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {nouns.length > 0 ? (
          <div className="card mb-4 px-6 py-5">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              Zelfstandige naamwoorden
            </h3>
            <p className="mb-4 mt-1.5 text-[12px] leading-relaxed text-ink-muted">
              Het geslacht en de genitief staan erbij omdat ze samen de hele verbuiging
              vastleggen — een woord zonder die twee moet je later opnieuw leren.
            </p>
            <div className="thin-scroll overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="text-[10.5px] uppercase tracking-[0.06em] text-ink-muted">
                    <th className="border-b border-line py-2 text-left font-bold">Kroatisch</th>
                    <th className="border-b border-line py-2 text-left font-bold">Nederlands</th>
                    <th className="border-b border-line py-2 text-left font-bold">Geslacht</th>
                    <th className="border-b border-line py-2 text-left font-bold">Genitief</th>
                    <th className="border-b border-line py-2 text-left font-bold">Meervoud</th>
                  </tr>
                </thead>
                <tbody>
                  {nouns.map((v) => (
                    <tr key={v.id} className="transition-colors hover:bg-accent-wash/50">
                      <td className="hr-text border-b border-line-soft py-2.5 font-bold text-ink">
                        {v.hr}
                      </td>
                      <td className="border-b border-line-soft py-2.5 text-ink-secondary">{v.nl}</td>
                      <td className="border-b border-line-soft py-2.5 text-ink-muted">
                        {v.gender === "m" ? "m." : v.gender === "f" ? "v." : "o."}
                        {v.animacy === "animate" ? " · levend" : ""}
                      </td>
                      <td className="hr-text border-b border-line-soft py-2.5 text-ink-secondary">
                        {v.gen_sg ?? "—"}
                      </td>
                      <td className="hr-text border-b border-line-soft py-2.5 text-ink-secondary">
                        {v.nom_pl ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {rest.length > 0 ? (
          <div className="card px-6 py-5">
            <h3 className="mb-3.5 text-[11px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              Overige woorden
            </h3>
            <ul className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              {rest.map((v) => (
                <li key={v.id} className="flex items-baseline justify-between gap-3 text-[13.5px]">
                  <span className="hr-text font-medium text-ink">
                    {v.hr}
                    {v.present_1sg ? (
                      <span className="ml-1.5 font-normal text-ink-muted">({v.present_1sg})</span>
                    ) : null}
                  </span>
                  <span
                    className="shrink-0 text-right text-ink-muted"
                    title={POS_LABEL[v.pos] ?? v.pos}
                  >
                    {v.nl}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <p className="text-[12px] text-ink-muted">
        Bron: udžbenik p. {lesson.source.udzbenik_pages}, vježbenica p.{" "}
        {lesson.source.vjezbenica_pages}.
      </p>
    </Page>
  );
}
