import type { Metadata } from "next";
import { Gotchi } from "@/components/gotchi/Gotchi";
import "./gotchi.css";
import "./console.css";

export const metadata: Metadata = {
  title: "SPARROW : 23:59 — L'Élu de la Minute",
  description: "Une aventure RPG rétro : le temps est figé à 23:59, Sparrow part récupérer les fragments d'horloge. Combats, compagnons, boss… et toujours son appart et ses frites.",
};

export default function Page() {
  return <Gotchi />;
}
