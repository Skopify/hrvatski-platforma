/**
 * Maakt een testaccount in een aparte datamap (data-test/), zodat bouwen en testen nooit
 * aan de echte voortgang in data/ komt. Naam, wachtwoord en pad gaan naar .env (gitignored);
 * het wachtwoord wordt nergens getoond. Draaien: npm run testaccount
 * Start daarna de app op die map met: npm run dev:test
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const map = path.resolve(process.cwd(), "data-test");
process.env.HRVATSKI_DATA = map;
process.env.HRVATSKI_DB = "";

async function main() {
  const { registreer } = await import("../src/lib/accounts/registreren");
  const { vindOpNaam } = await import("../src/lib/accounts/store");
  const envPad = path.resolve(process.cwd(), ".env");
  const NAAM = "testleerder";
  if (vindOpNaam(NAAM)) {
    console.log("Testaccount bestaat al in data-test/. Verwijder die map om opnieuw te beginnen.");
    return;
  }
  const wachtwoord = crypto.randomBytes(12).toString("base64url");
  const r = await registreer({ naam: NAAM, weergavenaam: "Testleerder", wachtwoord, vanLaptop: true });
  if (!("gebruiker" in r)) throw new Error("registreren mislukt");
  const regels = [
    "",
    "# Testaccount voor bouwen en testen (data-test/, los van je echte voortgang). Aangemaakt door npm run testaccount.",
    `HRVATSKI_TEST_DATA="${map}"`,
    `HRVATSKI_TEST_NAAM=${NAAM}`,
    `HRVATSKI_TEST_WACHTWOORD=${wachtwoord}`,
    "",
  ];
  fs.appendFileSync(envPad, regels.join("\n"), { mode: 0o600 });
  console.log(`Testaccount '${NAAM}' gemaakt in data-test/; inloggegevens staan in .env.`);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
