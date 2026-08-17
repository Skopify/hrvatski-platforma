import Link from "next/link";

import { Page, PageHeader } from "@/components/ui";
import { loadModules, moduleExercises } from "@/lib/modules";

export const dynamic = "force-dynamic";

export default function GrammaticaPage() {
  const modules = loadModules();

  return (
    <Page>
      <PageHeader
        title="Grammatica"
        intro="Eén punt per module, altijd langs dezelfde weg: eerst kijken, dan de regel, dan de betekenis kiezen, dan zelf invullen, dan door elkaar, en tot slot in een verhaaltje. De derde stap is degene die in cursussen meestal ontbreekt — en juist daar valt het kwartje."
      />

      <div className="flex flex-col gap-3">
        {modules.map((m) => (
          <Link
            key={m.code}
            href={`/grammatica/${m.code.toLowerCase()}`}
            className="rounded-card group border border-line bg-surface px-5 py-5 transition-all duration-200 hover:-translate-y-px hover:border-accent-ring hover:bg-accent-wash"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="hr-text text-[19px] font-semibold text-ink">{m.title_hr}</p>
              <span className="pill bg-sunken text-ink-secondary">{m.cefr}</span>
            </div>
            <p className="mt-1 text-[15px] font-bold text-ink">{m.title_nl}</p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">{m.blurb_nl}</p>
            <p className="mt-3 text-[12px] text-ink-muted">
              {m.phases.length} stappen · {moduleExercises(m).length} opgaven
            </p>
          </Link>
        ))}
      </div>
    </Page>
  );
}
