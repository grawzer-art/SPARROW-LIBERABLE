import { BIOME, Planet, noise3, type Vec3 } from "./Planet";
import { TILE_RAD } from "./scale";

/**
 * Géographie continue multi-échelle (pure, déterministe).
 *
 * Hiérarchie d'échelles (rayon de la planète = 1) :
 *   planète  → continents (≈ 0,9 rad de large)
 *   région   → 8 × 8 cartes locales (≈ 13,6°, 512 cases)
 *   LOCAL    → carte de 64 × 64 cases couvrant 1,7° (une case ≈ 0,00046 rad)
 * Une seule fonction `sample(direction, finesse)` décrit le relief, les rivières et les biomes à TOUTES les échelles :
 * les octaves fines ne s'ajoutent que lorsque la finesse demandée les distingue. Le globe, les tuiles de terrain du continent
 * et le terrain des cartes locales échantillonnent donc la même géographie : une montagne, une côte ou un fleuve
 * ne changent jamais de place quand on zoome. Aucun état : tout se déduit de la graine de la planète.
 */
export { LOCAL_SPAN_DEG, LOCAL_SPAN_RAD, TILE_RAD, REGION_CELLS } from "./scale";

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface GeoSample {
  /** altitude en unités de case de la carte locale (négatif : fond marin) */
  h: number;
  /** intensité de rivière 0..1 */
  riv: number;
  /** biome (BIOME.*) */
  bio: number;
  /** altitude planétaire normalisée (même unité que Planet.height, détail compris) */
  hp: number;
}

/** Conversion altitude planétaire → altitude en cases (identique à la génération des cartes locales). */
export function tileHeight(hp: number): number {
  return hp > 0 ? 0.02 + hp * 3.85 : -0.15 - Math.min(0.9, -hp * 3.2);
}

export class Geo {
  constructor(readonly planet: Planet) {}

  /** Échantillonne la géographie. `minWave` : plus petite longueur d'onde utile (radians) ; 0,0004 ≈ une case. */
  sample(d: Vec3, minWave: number, out: GeoSample): GeoSample {
    const s = this.planet.seed;
    const hp0 = this.planet.height(d);
    let hp = hp0;
    const land = sstep(-0.3, 0.06, hp0);
    // relief de détail : octaves de 0,045 rad (≈ 100 cases) jusqu'à la finesse demandée
    if (land > 0) {
      let f = 22, A = 0.11;
      for (let k = 0; k < 9 && 1 / f >= minWave * 1.4; k++, f *= 2, A *= 0.62) {
        hp += (noise3(d[0] * f + 7.13 * k, d[1] * f - 3.7 * k, d[2] * f + 1.9 * k, s + 700 + k) - 0.5) * 2 * A * land;
      }
    }
    // chaînes de montagnes : crêtes à l'intérieur des terres élevées
    const m = sstep(0.18, 0.5, hp0);
    if (m > 0) {
      let f = 12, A = 0.3;
      for (let j = 0; j < 4 && 1 / f >= minWave * 1.4; j++, f *= 2, A *= 0.6) {
        const n = noise3(d[0] * f + 31.7 * j, d[1] * f + 11.3 * j, d[2] * f - 5.9 * j, s + 800 + j), r = 1 - Math.abs(2 * n - 1);
        hp += r * r * A * m;
      }
    }
    // rivières (stylisées) : lignes de niveau d'un champ de bruit déformé ; elles creusent leur vallée
    let riv = 0;
    if (hp0 > 0.01 && minWave < 0.06) {
      const wx = (noise3(d[0] * 4.5 + 3, d[1] * 4.5, d[2] * 4.5, s + 880) - 0.5) * 0.2, wy = (noise3(d[0] * 4.5, d[1] * 4.5 + 9, d[2] * 4.5, s + 881) - 0.5) * 0.2, wz = (noise3(d[0] * 4.5, d[1] * 4.5, d[2] * 4.5 + 17, s + 882) - 0.5) * 0.2;
      const qx = d[0] + wx, qy = d[1] + wy, qz = d[2] + wz;
      let rn = 0, a = 0.5, f = 7, tot = 0;
      for (let i = 0; i < 3; i++, a *= 0.5, f *= 2.03) { rn += a * noise3(qx * f, qy * f, qz * f, s + 900 + i * 31); tot += a; }
      rn /= tot;
      const dd = Math.abs(rn - 0.5), width = 0.02;
      riv = (1 - sstep(width * 0.3, width, dd)) * sstep(0.015, 0.07, hp);
      if (riv > 0) hp -= riv * Math.min(0.5 * Math.max(hp, 0) + 0.02, 0.07);
    }
    out.hp = hp;
    out.h = tileHeight(hp);
    out.riv = riv;
    let b = this.planet.biomeOf(d, hp);
    if (riv > 0.25 && (b === BIOME.desert || b === BIOME.savanna || b === BIOME.tundra)) b = BIOME.grass; // les vallées fluviales verdissent
    out.bio = b;
    return out;
  }

  /** Couleur stylisée (même palette que le globe) ; `shade` : variation de teinte fine. */
  color(d: Vec3, smp: GeoSample, out: [number, number, number]): void {
    const c = this.planet.colorAt(d, smp.hp, out);
    void c;
    if (smp.riv > 0.35 && smp.h > 0.05) { // lit de rivière
      const k = Math.min(1, (smp.riv - 0.35) / 0.4);
      out[0] = lerp(out[0], 0.2, k); out[1] = lerp(out[1], 0.52, k); out[2] = lerp(out[2], 0.72, k);
    }
  }

  /** Hauteur de la carte locale en un point (cases), à la finesse d'une case. */
  tileHeightAt(d: Vec3, scratch: GeoSample = { h: 0, riv: 0, bio: 0, hp: 0 }): number {
    return this.sample(d, TILE_RAD * 1.5, scratch).h;
  }
}
