/**
 * Acceptatietests voor telefoon en iPad (koppelen en de poortwachter).
 * Draai met: npm run check:lan
 *
 * De app luistert alleen op je laptop. Voor telefoon en iPad staat er een
 * kleine poortwachter voor (src/lib/lan-proxy.ts) die alleen gekoppelde
 * apparaten doorlaat: eenmalig een 6-cijferige code, daarna een handgetekende
 * cookie. Er is geen inlog en geen account, dus dit moet dicht zijn:
 *
 *   · zonder koppeling komt niets door, ook geen API of actie;
 *   · de beheerknoppen (afsluiten, koppelcode) zijn er nooit vanaf een ander apparaat;
 *   · gokken helpt niet (begrenzing) en een vervalste cookie ook niet.
 *
 * De tests draaien een nep-app en de echte poortwachter op willekeurige poorten.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";

const results: { punt: string; naam: string; ok: boolean; detail: string }[] = [];
const check = (punt: string, naam: string, ok: boolean, detail = "") => results.push({ punt, naam, ok, detail });

const { maakCookie, controleerCookie, cookieNaam } = await import("../src/lib/koppelen");
const { maakPoortwachter } = await import("../src/lib/lan-proxy");

/* -------------------------------------------------------------- cookie --- */

const geheim = "test-geheim-".padEnd(64, "x");
const nu = Date.now();
const goed = maakCookie(geheim, nu + 60_000);
check("N1", "een vers gemaakte cookie is geldig", controleerCookie(geheim, goed, nu), "");
check("N2", "een verlopen cookie is ongeldig", !controleerCookie(geheim, maakCookie(geheim, nu - 1), nu), "");
check("N3", "een vervalste cookie (verlengd) is ongeldig", !controleerCookie(geheim, goed.replace(/^\d+/, String(nu + 9e9)), nu), "");
check("N4", "een cookie met een ander geheim is ongeldig (alles ontkoppelen werkt)", !controleerCookie("ander-geheim", goed, nu), "");
check("N5", "rommel is ongeldig", !controleerCookie(geheim, "abc", nu) && !controleerCookie(geheim, "", nu) && !controleerCookie(geheim, undefined, nu), "");

/* ------------------------------------------------------ de poortwachter --- */

const gezien: { headers: http.IncomingHttpHeaders; url: string; body: string }[] = [];
const app = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    gezien.push({ headers: req.headers, url: req.url ?? "", body });
    if (req.url === "/redirect") {
      res.writeHead(307, { Location: `http://localhost:${(app.address() as AddressInfo).port}/doel` });
      return res.end();
    }
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(`app:${req.url}`);
  });
});
await new Promise<void>((r) => app.listen(0, "127.0.0.1", r));
const appPoort = (app.address() as AddressInfo).port;

const CODE = "483921";
const wachter = maakPoortwachter({ upstreamPoort: appPoort, geheim: () => geheim, code: () => CODE, extraHosts: [] });
await new Promise<void>((r) => wachter.listen(0, "127.0.0.1", r));
const wPoort = (wachter.address() as AddressInfo).port;

interface Antwoord {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}
const vraag = (opts: { method?: string; path: string; headers?: Record<string, string>; body?: string; host?: string }) =>
  new Promise<Antwoord>((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port: wPoort, method: opts.method ?? "GET", path: opts.path, headers: { host: opts.host ?? `192.168.1.20:${wPoort}`, ...opts.headers } },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });

const pair = (code: string, host?: string) =>
  vraag({ method: "POST", path: "/koppel", host, headers: { "content-type": "application/x-www-form-urlencoded" }, body: `code=${code}` });

// Zonder koppeling
const NAVIGATIE = { accept: "text/html,application/xhtml+xml" };
let r = await vraag({ path: "/", headers: NAVIGATIE });
check("N6", "zonder koppeling: een pagina stuurt door naar /koppel", r.status === 302 && r.headers.location === "/koppel", `${r.status} ${r.headers.location}`);
r = await vraag({ path: "/api/gesprek", method: "POST", body: "{}" });
check("N7", "zonder koppeling: een API of actie krijgt 401 en bereikt de app nooit", r.status === 401 && gezien.length === 0, `${r.status}, app kreeg ${gezien.length} verzoek(en)`);
r = await vraag({ path: "/koppel" });
check("N8", "de koppelpagina is er wel, en vraagt om een code", r.status === 200 && /inputmode="numeric"/.test(r.body), String(r.status));
r = await vraag({ path: "/manifest.webmanifest" });
check("N9", "het manifest en de iconen zijn openbaar (de browser vraagt ze zonder cookie)", r.status === 200 && gezien.at(-1)?.url === "/manifest.webmanifest", String(r.status));

