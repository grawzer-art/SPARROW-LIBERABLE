/**
 * SPARROWGOTCHI 3.0 — géométrie de l'appartement (logique pure, testable).
 *
 * Coordonnées « monde » en pixels : 4 pièces de 112 px côte à côte, 64 px de haut.
 * La position de Sparrow est celle de ses pieds. Les meubles sont des obstacles
 * (rectangles au sol) ; les objets interactifs ont un point où Sparrow se place.
 */

export const ROOM_W = 112;
export const ROOM_COUNT = 4;
export const WORLD_W = ROOM_W * ROOM_COUNT;
export const VIEW_H = 64;
/** Limite mur / sol et ligne de base des meubles collés au mur. */
export const WALL = 42;
export const BACK = 50;
/** Zone où les pieds de Sparrow peuvent aller. */
export const MIN_Y = 47;
export const MAX_Y = 62;
const HALF_W = 4;

export const R = (room: number, x: number) => room * ROOM_W + x;

export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface Pos {
  x: number;
  y: number;
}

/** Empreintes au sol des meubles. */
export const OBSTACLES: (Box & { id: string })[] = [
  { id: "lit", x1: R(0, 6), x2: R(0, 30), y1: WALL, y2: BACK + 1 },
  { id: "chevet", x1: R(0, 32), x2: R(0, 39), y1: WALL, y2: BACK + 1 },
  { id: "bureau", x1: R(1, 46), x2: R(1, 68), y1: WALL, y2: BACK + 1 },
  { id: "lampadaire", x1: R(2, 12), x2: R(2, 20), y1: WALL, y2: BACK + 1 },
  { id: "tele", x1: R(2, 78), x2: R(2, 94), y1: WALL, y2: BACK + 1 },
  { id: "canape", x1: R(2, 28), x2: R(2, 48), y1: 54, y2: 59 },
  { id: "frigo", x1: R(3, 8), x2: R(3, 20), y1: WALL, y2: BACK + 1 },
  { id: "plan", x1: R(3, 44), x2: R(3, 62), y1: WALL, y2: BACK + 1 },
  { id: "table", x1: R(3, 80), x2: R(3, 98), y1: 55, y2: 59 },
];

export type ObjectId = "lit" | "fenetre" | "douche" | "pc" | "canape" | "tele" | "frigo" | "friteuse" | "table";

export interface Interactable {
  id: ObjectId;
  label: string;
  /** Où Sparrow se place pour l'utiliser. */
  stand: Pos;
  face: 1 | -1;
  pose: "stand" | "assis";
  /** Zone à toucher sur l'écran (coordonnées monde). */
  tap: Box;
}

export const OBJECTS: Interactable[] = [
  { id: "lit", label: "Se coucher", stand: { x: R(0, 20), y: 53 }, face: 1, pose: "assis", tap: { x1: R(0, 4), x2: R(0, 32), y1: 40, y2: 52 } },
  { id: "fenetre", label: "Regarder dehors", stand: { x: R(0, 58), y: 52 }, face: 1, pose: "stand", tap: { x1: R(0, 50), x2: R(0, 66), y1: 10, y2: 22 } },
  { id: "douche", label: "Se rafraîchir", stand: { x: R(0, 95), y: 52 }, face: -1, pose: "stand", tap: { x1: R(0, 86), x2: R(0, 102), y1: 28, y2: 52 } },
  { id: "pc", label: "Jouer au PC", stand: { x: R(1, 42), y: 53 }, face: 1, pose: "assis", tap: { x1: R(1, 44), x2: R(1, 70), y1: 32, y2: 52 } },
  { id: "tele", label: "Regarder la télé", stand: { x: R(2, 86), y: 56 }, face: 1, pose: "stand", tap: { x1: R(2, 76), x2: R(2, 96), y1: 36, y2: 52 } },
  { id: "canape", label: "Micro-sieste", stand: { x: R(2, 38), y: 61 }, face: 1, pose: "assis", tap: { x1: R(2, 26), x2: R(2, 50), y1: 52, y2: 60 } },
  { id: "frigo", label: "Ouvrir le frigo", stand: { x: R(3, 26), y: 53 }, face: -1, pose: "stand", tap: { x1: R(3, 6), x2: R(3, 22), y1: 28, y2: 52 } },
  { id: "friteuse", label: "Faire des frites", stand: { x: R(3, 54), y: 53 }, face: 1, pose: "stand", tap: { x1: R(3, 42), x2: R(3, 64), y1: 34, y2: 52 } },
  { id: "table", label: "Manger une salade", stand: { x: R(3, 89), y: 53 }, face: -1, pose: "stand", tap: { x1: R(3, 78), x2: R(3, 100), y1: 52, y2: 60 } },
];

