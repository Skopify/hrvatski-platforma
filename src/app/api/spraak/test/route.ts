import { testAzure } from "@/lib/speech/azure";

/** Eén proefaanroep naar Azure, zodat een instelfout een oorzaak krijgt. */
export async function GET() {
  return Response.json(await testAzure());
}
