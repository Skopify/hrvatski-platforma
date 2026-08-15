import Link from "next/link";

import { Page, PageHeader, Pill } from "@/components/ui";
import { DRILLS, DRILL_KINDS } from "@/lib/drills";
import { dueCount, nextDueAt } from "@/lib/srs";
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

/* Plat lijnicoon per drill, 22px. */
const DRILL_ICONS: Record<string, React.ReactNode> = {
  oblik: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M3.5 9.5h17" />
      <path d="M9 9.5V20" />
    </>
  ),
  padezi: (
    <>
      <path d="M12 3v18" />
      <path d="M5 8.5 12 5l7 3.5" />
      <path d="M4 20h16" />
      <path d="M8.5 12.5h7" />
    </>
  ),
  rod: (
    <>
      <circle cx="12" cy="8" r="4.5" />
      <path d="M12 12.5V21" />
      <path d="M8.5 17.5h7" />
    </>
  ),
  genitiv: (
    <>
      <path d="M4 19 10 5h1.5l6 14" />
      <path d="M6.5 14h8" />
      <path d="M19.5 12v7" />
    </>
  ),
  mnozina: (
    <>
      <rect x="3" y="6" width="8" height="12" rx="2" />
      <path d="M14 6h7v12h-7" />
      <path d="M14 10h4M14 14h4" />
    </>
  ),
  glagol: (
    <>
      <path d="M5 12a7 7 0 0 1 12-4.9" />
      <path d="M17 3.5V7h-3.5" />
      <path d="M19 12a7 7 0 0 1-12 4.9" />
      <path d="M7 20.5V17h3.5" />
    </>
  ),
  brojevi: (
    <>
      <path d="M9 4 7 20" />
      <path d="M17 4l-2 16" />
      <path d="M4.5 9.5h16" />
      <path d="M3.5 14.5h16" />
    </>
  ),
  diktat: (
    <>
      <path d="M3 10v4" />
      <path d="M7 7v10" />
      <path d="M11 4v16" />
      <path d="M15 8v8" />
      <path d="M19 10v4" />
    </>
  ),
};

export default function PracticePage() {
  const due = dueCount();
  const next = nextDueAt();
  const availability = drillAvailability();
  const mistakeCount = mistakes(200).length;

  return (
    <Page>
      <PageHeader
        title="Oefenen"
        intro="Herhaling volgt de planning — eerder herhalen levert nauwelijks iets op. Maar drillen kan altijd: korte, snelle rondes op één vaardigheidje, gevoed door de woorden die je al kent."
      />

      {/* Herhaalstatus — de planning bepaalt of dit een knop of een mededeling is. */}
      <section className="hero mb-9 px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[14.5px] font-bold text-ink">
              {due > 0
                ? `${due} ${due === 1 ? "item staat" : "items staan"} klaar`
                : "Niets te herhalen"}
            </p>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-secondary">
              {due > 0
                ? "Gemengd door elkaar, met voorrang voor wat je het vaakst mist."
                : next
                  ? `Het eerstvolgende item staat ${whenLabel(next)} op de planning.`
                  : "Er staat niets op de planning. Begin een les of lees een verhaal."}
            </p>
          </div>
          {due > 0 ? (
            <Link href="/oefenen/herhalen" className="btn btn-primary px-6 py-2.5 text-[13.5px]">
              Start herhaling
              <span className="tabular rounded-full bg-white/22 px-2 py-0.5 text-[12px]">{due}</span>
            </Link>
          ) : (
            <Link href="/lessen" className="btn btn-ghost px-5 py-2.5 text-[13.5px]">
              Naar de lessen
            </Link>
          )}
        </div>
      </section>

      {/* Drills */}
      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="display-soft text-[20px] text-ink">Drills</h2>
          <span className="text-[12.5px] text-ink-muted">Eindeloos · stopt wanneer jij stopt</span>
        </div>

        <ul className="stagger grid gap-3 sm:grid-cols-2">
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
                        className={`mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                          ready ? "bg-accent-wash text-accent" : "bg-sunken text-ink-muted"
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
                          {DRILL_ICONS[kind]}
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-[15.5px] font-bold text-ink">{d.title}</h3>
                          <span className="hr-text text-[12px] text-ink-muted">{d.title_hr}</span>
                          {d.needsVoice ? <Pill tone="accent">audio</Pill> : null}
                        </div>
                        <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-secondary">
                          {d.description}
                        </p>
                        <p className="mt-2 text-[11.5px] font-semibold text-ink-muted">
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

      <p className="mt-8 text-[12.5px] leading-relaxed text-ink-muted">
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
                className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-bad-wash text-bad-ink"
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
                  <path d="M12 3.5 21 19.5H3L12 3.5Z" />
                  <path d="M12 10v4" />
                  <path d="M12 16.8v.2" />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-[15.5px] font-bold text-ink">Jouw fouten</h3>
                  {mistakeCount > 0 ? <Pill tone="bad">{mistakeCount}</Pill> : null}
                </div>
                <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-ink-secondary">
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
