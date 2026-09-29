import http from "node:http";

import { hostToegestaan } from "./host";
import { Begrenzing, codeKlopt, COOKIE_DAGEN, controleerCookie, cookieNaam, cookieUit, koppelPagina, maakCookie } from "./koppelen";

/*
  De poortwachter voor telefoon en iPad.

  De app zelf luistert alleen op de laptop (127.0.0.1). Staat "Telefoon & iPad"
  aan, dan draait hier bovenop een tweede, kleine server op het netwerk die
  ALLES doorstuurt naar de app, maar alleen voor apparaten die gekoppeld zijn.
  Zo hoeft de app zelf nooit aan het netwerk bloot te staan, en zit alle
  toegangscontrole op één plek.

  Wat de poortwachter garandeert (en check:lan test):
    · zonder cookie komt er niets door: pagina's sturen door naar /koppel, al het
      andere krijgt 401 en bereikt de app nooit;
    · elk doorgestuurd verzoek krijgt x-hrvatski-via: lan, ook als de client die
      kop zelf meestuurt; de app gebruikt hem om beheer alleen op de laptop toe te staan;
    · Host en Origin worden herschreven naar localhost, zodat de herkomstcontrole van
      de app klopt, en doorverwijzingen wijzen terug naar het adres van het apparaat;
    · de beheerpaden bestaan hier niet.
*/

const OPENBAAR = [/^\/manifest\.webmanifest$/, /^\/icons\//, /^\/_next\/static\//, /^\/fonts\//, /^\/favicon\.ico$/];
const BEHEER = ["/api/afsluiten", "/api/koppelcode", "/api/lan", "/api/herstart"];
const HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade"]);

export interface PoortwachterOpties {
  upstreamPoort: number;
  /** Functie, zodat "alle apparaten ontkoppelen" meteen werkt. */
  geheim: () => string;
  code: () => string;
  extraHosts: readonly string[];
}

export function maakPoortwachter(o: PoortwachterOpties): http.Server {
  const begrenzing = new Begrenzing();

  const stuurNaarApp = (req: http.IncomingMessage, res: http.ServerResponse, host: string) => {
    const headers: http.OutgoingHttpHeaders = {};
    for (const [k, v] of Object.entries(req.headers)) if (!HOP.has(k) && k !== "x-hrvatski-via") headers[k] = v;
    const intern = `localhost:${o.upstreamPoort}`;
    headers.host = intern;
    if (typeof req.headers.origin === "string") headers.origin = `http://${intern}`;
    if (typeof req.headers.referer === "string") headers.referer = req.headers.referer.replace(/^https?:\/\/[^/]+/, `http://${intern}`);
    headers["x-hrvatski-via"] = "lan";

    const up = http.request({ host: "127.0.0.1", port: o.upstreamPoort, method: req.method, path: req.url, headers }, (ur) => {
      const uit: http.OutgoingHttpHeaders = {};
      for (const [k, v] of Object.entries(ur.headers)) if (!HOP.has(k)) uit[k] = v;
      if (typeof uit.location === "string") {
        uit.location = uit.location.replace(new RegExp(`^https?://(localhost|127\\.0\\.0\\.1):${o.upstreamPoort}`), `http://${host}`);
      }
      res.writeHead(ur.statusCode ?? 502, uit);
      ur.pipe(res);
    });
    up.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Hrvatski op de laptop is niet bereikbaar. Staat de app aan?");
    });
    req.pipe(up);
  };

  return http.createServer((req, res) => {
    const host = req.headers.host ?? "";
    if (!hostToegestaan(host, o.extraHosts)) {
      res.writeHead(421, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Deze hostnaam is niet toegestaan.");
    }
    const pad = (req.url ?? "/").split("?")[0]!;
    const bron = req.socket.remoteAddress ?? "onbekend";

    // Koppelen
    if (pad === "/koppel") {
      if (req.method === "POST") {
        let body = "";
        req.on("data", (c) => {
          body += c;
          if (body.length > 200) req.destroy();
        });
        req.on("end", () => {
          if (!begrenzing.toegestaan(bron)) {
            res.writeHead(429, { "Content-Type": "text/html; charset=utf-8" });
            return res.end(koppelPagina({ vergrendeld: true }));
          }
          const code = new URLSearchParams(body).get("code") ?? "";
          if (codeKlopt(o.code(), code)) {
            begrenzing.goed();
            const verloopt = Date.now() + COOKIE_DAGEN * 86_400_000;
            res.writeHead(303, {
              Location: "/",
              "Set-Cookie": `${cookieNaam}=${maakCookie(o.geheim(), verloopt)}; Path=/; Max-Age=${COOKIE_DAGEN * 86400}; HttpOnly; SameSite=Lax`,
            });
            return res.end();
          }
          begrenzing.fout(bron);
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
          res.end(koppelPagina({ fout: "Die code klopt niet. Kijk nog eens op de laptop." }));
        });
        return;
      }
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      return res.end(koppelPagina());
    }

    // Beheer bestaat niet vanaf een ander apparaat.
    if (BEHEER.includes(pad)) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Alleen op de laptop zelf.");
    }

    // Wat de browser zonder cookie ophaalt om de app te kunnen installeren.
    if (OPENBAAR.some((r) => r.test(pad))) return stuurNaarApp(req, res, host);

    if (!controleerCookie(o.geheim(), cookieUit(req.headers.cookie))) {
      if (req.method === "GET" && (req.headers.accept ?? "").includes("text/html")) {
        res.writeHead(302, { Location: "/koppel", "Cache-Control": "no-store" });
      } else {
        res.writeHead(401, { "Content-Type": "text/plain; charset=utf-8" });
      }
      return res.end();
    }
    stuurNaarApp(req, res, host);
  });
}
