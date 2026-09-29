/*
  Wat een gebruikersnaam en een wachtwoord moeten zijn. Geen mailadres: het
  platform draait lokaal en verstuurt niets. Retourneert null als het goed is,
  anders een melding in gewone taal.
*/
const ZWAK = new Set([
  "wachtwoord", "password", "12345678", "123456789", "1234567890", "qwertyui", "qwerty123", "hrvatski", "hrvatski123",
  "welkom123", "welkom01", "kroatisch", "iloveyou", "letmein1", "abcdefgh",
]);

export function valideerNaam(naam: string): string | null {
  if (typeof naam !== "string") return "Kies een gebruikersnaam.";
  if (naam.length < 3 || naam.length > 24) return "Een gebruikersnaam heeft 3 tot 24 tekens.";
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(naam)) return "Begin met een letter; daarna letters, cijfers, punt, streepje of underscore.";
  return null;
}

export function valideerWeergavenaam(naam: string): string | null {
  const n = typeof naam === "string" ? naam.trim() : "";
  if (n.length < 1 || n.length > 40) return "Je naam mag 1 tot 40 tekens zijn.";
  return null;
}

export function valideerWachtwoord(wachtwoord: string, naam: string): string | null {
  if (typeof wachtwoord !== "string" || wachtwoord.length < 8) return "Een wachtwoord heeft minstens 8 tekens.";
  if (wachtwoord.length > 200) return "Dat wachtwoord is te lang (maximaal 200 tekens).";
  const klein = wachtwoord.toLowerCase();
  if (klein === naam.toLowerCase()) return "Je wachtwoord mag niet gelijk zijn aan je gebruikersnaam.";
  if (ZWAK.has(klein)) return "Dat wachtwoord is te makkelijk te raden. Kies iets anders.";
  if (/^(.)\1+$/.test(wachtwoord)) return "Een wachtwoord van steeds hetzelfde teken is te makkelijk te raden.";
  return null;
}
