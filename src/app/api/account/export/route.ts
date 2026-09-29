import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { eisGebruiker } from "@/lib/accounts/api";
import { gebruikerDbPad } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Je eigen voortgang als bestand: een consistente kopie van je database (SQLite). */
export async function GET(req: Request) {
  const r = eisGebruiker(req);
  if ("fout" in r) return r.fout;
  const bron = new Database(gebruikerDbPad(r.gebruiker.id), { readonly: true });
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-export-")), "hrvatski-voortgang.db");
  try {
    bron.prepare("VACUUM INTO ?").run(tmp);
  } finally {
    bron.close();
  }
  const bytes = fs.readFileSync(tmp);
  fs.rmSync(path.dirname(tmp), { recursive: true, force: true });
  const dag = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="hrvatski-${r.gebruiker.naam.toLowerCase()}-${dag}.db"`,
      "Cache-Control": "no-store",
    },
  });
}
