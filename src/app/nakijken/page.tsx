import { NakijkLijst } from "@/components/NakijkLijst";
import { Page, PageHeader } from "@/components/ui";
import { stand, volgendeBatch } from "@/lib/nakijken";

export const dynamic = "force-dynamic";

/**
 * Het nakijkscherm uit §7 van de spec.
 *
 * Wat hier langskomt is alleen wat ík geschreven heb: de grammaticamodules, de
 * verhalen en de aangevulde lesoefeningen. De oefeningen die uit het leerboek
 * komen dragen een `source` als «udzbenik p.27» en blijven buiten de rij — die
 * zijn al door een uitgever gegaan, en de tijd van de nakijker is hier de
 * schaarse bron.
 */
export default function NakijkenPage() {
  const s = stand();
  const batch = volgendeBatch(20);

  return (
    <Page width="focus">
      <PageHeader
        title="Pregled hrvatskog"
        intro={
          <>
            <span className="block">
              Rečenicu po rečenicu: je li ovako netko doista govori? Ne gramatika iz
              udžbenika — nego zvuči li prirodno.
            </span>
            <span className="mt-2 block text-[13px] text-ink-muted">
              Voor Antonio: dit is het nakijkscherm. Alles wat hier langskomt heb ik
              zelf geschreven — {s.perHerkomst.find((h) => h.herkomst === "module")?.totaal ?? 0} zinnen
              uit de grammaticamodules,{" "}
              {s.perHerkomst.find((h) => h.herkomst === "verhaal")?.totaal ?? 0} uit de verhalen en{" "}
              {s.perHerkomst.find((h) => h.herkomst === "les")?.totaal ?? 0} aangevulde
              lesoefeningen. Wat uit het leerboek komt, staat er niet in.
            </span>
          </>
        }
      />
      <NakijkLijst eerste={batch} standInit={s} />
    </Page>
  );
}
