/**
 * Draait een script tegen een tijdelijke kopie van een voortgangsdatabase.
 * Gebruik: tsx scripts/op-kopie.ts <script> [argumenten]
 *
 * Voor de controles die alleen de leerstof (of een gewone database) nodig hebben, en nooit
 * mogen schrijven naar echte voortgang. Sinds de accounts weet `db` niet meer welke database
 * je bedoelt zonder ingelogde gebruiker; dit wijst er een aan, en ruimt hem na afloop op.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { testBron } from "../src/lib/data";

const [script, ...rest] = process.argv.slice(2);
if (!script) {
  console.error("Gebruik: tsx scripts/op-kopie.ts <script> [argumenten]");
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-kopie-"));
const kopie = path.join(tmp, "werk.db");
const bron = new Database(testBron(), { readonly: true });
await bron.backup(kopie);
bron.close();

const r = spawnSync(process.execPath, ["--import", "tsx", `scripts/${script}.ts`, ...rest], {
  stdio: "inherit",
  env: { ...process.env, HRVATSKI_DB: kopie },
});
fs.rmSync(tmp, { recursive: true, force: true });
process.exit(r.status ?? 1);
