import { notFound } from "next/navigation";

import { Schrijfblok } from "@/components/Schrijfblok";
import { Page, PageHeader, Pill } from "@/components/ui";
import { loadOpdracht, SOORT_LABEL, werkVoor, woordenbank } from "@/lib/schrijven";

export const dynamic = "force-dynamic";

export default async function SchrijfOpdrachtPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opdracht = loadOpdracht(id);
  if (!opdracht) notFound();

  const werk = werkVoor(opdracht.id);

  return (
    <Page width="detail">
      <PageHeader title={opdracht.titel_nl} intro={opdracht.opdracht_nl}>
        <div className="mt-4 flex flex-wrap gap-2">
          <Pill>{SOORT_LABEL[opdracht.soort]}</Pill>
          <Pill>{opdracht.niveau}</Pill>
          {opdracht.motief ? <Pill>{opdracht.motief}</Pill> : null}
        </div>
      </PageHeader>

      {opdracht.hulp_nl.length ? (
        <div className="mb-6 rounded-card border border-line bg-sunken px-5 py-4">
          <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
            Een zetje
          </p>
          <ul className="space-y-1.5">
            {opdracht.hulp_nl.map((h) => (
              <li key={h} className="text-[14px] leading-relaxed text-ink-secondary">
                {h}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <Schrijfblok
        opdracht={opdracht}
        bank={woordenbank(opdracht)}
        begin={werk?.tekst ?? ""}
        klaarBegin={werk?.klaar ?? false}
      />
    </Page>
  );
}
