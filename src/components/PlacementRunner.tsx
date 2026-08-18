"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";

import {
  answerPlacementGrammar,
  answerPlacementVocab,
  endPlacement,
  type PlacementPlan,
} from "@/app/actions";
import type { PlacementResult } from "@/lib/placement";

/*
  De toets loopt zonder feedback per vraag, en dat is een keuze.

  Bij een oefening hoort feedback meteen: je leert van de correctie. Bij een
  meting werkt datzelfde tegen je. Wie na vraag één te horen krijgt dat het fout
  was, past zijn antwoord op vraag twee daarop aan — dan meet je hoe snel iemand
  patronen oppikt in plaats van wat hij al wist. Daarom pas aan het eind een
  overzicht, en dan wel meteen het hele beeld.

  De adaptieve stappen gebeuren hier in de browser. Grammatica: stoppen zodra
  drie modules op rij overwegend fout gaan, want alles daarboven bouwt daarop
  voort. Woordenschat: omhoog bij vier of vijf goed, omlaag bij twee of minder,
  en stoppen zodra de grens gevonden is.
*/

/** Zoveel modules op rij overwegend fout, en de rest hoeft niet meer. */
const STOP_NA = 3;

type Fase = "intro" | "grammatica" | "woorden" | "klaar";

interface Vraag {
  soort: "grammatica" | "woord";
  moduleCode?: string;
  moduleTitle?: string;
  exerciseId?: string;
  band?: number;
  itemId?: string;
  prompt: string;
  given?: string;
  options: string[];
  answer: string;
}

