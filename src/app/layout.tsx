import type { Metadata, Viewport } from "next";

import { RoughFilter } from "@/components/doodles";
import { Island } from "@/components/Island";
import { Levensteken } from "@/components/Levensteken";
import { THEME_SCRIPT } from "@/components/ThemeToggle";
import { instelling } from "@/lib/levenscyclus";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hrvatski — leerplatform",
  description: "Kroatisch leren met grammatica in context, spaced repetition en echte productie.",
  // Als app op het beginscherm van een iPhone of iPad: eigen naam en icoon, geen Safari-balk.
  appleWebApp: { capable: true, title: "Hrvatski", statusBarStyle: "default" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  // Het toetsenbord verkleint de pagina in plaats van eroverheen te schuiven, zodat een
  // invoerbalk onderaan (Gesprek) zichtbaar blijft terwijl je typt.
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#17161d" },
  ],
};

// De Levensteken en de knoppen hangen af van hoe de app gestart is; dat kan per start verschillen.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const beheerd = instelling().beheerd;

  return (
    // Het thema-script zet data-theme vóór React er is; dat verschil is bedoeld.
    <html lang="nl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <RoughFilter />
        <Island />
        <Levensteken beheerd={beheerd} />
        {children}
      </body>
    </html>
  );
}
