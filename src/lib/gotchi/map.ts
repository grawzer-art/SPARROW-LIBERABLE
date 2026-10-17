/**
 * SPARROWGOTCHI — carte de l'appartement, façon console portable (logique pure, testable).
 *
 * Chaque pièce occupe un écran de 160 × 144 px (cases de 8 px), vue de dessus « rétro » :
 * le mur du fond est vu de face (32 px en haut), le sol de dessus. On passe d'une pièce
 * à l'autre par des portes, comme dans un vieux RPG portable.
 *
 *     Chambre ── Salon ── Cuisine
 *                  │         │
 *               Gaming ── Muscu
 *
 * Ajouter un meuble = une entrée dans `furniture` ; le rendre utilisable = une entrée dans `SPOTS`.
 * La position de Sparrow est celle de ses pieds ; son « corps » au sol fait 8 × 4 px.
 */

export const T = 8;
export const SCREEN_W = 160;
export const SCREEN_H = 144;
export const WALL_H = 32; // hauteur du mur du fond
const HALF = 4;
const DEPTH = 4;

export type RoomId = "chambre" | "salon" | "cuisine" | "gaming" | "muscu";
export type Door = "N" | "S" | "E" | "W";
export type Facing = "down" | "up" | "left" | "right";

export interface Pos {
  x: number;
  y: number;
}
export interface Place extends Pos {
  room: RoomId;
}
export interface Box {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
}

export interface Furniture {
  id: string;
  /** Zone au sol infranchissable (coordonnées des pieds). */
  solid?: Box;
  /** Ligne de profondeur (pour savoir s'il passe devant ou derrière). */
  base: number;
}

export interface Room {
  id: RoomId;
  name: string;
  doors: Partial<Record<Door, RoomId>>;
  /** Porte d'entrée de l'appartement (mène dehors, au Quartier 404). */
  exit?: Door;
  furniture: Furniture[];
}

export const ROOMS: Record<RoomId, Room> = {
  chambre: {
    id: "chambre",
    name: "Chambre",
    doors: { E: "salon" },
    furniture: [
      { id: "lit", solid: { x1: 14, x2: 42, y1: 32, y2: 66 }, base: 66 },
      { id: "chevet", solid: { x1: 44, x2: 54, y1: 32, y2: 44 }, base: 44 },
      { id: "lavabo", solid: { x1: 106, x2: 122, y1: 32, y2: 42 }, base: 42 },
      { id: "douche", solid: { x1: 128, x2: 150, y1: 32, y2: 46 }, base: 46 },
    ],
  },
  salon: {
    id: "salon",
    name: "Salon",
    doors: { W: "chambre", E: "cuisine", S: "gaming" },
    exit: "N",
    furniture: [
      { id: "tele", solid: { x1: 22, x2: 64, y1: 32, y2: 42 }, base: 42 },
      { id: "canape", solid: { x1: 50, x2: 110, y1: 88, y2: 102 }, base: 102 },
      { id: "lampadaire", solid: { x1: 12, x2: 22, y1: 32, y2: 46 }, base: 46 },
      { id: "plante", solid: { x1: 134, x2: 148, y1: 32, y2: 48 }, base: 48 },
    ],
  },
  cuisine: {
    id: "cuisine",
    name: "Cuisine",
    doors: { W: "salon", S: "muscu" },
    furniture: [
      { id: "frigo", solid: { x1: 10, x2: 30, y1: 32, y2: 46 }, base: 46 },
      { id: "plan", solid: { x1: 38, x2: 98, y1: 32, y2: 44 }, base: 44 },
      { id: "table", solid: { x1: 104, x2: 140, y1: 86, y2: 102 }, base: 102 },
    ],
  },
  gaming: {
    id: "gaming",
    name: "Coin gaming",
    doors: { N: "salon", E: "muscu" },
    furniture: [
      { id: "bureau", solid: { x1: 94, x2: 142, y1: 32, y2: 46 }, base: 46 },
      { id: "etagere", solid: { x1: 10, x2: 34, y1: 32, y2: 40 }, base: 40 },
      { id: "pouf", solid: { x1: 122, x2: 140, y1: 100, y2: 112 }, base: 112 },
    ],
  },
  muscu: {
    id: "muscu",
    name: "Salle de sport",
    doors: { N: "cuisine", W: "gaming" },
    furniture: [
      { id: "rack", solid: { x1: 12, x2: 50, y1: 32, y2: 44 }, base: 44 },
      { id: "banc", solid: { x1: 60, x2: 100, y1: 82, y2: 96 }, base: 96 },
      { id: "sac", solid: { x1: 130, x2: 146, y1: 32, y2: 50 }, base: 50 },
    ],
  },
};

