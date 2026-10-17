/**
 * Registre des mini-jeux. Ajouter un mini-jeu = une entrée ici + son composant d'écran,
 * branché dans Gotchi.tsx (`openGame`). Chaque mini-jeu se lance depuis un objet de l'appart.
 */

import type { State } from "./core";
import type { SpotId } from "./map";

export type GameId = "farm" | "muscu" | "cuisine";

export interface MiniGame {
  id: GameId;
  name: string;
  desc: string;
  /** Objet de l'appartement qui lance le jeu. */
  spot: SpotId;
  best: (s: State) => number;
  ready: boolean;
}

export const MINIGAMES: MiniGame[] = [
  {
    id: "farm",
    name: "Session de farm",
    desc: "30 s de récolte et de petits monstres, au PC. Sa passion, version maison.",
    spot: "pc",
    best: (s) => s.bestFarm,
    ready: true,
  },
  {
    id: "muscu",
    name: "Séance de muscu",
    desc: "Pousse au bon moment. Combos, crampes et biceps. Objectif : SPARROW TITAN.",
    spot: "banc",
    best: (s) => s.bestMuscu,
    ready: true,
  },
  {
    id: "cuisine",
    name: "Frites parfaites",
    desc: "Bientôt : le timing de la friteuse.",
    spot: "friteuse",
    best: () => 0,
    ready: false,
  },
];

export const gameForSpot = (spot: SpotId) => MINIGAMES.find((g) => g.ready && g.spot === spot) ?? null;
