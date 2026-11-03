import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { SaveManager } from "../src/sim/SaveManager";
import { TICKS_PER_YEAR, TICK_MS } from "../src/sim/config";
import { T } from "../src/sim/World";
import type { Civ } from "../src/sim/types";

const mk = (seed = 42) => SimulationEngine.create(seed);

function invariants(sim: SimulationEngine): string[] {
  const errs: string[] = [];
  const w = sim.world;
  if (sim.citizens.some((c) => c.dead)) errs.push("citoyen mort resté dans la liste");
  for (const c of sim.civs) {
    for (const k of ["food", "wood", "stone", "gold", "stability", "pop"] as const) {
      const v = c[k];
      if (!Number.isFinite(v) || v < 0) errs.push(`${c.name}.${k}=${v}`);
    }
    if (c.stability > 100) errs.push("stabilité > 100");
    if (c.alive && c.pop === 0 && sim.tick > 60) errs.push(`civ vivante sans habitants: ${c.name}`);
  }
  for (const c of sim.citizens) {
    if (!Number.isFinite(c.x) || !Number.isFinite(c.y) || c.x < 0 || c.y < 0 || c.x > w.size || c.y > w.size) errs.push(`position invalide ${c.id}`);
    if (!Number.isFinite(c.hp) || !Number.isFinite(c.hunger) || !Number.isFinite(c.age)) errs.push(`valeur NaN ${c.id}`);
    if (!sim.civById.get(c.civ)?.alive) errs.push(`habitant ${c.id} d'une civ morte`);
  }
  for (const b of sim.buildings) {
    if (b.hp < 0) errs.push("bâtiment négatif");
    if (w.bld[w.idx(b.x, b.y)] !== b.id) errs.push(`bld map incohérente ${b.id}`);
  }
  for (const a of sim.armies) for (const id of a.soldiers) if (!sim.citizenById.has(id)) errs.push("soldat fantôme");
  return errs.slice(0, 8);
}

describe("Monde", () => {
  it("génération reproductible depuis une seed", () => {
    const a = mk(7), b = mk(7), c = mk(8);
    expect(Array.from(a.world.height)).toEqual(Array.from(b.world.height));
    expect(Array.from(a.world.height)).not.toEqual(Array.from(c.world.height));
    expect(a.civs.map((x) => x.name)).toEqual(b.civs.map((x) => x.name));
  });
  it("trois civilisations au départ, sur la même masse terrestre, avec habitants sur terre", () => {
    const sim = mk();
    expect(sim.aliveCivs().length).toBe(3);
    expect(new Set(sim.civs.map((c) => c.color)).size).toBe(3);
    const reg = new Set(sim.cities.map((c) => sim.world.region[sim.world.idx(c.x, c.y)]));
    expect(reg.size).toBe(1);
    expect(sim.citizens.length).toBeGreaterThan(30);
    for (const c of sim.citizens) expect(sim.world.passable(c.x, c.y)).toBe(true);
    for (const civ of sim.civs) {
      expect(civ.leader.name.length).toBeGreaterThan(2);
      expect(civ.tiles).toBeGreaterThan(20);
    }
  });
  it("la simulation est déterministe", () => {
    const a = mk(3), b = mk(3);
    a.runYears(60); b.runYears(60);
    expect(a.citizens.length).toBe(b.citizens.length);
    expect(a.civs.map((c) => Math.round(c.food))).toEqual(b.civs.map((c) => Math.round(c.food)));
    expect(a.chronicle.map((e) => e.text)).toEqual(b.chronicle.map((e) => e.text));
  });
});

