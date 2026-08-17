"use client";

import type { Paradigm } from "@/lib/content";

import { useEffect, useRef } from "react";

import type { PresentedExercise } from "@/lib/present";
import { SpecialChars } from "./SpecialChars";
import { TTS_RATES, type TtsState } from "@/lib/tts";

export type Answer =
  | { kind: "text"; value: string }
  | { kind: "choice"; value: string }
  | { kind: "match"; value: Record<string, string> }
  | { kind: "order"; value: string[] };

export function emptyAnswer(ex: PresentedExercise): Answer {
  switch (ex.type) {
    case "interpret":
    case "choice":
      return { kind: "choice", value: "" };
    case "match":
      return { kind: "match", value: {} };
    case "word_order":
      return { kind: "order", value: [] };
    default:
      return { kind: "text", value: "" };
  }
}

export function isAnswered(a: Answer): boolean {
  if (a.kind === "text" || a.kind === "choice") return a.value.trim().length > 0;
  if (a.kind === "order") return a.value.length > 0;
  return Object.keys(a.value).length > 0;
}

/** Minimale opmaak in uitlegteksten: **vet**, *cursief* en alinea's. */
/**
 * Een paradigmatabel binnen een uitlegmoment.
 *
 * Voor dit soort regels is een tabel geen versiering: het contrast tussen twee
 * kolommen ís de les. In lopende tekst moet je vijf voorbeelden onthouden om het
 * patroon te zien; naast elkaar zie je het in één blik.
 */
