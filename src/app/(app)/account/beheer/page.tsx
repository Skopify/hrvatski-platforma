import Link from "next/link";

import { BeheerLijst } from "@/components/AccountPanelen";
import { Page, PageHeader } from "@/components/ui";
import { registratieOpen } from "@/lib/accounts/registreren";
import { vereisEigenaarPagina } from "@/lib/accounts/sessie";
import { lijstGebruikers } from "@/lib/accounts/store";

export const dynamic = "force-dynamic";

export default async function BeheerPage() {
  const ik = await vereisEigenaarPagina();
  return (
    <Page width="detail">
      <Link href="/account" className="tap-link inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-accent">
        <span aria-hidden>←</span> Account
      </Link>
      <PageHeader title="Accounts beheren" intro="Wie er is, wie zich mag aanmelden, en wat je doet als iemand zijn wachtwoord en herstelcode kwijt is." />
      <BeheerLijst start={lijstGebruikers()} registratieOpen={registratieOpen()} ikId={ik.id} />
    </Page>
  );
}