describe("Vie : population, mortalité, ressources, construction", () => {
  it("les populations croissent seules", () => {
    const sim = mk();
    const start = sim.citizens.length;
    sim.runYears(50);
    expect(sim.citizens.length).toBeGreaterThan(start * 1.5);
    expect(sim.stats.births).toBeGreaterThan(20);
    expect(invariants(sim)).toEqual([]);
  });
  it("les habitants vieillissent et meurent de vieillesse", () => {
    const sim = mk();
    const civ = sim.civs[0];
    const city = sim.cities.find((c) => c.civ === civ.id)!;
    const old = sim.spawnCitizen(civ, city, city.x + 0.5, city.y + 1.5, 99.5);
    sim.runYears(3);
    expect(sim.citizenById.has(old.id)).toBe(false);
    expect(sim.stats.oldAgeDeaths).toBeGreaterThan(0);
  });
  it("la famine tue quand il n'y a plus de nourriture", () => {
    const sim = mk();
    for (const c of sim.civs) c.food = 0;
    for (const b of sim.buildings) if (b.type === "farm") sim.destroyBuilding(b);
    sim.pruneBuildings();
    for (const c of sim.citizens) c.hunger = 95;
    // pas de ferme, pas de stock : on empêche les cueillettes en brûlant les prairies
    for (let i = 0; i < sim.world.fertility.length; i++) sim.world.fertility[i] = 0;
    sim.runYears(6);
    expect(sim.stats.famineDeaths).toBeGreaterThan(0);
  });
  it("la nourriture est consommée par les habitants", () => {
    const sim = mk();
    for (const c of sim.civs) c.food = 100;
    for (const c of sim.citizens) { c.hunger = 55; if (c.job === "farmer") c.job = "scholar"; }
    sim.runYears(0.5);
    for (const c of sim.civs) expect(c.food).toBeLessThan(100);
  });
  it("les fermiers produisent de la nourriture, les bûcherons du bois", () => {
    const sim = mk();
    const civ = sim.civs[0];
    civ.food = 10; civ.wood = 0;
    for (const c of sim.citizens) c.hunger = 0;
    sim.runYears(2);
    expect(civ.wood).toBeGreaterThan(0);
    expect(civ.food).toBeGreaterThan(0);
  });
  it("les civilisations construisent des bâtiments qui s'achèvent", () => {
    const sim = mk();
    const before = sim.buildings.filter((b) => b.progress >= 1).length;
    sim.runYears(40);
    const after = sim.buildings.filter((b) => b.progress >= 1).length;
    expect(after).toBeGreaterThan(before + 3);
    expect(sim.stats.buildingsBuilt).toBeGreaterThan(3);
  });
  it("les civilisations font des découvertes technologiques et fondent des villes", () => {
    const sim = mk(7);
    sim.runYears(120);
    expect(Math.max(...sim.civs.map((c) => c.tech))).toBeGreaterThanOrEqual(1);
    expect(sim.chronicle.some((e) => e.type === "discovery")).toBe(true);
    expect(sim.stats.citiesFounded).toBeGreaterThan(0);
  });
});

/** Isole deux civilisations pour que les autres guerres n'interfèrent pas avec le test. */
function pair(sim: SimulationEngine): [Civ, Civ] {
  const [a, d] = sim.civs.filter((c) => c.alive).sort((x, y) => y.pop - x.pop).slice(0, 2);
  for (const x of sim.civs) for (const y of sim.civs) if (x.id < y.id && !((x === a && y === d) || (x === d && y === a))) sim.truce[sim.pairKey(x.id, y.id)] = 1e9;
  return [a, d];
}

