"use client";

import { usePathname } from "next/navigation";
import { useMemo } from "react";

/*
  Elke navigatie monteert deze wrapper opnieuw. De ingang vertelt waar je heen
  ging, zoals in iOS:

    push — dieper in dezelfde sectie (Verhalen → een verhaal): van rechts
    pop  — terug naar boven (een verhaal → Verhalen): van links
    tab  — naar een andere sectie: vervaagt op zijn plek

  Het vorige pad leeft op moduleniveau: dat overleeft het opnieuw monteren.
  Is het pad gelijk aan het huidige (React roept de initialisatie in
  ontwikkelmodus twee keer aan), dan geven we hetzelfde antwoord terug.
*/
type Kind = "push" | "pop" | "tab";

let current: string | null = null;
let lastKind: Kind = "tab";

function segments(path: string) {
  return path.split("/").filter(Boolean);
}

function kindFor(path: string): Kind {
  if (path === current) return lastKind;
  const prev = current;
  current = path;
  if (!prev) return (lastKind = "tab");
  const a = segments(prev);
  const b = segments(path);
  if (a[0] !== b[0]) return (lastKind = "tab");
  lastKind = b.length < a.length ? "pop" : "push";
  return lastKind;
}

export default function Template({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const kind = useMemo(() => kindFor(path), [path]);
  // De root-template monteert alleen opnieuw als de eerste padstap wisselt
  // (Verhalen → Schrijven). Binnen een sectie (Verhalen → een verhaal) blijft
  // hij staan; de sleutel op het pad dwingt daar ook een nieuwe ingang af.
  return (
    <div key={path} className={`route-${kind}`}>
      {children}
    </div>
  );
}
