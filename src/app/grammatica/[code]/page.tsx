import Link from "next/link";
import { notFound } from "next/navigation";

import { Page, PageHeader } from "@/components/ui";
import { loadModule, moduleExercises, moduleStepCount, type ModulePhase } from "@/lib/modules";
import { moduleStatuses, STATUS_TEXT } from "@/lib/placement";
import { moduleProgressMap, stepsDoneInModule } from "@/lib/stats";
import { RestartModule } from "@/components/RestartModule";

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
  const status = moduleStatuses().get(module.code);
  // Stappen, niet opgaven: een fase met een leestekst begint met die tekst, en
  // die telt als stap mee in de sessie.
  const stappen = moduleStepCount(module);
  const gedaan = stepsDoneInModule(module.code).size;
  const afgerondOp = moduleProgressMap().get(module.code)?.afgerondOp ?? null;
  const resterend = Math.max(0, stappen - gedaan);

  return (
    <Page>
      <PageHeader title={module.title_nl} intro={module.blurb_nl} />

      <div className="mb-6 flex flex-wrap items-baseline gap-3">
        <p className="hr-text text-[20px] font-semibold text-ink">{module.title_hr}</p>
        {afgerondOp ? (
          <span className="pill bg-good-wash text-good">
            afgerond op {new Date(afgerondOp).toLocaleDateString("nl-NL")}
          </span>
        ) : null}
      </div>

      {/* De uitslag met zijn teller erbij, en altijd de weg terug. Wie tijdens de
          module merkt dat "beheerst" niet klopt, moet dat kunnen rechtzetten
          zonder de hele toets over te doen. */}
      <div className="rounded-card mb-8 border border-line bg-sunken px-5 py-4">
        {status ? (
          <>
            <p className="text-[14px] font-bold text-ink">
              Gemeten: {status.status} — {status.correct} van {status.total} goed
            </p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-ink-secondary">
              {STATUS_TEXT[status.status]}
            </p>
          </>
        ) : (
          <p className="text-[13.5px] leading-relaxed text-ink-secondary">
            Deze module is nog niet gemeten. Dat is iets anders dan onbekend — er is alleen niets
            over te zeggen.
          </p>
        )}
        <Link
          href={`/plaatsingstoets?module=${module.code.toLowerCase()}`}
          className="mt-2 inline-block text-[13.5px] font-semibold text-accent hover:underline"
        >
          Test je hieruit — drie vragen
        </Link>
      </div>

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

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href={`/grammatica/${module.code.toLowerCase()}/sessie`}
          className="btn btn-primary inline-flex px-7 py-3 text-[14.5px]"
        >
          {gedaan
            ? `Hervatten — nog ${resterend} van ${stappen}`
            : afgerondOp
              ? "Nog een keer doorlopen"
              : "Module starten"}
        </Link>
        {gedaan ? <RestartModule code={module.code} /> : null}
      </div>
    </Page>
  );
}
