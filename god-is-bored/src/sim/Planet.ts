import { LOCAL_SPAN_DEG } from "./scale";
import type { SimulationEngine } from "./SimulationEngine";

/**
 * Planète : modèle géographique pur (aucune dépendance à Three.js ni au DOM).
 * - Génération reproductible (graine) d'un globe : continents, îles, océans, montagnes, biomes.
 * - Régions : portions de la planète portant une simulation. La carte locale existante (64×64) est la région R1 ;
 *   chaque habitant, bâtiment ou ville a un identifiant persistant (celui du moteur) donc une adresse globale
 *   (région, identifiant) et des coordonnées géographiques (latitude, longitude) dérivées de sa position locale.
 * Le globe ne stocke aucun habitant ni aucune ville : tout est dérivé de l'état réel du moteur.
 */

export type Vec3 = [number, number, number];
const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

// ---------------------------------------------------------------- bruit 3D

function h3(x: number, y: number, z: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177) ^ Math.imul(s | 0, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function noise3(x: number, y: number, z: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), w = fz * fz * (3 - 2 * fz);
  const c = (dx: number, dy: number, dz: number) => h3(ix + dx, iy + dy, iz + dz, s);
  return lerp(
    lerp(lerp(c(0, 0, 0), c(1, 0, 0), u), lerp(c(0, 1, 0), c(1, 1, 0), u), v),
    lerp(lerp(c(0, 0, 1), c(1, 0, 1), u), lerp(c(0, 1, 1), c(1, 1, 1), u), v), w);
}
export function fbm3(x: number, y: number, z: number, s: number, oct = 4): number {
  let a = 0.5, f = 1, sum = 0, tot = 0;
  for (let i = 0; i < oct; i++) { sum += a * noise3(x * f, y * f, z * f, s + i * 31); tot += a; a *= 0.5; f *= 2.03; }
  return sum / tot;
}

// ---------------------------------------------------------------- types

export interface Region {
  id: number; // identifiant persistant de la région (la carte d'origine est R1)
  name: string;
  lat: number; lon: number; // centre (radians)
  spanDeg: number; // largeur angulaire de la carte locale (degrés)
  size: number; // cases par côté de la carte locale
  /** Régions « dérivées » : terrain local généré à partir du relief et des biomes du globe (R1, carte d'origine, ne l'est pas). */
  derived?: boolean;
  seed?: number; // graine persistante du terrain local
  continent?: number; // continent d'appartenance (indice dans `continents()`, informatif)
  inhabited?: boolean; // une civilisation y est simulée dès le départ
  /** Carte locale issue de la géographie continue (échelle 2) : son terrain est exactement celui du globe et des tuiles du continent. */
  geo?: boolean;
  /** Carte d'une ancienne partie, conservée telle quelle et incrustée à sa place (bords fondus dans la géographie continue). */
  legacyMap?: boolean;
}
export interface Continent { id: number; name: string; kind: "continent" | "island"; cells: number; areaPct: number; lat: number; lon: number; }
export interface Biome { id: number; name: string; color: [number, number, number]; }

export const BIOME = {
  ocean: 0, shelf: 1, beach: 2, desert: 3, savanna: 4, grass: 5, forest: 6, jungle: 7, taiga: 8, tundra: 9, hills: 10, rock: 11, snow: 12,
} as const;
export const BIOME_NAME = ["Océan", "Plateau continental", "Plage", "Désert", "Savane", "Plaine", "Forêt", "Jungle", "Taïga", "Toundra", "Collines", "Montagne", "Neiges"];
const hex = (n: number): [number, number, number] => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const PALETTE_V1 = [0x1f5d80, 0x3f9bb0, 0xdccb98, 0xdcc48c, 0xb6b45a, 0x77a64c, 0x3f7b3c, 0x2f7a43, 0x4d7458, 0xa5ac98, 0x93a05c, 0x8d8780, 0xf1f3f5].map(hex);
// v2 : couleurs plus saturées et plus contrastées (terre chaude / océan profond), neige réservée aux pôles et aux sommets
const PALETTE_V2 = [0x1b4d86, 0x3aa0b8, 0xe9d8a0, 0xe3b865, 0xc3b252, 0x72b04c, 0x2f7d3d, 0x1f8a4a, 0x3f7358, 0x9db79a, 0x93a657, 0x8c8478, 0xf2f5f7].map(hex);

const SYL_A = ["Aur", "Vel", "Tor", "Mer", "Zan", "Kel", "Ily", "Orb", "Sab", "Nem", "Cal", "Dra", "Eph", "Gor"];
const SYL_B = ["ia", "ora", "land", "ath", "ea", "um", "ance", "ova", "ion", "eth"];
const nameOf = (seed: number, k: number): string => SYL_A[Math.floor(h3(k, 1, 2, seed) * SYL_A.length)] + SYL_B[Math.floor(h3(k, 3, 4, seed) * SYL_B.length)];

// ---------------------------------------------------------------- géométrie sphérique

