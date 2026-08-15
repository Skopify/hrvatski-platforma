"use client";

import { useState } from "react";

/*
  De naamvalstijdlijn.

  Zeven naamvallen over eenentwintig eenheden — dat is de moeilijkste vraag die
  een beginner over het Kroatisch heeft ("wanneer krijg ik de rest?"), en in een
  lijst is het antwoord nooit te zien.

  Het ontwerpprobleem: de naamvallen liggen ongelijk verdeeld. Genitief (14) en
  instrumentalis (15) staan één les uit elkaar, dus labels op hun eigen positie
  botsen onvermijdelijk. De oplossing is de stippen en de labels los te koppelen:
  de stippen staan op hun échte plek op de as, de labels in zeven even brede
  vakken eronder, en een aanwijslijn verbindt de twee. Zo blijft de ongelijke
  verdeling zichtbaar — precies de informatie die het interessant maakt — zonder
  dat er iets over elkaar heen valt.
*/

export interface CaseMark {
  name: string;
  lesson: number;
  note: string;
}

export function CaseTimeline({
  cases,
  total,
  current,
}: {
  cases: CaseMark[];
  /** Hoogste lesnummer op de as. */
  total: number;
  /** Waar de leerder nu staat. */
  current: number;
}) {
  const [active, setActive] = useState<CaseMark | null>(null);

  const w = 700;
  const h = 132;
  const padX = 22;
  const axisY = 34;
  const labelTop = 84;

  const x = (lesson: number) => padX + (lesson / total) * (w - padX * 2);
  const slot = (w - padX * 2) / cases.length;
  const slotX = (i: number) => padX + slot * (i + 0.5);

  return (
    <figure className="card overflow-hidden px-5 pb-4 pt-5 sm:px-7">
      <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="display-soft text-[15px] text-ink">Wanneer komt welke naamval?</span>
        <span className="text-[12px] text-ink-muted">
          {active ? active.note : "Beweeg over een naamval voor de reden"}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="mt-3 w-full"
        role="img"
        aria-label="Naamvallen per les"
      >
        {/* De as, met daarop het stuk dat je al gelopen hebt. */}
        <line
          x1={padX}
          x2={w - padX}
          y1={axisY}
          y2={axisY}
          stroke="var(--color-line)"
          strokeWidth={3}
          strokeLinecap="round"
        />
        {current > 0 ? (
          <line
            x1={padX}
            x2={x(current)}
            y1={axisY}
            y2={axisY}
            stroke="var(--color-accent)"
            strokeWidth={3}
            strokeLinecap="round"
          />
        ) : null}

        {/* Eén streepje per eenheid — de maatverdeling van de as. */}
        {Array.from({ length: total + 1 }, (_, i) => (
          <line
            key={i}
            x1={x(i)}
            x2={x(i)}
            y1={axisY - 3.5}
            y2={axisY + 3.5}
            stroke={i <= current ? "var(--color-accent)" : "var(--color-line-strong)"}
            strokeWidth={1}
          />
        ))}
        <text x={padX} y={axisY - 11} fontSize={10} fill="var(--color-ink-muted)" textAnchor="middle">
          les 0
        </text>
        <text
          x={w - padX}
          y={axisY - 11}
          fontSize={10}
          fill="var(--color-ink-muted)"
          textAnchor="middle"
        >
          {total}
        </text>

        {cases.map((c, i) => {
          const dotX = x(c.lesson);
          const lx = slotX(i);
          const isActive = active?.name === c.name;
          const reached = c.lesson <= current;
          const color = reached ? "var(--color-accent)" : "var(--color-ink-muted)";

          return (
            <g
              key={c.name}
              onMouseEnter={() => setActive(c)}
              onMouseLeave={() => setActive(null)}
              style={{ cursor: "default" }}
            >
              {/* Aanwijslijn: recht omlaag van de stip, dan schuin naar het vak. */}
              <path
                d={`M${dotX},${axisY + 9} L${dotX},${axisY + 24} L${lx},${labelTop - 22} L${lx},${labelTop - 14}`}
                fill="none"
                stroke={isActive ? color : "var(--color-line-strong)"}
                strokeWidth={isActive ? 1.5 : 1}
              />
              <circle
                cx={dotX}
                cy={axisY}
                r={isActive ? 6.5 : 5}
                fill={reached ? color : "var(--color-surface)"}
                stroke={color}
                strokeWidth={2}
                style={{ transition: "r 160ms var(--ease-out-quint)" }}
              />

              {/* Het label in zijn eigen vak — nooit botsend. */}
              <text
                x={lx}
                y={labelTop}
                textAnchor="middle"
                fontSize={10.5}
                fill="var(--color-ink-muted)"
                className="tabular"
              >
                les {c.lesson}
              </text>
              <text
                x={lx}
                y={labelTop + 15}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={isActive ? 700 : 600}
                fill={reached ? "var(--color-ink)" : "var(--color-ink-muted)"}
                style={{ textTransform: "capitalize" }}
              >
                {c.name}
              </text>

              {/* Ruim raakvlak over stip én label, anders is 5px niet aan te wijzen. */}
              <rect
                x={lx - slot / 2}
                y={axisY - 12}
                width={slot}
                height={h - axisY + 6}
                fill="transparent"
              />
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
