import { notFound } from "next/navigation";

import { DrillRunner } from "@/components/DrillRunner";
import { DRILLS, type DrillKind } from "@/lib/drills";

export const dynamic = "force-dynamic";

export default async function DrillPage({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const meta = DRILLS[kind as DrillKind];
  if (!meta) notFound();

  return <DrillRunner meta={meta} />;
}
