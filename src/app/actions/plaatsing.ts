"use server";


export interface PlacementModuleBlock {
  code: string;
  title: string;
  rank: number;
  probes: import("@/lib/placement").GrammarProbe[];
}

export interface PlacementPlan {
  /**
   * 0 zolang er nog geen antwoord gegeven is.
   *
   * De rij in `placement_run` werd vroeger bij het opbouwen van dit plan
   * weggeschreven — dus bij het openen van de pagina. Wie even keek en
   * wegklikte, liet een lege toets achter; er stonden er vijf. Erger dan
   * rommel: een lijst met onafgemaakte toetsen suggereert dat er vijf keer
   * begonnen en vijf keer opgegeven is, en dat is niet gebeurd.
   */
  runId: number;
  modules: PlacementModuleBlock[];
  bands: { n: number; label: string; probes: import("@/lib/placement").VocabProbe[] }[];
  startBand: number;
}

/**
 * De toets klaarzetten.
 *
 * Alles wordt in één keer meegegeven, ook de banden die je misschien nooit te
 * zien krijgt. Dat is geen verspilling maar een keuze: de adaptieve stappen
 * gebeuren in de browser, zodat er tussen twee vragen geen wachttijd zit. Bij
 * een toets is dat belangrijker dan bij een oefening — wachten nodigt uit tot
 * nadenken, en dan meet je iets anders dan wat je wilde meten.
 */
export async function beginPlacement(scope?: string): Promise<PlacementPlan> {
  const P = await import("@/lib/placement");
  const { modulesByRank, loadModule } = await import("@/lib/modules");

  const lijst = scope ? [loadModule(scope)].filter(Boolean) : modulesByRank();

  return {
    // De toets bestaat pas als er iets gemeten is; zie answerPlacement*.
    runId: 0,
    modules: lijst.map((m) => ({
      code: m!.code,
      title: m!.title_nl,
      rank: m!.rank,
      probes: P.grammarProbes(m!),
    })),
    // Bij een hertoets van één module blijft de woordenschat buiten beschouwing.
    bands: scope
      ? []
      : P.vocabBands().map((b) => ({ n: b.n, label: b.label, probes: P.vocabProbes(b) })),
    startBand: P.START_BAND,
  };
}

/**
 * Een grammatica-antwoord vastleggen, en de toets aanmaken als dit het eerste is.
 *
 * Geeft het nummer van de toets terug, omdat dat bij het eerste antwoord pas
 * ontstaat. De browser onthoudt het en stuurt het bij het volgende antwoord mee.
 */
export async function answerPlacementGrammar(
  runId: number,
  moduleCode: string,
  exerciseId: string,
  correct: boolean,
  durationMs: number,
  scope?: string,
): Promise<number> {
  const P = await import("@/lib/placement");
  const id = runId > 0 ? runId : P.startRun(scope ? "module" : "volledig", scope);
  P.recordGrammar(id, moduleCode, exerciseId, correct, durationMs);
  return id;
}

export async function answerPlacementVocab(
  runId: number,
  band: number,
  itemId: string,
  correct: boolean,
  durationMs: number,
  scope?: string,
): Promise<number> {
  const P = await import("@/lib/placement");
  const id = runId > 0 ? runId : P.startRun(scope ? "module" : "volledig", scope);
  P.recordVocab(id, band, itemId, correct, durationMs);
  return id;
}

export async function endPlacement(
  runId: number,
): Promise<import("@/lib/placement").PlacementResult> {
  const P = await import("@/lib/placement");
  // Zonder één beantwoorde vraag is er niets om af te sluiten.
  if (runId <= 0) return { runId: 0, modules: [], grens: null, gemeten: 0, aangenomen: 0 };
  return P.finishRun(runId);
}

/** Een module terugzetten op ongemeten — de weg terug uit "beheerst". */
export async function clearPlacement(code: string): Promise<void> {
  const P = await import("@/lib/placement");
  P.clearModuleStatus(code);
}
