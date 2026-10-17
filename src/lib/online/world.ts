/**
 * SPARROW ONLINE — le Quartier 404 partagé.
 *
 * Même carte que le jeu solo (décor, collisions, lumières), sans les portes de l'aventure solo
 * ni ses PNJ scénarisés. Sparrow y est présent : c'est le personnage central de l'univers.
 */

import type { Facing, MapDef, Tile } from "@/lib/rpg/mapdef";
import { solidAt } from "@/lib/rpg/mapdef";
import { QUARTIER } from "@/lib/rpg/quartier";
import { emptyRpg, type Rpg } from "@/lib/rpg/state";

export const ONLINE_MAP: MapDef = {
  ...QUARTIER,
  name: "Quartier 404 — en ligne",
  warps: QUARTIER.warps.map((w) => ({ ...w, to: null, needs: undefined, lockedKey: undefined, text: w.to === "appart" ? "Les appartements des joueurs ouvriront bientôt. On entend déjà quelqu'un passer l'aspirateur." : (w.text ?? "Ce chemin mène à l'aventure de Sparrow. En ligne, il est encore fermé.") })),
  npcs: [{ id: "sparrow", name: "Sparrow", char: "sparrow", start: { x: 17, y: 21 }, dir: "down" }],
  wild: [],
};

/** État de décor « apaisé » (minuit passé) pour le monde en ligne. */
export const ONLINE_RPG: Rpg = { ...emptyRpg(), quests: { "ville-figee": "terminee" } };

/** Cases d'apparition, autour de la fontaine. */
const SPAWNS: Tile[] = [
  { x: 14, y: 21 },
  { x: 20, y: 21 },
  { x: 14, y: 16 },
  { x: 20, y: 16 },
  { x: 12, y: 19 },
  { x: 22, y: 19 },
  { x: 17, y: 23 },
  { x: 10, y: 13 },
];

/** Une case d'apparition libre (pas sur un autre joueur ni sur un obstacle). */
export function spawnTile(taken: Tile[], r: () => number = Math.random): Tile & { dir: Facing } {
  const free = SPAWNS.filter((t) => !solidAt(ONLINE_MAP, t, ONLINE_RPG) && !taken.some((o) => o.x === t.x && o.y === t.y));
  const t = free.length ? free[Math.floor(r() * free.length)] : SPAWNS[0];
  return { ...t, dir: "down" };
}

/** Sparrow, PNJ central : répliques en boucle, puis (plus tard) des missions coopératives. */
export const SPARROW_LINES: string[][] = [
  ["Oh, un nouveau ! Bienvenue au Quartier 404. Moi c'est Sparrow. Oui, LE Sparrow. Non, je ne signe pas les frites."],
  ["Tu vois tous ces gens qui marchent ? Avant, j'étais le seul à bouger ici. Maintenant il y a des embouteillages devant la fontaine.", "C'est le progrès. Je crois."],
  ["Conseil de pro : marche lentement. Les gens pensent que tu as un plan. Moi, ça fait des années que ça marche."],
  ["Le chat, en haut de l'écran, c'est pour discuter. Sois sympa. Le Chevalier Noir lit tout. Enfin, il dit qu'il lit tout."],
  ["Bientôt, je vais avoir besoin de vous pour des missions. Des vraies. En équipe.", "Pour l'instant, ma mission, c'est de finir ce cornet."],
  ["Si tu croises un Brokito sauvage dans le coin, ne lui parle pas de mayonnaise. Il est très sensible."],
];

/** Missions coopératives : structure prévue (aucune n'est encore active). */
export interface CoopQuest {
  id: string;
  giver: "sparrow";
  name: string;
  /** Nombre de joueurs nécessaires. */
  players: [number, number];
  /** Étapes validées côté serveur (jamais par le client). */
  steps: { id: string; txt: string }[];
}
export const COOP_QUESTS: CoopQuest[] = [];
