/**
 * Acceptatietests voor accounts, sessies en gescheiden voortgang.
 * Draai met: npm run check:accounts
 *
 * Wat hier bewezen moet worden, in volgorde van belang:
 *
 *   1. Geen gebruiker ziet ooit de voortgang van een ander (fysieke scheiding).
 *   2. Zonder geldige sessie geeft de database niets: faalt dicht.
 *   3. Je bestaande voortgang gaat niet verloren als de eerste account wordt gemaakt.
 *   4. Wachtwoorden, sessies en herstelcodes zijn zo veilig als het zonder e-mail kan.
 *
 * Draait op een tijdelijke datamap (HRVATSKI_DATA); je echte voortgang wordt
 * niet aangeraakt.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { testBron } from "../src/lib/data";
const BRON = testBron(); // vóór HRVATSKI_DATA verandert
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-accounts-"));
process.env.HRVATSKI_DATA = TMP;
delete process.env.HRVATSKI_DB;

const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });
const werpt = async (f: () => unknown) => {
  try {
    await f();
    return false;
  } catch {
    return true;
  }
};

const { hashWachtwoord, controleerWachtwoord, nieuweHerstelcode, normaliseerCode } = await import("../src/lib/accounts/wachtwoord");
const { valideerNaam, valideerWachtwoord } = await import("../src/lib/accounts/regels");
const acc = await import("../src/lib/accounts/registreren");
const store = await import("../src/lib/accounts/store");
const { metGebruiker } = await import("../src/lib/accounts/context");
const { db, sqlite } = await import("../src/lib/db");
const { profile } = await import("../src/lib/db/schema");
const data = await import("../src/lib/data");

/* ------------------------------------------------------- wachtwoorden --- */

const h1 = await hashWachtwoord("Een goed wachtwoord 1");
const h2 = await hashWachtwoord("Een goed wachtwoord 1");
check("A1", "een wachtwoord klopt tegen zijn hash, een ander niet",
  (await controleerWachtwoord("Een goed wachtwoord 1", h1)) && !(await controleerWachtwoord("Een goed wachtwoord 2", h1)), "");
check("A2", "twee hashes van hetzelfde wachtwoord verschillen (eigen zout) en bevatten geen wachtwoord", h1 !== h2 && !h1.includes("goed wachtwoord"), "");
check("A3", "kapotte of vreemde hashes worden afgewezen zonder crash",
  !(await controleerWachtwoord("x", "")) && !(await controleerWachtwoord("x", "rommel$1$2")) && !(await controleerWachtwoord("x", "scrypt$a$b$c$d$e")), "");
