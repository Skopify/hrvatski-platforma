import { CommandMenu } from "@/components/CommandMenu";
import { Nav } from "@/components/Nav";
import { vereisGebruiker } from "@/lib/accounts/sessie";
import { instelling } from "@/lib/levenscyclus";
import { reviewableCount } from "@/lib/planner";
import { dailyStats, getProfile } from "@/lib/stats";

// De navigatie toont de reeks, de XP en het aantal openstaande herhalingen van de ingelogde
// gebruiker; die moeten per verzoek vers zijn.
export const dynamic = "force-dynamic";

/*
  Alles achter de login. Geen geldige sessie? Dan gaat hij hier naar /inloggen, en nog vóór er
  iets uit een database wordt gelezen. De database zelf weigert het ook zonder gebruiker.
*/
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const gebruiker = await vereisGebruiker();
  const profile = getProfile();
  const due = reviewableCount();
  // Afsluiten en Telefoon & iPad zijn er alleen voor de eigenaar.
  const beheerd = instelling().beheerd && gebruiker.rol === "eigenaar";
  const todayXp = dailyStats(1).at(-1)?.xp ?? 0;

  return (
    <>
      <CommandMenu />
      <div className="flex min-h-dvh flex-col md:flex-row">
        <Nav
          streak={profile.streakCurrent}
          xp={profile.xp}
          due={due}
          todayXp={todayXp}
          goalXp={profile.dailyGoalXp}
          beheerd={beheerd}
          gebruiker={{ naam: gebruiker.weergavenaam, eigenaar: gebruiker.rol === "eigenaar" }}
        />
        {/*
          Ruimte onder de inhoud voor de zwevende tabbalk op de telefoon:
          64px balk + 10px marge + de veilige zone, plus lucht, zodat een
          knop aan het eind van een pagina er nooit onder verdwijnt.
          overflow-x: clip voorkomt dat een sticker of krabbel de pagina breder maakt.
        */}
        <main className="min-w-0 flex-1 overflow-x-clip pb-[calc(100px+env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] md:pb-0">
          {children}
        </main>
      </div>
    </>
  );
}
