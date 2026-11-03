import { hash2 } from "./rng";
import type { BuildingType, City } from "./types";

export interface StreetInfo {
  /** distance au centre de la rue la plus proche */
  dStreet: number;
  /** point de la rue le plus proche */
  px: number; py: number;
  /** rayon depuis la place centrale */
  r: number;
  /** secteur (quartier) angulaire 0..n-1 */
  sector: number;
}

export const DISTRICTS = ["habitat", "artisans", "habitat", "culte", "habitat", "artisans"] as const;

/** Nombre de rues rayonnantes d'une ville (4 à 6). */
export function streetCount(city: Pick<City, "id">): number {
  return 4 + Math.floor(hash2(city.id, 11, 3) * 3);
}

/** Polyligne (légèrement sinueuse) de la i-ème rue de la ville, depuis la place centrale jusqu'à `len`. */
const polyCache = new Map<string, [number, number][]>();
export function streetPolyline(city: Pick<City, "id" | "x" | "y">, i: number, len: number): [number, number][] {
  const key = `${city.id}:${city.x}:${city.y}:${i}:${len}`;
  const hit = polyCache.get(key);
  if (hit) return hit;
  const pts = buildPolyline(city, i, len);
  if (polyCache.size > 4000) polyCache.clear();
  polyCache.set(key, pts);
  return pts;
}
function buildPolyline(city: Pick<City, "id" | "x" | "y">, i: number, len: number): [number, number][] {
  const n = streetCount(city);
  const base = hash2(city.id, 5, 9) * Math.PI * 2;
  const ang = base + (i / n) * Math.PI * 2 + (hash2(city.id, i, 21) - 0.5) * 0.45;
  const cx = city.x + 0.5, cy = city.y + 0.5;
  const pts: [number, number][] = [];
  const steps = Math.max(2, Math.ceil(len / 1.1));
  let wob = 0;
  for (let k = 0; k <= steps; k++) {
    const d = Math.min(len, (k / steps) * len) + 0.9; // la place centrale (rayon ~0.9) reste dégagée
    wob += (hash2(city.id * 7 + i, k, 33) - 0.5) * 0.28;
    const nx = -Math.sin(ang), ny = Math.cos(ang);
    pts.push([cx + Math.cos(ang) * d + nx * wob, cy + Math.sin(ang) * d + ny * wob]);
  }
  return pts;
}

/** Informations d'urbanisme d'une position (tuile) par rapport aux rues de la ville. */
export function streetInfo(city: Pick<City, "id" | "x" | "y">, x: number, y: number, len = 12): StreetInfo {
  const n = streetCount(city);
  let best = 1e9, bx = city.x + 0.5, by = city.y + 0.5;
  for (let i = 0; i < n; i++) {
    const pts = streetPolyline(city, i, len);
    for (let k = 0; k + 1 < pts.length; k++) {
      const [ax, ay] = pts[k], [cx, cy] = pts[k + 1];
      const dx = cx - ax, dy = cy - ay, L2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
      const qx = ax + dx * t, qy = ay + dy * t;
      const d = Math.hypot(x - qx, y - qy);
      if (d < best) { best = d; bx = qx; by = qy; }
    }
  }
  const cx0 = city.x + 0.5, cy0 = city.y + 0.5;
  const base = hash2(city.id, 5, 9) * Math.PI * 2;
  let a = Math.atan2(y - cy0, x - cx0) - base;
  a = ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  return { dStreet: best, px: bx, py: by, r: Math.hypot(x - cx0, y - cy0), sector: Math.floor((a / (Math.PI * 2)) * n) % n };
}

/** Quartier assigné à un secteur de la ville (habitat, artisans, culte). */
export function districtOf(city: Pick<City, "id">, sector: number): (typeof DISTRICTS)[number] {
  return DISTRICTS[(sector + Math.floor(hash2(city.id, 2, 2) * 6)) % DISTRICTS.length];
}

/** Quartier préféré d'un type de bâtiment. */
export function preferredDistrict(type: BuildingType): (typeof DISTRICTS)[number] | null {
  switch (type) {
    case "house": return "habitat";
    case "market": case "forge": case "factory": case "lumber": case "mill": case "station": case "power": return "artisans";
    case "temple": case "castle": case "lab": return "culte";
    default: return null;
  }
}

/** Angle de lacet (Y) pour qu'un bâtiment dont la façade est en +z regarde la rue. */
export function faceStreet(bx: number, by: number, info: StreetInfo): number {
  return Math.atan2(info.px - bx, info.py - by);
}
