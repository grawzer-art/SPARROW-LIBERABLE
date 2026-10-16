import type { Metadata } from "next";
import { CapsulePage } from "@/components/capsule/CapsulePage";
import "./capsule.css";

export const metadata: Metadata = {
  title: "Capsule 2031 — SPARROW",
  description: "Capsule temporelle scellée jusqu'au 12 octobre 2031. Écrivez au Sparrow de 2031.",
  openGraph: {
    title: "Capsule temporelle 2031",
    description: "Annexe C du dossier SP-2031. Ouverture le 12.10.2031.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <CapsulePage />;
}
