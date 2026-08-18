"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { restartModule } from "@/app/actions";

/**
 * De weg terug naar stap één.
 *
 * Hervatten is het gewone geval, maar niet altijd het gewenste: wie een module
 * een maand laat liggen wil de uitleg opnieuw zien en niet midden in de
 * invuloefeningen landen. Twee klikken, zodat het niet per ongeluk gebeurt.
 */
export function RestartModule({ code }: { code: string }) {
  const router = useRouter();
  const [zeker, setZeker] = useState(false);
  const [bezig, setBezig] = useState(false);

  if (!zeker) {
    return (
      <button
        type="button"
        onClick={() => setZeker(true)}
        className="text-[13.5px] font-medium text-ink-muted transition-colors hover:text-ink-secondary"
      >
        Opnieuw beginnen
      </button>
    );
  }

  return (
    <span className="flex items-center gap-3 text-[13.5px]">
      <span className="text-ink-secondary">Vanaf stap één?</span>
      <button
        type="button"
        disabled={bezig}
        onClick={async () => {
          setBezig(true);
          await restartModule(code);
          router.refresh();
        }}
        className="font-semibold text-bad-ink hover:underline disabled:opacity-50"
      >
        Ja
      </button>
      <button
        type="button"
        onClick={() => setZeker(false)}
        className="font-medium text-ink-muted hover:text-ink-secondary"
      >
        Nee
      </button>
    </span>
  );
}
