import Link from "next/link";

import { Page, PageHeader } from "@/components/ui";
import { modulesByBand, moduleExercises, moduleStepCount } from "@/lib/modules";
import { hasPlacement, moduleStatuses, STATUS_TEXT, type ModuleStatusValue } from "@/lib/placement";
import { moduleProgressMap } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Wat elke band betekent, in gewone taal. */
const BAND_UITLEG: Record<string, string> = {
  Beginnen: "De regels die je in elke zin nodig hebt. Hier hoef je nog niets voor te kennen.",
  Opbouwen: "Praten over gisteren, morgen en wat af is. Deze bouwen op elkaar voort.",
  Verfijnen: "Het verschil tussen begrijpelijk en goed. Doe deze als de rest zit.",
};

/** Hoe een gemeten status eruitziet. Ongemeten krijgt bewust geen pil. */
const STATUS_STIJL: Record<ModuleStatusValue, string> = {
  beheerst: "bg-good-wash text-good",
  onzeker: "bg-gold-wash text-gold",
  onbekend: "bg-sunken text-ink-secondary",
};

export default function GrammaticaPage() {
  const banden = modulesByBand();
  const statussen = moduleStatuses();
  const voortgang = moduleProgressMap();
  // De banner volgt de uitslagen, niet het bestaan van een afname: wie de toets
  // opent en wegklikt, heeft niets gemeten.
  const gemeten = statussen.size > 0 || hasPlacement();

  return (
    <Page>
      <PageHeader
        title="Grammatica"
        intro="Eén punt per module, altijd langs dezelfde weg: eerst kijken, dan de regel, dan de betekenis kiezen, dan zelf invullen, dan door elkaar, en tot slot in een verhaaltje. De derde stap is degene die in cursussen meestal ontbreekt — en juist daar valt het kwartje."
      />

      {/* Wie de toets nog niet gedaan heeft, ziet hier waarom hij bestaat. Wie hem
          wél deed, ziet per module de uitslag mét teller — een status zonder
          teller belooft meer dan hij waarmaakt. */}
      <div className="rounded-card mb-8 border border-line bg-sunken px-5 py-4">
        {gemeten ? (
          <p className="text-[13.5px] leading-relaxed text-ink-secondary">
            De etiketten hieronder komen uit je antwoorden op de plaatsingstoets, niet uit een
            zelfinschatting. Modules zonder etiket zijn niet gemeten.{" "}
            <Link href="/plaatsingstoets" className="font-semibold text-accent hover:underline">
              Opnieuw meten
            </Link>
          </p>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-ink-secondary">
            Het curriculum loopt van nul tot eind, maar jouw pad hoeft dat niet te doen.{" "}
            <Link href="/plaatsingstoets" className="font-semibold text-accent hover:underline">
              Doe de plaatsingstoets
            </Link>{" "}
            en elke module krijgt een status die uit je antwoorden volgt.
          </p>
        )}
      </div>

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
                    {statussen.get(m.code) ? (
                      <span
                        className={`pill ${STATUS_STIJL[statussen.get(m.code)!.status]}`}
                        title={STATUS_TEXT[statussen.get(m.code)!.status]}
                      >
                        {statussen.get(m.code)!.status} · {statussen.get(m.code)!.correct}/
                        {statussen.get(m.code)!.total}
                      </span>
                    ) : (
                      <span className="pill bg-sunken text-ink-secondary">{m.cefr}</span>
                    )}
                  </span>
                </div>
                <p className="mt-1 text-[15px] font-bold text-ink">{m.title_nl}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                  {m.blurb_nl}
                </p>
                <p className="mt-3 text-[12px] text-ink-muted">
                  {m.phases.length} stappen · {moduleExercises(m).length} opgaven
                  {voortgang.get(m.code) ? (
                    <span className="ml-2 font-semibold text-accent">
                      · begonnen, nog {Math.max(0, moduleStepCount(m) - voortgang.get(m.code)!)}
                    </span>
                  ) : null}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </Page>
  );
}
