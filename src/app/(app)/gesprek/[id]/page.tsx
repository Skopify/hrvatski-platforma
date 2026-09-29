import { notFound } from "next/navigation";

import { GesprekRunner } from "@/components/GesprekRunner";
import { Page, PageHeader } from "@/components/ui";
import { loadScenario, standaardLes, woordenTotLes } from "@/lib/gesprek";
import { ollamaToestand } from "@/lib/levenscyclus";
import { lessonStatuses } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function GesprekScenarioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const scenario = loadScenario(id);
  if (!scenario) notFound();

  const open = lessonStatuses().filter((l) => l.status !== "locked").map((l) => l.lesson);
  const aantallen = Array.from({ length: 22 }, (_, les) => woordenTotLes(les).length);
  const status = await ollamaToestand();

  return (
    <Page width="detail">
      <PageHeader title={scenario.titel_nl} intro={scenario.situatie_nl}>
        <div className="mt-4 flex items-center gap-2">
          <span className="pill -rotate-2 bg-pop-yellow text-on-pop">BETA</span>
          <span className="hr-text hand text-[14px] font-bold text-ink-secondary">{scenario.titel_hr}</span>
        </div>
      </PageHeader>
      <GesprekRunner scenario={scenario} startLes={standaardLes(open)} aantallen={aantallen} status={status} />
    </Page>
  );
}