export const ROOM_IDS = Object.keys(ROOMS) as RoomId[];
/** Plan de l'appartement (pour la carte du menu). */
export const LAYOUT: (RoomId | null)[][] = [
  ["chambre", "salon", "cuisine"],
  [null, "gaming", "muscu"],
];

// ─── Objets utilisables ───

export type SpotId = "lit" | "fenetre" | "lavabo" | "douche" | "canape" | "frigo" | "friteuse" | "pc" | "banc" | "miroir";

export interface Spot {
  id: SpotId;
  room: RoomId;
  label: string;
  /** Où il se place pour l'utiliser, et vers où il regarde. */
  stand: Pos;
  face: Facing;
  /** Où il s'installe pendant l'action (lit, canapé, chaise). */
  sit?: Pos;
  sitFace?: Facing;
  tap: Box;
}

export const SPOTS: Spot[] = [
  { id: "lit", room: "chambre", label: "Micro-sieste", stand: { x: 50, y: 60 }, face: "left", sit: { x: 28, y: 58 }, sitFace: "down", tap: { x1: 12, x2: 44, y1: 26, y2: 66 } },
  { id: "fenetre", room: "chambre", label: "Regarder dehors", stand: { x: 76, y: 44 }, face: "up", tap: { x1: 62, x2: 92, y1: 4, y2: 28 } },
  { id: "lavabo", room: "chambre", label: "Se rafraîchir", stand: { x: 114, y: 50 }, face: "up", tap: { x1: 104, x2: 124, y1: 8, y2: 42 } },
  { id: "douche", room: "chambre", label: "Prendre une douche", stand: { x: 139, y: 56 }, face: "up", tap: { x1: 126, x2: 152, y1: 8, y2: 46 } },
  { id: "canape", room: "salon", label: "Regarder la télé", stand: { x: 80, y: 112 }, face: "up", sit: { x: 80, y: 96 }, sitFace: "up", tap: { x1: 48, x2: 112, y1: 80, y2: 104 } },
  { id: "frigo", room: "cuisine", label: "Prendre une salade", stand: { x: 20, y: 54 }, face: "up", tap: { x1: 8, x2: 32, y1: 6, y2: 46 } },
  { id: "friteuse", room: "cuisine", label: "Faire des frites", stand: { x: 68, y: 52 }, face: "up", tap: { x1: 38, x2: 98, y1: 14, y2: 44 } },
  { id: "pc", room: "gaming", label: "Jouer à Dofus", stand: { x: 118, y: 60 }, face: "up", sit: { x: 118, y: 54 }, sitFace: "up", tap: { x1: 92, x2: 144, y1: 6, y2: 48 } },
  { id: "banc", room: "muscu", label: "S'entraîner", stand: { x: 80, y: 106 }, face: "up", sit: { x: 80, y: 92 }, sitFace: "down", tap: { x1: 56, x2: 104, y1: 72, y2: 98 } },
  { id: "miroir", room: "muscu", label: "Se regarder", stand: { x: 112, y: 44 }, face: "up", tap: { x1: 94, x2: 128, y1: 4, y2: 30 } },
];

export const spotById = (id: SpotId) => SPOTS.find((s) => s.id === id)!;

// ─── Collisions ───

const DOOR_SPAN = { side: [64, 88], top: [72, 88] } as const;

