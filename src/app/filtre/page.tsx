import type { Metadata } from "next";
import { FiltrePage } from "@/components/filtre/FiltrePage";
import "./filtre.css";

export const metadata: Metadata = {
  title: "Filtre Sparrow — SPARROW",
  description: "Le masque du Chevalier Noir et la barbe rousse en direct sur ta tête. Tout reste dans ton téléphone.",
  openGraph: {
    title: "Filtre Sparrow",
    description: "Deviens Sparrow le temps d'une photo.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <FiltrePage />;
}
