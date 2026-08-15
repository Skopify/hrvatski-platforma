import { VocabBrowser } from "@/components/VocabBrowser";
import { Page, PageHeader } from "@/components/ui";
import { allVocab } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default function VocabPage() {
  const words = allVocab();

  return (
    <Page>
      <PageHeader
        title="Woorden"
        intro={`Alle ${words.length} woorden uit de cursus en de verhalen, met de gegevens die het Kroatisch echt nodig heeft: geslacht, genitief, meervoud en de ja-vorm. Het streepje links toont hoe stevig een woord op dit moment zit.`}
      />

      <VocabBrowser words={words} />
    </Page>
  );
}
