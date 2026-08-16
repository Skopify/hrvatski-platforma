import { croatianSpeech, azureConfigured } from "@/lib/speech/azure";

/**
 * Levert een Kroatische opname als mp3.
 *
 * Geeft 204 zonder inhoud als er geen Azure-sleutel is. De client leest dat als
 * "gebruik de browserstem" en de luisteroefening blijft gewoon werken.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const text = (url.searchParams.get("tekst") ?? "").slice(0, 600);
  const voice = url.searchParams.get("stem") ?? undefined;
  const rate = Number(url.searchParams.get("tempo") ?? "1");

  if (!text.trim()) return new Response("geen tekst", { status: 400 });
  if (!azureConfigured()) return new Response(null, { status: 204 });

  const audio = await croatianSpeech(text, voice, Number.isFinite(rate) ? rate : 1);
  if (!audio) return new Response(null, { status: 204 });

  return new Response(new Uint8Array(audio), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Content-Length": String(audio.length),
      // De opname verandert nooit voor dezelfde parameters: de cachesleutel
      // bevat de tekst, de stem én het tempo.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
