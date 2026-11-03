import { describe, expect, it } from "vitest";
import { BIOME, Planet, dirOf, type Vec3 } from "../src/sim/Planet";
import { PlanetSim } from "../src/sim/PlanetSim";
import { SaveManager } from "../src/sim/SaveManager";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { generateRegionWorld } from "../src/sim/WorldGen";
import { T } from "../src/sim/World";

const ang = (a: Vec3, b: Vec3) => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));

describe("Planète v2 : un monde complet", () => {
  it("4 à 6 grandes masses continentales distinctes, des archipels, 28–42 % de terres", () => {
    for (const seed of [42, 7, 99, 555, 1234, 31337]) {
      const p = Planet.create(seed), cs = p.continents();
      const big = cs.filter((c) => c.areaPct > 2.5);
      expect(big.length, `continents ${seed}`).toBeGreaterThanOrEqual(4);
      expect(big.length).toBeLessThanOrEqual(7);
      expect(cs.filter((c) => c.areaPct <= 2.5).length, `îles ${seed}`).toBeGreaterThanOrEqual(2);
      const f = p.landFraction();
      expect(f, `terres ${seed}`).toBeGreaterThan(0.26);
      expect(f).toBeLessThan(0.44);
      expect(p.gen).toBe(2);
    }
  });
  it("les océans sont continus : aucun continent ne touche un autre (centres séparés par la mer)", () => {
    const p = Planet.create(42), big = p.continents().filter((c) => c.areaPct > 2.5);
    for (let i = 0; i < big.length; i++) for (let j = i + 1; j < big.length; j++) expect(ang(dirOf(big[i].lat, big[i].lon), dirOf(big[j].lat, big[j].lon))).toBeGreaterThan(0.45);
  });
  it("les biomes sont variés ; la neige reste rare hors pôles et sommets (lisibilité)", () => {
    const p = Planet.create(42), seen = new Set<number>();
    let land = 0, snow = 0;
    for (let i = 0; i < 8000; i++) {
      const lat = Math.asin(1 - (2 * (i + 0.5)) / 8000), d = dirOf(lat, i * 2.399), h = p.height(d);
      if (h <= 0.01) continue;
      land++;
      const b = p.biomeOf(d, h); seen.add(b);
      if (b === BIOME.snow) snow++;
    }
    expect(seen.size).toBeGreaterThanOrEqual(8);
    expect(snow / land).toBeLessThan(0.14);
  });
  it("MIGRATION : une planète de génération 1 (parties existantes) n'est jamais régénérée", () => {
    // valeurs d'or relevées sur la version précédente (Living Planet T1)
    const gold: Record<number, { lat: number; lon: number; h: number[]; land: number }> = {
      42: { lat: -0.55598, lon: 2.58019, h: [-0.36758, 0.76893, 0.2735, -0.62198, -0.2945, -0.27651, -0.01764, -0.3582, 0.67312, -0.50273, -0.57276, 0.16124], land: 0.2985 },
      7: { lat: 0.55337, lon: 2.25416, h: [0.09186, -0.42897, -0.24531, -0.42325, -0.28259, 0.54247, -0.40968, -0.11744, -0.59597, 0.03828, -0.43164, -0.16825], land: 0.2335 },
    };
    for (const seed of [42, 7]) {
      const p = new Planet(seed, undefined, 1);
      expect(p.gen).toBe(1);
      expect(p.regions[0].lat).toBeCloseTo(gold[seed].lat, 4); expect(p.regions[0].lon).toBeCloseTo(gold[seed].lon, 4);
      gold[seed].h.forEach((v, i) => expect(p.height(dirOf(Math.sin(i * 1.7) * 1.2, i * 0.9))).toBeCloseTo(v, 4));
      expect(p.landFraction()).toBeCloseTo(gold[seed].land, 3);
    }
    // une planète sauvegardée sans version est de génération 1 ; sans planète du tout : génération actuelle
    expect(Planet.restore({ seed: 42, regions: new Planet(42, undefined, 1).regions }, 42).gen).toBe(1);
    expect(Planet.restore(undefined, 42).gen).toBe(2);
  });
});

