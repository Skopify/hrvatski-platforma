import Link from "next/link";

import { FitTitle } from "@/components/FitTitle";
import { SahovnicaVeld } from "@/components/SahovnicaVeld";
import { Page } from "@/components/ui";

/*
  Een pagina die niet bestaat: een affiche met het getal zelf van rand tot
  rand, en het veld om mee te spelen terwijl je bedenkt waar je heen wilde.
*/
export default function NotFound() {
  return (
    <Page width="detail">
      <div className="grid gap-3 sm:gap-4">
        <section className="tone-crna block-tone animate-paste border-[3px] border-crna p-5 sm:p-8">
          <FitTitle text="404" max={260} className="animate-type" />
          <p className="hr-text mt-5 text-[22px] font-bold">Ova stranica ne postoji.</p>
          <p className="mt-1 text-[14px] opacity-80">Deze pagina bestaat niet.</p>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed opacity-90">
            Misschien is het adres veranderd, of zat er een tikfout in. Klik gerust in het veld
            hieronder terwijl je erover nadenkt.
          </p>
          <Link href="/" className="btn btn-on-tone mt-7 h-12 px-6 text-[15px]">
            Naar het overzicht
          </Link>
        </section>
        <div className="tone-plava block-tone relative h-[300px] overflow-hidden border-[3px] border-crna">
          <SahovnicaVeld fog="--color-plava" className="absolute inset-0 cursor-crosshair" />
        </div>
      </div>
    </Page>
  );
}
