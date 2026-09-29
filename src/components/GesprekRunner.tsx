"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Doodle, type DoodleName } from "./doodles";
import { SpecialChars } from "./SpecialChars";
import { useCroatianTts } from "@/lib/tts";

/*
  Het gesprek zelf. Elke zin van de bot heeft al de taalpoorten gehad voor hij
  hier aankomt; jouw eigen zin krijgt dezelfde controle terug.

  De volgende zin verschijnt zonder beweging: je typt en drukt op Enter, en dat
  doe je tientallen keren achter elkaar. Alleen het "typt…"-blokje laat zien dat
  er iets gebeurt, want het model doet er een paar seconden over.
*/

interface Bericht {
  rol: "bot" | "jij";
  tekst: string;
  nl?: string;
  tip?: string;
  /** Wat de poorten van jouw zin vonden. */
  vondsten?: string[];
}

type Fout = { reden: string; detail?: string } | null;

/** Welke combinaties al zijn opgewarmd, zodat React in dev het niet dubbel doet. */
const opgewarmd = new Set<string>();

interface Scenario {
  id: string;
  titel_nl: string;
  titel_hr: string;
  situatie_nl: string;
  opening_hr: string;
  opening_nl: string;
  doodle: string;
  woorden: { hr: string; nl: string }[];
}

interface Bevindingen {
  spelling: { woord: string; bedoeld?: string; verwant?: string; soort: string }[];
  naamvallen: { fragment: string; uitleg: string; bedoeld?: string }[];
  servismen: { fout: string; goed: string }[];
}

function vondstenVan(b: Bevindingen): string[] {
  const uit: string[] = [];
  for (const s of b.spelling) {
    if (s.soort === "diakriet" && s.bedoeld) uit.push(`«${s.woord}» mist een teken: ${s.bedoeld}`);
    else if (s.soort === "vorm" && s.verwant) uit.push(`«${s.woord}» lijkt op «${s.verwant}», maar de vorm klopt niet`);
  }
  for (const n of b.naamvallen) uit.push(`${n.fragment}: ${n.uitleg}${n.bedoeld ? ` (${n.bedoeld})` : ""}`);
  for (const s of b.servismen) uit.push(`«${s.fout}» is Servisch; in Kroatië: ${s.goed}`);
  return uit;
}

