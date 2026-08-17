"use client";

import { useState, useTransition } from "react";

import type { Leech } from "@/lib/stages";

/**
 * Woorden die uit de rotatie zijn gehaald.
 *
 * §6.4: een item met zes of meer missers blijft anders eindeloos frustratie
 * produceren — je ziet het telkens terug, je weet het telkens niet, en het
 * verdringt woorden die wél zouden blijven hangen. Eruit halen is geen
 * opgeven, maar het lijstje moet wél zichtbaar zijn: een woord dat stilletjes
 * verdwijnt, is erger dan een woord dat te vaak terugkomt.
 *
 * Terugzetten is een bewuste handeling, en dan met een schone lei — anders is
 * één misstap genoeg om er meteen weer uit te vallen.
 */
export function LeechList({
  leeches,
  onRestore,
}: {
  leeches: Leech[];
  onRestore: (cardId: number) => Promise<void>;
}) {
  const [hersteld, setHersteld] = useState<Set<number>>(new Set());
  const [bezig, startTransition] = useTransition();

  const over = leeches.filter((l) => !hersteld.has(l.cardId));
  if (!over.length) return null;

  return (
    <section className="mb-8 rounded-card bg-gold-wash px-5 py-5">
      <h2 className="text-[14.5px] font-bold text-gold">
        {over.length} {over.length === 1 ? "woord staat" : "woorden staan"} even uit de rotatie
      </h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
        Deze gingen te vaak mis. Ze komen niet meer vanzelf langs, zodat ze de rest niet
        verdringen. Zet ze terug wanneer je er met frisse ogen naar wilt kijken — een nieuw
        voorbeeld of een ezelsbruggetje helpt meer dan nog een poging.
      </p>

      <ul className="mt-4 flex flex-col gap-2">
        {over.map((l) => (
          <li key={l.cardId} className="flex flex-wrap items-center justify-between gap-3">
            <span className="hr-text text-[15px] text-ink">{l.label}</span>
            <span className="flex items-center gap-3">
              <span className="tabular text-[12px] text-ink-muted">{l.lapses}× mis</span>
              <button
                type="button"
                disabled={bezig}
                onClick={() =>
                  startTransition(async () => {
                    await onRestore(l.cardId);
                    setHersteld((s) => new Set(s).add(l.cardId));
                  })
                }
                className="btn btn-ghost px-3 py-1.5 text-[12.5px] disabled:opacity-50"
              >
                Terugzetten
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
