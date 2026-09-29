import { antwoord, eisGebruiker } from "@/lib/accounts/api";
import { metGebruiker } from "@/lib/accounts/context";
import { db } from "@/lib/db";
import { profile } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

/** Wie ben ik, en wat is mijn XP. Dat laatste bewijst dat je bij je eigen database uitkomt. */
export async function GET(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const xp = metGebruiker(r.gebruiker.id, () => db.select({ xp: profile.xp }).from(profile).get()?.xp ?? 0);
  return antwoord({ ok: true, gebruiker: r.gebruiker, xp });
}
