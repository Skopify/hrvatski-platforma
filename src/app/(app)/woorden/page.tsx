import Link from "next/link";

import { VocabBrowser } from "@/components/VocabBrowser";
import { Page, PageHeader } from "@/components/ui";
import { leeches } from "@/lib/stages";
import { allVocab } from "@/lib/stats";
import { restoreLeech } from "@/app/actions/woorden";
import { LeechList } from "@/components/LeechList";

export const dynamic = "force-dynamic";

export default function VocabPage() {
  const words = allVocab();
  // Alleen de velden die de lijst toont, en de retentie op drie decimalen: het
  // scheelt meer dan de helft van de bytes die naar de browser gaan.
  const rijen = words.map(({ cefr: _c, reps: _r, lapses: _l, aspect: _a, retention, ...rest }) => ({
    ...rest,
    retention: retention === null ? null : Math.round(retention * 1000) / 1000,
  }));
  const uitRotatie = leeches();

  return (
    <Page>
      <PageHeader
        title="Woorden"
        intro={`Alle ${words.length} woorden uit de cursus en de verhalen, met de gegevens die het Kroatisch echt nodig heeft: geslacht, genitief, meervoud en de ja-vorm. Het streepje links toont hoe stevig een woord op dit moment zit.`}
      />

      <Link
        href="/woorden/herhalen"
        className="btn btn-primary mb-8 inline-flex px-6 py-3 text-[14.5px]"
      >
        Woorden oefenen
      </Link>

      {uitRotatie.length ? <LeechList leeches={uitRotatie} onRestore={restoreLeech} /> : null}

      <VocabBrowser words={rijen} />
    </Page>
  );
}
