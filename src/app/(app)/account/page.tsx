import Link from "next/link";

import { HerstelcodePaneel, NaamPaneel, UitlogKnop, VerwijderPaneel, WachtwoordPaneel } from "@/components/AccountPanelen";
import { Page, PageHeader } from "@/components/ui";
import { vereisGebruiker } from "@/lib/accounts/sessie";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const g = await vereisGebruiker();
  return (
    <Page width="detail">
      <PageHeader title="Account" intro={`Ingelogd als ${g.naam}${g.rol === "eigenaar" ? " (eigenaar)" : ""}. Je voortgang is van jou alleen: niemand anders op deze computer ziet hem.`} />
      <div className="space-y-5">
        <div className="flex flex-wrap gap-3">
          <UitlogKnop />
          <a href="/api/account/export" className="btn btn-ghost h-12 px-6 text-[15px]">
            Mijn voortgang downloaden
          </a>
          {g.rol === "eigenaar" ? (
            <Link href="/account/beheer" className="btn btn-primary h-12 px-6 text-[15px]">
              Accounts beheren
            </Link>
          ) : null}
        </div>
        <NaamPaneel huidig={g.weergavenaam} />
        <WachtwoordPaneel />
        <HerstelcodePaneel />
        <VerwijderPaneel naam={g.naam} />
      </div>
    </Page>
  );
}
