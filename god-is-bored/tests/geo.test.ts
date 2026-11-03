import { describe, expect, it } from "vitest";
import { Geo, type GeoSample } from "../src/sim/Geo";
import { Planet, type Vec3 } from "../src/sim/Planet";
import { PlanetSim } from "../src/sim/PlanetSim";
import { TILE_RAD } from "../src/sim/scale";
import { GRID, buildChunkData, faceDir } from "../src/sim/terrainChunk";
import { SimulationEngine } from "../src/sim/SimulationEngine";

const smp = (): GeoSample => ({ h: 0, riv: 0, bio: 0, hp: 0 });

describe("Géographie continue (Geo)", () => {
  it("est déterministe : même graine, mêmes altitudes", () => {
    const a = new Geo(Planet.create(42)), b = new Geo(Planet.create(42));
    const d: Vec3 = [0.3, 0.2, Math.sqrt(1 - 0.13)];
    expect(a.sample(d, TILE_RAD, smp()).h).toBe(b.sample(d, TILE_RAD, smp()).h);
  });
  it("une même position donne la même altitude à toutes les échelles (écart borné par le détail non résolu)", () => {
    const g = new Geo(Planet.create(7));
    let worst = 0;
    for (let k = 0; k < 200; k++) {
      const a = k * 0.37, z = Math.sin(k * 1.3) * 0.8, q = Math.sqrt(1 - z * z);
      const d: Vec3 = [q * Math.cos(a), z, q * Math.sin(a)];
      const fine = g.sample(d, TILE_RAD, smp()), coarse = g.sample(d, 0.05, smp());
      worst = Math.max(worst, Math.abs(fine.hp - coarse.hp));
      expect(fine.hp > 0.0 && coarse.hp < -0.15).toBe(false); // jamais terre en fin et mer profonde en grossier
    }
    expect(worst).toBeLessThan(0.45);
  });
  it("les tuiles voisines partagent leurs sommets de bord (aucune fissure à niveau égal)", () => {
    const g = new Geo(Planet.create(42));
    const A = buildChunkData(g, 0, 3, 2, 2), B = buildChunkData(g, 0, 3, 3, 2);
    for (let b = 0; b < GRID; b++) expect(A.h[b * GRID + GRID - 1]).toBeCloseTo(B.h[b * GRID], 6);
  });
  it("la carte locale d'une région est une tranche de la géographie (mêmes altitudes que l'échantillonnage direct)", () => {
    const ps = PlanetSim.create(42), r = ps.planet.regions[0], w = ps.engines.get(r.id)!.world, g = new Geo(ps.planet);
    for (const [x, y] of [[5, 7], [30, 30], [58, 12]]) {
      const d = ps.planet.localToDir(r, x + 0.5, y + 0.5);
      expect(w.height[y * w.size + x]).toBeCloseTo(g.sample(d, TILE_RAD * 1.5, smp()).h, 3);
    }
    void faceDir;
  });
  it("hiérarchie : un continent contient plusieurs régions de plusieurs villages à leur échelle", () => {
    const p = Planet.create(42);
    expect(p.scale).toBe(2);
    expect(p.cellSpanDeg).toBeCloseTo(1.7, 5);
    const ps = PlanetSim.create(42), e = ps.engines.get(1)!;
    expect(e.cities.length).toBeGreaterThanOrEqual(2);
    // les villes d'une même carte tiennent dans 1,7° (≈ 3 km par case) : un village est une petite partie de la région (13,6°)
    const r = ps.planet.regions[0];
    expect(r.size).toBe(64);
  });
  it("PlanetSim.create fonctionne pour plusieurs graines", () => {
    for (const s of [1, 2, 3, 99, 2024]) {
      const ps = PlanetSim.create(s);
      expect(ps.totals().inhabited).toBeGreaterThanOrEqual(1);
      expect(ps.engines.get(1)!.civs.length).toBeGreaterThanOrEqual(2);
    }
  }, 60000);
  it("aller-retour de sauvegarde : positions et populations conservées", () => {
    const ps = PlanetSim.create(42);
    ps.runYears(3);
    const before = [...ps.engines.values()].map((e) => ({ id: e.regionId, pop: e.citizens.length, c: e.cities.map((c) => [c.name, c.x, c.y]) }));
    const back = PlanetSim.deserialize(ps.serialize());
    for (const b of before) {
      const e = back.engines.get(b.id)!;
      expect(e.citizens.length).toBe(b.pop);
      expect(e.cities.map((c) => [c.name, c.x, c.y])).toEqual(b.c);
    }
  }, 60000);
  it("ancienne sauvegarde (échelle 1) : migration explicite sans déplacer villes ni habitants", () => {
    const eng = SimulationEngine.create(42);
    eng.runYears(2);
    const pop = eng.citizens.length, cities = eng.cities.map((c) => [c.name, c.x, c.y]);
    const ps = PlanetSim.deserialize(JSON.stringify(JSON.parse(PlanetSim.fromEngine(eng).serialize())));
    expect(ps.planet.scale).toBe(1);
    expect(ps.migrateScale()).toBe(true);
    expect(ps.planet.scale).toBe(2);
    expect(ps.migrateScale()).toBe(false);
    const e = ps.engines.get(1)!;
    expect(e.citizens.length).toBe(pop);
    expect(e.cities.map((c) => [c.name, c.x, c.y])).toEqual(cities);
    const re = PlanetSim.deserialize(ps.serialize());
    expect(re.planet.scale).toBe(2);
    expect(re.engines.get(1)!.citizens.length).toBe(pop);
  }, 60000);
});