function MiniParadigm({ table }: { table: Paradigm }) {
  return (
    <figure className="mt-4 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted" />
            {table.columns.map((c) => (
              <th
                key={c}
                className="pb-2 pr-3 text-[11px] font-bold uppercase tracking-[0.06em] text-ink-muted"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className="border-t border-line/60">
              <th className="py-2 pr-3 text-[12.5px] font-medium text-ink-secondary">
                {row.label}
              </th>
              {row.cells.map((cell, i) => (
                <td key={i} className="hr-text py-2 pr-3 text-[15.5px] font-semibold text-ink">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.caption_nl ? (
        <figcaption className="mt-2 text-[12px] text-ink-muted">{table.caption_nl}</figcaption>
      ) : null}
    </figure>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n\n").map((para, i) => (
        <p key={i} className="mb-3 text-[14.5px] leading-[1.65] text-ink-secondary last:mb-0">
          {para.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((chunk, j) => {
            if (chunk.startsWith("**") && chunk.endsWith("**")) {
              return (
                <strong key={j} className="hr-text font-semibold text-ink">
                  {chunk.slice(2, -2)}
                </strong>
              );
            }
            if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
              return (
                <em key={j} className="hr-text italic text-ink">
                  {chunk.slice(1, -1)}
                </em>
              );
            }
            return <span key={j}>{chunk}</span>;
          })}
        </p>
      ))}
    </>
  );
}

function PlayButton({ text, tts }: { text: string; tts: TtsState }) {
  if (!tts.supported) return null;
  const unavailable = tts.ready && !tts.voice;
  return (
    <button
      type="button"
      onClick={() => tts.speak(text)}
      disabled={unavailable}
      title={
        unavailable
          ? "Geen Kroatische stem geïnstalleerd — zie de melding onder Voortgang"
          : "Uitspreken"
      }
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-secondary transition-colors hover:border-accent-ring hover:bg-accent-wash hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M3 6v4h2.5L9 13V3L5.5 6H3Z"
          fill="currentColor"
        />
        <path
          d="M11 5.5a3.5 3.5 0 0 1 0 5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      {tts.speaking ? "Speelt af" : "Beluister"}
    </button>
  );
}

/**
 * Spreeksnelheid, en die keuze blijft staan.
 *
 * Er stond hier eerst een losse knop "langzamer" die één keer langzaam
 * afspeelde. Omdat de volgende luisteroefening zichzelf meteen op normaal
 * tempo afspeelt, was dat effect telkens weg voordat je het merkte.
 */
function SpeedPicker({ tts }: { tts: TtsState }) {
  if (!tts.supported || !tts.voice) return null;
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-sunken p-1">
      {TTS_RATES.map((r) => (
        <button
          key={r.value}
          type="button"
          onClick={() => tts.setRate(r.value)}
          aria-pressed={tts.rate === r.value}
          className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
            tts.rate === r.value
              ? "bg-surface text-accent shadow-[var(--lift-1)]"
              : "text-ink-muted hover:text-ink-secondary"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

export function ExerciseView({
  exercise,
  answer,
  setAnswer,
  locked,
  tts,
}: {
  exercise: PresentedExercise;
  answer: Answer;
  setAnswer: (a: Answer) => void;
  locked: boolean;
  tts: TtsState;
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!locked) inputRef.current?.focus();
  }, [exercise.id, locked]);

  // Bij een luisteroefening speelt de zin automatisch bij binnenkomst.
  useEffect(() => {
    if (exercise.type === "listen_type" && exercise.audio && tts.voice) {
      const t = setTimeout(() => tts.speak(exercise.audio!), 250);
      return () => clearTimeout(t);
    }
  }, [exercise.id, exercise.type, exercise.audio, tts.voice]);

  const insert = (ch: string) => {
    const el = inputRef.current;
    if (!el || answer.kind !== "text") return;
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const next = answer.value.slice(0, start) + ch + answer.value.slice(end);
    setAnswer({ kind: "text", value: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + ch.length, start + ch.length);
    });
  };

  const textInput = (placeholder: string) => (
    <div className="space-y-3">
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        type="text"
        value={answer.kind === "text" ? answer.value : ""}
        onChange={(e) => setAnswer({ kind: "text", value: e.target.value })}
        disabled={locked}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="hr-text w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[18px] font-medium text-ink shadow-[var(--lift-1)] outline-none transition-all duration-200 placeholder:font-normal placeholder:text-ink-muted focus:border-accent focus:shadow-[0_0_0_4px_var(--color-accent-ring)] disabled:bg-sunken disabled:text-ink-secondary"
      />
      {!locked ? <SpecialChars onInsert={insert} /> : null}
    </div>
  );

  switch (exercise.type) {
    /* ------------------------------------------------------------ lezen --- */
    case "reading": {
      const lines = (exercise.given ?? "").split("\n").filter(Boolean);
      return (
        <div className="space-y-4">
          <div className="card px-5 py-5">
            <div className="mb-3.5 flex items-center justify-between gap-3">
              <p className="text-[10.5px] font-bold uppercase tracking-[0.07em] text-ink-muted">
                Lees en luister
              </p>
              <PlayButton text={lines.map((l) => l.replace(/^[^:]{2,14}:\s*/, "")).join(" ")} tts={tts} />
            </div>
            <div className="space-y-1.5">
              {lines.map((line, i) => {
                const m = line.match(/^([^:]{2,14}):\s*(.*)$/);
                return (
                  <p key={i} className="hr-text reading text-[17px] leading-[1.7] text-ink">
                    {m ? (
                      <>
                        <span className="mr-2 inline-block min-w-[84px] font-sans text-[12.5px] font-semibold text-accent">
                          {m[1]}
                        </span>
                        <button
                          type="button"
                          onClick={() => tts.speak(m[2])}
                          disabled={!tts.voice}
                          className="text-left transition-colors hover:text-accent disabled:cursor-default disabled:hover:text-ink"
                        >
                          {m[2]}
                        </button>
                      </>
                    ) : (
                      line
                    )}
                  </p>
                );
              })}
            </div>
          </div>

          {exercise.body_nl ? (
            <details className="rounded-card border border-line bg-sunken px-5 py-3.5">
              <summary className="cursor-pointer text-[13px] text-ink-secondary transition-colors hover:text-accent">
                Vertaling tonen
              </summary>
              <div className="mt-3 space-y-1 text-[13.5px] leading-relaxed text-ink-secondary">
                {exercise.body_nl.split("\n").map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </details>
          ) : null}

          <p className="text-[12px] leading-relaxed text-ink-muted">
            Probeer eerst zonder vertaling te begrijpen wat er gebeurt. Wat je uit de context
            haalt, blijft beter hangen dan wat je vertaald krijgt.
          </p>
        </div>
      );
    }

    /* ------------------------------------------------------ uitlegmoment --- */
    // Warm in plaats van groen: groen is nu de kleur van 'goed', en uitleg is geen
    // beoordeling.
    case "teaching_moment":
      return (
        <div className="rounded-card relative overflow-hidden bg-gold-wash px-5 py-5">
          <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gold-bright" />
          <p className="mb-2.5 flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.07em] text-gold">
            <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
              <path
                d="M8 1.5a4.5 4.5 0 0 0-2.6 8.2c.4.3.6.7.6 1.1v.4h4v-.4c0-.4.2-.8.6-1.1A4.5 4.5 0 0 0 8 1.5ZM6.2 13.2h3.6M6.8 14.8h2.4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
            </svg>
            {exercise.prompt_nl}
          </p>
          {exercise.body_nl ? <RichText text={exercise.body_nl} /> : null}
          {exercise.table ? <MiniParadigm table={exercise.table} /> : null}
        </div>
      );

    /* ------------------------------------------------------------- match --- */
    case "match": {
      const hr = exercise.matchHr ?? [];
      const nl = exercise.matchNl ?? [];
      const mapping = answer.kind === "match" ? answer.value : {};
      const usedNl = new Set(Object.values(mapping));

      return (
        <div className="space-y-3">
          {hr.map((h) => (
            <div key={h} className="grid grid-cols-[1fr_auto_1.4fr] items-center gap-3">
              <span className="hr-text rounded-lg border border-line bg-surface px-3.5 py-2.5 text-[15px] text-ink">
                {h}
              </span>
              <span className="text-ink-muted">→</span>
              <select
                value={mapping[h] ?? ""}
                disabled={locked}
                onChange={(e) =>
                  setAnswer({ kind: "match", value: { ...mapping, [h]: e.target.value } })
                }
                className="w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] text-ink outline-none transition-colors focus:border-accent disabled:bg-sunken"
              >
                <option value="">Kies…</option>
                {nl.map((n) => (
                  <option key={n} value={n} disabled={usedNl.has(n) && mapping[h] !== n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      );
    }

    /* ------------------------------------------------------------ choice --- */
    case "interpret":
      // Kies de betekenis, niet de vorm. De Kroatische zin staat groot en alleen;
      // de opties zijn Nederlands en krijgen dus géén hr-text. Dat onderscheid is
      // niet cosmetisch: het maakt zichtbaar dat de vráág Kroatisch is en het
      // ántwoord over betekenis gaat.
      return (
        <div className="space-y-4">
          {exercise.given ? (
            <p className="hr-text rounded-xl border border-line bg-sunken px-5 py-4 text-center text-[22px] font-semibold leading-snug text-ink">
              {exercise.given}
            </p>
          ) : null}
          {exercise.hint ? (
            <p className="text-center text-[12.5px] text-ink-muted">{exercise.hint}</p>
          ) : null}
          <div className="grid gap-2">
            {(exercise.options ?? []).map((opt) => {
              const selected = answer.kind === "choice" && answer.value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={locked}
                  onClick={() => setAnswer({ kind: "choice", value: opt })}
                  className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left text-[15px] leading-snug transition-all duration-200 ${
                    selected
                      ? "border-accent bg-accent-wash text-accent shadow-[0_0_0_3px_var(--color-accent-ring)]"
                      : "border-line bg-surface text-ink hover:-translate-y-px hover:border-accent-ring hover:bg-accent-wash"
                  } disabled:cursor-not-allowed`}
                >
                  <span
                    aria-hidden
                    className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      selected ? "border-accent bg-accent" : "border-line-strong bg-transparent"
                    }`}
                  />
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );

    case "choice":
      return (
        <div className="space-y-3">
          {exercise.given ? (
            <p className="hr-text rounded-xl border border-line bg-sunken px-4 py-3 text-[17px] text-ink">
              {exercise.given}
            </p>
          ) : null}
          <div className="grid gap-2">
            {(exercise.options ?? []).map((opt) => {
              const selected = answer.kind === "choice" && answer.value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  disabled={locked}
                  onClick={() => setAnswer({ kind: "choice", value: opt })}
                  className={`hr-text group flex items-center gap-3 rounded-2xl border px-4 py-3 text-left text-[15.5px] font-medium transition-all duration-200 ${
                    selected
                      ? "border-accent bg-accent-wash text-accent shadow-[0_0_0_3px_var(--color-accent-ring)]"
                      : "border-line bg-surface text-ink hover:-translate-y-px hover:border-accent-ring hover:bg-accent-wash"
                  } disabled:cursor-not-allowed`}
                >
                  <span
                    aria-hidden
                    className={`h-4 w-4 shrink-0 rounded-full border-2 transition-colors ${
                      selected ? "border-accent bg-accent" : "border-line-strong bg-transparent"
                    }`}
                  />
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      );

    /* -------------------------------------------------------- word_order --- */
    case "word_order": {
      const chosen = answer.kind === "order" ? answer.value : [];
      const pool = (exercise.tokens ?? []).filter(
        (t, i) => !chosen.includes(`${t}\u0000${i}`) && !chosen.includes(t),
      );
      return (
        <div className="space-y-4">
          <div className="flex min-h-[62px] flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-line-strong bg-sunken px-3.5 py-3.5">
            {chosen.length === 0 ? (
              <span className="text-[13px] text-ink-muted">
                Klik de woorden in de juiste volgorde
              </span>
            ) : (
              chosen.map((t, i) => (
                <button
                  key={`${t}-${i}`}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setAnswer({ kind: "order", value: chosen.filter((_, j) => j !== i) })
                  }
                  className="hr-text animate-pop rounded-xl bg-accent px-3.5 py-2 text-[15.5px] font-semibold text-white shadow-[var(--lift-1)] transition-transform hover:-translate-y-px"
                >
                  {t}
                </button>
              ))
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {pool.map((t, i) => (
              <button
                key={`${t}-${i}`}
                type="button"
                disabled={locked}
                onClick={() => setAnswer({ kind: "order", value: [...chosen, t] })}
                className="hr-text rounded-xl border border-line bg-surface px-3.5 py-2 text-[15.5px] font-medium text-ink shadow-[var(--lift-1)] transition-all duration-200 hover:-translate-y-px hover:border-accent-ring hover:bg-accent-wash hover:text-accent"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      );
    }

    /* -------------------------------------------------------- listen_type --- */
    case "listen_type":
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <PlayButton text={exercise.audio ?? ""} tts={tts} />
            <SpeedPicker tts={tts} />
          </div>
          {tts.ready && !tts.voice ? (
            <p className="rounded-lg border border-line bg-warn-wash px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-secondary">
              Er is geen Kroatische stem geïnstalleerd, dus deze oefening kan niet worden
              voorgelezen. Zie <span className="font-medium">Voortgang → Audio</span> voor de
              installatie. Je kunt de oefening overslaan.
            </p>
          ) : null}
          {textInput("Typ wat je hoort…")}
        </div>
      );

    /* --------------------------------------------------- free_production --- */
    case "free_production":
      return (
        <div className="space-y-4">
          {exercise.given ? (
            <div className="flex items-center gap-3">
              <p className="hr-text flex-1 rounded-xl border border-line bg-sunken px-4 py-3 text-[17px] text-ink">
                {exercise.given}
              </p>
              <PlayButton text={exercise.given} tts={tts} />
            </div>
          ) : null}
          <textarea
            ref={inputRef as React.Ref<HTMLTextAreaElement>}
            value={answer.kind === "text" ? answer.value : ""}
            onChange={(e) => setAnswer({ kind: "text", value: e.target.value })}
            disabled={locked}
            rows={3}
            placeholder={exercise.placeholder ?? "Schrijf je antwoord in het Kroatisch…"}
            spellCheck={false}
            className="hr-text w-full resize-none rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-accent disabled:bg-sunken"
          />
          {!locked ? <SpecialChars onInsert={insert} /> : null}
          {/* Na inzending herhaalt het modelpaneel deze criteria — niet dubbel tonen. */}
          {!locked && exercise.rubric_nl?.length ? (
            <ul className="space-y-1 text-[12.5px] text-ink-muted">
              {exercise.rubric_nl.map((r) => (
                <li key={r}>· {r}</li>
              ))}
            </ul>
          ) : null}
        </div>
      );

    /* ------------------------------------------- cloze / vertalen / fout --- */
    default: {
      const blanks = exercise.given ? (exercise.given.match(/_{2,}/g) ?? []).length : 0;
      const single = blanks === 1 && exercise.type === "cloze";

      if (single && exercise.given) {
        const [before, after] = exercise.given.split(/_{2,}/);
        return (
          <div className="space-y-3">
            <p className="hr-text flex flex-wrap items-center gap-x-1.5 gap-y-2 text-[19px] leading-relaxed text-ink">
              <span>{before}</span>
              <input
                ref={inputRef as React.Ref<HTMLInputElement>}
                type="text"
                value={answer.kind === "text" ? answer.value : ""}
                onChange={(e) => setAnswer({ kind: "text", value: e.target.value })}
                disabled={locked}
                autoComplete="off"
                spellCheck={false}
                size={Math.max(8, 10)}
                className="hr-text w-[8.5ch] min-w-[8.5ch] border-b-2 border-accent-ring bg-transparent px-1 py-0.5 text-center text-[19px] text-accent outline-none transition-colors focus:border-accent disabled:border-line"
              />
              <span>{after}</span>
            </p>
            {!locked ? <SpecialChars onInsert={insert} /> : null}
          </div>
        );
      }

      return (
        <div className="space-y-4">
          {exercise.given ? (
            <div className="flex items-start gap-3">
              <p
                className={`hr-text flex-1 rounded-xl px-4 py-3 text-[17px] leading-relaxed ${
                  exercise.type === "error_correction"
                    ? "border border-bad-wash bg-bad-wash text-ink"
                    : "border border-line bg-sunken text-ink"
                }`}
              >
                {exercise.given}
              </p>
              {exercise.type === "translate_hr_nl" || exercise.type === "error_correction" ? (
                <PlayButton text={exercise.given} tts={tts} />
              ) : null}
            </div>
          ) : null}
          {textInput(
            exercise.type === "translate_hr_nl" ? "Typ de Nederlandse vertaling…" : "Typ je antwoord…",
          )}
        </div>
      );
    }
  }
}
