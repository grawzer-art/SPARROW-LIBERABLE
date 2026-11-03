import { Geo, type GeoSample } from "./Geo";
import { TILE_RAD } from "./scale";
import { BIOME, type Vec3 } from "./Planet";

/**
 * Tuiles de terrain d'une sphère « cube » (6 faces, quadtree) : géométrie pure partagée entre le thread principal et le worker.
 * Une tuile = grille de G × G sommets de la face `face`, niveau `level` (2^level tuiles par côté), indices (i, j).
 */
const FACES: { n: Vec3; tu: Vec3; tv: Vec3 }[] = [
  { n: [1, 0, 0], tu: [0, 0, -1], tv: [0, 1, 0] }, { n: [-1, 0, 0], tu: [0, 0, 1], tv: [0, 1, 0] },
  { n: [0, 1, 0], tu: [1, 0, 0], tv: [0, 0, -1] }, { n: [0, -1, 0], tu: [1, 0, 0], tv: [0, 0, 1] },
  { n: [0, 0, 1], tu: [1, 0, 0], tv: [0, 1, 0] }, { n: [0, 0, -1], tu: [-1, 0, 0], tv: [0, 1, 0] },
];
/** Densité de canopée par biome (forêts, jungle, taïga denses ; plaines et savanes clairsemées). */
const TREE_DENSITY: Record<number, number> = { 5: 0.1, 4: 0.12, 6: 0.85, 7: 0.95, 8: 0.7, 9: 0.05, 10: 0.3 };
export const GRID = 17; // sommets par côté (16 cases) : tuile légère, ~512 triangles

/** Direction unitaire pour les coordonnées de face (u, v) ∈ [-1, 1] (projection tan : tuiles de taille presque uniforme). */
export function faceDir(face: number, u: number, v: number, out: Vec3): Vec3 {
  const f = FACES[face], a = Math.tan((u * Math.PI) / 4), b = Math.tan((v * Math.PI) / 4);
  const x = f.n[0] + f.tu[0] * a + f.tv[0] * b, y = f.n[1] + f.tu[1] * a + f.tv[1] * b, z = f.n[2] + f.tu[2] * a + f.tv[2] * b;
  const l = Math.hypot(x, y, z);
  out[0] = x / l; out[1] = y / l; out[2] = z / l;
  return out;
}
/** Taille angulaire (rad) d'une tuile du niveau donné. */
export const nodeSize = (level: number): number => (Math.PI / 2) / (1 << level);
export const nodeUV = (level: number, i: number, j: number) => { const n = 1 << level, s = 2 / n; return { u0: -1 + i * s, u1: -1 + (i + 1) * s, v0: -1 + j * s, v1: -1 + (j + 1) * s }; };

export interface ChunkData {
  h: Float32Array; // altitude en cases, G*G
  riv: Float32Array;
  col: Float32Array; // RGB, G*G*3
  tree: Float32Array; // densité de couvert forestier 0..1
}

/** Échantillonne la géographie sur la grille de la tuile ; la finesse suit l'espacement des sommets (LOD cohérent entre échelles). */
export function buildChunkData(geo: Geo, face: number, level: number, i: number, j: number): ChunkData {
  const G = GRID, n = G * G, h = new Float32Array(n), riv = new Float32Array(n), col = new Float32Array(n * 3), tree = new Float32Array(n);
  const { u0, u1, v0, v1 } = nodeUV(level, i, j);
  const spacing = nodeSize(level) / (G - 1), minWave = Math.max(TILE_RAD * 1.5, spacing * 1.6);
  const d: Vec3 = [0, 0, 0], smp: GeoSample = { h: 0, riv: 0, bio: 0, hp: 0 }, c: [number, number, number] = [0, 0, 0];
  for (let b = 0; b < G; b++) for (let a = 0; a < G; a++) {
    faceDir(face, u0 + ((u1 - u0) * a) / (G - 1), v0 + ((v1 - v0) * b) / (G - 1), d);
    geo.sample(d, minWave, smp);
    const o = b * G + a;
    h[o] = smp.h; riv[o] = smp.riv;
    // la plage est tracée par le shader (bande de rivage lisse) : le sommet garde la couleur de la terre voisine
    const bio = smp.bio === BIOME.beach ? geo.planet.biomeOf(d, 0.03) : smp.bio;
    geo.planet.paint(bio, d, smp.hp, c);
    if (smp.riv > 0.35 && smp.h > 0.05) { const k = Math.min(1, (smp.riv - 0.35) / 0.4); c[0] += (0.2 - c[0]) * k; c[1] += (0.52 - c[1]) * k; c[2] += (0.72 - c[2]) * k; }
    col[o * 3] = c[0]; col[o * 3 + 1] = c[1]; col[o * 3 + 2] = c[2];
    tree[o] = smp.h > 0.05 ? TREE_DENSITY[smp.bio] ?? 0 : 0;
  }
  return { h, riv, col, tree };
}