export function dirOf(lat: number, lon: number): Vec3 { return [Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]; }
export function latLonOf(d: Vec3): { lat: number; lon: number } { return { lat: Math.asin(clamp(d[1], -1, 1)), lon: Math.atan2(d[2], d[0]) }; }
/** Repère local direct en un point : e (axe x de la carte locale), c (haut = normale), s = e × c (axe y de la carte locale). */
export function frameAt(d: Vec3): { e: Vec3; c: Vec3; s: Vec3 } {
  const { lat, lon } = latLonOf(d);
  const e: Vec3 = [-Math.sin(lon), 0, Math.cos(lon)];
  const n: Vec3 = [-Math.sin(lat) * Math.cos(lon), Math.cos(lat), -Math.sin(lat) * Math.sin(lon)];
  // troisième axe = e × c (repère DIRECT, indispensable pour reproduire la carte locale sans effet miroir)
  return { e, c: d, s: n };
}

// ---------------------------------------------------------------- planète

interface Blob { c: Vec3; r: number; w: number; }

export class Planet {
  readonly seed: number;
  /** Version du générateur : 1 = première planète (conservée pour les parties existantes), 2 = continents répartis, biomes lisibles. */
  readonly gen: number;
  /** Échelle des régions : 1 = anciennes cartes de 26° (parties existantes) ; 2 = hiérarchie planète/continent/région/local (cartes locales de 1,7°). */
  scale: number;
  regions: Region[];
  private blobs: Blob[] = [];
  private contCache: Continent[] | null = null;
  private contGrid: Int16Array | null = null;
  static readonly GW = 144;
  static readonly GH = 72;

  constructor(seed: number, regions?: Region[], gen = 2, scale = 2) {
    this.seed = seed | 0;
    this.gen = gen;
    this.scale = scale;
    this.makeBlobs();
    this.regions = regions ?? (scale >= 2 ? [] : [this.placeHomeRegion(64)]);
    if (!regions && scale >= 2) { const h = this.suggestStartRegions(1)[0]; if (h) this.regions.push({ id: 1, name: "Terre Première", lat: h.lat, lon: h.lon, spanDeg: this.cellSpanDeg, size: 64, geo: true, inhabited: true, seed: Math.imul(this.seed ^ 0x5bd1e995, 1) >>> 0 }); }
  }

  /** Largeur angulaire (°) d'une carte locale selon l'échelle. */
  get cellSpanDeg(): number { return this.scale >= 2 ? LOCAL_SPAN_DEG : 26; }

  /**
   * MIGRATION (échelle 1 → 2) : les anciennes cartes gardent leur centre, leurs habitants et leur terrain, mais ne couvrent plus que 1,7°
   * au lieu de 26° : elles deviennent des villages incrustés dans une géographie continue bien plus vaste.
   */
  upgradeScale(): boolean {
    if (this.scale >= 2) return false;
    this.scale = 2;
    for (const r of this.regions) { r.spanDeg = LOCAL_SPAN_DEG; r.legacyMap = true; }
    return true;
  }

  /** Nouvelle planète. Échelle 2 (défaut) : cartes locales de 1,7° dans une géographie continue ; échelle 1 : anciennes cartes de 26°. */
  static create(seed: number, mapSize = 64, scale = 2): Planet {
    const p = new Planet(seed, undefined, 2, scale);
    if (p.regions[0]) p.regions[0].size = mapSize;
    return p;
  }

  private makeBlobs(): void {
    if (this.gen >= 2) { this.makeBlobsV2(); return; }
    const s = this.seed;
    const rnd = (k: number) => h3(k, 17, 5, s);
    const pick = (k: number, minSep: number, existing: Blob[]): Vec3 => {
      for (let t = 0; t < 60; t++) {
        const z = rnd(k * 97 + t * 3) * 2 - 1, a = rnd(k * 97 + t * 3 + 1) * TAU, q = Math.sqrt(1 - z * z);
        const d: Vec3 = [q * Math.cos(a), z, q * Math.sin(a)];
        if (existing.every((b) => Math.acos(clamp(dot(b.c, d), -1, 1)) > minSep)) return d;
      }
      const z = rnd(k * 97) * 2 - 1, a = rnd(k * 97 + 1) * TAU, q = Math.sqrt(1 - z * z);
      return [q * Math.cos(a), z, q * Math.sin(a)];
    };
    // 5 continents bien séparés
    for (let i = 0; i < 5; i++) this.blobs.push({ c: pick(i, 1.3, this.blobs), r: 0.55 + rnd(200 + i) * 0.28, w: 0.95 + rnd(210 + i) * 0.2 });
    // archipels et îles isolées
    const cont = this.blobs.length;
    for (let i = 0; i < 12; i++) this.blobs.push({ c: pick(300 + i, 0.5, this.blobs.slice(0, cont).concat(this.blobs.slice(cont))), r: 0.1 + rnd(320 + i) * 0.13, w: 1.2 });
  }

