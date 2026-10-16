import type { Metadata } from "next";
import { DonPage } from "@/components/DonPage";

export const metadata: Metadata = {
  title: "Don pour le Chevalier Noir — SPARROW",
  description: "Fonds de soutien au Chevalier Noir. Don volontaire entre potes, via PayPal.",
  openGraph: {
    title: "Don pour le Chevalier Noir",
    description: "Fonds de soutien officiel (et totalement fictif) du dossier SP-2031.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <DonPage />;
}
