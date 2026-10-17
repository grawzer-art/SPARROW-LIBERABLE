import type { Metadata } from "next";
import { Gotchi } from "@/components/gotchi/Gotchi";
import "./gotchi.css";
import "./console.css";

export const metadata: Metadata = {
  title: "Sparrowgotchi — SPARROW",
  description: "Occupe-toi de Sparrow dans son appart : frites, salade (il refuse), sessions de farm, niveaux, objets et trophées.",
};

export default function Page() {
  return <Gotchi />;
}
