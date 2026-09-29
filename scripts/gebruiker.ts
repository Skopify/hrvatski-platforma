/**
 * Accounts beheren vanaf de terminal, voor als je zelf niet meer in de app komt.
 * Gebruik:
 *   npm run gebruiker -- lijst
 *   npm run gebruiker -- wachtwoord <naam>      geeft een tijdelijk wachtwoord
 *   npm run gebruiker -- verwijder <naam>       verwijdert het account (met een kopie van de voortgang)
 *   npm run gebruiker -- registratie open|dicht
 *
 * Dit is de laatste redding als de eigenaar zijn wachtwoord én herstelcode kwijt is: wie bij
 * deze computer en deze map kan, kan dit, en dat is dezelfde beveiliging als bij het bestand
 * zelf. Vóór elke wijziging staat er een kopie van accounts.db in data/backups.
 */
import fs from "node:fs";
import path from "node:path";

import Database from "better-sqlite3";

import { accountsPad, dataDir } from "../src/lib/data";
import { beheerResetWachtwoord, beheerVerwijder, registratieOpen, zetRegistratie } from "../src/lib/accounts/registreren";
import * as store from "../src/lib/accounts/store";

const [actie, arg] = process.argv.slice(2);

if (!fs.existsSync(accountsPad())) {
  console.log("Er zijn nog geen accounts. Maak het eerste in de app (het eerste account is de eigenaar).");
  process.exit(0);
}

function kopie(reden: string) {
  const dir = path.join(dataDir(), "backups");
  fs.mkdirSync(dir, { recursive: true });
  const doel = path.join(dir, `accounts-${reden}-${new Date().toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "-")}.db`);
  const d = new Database(accountsPad());
  d.pragma("wal_checkpoint(TRUNCATE)");
  d.prepare("VACUUM INTO ?").run(doel);
  d.close();
  console.log(`Back-up van de accounts: ${path.relative(process.cwd(), doel)}`);
}

const eigenaar = store.lijstGebruikers().find((g) => g.rol === "eigenaar");

if (actie === "lijst" || !actie) {
  for (const g of store.lijstGebruikers()) {
    console.log(`${String(g.id).padStart(3)}  ${g.naam.padEnd(24)} ${g.rol.padEnd(9)} ${g.weergavenaam}`);
  }
  console.log(`\nNieuwe accounts: ${registratieOpen() ? "open" : "gesloten"}`);
} else if (actie === "wachtwoord" && arg) {
  const g = store.vindOpNaam(arg);
  if (!g || !eigenaar) throw new Error(`Onbekend account: ${arg}`);
  kopie("voor-reset");
  const r = await beheerResetWachtwoord({ uitvoerderId: eigenaar.id, doelId: g.id });
  console.log(`Tijdelijk wachtwoord voor ${g.naam}: ${r.tijdelijkWachtwoord}\nAlle sessies van dit account zijn beëindigd.`);
} else if (actie === "verwijder" && arg) {
  const g = store.vindOpNaam(arg);
  if (!g || !eigenaar) throw new Error(`Onbekend account: ${arg}`);
  kopie("voor-verwijderen");
  await beheerVerwijder({ uitvoerderId: eigenaar.id, doelId: g.id });
  console.log(`${g.naam} is verwijderd. Een kopie van de voortgang staat in data/backups.`);
} else if (actie === "registratie" && (arg === "open" || arg === "dicht") && eigenaar) {
  await zetRegistratie({ uitvoerderId: eigenaar.id, open: arg === "open" });
  console.log(`Nieuwe accounts: ${arg === "open" ? "open" : "gesloten"}.`);
} else {
  console.log("Gebruik: lijst | wachtwoord <naam> | verwijder <naam> | registratie open|dicht");
  process.exit(1);
}
store.sluitAccounts();
