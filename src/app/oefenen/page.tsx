import Link from "next/link";

import { Doodle, type DoodleName } from "@/components/doodles";
import { Page, PageHeader, Pill } from "@/components/ui";
import { DRILLS, DRILL_KINDS } from "@/lib/drills";
import { nextReviewableAt, reviewableCount } from "@/lib/planner";
import { drillAvailability, mistakes } from "@/lib/stats";

export const dynamic = "force-dynamic";

function whenLabel(due: Date): string {
  const now = new Date();
  const minutes = Math.round((due.getTime() - now.getTime()) / 60000);
  const time = due.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
  if (minutes < 60) return `over ${Math.max(1, minutes)} minuten (om ${time})`;
  const sameDay = due.toDateString() === now.toDateString();
  if (sameDay) return `vandaag om ${time}`;
  return due.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

/* Elke drill heeft zijn eigen stift; de krabbel zelf staat in doodles.tsx. */
const DRILL_POP = [
  "var(--color-pop-sky)",
  "var(--color-pop-lilac)",
  "var(--color-pop-pink)",
  "var(--color-pop-mint)",
  "var(--color-pop-peach)",
  "var(--color-pop-yellow)",
  "var(--color-pop-lime)",
  "var(--color-pop-coral)",
];
export default function PracticePage() {
  const due = reviewableCount();
  const next = nextReviewableAt();
  const availability = drillAvailability();
  const mistakeCount = mistakes(200).length;

  return (
    <Page>
      <PageHeader
        title="Oefenen"
        intro="Herhaling volgt de planning — eerder herhalen levert nauwelijks iets op. Maar drillen kan altijd: korte, snelle rondes op één vaardigheidje, gevoed door de woorden die je al kent."
      />

      {/* Herhaalstatus — de planning bepaalt of dit een knop of een mededeling is. */}
      <section className="hero mb-10 bg-pop-yellow px-6 py-5 text-on-pop">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="display-soft text-[20px]">
              {due > 0
                ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar`
                : "Niets te herhalen"}
            </p>
            <p className="mt-1 max-w-xl text-[14px] font-medium leading-relaxed">
              {due > 0
                ? "Gemengd door elkaar, met voorrang voor wat je het vaakst mist."
                : next
                  ? `Het eerstvolgende item staat ${whenLabel(next)} op de planning.`
                  : "Er staat niets op de planning. Begin een les of lees een verhaal."}
            </p>
          </div>
          {due > 0 ? (
            <Link href="/oefenen/herhalen" className="btn btn-primary h-12 px-6 text-[15.5px]">
              Start herhaling
              <span className="num rounded-full bg-white px-2 text-[13px] leading-[20px] text-on-pop">{due}</span>
            </Link>
          ) : (
            <Link href="/lessen" className="btn btn-ghost h-12 px-6 text-[15.5px]">
              Naar de lessen
            </Link>
          )}
        </div>
      </section>

      {/* Drills */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="display-soft text-[26px] text-ink">Drills</h2>
          <span className="hand text-[14px] font-semibold text-ink-muted">Eindeloos · stopt wanneer jij stopt</span>
        </div>

        <ul className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2">
          {DRILL_KINDS.map((kind, i) => {
            const d = DRILLS[kind];
            const avail = availability[kind] ?? { now: 0, from: null };
            const ready = avail.now > 0;
            return (
              <li key={kind} style={{ "--i": i } as React.CSSProperties}>
                <Link href={`/oefenen/drill/${kind}`} className="block h-full">
                  <article className={`card card-lift h-full px-5 py-4 ${ready ? "" : "opacity-70"}`}>
                    <div className="flex items-start gap-4">
                      <span
                        aria-hidden
                        className={`mt-0.5 flex h-14 w-14 shrink-0 items-center justify-center rounded-tile border-2 border-outline ${
                          ready ? "shadow-[3px_3px_0_var(--color-outline)]" : "bg-sunken"
                        } ${i % 2 ? "rotate-2" : "-rotate-2"}`}
                        style={ready ? { background: DRILL_POP[i % DRILL_POP.length] } : undefined}
                      >
                        <Doodle
                          name={kind as DoodleName}
                          size={34}
                          color={ready ? "#ffffff" : "var(--color-line-strong)"}
                        />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="display-soft text-[18px] text-ink">{d.title}</h3>
                          <span className="hr-text hand text-[13px] font-semibold text-ink-muted">{d.title_hr}</span>
                          {d.needsVoice ? <Pill tone="accent">audio</Pill> : null}
                        </div>
                        <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-secondary">
                          {d.description}
                        </p>
                        <p className="hand mt-2 text-[13px] font-bold text-ink-muted">
                          {ready
                            ? kind === "brojevi"
                              ? "0 tot 100"
                              : `${avail.now} woorden klaar`
                            : avail.from
                              ? `Komt vrij vanaf les ${avail.from}`
                              : "Nog geen woorden"}
                        </p>
                      </div>
                    </div>
                  </article>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="hand mt-8 text-[14px] font-semibold leading-relaxed text-ink-muted">
        Drills gebruiken alleen woorden uit lessen die je al kunt openen, en elk antwoord
        telt mee in de spaced repetition van dat woord — een drill is dus nooit verloren
        tijd, ook niet als de herhaling leeg is.
      </p>

      {/* De foutenbank hoort hier: het is de derde manier om te oefenen, naast
          de planning en de drills. */}
      <section className="mt-10">
        <Link href="/fouten" className="block">
          <article className="card card-lift px-6 py-5">
            <div className="flex items-start gap-4">
              <span
                aria-hidden
                className="mt-0.5 flex h-14 w-14 shrink-0 rotate-2 items-center justify-center rounded-tile border-2 border-outline bg-pop-pink shadow-[3px_3px_0_var(--color-outline)]"
              >
                <Doodle name="cross" size={30} stroke={2.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="display-soft text-[18px] text-ink">Jouw fouten</h3>
                  {mistakeCount > 0 ? <Pill tone="bad">{mistakeCount}</Pill> : null}
                </div>
                <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">
                  Alles wat je ooit misging, met wat jij typte naast wat er moest staan.
                  Fouten die vaker terugkomen staan bovenaan — die zeggen iets over een
                  patroon in plaats van over een verschrijving.
                </p>
              </div>
              <span aria-hidden className="mt-2 hidden shrink-0 text-ink-muted sm:block">
                →
              </span>
            </div>
          </article>
        </Link>
      </section>
    </Page>
  );
}