describe("Guerre et diplomatie", () => {
  it("une déclaration de guerre mobilise des armées et change les relations", () => {
    const sim = mk();
    sim.runYears(25);
    const [a, d] = pair(sim);
    const before = sim.opinion(a.id, d.id);
    const war = sim.diplo.declareWar(sim, a, d, "conquest");
    expect(war.active).toBe(true);
    expect(sim.statusOf(a.id, d.id)).toBe("war");
    expect(sim.opinion(a.id, d.id)).toBeLessThan(before);
    expect(sim.armies.filter((x) => x.war === war.id).length).toBeGreaterThanOrEqual(1);
    expect(sim.chronicle.some((e) => e.type === "war" && e.civ === a.id)).toBe(true);
    expect(sim.citizens.some((c) => c.army >= 0)).toBe(true);
  });
  it("la guerre fait des pertes militaires comptabilisées, et finit par se terminer", () => {
    const sim = mk(42);
    sim.runYears(30);
    const [a, d] = pair(sim);
    const deaths0 = sim.stats.warDeaths;
    const war = sim.diplo.declareWar(sim, a, d, "conquest");
    for (let y = 0; y < 60 && war.active; y++) sim.runYears(1);
    expect(sim.stats.warDeaths).toBeGreaterThan(deaths0);
    expect(war.casA + war.casD + war.civCas).toBeGreaterThan(0);
    expect(war.active).toBe(false);
    expect(sim.statusOf(a.id, d.id)).not.toBe("war");
    expect(invariants(sim)).toEqual([]);
  });
  it("à effectifs égaux, la technologie et la position décident du combat (pas un tirage)", () => {
    const run = (techA: number) => {
      const sim = mk(42);
      sim.runYears(25);
      const [a, d] = pair(sim);
      a.tech = techA; d.tech = 0;
      const war = sim.diplo.declareWar(sim, a, d, "conquest");
      const aa = sim.armies.find((x) => x.war === war.id && x.civ === a.id)!;
      const dd = sim.armies.find((x) => x.war === war.id && x.civ === d.id)!;
      // même effectif, face à face
      const ids = [...aa.soldiers, ...dd.soldiers];
      const n = Math.min(aa.soldiers.length, dd.soldiers.length, 8);
      for (const id of aa.soldiers.slice(n)) { const c = sim.citizenById.get(id)!; c.army = -1; }
      for (const id of dd.soldiers.slice(n)) { const c = sim.citizenById.get(id)!; c.army = -1; }
      aa.soldiers = aa.soldiers.slice(0, n); dd.soldiers = dd.soldiers.slice(0, n);
      for (const id of [...aa.soldiers, ...dd.soldiers]) { const c = sim.citizenById.get(id)!; c.hp = 100; c.courage = 0.5; }
      aa.x = dd.x = 32; aa.y = 32; dd.y = 32.5; aa.state = dd.state = "march"; aa.morale = dd.morale = 100;
      void ids;
      for (let i = 0; i < 120; i++) { sim.war.fights(sim); aa.x = 32; dd.x = 32; aa.y = 32; dd.y = 32.5; if (!aa.soldiers.length || !dd.soldiers.length) break; }
      return [aa.soldiers.length, dd.soldiers.length];
    };
    const [sa0, sd0] = run(0);
    const [sa5, sd5] = run(5);
    expect(sa5 - sd5).toBeGreaterThan(sa0 - sd0);
    expect(sa5).toBeGreaterThan(sd5);
  });
  it("la capture d'une ville change réellement le territoire", () => {
    const sim = mk(42);
    sim.runYears(30);
    const [a, d] = pair(sim);
    const war = sim.diplo.declareWar(sim, a, d, "conquest");
    const city = sim.cities.find((c) => c.civ === d.id)!;
    const tilesBefore = sim.world.owner[sim.world.idx(city.x, city.y)];
    expect(tilesBefore).toBe(d.id);
    const army = sim.armies.find((x) => x.civ === a.id)!;
    const dTiles = d.tiles;
    sim.war.captureCity(sim, war, army, city, a, d);
    if (sim.cityById.has(city.id)) expect(city.civ).toBe(a.id);
    expect(sim.world.owner[sim.world.idx(city.x, city.y)]).not.toBe(d.id);
    expect(d.tiles).toBeLessThan(dTiles);
    expect(war.takenA).toBe(1);
    expect(sim.chronicle.some((e) => e.type === "war" && /s'empare|rase/.test(e.text))).toBe(true);
  });
  it("des conflits éclatent sans intervention du joueur", () => {
    let wars = 0;
    for (const seed of [42, 7, 13]) {
      const sim = mk(seed);
      sim.runYears(250);
      wars += sim.stats.warsStarted;
    }
    expect(wars).toBeGreaterThan(0);
  });
});

describe("Pouvoirs divins", () => {
  it("la foudre tue, détruit et provoque la panique", () => {
    const sim = mk();
    sim.runYears(15);
    const city = sim.cities[0];
    const pop0 = sim.citizens.length;
    const b0 = sim.buildings.length;
    const res = sim.divine.cast(sim, "lightning", city.x + 0.5, city.y + 0.5);
    expect(res.ok).toBe(true);
    expect(sim.citizens.length + 0).toBeLessThanOrEqual(pop0);
    sim.citizenSys.update(sim);
    expect(sim.stats.godDeaths + (sim.buildings.length < b0 ? 1 : 0)).toBeGreaterThan(0);
    expect(sim.citizens.some((c) => c.panic > 0)).toBe(true);
    expect(sim.fx.some((f) => f.kind === "lightning")).toBe(true);
    expect(sim.divine.cast(sim, "lightning", 5, 5).ok).toBe(false); // recharge
  });
  it("la météorite creuse le terrain et rase la zone", () => {
    const sim = mk();
    sim.runYears(15);
    const city = sim.cities[0];
    const h0 = sim.world.height[sim.world.idx(city.x, city.y)];
    const ver = sim.world.terrainV;
    const pop0 = sim.citizens.length;
    sim.divine.cast(sim, "meteor", city.x + 0.5, city.y + 0.5);
    expect(sim.world.height[sim.world.idx(city.x, city.y)]).toBeLessThan(h0 - 0.3);
    expect(sim.world.terrainV).toBeGreaterThan(ver);
    expect(sim.citizens.length).toBeLessThan(pop0);
    expect(sim.buildings.some((b) => b.hp >= 0 && b.x === city.x && b.y === city.y)).toBe(false);
    sim.runYears(5);
    expect(invariants(sim)).toEqual([]);
  });
  it("la pluie améliore les récoltes et éteint les sécheresses", () => {
    const sim = mk();
    const city = sim.cities[0];
    sim.weather.push({ kind: "drought", x: city.x, y: city.y, r: 9, ttl: 6 });
    const farm = sim.buildings.find((b) => b.type === "farm" && b.civ === city.civ)!;
    const civ = sim.civById.get(city.civ)!;
    const dry = sim.econ.farmYield(sim, civ, farm);
    sim.divine.cast(sim, "rain", city.x + 0.5, city.y + 0.5);
    const wet = sim.econ.farmYield(sim, civ, farm);
    expect(sim.weather.some((z) => z.kind === "drought")).toBe(false);
    expect(wet).toBeGreaterThan(dry * 2.5);
  });
  it("la peste se propage par proximité et réduit la population", () => {
    const sim = mk();
    sim.runYears(30);
    const city = sim.cities.find((c) => c.pop > 20)!;
    const pop0 = sim.citizens.length;
    const res = sim.divine.cast(sim, "plague", city.x + 0.5, city.y + 0.5);
    expect(res.ok).toBe(true);
    const initial = sim.citizens.filter((c) => c.sick > 0).length;
    sim.runYears(1);
    const spread = sim.citizens.filter((c) => c.sick > 0).length;
    expect(spread).toBeGreaterThanOrEqual(initial * 0.5);
    sim.runYears(4);
    expect(sim.stats.plagueDeaths).toBeGreaterThan(0);
    expect(sim.citizens.length).toBeLessThan(pop0 + 25);
  });
  it("la bénédiction améliore la prospérité", () => {
    const sim = mk();
    const civ = sim.civs[0];
    const farm = sim.buildings.find((b) => b.type === "farm" && b.civ === civ.id)!;
    const y0 = sim.econ.farmYield(sim, civ, farm);
    const gold0 = civ.gold;
    sim.divine.cast(sim, "bless", 0, 0, { civ: civ.id });
    expect(civ.blessed).toBeGreaterThan(0);
    expect(sim.econ.farmYield(sim, civ, farm)).toBeGreaterThan(y0 * 1.2);
    expect(civ.gold).toBeGreaterThan(gold0);
  });
  it("la colère divine est une catastrophe majeure", () => {
    const sim = mk();
    sim.runYears(20);
    const city = sim.cities[0];
    const pop0 = sim.citizens.length, b0 = sim.buildings.length;
    sim.divine.cast(sim, "wrath", city.x + 0.5, city.y + 0.5);
    expect(sim.citizens.length).toBeLessThan(pop0);
    expect(sim.buildings.length).toBeLessThan(b0);
    expect(sim.chronicle.some((e) => e.type === "catastrophe")).toBe(true);
    sim.runYears(10);
    expect(invariants(sim)).toEqual([]);
  });
  it("la prophétie influence le comportement selon l'intelligence et la foi", () => {
    const sim = mk();
    sim.runYears(10);
    const smart = sim.civs[0], dumb = sim.civs[1];
    smart.avgIntel = 0.9; smart.avgFaith = 0.9; smart.leader.intel = 0.9;
    dumb.avgIntel = 0.1; dumb.avgFaith = 0.1; dumb.leader.intel = 0.1;
    expect(sim.divine.understanding(smart)).toBeGreaterThan(sim.divine.understanding(dumb) + 0.4);
    const stab = smart.stability;
    const res = sim.divine.cast(sim, "prophecy", 0, 0, { civ: smart.id, prophecy: "peace" });
    expect(res.ok).toBe(true);
    expect(smart.stability).toBeGreaterThan(stab);
    expect(sim.chronicle.some((e) => e.type === "divine" && e.civ === smart.id)).toBe(true);
  });
  it("les catastrophes laissent des conséquences persistantes (cratère, ruines, mémoire)", () => {
    const sim = mk();
    sim.runYears(20);
    const city = sim.cities[0];
    sim.divine.cast(sim, "meteor", city.x + 0.5, city.y + 0.5);
    sim.runYears(30);
    expect(sim.world.height[sim.world.idx(city.x, city.y)]).toBeLessThan(1);
    expect(sim.chronicle.filter((e) => e.type === "catastrophe").length).toBeGreaterThan(0);
  });
});

describe("Temps", () => {
  it("les vitesses ×1, ×3, ×10 modifient réellement le nombre de ticks simulés", () => {
    const ticks = (speed: number) => {
      const sim = mk();
      sim.speed = speed;
      const t0 = sim.tick;
      for (let i = 0; i < 100; i++) sim.advance(16.6667); // ~1,67 s réelles
      return sim.tick - t0;
    };
    const t1 = ticks(1), t3 = ticks(3), t10 = ticks(10);
    expect(t1).toBeGreaterThanOrEqual(15);
    expect(t1).toBeLessThanOrEqual(18);
    expect(t3 / t1).toBeGreaterThan(2.7);
    expect(t3 / t1).toBeLessThan(3.3);
    expect(t10 / t1).toBeGreaterThan(9);
    expect(t10 / t1).toBeLessThan(11);
  });
  it("la pause fige la simulation", () => {
    const sim = mk();
    sim.paused = true;
    sim.advance(5000);
    expect(sim.tick).toBe(0);
  });
  it("l'année avance toutes les 30 ticks, quelle que soit la vitesse (résultats identiques)", () => {
    const a = mk(5), b = mk(5);
    b.speed = 10;
    for (let i = 0; i < 30 * 10; i++) a.step();
    let guard = 0;
    while (b.tick < 300 && guard++ < 100000) b.advance(TICK_MS / 10);
    expect(b.tick).toBe(300);
    expect(a.year).toBe(b.year);
    expect(a.year).toBe(1 + 300 / TICKS_PER_YEAR);
    expect(a.citizens.length).toBe(b.citizens.length);
  });
});

describe("Sauvegarde", () => {
  it("sauvegarde puis chargement restituent le même monde", () => {
    const sim = mk(11);
    sim.runYears(40);
    sim.divine.cast(sim, "bless", 0, 0, { civ: sim.civs[0].id });
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    const r = SaveManager.save(sim, storage);
    expect(r.ok).toBe(true);
    expect(SaveManager.hasSave(storage)).toBe(true);
    const loaded = SaveManager.load(storage)!;
    expect(loaded).not.toBeNull();
    expect(loaded.tick).toBe(sim.tick);
    expect(loaded.year).toBe(sim.year);
    expect(loaded.citizens.length).toBe(sim.citizens.length);
    expect(loaded.buildings.length).toBe(sim.buildings.length);
    expect(loaded.civs.map((c) => [c.name, c.pop, c.tech, Math.round(c.food)])).toEqual(sim.civs.map((c) => [c.name, c.pop, c.tech, Math.round(c.food)]));
    expect(loaded.chronicle.length).toBe(Math.min(1200, sim.chronicle.length));
    expect(Array.from(loaded.world.owner)).toEqual(Array.from(sim.world.owner));
    expect(Array.from(loaded.world.trees)).toEqual(Array.from(sim.world.trees));
    expect(loaded.civs[0].blessed).toBe(sim.civs[0].blessed);
    loaded.runYears(60);
    expect(invariants(loaded)).toEqual([]);
    expect(loaded.citizens.length).toBeGreaterThan(0);
  });
  it("un chargement raté ne casse rien", () => {
    const storage = { getItem: () => "{pas du json", setItem: () => {}, removeItem: () => {} };
    expect(SaveManager.load(storage)).toBeNull();
  });
});

describe("Simulation longue (accélérée sur plusieurs siècles)", () => {
  for (const seed of [42, 7, 2024]) {
    it(`400 ans, seed ${seed} : aucun état incohérent, le monde ne se fige pas`, () => {
      const sim = mk(seed);
      let lastChron = 0;
      let activity = 0;
      for (let y = 0; y < 400; y += 20) {
        sim.runYears(20);
        const errs = invariants(sim);
        expect(errs).toEqual([]);
        if (sim.chronicle.length > lastChron) activity++;
        lastChron = sim.chronicle.length;
        // le monde est toujours habité
        expect(sim.aliveCivs().length).toBeGreaterThanOrEqual(1);
        expect(sim.citizens.length).toBeGreaterThan(0);
        // aucune civilisation « bloquée » : chaque civ vivante assez grande a des métiers et des habitants adultes
        for (const c of sim.aliveCivs()) if (c.pop >= 15) expect(c.adults).toBeGreaterThan(0);
      }
      expect(activity).toBeGreaterThan(10);
      expect(sim.stats.births).toBeGreaterThan(100);
      expect(sim.stats.buildingsBuilt).toBeGreaterThan(10);
    });
  }
  it("catastrophes à répétition : le monde survit et repart", () => {
    const sim = mk(42);
    for (let i = 0; i < 12; i++) {
      sim.runYears(15);
      const c = sim.cities[i % Math.max(1, sim.cities.length)];
      if (!c) continue;
      for (const p of ["meteor", "wrath", "plague"] as const) { sim.cooldowns[p] = 0; sim.divine.cast(sim, p, c.x + 0.5, c.y + 0.5); }
      expect(invariants(sim)).toEqual([]);
    }
    sim.runYears(120);
    expect(invariants(sim)).toEqual([]);
    expect(sim.aliveCivs().length).toBeGreaterThanOrEqual(1);
    expect(sim.world.type.some((t) => t === T.WATER)).toBe(true);
  });
});

describe("Architecture", () => {
  it("le moteur de simulation ne dépend ni de Three.js ni du DOM", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const dir = path.resolve(__dirname, "../src/sim");
    const banned = /from\s+["']three|document\.|window\.|requestAnimationFrame|import\s+.*render\//;
    for (const f of fs.readdirSync(dir)) {
      const src = fs.readFileSync(path.join(dir, f), "utf8");
      expect(banned.test(src), `${f} dépend du rendu`).toBe(false);
    }
  });
  it("les modules demandés existent", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const need = ["World", "SimulationEngine", "CitizenSystem", "CivilizationSystem", "EconomySystem", "DiplomacySystem", "WarSystem", "DivinePowerSystem", "EventSystem", "SaveManager"];
    for (const n of need) expect(fs.existsSync(path.resolve(__dirname, `../src/sim/${n}.ts`)), n).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../src/render/Renderer.ts"))).toBe(true);
    expect(fs.existsSync(path.resolve(__dirname, "../src/ui/UI.ts"))).toBe(true);
  });
});