export function PlacementRunner({ plan, scope }: { plan: PlacementPlan; scope?: string }) {
  const router = useRouter();

  const [fase, setFase] = useState<Fase>("intro");
  const [vragen, setVragen] = useState<Vraag[]>([]);
  const [idx, setIdx] = useState(0);
  const [keuze, setKeuze] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);
  const [uitslag, setUitslag] = useState<PlacementResult | null>(null);

  // Wat de adaptieve logica moet onthouden zonder een render te veroorzaken.
  const start = useRef<number>(Date.now());
  const moduleIdx = useRef(0);
  const modulesFout = useRef(0);
  const moduleGoed = useRef(0);
  const band = useRef(plan.startBand);
  const bezocht = useRef<number[]>([]);
  const bandGoed = useRef(0);

  const totaalGeschat = useMemo(() => {
    const g = plan.modules.reduce((n, m) => n + m.probes.length, 0);
    const w = plan.bands.length ? plan.bands[0].probes.length * 3 : 0;
    return g + w;
  }, [plan]);

  const vraagUitModule = useCallback(
    (i: number): Vraag[] => {
      const m = plan.modules[i];
      if (!m) return [];
      return m.probes.map((p) => ({
        soort: "grammatica" as const,
        moduleCode: m.code,
        moduleTitle: m.title,
        exerciseId: p.exerciseId,
        prompt: p.prompt,
        given: p.given,
        options: p.options,
        answer: p.answer,
      }));
    },
    [plan],
  );

  const vraagUitBand = useCallback(
    (n: number): Vraag[] => {
      const b = plan.bands.find((x) => x.n === n);
      if (!b) return [];
      return b.probes.map((p) => ({
        soort: "woord" as const,
        band: b.n,
        itemId: p.itemId,
        prompt: p.hr,
        options: p.options,
        answer: p.answer,
      }));
    },
    [plan],
  );

  const beginnen = useCallback(() => {
    moduleIdx.current = 0;
    modulesFout.current = 0;
    moduleGoed.current = 0;
    setVragen(vraagUitModule(0));
    setIdx(0);
    setFase("grammatica");
    start.current = Date.now();
  }, [vraagUitModule]);

  const afronden = useCallback(async () => {
    setBezig(true);
    const r = await endPlacement(plan.runId);
    setUitslag(r);
    setFase("klaar");
    setBezig(false);
    router.refresh();
  }, [plan.runId, router]);

  const volgende = useCallback(async () => {
    if (keuze === null || bezig) return;
    const v = vragen[idx];
    const goed = keuze === v.answer;
    const duur = Date.now() - start.current;
    setBezig(true);

    if (v.soort === "grammatica" && v.moduleCode && v.exerciseId) {
      await answerPlacementGrammar(plan.runId, v.moduleCode, v.exerciseId, goed, duur);
      if (goed) moduleGoed.current++;
    } else if (v.soort === "woord" && v.band !== undefined && v.itemId) {
      await answerPlacementVocab(plan.runId, v.band, v.itemId, goed, duur);
      if (goed) bandGoed.current++;
    }

    setKeuze(null);
    setBezig(false);
    start.current = Date.now();

    if (idx + 1 < vragen.length) {
      setIdx(idx + 1);
      return;
    }

    /* Het blok is klaar — bepalen wat er nu volgt. */
    if (fase === "grammatica") {
      const totaal = vragen.length;
      const zwak = moduleGoed.current <= Math.floor(totaal / 3);
      modulesFout.current = zwak ? modulesFout.current + 1 : 0;
      moduleGoed.current = 0;

      const volgendeModule = moduleIdx.current + 1;
      const stoppen = modulesFout.current >= STOP_NA || volgendeModule >= plan.modules.length;

      if (!stoppen) {
        moduleIdx.current = volgendeModule;
        setVragen(vraagUitModule(volgendeModule));
        setIdx(0);
        return;
      }
      if (plan.bands.length === 0) {
        await afronden();
        return;
      }
      bezocht.current = [band.current];
      bandGoed.current = 0;
      setVragen(vraagUitBand(band.current));
      setIdx(0);
      setFase("woorden");
      return;
    }

    /* Woordenschat: omhoog, omlaag, of klaar. */
    const goedInBand = bandGoed.current;
    const perBand = vragen.length;
    let volgendeBand: number | null = null;
    if (goedInBand >= perBand - 1) volgendeBand = band.current + 1;
    else if (goedInBand <= perBand - 4) volgendeBand = band.current - 1;
    if (
      volgendeBand !== null &&
      (volgendeBand < 1 ||
        volgendeBand > plan.bands.length ||
        bezocht.current.includes(volgendeBand))
    ) {
      volgendeBand = null;
    }

    if (volgendeBand === null) {
      await afronden();
      return;
    }
    band.current = volgendeBand;
    bezocht.current.push(volgendeBand);
    bandGoed.current = 0;
    setVragen(vraagUitBand(volgendeBand));
    setIdx(0);
  }, [keuze, bezig, vragen, idx, fase, plan, vraagUitModule, vraagUitBand, afronden]);

  /* ------------------------------------------------------------- intro --- */

  if (fase === "intro") {
    return (
      <div className="rounded-card border border-line bg-surface p-6">
        <h2 className="text-[17px] font-bold text-ink">
          {scope ? "Deze module opnieuw meten" : "Waar sta je?"}
        </h2>
        <div className="mt-3 flex flex-col gap-2.5 text-[14.5px] leading-relaxed text-ink-secondary">
          {scope ? (
            <p>
              Drie vragen over deze module. De uitkomst vervangt wat er nu staat — ook als die
              lager uitvalt.
            </p>
          ) : (
            <>
              <p>
                Drie vragen per grammaticamodule, daarna een korte woordenschatveeg. Je krijgt
                onderweg <strong>geen</strong> feedback: zodra je hoort dat iets fout was, pas je
                je volgende antwoord aan, en dan meet dit niet meer wat je al wist.
              </p>
              <p>
                Het stopt vanzelf zodra drie modules op rij overwegend fout gaan — alles daarboven
                bouwt daarop voort. Reken op ongeveer {Math.round(totaalGeschat / 4)} tot{" "}
                {totaalGeschat} vragen.
              </p>
              <p>
                Weet je het niet? Gok niet, maar kies wat je het meest waarschijnlijk lijkt. Een
                gok die toevallig goed is, zet een module op «beheerst» en dan sla je hem over.
              </p>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={beginnen}
          className="btn btn-primary mt-5 px-7 py-3 text-[14.5px]"
        >
          Beginnen
        </button>
      </div>
    );
  }

  /* ------------------------------------------------------------ uitslag --- */

  if (fase === "klaar") {
    const gemeten = uitslag?.modules ?? [];
    const beheerst = gemeten.filter((m) => m.status === "beheerst");
    const onzeker = gemeten.filter((m) => m.status === "onzeker");
    const onbekend = gemeten.filter((m) => m.status === "onbekend");

    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-card border border-line bg-surface p-6">
          <h2 className="text-[17px] font-bold text-ink">Wat er gemeten is</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              ["beheerst", beheerst.length, "text-good"],
              ["onzeker", onzeker.length, "text-gold"],
              ["onbekend", onbekend.length, "text-ink-secondary"],
            ].map(([label, n, kleur]) => (
              <div key={label as string} className="rounded-card bg-sunken px-4 py-3">
                <p className={`tabular text-[22px] font-bold ${kleur}`}>{n as number}</p>
                <p className="text-[12.5px] text-ink-muted">{label as string}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[13.5px] leading-relaxed text-ink-secondary">
            {gemeten.length} van de {plan.modules.length} modules zijn gemeten. De rest is niet
            aan bod gekomen en staat daarom op «nog niet gemeten» — niet op onbekend.
          </p>
        </div>

        {uitslag && plan.bands.length > 0 ? (
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="text-[17px] font-bold text-ink">Woordenschat</h2>
            <p className="mt-2 text-[14.5px] leading-relaxed text-ink-secondary">
              {uitslag.grens === null ? (
                <>
                  Geen enkele band is gehaald. Er zijn {uitslag.gemeten} woorden gemeten en er is
                  niets aangenomen.
                </>
              ) : (
                <>
                  Je grens ligt bij band {uitslag.grens}. Daarvan zijn{" "}
                  <strong>{uitslag.gemeten} woorden echt gevraagd</strong> en{" "}
                  <strong>{uitslag.aangenomen} aangenomen</strong> op grond van de steekproef.
                  Aangenomen woorden staan apart geteld — ze zijn niet gemeten, en de
                  dekkingsmeter zegt dat er ook bij.
                </>
              )}
            </p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Boven de woordenschat van de leergang kan deze toets niets meten. Wat je daarbuiten
              kent, blijft dus onzichtbaar tot je het tegenkomt.
            </p>
          </div>
        ) : null}

        <div className="flex gap-3">
          <Link href="/grammatica" className="btn btn-primary px-5 py-2.5 text-[14px]">
            Naar de modules
          </Link>
          <Link href="/voortgang" className="btn btn-ghost px-5 py-2.5 text-[14px]">
            Voortgang
          </Link>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------- vragen --- */

  const v = vragen[idx];
  if (!v) return null;

  return (
    <div>
      <div className="mb-5 flex items-baseline justify-between gap-3">
        <p className="text-[12.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
          {fase === "grammatica"
            ? v.moduleTitle
            : `Woordenschat · band ${v.band} van ${plan.bands.length}`}
        </p>
        <p className="tabular text-[12.5px] text-ink-muted">
          {idx + 1} / {vragen.length}
        </p>
      </div>

      <p className="mb-4 text-[16px] font-bold text-ink">
        {fase === "grammatica" ? v.prompt : "Wat betekent dit woord?"}
      </p>

      {fase === "woorden" ? (
        <p className="hr-text mb-4 rounded-xl border border-line bg-sunken px-5 py-4 text-center text-[22px] font-semibold text-ink">
          {v.prompt}
        </p>
      ) : v.given ? (
        <p className="hr-text mb-4 whitespace-pre-line rounded-xl border border-line bg-sunken px-5 py-4 text-center text-[20px] font-semibold leading-snug text-ink">
          {v.given}
        </p>
      ) : null}

      <div className="grid gap-2">
        {v.options.map((opt) => {
          const gekozen = keuze === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => setKeuze(opt)}
              className={`rounded-card border px-4 py-3 text-left text-[14.5px] transition-colors ${
                gekozen
                  ? "border-accent bg-accent-wash text-ink"
                  : "border-line bg-surface text-ink-secondary hover:border-accent-ring"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[12.5px] text-ink-muted">Geen feedback tot het eind.</p>
        <button
          type="button"
          onClick={volgende}
          disabled={keuze === null || bezig}
          className="btn btn-primary px-6 py-2.5 text-[14px] disabled:opacity-40"
        >
          Volgende
        </button>
      </div>
    </div>
  );
}
