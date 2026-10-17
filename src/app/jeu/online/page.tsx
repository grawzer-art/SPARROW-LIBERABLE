import type { Metadata } from "next";
import { OnlineGame } from "@/components/online/OnlineGame";
import "../sparrowgotchi/gotchi.css";
import "../sparrowgotchi/console.css";
import "./online.css";

export const metadata: Metadata = {
  title: "SPARROW ONLINE — Quartier 404 (bêta)",
  description: "Crée ton héros en pixel art et retrouve les autres joueurs au Quartier 404 : déplacements en temps réel, chat, et Sparrow en personne.",
};

export default function Page() {
  return <OnlineGame />;
}
