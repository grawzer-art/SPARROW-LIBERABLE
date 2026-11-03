import { Geo, type GeoSample } from "./Geo";
import { TILE_RAD } from "./scale";
import { BIOME, type Planet, type Region } from "./Planet";
import { RNG, fbm } from "./rng";
import { T, World } from "./World";

/**
 * Terrain local d'une région, DÉRIVÉ du globe : chaque case échantillonne l'altitude et le biome de la planète à sa position
 * géographique (projection de la région). Reproductible (graine de la région) : une forêt du globe est une région forestière en local,
 * un désert un désert, un continent d'altitude un massif. Aucune coordonnée arbitraire.
 */
export function generateRegionWorld(planet: Planet, region: Region): World {
  if (region.geo) return generateGeoWorld(planet, region);
  const w = new World();
  const n = w.size;
  const seed = (region.seed ?? 1) >>> 0;
  w.seed = seed; w.seedUsed = seed;
  const rng = new RNG(seed ^ 0x51ed270b);
  const s1 = (seed & 0xffff) + 11, s2 = ((seed >>> 8) & 0xffff) + 77;
  w.hillH = 1.0; w.mtnH = 2.8;
  const biome = w.biome;
  // relief : altitude planétaire échantillonnée au centre de chaque case + détail local
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      const d = planet.localToDir(region, x + 0.5, y + 0.5);
      const hp = planet.height(d) + (fbm(x / 5, y / 5, s2, 2) - 0.5) * 0.07;
      w.height[i] = hp > 0 ? 0.02 + hp * 3.85 : -0.15 - Math.min(0.9, -hp * 3.2);
      biome[i] = planet.biomeOf(d, hp);
    }
  for (let i = 0; i < n * n; i++) w.retype(i);
  // plages
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (w.type[i] !== T.GRASS || w.height[i] > 0.4) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = x + dx, ty = y + dy;
        if (w.inb(tx, ty) && w.type[ty * n + tx] === T.WATER) { w.type[i] = T.SAND; break; }
      }
    }
  // déserts : sable (peu fertile) ; neige : sol stérile
  for (let i = 0; i < n * n; i++) if (biome[i] === BIOME.desert && (w.type[i] === T.GRASS)) w.type[i] = T.SAND;
  // rivières : des sommets vers la mer (jamais dans le désert ni la glace)
  const peaks: number[] = [];
  for (let i = 0; i < n * n; i++) if ((w.type[i] === T.HILL || w.type[i] === T.MOUNTAIN) && biome[i] !== BIOME.snow) peaks.push(i);
  const nRivers = peaks.length > 20 ? 2 + rng.int(2) : 0;
  for (let r = 0; r < nRivers; r++) {
    let cur = peaks[rng.int(peaks.length)];
    const visited = new Set<number>();
    for (let step = 0; step < 90; step++) {
      visited.add(cur);
      const cx = cur % n, cy = (cur / n) | 0;
      if (w.type[cur] === T.WATER) break;
      if (w.type[cur] !== T.MOUNTAIN) { w.type[cur] = T.RIVER; w.height[cur] = Math.max(0.03, w.height[cur] - 0.22); }
      let best = -1, bh = Infinity;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = cx + dx, ty = cy + dy;
        if (!w.inb(tx, ty)) continue;
        const j = ty * n + tx;
        if (visited.has(j)) continue;
        const hh = w.height[j] + rng.next() * 0.05;
        if (hh < bh) { bh = hh; best = j; }
      }
      if (best < 0) break;
      cur = best;
    }
  }
  // fertilité, arbres, pierre : fonction du biome
  const waterNear = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let c = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
        const tx = x + dx, ty = y + dy;
        if (w.inb(tx, ty)) { const t = w.type[ty * n + tx]; if (t === T.WATER || t === T.RIVER) c++; }
      }
      waterNear[y * n + x] = Math.min(1, c / 10);
    }
  const FERT: Record<number, number> = { [BIOME.grass]: 0.68, [BIOME.forest]: 0.55, [BIOME.jungle]: 0.5, [BIOME.savanna]: 0.42, [BIOME.desert]: 0.1, [BIOME.taiga]: 0.3, [BIOME.tundra]: 0.14, [BIOME.snow]: 0.02, [BIOME.beach]: 0.18, [BIOME.hills]: 0.3 };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x, t = w.type[i], h = w.height[i], b = biome[i];
      let f = 0;
      if (t === T.GRASS || t === T.RIVER) f = (FERT[b] ?? 0.5) + 0.3 * waterNear[i] - Math.max(0, h - 0.8) * 0.25 + (fbm(x / 8, y / 8, s2 + 5, 2) - 0.5) * 0.4;
      else if (t === T.SAND) f = b === BIOME.desert ? 0.08 + 0.2 * waterNear[i] : 0.18;
      else if (t === T.HILL) f = 0.3;
      w.fertility[i] = Math.max(0, Math.min(1, f));
      const clump = fbm(x / 7, y / 7, s1 + 900, 3);
      if ((t === T.GRASS || t === T.HILL) && h < 1.9) {
        const dense = b === BIOME.forest ? 0.38 : b === BIOME.jungle ? 0.3 : b === BIOME.taiga ? 0.42 : b === BIOME.grass ? 0.54 : b === BIOME.hills ? 0.52 : 2;
        const spars = b === BIOME.savanna ? 0.04 : b === BIOME.tundra ? 0.02 : b === BIOME.grass ? 0.05 : b === BIOME.snow ? 0 : 0.03;
        if (clump > dense) w.maxTrees[i] = 2 + rng.int(b === BIOME.jungle || b === BIOME.forest ? 4 : 3);
        else if (rng.chance(spars)) w.maxTrees[i] = 1;
        w.trees[i] = w.maxTrees[i];
      }
      if (t === T.HILL) w.stone[i] = 120 + rng.int(80);
      else if (t === T.MOUNTAIN) w.stone[i] = 300;
    }
  w.recomputeCorners();
  w.computeRegions();
  return w;
}