  /**
   * Génération v2 : 6 masses continentales réparties régulièrement (points de Fibonacci tournés et secoués par la graine),
   * de tailles différentes, séparées par des océans continus, puis des archipels groupés au large des côtes.
   */
  private makeBlobsV2(): void {
    const s = this.seed;
    const rnd = (k: number) => h3(k, 17, 5, s);
    const n = 6, ga = Math.PI * (3 - Math.sqrt(5));
    const ra = rnd(1) * TAU, rb = (rnd(2) - 0.5) * 0.9;
    const rot = (v: Vec3): Vec3 => { // rotation autour de y puis de x
      const c = Math.cos(ra), si = Math.sin(ra), x = v[0] * c + v[2] * si, z = -v[0] * si + v[2] * c;
      const c2 = Math.cos(rb), s2 = Math.sin(rb);
      return [x, v[1] * c2 - z * s2, v[1] * s2 + z * c2];
    };
    for (let i = 0; i < n; i++) {
      const y = 1 - (2 * (i + 0.5)) / n, q = Math.sqrt(1 - y * y), a = ga * i;
      const c = norm(rot([q * Math.cos(a) + (rnd(10 + i) - 0.5) * 0.35, y * 0.9 + (rnd(20 + i) - 0.5) * 0.3, q * Math.sin(a) + (rnd(30 + i) - 0.5) * 0.35]));
      this.blobs.push({ c, r: 0.6 + rnd(40 + i) * 0.25, w: 1.0 + rnd(50 + i) * 0.1 });
    }
    // archipels : 4 grappes de 3 à 4 îles à 0,85–1,15 rad d'un continent
    const cont = this.blobs.length;
    for (let g = 0; g < 4; g++) {
      const base = this.blobs[Math.floor(rnd(60 + g) * cont)];
      const dir = rnd(70 + g) * TAU, dist = 0.86 + rnd(80 + g) * 0.3;
      const fr = frameAt(base.c);
      const centre = norm([base.c[0] + (fr.e[0] * Math.cos(dir) + fr.s[0] * Math.sin(dir)) * dist, base.c[1] + (fr.e[1] * Math.cos(dir) + fr.s[1] * Math.sin(dir)) * dist, base.c[2] + (fr.e[2] * Math.cos(dir) + fr.s[2] * Math.sin(dir)) * dist]);
      const f2 = frameAt(centre), k = 3 + Math.floor(rnd(90 + g) * 2);
      for (let i = 0; i < k; i++) {
        const a = rnd(100 + g * 10 + i) * TAU, d = 0.06 + rnd(120 + g * 10 + i) * 0.2;
        this.blobs.push({ c: norm([centre[0] + (f2.e[0] * Math.cos(a) + f2.s[0] * Math.sin(a)) * d, centre[1] + (f2.e[1] * Math.cos(a) + f2.s[1] * Math.sin(a)) * d, centre[2] + (f2.e[2] * Math.cos(a) + f2.s[2] * Math.sin(a)) * d]), r: 0.1 + rnd(140 + g * 10 + i) * 0.1, w: 1.25 });
      }
    }
  }

  /** Altitude normalisée (≈ -1 : abysses, 0 : niveau de la mer, 1 : hautes montagnes). Hors région (voir `heightWithRegions`). */
  height(d: Vec3): number {
    const s = this.seed;
    const wx = (noise3(d[0] * 1.4 + 11, d[1] * 1.4, d[2] * 1.4, s + 1) - 0.5) * 0.7;
    const wy = (noise3(d[0] * 1.4, d[1] * 1.4 + 23, d[2] * 1.4, s + 2) - 0.5) * 0.7;
    const wz = (noise3(d[0] * 1.4, d[1] * 1.4, d[2] * 1.4 + 37, s + 3) - 0.5) * 0.7;
    const p = norm([d[0] + wx, d[1] + wy, d[2] + wz]);
    let f = 0;
    for (const b of this.blobs) { const a = Math.acos(clamp(dot(p, b.c), -1, 1)), v = b.w * Math.exp(-Math.pow(a / b.r, 2) * 1.5); if (this.gen >= 2) f = Math.max(f, v); else f += v; } // v2 : maximum (les continents ne fusionnent pas)
    const detail = (fbm3(d[0] * 3.2, d[1] * 3.2, d[2] * 3.2, s + 5, 4) - 0.5) * 0.6 + (fbm3(d[0] * 9, d[1] * 9, d[2] * 9, s + 9, 3) - 0.5) * 0.16;
    const h = f + detail - (this.gen >= 2 ? 0.58 : 0.66);
    if (h > 0.3) { // chaînes de montagnes : relief en crêtes à l'intérieur des terres
      const ridge = 1 - Math.abs(fbm3(d[0] * 4.4, d[1] * 4.4, d[2] * 4.4, s + 13, 4) * 2 - 1);
      return h + ridge * ridge * 0.38 * sstep(0.3, 0.7, h);
    }
    return h;
  }

  /** Altitude finale : la zone d'une région est creusée (sous la surface de l'eau) car la carte réelle de la région y est tracée. */
  heightWithRegions(d: Vec3): number {
    let h = this.height(d);
    for (const r of this.regions) { if (r.derived) continue; const w = this.regionWeight(r, d); if (w > 0) h = lerp(h, Math.min(h, -0.45), w); }
    return h;
  }

