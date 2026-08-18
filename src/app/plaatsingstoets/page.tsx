import { PlacementRunner } from "@/components/PlacementRunner";
import { Page, PageHeader } from "@/components/ui";
import { beginPlacement } from "@/app/actions";
import { loadModule } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default async function PlaatsingstoetsPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: scope } = await searchParams;
  const m = scope ? loadModule(scope) : undefined;
  const plan = await beginPlacement(m?.code);

  return (
    <Page>
      <PageHeader
        title={m ? `Hertoets — ${m.title_nl}` : "Plaatsingstoets"}
        intro={
          m
            ? "Drie vragen. Wat eruit komt vervangt de status die er nu staat, ook als die lager uitvalt."
            : "Het curriculum begint bij nul, maar jouw pad hoeft dat niet te doen. Deze toets meet per module wat je al kunt — uit je antwoorden, niet uit wat je van jezelf denkt."
        }
      />
      <PlacementRunner plan={plan} scope={m?.code} />
    </Page>
  );
}
