import Link from "next/link";

import { Card, Empty, Page, PageHeader, Pill } from "@/components/ui";
import { opdrachtenMetStand, SOORT_LABEL } from "@/lib/schrijven";

export const dynamic = "force-dynamic";

/**
 * De schrijfsectie.
 *
 * Geordend als een ladder en niet als een lijst: van drie zinnen over jezelf
 * tot een eigen hoofdstuk van honderdvijftig woorden. Wat nog niet opengaat,
 * blijft zichtbaar — je moet kunnen zien waar het heen gaat, ook als je er nog
 * niet bent.
 */
export default function SchrijvenPage() {
  const opdrachten = opdrachtenMetStand();
  const perNiveau = new Map<string, typeof opdrachten>();
  for (const o of opdrachten) {
    const lijst = perNiveau.get(o.niveau) ?? [];
    lijst.push(o);
    perNiveau.set(o.niveau, lijst);
  }

  const af = opdrachten.filter((o) => o.werk?.klaar).length;
  const bezig = opdrachten.filter((o) => o.werk && !o.werk.klaar).length;

  return (
    <Page>
      <PageHeader
        title="Schrijven"
        intro={
          <>
            Hier bedenk je het zelf. Wat het programma kan nakijken, kijkt het na — hoeveel
            zinnen, of de verleden tijd erin staat, welke woorden het niet kent, welk
            voorzetsel de verkeerde naamval krijgt. Of het góéd is, staat er niet bij: dat
            leg je naast het modelantwoord en beoordeel je zelf.
            {af || bezig ? (
              <span className="mt-2 block text-ink-muted">
                {af} af{bezig ? `, ${bezig} onderhanden` : ""}.
              </span>
            ) : null}
          </>
        }
      />

      {[...perNiveau.entries()].map(([niveau, lijst]) => (
        <section key={niveau} className="mb-9">
          <h2 className="display-soft mb-3 text-[19px] text-ink">{niveau}</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {lijst.map((o) => {
              const inhoud = (
                <>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Pill>{SOORT_LABEL[o.soort]}</Pill>
                    {o.werk?.klaar ? (
                      <span className="rounded-full bg-accent-wash px-2.5 py-0.5 text-[11.5px] font-semibold text-accent">
                        af
                      </span>
                    ) : o.werk ? (
                      <span className="rounded-full bg-sunken px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-secondary">
                        {o.werk.woorden} woorden
                      </span>
                    ) : null}
                  </div>
                  <h3 className="display-soft text-[17px] leading-snug text-ink">{o.titel_nl}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
                    {o.opdracht_nl.split(".")[0]}.
                  </p>
                  {o.voorbij ? (
                    <p className="mt-2 text-[12px] text-ink-muted">
                      Hoort bij les {o.requires_lesson} — je bent nu bij les {o.huidigeLes}
                    </p>
                  ) : null}
                </>
              );

              return (
                <li key={o.id}>
                  <Link href={`/schrijven/${o.id}`} className="block h-full">
                    <Card
                      className={`h-full transition-colors hover:border-line-strong ${o.voorbij ? "opacity-70" : ""}`}
                    >
                      {inhoud}
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {opdrachten.every((o) => o.voorbij) ? (
        <Empty>
          Alles hier ligt nog voor je uit. Dat hoeft niet tegen te houden — de eerste
          opdracht is drie zinnen over jezelf, en die kun je nu al proberen. Doe je de
          plaatsingstoets, dan schuift deze grens mee met wat je werkelijk kunt.
        </Empty>
      ) : null}
    </Page>
  );
}