function inDoorCorridor(room: Room, x: number, y: number): boolean {
  const [s1, s2] = DOOR_SPAN.side;
  const [t1, t2] = DOOR_SPAN.top;
  const sideOk = y - DEPTH >= s1 && y <= s2;
  const topOk = x - HALF >= t1 && x + HALF <= t2;
  if (room.doors.W && sideOk && x - HALF < T && x - HALF >= -T) return true;
  if (room.doors.E && sideOk && x + HALF > SCREEN_W - T && x + HALF <= SCREEN_W + T) return true;
  if ((room.doors.N || room.exit === "N") && topOk && y - DEPTH < WALL_H && y - DEPTH >= WALL_H - 2 * T) return true;
  if (room.doors.S && topOk && y > SCREEN_H - T && y <= SCREEN_H + T) return true;
  return false;
}

/** Sparrow peut-il se tenir là (pieds en x, y) ? */
export function canStand(roomId: RoomId, x: number, y: number): boolean {
  const room = ROOMS[roomId];
  const inFloor = x - HALF >= T && x + HALF <= SCREEN_W - T && y - DEPTH >= WALL_H && y <= SCREEN_H - T;
  if (!inFloor && !inDoorCorridor(room, x, y)) return false;
  for (const f of room.furniture) {
    const b = f.solid;
    if (b && x + HALF > b.x1 && x - HALF < b.x2 && y > b.y1 && y - DEPTH < b.y2) return false;
  }
  return true;
}

/** Déplacement avec glissement le long des obstacles et contournement des coins. */
export function move(room: RoomId, p: Pos, dx: number, dy: number): { pos: Pos; blocked: boolean } {
  if (canStand(room, p.x + dx, p.y + dy)) return { pos: { x: p.x + dx, y: p.y + dy }, blocked: false };
  const main = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
  const alongX = { x: p.x + dx, y: p.y };
  const alongY = { x: p.x, y: p.y + dy };
  const [first, second] = main === "x" ? [alongX, alongY] : [alongY, alongX];
  if ((main === "x" ? dx : dy) && canStand(room, first.x, first.y)) return { pos: first, blocked: true };
  const step = Math.max(Math.abs(dx), Math.abs(dy));
  const pref = Math.sign(main === "x" ? dy : dx) || 1;
  for (const s of [pref, -pref])
    for (let k = 1; k <= 8; k++) {
      const ox = main === "y" ? s * k : 0;
      const oy = main === "x" ? s * k : 0;
      if (!canStand(room, p.x + ox, p.y + oy)) break;
      if (canStand(room, p.x + ox + (main === "x" ? dx : 0), p.y + oy + (main === "y" ? dy : 0))) {
        const n = { x: p.x + (main === "y" ? s * step : 0), y: p.y + (main === "x" ? s * step : 0) };
        if (canStand(room, n.x, n.y)) return { pos: n, blocked: true };
      }
    }
  if ((main === "x" ? dy : dx) && canStand(room, second.x, second.y)) return { pos: second, blocked: true };
  return { pos: p, blocked: true };
}

// ─── Portes ───

/** A-t-il franchi une porte ? Renvoie la pièce d'arrivée et sa position d'entrée. */
export function doorCrossed(roomId: RoomId, p: Pos): Place | null {
  const room = ROOMS[roomId];
  const clampY = (y: number) => Math.max(DOOR_SPAN.side[0] + DEPTH + 1, Math.min(DOOR_SPAN.side[1], y));
  const clampX = (x: number) => Math.max(DOOR_SPAN.top[0] + HALF, Math.min(DOOR_SPAN.top[1] - HALF, x));
  if (room.doors.W && p.x < 6) return { room: room.doors.W, x: SCREEN_W - 14, y: clampY(p.y) };
  if (room.doors.E && p.x > SCREEN_W - 6) return { room: room.doors.E, x: 14, y: clampY(p.y) };
  if (room.doors.N && p.y < WALL_H + 1) return { room: room.doors.N, x: clampX(p.x), y: SCREEN_H - 14 };
  if (room.doors.S && p.y > SCREEN_H - 3) return { room: room.doors.S, x: clampX(p.x), y: WALL_H + 10 };
  return null;
}

