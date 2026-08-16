import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
