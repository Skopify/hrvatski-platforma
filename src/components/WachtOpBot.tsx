"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * De bot wordt wakker gemaakt (Ollama start op verzoek). Zolang dat duurt
 * vraagt deze pagina elke twee seconden of hij klaar is en ververst zichzelf
 * dan. Eén minuut is genoeg: daarna is er iets mis en houdt hij op.
 */
export function WachtOpBot() {
  const router = useRouter();
  useEffect(() => {
    let gestopt = false;
    const begin = Date.now();
    const id = setInterval(async () => {
      if (gestopt || Date.now() - begin > 60_000) return clearInterval(id);
      try {
        const r = await fetch("/api/gesprek", { cache: "no-store" });
        const d = (await r.json()) as { staat?: string };
        if (d.staat === "klaar" || d.staat === "model-ontbreekt" || d.staat === "geen-programma") {
          clearInterval(id);
          router.refresh();
        }
      } catch {
        // volgende ronde
      }
    }, 2000);
    return () => {
      gestopt = true;
      clearInterval(id);
    };
  }, [router]);
  return null;
}
