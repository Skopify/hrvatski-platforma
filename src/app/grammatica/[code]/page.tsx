import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/ui";
import { loadModule, moduleExercises, type ModulePhase } from "@/lib/modules";

export const dynamic = "force-dynamic";

const STAP_LABEL: Record<ModulePhase["kind"], string> = {
  noticing: "Kijken",
  rule: "De regel",
  interpretation: "Betekenis",
  blocked: "Oefenen",
  interleaved: "Door elkaar",
  context: "In tekst",
};

export default async function ModulePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const module = loadModule(code);
  if (!module) notFound();

  const aantal = moduleExercises(module).length;

  return (
    <Page>
      <PageHeader title={module.title_nl} intro={module.blurb_nl} />

      <p className="hr-text mb-8 text-[20px] font-semibold text-ink">{module.title_hr}</p>

      <section className="mb-8">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          Na deze module
        </h2>
        <ul className="flex flex-col gap-1.5">
          {module.can_do_nl.map((c) => (
            <li key={c} className="flex gap-2.5 text-[14.5px] leading-relaxed text-ink-secondary">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              {c}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-9">
        <h2 className="mb-3 text-[13px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          Hoe het gaat — {module.phases.length} stappen, {aantal} opgaven
        </h2>
        <ol className="flex flex-col gap-2.5">
          {module.phases.map((p) => (
            <li key={p.step} className="rounded-card bg-sunken px-4 py-3.5">
              <p className="text-[14px] font-bold text-ink">
                <span className="tabular mr-2 text-accent">{p.step}</span>
                {p.title_nl}
                <span className="ml-2 text-[12px] font-medium text-ink-muted">
                  {STAP_LABEL[p.kind]}
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{p.why_nl}</p>
            </li>
          ))}
        </ol>
      </section>

      <Link
        href={`/grammatica/${module.code.toLowerCase()}/sessie`}
        className="btn btn-primary inline-flex px-7 py-3 text-[14.5px]"
      >
        Module starten
      </Link>
    </Page>
  );
}
