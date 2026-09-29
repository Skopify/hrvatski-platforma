"use server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";

/**
 * Vastleggen dat deze stap gehad is, vóór het doorschakelen.
 *
 * Spiegelbeeld van `markStepDone` voor lessen. Zonder dit begon een module na
 * het sluiten van het tabblad weer bij stap één — inclusief de uitleg die je al
 * gelezen had, en dat is precies waar iemand afhaakt.
 */
export async function markModuleStepDone(code: string, exerciseId: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  const row = db.select().from(moduleProgress).where(eq(moduleProgress.code, code)).get();

  if (!row) {
    db.insert(moduleProgress)
      .values({ code, stepsDone: [exerciseId], startedAt: Date.now(), completedAt: null })
      .run();
    return;
  }
  if (row.completedAt) {
    // Opnieuw begonnen na afronden: de teller loopt van voren af aan.
    db.update(moduleProgress)
      .set({ stepsDone: [exerciseId], startedAt: Date.now(), completedAt: null })
      .where(eq(moduleProgress.code, code))
      .run();
    return;
  }

  const done = new Set((row.stepsDone as string[] | null) ?? []);
  if (done.has(exerciseId)) return;
  done.add(exerciseId);
  db.update(moduleProgress)
    .set({ stepsDone: [...done] })
    .where(eq(moduleProgress.code, code))
    .run();
}

/** De module is uit. De stappenlijst wordt geleegd, zodat opnieuw ook echt opnieuw is. */
export async function completeModule(code: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  db.insert(moduleProgress)
    .values({ code, stepsDone: [], startedAt: Date.now(), completedAt: Date.now() })
    .onConflictDoUpdate({
      target: moduleProgress.code,
      set: { stepsDone: [], completedAt: Date.now() },
    })
    .run();
}

/** Opnieuw beginnen bij stap één, zonder de module af te ronden. */
export async function restartModule(code: string): Promise<void> {
  const { moduleProgress } = await import("@/lib/db/schema");
  db.insert(moduleProgress)
    .values({ code, stepsDone: [], startedAt: Date.now(), completedAt: null })
    .onConflictDoUpdate({
      target: moduleProgress.code,
      set: { stepsDone: [], startedAt: Date.now(), completedAt: null },
    })
    .run();
}
