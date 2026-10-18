/**
 * RPG — description générique d'une carte (logique pure, testable).
 *
 * Une carte = un sol en cases de 16 px + des éléments posés + des portes vers d'autres cartes +
 * des zones + des PNJ (et des ennemis visibles). Les conditions (`open`, `hidden`, `when`)
 * dépendent de l'avancement (`Rpg`) : un portail s'ouvre, un garde disparaît après sa défaite…
 * Chaque chapitre ajoute ses cartes dans `maps/` ; le moteur ne change pas.
 */

import type { Rpg } from "./state";

export const TILE = 16;

export type MapId = "quartier" | "cite" | "maison-chou" | "herboristerie" | "armurerie" | "restaurant" | "egouts" | "palais" | "sentier" | "refuge" | "temple-cour" | "temple" | "cerisiers" | "village" | "auberge" | "dojo" | "tour-parvis" | "tour" | "tour-sommet" | "bar" | "cave" | "local" | "tripot" | "labo" | "snack" | "casino";

export const MAP_IDS: MapId[] = ["quartier", "cite", "maison-chou", "herboristerie", "armurerie", "restaurant", "egouts", "palais", "sentier", "refuge", "temple-cour", "temple", "cerisiers", "village", "auberge", "dojo", "tour-parvis", "tour", "tour-sommet", "bar", "cave", "local", "tripot", "labo", "snack", "casino"];

/** Ambiance : règle l'éclairage (nuit, crépuscule, intérieur, souterrain, palais). */
export type Region = "nuit" | "crepuscule" | "interieur" | "egout" | "palais" | "aube";

export type Ground =
  // Extérieurs
  | "herbe"
  | "fleurs"
  | "chemin"
  | "route"
  | "ligne"
  | "trottoir"
  | "pave"
  | "gravier"
  | "eau"
  | "ruelle"
  | "potager"
  | "dalle"
  | "pont"
  // Intérieurs
  | "parquet"
  | "carrelage"
  | "tapis"
  | "mur"
  // Souterrains
  | "egout"
  | "eaux-usees"
  | "marbre"
  // Chapitre 3
  | "tatami"
  | "roche";

export type Facing = "down" | "up" | "left" | "right";

export interface Tile {
  x: number;
  y: number;
}

export interface Building {
  name: string;
  style: "brique" | "enduit" | "boutique" | "maison" | "palais" | "echoppe";
  roof: "ardoise" | "tuiles" | "plat" | "vert" | "dome";
  door: number; // colonne de la porte (absolue)
  sign?: string;
  awning?: "rouge" | "vert" | "jaune";
  lit?: number;
}

export interface Prop {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Rangées du bas qui bloquent (par défaut : toutes). */
  solidRows?: number;
  b?: Building;
  /** Texte d'un panneau / d'une inscription. */
  text?: string;
  /** Clé d'interaction (bouton A) si différente du type. */
  key?: string;
  /** Ouvert (plus bloquant, dessiné ouvert) selon l'avancement. */
  open?: (r: Rpg) => boolean;
  /** Caché (ni dessiné, ni bloquant) selon l'avancement. */
  hidden?: (r: Rpg) => boolean;
  /** État visuel seulement (coffre ouvert, vanne tournée) : ne change pas les collisions. */
  on?: (r: Rpg) => boolean;
  /** Variante de couleur / de forme. */
  variant?: number;
}

export interface Dest {
  map: MapId;
  x: number;
  y: number;
  dir: Facing;
}

/** Porte / passage : on le prend en marchant dans sa direction. */
export interface Warp {
  id: string;
  at: Tile;
  /** Direction de passage (par défaut : vers le haut, comme une porte). */
  dir?: Facing;
  to: Dest | "appart" | null;
  /** Réplique quand la porte est fermée (to = null ou condition non remplie). */
  text?: string;
  /** Condition d'ouverture. */
  needs?: (r: Rpg) => boolean;
  /** Clé de dialogue quand c'est fermé (sinon `text`). */
  lockedKey?: string;
}

export interface Zone {
  id: string;
  name: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EnemySpot {
  /** Identifiant du combat (bestiary / battles). */
  battle: string;
  /** Portée de vue en cases (0 = il faut lui parler). */
  sight: number;
  /** Drapeau posé après la victoire : l'ennemi disparaît. */
  defeated: string;
}

export interface NpcDef {
  id: string;
  name: string;
  /** Sprite (components/rpg/actors.ts). */
  char: string;
  start: Tile;
  dir: Facing;
  path?: Tile[];
  pause?: number;
  /** Présent sur la carte selon l'avancement. */
  when?: (r: Rpg) => boolean;
  /** Regarde toujours Sparrow (personnage mystérieux, garde…). */
  watch?: boolean;
  enemy?: EnemySpot;
}

export interface MapDef {
  id: MapId;
  name: string;
  w: number;
  h: number;
  region: Region;
  ground: Ground[][];
  props: Prop[];
  warps: Warp[];
  zones: Zone[];
  npcs: NpcDef[];
  spawn: Tile & { dir: Facing };
  /** Hautes herbes : marcher sur ce sol peut déclencher une rencontre sauvage. */
  wild?: { ground: Ground; battle: string; rate: number }[];
}

/** Rencontre sauvage possible sur cette case (sans tirage au sort). */
export const wildAt = (m: MapDef, t: Tile) => m.wild?.find((w) => m.ground[t.y]?.[t.x] === w.ground) ?? null;

// ─── Construction ───

export function makeMap(id: MapId, name: string, w: number, h: number, region: Region, base: Ground) {
  const ground: Ground[][] = Array.from({ length: h }, () => Array.from({ length: w }, () => base));
  const def: MapDef = { id, name, w, h, region, ground, props: [], warps: [], zones: [], npcs: [], spawn: { x: 1, y: 1, dir: "down" } };
  return {
    def,
    fill(g: Ground, x1: number, y1: number, x2: number, y2: number) {
      for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) if (x >= 0 && y >= 0 && x < w && y < h) ground[y][x] = g;
    },
    add(p: Prop) {
      def.props.push(p);
      return p;
    },
  };
}

