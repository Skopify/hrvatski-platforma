import type { Metadata, Viewport } from "next";

import { HoverLight } from "@/components/HoverLight";
import { Nav } from "@/components/Nav";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { getProfile } from "@/lib/stats";
import { reviewableCount } from "@/lib/planner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrvatski — leerplatform",
  description: "Kroatisch leren met grammatica in context, spaced repetition en echte productie.",
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0c" },
  ],
};

// De navigatie toont de reeks, de XP en het aantal openstaande herhalingen; die
// moeten per verzoek vers zijn, dus mag de layout niet vooraf gerenderd worden.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();
  const due = reviewableCount();

  return (
    // Het thema-script zet data-theme vóór React er is; dat verschil is bedoeld.
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">
        <HoverLight />
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav streak={profile.streakCurrent} xp={profile.xp} due={due} />
          {/*
            Ruimte onder de inhoud voor de tabbalk op de telefoon: 56px balk
            plus de veilige zone van de telefoon, plus lucht, zodat een knop
            aan het eind van een pagina er nooit onder verdwijnt.
          */}
          <main className="min-w-0 flex-1 pb-[calc(80px+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
