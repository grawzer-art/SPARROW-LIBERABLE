/**
 * RPG — carte du QUARTIER 404 (logique pure, testable).
 *
 * Cases de 16 px, vue de dessus façon RPG portable. La carte est décrite par :
 *  - un sol (herbe, route, trottoirs, place pavée, chemins, gravier, eau) ;
 *  - des éléments posés (« props ») : bâtiments, arbres, lampadaires, fontaine… avec leur
 *    emprise au sol (cases bloquantes) et une partie haute qui passe devant Sparrow ;
 *  - des PNJ (position, petit trajet), des objets interactifs, des portes et des zones.
 * Ajouter un élément = une ligne dans `PROPS` ; le rendu est dans components/rpg/tiles.ts.
 */

import {
  TILE,
  makeMap,
  reachable as reachableOn,
  restoreOn,
  solidAt,
  step,
  thingAt as thingOn,
  warpAt,
  zoneAt as zoneOn,
  type Facing,
  type Ground,
  type MapDef,
  type NpcDef,
  type Prop,
  type Tile,
  type Warp,
  type Zone,
} from "./mapdef";
import { emptyRpg, type Rpg } from "./state";

export { TILE, step, type Facing, type Ground, type NpcDef, type Prop, type Tile, type Zone };
export type Door = Warp;
export type PropKind = string;
export type NpcId = string;

export const MAP_W = 36;
export const MAP_H = 30;

const M = makeMap("quartier", "Quartier 404", MAP_W, MAP_H, "nuit", "herbe");
export const QUARTIER: MapDef = M.def;
export const PROPS: Prop[] = M.def.props;
export const GROUND: Ground[][] = M.def.ground;
const add = M.add;
const fill = M.fill;
const fini = (r: Rpg) => r.quests["ville-figee"] === "terminee";

// ─── Sol ───


// Trottoirs et route principale (« Rue de l'Horloge »)
fill("trottoir", 0, 9, 35, 10);
fill("route", 0, 11, 35, 11);
fill("ligne", 0, 12, 35, 12);
fill("trottoir", 0, 13, 35, 13);
// Allées devant les bâtiments
fill("ruelle", 19, 2, 21, 8); // ruelle entre la supérette et chez Madame Bouchon
fill("chemin", 24, 8, 24, 8);
fill("fleurs", 22, 8, 23, 8);
fill("fleurs", 25, 8, 27, 8);
fill("chemin", 31, 8, 31, 8);
// Parc (ouest)
fill("chemin", 6, 14, 6, 26);
fill("chemin", 2, 20, 10, 20);
fill("eau", 1, 23, 4, 25);
fill("fleurs", 8, 16, 10, 17);
fill("fleurs", 2, 15, 3, 16);
// Place de la Fontaine
fill("pave", 12, 14, 23, 24);
fill("fleurs", 12, 24, 13, 24);
fill("fleurs", 22, 24, 23, 24);
fill("chemin", 17, 25, 18, 28);
// Station électrique (est)
fill("gravier", 26, 16, 33, 26);
fill("trottoir", 29, 14, 30, 14);

// ─── Bâtiments (face vers la rue, porte en bas) ───

add({ kind: "batiment", x: 1, y: 2, w: 9, h: 7, b: { name: "Résidence Les Lilas", style: "brique", roof: "ardoise", door: 5, sign: "404", awning: "rouge", lit: 3 } });
add({ kind: "batiment", x: 12, y: 4, w: 7, h: 5, b: { name: "Supérette 404", style: "boutique", roof: "plat", door: 15, sign: "SUPERETTE", awning: "vert", lit: 7 } });
add({ kind: "batiment", x: 22, y: 3, w: 6, h: 5, b: { name: "Chez Madame Bouchon", style: "maison", roof: "tuiles", door: 24, lit: 5 } });
add({ kind: "batiment", x: 29, y: 3, w: 6, h: 5, b: { name: "Maison bleue", style: "enduit", roof: "ardoise", door: 31, lit: 2 } });

// ─── Ruelle ───
add({ kind: "benne", x: 20, y: 2, w: 2, h: 1 });
add({ kind: "cageots", x: 19, y: 5, w: 1, h: 1 });
add({ kind: "affiche", x: 21, y: 6, w: 1, h: 1, text: "CHAT PERDU" });

