import { notFound } from "next/navigation";

import { SessionRunner, type Step } from "@/components/SessionRunner";
import { loadModule, type ModulePhase } from "@/lib/modules";
import { present } from "@/lib/present";
import { stepsDoneInModule } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** Het etiket linksboven: welke stap van de zeven, en waarom hij er is. */
const STAP_LABEL: Record<ModulePhase["kind"], string> = {
  noticing: "Kijken",
  rule: "De regel",
  interpretation: "Betekenis",
  blocked: "Oefenen",
  interleaved: "Door elkaar",
  context: "In tekst",
};

export default async function ModuleSessiePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const module = loadModule(code);
  if (!module) notFound();

  const steps: Step[] = [];
  for (const phase of module.phases) {
    const badge = {
      label: `${phase.step}/${module.phases.length} · ${STAP_LABEL[phase.kind]}`,
      hint: phase.why_nl,
    };

    // Een fase met een leestekst begint met die tekst. Comprehensible input
    // gaat vóór de vragen erover — anders lees je op zoek naar antwoorden in
    // plaats van naar betekenis.
    if (phase.text_hr) {
      steps.push({
        exercise: present({
          id: `m.${module.code}.${phase.step}.tekst`,
          type: "reading",
          mode: "receptive",
          prompt_nl: phase.title_nl,
          given: phase.text_hr,
          body_nl: phase.translation_nl,
          targets: [],
        }),
        lessonNumber: 0,
        sectionTitle: phase.title_nl,
        reason: "introductie",
        badge,
      });
    }

    for (const exercise of phase.exercises) {
      steps.push({
        exercise: present(exercise),
        lessonNumber: 0,
        sectionTitle: phase.title_nl,
        reason: phase.kind === "noticing" || phase.kind === "rule" ? "introductie" : "oefening",
        badge,
      });
    }
  }

  // Verdergaan waar je gebleven was, precies zoals bij een les: de stappen die
  // je gehad hebt vallen eruit, de volgorde van de rest blijft staan.
  const done = stepsDoneInModule(module.code);
  const remaining = done.size ? steps.filter((s) => !done.has(s.exercise.id)) : steps;

  // Alles gehad zonder dat de module is afgerond — je sloot het tabblad op de
  // laatste vraag — dan is een lege sessie het slechtste antwoord.
  const teDoen = remaining.length ? remaining : steps;

  return (
    <SessionRunner
      steps={teDoen}
      kind="review"
      lessonNumber={null}
      moduleCode={module.code}
      title={`${module.title_nl} · ${module.title_hr}`}
      backHref={`/grammatica/${module.code.toLowerCase()}`}
      doneLabel="Module afgerond"
    />
  );
}
