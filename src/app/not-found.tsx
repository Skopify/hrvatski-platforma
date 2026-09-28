import Link from "next/link";

import { SahovnicaVeld } from "@/components/SahovnicaVeld";
import { Page } from "@/components/ui";

/*
  Een pagina die niet bestaat. Eerst stond hier de kale zwarte standaard van
  Next, die uit de rest van de app viel; nu dezelfde wereld, met het veld om
  mee te spelen en één weg terug.
*/
export default function NotFound() {
  return (
    <Page width="detail">
      <section className="hero relative overflow-hidden">
        <SahovnicaVeld className="h-[260px] cursor-crosshair sm:h-[320px]" />
        <div className="relative px-6 pb-9 pt-2 text-center sm:px-10">
          <p className="num text-[13px] tracking-[0.08em] text-ink-muted">404</p>
          <h1 className="hr-text display mt-2 text-[40px] text-ink sm:text-[48px]">Ova stranica ne postoji.</h1>
          <p className="mt-1 text-[13px] text-ink-muted">Deze pagina bestaat niet.</p>
          <p className="mx-auto mt-5 max-w-md text-[15px] leading-relaxed text-ink-secondary">
            Misschien is het adres veranderd, of zat er een tikfout in. Klik gerust op het veld
            hierboven terwijl je erover nadenkt.
          </p>
          <Link href="/" className="btn btn-primary mt-7 h-12 px-6 text-[15px]">
            Naar het overzicht
          </Link>
        </div>
      </section>
    </Page>
  );
}
