import { redirect } from "next/navigation";

/**
 * Begrijpend lezen was een eigen pagina en is dat niet meer: de leesvragen en de
 * taaloefeningen lopen sinds kort in één doorloop, zodat een verhaal pas afgerond
 * is als je ze allebei gehad hebt. Deze route blijft bestaan voor wie hem nog in
 * zijn geschiedenis heeft staan.
 */
export default async function ComprehensionRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/verhalen/${slug}/vragen`);
}
