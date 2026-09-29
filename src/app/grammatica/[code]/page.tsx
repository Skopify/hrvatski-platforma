import Link from "next/link";
import { notFound } from "next/navigation";

import { Doodle } from "@/components/doodles";
import { PillMeter } from "@/components/PillMeter";
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

  // Elke soort stap krijgt zijn eigen stift, zodat je aan de kleur ziet wat er komt.
  const STAP_POP: Record<ModulePhase["kind"], string> = {
    noticing: "bg-pop-sky",
    rule: "bg-pop-lilac",
    interpretation: "bg-pop-peach",
    blocked: "bg-pop-yellow",
    interleaved: "bg-pop-pink",
    context: "bg-pop-mint",
  };
  // De uitslag van de meting bepaalt de kleur van de kaart.
  const uitslagPop = !status ? "bg-pop-lilac" : status.status === "beheerst" ? "bg-pop-mint" : status.status === "onzeker" ? "bg-pop-yellow" : "bg-pop-peach";

  return (
    <Page>
      <PageHeader title={module.title_nl} intro={module.blurb_nl} />

      <div className="mb-7 flex flex-wrap items-center gap-3">
        <p className="hr-text display text-[26px] leading-tight">{module.title_hr}</p>
        {afgerondOp ? (
          <span className="pill -rotate-2 bg-pop-mint text-on-pop">
            <Doodle name="check" size={16} stroke={2.6} />
            afgerond op {new Date(afgerondOp).toLocaleDateString("nl-NL")}
          </span>
        ) : null}
      </div>

      {/* De uitslag met zijn teller erbij, en altijd de weg terug. Wie tijdens de
          module merkt dat "beheerst" niet klopt, moet dat kunnen rechtzetten
          zonder de hele toets over te doen. */}
      <div className={`mb-9 rounded-card border-2 border-outline px-6 py-5 text-on-pop shadow-[var(--hard)] ${uitslagPop}`}>
        <p className="hand text-[16px] font-bold">{status ? "Wat we gemeten hebben" : "Nog niet gemeten"}</p>
        {status ? (
          <>
            <p className="display mt-1 text-[24px] capitalize leading-tight">
              {status.status} — {status.correct} van {status.total} goed
            </p>
            <p className="mt-1.5 text-[15px] font-medium leading-relaxed">{STATUS_TEXT[status.status]}</p>
          </>
        ) : (
          <p className="mt-1 text-[15px] font-medium leading-relaxed">
            Dat is iets anders dan onbekend: er is alleen niets over te zeggen. Drie vragen laten zien waar je staat.
          </p>
        )}
        <Link href={`/plaatsingstoets?module=${module.code.toLowerCase()}`} className="btn btn-ghost mt-4 h-11 px-5 text-[14.5px]">
          Test je hieruit — drie vragen
        </Link>
      </div>

      <section className="mb-10">
        <h2 className="display mb-4 text-[26px]">Na deze module</h2>
        <ul className="flex flex-col gap-2.5">
          {module.can_do_nl.map((c) => (
            <li key={c} className="flex items-start gap-3 rounded-[20px] border-2 border-outline bg-surface px-4 py-3">
              <span aria-hidden className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-outline bg-pop-mint text-on-pop">
                <Doodle name="check" size={13} stroke={3} />
              </span>
              <span className="text-[15px] font-medium leading-relaxed">{c}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h2 className="display text-[26px]">Hoe het gaat</h2>
          <p className="hand text-[14.5px] font-bold text-ink-secondary">
            {module.phases.length} stappen · {aantal} opgaven
          </p>
        </div>
        {gedaan > 0 ? (
          <div className="mb-4">
            <PillMeter value={gedaan} max={stappen} unit="stappen" height={30} showBurst={false} color="var(--color-pop-mint)" />
          </div>
        ) : null}
        <ol className="flex flex-col gap-3">
          {module.phases.map((p) => (
            <li key={p.step} className="flex gap-4 rounded-card border-2 border-outline bg-surface px-4 py-4 shadow-[var(--hard-sm)]">
              <span
                aria-hidden
                className={`num flex h-11 w-11 shrink-0 -rotate-3 items-center justify-center rounded-[14px] border-2 border-outline text-[20px] text-on-pop shadow-[2px_2px_0_var(--color-outline)] ${STAP_POP[p.kind]}`}
              >
                {p.step}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="display text-[19px] leading-tight">{p.title_nl}</span>
                  <span className={`pill h-7 px-2.5 text-[13px] text-on-pop ${STAP_POP[p.kind]}`}>{STAP_LABEL[p.kind]}</span>
                </p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink-secondary">{p.why_nl}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link href={`/grammatica/${module.code.toLowerCase()}/sessie`} className="btn btn-primary h-[52px] px-8 text-[16px]">
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
