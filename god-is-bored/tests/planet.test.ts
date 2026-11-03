import { describe, expect, it } from "vitest";
import { Planet, dirOf, frameAt, type Vec3 } from "../src/sim/Planet";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { SaveManager } from "../src/sim/SaveManager";

const dist = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

describe("Planète : génération reproductible", () => {
  it("la même graine donne la même planète, une autre graine une autre", () => {
    const a = Planet.create(42), b = Planet.create(42), c = Planet.create(43);
    expect(b.regions).toEqual(a.regions);
    const d = dirOf(0.3, 1.1);
    expect(b.height(d)).toBe(a.height(d));
    expect(c.height(d)).not.toBe(a.height(d));
    expect(c.regions[0].lat === a.regions[0].lat && c.regions[0].lon === a.regions[0].lon).toBe(false);
  });
  it("plusieurs continents, des îles et des océans (30 % de terres environ)", () => {
    for (const seed of [42, 7, 99, 555]) {
      const p = Planet.create(seed);
      const f = p.landFraction();
      expect(f, `terres ${seed}`).toBeGreaterThan(0.15);
      expect(f).toBeLessThan(0.45);
      const cs = p.continents();
      expect(cs.filter((c) => c.kind === "continent").length, `continents ${seed}`).toBeGreaterThanOrEqual(2);
      expect(cs.filter((c) => c.kind === "island").length, `îles ${seed}`).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < cs.length; i++) expect(cs[i - 1].areaPct).toBeGreaterThanOrEqual(cs[i].areaPct);
      expect(new Set(cs.map((c) => c.name)).size).toBeGreaterThan(cs.length * 0.6);
    }
  });
  it("le relief est continu et contient montagnes, plaines et fonds marins", () => {
    const p = Planet.create(42);
    let max = -9, min = 9, jump = 0;
    for (let i = 0; i < 4000; i++) {
      const lon = (i / 4000) * 6.28, lat = Math.sin(i * 0.7) * 1.2;
      const h = p.height(dirOf(lat, lon)), h2 = p.height(dirOf(lat, lon + 0.002));
      max = Math.max(max, h); min = Math.min(min, h); jump = Math.max(jump, Math.abs(h - h2));
    }
    expect(max).toBeGreaterThan(0.4);
    expect(min).toBeLessThan(-0.3);
    expect(jump).toBeLessThan(0.08);
  });
  it("les biomes sont variés", () => {
    const p = Planet.create(42), seen = new Set<number>();
    for (let i = 0; i < 6000; i++) { const lat = Math.asin(1 - (2 * (i + 0.5)) / 6000), lon = i * 2.399; const d = dirOf(lat, lon); seen.add(p.biomeOf(d, p.height(d))); }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });
});

