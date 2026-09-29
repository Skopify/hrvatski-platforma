/*
  Samenvoeging voor scripts en tests, die alle acties uit één plek willen
  importeren. De browser importeert nooit hieruit: die haalt zijn acties uit
  het bestand van het domein (oefenen, drill, woorden, ...), zodat een pagina
  alleen de acties meestuurt die ze gebruikt.

  Dit bestand heeft bewust geen "use server": het is geen eindpunt, alleen een
  doorgeefluik.
*/
export * from "./oefenen";
export * from "./drill";
export * from "./verhalen";
export * from "./les";
export * from "./woorden";
export * from "./plaatsing";
export * from "./modules";
export * from "./nakijken";
export * from "./schrijven";
export type { AnswerPayload, Feedback, FeedbackStage } from "@/lib/leerlogboek";
