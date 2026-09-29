import fs from "node:fs";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { RegistreerForm } from "@/components/AuthFormulieren";
import { registratieOpen } from "@/lib/accounts/registreren";
import { aantalGebruikers } from "@/lib/accounts/store";
import { legacyDbPad } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function RegistrerenPage() {
  const eerste = aantalGebruikers() === 0;
  if (!eerste && !registratieOpen()) redirect("/inloggen");
  // Het eerste account (de eigenaar, die je bestaande voortgang overneemt) maak je op de laptop zelf.
  if (eerste && (await headers()).get("x-hrvatski-via")) {
    return (
      <section className="hero bg-pop-peach px-6 py-7 text-on-pop">
        <h1 className="display text-[28px]">Eerst op de laptop</h1>
        <p className="mt-2 text-[15px] font-medium leading-relaxed">
          Het allereerste account maak je op de laptop zelf, zodat niemand anders je voortgang kan overnemen. Daarna kun je hier inloggen.
        </p>
      </section>
    );
  }
  return <RegistreerForm eerste={eerste} overnemen={eerste && fs.existsSync(legacyDbPad())} />;
}
