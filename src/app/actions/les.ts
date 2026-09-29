"use server";
import { binnen, tekst as begrensTekst } from "@/lib/valideer";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { resetProgress } from "@/lib/progress-reset";
import { items, lessonProgress, studySessions } from "@/lib/db/schema";

export async function startSession(kind: string, lesson: number | null): Promise<number> {
  kind = begrensTekst(kind, 40);
  lesson = lesson === null ? null : Math.round(binnen(lesson, 0, 99, 0));
  const row = db
    .insert(studySessions)
    .values({ kind, lesson, startedAt: Date.now() })
    .returning({ id: studySessions.id })
    .get();
  if (kind === "lesson" && lesson !== null) await markLessonStarted(lesson);
  return row.id;
}

export async function endSession(
  sessionId: number,
  stats: { xp: number; correct: number; total: number },
): Promise<void> {
  db.update(studySessions)
    .set({ endedAt: Date.now(), xp: stats.xp, correct: stats.correct, total: stats.total })
    .where(eq(studySessions.id, sessionId))
    .run();
}

/**
 * Onthoudt dat deze stap gehad is, zodat "Les hervatten" verdergaat in plaats
 * van opnieuw te beginnen.
 *
 * Er wordt een lijst met oefening-id's bijgehouden en geen positie in de rij.
 * Dat is met opzet: de laatste sectie van een les mengt er vervallen items van
 * vroeger doorheen, en welke dat zijn hangt af van je herhaalplanning. Die rij
 * ziet er morgen dus anders uit, en een opgeslagen index zou je dan midden in
 * iets anders laten landen.
 */
export async function markStepDone(lesson: number, exerciseId: string): Promise<void> {
  const row = db.select().from(lessonProgress).where(eq(lessonProgress.lesson, lesson)).get();
  if (!row || row.status === "done") return;

  const done = new Set((row.sectionsDone as string[] | null) ?? []);
  if (done.has(exerciseId)) return;
  done.add(exerciseId);

  db.update(lessonProgress)
    .set({ sectionsDone: [...done] })
    .where(eq(lessonProgress.lesson, lesson))
    .run();
}

export async function completeLesson(lesson: number): Promise<void> {
  // sectionsDone leegmaken: de les is af, dus wie hem opnieuw doet begint
  // vooraan in plaats van meteen op het eindscherm te belanden.
  db.insert(lessonProgress)
    .values({ lesson, status: "done", sectionsDone: [], completedAt: Date.now() })
    .onConflictDoUpdate({
      target: lessonProgress.lesson,
      set: { status: "done", sectionsDone: [], completedAt: Date.now() },
    })
    .run();

  // Volgende les openzetten als die bestaat.
  const next = db
    .select()
    .from(lessonProgress)
    .where(eq(lessonProgress.lesson, lesson + 1))
    .get();
  if (next && next.status === "locked") {
    db.update(lessonProgress)
      .set({ status: "available" })
      .where(eq(lessonProgress.lesson, lesson + 1))
      .run();
  }
}

export async function markLessonStarted(lesson: number): Promise<void> {
  const row = db.select().from(lessonProgress).where(eq(lessonProgress.lesson, lesson)).get();
  if (!row || row.status === "done") return;
  db.update(lessonProgress)
    .set({ status: "in_progress", startedAt: row.startedAt ?? Date.now() })
    .where(eq(lessonProgress.lesson, lesson))
    .run();
}

/**
 * Alle voortgang wissen.
 *
 * Er wordt eerst een kopie van de database weggeschreven; zie
 * src/lib/progress-reset.ts voor wat er precies verdwijnt en wat blijft staan.
 * Het bevestigingswoord komt van de client mee zodat één misklik nooit genoeg
 * is — de knop alleen kan de sessiegeschiedenis van maanden niet wissen.
 */
export async function resetAllProgress(
  confirmation: string,
): Promise<{ ok: boolean; backup?: string; message: string }> {
  if (confirmation.trim().toUpperCase() !== "RESET") {
    return { ok: false, message: "Bevestiging klopt niet — er is niets gewist." };
  }
  const { backup } = resetProgress();
  return {
    ok: true,
    backup,
    message: `Voortgang gewist. Er staat een kopie in ${backup}.`,
  };
}
