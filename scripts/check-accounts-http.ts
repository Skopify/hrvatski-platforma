/**
 * Accounts en isolatie door de échte server, met echte cookies.
 * Draai met: npm run check:accounts:http     (bouwt niets: gebruik eerst npm run build)
 *
 * check:accounts bewijst de logica; dit bewijst dat ze aan elkaar zit. Wat hier gebeurt is
 * wat een gebruiker meemaakt: een pagina zonder inlog, een account maken, in- en
 * uitloggen, en twee accounts die naast elkaar draaien zonder elkaar te zien.
 * Draait op een tijdelijke datamap en poort 3300; je eigen voortgang blijft onaangeroerd.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import Database from "better-sqlite3";

import { testBron } from "../src/lib/data";

const BRON = testBron();
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "hrvatski-http-"));
const POORT = 3300;
const URL0 = `http://127.0.0.1:${POORT}`;

if (!fs.existsSync(path.join(process.cwd(), ".next-build", "BUILD_ID"))) {
  console.error("Geen productiebuild gevonden. Draai eerst: npm run build");
  process.exit(1);
}

// Een «bestaande installatie» met echte voortgang, zoals bij de eerste keer na de upgrade.
{
  const src = new Database(BRON, { readonly: true });
  await src.backup(path.join(TMP, "hrvatski.db"));
  src.close();
}
{
  const d = new Database(path.join(TMP, "hrvatski.db"));
  d.prepare("update profile set xp = xp + 777 where id = 1").run();
  d.close();
}
const legacyXp = (() => {
  const d = new Database(path.join(TMP, "hrvatski.db"), { readonly: true });
  const x = (d.prepare("select xp from profile").get() as { xp: number }).xp;
  d.close();
  return x;
})();

const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(POORT)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_ENV: "production", HRVATSKI_DATA: TMP, HRVATSKI_DB: "" },
  stdio: "ignore",
});
const stop = () => server.kill("SIGTERM");
process.on("exit", stop);

for (let i = 0; i < 60; i++) {
  try {
    await fetch(URL0 + "/inloggen", { redirect: "manual" });
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 500));
  }
}

const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });

interface Res {
  status: number;
  headers: Headers;
  tekst: string;
  json: Record<string, unknown> | null;
}
async function vraag(pad: string, o: { methode?: string; cookie?: string; body?: unknown; extra?: Record<string, string> } = {}): Promise<Res> {
  const r = await fetch(URL0 + pad, {
    method: o.methode ?? (o.body ? "POST" : "GET"),
    redirect: "manual",
    headers: {
      "Sec-Fetch-Site": "same-origin",
      Origin: URL0,
      Accept: "text/html,application/json",
      ...(o.body ? { "Content-Type": "application/json" } : {}),
      ...(o.cookie ? { Cookie: o.cookie } : {}),
      ...o.extra,
    },
    body: o.body ? JSON.stringify(o.body) : undefined,
  });
  const tekst = await r.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(tekst);
  } catch {
    // geen json
  }
  return { status: r.status, headers: r.headers, tekst, json };
}
const cookieUit = (r: Res) => (r.headers.get("set-cookie") ?? "").split(";")[0] ?? "";

/* --------------------------------------------------- zonder inlog, niets --- */

let r = await vraag("/");
check("H1", "een pagina zonder inlog stuurt door naar de inlogpagina", r.status >= 300 && r.status < 400 && /\/inloggen/.test(r.headers.get("location") ?? ""), `${r.status} ${r.headers.get("location")}`);
r = await vraag("/api/account");
check("H2", "een API zonder inlog geeft 401", r.status === 401, String(r.status));
r = await vraag("/api/gesprek");
check("H3", "de gespreks-API zonder inlog geeft 401", r.status === 401, String(r.status));
r = await vraag("/api/leven", { methode: "POST" });
check("H4", "alleen het teken van leven is openbaar (de app moet zichzelf kunnen uitzetten)", r.status === 200, String(r.status));
r = await vraag("/inloggen");
check("H5", "zonder enig account stuurt de inlogpagina naar «account maken»", r.status >= 300 && /\/registreren/.test(r.headers.get("location") ?? ""), `${r.status} ${r.headers.get("location")}`);

/* -------------------------------------------- het eerste account, en je data --- */

