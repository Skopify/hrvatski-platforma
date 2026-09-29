/*
  Draait één keer als de server start. Zet de klok aan die bepaalt wanneer
  het platform en Ollama zichzelf uitzetten (src/lib/levenscyclus.ts).
*/
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startWacht } = await import("./lib/levenscyclus");
    startWacht();
    // Telefoon en iPad: de poortwachter op het netwerk, alleen als dat aan staat.
    const { startPoortwachter } = await import("./lib/telefoon");
    startPoortwachter();
  }
}
