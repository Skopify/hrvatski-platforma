"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { resetAllProgress } from "@/app/actions";

/**
 * Opnieuw beginnen.
 *
 * Waarom dit meer is dan één knop: dit wist het reviewlogboek, en dat is het
 * enige in het platform dat je niet kunt terugverdienen door harder te
 * studeren — het is de opname van hoe jouw geheugen zich over maanden heeft
 * gedragen. Daarom eerst zien wát je kwijtraakt, dan een woord intypen, en
 * schrijft de server hoe dan ook een kopie weg voordat er iets verdwijnt.
 */
export function ResetProgress({
  samenvatting,
}: {
  samenvatting: { xp: number; attempts: number; reviews: number; lessonsDone: number; days: number };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [woord, setWoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [klaar, setKlaar] = useState<{ ok: boolean; message: string } | null>(null);

  const leeg =
    samenvatting.xp === 0 && samenvatting.attempts === 0 && samenvatting.reviews === 0;

  if (klaar?.ok) {
    return (
      <section className="rounded-card border border-good/30 bg-good-wash p-6">
        <h2 className="text-[13.5px] font-medium text-good-ink">Opnieuw begonnen</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-good-ink">{klaar.message}</p>
      </section>
    );
  }

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="text-[13.5px] font-medium text-ink">Opnieuw beginnen</h2>
      <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-secondary">
        Wist je XP, reeks, herhaalplanning, antwoorden en welke lessen open staan. De
        leerstof zelf blijft staan, en de opgeslagen audio ook — die is bij Azure
        opgehaald en zou opnieuw tekens kosten.
      </p>

      {leeg ? (
        <p className="mt-4 rounded-lg bg-sunken px-4 py-3 text-[12.5px] text-ink-secondary">
          Er staat nog geen voortgang om te wissen.
        </p>
      ) : !open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 rounded-full border border-bad/40 bg-surface px-4 py-2 text-[12.5px] font-medium text-bad-ink transition-colors hover:bg-bad-wash"
        >
          Voortgang resetten…
        </button>
      ) : (
        <div className="mt-4 rounded-lg border border-bad/30 bg-bad-wash px-4 py-4">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-bad-ink">
            Dit raak je kwijt
          </p>
          <ul className="tabular mt-2.5 grid gap-x-6 gap-y-1 text-[12.5px] text-ink-secondary sm:grid-cols-2">
            <li>{samenvatting.xp.toLocaleString("nl-NL")} XP</li>
            <li>{samenvatting.attempts.toLocaleString("nl-NL")} antwoorden</li>
            <li>{samenvatting.reviews.toLocaleString("nl-NL")} herhalingen in het logboek</li>
            <li>{samenvatting.lessonsDone} afgeronde lessen</li>
            <li>{samenvatting.days} studiedagen</li>
          </ul>

          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-secondary">
            Er wordt eerst een kopie van je database weggeschreven in{" "}
            <span className="font-medium">data/backups/</span>, dus dit is terug te draaien.
            Typ <span className="font-bold text-ink">RESET</span> om door te gaan.
          </p>

          {klaar && !klaar.ok ? (
            <p className="mt-3 text-[12.5px] font-medium text-bad-ink">{klaar.message}</p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={woord}
              onChange={(e) => setWoord(e.target.value)}
              placeholder="RESET"
              aria-label="Typ RESET om te bevestigen"
              className="w-32 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink outline-none focus:border-accent-ring"
            />
            <button
              type="button"
              disabled={bezig || woord.trim().toUpperCase() !== "RESET"}
              onClick={async () => {
                setBezig(true);
                try {
                  const r = await resetAllProgress(woord);
                  setKlaar(r);
                  if (r.ok) router.refresh();
                } finally {
                  setBezig(false);
                }
              }}
              className="rounded-full bg-bad px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-bad-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              {bezig ? "Bezig…" : "Definitief wissen"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setWoord("");
                setKlaar(null);
              }}
              className="text-[12.5px] text-ink-muted hover:text-ink-secondary"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