// ─── Requêtes ───

const BLOCK: Ground[] = ["eau", "mur", "eaux-usees"];
const solidCache = new WeakMap<MapDef, boolean[][]>();

const dynamic = (p: Prop) => !!(p.open || p.hidden);
/** Élément redessiné à chaque image (son aspect dépend de l'avancement). */
export const animated = (p: Prop) => !!(p.open || p.hidden || p.on);

function staticSolid(m: MapDef): boolean[][] {
  let g = solidCache.get(m);
  if (g) return g;
  g = Array.from({ length: m.h }, (_, y) => Array.from({ length: m.w }, (_, x) => BLOCK.includes(m.ground[y][x])));
  for (const p of m.props) {
    if (dynamic(p)) continue;
    const rows = p.solidRows ?? p.h;
    for (let y = p.y + p.h - rows; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) if (y >= 0 && y < m.h && x >= 0 && x < m.w) g[y][x] = true;
  }
  solidCache.set(m, g);
  return g;
}

export const inside = (p: Prop, t: Tile) => t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h;

/** Élément visible (non caché) selon l'avancement. */
export const shown = (p: Prop, r: Rpg) => !p.hidden?.(r);
export const isOpen = (p: Prop, r: Rpg) => !!p.open?.(r);

/** Case bloquée par le décor. */
export function solidAt(m: MapDef, t: Tile, r: Rpg): boolean {
  if (t.x < 0 || t.y < 0 || t.x >= m.w || t.y >= m.h) return true;
  if (staticSolid(m)[t.y][t.x]) return true;
  for (const p of m.props) {
    if (!dynamic(p) || !inside(p, t) || !shown(p, r) || isOpen(p, r)) continue;
    const rows = p.solidRows ?? p.h;
    if (t.y >= p.y + p.h - rows) return true;
  }
  return false;
}

export const warpAt = (m: MapDef, t: Tile) => m.warps.find((d) => d.at.x === t.x && d.at.y === t.y) ?? null;

export const zoneAt = (m: MapDef, t: Tile) => m.zones.find((z) => t.x >= z.x1 && t.x <= z.x2 && t.y >= z.y1 && t.y <= z.y2) ?? null;

/** Types d'éléments examinables avec A. */
const EXAMINABLE = new Set([
  "horloge",
  "benne",
  "portail",
  "transfo",
  "barriere",
  "panneau",
  "boite",
  "fontaine",
  "banc",
  "poubelle",
  "affiche",
  "velo",
  "statue",
  "etal",
  "coffre",
  "comptoir",
  "etagere",
  "cuisiniere",
  "levier",
  "vanne",
  "echelle",
  "plaque",
  "trone",
  "lit-int",
  "bibliotheque",
  "tonneau",
  "pancarte",
  "armoire",
  "fontaine-seche",
  "caisse",
  "cuve",
  "grille",
  "table",
  "banc-muscu",
  "sac-frappe",
  "gong",
  "haltere-geant",
  "statue-titan",
  "lampion",
  "cadran",
  "platines",
  "scene",
  "ratelier",
  "pierre",
  "cerisier",
]);

export interface Thing {
  key: string;
  text?: string;
  prop: Prop;
}

export function thingAt(m: MapDef, t: Tile, r: Rpg): Thing | null {
  for (const p of m.props) {
    if (!inside(p, t) || !shown(p, r)) continue;
    if (p.key || EXAMINABLE.has(p.kind)) return { key: p.key ?? p.kind, text: p.text, prop: p };
  }
  return null;
}

export const step = (t: Tile, d: Facing): Tile => ({
  x: t.x + (d === "left" ? -1 : d === "right" ? 1 : 0),
  y: t.y + (d === "up" ? -1 : d === "down" ? 1 : 0),
});

export const npcsOf = (m: MapDef, r: Rpg) => m.npcs.filter((n) => (!n.when || n.when(r)) && !(n.enemy && r.flags.includes(n.enemy.defeated)));

/** Cases accessibles depuis `from` (4 directions). */
export function reachable(m: MapDef, from: Tile, r: Rpg): Set<string> {
  const seen = new Set<string>([`${from.x},${from.y}`]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    for (const d of ["up", "down", "left", "right"] as Facing[]) {
      const n = step(c, d);
      const k = `${n.x},${n.y}`;
      if (seen.has(k) || solidAt(m, n, r)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return seen;
}

/** Valide une position sauvegardée sur une carte. */
export function restoreOn(m: MapDef, raw: unknown, r: Rpg): (Tile & { dir: Facing }) | null {
  const o = raw as Partial<Tile & { dir: Facing }> | null;
  if (!o || typeof o.x !== "number" || typeof o.y !== "number") return null;
  const t = { x: Math.round(o.x), y: Math.round(o.y) };
  if (solidAt(m, t, r) || m.npcs.some((n) => n.start.x === t.x && n.start.y === t.y)) return null;
  const dir = (["down", "up", "left", "right"] as const).includes(o.dir as Facing) ? (o.dir as Facing) : "down";
  return { ...t, dir };
}