export const objectById = (id: ObjectId) => OBJECTS.find((o) => o.id === id)!;

export function canStand(x: number, y: number): boolean {
  if (x < HALF_W + 2 || x > WORLD_W - HALF_W - 2 || y < MIN_Y || y > MAX_Y) return false;
  for (const o of OBSTACLES) if (x + HALF_W > o.x1 && x - HALF_W < o.x2 && y + 1 > o.y1 && y - 1 < o.y2) return false;
  return true;
}

/** Déplacement avec glissement le long des obstacles. */
export function move(p: Pos, dx: number, dy: number): { pos: Pos; blocked: boolean } {
  if (canStand(p.x + dx, p.y + dy)) return { pos: { x: p.x + dx, y: p.y + dy }, blocked: false };
  const main = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const alongX = { x: p.x + dx, y: p.y };
  const alongY = { x: p.x, y: p.y + dy };
  const [first, second] = main === "x" ? [alongX, alongY] : [alongY, alongX];
  if ((main === "x" ? dx : dy) && canStand(first.x, first.y)) return { pos: first, blocked: true };
  // Coin d'un meuble : on contourne automatiquement s'il y a un passage tout proche.
  const step = Math.max(Math.abs(dx), Math.abs(dy));
  const pref = Math.sign(main === "x" ? dy : dx) || 1;
  for (const s of [pref, -pref])
    for (let k = 1; k <= 8; k++) {
      const ox = main === "y" ? s * k : 0;
      const oy = main === "x" ? s * k : 0;
      if (!canStand(p.x + ox, p.y + oy)) break;
      if (canStand(p.x + ox + (main === "x" ? dx : 0), p.y + oy + (main === "y" ? dy : 0))) {
        const nx = p.x + (main === "y" ? s * step : 0);
        const ny = p.y + (main === "x" ? s * step : 0);
        if (canStand(nx, ny)) return { pos: { x: nx, y: ny }, blocked: true };
      }
    }
  if ((main === "x" ? dy : dx) && canStand(second.x, second.y)) return { pos: second, blocked: true };
  return { pos: p, blocked: true };
}

function clearLine(a: Pos, b: Pos): boolean {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 2);
  for (let i = 1; i <= n; i++) if (!canStand(a.x + ((b.x - a.x) * i) / n, a.y + ((b.y - a.y) * i) / n)) return false;
  return true;
}

/** Les deux couloirs toujours libres : devant les meubles muraux, et tout devant. */
const LANES = [52, MAX_Y];

/** Chemin simple (ligne droite, sinon détour par un couloir libre). */
export function path(from: Pos, to: Pos): Pos[] {
  if (clearLine(from, to)) return [to];
  for (const lane of LANES) {
    const a = { x: from.x, y: lane };
    const b = { x: to.x, y: lane };
    if (clearLine(from, a) && clearLine(a, b) && clearLine(b, to)) return [a, b, to];
  }
  // En dernier recours : couloir avant, puis couloir arrière.
  const a = { x: from.x, y: MAX_Y };
  const b = { x: to.x, y: MAX_Y };
  const c = { x: to.x, y: 52 };
  return [a, b, c, to];
}

/** Point accessible le plus proche (pour « marcher jusqu'ici »). */
export function nearestStandable(p: Pos): Pos {
  const x = Math.max(HALF_W + 2, Math.min(WORLD_W - HALF_W - 2, p.x));
  const y = Math.max(MIN_Y, Math.min(MAX_Y, p.y));
  if (canStand(x, y)) return { x, y };
  for (let r = 1; r < 24; r++)
    for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]])
      if (canStand(x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return { x: R(2, 60), y: MAX_Y };
}

/** Objet utilisable à portée de Sparrow. */
export function nearby(p: Pos, reach = 11): Interactable | null {
  let best: Interactable | null = null;
  let bd = reach;
  for (const o of OBJECTS) {
    const d = Math.hypot(o.stand.x - p.x, (o.stand.y - p.y) * 1.5);
    if (d < bd) {
      best = o;
      bd = d;
    }
  }
  return best;
}

export function objectAt(wx: number, wy: number): Interactable | null {
  return OBJECTS.find((o) => wx >= o.tap.x1 && wx <= o.tap.x2 && wy >= o.tap.y1 && wy <= o.tap.y2) ?? null;
}

export const roomOf = (x: number) => Math.max(0, Math.min(ROOM_COUNT - 1, Math.floor(x / ROOM_W)));

export const START: Pos = { x: R(2, 64), y: 58 };

/** Valide une position sauvegardée. */
export function restorePos(raw: unknown): Pos {
  const o = raw as Partial<Pos> | null;
  if (o && typeof o.x === "number" && typeof o.y === "number" && canStand(o.x, o.y)) return { x: o.x, y: o.y };
  return START;
}