r = await vraag("/api/auth/registreren", { body: { naam: "Antonio", weergavenaam: "Antonio", wachtwoord: "Groene kikker 42" }, extra: { "x-hrvatski-via": "lan" } });
// Het echte pad loopt via de poortwachter, die deze kop zet; dat het hier uit de kop komt is bewust.
check("H6", "het eerste account wordt geweigerd als het van een ander apparaat komt", r.status === 400 && r.json?.ok === false, `${r.status} ${JSON.stringify(r.json)}`);

r = await vraag("/api/auth/registreren", { body: { naam: "Antonio", weergavenaam: "Antonio", wachtwoord: "Groene kikker 42" } });
const cookieA = cookieUit(r);
check("H7", "het eerste account op de laptop lukt, met een herstelcode en een cookie", r.status === 200 && !!r.json?.herstelcode && cookieA.startsWith("hr_sessie="), `${r.status} ${JSON.stringify(r.json)?.slice(0, 80)}`);
check("H8", "het cookie is HttpOnly en SameSite=Lax", /HttpOnly/i.test(r.headers.get("set-cookie") ?? "") && /SameSite=Lax/i.test(r.headers.get("set-cookie") ?? ""), r.headers.get("set-cookie") ?? "");
check("H9", "je bestaande voortgang is van dit account geworden", r.json?.overgenomen === true, "");

r = await vraag("/api/account", { cookie: cookieA });
check("H10", "de ingelogde eigenaar ziet zijn eigen XP (die van de oude installatie)", r.status === 200 && r.json?.xp === legacyXp && (r.json?.gebruiker as { rol?: string })?.rol === "eigenaar", `${JSON.stringify(r.json)} verwacht ${legacyXp}`);
r = await vraag("/", { cookie: cookieA });
check("H11", "de pagina's werken nu, met zijn naam in de navigatie", r.status === 200 && /Antonio/.test(r.tekst), String(r.status));
r = await vraag("/inloggen", { cookie: cookieA });
check("H12", "wie al ingelogd is, wordt van de inlogpagina doorgestuurd", r.status >= 300 && r.status < 400, String(r.status));

/* ------------------------------------------------------- een tweede account --- */

r = await vraag("/api/auth/registreren", { body: { naam: "Marija", weergavenaam: "Marija", wachtwoord: "Blauwe wolk 77" } });
const cookieB = cookieUit(r);
check("H13", "een tweede account maken lukt", r.status === 200 && cookieB.startsWith("hr_sessie="), `${r.status} ${JSON.stringify(r.json)?.slice(0, 80)}`);
r = await vraag("/api/account", { cookie: cookieB });
check("H14", "het tweede account begint op nul", r.json?.xp === 0 && (r.json?.gebruiker as { rol?: string })?.rol === "gebruiker", JSON.stringify(r.json));

// Iemand anders zijn voortgang veranderen, buiten de app om, en kijken wie het ziet.
const dbA = path.join(TMP, "gebruikers", String((await vraag("/api/account", { cookie: cookieA })).json?.gebruiker && ((await vraag("/api/account", { cookie: cookieA })).json?.gebruiker as { id: number }).id), "hrvatski.db");
{
  const d = new Database(dbA);
  d.prepare("update profile set xp = 31337 where id = 1").run();
  d.close();
}
const a = await vraag("/api/account", { cookie: cookieA });
const b = await vraag("/api/account", { cookie: cookieB });
check("H15", "wat bij A in de database staat, ziet A; B ziet zijn eigen nul", a.json?.xp === 31337 && b.json?.xp === 0, `A=${a.json?.xp} B=${b.json?.xp}`);
const pa = await vraag("/voortgang", { cookie: cookieA });
const pb = await vraag("/voortgang", { cookie: cookieB });
check("H16", "een echte pagina (Voortgang) toont per gebruiker zijn eigen cijfers", pa.status === 200 && pb.status === 200 && /31\.337/.test(pa.tekst) && !/31\.337/.test(pb.tekst), `A ${pa.status} B ${pb.status}`);

