import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import { LoginForm } from "@/components/AuthFormulieren";
import { COOKIE_NAAM } from "@/lib/accounts/context";
import { veiligeTerug } from "@/lib/accounts/sessie";
import { aantalGebruikers, zoekSessie } from "@/lib/accounts/store";

export const dynamic = "force-dynamic";

export default async function InloggenPage({ searchParams }: { searchParams: Promise<{ terug?: string }> }) {
  const { terug } = await searchParams;
  // Al ingelogd? Dan naar waar je heen wilde. Nog geen enkel account? Dan eerst een maken.
  if (zoekSessie((await cookies()).get(COOKIE_NAAM)?.value)) redirect(veiligeTerug(terug));
  if (aantalGebruikers() === 0) redirect("/registreren");
  return <LoginForm terug={terug} />;
}
