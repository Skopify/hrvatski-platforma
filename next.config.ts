import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

/*
  Beveiligingskoppen.

  Het platform draait lokaal, maar een lokale server is voor je browser nog
  steeds een website: elke pagina die je in een ander tabblad opent kan
  proberen er verzoeken naartoe te sturen. Deze koppen en de controle in
  src/middleware.ts zorgen dat alleen het platform zelf dat mag.

  De CSP laat inline scripts toe, want Next zet er zelf neer en het thema-script
  in layout.tsx moet vóór React draaien. Alles wat van buiten komt is dicht:
  het platform laadt geen enkele externe bron (letters zijn zelf gehost).
  In dev komt daar eval en een websocket bij voor hot reload.
*/
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  // better-sqlite3 is a native module — it must not be bundled by Turbopack/webpack.
  serverExternalPackages: ["better-sqlite3"],

  // Dev en build krijgen elk hun eigen uitvoermap.
  //
  // Standaard schrijven ze allebei in .next. Draai je een build terwijl de
  // dev-server aanstaat, dan overschrijft de build zijn brokken en valt de
  // draaiende server om met "missing required error components" of een pagina
  // zonder opmaak — een fout die niets met je code te maken heeft en die je
  // alleen kwijtraakt door .next weg te gooien.
  //
  // next dev draait met NODE_ENV=development, next build en next start met
  // production, dus deze schakelaar houdt ze uit elkaars vaarwater.
  distDir: process.env.NODE_ENV === "production" ? ".next-build" : ".next",
};

export default nextConfig;
