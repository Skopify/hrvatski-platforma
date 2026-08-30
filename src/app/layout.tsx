import type { Metadata } from "next";

import { Nav } from "@/components/Nav";
import { getProfile } from "@/lib/stats";
import { reviewableCount } from "@/lib/planner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrvatski — leerplatform",
  description: "Kroatisch leren met grammatica in context, spaced repetition en echte productie.",
};

// De navigatie toont de reeks, de XP en het aantal openstaande herhalingen; die
// moeten per verzoek vers zijn, dus mag de layout niet vooraf gerenderd worden.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const profile = getProfile();
  const due = reviewableCount();

  return (
    <html lang="nl">
      <head>
        {/* De interfaceletter staat in de eerste verf; die halen we vooruit zodat
            er geen sprong zit tussen fallback en Jakarta. */}
        <link
          rel="preload"
          href="/fonts/jakarta-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/fonts/fraunces-latin.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen flex-col md:flex-row">
          <Nav streak={profile.streakCurrent} xp={profile.xp} due={due} />
          {/*
            Ruimte onder de inhoud voor de vaste navigatiebalk op de telefoon.
            Iets meer dan de balk hoog is (62px): precies gelijk laat een knop
            aan het einde van een pagina tegen de balk aan eindigen, en dan ziet
            hij eruit alsof hij eronder wegloopt.
          */}
          <main className="min-w-0 flex-1 pb-[86px] md:pb-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
