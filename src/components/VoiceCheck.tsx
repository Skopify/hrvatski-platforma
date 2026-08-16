"use client";

import { useCroatianTts } from "@/lib/tts";

export function VoiceCheck() {
  const tts = useCroatianTts();

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="text-[13.5px] font-medium text-ink">Audio</h2>

      {!tts.supported ? (
        <p className="mt-2.5 text-[13px] leading-relaxed text-ink-secondary">
          Deze browser ondersteunt geen spraaksynthese. Luisteroefeningen worden overgeslagen.
        </p>
      ) : !tts.ready ? (
        <p className="mt-2.5 text-[13px] text-ink-muted">Stemmen worden geladen…</p>
      ) : tts.voice ? (
        <>
          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-good" aria-hidden />
            <p className="text-[13px] text-ink-secondary">
              Kroatische stem gevonden:{" "}
              <span className="font-medium text-ink">{tts.voice.name}</span> ({tts.voice.lang})
            </p>
          </div>
          <button
            type="button"
            onClick={() => tts.speak("Dobar dan! Ja sam tvoj glas za hrvatski jezik.")}
            className="mt-4 rounded-full border border-line bg-surface px-4 py-2 text-[13px] text-ink-secondary transition-colors hover:border-accent-ring hover:bg-accent-wash hover:text-accent"
          >
            Test de uitspraak
          </button>

          {/* macOS installeert standaard de compacte stem. Die klinkt blikkerig
              en slikt medeklinkers in — bij een taal waar het verschil tussen
              č en ć het hele punt is, is dat geen detail. De betere versie is
              een aparte download onder dezelfde naam. */}
          <div className="mt-4 rounded-lg bg-sunken px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Klinkt het blikkerig?
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">
              macOS installeert standaard de compacte versie van een stem. Er bestaat een
              tweede, veel duidelijkere versie met dezelfde naam — die moet je apart
              downloaden. Het verschil is groot, juist bij č, ć, š en ž.
            </p>
            <ol className="mt-2.5 space-y-1 text-[12.5px] leading-relaxed text-ink-secondary">
              <li>1. Systeeminstellingen → Toegankelijkheid → Gesproken materiaal</li>
              <li>2. Systeemstem → Stemmen beheren</li>
              <li>3. Zoek Kroatisch en kies de variant met (Verbeterd) of (Premium)</li>
              <li>4. Herstart je browser</li>
            </ol>
          </div>

          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            Te snel? De spreeksnelheid staat bij elke luisteroefening en bij het dictee,
            en die keuze wordt onthouden.
          </p>
        </>
      ) : (
        <>
          <div className="mt-2.5 flex items-start gap-2">
            <span className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full bg-warn" aria-hidden />
            <div>
              <p className="text-[13px] leading-relaxed text-ink-secondary">
                Er is geen Kroatische stem geïnstalleerd. Luisteroefeningen worden daarom
                overgeslagen in plaats van met een Engelse stem voorgelezen — dat laatste zou
                je uitspraak actief bederven.
              </p>
              <div className="mt-4 rounded-lg bg-sunken px-4 py-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                  Installeren op macOS
                </p>
                <ol className="mt-2 space-y-1 text-[12.5px] leading-relaxed text-ink-secondary">
                  <li>1. Systeeminstellingen → Toegankelijkheid → Gesproken materiaal</li>
                  <li>2. Klik bij Systeemstem op de knop rechts → Stemmen beheren</li>
                  <li>3. Zoek Kroatisch, vink een stem aan en download die</li>
                  <li>4. Herstart de browser en laad deze pagina opnieuw</li>
                </ol>
              </div>
              <p className="mt-3 text-[12px] text-ink-muted">
                {tts.voices.length} stemmen beschikbaar, geen daarvan met taalcode hr.
              </p>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
