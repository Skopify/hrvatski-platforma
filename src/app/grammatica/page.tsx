import Link from "next/link";

import { Page, PageHeader } from "@/components/ui";
import { modulesByBand, moduleExercises } from "@/lib/modules";

export const dynamic = "force-dynamic";

/** Wat elke band betekent, in gewone taal. */
const BAND_UITLEG: Record<string, string> = {
  Beginnen: "De regels die je in elke zin nodig hebt. Hier hoef je nog niets voor te kennen.",
  Opbouwen: "Praten over gisteren, morgen en wat af is. Deze bouwen op elkaar voort.",
  Verfijnen: "Het verschil tussen begrijpelijk en goed. Doe deze als de rest zit.",
};

export default function GrammaticaPage() {
  const banden = modulesByBand();

  return (
    <Page>
      <PageHeader
        title="Grammatica"
        intro="Eén punt per module, altijd langs dezelfde weg: eerst kijken, dan de regel, dan de betekenis kiezen, dan zelf invullen, dan door elkaar, en tot slot in een verhaaltje. De derde stap is degene die in cursussen meestal ontbreekt — en juist daar valt het kwartje."
      />

      {/* Van makkelijk naar moeilijk, met respect voor wat je eerst moet kennen. */}
      {banden.map(({ band, modules }) => (
        <section key={band} className="mb-10 last:mb-0">
          <div className="mb-3">
            <h2 className="text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
              {band}
            </h2>
            {BAND_UITLEG[band] ? (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
                {BAND_UITLEG[band]}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            {modules.map((m) => (
              <Link
                key={m.code}
                href={`/grammatica/${m.code.toLowerCase()}`}
                className="rounded-card group border border-line bg-surface px-5 py-5 transition-all duration-200 hover:-translate-y-px hover:border-accent-ring hover:bg-accent-wash"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="hr-text text-[19px] font-semibold text-ink">{m.title_hr}</p>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tabular text-[12px] font-bold text-accent">{m.rank}</span>
                    <span className="pill bg-sunken text-ink-secondary">{m.cefr}</span>
                  </span>
                </div>
                <p className="mt-1 text-[15px] font-bold text-ink">{m.title_nl}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  {m.blurb_nl}
                </p>
                <p className="mt-3 text-[12px] text-ink-muted">
                  {m.phases.length} stappen · {moduleExercises(m).length} opgaven
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
