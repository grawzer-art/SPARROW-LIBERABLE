import type { Metadata, Viewport } from "next";
import { Game } from "@/components/game/Game";

export const metadata: Metadata = {
  title: "L'Évasion de Sparrow — SPARROW",
  description: "Mini jeu rétro : aide Sparrow à faire tomber le compteur de 1 826 jours.",
  openGraph: {
    title: "L'Évasion de Sparrow",
    description: "Mini jeu rétro du dossier SP-2031. Bats le record des potes.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#090909",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function Page() {
  return <Game />;
}