describe("Régions dérivées du relief du globe", () => {
  const p = Planet.create(42);
  const land = (() => { for (let i = 0; i < 4000; i++) { const lat = Math.asin(1 - (2 * (i + 0.5)) / 4000), d = dirOf(lat, i * 2.399); if (p.height(d) > 0.05 && !p.regionAt(d, 20) && Math.abs(lat) < 1.0) return d; } return dirOf(0, 0); })();
  it("toute terre émergée appartient à une région explorable, stable et persistante ; la mer n'en a pas", () => {
    const r1 = p.ensureRegionAt(land)!, r2 = p.ensureRegionAt(land)!;
    expect(r1).toBeTruthy();
    expect(r2.id).toBe(r1.id);
    expect(r1.derived).toBe(true);
    expect(r1.name.length).toBeGreaterThan(5);
    expect(p.regions.filter((r) => r.id === r1.id).length).toBe(1);
    // un point voisin tombe dans la même cellule ou une voisine, jamais dans une région à l'identité instable
    const again = p.ensureRegionAt(land)!;
    expect(again.lat).toBe(r1.lat); expect(again.lon).toBe(r1.lon);
    let sea: Vec3 | null = null;
    for (let i = 0; i < 400 && !sea; i++) { const d = dirOf(Math.sin(i) * 1.2, i * 0.7); if (p.height(d) < -0.1 && !p.regionAt(d, 3)) sea = d; }
    expect(p.ensureRegionAt(sea!)).toBeNull();
  });
  it("le terrain local est reproductible et suit le relief du globe", () => {
    const r = p.ensureRegionAt(land)!;
    const a = generateRegionWorld(p, r), b = generateRegionWorld(p, r);
    expect(Array.from(b.height)).toEqual(Array.from(a.height));
    expect(Array.from(b.trees)).toEqual(Array.from(a.trees));
    let agree = 0, tot = 0;
    for (let y = 0; y < 64; y += 3) for (let x = 0; x < 64; x += 3) {
      const planetLand = p.height(p.localToDir(r, x + 0.5, y + 0.5)) > 0.04, localLand = a.type[y * 64 + x] !== T.WATER; tot++;
      if (planetLand === localLand) agree++;
    }
    expect(agree / tot).toBeGreaterThan(0.9);
  });
  it("forêt du globe = région forestière locale ; désert = sable stérile ; glace = sol stérile", () => {
    const find = (want: number[]): Vec3 | null => {
      for (let i = 0; i < 20000; i++) {
        const lat = Math.asin(1 - (2 * (i + 0.5)) / 20000), lon = i * 2.399;
        if (Math.abs(lat) > 1.05) continue;
        const d = dirOf(lat, lon), h = p.height(d);
        if (h > 0.05 && want.includes(p.biomeOf(d, h)) && !p.regionAt(d, 20)) {
          // la région entière doit être homogène : on vérifie plusieurs points de l'emprise
          const st = p.footprintStats(lat, lon);
          if (st.land > 0.9) return d;
        }
      }
      return null;
    };
    const stats = (d: Vec3) => { const r = p.ensureRegionAt(d)!; const w = generateRegionWorld(p, r); let trees = 0, fert = 0, land = 0; for (let i = 0; i < 4096; i++) if (w.type[i] !== T.WATER) { land++; trees += w.trees[i]; fert += w.fertility[i]; } return { trees: trees / Math.max(1, land), fert: fert / Math.max(1, land), land }; };
    const forest = find([BIOME.forest, BIOME.jungle]), desert = find([BIOME.desert]);
    expect(forest).not.toBeNull();
    const sf = stats(forest!);
    expect(sf.trees).toBeGreaterThan(0.8);
    if (desert) { const sd = stats(desert); expect(sd.fert).toBeLessThan(sf.fert); expect(sd.trees).toBeLessThan(sf.trees * 0.6); }
  });
});