// ─── Mobilier de rue ───
add({ kind: "cageots", x: 18, y: 9, w: 1, h: 1 });
add({ kind: "velo", x: 8, y: 9, w: 1, h: 1 });
add({ kind: "boite", x: 2, y: 9, w: 1, h: 1 });
add({ kind: "panneau", x: 10, y: 9, w: 1, h: 1, text: "RUE DE L'HORLOGE" });
add({ kind: "cloture", x: 22, y: 8, w: 2, h: 1 });
add({ kind: "cloture", x: 25, y: 8, w: 3, h: 1 });
add({ kind: "buisson", x: 29, y: 8, w: 1, h: 1 });
add({ kind: "buisson", x: 33, y: 8, w: 1, h: 1 });
add({ kind: "buisson", x: 34, y: 8, w: 1, h: 1 });
for (const x of [3, 12, 21, 30]) add({ kind: "lampadaire", x, y: 9, w: 1, h: 2, solidRows: 1 });
for (const x of [8, 27]) add({ kind: "lampadaire", x, y: 12, w: 1, h: 2, solidRows: 1 });
add({ kind: "barriere", x: 0, y: 11, w: 1, h: 2, text: "TRAVAUX" });
add({ kind: "barriere", x: 35, y: 11, w: 1, h: 2, text: "CENTRE-VILLE", open: fini });
add({ kind: "poubelle", x: 24, y: 13, w: 1, h: 1 });
add({ kind: "poubelle", x: 33, y: 9, w: 1, h: 1 });

// ─── Parc ───
for (const [x, y] of [
  [0, 14],
  [9, 14],
  [0, 18],
  [10, 18],
  [8, 22],
  [3, 27],
  [9, 27],
  [0, 26],
])
  add({ kind: "arbre", x, y, w: 2, h: 2, solidRows: 1 });
add({ kind: "sapin", x: 4, y: 14, w: 1, h: 2, solidRows: 1 });
add({ kind: "banc", x: 3, y: 18, w: 2, h: 1 });
add({ kind: "banc", x: 8, y: 24, w: 2, h: 1 });
add({ kind: "lampadaire", x: 5, y: 17, w: 1, h: 2, solidRows: 1 });
add({ kind: "buisson", x: 1, y: 21, w: 1, h: 1 });
add({ kind: "buisson", x: 5, y: 23, w: 1, h: 1 });
add({ kind: "buisson", x: 10, y: 25, w: 1, h: 1 });
add({ kind: "panneau", x: 7, y: 14, w: 1, h: 1, text: "PARC DES MINUTES" });

// ─── Place de la Fontaine ───
add({ kind: "fontaine", x: 16, y: 17, w: 3, h: 3 });
add({ kind: "horloge", x: 21, y: 14, w: 2, h: 3, solidRows: 2 });
add({ kind: "banc", x: 13, y: 18, w: 2, h: 1 });
add({ kind: "banc", x: 13, y: 21, w: 2, h: 1 });
add({ kind: "banc", x: 20, y: 21, w: 2, h: 1 });
add({ kind: "massif", x: 12, y: 15, w: 2, h: 1 });
add({ kind: "massif", x: 20, y: 18, w: 2, h: 1 });
add({ kind: "poubelle", x: 15, y: 23, w: 1, h: 1 });
add({ kind: "lampadaire", x: 12, y: 22, w: 1, h: 2, solidRows: 1 });
add({ kind: "lampadaire", x: 23, y: 16, w: 1, h: 2, solidRows: 1 });
add({ kind: "panneau", x: 19, y: 23, w: 1, h: 1, text: "PLACE DE LA FONTAINE" });

// ─── Station électrique ───
add({ kind: "cloture", x: 25, y: 15, w: 4, h: 1 });
add({ kind: "portail", x: 29, y: 15, w: 2, h: 1, open: (r) => r.flags.includes("portail") });
add({ kind: "cloture", x: 31, y: 15, w: 4, h: 1 });
add({ kind: "cloture", x: 25, y: 16, w: 1, h: 11 });
add({ kind: "cloture", x: 34, y: 16, w: 1, h: 11 });
add({ kind: "cloture", x: 25, y: 27, w: 10, h: 1 });
add({ kind: "transfo", x: 28, y: 19, w: 4, h: 3, solidRows: 2 });
add({ kind: "pylone", x: 26, y: 16, w: 1, h: 3, solidRows: 1 });
add({ kind: "pylone", x: 33, y: 16, w: 1, h: 3, solidRows: 1 });
add({ kind: "panneau", x: 27, y: 14, w: 1, h: 1, text: "DANGER" });

// ─── Bordures (arbres tout autour) ───
for (let x = 0; x < MAP_W; x += 2) {
  if (!(x >= 19 && x <= 21)) add({ kind: "arbre", x, y: 0, w: 2, h: 2, solidRows: 2 });
  if (!(x >= 16 && x <= 18)) add({ kind: "arbre", x, y: MAP_H - 2, w: 2, h: 2, solidRows: 2 });
}
add({ kind: "sapin", x: 19, y: 0, w: 1, h: 2, solidRows: 2 });
add({ kind: "sapin", x: 21, y: 0, w: 1, h: 2, solidRows: 2 });
add({ kind: "cloture", x: 16, y: MAP_H - 1, w: 4, h: 1 });
add({ kind: "panneau", x: 19, y: 26, w: 1, h: 1, text: "SENTIER DU SUD" });

