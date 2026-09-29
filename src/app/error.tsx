"use client";

import { useEffect } from "react";

import { Arrow, Doodle, Squiggle } from "@/components/doodles";
import { Page } from "@/components/ui";

/*
  Iets ging mis tijdens het opbouwen van een pagina. Vooral bij een database
  die achterloopt weigert de server met een duidelijke melding (zie
  src/lib/db/index.ts); die laten we hier zien in gewone taal, zonder
  stacktrace. De technische regel staat in de terminal waar de server draait.
*/
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const database = /database staat op versie|npm run migrate/i.test(error.message);

  return (
    <Page width="focus">
      <section className="hero relative mt-10 bg-pop-peach px-6 pb-10 pt-12 text-center text-on-pop sm:px-12">
        <div className="mx-auto flex h-24 w-24 rotate-6 items-center justify-center rounded-[26px] border-2 border-outline bg-white shadow-[4px_4px_0_#1b1a22]">
          <Doodle name="cross" size={56} color="var(--color-pop-pink)" />
        </div>
        <h1 className="hr-text display mt-8 text-[34px] sm:text-[42px]">
          <span className="relative inline-block pb-3">
            Er ging iets mis.
            <Squiggle slow color="#1b1a22" className="absolute -bottom-0.5 left-0 h-[14px] w-full" />
          </span>
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-[15.5px] font-medium leading-relaxed">
          {database
            ? "De database loopt achter op de code. Sluit de server, draai `npm run migrate` (die maakt eerst een back-up) en start opnieuw."
            : "Je voortgang is niet aangetast. Probeer het nog eens; blijft het gebeuren, kijk dan in het venster waar de server draait."}
        </p>
        <div className="relative mt-9 inline-block">
          <Arrow className="absolute -left-16 -top-6 hidden h-12 w-14 sm:block" />
          <button type="button" onClick={reset} className="btn btn-primary h-[52px] px-8 text-[16px]">
            Opnieuw proberen
          </button>
        </div>
      </section>
    </Page>
  );
}
