/*
  Welke hostnamen zijn van jezelf? Gebruikt door de middleware (de app) en door de
  poortwachter voor telefoon en iPad. Zie src/middleware.ts voor het waarom
  (DNS-rebinding).
*/
const PRIVATE_IPV4 = /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})$/;

export function hostnaamVan(host: string): string {
  // "[::1]:3000" → "[::1]"; "localhost:3000" → "localhost"
  return host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0]!;
}

export function hostToegestaan(host: string | null | undefined, extra: readonly string[] = []): boolean {
  if (!host) return false;
  const naam = hostnaamVan(host.toLowerCase());
  return (
    naam === "localhost" ||
    naam === "[::1]" ||
    naam.endsWith(".local") ||
    PRIVATE_IPV4.test(naam) ||
    extra.includes(naam)
  );
}