const code = nieuweHerstelcode();
check("A4", "een herstelcode heeft vier groepen van vier en overleeft spaties en kleine letters",
  /^([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/.test(code) && normaliseerCode(code.toLowerCase().replace(/-/g, " ")) === normaliseerCode(code), code);

/* -------------------------------------------------------------- regels --- */

check("A5", "gebruikersnaam: 3 tot 24 tekens, begint met een letter, geen spaties of rare tekens",
  valideerNaam("Anna") === null && valideerNaam("a_b-c.9") === null && valideerNaam("ab") !== null && valideerNaam("9abc") !== null &&
  valideerNaam("an na") !== null && valideerNaam("a".repeat(25)) !== null && valideerNaam("../etc") !== null, "");
check("A6", "wachtwoord: minstens 8 tekens, niet gelijk aan je naam, niet een bekend zwak wachtwoord",
  valideerWachtwoord("kort", "anna") !== null && valideerWachtwoord("annaanna", "annaanna") !== null && valideerWachtwoord("wachtwoord", "anna") !== null &&
  valideerWachtwoord("Groene kikker 42", "anna") === null, "");

/* -------------------------------------------- de eerste account, en je oude data --- */

// Een «bestaande installatie»: data/hrvatski.db met echte voortgang erin.
const oud = data.legacyDbPad();
{
  const src = new Database(BRON, { readonly: true });
  await src.backup(oud);
  src.close();
}
{
  // In CI is de bron een verse database zonder voortgang; zet er iets in dat we kunnen terugvinden.
  const d = new Database(oud);
  d.prepare("update profile set xp = xp + 777 where id = 1").run();
  d.close();
}
const tel = (pad: string, tabel: string) => {
  const d = new Database(pad, { readonly: true });
  const n = (d.prepare(`select count(*) c from ${tabel}`).get() as { c: number }).c;
  d.close();
  return n;
};
const voorLog = tel(oud, "review_log");
const voorXp = (() => {
  const d = new Database(oud, { readonly: true });
  const x = (d.prepare("select xp from profile").get() as { xp: number }).xp;
  d.close();
  return x;
})();

check("A7", "de eerste account kan niet vanaf een ander apparaat worden gemaakt (dan pakt een vreemde je voortgang)",
  await werpt(() => acc.registreer({ naam: "Eigenaar", weergavenaam: "Eigenaar", wachtwoord: "Groene kikker 42", vanLaptop: false })), "");

const eerste = await acc.registreer({ naam: "Antonio", weergavenaam: "Antonio", wachtwoord: "Groene kikker 42", vanLaptop: true });
check("A8", "de eerste account is de eigenaar en krijgt een herstelcode", eerste.gebruiker.rol === "eigenaar" && /^([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/.test(eerste.herstelcode), "");
const pad1 = data.gebruikerDbPad(eerste.gebruiker.id);
check("A9", "je bestaande voortgang is overgenomen: zelfde aantal reviews en zelfde XP",
  fs.existsSync(pad1) && tel(pad1, "review_log") === voorLog && voorXp >= 777, `reviews ${voorLog} → ${fs.existsSync(pad1) ? tel(pad1, "review_log") : "geen bestand"}, xp ${voorXp}`);
check("A10", "het oude bestand is verplaatst, niet gekopieerd (er is één waarheid)", !fs.existsSync(oud), "");
const backups = fs.existsSync(path.join(TMP, "backups")) ? fs.readdirSync(path.join(TMP, "backups")) : [];
check("A11", "er staat een back-up van de oude database vóór het overnemen", backups.some((f) => /voor-accounts/.test(f)), backups.join(", "));

/* ----------------------------------------------------- tweede gebruiker --- */

const tweede = await acc.registreer({ naam: "Marija", weergavenaam: "Marija", wachtwoord: "Blauwe wolk 77", vanLaptop: false });
check("A12", "een tweede account is een gewone gebruiker met een eigen, lege database", tweede.gebruiker.rol === "gebruiker" && tel(data.gebruikerDbPad(tweede.gebruiker.id), "review_log") === 0, "");
check("A13", "dezelfde naam kan niet twee keer, ook niet met andere hoofdletters",
  await werpt(() => acc.registreer({ naam: "marija", weergavenaam: "x", wachtwoord: "Blauwe wolk 78", vanLaptop: false })), "");

/* ----------------------------------------------------------- isolatie --- */

const xpVan = (id: number) => metGebruiker(id, () => db.select({ xp: profile.xp }).from(profile).get()?.xp ?? -1);
check("A14", "gebruiker 1 ziet zijn eigen voortgang", xpVan(eerste.gebruiker.id) === voorXp, `${xpVan(eerste.gebruiker.id)} ≠ ${voorXp}`);
check("A15", "gebruiker 2 begint op nul", xpVan(tweede.gebruiker.id) === 0, String(xpVan(tweede.gebruiker.id)));

metGebruiker(tweede.gebruiker.id, () => {
  sqlite.prepare("update profile set xp = 4242 where id = 1").run();
});
check("A16", "wat gebruiker 2 schrijft, staat bij gebruiker 2", xpVan(tweede.gebruiker.id) === 4242, "");
check("A17", "en verandert niets bij gebruiker 1", xpVan(eerste.gebruiker.id) === voorXp, String(xpVan(eerste.gebruiker.id)));
check("A18", "twee gebruikers tegelijk in dezelfde tick raken elkaar niet",
  (await Promise.all([1, 2, 3, 4].map(async (i) => metGebruiker(i % 2 ? eerste.gebruiker.id : tweede.gebruiker.id, async () => {
    await new Promise((r) => setTimeout(r, 5 * (5 - i)));
    return xpVan(i % 2 ? eerste.gebruiker.id : tweede.gebruiker.id) === (i % 2 ? voorXp : 4242) && metGebruiker(i % 2 ? eerste.gebruiker.id : tweede.gebruiker.id, () => db.select({ xp: profile.xp }).from(profile).get()?.xp) === (i % 2 ? voorXp : 4242);
  })))).every(Boolean), "");
check("A19", "zonder gebruiker geeft de database niets (faalt dicht)", await werpt(() => db.select().from(profile).all()), "");
check("A20", "een gebruikers-id kan geen pad buiten zijn map opleveren", ((): boolean => {
  const p = data.gebruikerDbPad("../../etc" as unknown as number);
  return p.startsWith(TMP) && !p.includes("..");
})(), "");

/* ------------------------------------------------------------ inloggen --- */

const ok = await acc.inloggen({ naam: "antonio", wachtwoord: "Groene kikker 42", bron: "laptop", apparaat: "test" });
check("A21", "inloggen met het goede wachtwoord (naam zonder hoofdletters) geeft een sessie", ok.ok && !!ok.token && ok.gebruiker.naam === "Antonio", "");
const fout1 = await acc.inloggen({ naam: "Antonio", wachtwoord: "verkeerd wachtwoord 1", bron: "laptop", apparaat: "test" });
const fout2 = await acc.inloggen({ naam: "bestaatniet", wachtwoord: "verkeerd wachtwoord 1", bron: "laptop", apparaat: "test" });
check("A22", "een fout wachtwoord en een onbekende naam geven dezelfde melding (niet te raden wie bestaat)",
  !fout1.ok && !fout2.ok && fout1.melding === fout2.melding, `${(fout1 as { melding?: string }).melding} | ${(fout2 as { melding?: string }).melding}`);
check("A23", "de sessie herkent zijn gebruiker; een verzonnen token niet",
  ok.ok && store.zoekSessie(ok.token)?.id === eerste.gebruiker.id && store.zoekSessie("verzonnen-token") === null, "");
check("A24", "in de database staat niet het token zelf maar een hash", ok.ok && !fs.readFileSync(path.join(TMP, "accounts.db")).includes(Buffer.from(ok.token)), "");

let vergrendeld = false;
for (let i = 0; i < 8; i++) {
  const r = await acc.inloggen({ naam: "Marija", wachtwoord: `gok nummer ${i} xx`, bron: "192.168.1.9", apparaat: "test" });
  if (!r.ok && r.vergrendeld) vergrendeld = true;
}
check("A25", "te veel foute pogingen op één naam: tijdelijk geblokkeerd", vergrendeld, "");
const nogGoed = await acc.inloggen({ naam: "Marija", wachtwoord: "Blauwe wolk 77", bron: "192.168.1.9", apparaat: "test" });
check("A26", "tijdens de blokkade werkt zelfs het goede wachtwoord niet (anders is gokken gratis)", !nogGoed.ok, "");

/* ---------------------------------------------- sessies en wachtwoorden --- */

const s2 = store.maakSessie(eerste.gebruiker.id, "tweede apparaat");
store.verloopSessieOp(s2, Date.now() - 1000);
check("A27", "een verlopen sessie werkt niet meer", store.zoekSessie(s2) === null, "");

const s3 = store.maakSessie(eerste.gebruiker.id, "telefoon");
const s4 = store.maakSessie(eerste.gebruiker.id, "iPad");
await acc.wijzigWachtwoord({ gebruikerId: eerste.gebruiker.id, huidig: "Groene kikker 42", nieuw: "Rode appel 2026 x", behoudToken: s3 });
check("A28", "een wachtwoord wijzigen logt de andere apparaten uit, dit apparaat blijft ingelogd",
  store.zoekSessie(s3)?.id === eerste.gebruiker.id && store.zoekSessie(s4) === null, "");
check("A29", "met het verkeerde huidige wachtwoord kun je het niet wijzigen",
  await werpt(() => acc.wijzigWachtwoord({ gebruikerId: eerste.gebruiker.id, huidig: "fout wachtwoord!", nieuw: "Rode appel 2027 y", behoudToken: s3 })), "");

const herstel = await acc.wachtwoordVergeten({ naam: "Antonio", herstelcode: eerste.herstelcode.toLowerCase(), nieuw: "Paarse maan 555" });
check("A30", "met de herstelcode kun je een nieuw wachtwoord kiezen", herstel.ok, "");
check("A31", "een herstelcode werkt één keer: je krijgt een nieuwe en de oude is dood",
  herstel.ok && herstel.nieuweHerstelcode !== eerste.herstelcode && !(await acc.wachtwoordVergeten({ naam: "Antonio", herstelcode: eerste.herstelcode, nieuw: "Weer een nieuw 999" })).ok, "");
check("A32", "na herstel zijn alle oude sessies weg", store.zoekSessie(s3) === null, "");
check("A33", "een verkeerde herstelcode kan gokken niet versnellen (ook begrensd)",
  await (async () => {
    let dicht = false;
    for (let i = 0; i < 8; i++) {
      const r = await acc.wachtwoordVergeten({ naam: "Antonio", herstelcode: "AAAA-BBBB-CCCC-DDDD", nieuw: "Iets anders 1234" });
      if (!r.ok && r.vergrendeld) dicht = true;
    }
    return dicht;
  })(), "");

/* ----------------------------------------------------- beheer en wissen --- */

check("A34", "een gewone gebruiker kan geen andere gebruiker verwijderen of resetten",
  await werpt(() => acc.beheerVerwijder({ uitvoerderId: tweede.gebruiker.id, doelId: eerste.gebruiker.id })) &&
  await werpt(() => acc.beheerResetWachtwoord({ uitvoerderId: tweede.gebruiker.id, doelId: eerste.gebruiker.id })), "");
check("A35", "de eigenaar kan zichzelf niet verwijderen via beheer (dan is er geen eigenaar meer)",
  await werpt(() => acc.beheerVerwijder({ uitvoerderId: eerste.gebruiker.id, doelId: eerste.gebruiker.id })), "");

const tijdelijk = await acc.beheerResetWachtwoord({ uitvoerderId: eerste.gebruiker.id, doelId: tweede.gebruiker.id });
const naReset = await acc.inloggen({ naam: "Marija", wachtwoord: tijdelijk.tijdelijkWachtwoord, bron: "laptop", apparaat: "test" });
check("A36", "de eigenaar kan een tijdelijk wachtwoord geven; daarmee kan de gebruiker weer in", naReset.ok, "");

await acc.zetRegistratie({ uitvoerderId: eerste.gebruiker.id, open: false });
check("A37", "de eigenaar kan registratie sluiten; daarna kan niemand zich meer aanmelden",
  await werpt(() => acc.registreer({ naam: "Ivan", weergavenaam: "Ivan", wachtwoord: "Gele citroen 12", vanLaptop: false })), "");
await acc.zetRegistratie({ uitvoerderId: eerste.gebruiker.id, open: true });

const derde = await acc.registreer({ naam: "Ivan", weergavenaam: "Ivan", wachtwoord: "Gele citroen 12", vanLaptop: false });
const derdePad = data.gebruikerDbPad(derde.gebruiker.id);
const tok = store.maakSessie(derde.gebruiker.id, "x");
await acc.verwijderAccount({ gebruikerId: derde.gebruiker.id, wachtwoord: "Gele citroen 12" });
const backupsNa = fs.readdirSync(path.join(TMP, "backups"));
check("A38", "een account verwijderen haalt zijn map en sessies weg en laat een back-up achter",
  !fs.existsSync(derdePad) && store.zoekSessie(tok) === null && backupsNa.some((f) => /verwijderd/.test(f)), backupsNa.join(", "));
check("A39", "een verwijderd account kan niet meer inloggen", !(await acc.inloggen({ naam: "Ivan", wachtwoord: "Gele citroen 12", bron: "laptop", apparaat: "x" })).ok, "");

/* -------------------------------------------------------------- uitslag --- */

const breedte = Math.max(...results.map((r) => r.naam.length));
for (const r of results) console.log(`${r.ok ? "✓" : "✗"} ${r.punt.padEnd(4)} ${r.naam.padEnd(breedte)}${r.ok || !r.detail ? "" : "  → " + r.detail}`);
const fout = results.filter((r) => !r.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fout.length ? 1 : 0);