  /** Poids (1 à l'intérieur de l'emprise de la région, 0 au-delà d'une marge). */
  regionWeight(r: Region, d: Vec3): number {
    const l = this.dirToLocal(r, d);
    if (!l) return 0;
    const half = r.size / 2, dx = Math.abs(l.x - half) / half, dy = Math.abs(l.y - half) / half;
    const m = Math.max(dx, dy);
    return 1 - sstep(1.0, 1.42, m);
  }

  biomeOf(d: Vec3, h: number): number {
    if (this.gen >= 2) return this.biomeV2(d, h);
    if (h < -0.04) return h < -0.06 ? BIOME.ocean : BIOME.shelf;
    if (h < 0.015) return BIOME.beach;
    const lat = Math.asin(clamp(d[1], -1, 1));
    const temp = 1 - Math.abs(lat) / 1.35 - Math.max(0, h) * 0.55 + (fbm3(d[0] * 2, d[1] * 2, d[2] * 2, this.seed + 21, 3) - 0.5) * 0.18;
    const moist = fbm3(d[0] * 2.3 + 7, d[1] * 2.3, d[2] * 2.3, this.seed + 27, 4) + 0.22 * Math.cos(lat * 2.6) - 0.1;
    if (h > 0.62) return BIOME.snow;
    if (h > 0.42) return temp < 0.25 ? BIOME.snow : BIOME.rock;
    if (h > 0.26) return BIOME.hills;
    if (temp < 0.12) return BIOME.snow;
    if (temp < 0.3) return moist > 0.42 ? BIOME.taiga : BIOME.tundra;
    if (temp > 0.62) return moist < 0.42 ? BIOME.desert : moist < 0.55 ? BIOME.savanna : BIOME.jungle;
    return moist < 0.36 ? BIOME.desert : moist < 0.46 ? BIOME.savanna : moist < 0.6 ? BIOME.grass : BIOME.forest;
  }

  private biomeV2(d: Vec3, h: number): number {
    if (h < -0.04) return h < -0.06 ? BIOME.ocean : BIOME.shelf;
    if (h < 0.012) return BIOME.beach;
    const lat = Math.asin(clamp(d[1], -1, 1));
    const temp = 1 - Math.abs(lat) / 1.45 - Math.max(0, h) * 0.5 + (fbm3(d[0] * 2, d[1] * 2, d[2] * 2, this.seed + 21, 3) - 0.5) * 0.14;
    const moist = fbm3(d[0] * 2.3 + 7, d[1] * 2.3, d[2] * 2.3, this.seed + 27, 4) + 0.2 * Math.cos(lat * 2.6) - 0.08;
    if (h > 0.72 || (h > 0.5 && temp < 0.3)) return BIOME.snow;
    if (h > 0.46) return BIOME.rock;
    if (h > 0.27) return BIOME.hills;
    if (temp < 0.02) return BIOME.snow;
    if (temp < 0.2) return BIOME.tundra;
    if (temp < 0.34) return moist > 0.42 ? BIOME.taiga : BIOME.tundra;
    if (temp > 0.6) return moist < 0.44 ? BIOME.desert : moist < 0.56 ? BIOME.savanna : BIOME.jungle;
    return moist < 0.33 ? BIOME.desert : moist < 0.44 ? BIOME.savanna : moist < 0.58 ? BIOME.grass : BIOME.forest;
  }

  /** Couleur stylisée d'un point (palette cohérente avec le terrain local). */
  colorAt(d: Vec3, h: number, out: [number, number, number]): number {
    const b = this.biomeOf(d, h);
    this.paint(b, d, h, out);
    return b;
  }
  /** Peint un biome déjà connu (évite de le recalculer). */
  paint(b: number, d: Vec3, h: number, out: [number, number, number]): void {
    const PAL = this.gen >= 2 ? PALETTE_V2 : PALETTE_V1;
    const base = PAL[b];
    const n = (fbm3(d[0] * 14, d[1] * 14, d[2] * 14, this.seed + 33, 2) - 0.5) * 0.16;
    let r = base[0], g = base[1], bl = base[2];
    if (b === BIOME.ocean) { const k = sstep(-0.06, -0.5, h); r = lerp(PAL[1][0], this.gen >= 2 ? 0.06 : 0.07, k); g = lerp(PAL[1][1], this.gen >= 2 ? 0.25 : 0.27, k); bl = lerp(PAL[1][2], this.gen >= 2 ? 0.46 : 0.42, k); }
    out[0] = clamp(r * (1 + n)); out[1] = clamp(g * (1 + n)); out[2] = clamp(bl * (1 + n));
  }

  // ---------------------------------------------------------------- régions

