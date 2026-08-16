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

          {/* Meer dan één stem? Dan mag je zelf kiezen. De volgorde is al op
              kwaliteit gesorteerd, dus de bovenste is meestal de juiste. */}
          {tts.croatianVoices.length > 1 ? (
            <div className="mt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
                Stem kiezen
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tts.croatianVoices.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => tts.setVoiceName(v.name)}
                    aria-pressed={tts.voice?.name === v.name}
                    className={`rounded-full border px-3.5 py-1.5 text-[12.5px] transition-colors ${
                      tts.voice?.name === v.name
                        ? "border-accent-ring bg-accent-wash text-accent"
                        : "border-line bg-surface text-ink-secondary hover:border-accent-ring"
                    }`}
                  >
                    {v.name}
                    {!v.localService ? (
                      <span className="ml-1.5 text-[11px] text-ink-muted">online</span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* De compacte stem die macOS standaard installeert klinkt blikkerig en
              slikt medeklinkers in. Bij een taal waar het verschil tussen č en ć
              het hele punt is, is dat geen detail. */}
          <div className="mt-4 rounded-lg bg-sunken px-4 py-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
              Klinkt het blikkerig?
            </p>
            <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">
              Dan hoor je waarschijnlijk de compacte stem van macOS. Twee manieren om
              dat te verhelpen, allebei gratis:
            </p>
            <p className="mt-2.5 text-[12.5px] font-semibold text-ink">
              1. Open dit platform in Microsoft Edge
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
              Edge brengt eigen neurale stemmen mee die een stuk natuurlijker klinken dan
              wat macOS levert. Open dit platform daar en er verschijnt hierboven een
              keuzelijst; het platform pakt dan vanzelf de beste. Ze werken wel alleen
              met internet.
            </p>
            <p className="mt-3 text-[12.5px] font-semibold text-ink">
              2. Haal de betere Apple-stem op
            </p>
            <ol className="mt-1 space-y-1 text-[12.5px] leading-relaxed text-ink-secondary">
              <li>Systeeminstellingen → Toegankelijkheid → Gesproken materiaal</li>
              <li>Systeemstem → Stemmen beheren</li>
              <li>Zoek Kroatisch en kies de variant met (Verbeterd) of (Premium)</li>
              <li>Herstart je browser</li>
            </ol>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Biedt macOS alleen de gewone Lana aan, dan is er geen betere Apple-versie
              voor Kroatisch en is Edge je beste optie.
            </p>
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