export function GesprekRunner({
  scenario,
  startLes,
  aantallen,
  status,
}: {
  scenario: Scenario;
  startLes: number;
  /** Aantal woorden per lesniveau (index = les), voor de keuzelijst. */
  aantallen: number[];
  status: { staat: "klaar" | "offline" | "model-ontbreekt"; model?: string };
}) {
  const tts = useCroatianTts();
  const opening: Bericht = { rol: "bot", tekst: scenario.opening_hr, nl: scenario.opening_nl };
  const [berichten, setBerichten] = useState<Bericht[]>([opening]);
  const [invoer, setInvoer] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<Fout>(null);
  const [les, setLes] = useState(startLes);
  const [toonNl, setToonNl] = useState<Record<number, boolean>>({});
  const veld = useRef<HTMLInputElement>(null);
  const einde = useRef<HTMLDivElement>(null);

  useEffect(() => {
    einde.current?.scrollIntoView({ block: "end" });
  }, [berichten, bezig, fout]);

  // Het model alvast de prompt laten lezen terwijl je de opening leest.
  useEffect(() => {
    if (status.staat !== "klaar") return;
    const sleutel = `${scenario.id}:${les}`;
    if (opgewarmd.has(sleutel)) return;
    opgewarmd.add(sleutel);
    fetch("/api/gesprek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warm: true, scenario: scenario.id, les }),
    }).catch(() => {});
  }, [scenario.id, les, status.staat]);

  async function verstuur(tekstIn?: string) {
    const tekst = (tekstIn ?? invoer).trim();
    if (!tekst || bezig) return;
    const nieuw: Bericht[] = tekstIn ? berichten : [...berichten, { rol: "jij", tekst }];
    if (!tekstIn) {
      setBerichten(nieuw);
      setInvoer("");
    }
    setFout(null);
    setBezig(true);
    try {
      const res = await fetch("/api/gesprek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenario.id,
          les,
          historie: nieuw.map((b) => ({ rol: b.rol, tekst: b.tekst })),
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setFout({ reden: data.reden, detail: data.detail });
        return;
      }
      const vondsten = vondstenVan(data.jouw as Bevindingen);
      setBerichten([
        ...nieuw.map((b, i) => (i === nieuw.length - 1 && b.rol === "jij" ? { ...b, vondsten } : b)),
        { rol: "bot", tekst: data.hr, nl: data.nl, tip: data.tip_nl || undefined },
      ]);
    } catch {
      setFout({ reden: "offline" });
    } finally {
      setBezig(false);
      requestAnimationFrame(() => veld.current?.focus());
    }
  }

  function opnieuw() {
    setBerichten([opening]);
    setFout(null);
    setToonNl({});
    setInvoer("");
    requestAnimationFrame(() => veld.current?.focus());
  }

  function invoegen(ch: string) {
    const el = veld.current;
    if (!el) return setInvoer((v) => v + ch);
    const a = el.selectionStart ?? invoer.length;
    const b = el.selectionEnd ?? invoer.length;
    setInvoer(invoer.slice(0, a) + ch + invoer.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a + 1, a + 1);
    });
  }

  const beschikbaar = status.staat === "klaar";
  const laatsteIsJij = berichten.at(-1)?.rol === "jij";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/gesprek" className="hand text-[14px] font-bold text-ink-secondary hover:text-ink">
          ← Alle gesprekken
        </Link>
        <label className="hand flex items-center gap-2 text-[14px] font-bold">
          Woorden tot les
          <select
            value={les}
            onChange={(e) => setLes(Number(e.target.value))}
            className="input rounded-full px-3 py-1.5 text-[14px] font-semibold"
          >
            {aantallen.map((n, i) => (
              <option key={i} value={i}>
                {i} ({n} woorden)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-6 rounded-card border-2 border-dashed border-outline bg-surface px-4 py-3">
        <p className="hand text-[13.5px] font-bold">Handige woorden in dit gesprek</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {scenario.woorden.map((w) => (
            <li key={w.hr} className="pill h-8 gap-1.5 bg-white px-3 text-[13.5px] text-on-pop">
              <span className="hr-text font-extrabold">{w.hr}</span>
              <span className="font-medium text-ink-secondary">{w.nl}</span>
            </li>
          ))}
        </ul>
      </div>

      <ul className="space-y-5" aria-live="polite">
        {berichten.map((b, i) =>
          b.rol === "bot" ? (
            <li key={i} className="flex max-w-[92%] items-start gap-3">
              <span className="mt-1 flex h-10 w-10 shrink-0 -rotate-3 items-center justify-center rounded-[14px] border-2 border-outline bg-pop-aqua shadow-[var(--hard-sm)]">
                <Doodle name={scenario.doodle as DoodleName} size={26} color="#ffffff" />
              </span>
              <div className="min-w-0">
                <div className="rounded-card border-2 border-outline bg-surface px-5 py-4 shadow-[var(--hard)]">
                  <p className="hr-text text-[19px] font-bold leading-snug text-ink">{b.tekst}</p>
                  {toonNl[i] && b.nl ? <p className="mt-2 text-[14.5px] text-ink-secondary">{b.nl}</p> : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {b.nl ? (
                    <button
                      type="button"
                      onClick={() => setToonNl((t) => ({ ...t, [i]: !t[i] }))}
                      className="pill h-8 bg-white px-3 text-[13px] text-on-pop active:scale-95"
                    >
                      {toonNl[i] ? "Verberg vertaling" : "Toon vertaling"}
                    </button>
                  ) : null}
                  {tts.voice ? (
                    <button
                      type="button"
                      onClick={() => tts.speak(b.tekst)}
                      className="pill h-8 bg-pop-yellow px-3 text-[13px] text-on-pop active:scale-95"
                    >
                      Beluister
                    </button>
                  ) : null}
                </div>
                {b.tip ? (
                  <p className="mt-3 rounded-card border-2 border-dashed border-outline bg-pop-yellow px-4 py-3 text-[14px] font-semibold leading-snug text-on-pop">
                    <span className="hand font-bold">Tip van de bot · niet nagekeken: </span>
                    {b.tip}
                  </p>
                ) : null}
              </div>
            </li>
          ) : (
            <li key={i} className="ml-auto max-w-[92%]">
              <div className="rounded-card border-2 border-outline bg-pop-sky px-5 py-4 text-on-pop shadow-[var(--hard)]">
                <p className="hr-text text-[18px] font-bold leading-snug">{b.tekst}</p>
              </div>
              {b.vondsten ? (
                b.vondsten.length ? (
                  <ul className="mt-2 space-y-1 rounded-card border-2 border-outline bg-pop-pink px-4 py-3 text-[14px] font-semibold text-on-pop">
                    {b.vondsten.map((v) => (
                      <li key={v}>{v}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="hand mt-2 text-right text-[13px] font-bold text-ink-secondary">
                    De controle vond niets. Dat is geen garantie, wel een goed teken.
                  </p>
                )
              ) : null}
            </li>
          ),
        )}

        {bezig ? (
          <li className="flex items-center gap-3" aria-label="De bot typt">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border-2 border-outline bg-pop-aqua shadow-[var(--hard-sm)]">
              <Doodle name="praat" size={26} color="#ffffff" />
            </span>
            <span className="typing inline-flex items-center gap-1.5 rounded-full border-2 border-outline bg-surface px-4 py-3">
              <i /> <i /> <i />
            </span>
          </li>
        ) : null}
      </ul>

      {fout ? <FoutKaart fout={fout} model={status.model} onOpnieuw={laatsteIsJij ? () => verstuur(berichten.at(-1)!.tekst) : undefined} /> : null}

      {/* De invoerbalk plakt onderaan; de ruimte zorgt dat de laatste zin er nooit onder verdwijnt. */}
      <div ref={einde} style={{ scrollMarginBottom: 260 }} />

      <div className="sticky bottom-[calc(84px+env(safe-area-inset-bottom))] mt-8 md:bottom-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verstuur();
          }}
          className="rounded-card border-2 border-outline bg-surface p-3 shadow-[var(--hard)]"
        >
          <div className="flex items-center gap-2">
            <input
              ref={veld}
              value={invoer}
              onChange={(e) => setInvoer(e.target.value)}
              disabled={!beschikbaar}
              placeholder={beschikbaar ? "Antwoord in het Kroatisch…" : "De bot is nog niet beschikbaar"}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label="Jouw antwoord"
              className="input hr-text min-w-0 flex-1 rounded-full px-4 py-3 text-[16px]"
            />
            <button type="submit" disabled={!beschikbaar || bezig || !invoer.trim()} className="btn btn-primary h-12 px-6 text-[15px] disabled:opacity-50">
              Stuur
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 max-w-full overflow-x-auto [&>div]:flex-nowrap">
              <SpecialChars onInsert={invoegen} />
            </div>
            <button type="button" onClick={opnieuw} className="hand text-[13.5px] font-bold text-ink-secondary hover:text-ink">
              Opnieuw beginnen
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FoutKaart({ fout, model, onOpnieuw }: { fout: NonNullable<Fout>; model?: string; onOpnieuw?: () => void }) {
  const uitleg: Record<string, { kop: string; tekst: string }> = {
    offline: { kop: "Ollama draait niet", tekst: "Start het met «ollama serve» in een terminal en probeer het opnieuw." },
    "model-ontbreekt": {
      kop: "Het model staat er nog niet op",
      tekst: `Haal het op met «ollama pull ${model ?? "gemma3:12b"}». Dat is een keer een paar GB.`,
    },
    "geen-goed-antwoord": {
      kop: "Geen goede zin gekregen",
      tekst:
        "Het model gaf drie keer een zin die de controle afkeurde (spelling, naamval, Servisch of te moeilijke woorden). Liever niets dan een foute zin: probeer het opnieuw.",
    },
    fout: { kop: "Er ging iets mis", tekst: "Probeer het nog eens." },
  };
  const u = uitleg[fout.reden] ?? uitleg.fout;
  return (
    <div className="mt-5 rounded-card border-2 border-outline bg-pop-peach p-5 text-on-pop shadow-[var(--hard)]">
      <p className="hand text-[16px] font-bold">{u.kop}</p>
      <p className="mt-1 text-[14.5px] font-semibold leading-relaxed">{u.tekst}</p>
      {onOpnieuw ? (
        <button type="button" onClick={onOpnieuw} className="btn btn-ghost mt-3 h-10 px-4 text-[14px]">
          Probeer opnieuw
        </button>
      ) : null}
      {fout.detail ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-bold">Waarom afgekeurd</summary>
          <p className="mt-1 break-words">{fout.detail}</p>
        </details>
      ) : null}
    </div>
  );
}