/** A-t-il passé la porte d'entrée (vers la rue) ? */
export function exitCrossed(roomId: RoomId, p: Pos): boolean {
  return ROOMS[roomId].exit === "N" && p.y < WALL_H + 1;
}

/** Où il réapparaît en rentrant de la rue. */
export const HOME_ENTRY: Place = { room: "salon", x: 80, y: WALL_H + 10 };

/** Point juste au-delà d'une porte (pour la franchir en marchant). */
export function doorExit(d: Door): { approach: Pos; exit: Pos } {
  switch (d) {
    case "W":
      return { approach: { x: 14, y: 80 }, exit: { x: 2, y: 80 } };
    case "E":
      return { approach: { x: SCREEN_W - 14, y: 80 }, exit: { x: SCREEN_W - 2, y: 80 } };
    case "N":
      return { approach: { x: 80, y: WALL_H + 10 }, exit: { x: 80, y: WALL_H - 2 } };
    case "S":
      return { approach: { x: 80, y: SCREEN_H - 14 }, exit: { x: 80, y: SCREEN_H + 2 } };
  }
}

export function doorBox(d: Door): Box {
  switch (d) {
    case "W":
      return { x1: 0, x2: T, y1: DOOR_SPAN.side[0] - 16, y2: DOOR_SPAN.side[1] };
    case "E":
      return { x1: SCREEN_W - T, x2: SCREEN_W, y1: DOOR_SPAN.side[0] - 16, y2: DOOR_SPAN.side[1] };
    case "N":
      return { x1: DOOR_SPAN.top[0], x2: DOOR_SPAN.top[1], y1: 6, y2: WALL_H };
    case "S":
      return { x1: DOOR_SPAN.top[0], x2: DOOR_SPAN.top[1], y1: SCREEN_H - T, y2: SCREEN_H };
  }
}

// ─── Chemins ───

const COLS = SCREEN_W / T;
const ROWS = SCREEN_H / T;
const tileCenter = (c: number, r: number): Pos => ({ x: c * T + 4, y: r * T + 6 });
const tileOf = (p: Pos) => ({ c: Math.max(0, Math.min(COLS - 1, Math.floor(p.x / T))), r: Math.max(0, Math.min(ROWS - 1, Math.floor((p.y - 2) / T))) });

/** Chemin dans une pièce (cases de 8 px, 8 directions sans couper les coins). */
export function pathInRoom(room: RoomId, from: Pos, to: Pos): Pos[] | null {
  const ok = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && canStand(room, tileCenter(c, r).x, tileCenter(c, r).y);
  const s = tileOf(from);
  const g = tileOf(to);
  const key = (c: number, r: number) => r * COLS + c;
  const prev = new Map<number, number>();
  const q: [number, number][] = [[s.c, s.r]];
  prev.set(key(s.c, s.r), -1);
  let found = s.c === g.c && s.r === g.r;
  while (q.length && !found) {
    const [c, r] = q.shift()!;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nc = c + dc;
      const nr = r + dr;
      if (prev.has(key(nc, nr)) || !ok(nc, nr)) continue;
      if (dc && dr && (!ok(c + dc, r) || !ok(c, r + dr))) continue;
      prev.set(key(nc, nr), key(c, r));
      if (nc === g.c && nr === g.r) {
        found = true;
        break;
      }
      q.push([nc, nr]);
    }
  }
  if (!found) return null;
  const tiles: Pos[] = [];
  for (let k = key(g.c, g.r); k !== -1 && k !== key(s.c, s.r); k = prev.get(k)!) tiles.unshift(tileCenter(k % COLS, Math.floor(k / COLS)));
  // On simplifie les lignes droites puis on finit au point exact.
  const pts: Pos[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const a = pts[pts.length - 1] ?? from;
    const b = tiles[i];
    const c = tiles[i + 1];
    if (c && Math.sign(b.x - a.x) === Math.sign(c.x - b.x) && Math.sign(b.y - a.y) === Math.sign(c.y - b.y)) continue;
    pts.push(b);
  }
  if (pts.length) pts.pop();
  pts.push(to);
  return pts;
}