// ─── Portes, zones, PNJ ───

/** Vers la Cité des Frites Perdues : barrière levée et éclaireur brocoli vaincu. */
const routeLibre = (r: Rpg) => fini(r) && r.flags.includes("ko:eclaireur");
export const DOORS: Warp[] = [
  { id: "residence", at: { x: 5, y: 8 }, to: "appart" },
  { id: "superette", at: { x: 15, y: 8 }, to: null, text: "Fermé. Une pancarte : « Retour à 23:59 ». Il est déjà 23:59. Il le sera toujours, apparemment." },
  { id: "bouchon", at: { x: 24, y: 7 }, to: null, text: "Fermé à clé. Une odeur de soupe de 1987 passe sous la porte." },
  { id: "bleue", at: { x: 31, y: 7 }, to: null, text: "Personne ne répond. Un chat miaule derrière la porte. Il est 23:59 pour lui aussi." },
  { id: "route-cite", at: { x: 35, y: 11 }, dir: "right", to: { map: "cite", x: 19, y: 30, dir: "up" }, needs: routeLibre, lockedKey: "route" },
  { id: "route-cite-2", at: { x: 35, y: 12 }, dir: "right", to: { map: "cite", x: 20, y: 30, dir: "up" }, needs: routeLibre, lockedKey: "route" },
];
QUARTIER.warps.push(...DOORS);

/** Où Sparrow apparaît quand il sort de chez lui. */
export const SPAWN: Tile & { dir: Facing } = { x: 5, y: 9, dir: "down" };
QUARTIER.spawn = SPAWN;

export const ZONES: Zone[] = [
  { id: "place", name: "Place de la Fontaine", x1: 12, y1: 14, x2: 23, y2: 24 },
  { id: "station", name: "Station électrique", x1: 26, y1: 16, x2: 33, y2: 26 },
  { id: "ruelle", name: "Ruelle du Chat", x1: 19, y1: 2, x2: 21, y2: 8 },
  { id: "parc", name: "Parc des Minutes", x1: 0, y1: 14, x2: 11, y2: 27 },
];
QUARTIER.zones.push(...ZONES);

export const NPCS: NpcDef[] = [
  { id: "nico", name: "Nico le Livreur", char: "nico", start: { x: 10, y: 13 }, dir: "right", path: [{ x: 10, y: 13 }, { x: 22, y: 13 }], pause: 1.2 },
  { id: "bouchon", name: "Madame Bouchon", char: "bouchon", start: { x: 22, y: 9 }, dir: "right", path: [{ x: 22, y: 9 }, { x: 27, y: 9 }], pause: 2.2 },
  { id: "raymond", name: "Raymond", char: "raymond", start: { x: 16, y: 9 }, dir: "down" },
  { id: "inconnu", name: "???", char: "inconnu", start: { x: 6, y: 19 }, dir: "right", watch: true, when: (r) => !r.flags.includes("inconnu-parti") },
  // Chapitre 2 : le Chevalier Noir attend Sparrow près de la barrière levée
  { id: "chevalier", name: "Chevalier Noir", char: "chevalier", start: { x: 32, y: 12 }, dir: "left", when: (r) => fini(r) && !r.party.includes("chevalier") },
  { id: "eclaireur", name: "Soldat Brocoli", char: "brocoli", start: { x: 34, y: 11 }, dir: "left", watch: true, when: (r) => r.party.includes("chevalier"), enemy: { battle: "eclaireur", sight: 3, defeated: "ko:eclaireur" } },
];
QUARTIER.npcs.push(...NPCS);

// ─── Compatibilité (tests et interface du chapitre 1) ───

const rpgOf = (gateOpen?: boolean): Rpg => ({ ...emptyRpg(), flags: gateOpen ? ["portail"] : [] });

export type ObjectId = string;
export interface Thing {
  id: string;
  tiles: Tile[];
  text?: string;
}

export function thingAt(t: Tile): Thing | null {
  const th = thingOn(QUARTIER, t, rpgOf(true));
  return th ? { id: th.key, tiles: [], text: th.text } : null;
}

export const zoneAt = (t: Tile) => zoneOn(QUARTIER, t);

/** Case bloquée par le décor (le portail ne l'est plus une fois ouvert). */
export const isSolid = (t: Tile, opts: { gateOpen?: boolean } = {}) => solidAt(QUARTIER, t, rpgOf(opts.gateOpen));

export const doorAt = (t: Tile) => warpAt(QUARTIER, t);

export const reachable = (from: Tile, opts: { gateOpen?: boolean } = {}) => reachableOn(QUARTIER, from, rpgOf(opts.gateOpen));

/** Valide une position sauvegardée dehors. */
export const restoreTile = (raw: unknown) => restoreOn(QUARTIER, raw, rpgOf(true));
