import { eisGebruiker } from "@/lib/accounts/api";
import { testAzure } from "@/lib/speech/azure";

/** Eén proefaanroep naar Azure, zodat een instelfout een oorzaak krijgt. */
export async function GET(request: Request) {
  const ingelogd = eisGebruiker(request);
  if ("fout" in ingelogd) return ingelogd.fout;
  return Response.json(await testAzure());
}