// Vreemde host
r = await vraag({ path: "/koppel", host: "evil.com" });
check("N10", "een vreemde hostnaam wordt geweigerd (DNS-rebinding)", r.status === 421 || r.status === 403, String(r.status));

// Koppelen
r = await pair("000000");
check("N11", "een foute code koppelt niet en geeft geen cookie", r.status === 200 && !r.headers["set-cookie"] && /klopt niet/i.test(r.body), String(r.status));
r = await pair(CODE);
const cookie = String(r.headers["set-cookie"] ?? "");
check("N12", "de goede code koppelt: een cookie en door naar de app", r.status === 303 && cookie.startsWith(`${cookieNaam}=`), `${r.status} ${cookie.slice(0, 30)}`);
check("N13", "de cookie is HttpOnly en SameSite=Lax", /HttpOnly/i.test(cookie) && /SameSite=Lax/i.test(cookie), cookie);
const kaal = cookie.split(";")[0]!;

// Gekoppeld
gezien.length = 0;
r = await vraag({ path: "/voortgang", headers: { cookie: kaal } });
check("N14", "gekoppeld komt een pagina door", r.status === 200 && r.body === "app:/voortgang", `${r.status} ${r.body}`);
const h = gezien[0]?.headers ?? {};
check("N15", "de app ziet de poortwachter als localhost (herkomstcontrole klopt)", String(h.host).startsWith("localhost:"), String(h.host));
check("N16", "de app weet dat het verzoek van een ander apparaat kwam", h["x-hrvatski-via"] === "lan", String(h["x-hrvatski-via"]));

gezien.length = 0;
await vraag({ path: "/api/gesprek", method: "POST", headers: { cookie: kaal, origin: `http://192.168.1.20:${wPoort}`, "x-hrvatski-via": "niet-lan", "content-type": "application/json" }, body: '{"a":1}' });
const p = gezien[0];
check("N17", "een meegestuurde x-hrvatski-via wordt overschreven, niet vertrouwd", p?.headers["x-hrvatski-via"] === "lan", String(p?.headers["x-hrvatski-via"]));
check("N18", "Origin wordt herschreven naar de app, en de body komt door", String(p?.headers.origin).startsWith("http://localhost:") && p?.body === '{"a":1}', `${p?.headers.origin} ${p?.body}`);

r = await vraag({ path: "/redirect", headers: { cookie: kaal } });
check("N19", "een doorverwijzing van de app wijst naar het adres van de telefoon, niet naar localhost", /^http:\/\/192\.168\.1\.20:/.test(String(r.headers.location)), String(r.headers.location));

for (const pad of ["/api/afsluiten", "/api/koppelcode", "/api/lan", "/api/herstart"]) {
  gezien.length = 0;
  r = await vraag({ path: pad, method: pad === "/api/koppelcode" ? "GET" : "POST", headers: { cookie: kaal } });
  check(`N20${pad}`, `beheer (${pad}) is er niet vanaf een ander apparaat, ook niet gekoppeld`, r.status === 403 && gezien.length === 0, `${r.status}`);
}

r = await vraag({ path: "/", headers: { ...NAVIGATIE, cookie: kaal.replace(/\d{5}\./, "99999.") } });
check("N21", "een vervalste cookie komt er niet door", r.status === 302, String(r.status));

// Gokken
let vergrendeld = false;
for (let i = 0; i < 25; i++) {
  const x = await pair(String(100000 + i), "192.168.1.77:" + wPoort);
  if (x.status === 429) vergrendeld = true;
}
check("N22", "te veel foute codes achter elkaar: de koppelpagina sluit tijdelijk", vergrendeld, "");
r = await pair(CODE, "192.168.1.77:" + wPoort);
check("N23", "tijdens de vergrendeling werkt ook de goede code niet", r.status === 429, String(r.status));

wachter.close();
app.close();

const breedte = Math.max(...results.map((x) => x.naam.length));
for (const x of results) console.log(`${x.ok ? "✓" : "✗"} ${x.punt.padEnd(18)} ${x.naam.padEnd(breedte)}${x.ok || !x.detail ? "" : "  → " + x.detail}`);
const fout = results.filter((x) => !x.ok);
console.log(`\n${results.length - fout.length} van ${results.length} geslaagd.`);
process.exit(fout.length ? 1 : 0);