r = await vraag("/api/beheer/gebruikers", { cookie: cookieB });
check("H17", "een gewone gebruiker mag de accounts niet beheren", r.status === 403, String(r.status));
r = await vraag("/api/beheer/gebruikers", { cookie: cookieA });
check("H18", "de eigenaar ziet alle accounts", r.status === 200 && (r.json?.gebruikers as unknown[])?.length === 2, JSON.stringify(r.json)?.slice(0, 100));
r = await vraag("/api/afsluiten", { methode: "POST", cookie: cookieB, extra: { "x-hrvatski-actie": "afsluiten" } });
check("H19", "een gewone gebruiker kan de app niet afsluiten", r.status === 403, String(r.status));
r = await vraag("/account/beheer", { cookie: cookieB });
// Next stuurt een pagina-redirect na het eerste stuk HTML als 200 met een doorverwijzing; wat telt is dat de
// lijst met accounts er niet in staat.
check("H20", "de beheerpagina toont een gewone gebruiker niets (en verwijst naar zijn account)",
  !/@antonio/i.test(r.tekst) && (r.status >= 300 || /NEXT_REDIRECT|account/.test(r.tekst)), `${r.status}, bevat lijst: ${/@antonio/i.test(r.tekst)}`);

/* ------------------------------------------------------------------ export --- */

const ea = await fetch(URL0 + "/api/account/export", { headers: { Cookie: cookieA, "Sec-Fetch-Site": "same-origin" } });
const eb = await fetch(URL0 + "/api/account/export", { headers: { Cookie: cookieB, "Sec-Fetch-Site": "same-origin" } });
const bufA = Buffer.from(await ea.arrayBuffer());
const bufB = Buffer.from(await eb.arrayBuffer());
const xpVanBestand = (buf: Buffer) => {
  const f = path.join(TMP, `export-${buf.length}.db`);
  fs.writeFileSync(f, buf);
  const d = new Database(f, { readonly: true });
  const x = (d.prepare("select xp from profile").get() as { xp: number }).xp;
  d.close();
  return x;
};
check("H21", "de export is een echte database met alleen je eigen voortgang", xpVanBestand(bufA) === 31337 && xpVanBestand(bufB) === 0, `A=${xpVanBestand(bufA)} B=${xpVanBestand(bufB)}`);

/* -------------------------------------------------------- inloggen en uit --- */

r = await vraag("/api/auth/inloggen", { body: { naam: "marija", wachtwoord: "verkeerd wachtwoord 1" } });
const fout1 = r;
r = await vraag("/api/auth/inloggen", { body: { naam: "bestaatniet", wachtwoord: "verkeerd wachtwoord 1" } });
check("H22", "fout wachtwoord en onbekende naam: dezelfde melding en status", fout1.status === 401 && r.status === 401 && fout1.json?.melding === r.json?.melding, `${fout1.status}/${r.status}`);
r = await vraag("/api/auth/inloggen", { body: { naam: "MARIJA", wachtwoord: "Blauwe wolk 77", terug: "//evil.example" } });
check("H23", "inloggen kan niet doorsturen naar een andere site", r.status === 200 && r.json?.terug === "/", JSON.stringify(r.json));
const cookieB2 = cookieUit(r);
r = await vraag("/api/auth/uitloggen", { methode: "POST", cookie: cookieB2 });
const naLogout = await vraag("/api/account", { cookie: cookieB2 });
check("H24", "uitloggen maakt het sessiecookie meteen waardeloos (ook als iemand het bewaard heeft)", r.status === 200 && naLogout.status === 401, `${naLogout.status}`);
r = await vraag("/api/account", { cookie: "hr_sessie=verzonnen-token-verzonnen-token-verzonnen" });
check("H25", "een verzonnen cookie geeft niets", r.status === 401, String(r.status));
r = await vraag("/voortgang", { cookie: "hr_sessie=verzonnen-token-verzonnen-token-verzonnen" });
check("H26", "ook een pagina geeft niets bij een verzonnen cookie (geen lege pagina, maar doorsturen)", r.status >= 300 && r.status < 400 && /\/inloggen/.test(r.headers.get("location") ?? ""), `${r.status}`);

r = await vraag("/api/account", { cookie: cookieA, extra: { "Sec-Fetch-Site": "cross-site" } });
check("H27", "een verzoek van een andere site wordt geweigerd, ook mét geldig cookie", r.status === 403, String(r.status));
r = await vraag("/inloggen");
check("H28", "de inlogpagina heeft de beveiligingskoppen", /frame-ancestors 'none'/.test(r.headers.get("content-security-policy") ?? ""), "");

/* -------------------------------------------------------------- uitslag --- */

stop();
const breedte = Math.max(...results.map((x) => x.naam.length));
for (const x of results) console.log(`${x.ok ? "✓" : "✗"} ${x.punt.padEnd(4)} ${x.naam.padEnd(breedte)}${x.ok || !x.detail ? "" : "  → " + x.detail}`);
const fout = results.filter((x) => !x.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(fout.length ? 1 : 0);
