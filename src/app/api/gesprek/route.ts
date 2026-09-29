import { beurt, bouwPrompt, loadScenario, woordenTotLes, type Bericht } from "@/lib/gesprek";
import { MODEL, ollamaChat, ollamaStatus } from "@/lib/ollama";

export const dynamic = "force-dynamic";

/*
  Eén model, één beurt tegelijk. Ollama zet gelijktijdige verzoeken toch in een
  rij, maar dan blijft elke aanvraag openstaan en bouwt een pagina die per
  ongeluk vaak ververst een stapel op. Hier wacht een verzoek zijn beurt af, en
  staan er meer dan drie te wachten, dan wijzen we het af.
*/
const MAX_WACHTRIJ = 3;
const MAX_BODY = 20_000;
let wachtrij: Promise<unknown> = Promise.resolve();
let wachtend = 0;

async function opDeBeurt<T>(werk: () => Promise<T>): Promise<T | "druk"> {
  if (wachtend >= MAX_WACHTRIJ) return "druk";
  wachtend++;
  const mijn = wachtrij.then(werk, werk);
  wachtrij = mijn.catch(() => undefined);
  try {
    return await mijn;
  } finally {
    wachtend--;
  }
}

/** Is Ollama bereikbaar, en staat het model erop? */
export async function GET() {
  return Response.json({ ...(await ollamaStatus()), model: MODEL });
}

/**
 * Eén beurt in een gesprek. De browser stuurt het scenario, het lexicon-niveau
 * en de geschiedenis; wat terugkomt is al door de taalpoorten gegaan.
 * Er wordt niets opgeslagen.
 */
export async function POST(request: Request) {
  let body: { scenario?: unknown; les?: unknown; historie?: unknown; warm?: unknown; vertaal?: unknown };
  try {
    const ruw = await request.text();
    if (ruw.length > MAX_BODY) {
      return Response.json({ ok: false, reden: "fout", detail: "verzoek te groot" }, { status: 413 });
    }
    body = JSON.parse(ruw);
  } catch {
    return Response.json({ ok: false, reden: "fout", detail: "ongeldig verzoek" }, { status: 400 });
  }

  // Vertaling op verzoek: kort en apart, zodat gewone beurten sneller zijn.
  if (typeof body.vertaal === "string" && body.vertaal.trim()) {
    const zin = body.vertaal.slice(0, 300);
    try {
      const uitkomst = await opDeBeurt(() => ollamaChat(
        [
          {
            role: "system",
            content:
              'Translate the Croatian sentence into natural Dutch. Reply ONLY with JSON: {"nl": "the Dutch translation"}.',
          },
          { role: "user", content: zin },
        ],
        60_000,
        { num_predict: 80 },
      ));
      if (uitkomst === "druk") return Response.json({ ok: false, nl: "" }, { status: 429 });
      const ruw = uitkomst;
      const nl = (JSON.parse(ruw) as { nl?: unknown }).nl;
      return Response.json({ ok: typeof nl === "string" && nl.trim() !== "", nl: typeof nl === "string" ? nl.trim() : "" });
    } catch {
      return Response.json({ ok: false, nl: "" });
    }
  }

  const scenario = typeof body.scenario === "string" ? loadScenario(body.scenario) : undefined;
  const les = Number(body.les);
  // Opwarmen: het model leest de prompt alvast, zodat je eerste antwoord niet
  // een halve minuut duurt. Er wordt bijna niets gegenereerd.
  if (body.warm === true && scenario && Number.isInteger(les) && les >= 0 && les <= 21) {
    try {
      await opDeBeurt(() => ollamaChat(
        [
          { role: "system", content: bouwPrompt(scenario, woordenTotLes(les)) },
          { role: "user", content: scenario.opening_hr },
        ],
        120_000,
        { num_predict: 1 },
      ));
    } catch {
      // Opwarmen is een gunst; falen is niet erg.
    }
    return Response.json({ ok: true });
  }

  const historie = Array.isArray(body.historie) ? body.historie : null;
  if (!scenario || !Number.isInteger(les) || les < 0 || les > 21 || !historie || historie.length > 40) {
    return Response.json({ ok: false, reden: "fout", detail: "ongeldig verzoek" }, { status: 400 });
  }

  const schoon: Bericht[] = [];
  for (const b of historie as { rol?: unknown; tekst?: unknown }[]) {
    if ((b.rol !== "bot" && b.rol !== "jij") || typeof b.tekst !== "string") {
      return Response.json({ ok: false, reden: "fout", detail: "ongeldig verzoek" }, { status: 400 });
    }
    schoon.push({ rol: b.rol, tekst: b.tekst.slice(0, 400) });
  }

  // De hele beurt (met eventuele nieuwe pogingen) houdt het model bezet.
  const uitkomst = await opDeBeurt(() =>
    beurt({ scenario, les, historie: schoon, generate: (berichten) => ollamaChat(berichten) }),
  );
  if (uitkomst === "druk") {
    return Response.json({ ok: false, reden: "fout", detail: "de bot is bezig, probeer het zo nog eens" }, { status: 429 });
  }
  return Response.json(uitkomst);
}
