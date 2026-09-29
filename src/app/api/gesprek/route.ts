import { beurt, bouwPrompt, loadScenario, woordenTotLes, type Bericht } from "@/lib/gesprek";
import { MODEL, ollamaChat, ollamaStatus } from "@/lib/ollama";

export const dynamic = "force-dynamic";

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
    body = await request.json();
  } catch {
    return Response.json({ ok: false, reden: "fout", detail: "ongeldig verzoek" }, { status: 400 });
  }

  // Vertaling op verzoek: kort en apart, zodat gewone beurten sneller zijn.
  if (typeof body.vertaal === "string" && body.vertaal.trim()) {
    try {
      const ruw = await ollamaChat(
        [
          {
            role: "system",
            content:
              'Translate the Croatian sentence into natural Dutch. Reply ONLY with JSON: {"nl": "the Dutch translation"}.',
          },
          { role: "user", content: body.vertaal.slice(0, 300) },
        ],
        60_000,
        { num_predict: 80 },
      );
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
      await ollamaChat(
        [
          { role: "system", content: bouwPrompt(scenario, woordenTotLes(les)) },
          { role: "user", content: scenario.opening_hr },
        ],
        120_000,
        { num_predict: 1 },
      );
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

  const uitkomst = await beurt({
    scenario,
    les,
    historie: schoon,
    generate: (berichten) => ollamaChat(berichten),
  });
  return Response.json(uitkomst);
}
