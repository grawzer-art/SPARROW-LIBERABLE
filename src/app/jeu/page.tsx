import type { Metadata } from "next";
import { GameHub } from "@/components/GameHub";
import "./hub.css";

export const metadata: Metadata = {
  title: "Salle de jeux — SPARROW",
  description: "Deux jeux du dossier SP-2031 : L'Évasion de Sparrow et SPARROW : 23:59.",
};

export default function Page() {
  return <GameHub />;
}
