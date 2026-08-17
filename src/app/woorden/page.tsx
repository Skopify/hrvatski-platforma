import Link from "next/link";

import { VocabBrowser } from "@/components/VocabBrowser";
import { Page, PageHeader } from "@/components/ui";
import { leeches } from "@/lib/stages";
import { allVocab } from "@/lib/stats";
import { restoreLeech } from "@/app/actions";
import { LeechList } from "@/components/LeechList";

export const dynamic = "force-dynamic";

export default function VocabPage() {
  const words = allVocab();
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

      <VocabBrowser words={words} />
    </Page>
  );
}