  /** Place la carte d'origine : au large d'une côte (au moins 75 % de mer dans l'emprise, terre proche), à latitude tempérée. */
  private placeHomeRegion(size: number): Region {
    const spanDeg = 26, spanRad = (spanDeg * Math.PI) / 180;
    const N = 900;
    let best: { score: number; d: Vec3 } | null = null;
    const ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N, q = Math.sqrt(1 - y * y), a = ga * i;
      const d: Vec3 = [q * Math.cos(a), y, q * Math.sin(a)];
      const lat = Math.abs(Math.asin(y));
      if (lat > 0.85) continue;
      const fr = frameAt(d);
      let sea = 0, tot = 0;
      for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) {
        const sd = norm([d[0] + (fr.e[0] * u + fr.s[0] * v) * (spanRad / 7), d[1] + (fr.e[1] * u + fr.s[1] * v) * (spanRad / 7), d[2] + (fr.e[2] * u + fr.s[2] * v) * (spanRad / 7)]);
        tot++; if (this.height(sd) < -0.03) sea++;
      }
      if (sea / tot < 0.78) continue;
      let land = 0;
      for (let k = 0; k < 16; k++) {
        const ang = (k / 16) * TAU, rr = spanRad * 1.5;
        const sd = norm([d[0] + (fr.e[0] * Math.cos(ang) + fr.s[0] * Math.sin(ang)) * rr, d[1] + (fr.e[1] * Math.cos(ang) + fr.s[1] * Math.sin(ang)) * rr, d[2] + (fr.e[2] * Math.cos(ang) + fr.s[2] * Math.sin(ang)) * rr]);
        if (this.height(sd) > 0.02) land++;
      }
      if (land < 2) continue;
      // préfère les latitudes tempérées et une côte nette
      const score = Math.abs(lat - 0.55) * 2 + (land > 9 ? 0.6 : 0) + h3(i, 5, 5, this.seed) * 0.15;
      if (!best || score < best.score) best = { score, d };
    }
    if (!best) best = { score: 0, d: dirOf(0.4, 0.5) };
    const ll = latLonOf(best.d);
    return { id: 1, name: "Terre Première", lat: ll.lat, lon: ll.lon, spanDeg, size };
  }

  // ---------------------------------------------------------------- régions explorables (partout sur terre)

  /** Région existante dont l'emprise contient la direction (marge comprise), sinon undefined. */
  regionAt(d: Vec3, margin = 0): Region | undefined {
    for (const r of this.regions) {
      const l = this.dirToLocal(r, d);
      if (l && l.x > -margin && l.y > -margin && l.x < r.size + margin && l.y < r.size + margin) return r;
    }
    return undefined;
  }
  /** Cellule de grille (déterministe) contenant la direction : bandes de latitude de la largeur d'une carte, longitudes en nombre entier par bande. */
  gridCell(d: Vec3): { band: number; idx: number; lat: number; lon: number; id: number } {
    const sr = (this.cellSpanDeg * Math.PI) / 180, v2 = this.scale >= 2;
    const { lat, lon } = latLonOf(d);
    const maxBand = v2 ? Math.floor((Math.PI / 2) / sr) - 1 : 5;
    const band = Math.max(-maxBand, Math.min(maxBand, Math.round(lat / sr)));
    const clat = band * sr;
    const n = Math.max(1, Math.round((TAU * Math.cos(clat)) / sr));
    const idx = ((Math.round(((lon + Math.PI) / TAU) * n) % n) + n) % n;
    return { band, idx, lat: clat, lon: (idx / n) * TAU - Math.PI, id: v2 ? 100000 + (band + 80) * 400 + idx : 1000 + (band + 5) * 100 + idx };
  }
  /** Région qu'un toucher en ce point ouvrirait (sans la créer) : existante, ou cellule de grille ; null en mer. */
  previewRegionAt(d: Vec3): Region | null {
    const ex = this.regionAt(d, 0.5);
    if (ex) return ex;
    if (this.height(d) < 0.005) return null;
    const c = this.gridCell(d), prior = this.regionById(c.id);
    if (prior) return prior;
    const near = this.nearbyRegion(dirOf(c.lat, c.lon));
    if (near) return near;
    const r: Region = { id: c.id, name: "", lat: c.lat, lon: c.lon, spanDeg: this.cellSpanDeg, size: 64, derived: this.scale < 2, geo: this.scale >= 2 };
    r.name = this.describeRegion(r);
    return r;
  }
  /** Région explorable en un point : celle qui existe déjà, sinon celle de la cellule de grille (créée, persistante). Null sur l'océan. */
  ensureRegionAt(d: Vec3): Region | null {
    const ex = this.regionAt(d, 0.5);
    if (ex) return ex;
    if (this.height(d) < 0.005) return null;
    const c = this.gridCell(d);
    const prior = this.regionById(c.id);
    if (prior) return prior;
    const near = this.nearbyRegion(dirOf(c.lat, c.lon));
    if (near) return near; // trop proche d'une carte déjà jouée : on y retourne plutôt que d'en superposer une autre
    return this.createRegion(c.lat, c.lon, c.id);
  }
  /** Carte existante qui recouvrirait presque la cellule voisine (cartes d'anciennes parties non alignées sur la grille). */
  private nearbyRegion(c: Vec3): Region | undefined {
    for (const r of this.regions) if (!r.geo && Math.acos(clamp(dot(c, this.regionCenter(r)), -1, 1)) < this.spanRad(r) * (this.scale >= 2 ? 0.9 : 1.05)) return r;
    return undefined;
  }
  /** Crée (une seule fois) la région dérivée centrée en (lat, lon). */
  createRegion(lat: number, lon: number, id: number, inhabited = false): Region {
    const ex = this.regionById(id);
    if (ex) return ex;
    const center = dirOf(lat, lon), cont = this.continentAt(center);
    const r: Region = { id, name: "", lat, lon, spanDeg: this.cellSpanDeg, size: 64, derived: this.scale < 2, geo: this.scale >= 2, seed: Math.imul(this.seed ^ 0x5bd1e995, id) >>> 0, continent: cont?.id, inhabited };
    r.name = this.describeRegion(r);
    this.regions.push(r);
    return r;
  }
  /** Nom lisible : biome dominant de l'emprise + continent (« Forêts de Torath »). */
  describeRegion(r: Region): string {
    const counts = new Map<number, number>(), sr = this.spanRad(r);
    const wide: Region = { ...r, spanDeg: Math.max(r.spanDeg, 6) };
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
      const d = this.localToDir(wide, ((i + 0.5) / 5) * r.size, ((j + 0.5) / 5) * r.size), h = this.height(d);
      if (h > 0) { const b = this.biomeOf(d, h); counts.set(b, (counts.get(b) ?? 0) + 1); }
    }
    void sr;
    let best = BIOME.grass as number, bc = -1;
    for (const [b, c] of counts) if (c > bc) { bc = c; best = b; }
    const lab: Record<number, string> = { [BIOME.desert]: "Désert", [BIOME.savanna]: "Savanes", [BIOME.grass]: "Plaines", [BIOME.forest]: "Forêts", [BIOME.jungle]: "Jungles", [BIOME.taiga]: "Taïga", [BIOME.tundra]: "Toundra", [BIOME.hills]: "Collines", [BIOME.rock]: "Montagnes", [BIOME.snow]: "Glaces", [BIOME.beach]: "Rivages" };
    const cont = this.continentAt(dirOf(r.lat, r.lon));
    const nm = cont?.name ?? nameOf(this.seed, r.id);
    const p = lab[best] ?? "Terres";
    return `${p} ${/^[AEIOUYÉÈ]/i.test(nm) ? "d'" : "de "}${nm}`;
  }
  /** Proportion (0..1) de terres émergées et de terres fertiles dans l'emprise d'une région potentielle. */
  footprintStats(lat: number, lon: number): { land: number; fertile: number; cold: number } {
    const r: Region = { id: 0, name: "", lat, lon, spanDeg: this.scale >= 2 ? 4 : 26, size: 64, derived: true };
    let land = 0, fertile = 0, cold = 0, tot = 0;
    for (let i = 0; i < 9; i++) for (let j = 0; j < 9; j++) {
      const d = this.localToDir(r, ((i + 0.5) / 9) * 64, ((j + 0.5) / 9) * 64), h = this.height(d); tot++;
      if (h <= 0.01) continue;
      land++;
      const b = this.biomeOf(d, h);
      if (b === BIOME.grass || b === BIOME.forest || b === BIOME.savanna || b === BIOME.jungle) fertile++;
      if (b === BIOME.snow || b === BIOME.tundra) cold++;
    }
    return { land: land / tot, fertile: fertile / tot, cold: cold / tot };
  }
  /**
   * Régions de départ habitables, une par continent, loin de la carte d'origine : la meilleure cellule de chaque continent
   * (terres, fertilité), triées par qualité. Déterministe.
   */
  suggestStartRegions(count: number): { lat: number; lon: number; id: number; continent: number }[] {
    if (this.scale >= 2) return this.suggestStartCells(count);
    const home = this.regions[0] ? this.regionCenter(this.regions[0]) : null;
    const best = new Map<number, { score: number; lat: number; lon: number; id: number }>();
    const sr = (26 * Math.PI) / 180;
    for (let band = -3; band <= 3; band++) {
      const clat = band * sr, n = Math.max(1, Math.round((TAU * Math.cos(clat)) / sr));
      for (let idx = 0; idx < n; idx++) {
        const lon = (idx / n) * TAU - Math.PI, c = dirOf(clat, lon);
        if (home && Math.acos(clamp(dot(c, home), -1, 1)) < 0.9) continue;
        const st = this.footprintStats(clat, lon);
        if (st.land < 0.5 || st.fertile < 0.3 || st.cold > 0.25) continue;
        const cont = this.continentAt(c) ?? this.continentAt(dirOf(clat, lon + 0.1));
        const key = cont ? cont.id : -1;
        const score = st.fertile * 1.2 + st.land * 0.6 - st.cold - Math.abs(band) * 0.04 + h3(band + 9, idx, 3, this.seed) * 0.05;
        const b = best.get(key);
        if (!b || score > b.score) best.set(key, { score, lat: clat, lon, id: 1000 + (band + 5) * 100 + idx });
      }
    }
    return [...best.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, count).map(([continent, v]) => ({ lat: v.lat, lon: v.lon, id: v.id, continent }));
  }

  /**
   * Échelle 2 : sites de départ = cellules locales (1,7°) bien terrestres et fertiles, une par continent, loin de la carte d'origine.
   * On balaie le voisinage de chaque continent ; le terrain exact est ensuite vérifié par la génération de la carte.
   */
  private suggestStartCells(count: number): { lat: number; lon: number; id: number; continent: number }[] {
    const home = this.regions[0] ? this.regionCenter(this.regions[0]) : null;
    const out: { score: number; lat: number; lon: number; id: number; continent: number }[] = [];
    for (const c of this.continents()) {
      if (c.areaPct < 2.5) continue;
      const cd = dirOf(c.lat, c.lon), fr = frameAt(cd);
      let best: { score: number; lat: number; lon: number; id: number } | null = null;
      for (let u = -5; u <= 5; u++) for (let v = -5; v <= 5; v++) {
        const o = 0.07;
        const d = norm([cd[0] + (fr.e[0] * u + fr.s[0] * v) * o, cd[1] + (fr.e[1] * u + fr.s[1] * v) * o, cd[2] + (fr.e[2] * u + fr.s[2] * v) * o]);
        const lat = latLonOf(d).lat;
        if (Math.abs(lat) > 1.05 || this.height(d) < 0.08) continue;
        if (home && Math.acos(clamp(dot(d, home), -1, 1)) < 0.9) continue;
        const cell = this.gridCell(d), cc = dirOf(cell.lat, cell.lon);
        const st = this.footprintStats(cell.lat, cell.lon);
        if (st.land < 0.95 || st.fertile < 0.55 || st.cold > 0.1) continue;
        const score = st.fertile * 1.2 + (1 - Math.abs(lat) / 1.6) * 0.3 + h3(cell.band + 90, cell.idx, 5, this.seed) * 0.08 - Math.hypot(u, v) * 0.01;
        if (!best || score > best.score) best = { score, lat: cell.lat, lon: cell.lon, id: cell.id };
        void cc;
      }
      if (best) out.push({ ...best, continent: c.id });
    }
    return out.sort((a, b) => b.score - a.score).slice(0, count).map(({ lat, lon, id, continent }) => ({ lat, lon, id, continent }));
  }

  regionById(id: number): Region | undefined { return this.regions.find((r) => r.id === id); }
  regionCenter(r: Region): Vec3 { return dirOf(r.lat, r.lon); }
  spanRad(r: Region): number { return (r.spanDeg * Math.PI) / 180; }
  /** Taille d'une case locale sur la sphère de rayon 1 (équivalent d'une unité de la scène locale). */
  tileScale(r: Region): number { return this.spanRad(r) / r.size; }

  /** Case locale (x : est, y : sud, en cases) -> direction globale (projection gnomonique centrée sur la région). */
  localToDir(r: Region, x: number, y: number): Vec3 {
    const sr = this.spanRad(r);
    const a = (x / r.size - 0.5) * sr, b = (y / r.size - 0.5) * sr;
    const v = norm([Math.tan(a), 1, Math.tan(b)]);
    const f = frameAt(this.regionCenter(r));
    return [f.e[0] * v[0] + f.c[0] * v[1] + f.s[0] * v[2], f.e[1] * v[0] + f.c[1] * v[1] + f.s[1] * v[2], f.e[2] * v[0] + f.c[2] * v[1] + f.s[2] * v[2]];
  }
  /** Direction globale -> case locale (hors de la carte : coordonnées en dehors de [0, size]). Null si derrière la planète. */
  dirToLocal(r: Region, d: Vec3): { x: number; y: number } | null {
    const f = frameAt(this.regionCenter(r));
    const X = dot(d, f.e), Y = dot(d, f.c), Z = dot(d, f.s);
    if (Y <= 0.2) return null;
    const sr = this.spanRad(r);
    return { x: (Math.atan(X / Y) / sr + 0.5) * r.size, y: (Math.atan(Z / Y) / sr + 0.5) * r.size };
  }
  /** Coordonnées géographiques d'une position locale. */
  localToLatLon(r: Region, x: number, y: number): { lat: number; lon: number } { return latLonOf(this.localToDir(r, x, y)); }

  // ---------------------------------------------------------------- continents

  /** Continents et îles détectés sur une grille équirectangulaire (remplissage par composantes connexes, longitude cyclique). */
  continents(): Continent[] {
    if (this.contCache) return this.contCache;
    const { GW, GH } = Planet;
    const grid = new Int16Array(GW * GH).fill(-1);
    const land = new Uint8Array(GW * GH);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
      const lat = ((0.5 - (j + 0.5) / GH) * Math.PI), lon = ((i + 0.5) / GW - 0.5) * TAU;
      land[j * GW + i] = this.height(dirOf(lat, lon)) > 0.01 ? 1 : 0;
    }
    const out: Continent[] = [];
    const stack: number[] = [];
    for (let s = 0; s < GW * GH; s++) {
      if (!land[s] || grid[s] >= 0) continue;
      const id = out.length;
      let cells = 0, sx = 0, sy = 0, sz = 0, area = 0;
      stack.push(s); grid[s] = id;
      while (stack.length) {
        const c = stack.pop()!;
        const i = c % GW, j = (c / GW) | 0;
        const lat = ((0.5 - (j + 0.5) / GH) * Math.PI), lon = ((i + 0.5) / GW - 0.5) * TAU;
        const wgt = Math.cos(lat);
        cells++; area += wgt;
        const dd = dirOf(lat, lon); sx += dd[0] * wgt; sy += dd[1] * wgt; sz += dd[2] * wgt;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = (i + di + GW) % GW, nj = j + dj;
          if (nj < 0 || nj >= GH) continue;
          const n = nj * GW + ni;
          if (land[n] && grid[n] < 0) { grid[n] = id; stack.push(n); }
        }
      }
      const c = latLonOf(norm([sx, sy, sz]));
      out.push({ id, name: "", kind: "island", cells, areaPct: 0, lat: c.lat, lon: c.lon });
      void area;
    }
    let totArea = 0;
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) totArea += Math.cos(((0.5 - (j + 0.5) / GH) * Math.PI));
    const areas = new Float64Array(out.length);
    for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const g = grid[j * GW + i]; if (g >= 0) areas[g] += Math.cos(((0.5 - (j + 0.5) / GH) * Math.PI)); }
    out.forEach((c, k) => { c.areaPct = (areas[k] / totArea) * 100; c.kind = c.areaPct > 2.5 ? "continent" : "island"; });
    // tri : les plus grandes d'abord ; noms déterministes
    const order = out.map((c, k) => k).sort((a, b) => areas[b] - areas[a]);
    const remap = new Int16Array(out.length);
    order.forEach((old, nw) => { remap[old] = nw; });
    const sorted = order.map((old, nw) => ({ ...out[old], id: nw, name: nameOf(this.seed, nw + 1) }));
    for (let i = 0; i < grid.length; i++) if (grid[i] >= 0) grid[i] = remap[grid[i]];
    this.contGrid = grid;
    this.contCache = sorted;
    return sorted;
  }
  /** Continent (ou île) sous une direction ; null en mer. */
  continentAt(d: Vec3): Continent | null {
    const list = this.continents();
    const { GW, GH } = Planet;
    const { lat, lon } = latLonOf(d);
    const i = Math.min(GW - 1, Math.max(0, Math.floor((lon / TAU + 0.5) * GW))), j = Math.min(GH - 1, Math.max(0, Math.floor((0.5 - lat / Math.PI) * GH)));
    const g = this.contGrid![j * GW + i];
    return g >= 0 ? list[g] : null;
  }
  landFraction(): number {
    let land = 0, tot = 0;
    const N = 4000, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) { const y = 1 - (2 * (i + 0.5)) / N, q = Math.sqrt(1 - y * y), a = ga * i; tot++; if (this.height([q * Math.cos(a), y, q * Math.sin(a)]) > 0.01) land++; }
    return land / tot;
  }

  // ---------------------------------------------------------------- lecture du monde simulé (dérivée, jamais dupliquée)

  /** Colonies d'une région : villes vivantes du moteur avec leurs coordonnées géographiques. Une ville détruite disparaît d'elle-même. */
  settlements(sim: SimulationEngine, r: Region): Settlement[] {
    return sim.cities.map((c) => {
      const civ = sim.civById.get(c.civ);
      const g = this.localToLatLon(r, c.x + 0.5, c.y + 0.5);
      return { id: c.id, region: r.id, name: c.name, civ: c.civ, civName: civ?.name ?? "?", color: civ?.color ?? 0xcccccc, pop: c.pop, capital: !!civ && civ.capital === c.id, x: c.x + 0.5, y: c.y + 0.5, lat: g.lat, lon: g.lon };
    });
  }
  /** Synthèse d'une région pour la vue planétaire : population, civilisations, développement. */
  summary(sim: SimulationEngine, r: Region): RegionSummary {
    const civs = sim.civs.filter((c) => c.alive);
    return {
      region: r.id, name: r.name,
      population: sim.citizens.length,
      cities: sim.cities.length,
      civs: civs.map((c) => ({ id: c.id, name: c.name, color: c.color, pop: c.pop, era: c.era, cities: sim.cities.filter((k) => k.civ === c.id).length })),
      maxEra: civs.reduce((m, c) => Math.max(m, c.era), 0),
      year: sim.year,
    };
  }

  serialize(): { seed: number; gen: number; scale: number; regions: Region[] } { return { seed: this.seed, gen: this.gen, scale: this.scale, regions: this.regions.map((r) => ({ ...r })) }; }
  /** Restaure une planète. Une planète sauvegardée sans version est de génération 1 (jamais régénérée) ; sans planète du tout : génération actuelle. */
  static restore(data: { seed: number; gen?: number; scale?: number; regions: Region[] } | undefined | null, fallbackSeed: number): Planet {
    return data && Array.isArray(data.regions) && data.regions.length ? new Planet(data.seed, data.regions.map((r) => ({ ...r })), data.gen ?? 1, data.scale ?? 1) : Planet.create(fallbackSeed, 64, 1);
  }
}

export interface Settlement { id: number; region: number; name: string; civ: number; civName: string; color: number; pop: number; capital: boolean; x: number; y: number; lat: number; lon: number; }
export interface RegionSummary { region: number; name: string; population: number; cities: number; civs: { id: number; name: string; color: number; pop: number; era: number; cities: number }[]; maxEra: number; year: number; }
