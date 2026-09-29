import Link from "next/link";

import { Doodle, type DoodleName } from "@/components/doodles";
import { Page, PageHeader, Pill } from "@/components/ui";
import { opdrachtenMetStand, SOORT_LABEL, type Soort } from "@/lib/schrijven";

export const dynamic = "force-dynamic";

/* Elke soort opdracht heeft zijn eigen krabbel (doodles.tsx). */
const SOORT_DOODLE: Record<Soort, DoodleName> = {
  zinnen: "zinnen",
  tekst: "tekst",
  bericht: "bericht",
  verhaal: "book",
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
          <p className="pill mt-5 gap-3 bg-pop-yellow px-4 py-1 text-[14px] text-on-pop">
            <span>{af} afgerond</span>
            {bezig ? (
              <>
                <span className="text-line-strong">·</span>
                <span>{bezig} onderhanden</span>
              </>
            ) : null}
            <span className="text-line-strong">·</span>
            <span>{opdrachten.length} in totaal</span>
          </p>
        ) : null}
      </PageHeader>

      {[...banden.entries()].map(([niveau, lijst]) => (
        <section key={niveau} className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="display-soft rounded-lg border-2 border-outline bg-pop-pink px-3 py-0.5 text-[17px] text-on-pop">
              {niveau}
            </h2>
            <span className="h-0.5 flex-1 border-t-2 border-dashed border-line-strong" />
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
                          className={`mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-tile border-2 border-outline ${
                            o.werk?.klaar
                              ? "bg-pop-mint shadow-[3px_3px_0_var(--color-outline)]"
                              : o.werk
                                ? "bg-pop-yellow shadow-[3px_3px_0_var(--color-outline)]"
                                : "bg-sunken"
                          } ${i % 2 ? "rotate-2" : "-rotate-2"}`}
                        >
                          <Doodle
                            name={SOORT_DOODLE[o.soort]}
                            size={34}
                            color={o.werk ? "#ffffff" : "var(--color-line-strong)"}
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="hand text-[13.5px] font-bold text-accent">
                              {SOORT_LABEL[o.soort]} · {String(o.rank).padStart(2, "0")}
                            </span>
                            <Pill>{o.niveau}</Pill>
                            {o.werk?.klaar ? (
                              <Pill tone="mint">✓ Afgerond</Pill>
                            ) : o.werk ? (
                              <Pill tone="yellow">Onderhanden</Pill>
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
                              <span className="hand text-[13px] font-bold text-ink-secondary">
                                {geschreven ? "Jouw tekst" : "Streeflengte"}
                              </span>
                              <span className="tabular text-[13px] font-bold text-ink-secondary">
                                {geschreven ? `${geschreven} / ` : ""}
                                {o.streef_woorden} woorden
                              </span>
                            </div>
                            <div className="mt-1.5 h-3.5 w-full overflow-hidden rounded-full border-2 border-outline bg-surface">
                              <div
                                className="h-full rounded-full border-r-2 border-outline bg-pop-pink animate-grow-x origin-left"
                                style={{ width: `${deel * 100}%` }}
                              />
                            </div>
                          </div>

                          <div className="hand mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] font-semibold text-ink-muted">
                            <span>past bij les {o.requires_lesson}</span>
                            {o.vraagt_nl.map((t) => (
                              <span
                                key={t}
                                className="rounded-full border-[1.5px] border-outline bg-surface px-2.5 py-0.5 text-[13px] font-semibold text-ink-secondary"
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
