/*
  De verbinding met Ollama, het gratis model op je eigen computer.

  Alles blijft lokaal: er gaat niets naar buiten en er is geen sleutel. Het
  model is één instelling (HRVATSKI_MODEL); wil je later een sterker model,
  dan verander je die ene regel.
*/
export const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
export const MODEL = process.env.HRVATSKI_MODEL ?? "gemma3:12b";

export interface ModelBericht {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Eén antwoord als JSON-tekst. Gooit bij een storing; de aanroeper beslist wat dat betekent. */
export async function ollamaChat(
  berichten: ModelBericht[],
  timeoutMs = 120_000,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: berichten,
      stream: false,
      format: "json",
      keep_alive: "30m",
      options: { temperature: 0.3, num_ctx: 4096, ...extra },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const tekst = await res.text().catch(() => "");
    throw Object.assign(new Error(`Ollama ${res.status}: ${tekst.slice(0, 200)}`), { status: res.status });
  }
  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? "";
}

export type OllamaStatus =
  | { staat: "klaar"; model: string }
  | { staat: "offline" }
  | { staat: "model-ontbreekt"; model: string };

export async function ollamaStatus(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    if (!res.ok) return { staat: "offline" };
    const data = (await res.json()) as { models?: { name: string }[] };
    const heeft = (data.models ?? []).some((m) => m.name === MODEL || m.name.startsWith(`${MODEL}:`));
    return heeft ? { staat: "klaar", model: MODEL } : { staat: "model-ontbreekt", model: MODEL };
  } catch {
    return { staat: "offline" };
  }
}
