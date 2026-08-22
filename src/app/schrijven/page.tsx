import Link from "next/link";

import { Page, PageHeader, Pill } from "@/components/ui";
import { opdrachtenMetStand, SOORT_LABEL, type Soort } from "@/lib/schrijven";

export const dynamic = "force-dynamic";

/* Eén plat icoon per soort opdracht — 22px, één lijndikte, net als bij de verhalen. */
const SOORT_ICOON: Record<Soort, React.ReactNode> = {
  zinnen: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h9" />
    </>
  ),
  tekst: (
    <>
      <path d="M6 3.5h9L19.5 8v12.5h-13Z" />
      <path d="M14.5 3.5V8h5" />
      <path d="M9 12.5h7M9 16h5" />
    </>
  ),
  bericht: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
      <path d="m3.8 7 8.2 6 8.2-6" />
    </>
  ),
  verhaal: (
    <>
      <path d="M4 20.5h16" />
      <path d="M15.6 4.1a2 2 0 0 1 2.8 2.8L9 16.4l-3.6.9.9-3.6 9.3-9.6Z" />
    </>
  ),
};

/**
 * De schrijfsectie.
 *
 * Dezelfde vorm als de verhalenlijst — brede rijen met een icoon, een meter en
 * wat de opdracht traint. Dat is geen kwestie van smaak: de eerste versie was
 * een raster van gelijke hokjes, en daarin viel niet te zien dat dit een ladder
 * is die van drie zinnen naar een eigen verhaal loopt. Een rij kan dat tonen,
 * een hokje niet.
 */
export default function SchrijvenPage() {
  const opdrachten = opdrachtenMetStand();
  const af = opdrachten.filter((o) => o.werk?.klaar).length;
  const bezig = opdrachten.filter((o) => o.werk && !o.werk.klaar).length;

  const banden = new Map<string, typeof opdrachten>();
  for (const o of opdrachten) {
    const lijst = banden.get(o.niveau) ?? [];
    lijst.push(o);
    banden.set(o.niveau, lijst);
  }

  return (
    <Page>
      <PageHeader
        title="Schrijven"
        intro="Van drie zinnen over jezelf tot een eigen hoofdstuk van honderdvijftig woorden. Wat mechanisch vast te stellen is, kijkt het programma na — vergeten dakjes, voorzetsels met de verkeerde naamval, Servische vormen. Of het góéd is beslis je zelf, met een voorbeeld ernaast."
      >
        {af || bezig ? (
          <p className="mt-4 inline-flex items-center gap-3 rounded-full bg-sunken px-4 py-1.5 text-[12.5px] font-semibold text-ink-secondary">
            <span>{af} afgerond</span>
            {bezig ? (
              <>
                <span className="text-line-strong">·</span>
                <span>{bezig} onderhanden</span>
              </>
            ) : null}
            <span className="text-line-strong">·</span>
            <span className="text-ink-muted">{opdrachten.length} in totaal</span>
          </p>
        ) : null}
      </PageHeader>

      {[...banden.entries()].map(([niveau, lijst]) => (
        <section key={niveau} className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="display-soft text-[15px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              {niveau}
            </h2>
            <span className="h-px flex-1 bg-line" />
          </div>

          <ul className="stagger space-y-4">
            {lijst.map((o, i) => {
              const geschreven = o.werk?.woorden ?? 0;
              const deel = Math.min(1, geschreven / o.streef_woorden);

              return (
                <li key={o.id} style={{ "--i": i } as React.CSSProperties}>
                  <Link href={`/schrijven/${o.id}`} className="block">
                    <article className="card card-lift px-6 py-5">
                      <div className="flex items-start gap-5">
                        <span
                          aria-hidden
                          className={`mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                            o.werk?.klaar
                              ? "bg-accent text-white"
                              : o.werk
                                ? "bg-accent-wash text-accent"
                                : "bg-sunken text-ink-muted"
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
                            {SOORT_ICOON[o.soort]}
                          </svg>
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11.5px] font-bold uppercase tracking-[0.06em] text-accent">
                              {SOORT_LABEL[o.soort]} · {String(o.rank).padStart(2, "0")}
                            </span>
                            <Pill>{o.niveau}</Pill>
                            {o.werk?.klaar ? (
                              <Pill tone="good">✓ Afgerond</Pill>
                            ) : o.werk ? (
                              <Pill tone="gold">Onderhanden</Pill>
                            ) : null}
                          </div>

                          <h3 className="display-soft mt-2 text-[21px] leading-snug text-ink">
                            {o.titel_nl}
                          </h3>

                          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">
                            {o.blurb_nl}
                          </p>

                          {/* De meter: hoeveel je geschreven hebt tegenover de streeflengte. */}
                          <div className="mt-3.5 max-w-md">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-[11.5px] font-semibold text-ink-secondary">
                                {geschreven ? "Jouw tekst" : "Streeflengte"}
                              </span>
                              <span className="tabular text-[12.5px] font-bold text-ink-secondary">
                                {geschreven ? `${geschreven} / ` : ""}
                                {o.streef_woorden} woorden
                              </span>
                            </div>
                            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                              <div
                                className="h-full rounded-full bg-accent transition-[width] duration-700"
                                style={{ width: `${deel * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px] text-ink-muted">
                            <span>past bij les {o.requires_lesson}</span>
                            {o.vraagt_nl.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-sunken px-2.5 py-0.5 text-[11.5px] text-ink-secondary"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>

                        <span aria-hidden className="mt-1 hidden shrink-0 text-ink-muted sm:block">
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
      ))}
    </Page>
  );
}