/**
 * Carte locale d'ÉCHELLE 2 : 64 × 64 cases, une case = TILE_RAD, échantillonnées dans la géographie continue (Geo) à la finesse d'une case.
 * Ce sont exactement les altitudes, rivières et biomes que les tuiles de terrain du globe affichent à cet endroit : zéro discontinuité.
 */
export function generateGeoWorld(planet: Planet, region: Region): World {
  const w = new World();
  const n = w.size, geo = new Geo(planet);
  const seed = (region.seed ?? 1) >>> 0;
  w.seed = seed; w.seedUsed = seed;
  const rng = new RNG(seed ^ 0x51ed270b);
  const s1 = (seed & 0xffff) + 11, s2 = ((seed >>> 8) & 0xffff) + 77;
  w.hillH = 1.0; w.mtnH = 2.8;
  const smp: GeoSample = { h: 0, riv: 0, bio: 0, hp: 0 };
  const riv = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x, d = planet.localToDir(region, x + 0.5, y + 0.5);
      geo.sample(d, TILE_RAD * 1.5, smp);
      w.height[i] = smp.h; w.biome[i] = smp.bio; riv[i] = smp.riv;
    }
  for (let i = 0; i < n * n; i++) w.retype(i);
  // rivières : cases d'eau douce là où la rivière géographique traverse la terre
  for (let i = 0; i < n * n; i++) if (riv[i] > 0.5 && w.type[i] !== T.WATER && w.type[i] !== T.MOUNTAIN) { w.type[i] = T.RIVER; w.height[i] = Math.max(0.03, w.height[i] - 0.1); }
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (w.type[i] !== T.GRASS || w.height[i] > 0.4) continue;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const tx = x + dx, ty = y + dy; if (w.inb(tx, ty) && w.type[ty * n + tx] === T.WATER) { w.type[i] = T.SAND; break; } }
    }
  for (let i = 0; i < n * n; i++) if (w.biome[i] === BIOME.desert && w.type[i] === T.GRASS) w.type[i] = T.SAND;
  const waterNear = new Float32Array(n * n);
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      let c = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const tx = x + dx, ty = y + dy; if (w.inb(tx, ty)) { const t = w.type[ty * n + tx]; if (t === T.WATER || t === T.RIVER) c++; } }
      waterNear[y * n + x] = Math.min(1, c / 10);
    }
  const FERT: Record<number, number> = { [BIOME.grass]: 0.68, [BIOME.forest]: 0.55, [BIOME.jungle]: 0.5, [BIOME.savanna]: 0.42, [BIOME.desert]: 0.1, [BIOME.taiga]: 0.3, [BIOME.tundra]: 0.14, [BIOME.snow]: 0.02, [BIOME.beach]: 0.18, [BIOME.hills]: 0.3 };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const i = y * n + x, t = w.type[i], h = w.height[i], b = w.biome[i];
      let f = 0;
      if (t === T.GRASS || t === T.RIVER) f = (FERT[b] ?? 0.5) + 0.3 * waterNear[i] - Math.max(0, h - 0.8) * 0.25 + (fbm(x / 8, y / 8, s2 + 5, 2) - 0.5) * 0.4;
      else if (t === T.SAND) f = b === BIOME.desert ? 0.08 + 0.2 * waterNear[i] : 0.18;
      else if (t === T.HILL) f = 0.3;
      w.fertility[i] = Math.max(0, Math.min(1, f));
      const clump = fbm(x / 7, y / 7, s1 + 900, 3);
      if ((t === T.GRASS || t === T.HILL) && h < 1.9) {
        const dense = b === BIOME.forest ? 0.38 : b === BIOME.jungle ? 0.3 : b === BIOME.taiga ? 0.42 : b === BIOME.grass ? 0.54 : b === BIOME.hills ? 0.52 : 2;
        const spars = b === BIOME.savanna ? 0.04 : b === BIOME.tundra ? 0.02 : b === BIOME.grass ? 0.05 : b === BIOME.snow ? 0 : 0.03;
        if (clump > dense) w.maxTrees[i] = 2 + rng.int(b === BIOME.jungle || b === BIOME.forest ? 4 : 3);
        else if (rng.chance(spars)) w.maxTrees[i] = 1;
        w.trees[i] = w.maxTrees[i];
      }
      if (t === T.HILL) w.stone[i] = 120 + rng.int(80);
      else if (t === T.MOUNTAIN) w.stone[i] = 300;
    }
  w.recomputeCorners();
  w.computeRegions();
  return w;
}