describe("Planète vivante : plusieurs régions, une simulation par région", () => {
  it("une nouvelle partie répartit les civilisations sur plusieurs continents", () => {
    const ps = PlanetSim.create(42);
    const inh = [...ps.engines.values()].filter((e) => ps.isInhabited(e));
    expect(inh.length).toBeGreaterThanOrEqual(2);
    const civs = inh.flatMap((e) => e.civs);
    expect(civs.length).toBeGreaterThanOrEqual(4);
    expect(new Set(civs.map((c) => c.color)).size).toBe(civs.length); // couleurs uniques sur la planète
    const [r1, r2] = [ps.planet.regions[0], ps.planet.regions.find((r) => r.inhabited && r.id !== 1)!];
    expect(ang(ps.planet.regionCenter(r1), ps.planet.regionCenter(r2))).toBeGreaterThan(0.9);
    for (const e of inh) { expect(e.citizens.length).toBeGreaterThan(10); expect(e.buildings.length).toBeGreaterThan(0); expect(e.civs.every((c) => c.food > 0 && c.techs.length >= 0)).toBe(true); }
  });
  it("les civilisations évoluent partout, quelle que soit la région observée (indépendance de la caméra)", () => {
    const a = PlanetSim.create(7), b = PlanetSim.create(7);
    const other = [...b.engines.keys()].find((id) => id !== 1)!;
    b.setActive(other); // observer l'autre continent
    for (let t = 0; t < 40 * 30; t++) { a.advance(100); b.advance(100); }
    const snap = (ps: PlanetSim) => [...ps.engines.entries()].map(([id, e]) => `${id}:${e.citizens.length}:${e.civs.map((c) => c.era + "/" + c.tech).join(",")}:${e.tick}`).join("|");
    expect(snap(b)).toBe(snap(a));
    for (const e of a.engines.values()) if (a.isInhabited(e)) expect(e.year).toBeGreaterThan(30);
    const t = a.totals();
    expect(t.inhabited).toBeGreaterThanOrEqual(2);
    expect(t.population).toBeGreaterThan(100);
  });
  it("une région inhabitée est créée à la première visite, déterministe, et garde ses modifications", () => {
    const ps = PlanetSim.create(42), p = ps.planet;
    let d: Vec3 | null = null;
    for (let i = 0; i < 4000 && !d; i++) { const lat = Math.asin(1 - (2 * (i + 0.5)) / 4000), c = dirOf(lat, i * 2.399); if (p.height(c) > 0.1 && Math.abs(lat) < 1 && !p.regionAt(c, 20)) d = c; }
    const r = p.ensureRegionAt(d!)!;
    expect(ps.engineOf(r.id)).toBeUndefined();
    const e = ps.ensure(r.id);
    expect(ps.isInhabited(e)).toBe(false);
    expect(e.citizens.length).toBe(0);
    e.world.crater(32, 32, 4); // une modification (météorite)
    const r3 = (a: Float32Array) => Array.from(a, (v) => Math.round(v * 1000) / 1000); // la sauvegarde arrondit les altitudes au millième
    const hAfter = r3(e.world.height);
    const copy = PlanetSim.deserialize(ps.serialize());
    expect(r3(copy.engineOf(r.id)!.world.height)).toEqual(hAfter);
    expect(copy.planet.regions.map((x) => x.id).sort()).toEqual(ps.planet.regions.map((x) => x.id).sort());
  });
  it("sauvegarde : mêmes régions, mêmes populations, mêmes identités ; la simulation reprend à l'identique", () => {
    const ps = PlanetSim.create(42);
    ps.runYears(25);
    const copy = PlanetSim.deserialize(ps.serialize());
    expect([...copy.engines.keys()].sort()).toEqual([...ps.engines.keys()].sort());
    for (const [id, e] of ps.engines) {
      const c = copy.engineOf(id)!;
      expect(c.citizens.length).toBe(e.citizens.length);
      expect(c.civs.map((x) => x.name)).toEqual(e.civs.map((x) => x.name));
      expect(c.citizens.map((x) => x.name + x.id)).toEqual(e.citizens.map((x) => x.name + x.id));
      expect(c.regionId).toBe(id);
    }
    expect(copy.planet.gen).toBe(ps.planet.gen);
    ps.runYears(5); copy.runYears(5);
    for (const [id, e] of ps.engines) expect(copy.engineOf(id)!.citizens.length).toBe(e.citizens.length);
  });
  it("une ancienne sauvegarde (une seule région, planète de génération 1) se charge intacte", () => {
    const legacy = SimulationEngine.create(42);
    legacy.planet = new Planet(42, undefined, 1);
    legacy.runYears(15);
    const json = JSON.parse(SaveManager.serialize(legacy));
    delete json.planet.gen; // sauvegarde de la version précédente : pas de numéro de génération
    const ps = PlanetSim.deserialize(JSON.stringify(json));
    expect(ps.planet.gen).toBe(1);
    expect(ps.engines.size).toBe(1);
    expect(ps.active.citizens.length).toBe(legacy.citizens.length);
    expect(ps.active.civs.map((c) => c.name)).toEqual(legacy.civs.map((c) => c.name));
    // l'ajout d'un nouveau peuple ne touche pas à Terre Première
    const before = ps.active.citizens.map((c) => c.id).join();
    const added = ps.addInhabitedRegions(1);
    expect(added.length).toBe(1);
    expect(ps.active.citizens.map((c) => c.id).join()).toBe(before);
    expect(ps.engines.size).toBe(2);
  });
  it("coût de calcul : plusieurs régions habitées restent légères", () => {
    const ps = PlanetSim.create(42);
    ps.runYears(30);
    const t0 = performance.now();
    for (let i = 0; i < 60; i++) ps.advance(100);
    const ms = (performance.now() - t0) / 60;
    console.log("PERF-PLANET régions habitées", ps.totals().inhabited, "pop", ps.totals().population, ms.toFixed(2), "ms/tick");
    expect(ms).toBeLessThan(40);
  });
});
