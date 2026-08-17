import { vocabQueue } from "@/app/actions";
import { VocabSession } from "@/components/VocabSession";

export const dynamic = "force-dynamic";

export default async function WoordenHerhalenPage() {
  // Herhalingen eerst, dan een gedoseerde portie nieuw — zie vocabQueue().
  const { questions, due, nieuw } = await vocabQueue(20, 8);
  return <VocabSession questions={questions} due={due} nieuw={nieuw} />;
}
