import type { Metadata } from "next";
import { Gotchi } from "@/components/gotchi/Gotchi";
import "./gotchi.css";

export const metadata: Metadata = {
  title: "Sparrowgotchi — SPARROW",
  description: "Occupe-toi de Sparrow : frites, salade (il refuse), Dofus et siestes qu'il ne fera pas.",
};

export default function Page() {
  return <Gotchi />;
}