describe("Planète : région d'origine et coordonnées", () => {
  const p = Planet.create(42, 64, 1), r = p.regions[0];
  it("la carte d'origine est la région R1, au large d'une côte", () => {
    expect(r.id).toBe(1);
    expect(r.size).toBe(64);
    const f = frameAt(p.regionCenter(r));
    let sea = 0, tot = 0;
    for (let u = -3; u <= 3; u++) for (let v = -3; v <= 3; v++) { const sr = p.spanRad(r) / 7; const d: Vec3 = [f.c[0] + (f.e[0] * u + f.s[0] * v) * sr, f.c[1] + (f.e[1] * u + f.s[1] * v) * sr, f.c[2] + (f.e[2] * u + f.s[2] * v) * sr]; const l = Math.hypot(...d); tot++; if (p.height([d[0] / l, d[1] / l, d[2] / l]) < 0) sea++; }
    expect(sea / tot).toBeGreaterThan(0.7);
    expect(p.heightWithRegions(p.regionCenter(r))).toBeLessThan(-0.2); // creusée sous la carte réelle
  });
  it("local -> global -> local : aller-retour exact, axes cohérents (x : est, y : sud)", () => {
    for (const [x, y] of [[0, 0], [10.5, 40.25], [32, 32], [63.9, 3], [20, 20]]) {
      const d = p.localToDir(r, x, y);
      expect(Math.hypot(...d)).toBeCloseTo(1, 9);
      const b = p.dirToLocal(r, d)!;
      expect(b.x).toBeCloseTo(x, 6); expect(b.y).toBeCloseTo(y, 6);
    }
    const f = frameAt(p.regionCenter(r));
    const c = p.localToDir(r, 32, 32), e = p.localToDir(r, 40, 32), s = p.localToDir(r, 32, 40);
    const de = [e[0] - c[0], e[1] - c[1], e[2] - c[2]], ds = [s[0] - c[0], s[1] - c[1], s[2] - c[2]];
    expect(de[0] * f.e[0] + de[1] * f.e[1] + de[2] * f.e[2]).toBeGreaterThan(0);
    expect(ds[0] * f.s[0] + ds[1] * f.s[1] + ds[2] * f.s[2]).toBeGreaterThan(0);
    // une case = spanRad / size radians au centre
    expect(dist(p.localToDir(r, 32, 32), p.localToDir(r, 33, 32))).toBeCloseTo(p.tileScale(r), 4);
  });
  it("le repère local en un point est orthonormé", () => {
    const f = frameAt(dirOf(0.6, -1.4));
    const d = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(d(f.e, f.c)).toBeCloseTo(0, 9); expect(d(f.e, f.s)).toBeCloseTo(0, 9); expect(d(f.c, f.s)).toBeCloseTo(0, 9);
    expect(d(f.e, f.e)).toBeCloseTo(1, 9);
  });
});

describe("Planète : un seul monde (le globe lit le moteur)", () => {
  it("les colonies du globe sont les villes du moteur, avec les mêmes identifiants", () => {
    const sim = SimulationEngine.create(42);
    sim.runYears(40);
    const r = sim.planet.regions[0];
    const st = sim.planet.settlements(sim, r);
    expect(st.length).toBe(sim.cities.length);
    expect(st.map((s) => s.id).sort()).toEqual(sim.cities.map((c) => c.id).sort());
    const center = sim.planet.regionCenter(r);
    for (const s of st) { expect(s.region).toBe(1); expect(dist(dirOf(s.lat, s.lon), center)).toBeLessThan(sim.planet.spanRad(r)); }
  });
  it("une ville détruite localement disparaît du globe", () => {
    const sim = SimulationEngine.create(42);
    sim.runYears(30);
    const before = sim.planet.settlements(sim, sim.planet.regions[0]);
    const victim = before[0];
    sim.cities = sim.cities.filter((c) => c.id !== victim.id); // destruction côté moteur
    const after = sim.planet.settlements(sim, sim.planet.regions[0]);
    expect(after.length).toBe(before.length - 1);
    expect(after.find((s) => s.id === victim.id)).toBeUndefined();
  });
  it("la synthèse d'une région suit l'évolution réelle de la simulation, sans caméra", () => {
    const sim = SimulationEngine.create(42);
    const a = sim.planet.summary(sim, sim.planet.regions[0]);
    sim.runYears(80);
    const b = sim.planet.summary(sim, sim.planet.regions[0]);
    expect(a.civs.length).toBeGreaterThanOrEqual(3);
    expect(b.population).toBe(sim.citizens.length);
    expect(b.population).not.toBe(a.population);
    expect(b.year).toBeGreaterThan(a.year);
    expect(b.civs.reduce((s, c) => s + c.pop, 0)).toBe(b.population);
  });
  it("la planète survit à la sauvegarde ; une ancienne sauvegarde la régénère à l'identique", () => {
    const sim = SimulationEngine.create(7);
    sim.runYears(10);
    const copy = SaveManager.deserialize(SaveManager.serialize(sim));
    expect(copy.planet.regions).toEqual(sim.planet.regions);
    const old = JSON.parse(SaveManager.serialize(sim)); delete old.planet;
    const legacy = SaveManager.deserialize(JSON.stringify(old));
    expect(legacy.planet.regions).toEqual(sim.planet.regions);
    const d = dirOf(0.2, 0.9);
    expect(legacy.planet.height(d)).toBe(sim.planet.height(d));
  });
});
