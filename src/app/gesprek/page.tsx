import Link from "next/link";

import { Doodle, type DoodleName } from "@/components/doodles";
import { Page, PageHeader } from "@/components/ui";
import { loadScenarios } from "@/lib/gesprek";
import { WachtOpBot } from "@/components/WachtOpBot";
import { ollamaToestand } from "@/lib/levenscyclus";
import { MODEL } from "@/lib/ollama";

export const dynamic = "force-dynamic";

export default async function GesprekPage() {
  const scenarios = loadScenarios();
  const status = await ollamaToestand();

  return (
    <Page>
      <PageHeader
        title="Gesprek"
        intro="Praat met een bot in het Kroatisch, in een situatie uit het dagelijks leven. Hij gebruikt alleen woorden die je al kunt hebben, en jouw zinnen worden nagekeken."
      >
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="pill -rotate-2 bg-pop-yellow text-on-pop">BETA</span>
          <span className="hand text-[14px] font-bold text-ink-secondary">in ontwikkeling</span>
        </div>
      </PageHeader>

      <div className="mb-8 rounded-card border-2 border-dashed border-outline bg-surface px-5 py-4">
        <p className="hand text-[15px] font-bold">Goed om te weten</p>
        <ul className="mt-2 space-y-1.5 text-[14.5px] leading-relaxed text-ink-secondary">
          <li>
            Het Kroatisch van de bot is <strong className="text-ink">niet door een moedertaalspreker nagekeken</strong>. Elke zin gaat wel langs
            de taalpoorten (spelling, naamval, Servische vormen) en wat niet door die controle komt, zie je niet.
          </li>
          <li>Een gesprek telt nergens als voortgang: het schrijft niets naar je leerhistorie.</li>
          <li>Alles draait op je eigen computer met een gratis model ({MODEL}). Er gaat niets naar buiten.</li>
        </ul>
      </div>

      {status.staat !== "klaar" ? (
        <div className="mb-8 rounded-card border-2 border-outline bg-pop-peach p-5 text-on-pop shadow-[var(--hard)]">
          {status.staat === "starten" ? (
            <>
              <WachtOpBot />
              <p className="hand text-[16px] font-bold">De bot wordt wakker gemaakt…</p>
              <p className="mt-1 text-[14.5px] font-semibold leading-relaxed">
                Dat duurt een paar seconden. Deze pagina ververst zichzelf zodra hij klaar is.
              </p>
            </>
          ) : status.staat === "geen-programma" ? (
            <>
              <p className="hand text-[16px] font-bold">Ollama is niet geïnstalleerd</p>
              <p className="mt-1 text-[14.5px] font-semibold leading-relaxed">
                Installeer het met «brew install ollama». Daarna start het platform het zelf als je hier komt.
              </p>
            </>
          ) : (
            <>
              <p className="hand text-[16px] font-bold">Het model staat er nog niet op</p>
              <p className="mt-1 text-[14.5px] font-semibold leading-relaxed">
                Haal het op met «ollama pull {MODEL}» (een paar GB, eenmalig).
              </p>
            </>
          )}
        </div>
      ) : null}

      <div className="stagger grid gap-4 sm:grid-cols-2">
        {scenarios.map((s, i) => (
          <Link
            key={s.id}
            href={`/gesprek/${s.id}`}
            style={{ "--i": i } as React.CSSProperties}
            className="card card-lift flex items-start gap-4 p-5"
          >
            <span className="flex h-14 w-14 shrink-0 -rotate-3 items-center justify-center rounded-[18px] border-2 border-outline bg-pop-aqua shadow-[var(--hard-sm)]">
              <Doodle name={s.doodle as DoodleName} size={36} color="#ffffff" />
            </span>
            <span className="min-w-0">
              <span className="display block text-[21px] leading-tight">{s.titel_nl}</span>
              <span className="hr-text hand block text-[14px] font-bold text-ink-secondary">{s.titel_hr}</span>
              <span className="mt-1.5 block text-[14.5px] leading-snug text-ink-secondary">{s.situatie_nl}</span>
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}
