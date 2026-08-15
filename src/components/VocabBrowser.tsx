"use client";

import { useMemo, useState } from "react";

import type { VocabRecord } from "@/lib/stats";
import { useCroatianTts } from "@/lib/tts";

/*
  Het woordenboek.

  Twee dingen die een gewone woordenlijst niet doet:

  1. De grammaticale kern staat erbij — geslacht, genitief, meervoud, de ja-vorm.
     Zonder die velden moet je een Kroatisch woord later opnieuw leren.
  2. Elke rij toont zijn geheugenstand. Zo wordt de lijst een diagnose in plaats
     van een inventaris: je ziet welke woorden aan het weglekken zijn, niet
     alleen welke er bestaan.
*/

const POS_LABEL: Record<string, string> = {
  noun: "znw.",
  verb: "ww.",
  adj: "bnw.",
  adv: "bijw.",
  pron: "vnw.",
  prep: "vz.",
  num: "telw.",
  phrase: "uitdr.",
  interj: "tussenw.",
  conj: "voegw.",
};

type StatusFilter = "alle" | "nieuw" | "lekt" | "stevig";

/** Diakritisch-ongevoelig zoeken: "cokolada" moet čokolada vinden. */
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

export function VocabBrowser({ words }: { words: VocabRecord[] }) {
  const tts = useCroatianTts();
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("alle");
  const [status, setStatus] = useState<StatusFilter>("alle");
  const [limit, setLimit] = useState(120);

  const posOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of words) counts.set(w.pos, (counts.get(w.pos) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [words]);

  const filtered = useMemo(() => {
    const needle = fold(q.trim());
    return words.filter((w) => {
      if (pos !== "alle" && w.pos !== pos) return false;
      if (status === "nieuw" && w.retention !== null) return false;
      if (status === "lekt" && (w.retention === null || w.retention >= 0.9)) return false;
      if (status === "stevig" && (w.retention === null || w.retention < 0.9)) return false;
      if (!needle) return true;
      return (
        fold(w.hr).includes(needle) ||
        fold(w.nl).includes(needle) ||
        (w.gen_sg ? fold(w.gen_sg).includes(needle) : false) ||
        (w.nom_pl ? fold(w.nom_pl).includes(needle) : false)
      );
    });
  }, [words, q, pos, status]);

  const shown = filtered.slice(0, limit);
  const seenCount = words.filter((w) => w.retention !== null).length;

  return (
    <div>
      {/* Filters */}
      <div className="card mb-5 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setLimit(120);
              }}
              placeholder="Zoek in het Kroatisch of Nederlands…"
              autoComplete="off"
              spellCheck={false}
              className="hr-text w-full rounded-full border border-line bg-surface py-2.5 pl-10 pr-4 text-[14px] text-ink outline-none transition-all duration-200 placeholder:font-normal placeholder:text-ink-muted focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-ring)]"
            />
          </div>

          <select
            value={pos}
            onChange={(e) => {
              setPos(e.target.value);
              setLimit(120);
            }}
            className="rounded-full border border-line bg-surface px-4 py-2.5 text-[13px] font-medium text-ink-secondary outline-none focus:border-accent"
          >
            <option value="alle">Alle soorten</option>
            {posOptions.map(([p, n]) => (
              <option key={p} value={p}>
                {POS_LABEL[p] ?? p} ({n})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {(
            [
              ["alle", "Alles"],
              ["nieuw", "Nog niet gezien"],
              ["lekt", "Lekt weg"],
              ["stevig", "Stevig"],
            ] as [StatusFilter, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => {
                setStatus(val);
                setLimit(120);
              }}
              className={`rounded-full px-3 py-1 text-[12px] font-semibold transition-colors ${
                status === val
                  ? "bg-accent text-white"
                  : "bg-sunken text-ink-secondary hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="tabular ml-auto text-[12px] text-ink-muted">
            {filtered.length} van {words.length} · {seenCount} gezien
          </span>
        </div>
      </div>

      {/* Resultaten */}
      {shown.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center">
          <p className="text-[13.5px] text-ink-secondary">
            Geen woorden gevonden. Zoeken werkt ook zonder diakritische tekens — «cokolada»
            vindt čokolada.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {shown.map((w) => (
            <li key={w.id} className="card px-4 py-3">
              <div className="flex items-center gap-3">
                {/* Geheugenstand als smalle staaf links — kleur zegt genoeg. */}
                <span
                  aria-hidden
                  title={
                    w.retention === null
                      ? "Nog niet gezien"
                      : `Geschatte retentie ${Math.round(w.retention * 100)}%`
                  }
                  className="h-9 w-1 shrink-0 rounded-full"
                  style={{
                    background:
                      w.retention === null
                        ? "var(--color-line)"
                        : w.retention >= 0.9
                          ? "var(--color-good)"
                          : w.retention >= 0.7
                            ? "var(--color-gold-bright)"
                            : "var(--color-bad)",
                  }}
                />

                <div className="min-w-0 flex-[1.1]">
                  <div className="flex items-baseline gap-2">
                    <span className="hr-text truncate text-[15.5px] font-bold text-ink">
                      {w.hr}
                    </span>
                    <span className="shrink-0 text-[11px] text-ink-muted">
                      {POS_LABEL[w.pos] ?? w.pos}
                      {w.gender ? ` ${w.gender}.` : ""}
                    </span>
                  </div>
                  <p className="truncate text-[13px] text-ink-secondary">{w.nl}</p>
                </div>

                {/* De grammaticale kern */}
                <div className="hidden min-w-0 flex-1 gap-4 text-[12px] sm:flex">
                  {w.gen_sg ? (
                    <span className="min-w-0 truncate">
                      <span className="text-ink-muted">gen. </span>
                      <span className="hr-text text-ink-secondary">{w.gen_sg}</span>
                    </span>
                  ) : null}
                  {w.nom_pl ? (
                    <span className="min-w-0 truncate">
                      <span className="text-ink-muted">mv. </span>
                      <span className="hr-text text-ink-secondary">{w.nom_pl}</span>
                    </span>
                  ) : null}
                  {w.present_1sg ? (
                    <span className="min-w-0 truncate">
                      <span className="text-ink-muted">ja </span>
                      <span className="hr-text text-ink-secondary">{w.present_1sg}</span>
                    </span>
                  ) : null}
                </div>

                <span className="tabular hidden shrink-0 text-[11.5px] text-ink-muted md:block">
                  les {w.lesson}
                </span>

                {tts.voice ? (
                  <button
                    type="button"
                    onClick={() => tts.speak(w.hr)}
                    title="Uitspreken"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-accent-wash hover:text-accent"
                  >
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path d="M3 6v4h2.5L9 13V3L5.5 6H3Z" fill="currentColor" />
                      <path
                        d="M11 5.5a3.5 3.5 0 0 1 0 5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {filtered.length > shown.length ? (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setLimit((n) => n + 200)}
            className="btn btn-ghost px-5 py-2.5 text-[13.5px]"
          >
            Toon meer ({filtered.length - shown.length} over)
          </button>
        </div>
      ) : null}
    </div>
  );
}
