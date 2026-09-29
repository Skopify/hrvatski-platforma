import type { MetadataRoute } from "next";

/*
  Zet Hrvatski als app op het beginscherm van je telefoon of iPad: eigen icoon,
  geen adresbalk. Safari op iOS leest vooral de apple-touch-icon en de
  appleWebApp-instellingen in layout.tsx; dit manifest is voor Android en voor
  iPadOS/Chrome.
*/
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hrvatski — Kroatisch leren",
    short_name: "Hrvatski",
    description: "Kroatisch leren met grammatica, verhalen, schrijven en herhalen.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fbfaf7",
    theme_color: "#fbfaf7",
    lang: "nl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
