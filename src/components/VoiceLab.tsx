"use client";

import { useState } from "react";

import { TTS_RATES, useCroatianTts } from "@/lib/tts";

/**
 * De stemmen naast elkaar horen op dezelfde zin.
 *
 * Een stem beoordeel je niet aan een naam maar aan hoe hij č van ć onderscheidt.
 * Daarom staan hier zinnen die precies dáárop mikken, en niet "hallo, hoe gaat
 * het" — dat klinkt in elke stem wel acceptabel.
 */
const PROEFZINNEN = [
  {
    hr: "Čovjek čita knjigu u kući, a djevojčica jede kolač.",
    nl: "Test č, ć, k en j door elkaar.",
  },
  {
    hr: "Šešir, žena, đak i džemper — pet različitih glasova.",
    nl: "Alle vijf de bijzondere letters achter elkaar.",
  },
  {
    hr: "U Hrvatskoj se govori hrvatski, a u Njemačkoj njemački.",
    nl: "Lange zin met naamvallen, om het tempo te horen.",
  },
];

export function VoiceLab() {
  const tts = useCroatianTts();
  const [zin, setZin] = useState(0);

  if (!tts.supported && !tts.serverVoices.length) return null;

  const proef = PROEFZINNEN[zin]!;
  const browserNaam = tts.voice?.name;

  return (
    <section className="rounded-card border border-line bg-surface p-6">
      <h2 className="text-[13.5px] font-medium text-ink">Stemmen vergelijken</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
        Zelfde zin, verschillende stemmen. Let vooral op de č tegenover de ć — daar
        hoor je meteen of een stem de moeite waard is.
      </p>

      {/* Proefzin kiezen */}
      <div className="mt-4 flex flex-wrap gap-2">
        {PROEFZINNEN.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setZin(i)}
            aria-pressed={i === zin}
            className={`rounded-full border px-3 py-1.5 text-[12px] transition-colors ${
              i === zin
                ? "border-accent-ring bg-accent-wash text-accent"
                : "border-line bg-surface text-ink-secondary hover:border-accent-ring"
            }`}
          >
            Zin {i + 1}
          </button>
        ))}
      </div>

      <p className="hr-text reading mt-3.5 text-[16px] leading-snug text-ink">{proef.hr}</p>
      <p className="mt-1 text-[12.5px] text-ink-muted">{proef.nl}</p>

      {/* Snelheid geldt voor alle knoppen hieronder */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
          Tempo
        </span>
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
      </div>

      {/* De stemmen zelf */}
      <div className="mt-4 space-y-2">
        {tts.serverVoices.map((v) => (
          <VoiceRow
            key={v.id}
            titel={v.label}
            onder={`Azure · ${v.gender} · neuraal`}
            actief={tts.serverVoice === v.id}
            onKies={() => tts.setServerVoice(v.id)}
            onSpeel={() => {
              tts.setServerVoice(v.id);
              // Even wachten tot de keuze doorwerkt, anders speelt de vorige nog.
              setTimeout(() => tts.speak(proef.hr), 30);
            }}
          />
        ))}

        {browserNaam ? (
          <VoiceRow
            titel={browserNaam}
            onder={
              tts.serverVoices.length
                ? "Van je systeem · wordt gebruikt als terugval"
                : "Van je systeem"
            }
            actief={!tts.serverVoices.length}
            onSpeel={() => {
              tts.stop();
              // De browserstem forceren, ook als er een serverstem klaarstaat.
              const u = new SpeechSynthesisUtterance(proef.hr);
              if (tts.voice) {
                u.voice = tts.voice;
                u.lang = tts.voice.lang;
              }
              u.rate = tts.rate;
              window.speechSynthesis.speak(u);
            }}
          />
        ) : null}
      </div>

      {!tts.serverVoices.length ? (
        <p className="mt-4 rounded-lg bg-sunken px-4 py-3 text-[12.5px] leading-relaxed text-ink-secondary">
          Er staat nog geen Azure-sleutel ingesteld, dus je hoort alleen de stem van je
          systeem. Zie <span className="font-medium">README → Betere stemmen</span> voor de
          vijf minuten die het kost — en het blijft binnen de gratis laag.
        </p>
      ) : (
        <AzureTest />
      )}
    </section>
  );
}

/**
 * Verbinding testen.
 *
 * Een verkeerde sleutel, een verkeerde regio en een dienst die nog niet klaar is
 * leveren alledrie precies hetzelfde op: geen geluid. Deze knop haalt het
 * antwoord van Azure op en zet de oorzaak op het scherm.
 */
function AzureTest() {
  const [uitslag, setUitslag] = useState<{ ok: boolean; message: string } | null>(null);
  const [bezig, setBezig] = useState(false);

  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={bezig}
        onClick={async () => {
          setBezig(true);
          try {
            const r = await fetch("/api/spraak/test");
            setUitslag(await r.json());
          } catch {
            setUitslag({ ok: false, message: "De server antwoordde niet." });
          } finally {
            setBezig(false);
          }
        }}
        className="rounded-full border border-line bg-surface px-4 py-2 text-[12.5px] text-ink-secondary transition-colors hover:border-accent-ring hover:text-accent disabled:opacity-50"
      >
        {bezig ? "Bezig…" : "Verbinding testen"}
      </button>

      {uitslag ? (
        <p
          className={`mt-3 rounded-lg px-4 py-3 text-[12.5px] leading-relaxed ${
            uitslag.ok ? "bg-good-wash text-good-ink" : "bg-bad-wash text-bad-ink"
          }`}
        >
          {uitslag.message}
        </p>
      ) : null}
    </div>
  );
}

function VoiceRow({
  titel,
  onder,
  actief,
  onKies,
  onSpeel,
}: {
  titel: string;
  onder: string;
  actief: boolean;
  onKies?: () => void;
  onSpeel: () => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${
        actief ? "border-accent-ring bg-accent-wash" : "border-line bg-surface"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold text-ink">{titel}</p>
        <p className="text-[12px] text-ink-muted">{onder}</p>
      </div>
      <button
        type="button"
        onClick={onSpeel}
        className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[12.5px] text-ink-secondary transition-colors hover:border-accent-ring hover:text-accent"
      >
        Beluister
      </button>
      {onKies && !actief ? (
        <button
          type="button"
          onClick={onKies}
          className="rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          Gebruik deze
        </button>
      ) : null}
      {actief ? (
        <span className="text-[12px] font-semibold text-accent">In gebruik</span>
      ) : null}
    </div>
  );
}
