import type { Metadata } from "next";
import "@fontsource/playfair-display/latin-400-italic.css";
import "@fontsource/playfair-display/latin-700.css";
import "@fontsource/playfair-display/latin-900.css";
import "@fontsource/playfair-display/latin-900-italic.css";
import "@fontsource/unifrakturmaguntia/latin-400.css";
import { GazettePage } from "@/components/gazette/GazettePage";
import "./gazette.css";

export const metadata: Metadata = {
  title: "La Gazette du Chaos — SPARROW",
  description: "Journal satirique : « L'actualité est déjà assez ridicule. On en rajoute. » 100 % parodie.",
  openGraph: {
    title: "La Gazette du Chaos",
    description: "L'actualité est déjà assez ridicule. On en rajoute. (Journal parodique)",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
  },
};

export default function Page() {
  return <GazettePage />;
}
