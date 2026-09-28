import type { Metadata, Viewport } from "next";

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
    { media: "(prefers-color-scheme: light)", color: "#f3f4f1" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0e11" },
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
        {/* Archivo draagt de hele interface; die halen we vooruit zodat er geen
            sprong zit tussen de noodletter en de echte. */}
        <link
          rel="preload"
          href="/fonts/archivo-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav streak={profile.streakCurrent} xp={profile.xp} due={due} />
          {/*
            Ruimte onder de inhoud voor de navigatiebalk op de
            telefoon: 60px balk plus de veilige zone van de telefoon,
            plus lucht, zodat een knop aan het eind van een pagina er nooit
            onder verdwijnt.
          */}
          <main className="min-w-0 flex-1 pb-[calc(84px+env(safe-area-inset-bottom))] md:pb-0">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
