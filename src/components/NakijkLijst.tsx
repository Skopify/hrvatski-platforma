"use client";

import { useState, useTransition } from "react";

import { bewaarNakijkOordeel, volgendeNakijkBatch, wisNakijkOordeel } from "@/app/actions";
import type { ReviewStatus, Stand, Zin } from "@/lib/nakijken";

/**
 * Het nakijkscherm, in het Kroatisch.
 *
 * Dat is geen sierlijkheid. Wie dit gebruikt is een moedertaalspreker die geen
 * Nederlands hoeft te kunnen; een scherm met Nederlandse knoppen zou van hem
 * vragen dat hij eerst de interface vertaalt voordat hij aan het werk komt. De
 * enige Nederlandse regel staat bovenaan, als uitleg voor wie het scherm
 * doorstuurt.
 *
 * Eén zin per keer, geen lijst. Een lijst nodigt uit tot doorscrollen en
 * overslaan, en een half nagekeken lijst is niet te onderscheiden van een
 * onnagekeken lijst.
 */
export function NakijkLijst({
  eerste,
  standInit,
}: {
  eerste: Zin[];
  standInit: Stand;
}) {
  const [rij, setRij] = useState<Zin[]>(eerste);
  const [i, setI] = useState(0);
  const [huidigeStand, setStand] = useState(standInit);
  const [correctie, setCorrectie] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [toon, setToon] = useState<"fout" | "twijfel" | null>(null);
  const [laatste, setLaatste] = useState<{ zin: Zin; status: ReviewStatus } | null>(null);
  const [bezig, start] = useTransition();

  const zin = rij[i];

  function verder(status: ReviewStatus, c?: string, o?: string) {
    if (!zin) return;
    const gedaan = zin;
    start(async () => {
      await bewaarNakijkOordeel(gedaan.hash, gedaan.hr, status, c, o);
      setLaatste({ zin: gedaan, status });
      setCorrectie("");
      setOpmerking("");
      setToon(null);
      if (i + 1 < rij.length) {
        setI(i + 1);
        setStand((s) => ({ ...s, open: s.open - 1, [status]: s[status] + 1 }) as Stand);
      } else {
        const volgende = await volgendeNakijkBatch(20);
        setRij(volgende.zinnen);
        setI(0);
        setStand(volgende.stand);
      }
    });
  }

  function terug() {
    if (!laatste) return;
    const vorige = laatste.zin;
    start(async () => {
      await wisNakijkOordeel(vorige.hash);
      setRij((r) => (r.some((z) => z.hash === vorige.hash) ? r : [vorige, ...r.slice(i)]));
      setI(0);
      setLaatste(null);
      const volgende = await volgendeNakijkBatch(20);
      setStand(volgende.stand);
    });
  }

  if (!zin) {
    return (
      <div className="rounded-card border border-line bg-surface px-6 py-10 text-center">
        <p className="display-soft text-[22px] text-ink">Gotovo — hvala!</p>
        <p className="mt-2 text-[13.5px] text-ink-secondary">
          Sve rečenice su pregledane. {huidigeStand.goedgekeurd} ispravnih,{" "}
          {huidigeStand.fout} s greškom, {huidigeStand.twijfel} pod upitnikom.
        </p>
      </div>
    );
  }

  const gedaan = huidigeStand.totaal - huidigeStand.open;

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-baseline justify-between text-[12.5px] text-ink-secondary">
          <span>
            {gedaan} / {huidigeStand.totaal} pregledano
          </span>
          <span>{zin.herkomst === "verhaal" ? "priča" : zin.herkomst === "les" ? "lekcija" : "gramatika"} · {zin.plek}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(gedaan / Math.max(1, huidigeStand.totaal)) * 100}%` }}
          />
        </div>
      </div>

      <div className="rounded-card border border-line bg-surface px-6 py-8">
        <p className="display text-[26px] leading-snug text-ink sm:text-[30px]">{zin.hr}</p>
        {zin.nl ? (
          <p className="mt-3 text-[13.5px] italic leading-relaxed text-ink-secondary">
            {zin.nl}
          </p>
        ) : null}

        {toon === null ? (
          <div className="mt-7 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={bezig}
              onClick={() => verder("goedgekeurd")}
              className="rounded-xl bg-accent px-4 py-3.5 text-[14px] font-semibold text-white disabled:opacity-50"
            >
              Točno
            </button>
            <button
              type="button"
              disabled={bezig}
              onClick={() => {
                setCorrectie(zin.hr);
                setToon("fout");
              }}
              className="rounded-xl border border-line-strong bg-white px-4 py-3.5 text-[14px] font-semibold text-ink disabled:opacity-50"
            >
              Greška
            </button>
            <button
              type="button"
              disabled={bezig}
              onClick={() => setToon("twijfel")}
              className="rounded-xl border border-line-strong bg-white px-4 py-3.5 text-[14px] font-semibold text-ink disabled:opacity-50"
            >
              Nisam siguran
            </button>
          </div>
        ) : null}

        {toon === "fout" ? (
          <div className="mt-7">
            <label className="block text-[12.5px] font-semibold text-ink-secondary">
              Kako bi trebalo glasiti?
            </label>
            <textarea
              value={correctie}
              onChange={(e) => setCorrectie(e.target.value)}
              rows={2}
              autoFocus
              className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[15px] text-ink"
            />
            <label className="mt-4 block text-[12.5px] font-semibold text-ink-secondary">
              Zašto? (nije obavezno)
            </label>
            <input
              value={opmerking}
              onChange={(e) => setOpmerking(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[14px] text-ink"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={bezig}
                onClick={() => verder("fout", correctie, opmerking)}
                className="rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                Spremi
              </button>
              <button
                type="button"
                onClick={() => setToon(null)}
                className="rounded-xl border border-line-strong bg-white px-5 py-3 text-[14px] font-semibold text-ink"
              >
                Natrag
              </button>
            </div>
          </div>
        ) : null}

        {toon === "twijfel" ? (
          <div className="mt-7">
            <label className="block text-[12.5px] font-semibold text-ink-secondary">
              Što te smeta?
            </label>
            <input
              value={opmerking}
              onChange={(e) => setOpmerking(e.target.value)}
              autoFocus
              className="mt-2 w-full rounded-xl border border-line-strong bg-white px-4 py-3 text-[14px] text-ink"
            />
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                disabled={bezig}
                onClick={() => verder("twijfel", undefined, opmerking)}
                className="rounded-xl bg-accent px-5 py-3 text-[14px] font-semibold text-white disabled:opacity-50"
              >
                Spremi
              </button>
              <button
                type="button"
                onClick={() => setToon(null)}
                className="rounded-xl border border-line-strong bg-white px-5 py-3 text-[14px] font-semibold text-ink"
              >
                Natrag
              </button>
            </div>
          </div>
        ) : null}
      </div>

      {laatste ? (
        <button
          type="button"
          onClick={terug}
          disabled={bezig}
          className="mt-4 text-[12.5px] text-ink-secondary underline underline-offset-4 disabled:opacity-50"
        >
          Vrati prethodnu ({laatste.zin.hr.slice(0, 34)}
          {laatste.zin.hr.length > 34 ? "…" : ""})
        </button>
      ) : null}
    </div>
  );
}