/** Suite de pièces à traverser (portes) pour aller de a à b. */
export function roomRoute(a: RoomId, b: RoomId): { room: RoomId; door: Door }[] {
  const prev = new Map<RoomId, { room: RoomId; door: Door } | null>([[a, null]]);
  const q: RoomId[] = [a];
  while (q.length) {
    const r = q.shift()!;
    if (r === b) break;
    for (const [d, n] of Object.entries(ROOMS[r].doors) as [Door, RoomId][]) {
      if (prev.has(n)) continue;
      prev.set(n, { room: r, door: d });
      q.push(n);
    }
  }
  const hops: { room: RoomId; door: Door }[] = [];
  for (let r: RoomId = b; prev.get(r); r = prev.get(r)!.room) hops.unshift(prev.get(r)!);
  return hops;
}

/** Point accessible le plus proche (toucher le sol, objet caché…). */
export function nearestStandable(room: RoomId, p: Pos): Pos {
  const x = Math.max(T + HALF, Math.min(SCREEN_W - T - HALF, p.x));
  const y = Math.max(WALL_H + DEPTH, Math.min(SCREEN_H - T, p.y));
  if (canStand(room, x, y)) return { x, y };
  for (let r = 1; r < 40; r++)
    for (const [dx, dy] of [[0, r], [0, -r], [r, 0], [-r, 0], [r, r], [-r, r], [r, -r], [-r, -r]])
      if (canStand(room, x + dx, y + dy)) return { x: x + dx, y: y + dy };
  return START;
}

export function nearbySpot(room: RoomId, p: Pos, reach = 12): Spot | null {
  let best: Spot | null = null;
  let bd = reach;
  for (const s of SPOTS) {
    if (s.room !== room) continue;
    const d = Math.hypot(s.stand.x - p.x, s.stand.y - p.y);
    if (d < bd) {
      best = s;
      bd = d;
    }
  }
  return best;
}

export function spotAt(room: RoomId, x: number, y: number): Spot | null {
  return SPOTS.find((s) => s.room === room && x >= s.tap.x1 && x <= s.tap.x2 && y >= s.tap.y1 && y <= s.tap.y2) ?? null;
}

export function doorAt(room: RoomId, x: number, y: number): Door | null {
  const ds = Object.keys(ROOMS[room].doors) as Door[];
  if (ROOMS[room].exit) ds.push(ROOMS[room].exit!);
  for (const d of ds) {
    const b = doorBox(d);
    if (x >= b.x1 - 4 && x <= b.x2 + 4 && y >= b.y1 && y <= b.y2 + 4) return d;
  }
  return null;
}

export const START: Place = { room: "salon", x: 80, y: 70 };

/** Valide une position sauvegardée (les anciennes positions 3.0 repartent du salon). */
export function restorePlace(raw: unknown): Place {
  const o = raw as Partial<Place> | null;
  if (o && typeof o.room === "string" && o.room in ROOMS && typeof o.x === "number" && typeof o.y === "number" && canStand(o.room as RoomId, o.x, o.y))
    return { room: o.room as RoomId, x: o.x, y: o.y };
  return START;
}

/** Position de l'objet caché du jour à partir de sa graine. */
export function cachePlace(seed: number | null): Place | null {
  if (seed == null) return null;
  const cands: Place[] = [];
  for (const room of ROOM_IDS)
    for (let r = 6; r < ROWS - 2; r += 2)
      for (let c = 2; c < COLS - 2; c += 2) {
        const p = tileCenter(c, r);
        if (canStand(room, p.x, p.y)) cands.push({ room, ...p });
      }
  return cands[Math.floor(seed * cands.length) % cands.length];
}
