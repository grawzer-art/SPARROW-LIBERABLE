import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { SaveManager } from "../src/sim/SaveManager";
import { ACT } from "../src/sim/SoulSystem";
import { T } from "../src/sim/World";
import type { Citizen } from "../src/sim/types";

const village = (seed = 42, years = 25) => { const sim = SimulationEngine.create(seed); sim.runYears(years); return sim; };
const adult = (sim: SimulationEngine) => sim.citizens.find((c) => c.job !== "child" && c.army < 0 && !c.dead && c.civ === sim.civs[0].id && c.city >= 0)!;

describe("Soul Engine — identité", () => {
  it("chaque habitant a une identité persistante : traits, besoins, foyer, parents", () => {
    const sim = village();
    expect(sim.citizens.length).toBeGreaterThan(30);
    for (const c of sim.citizens) {
      expect(c.soul, c.name).toBeDefined();
      for (const t of c.soul!.t) { expect(t).toBeGreaterThanOrEqual(0); expect(t).toBeLessThanOrEqual(1); }
      for (const n of [c.soul!.fat, c.soul!.soc, c.soul!.com, c.soul!.fear]) { expect(n).toBeGreaterThanOrEqual(0); expect(n).toBeLessThanOrEqual(100); }
    }
    // les enfants nés dans le jeu connaissent leur mère ; au moins quelques habitants ont un logis réel
    const born = sim.citizens.filter((c) => c.soul!.mother >= 0);
    expect(born.length).toBeGreaterThan(0);
    const housed = sim.citizens.filter((c) => c.soul!.home >= 0 && sim.buildingById.get(c.soul!.home)?.type === "house");
    expect(housed.length).toBeGreaterThan(10);
  });
  it("les logements ne dépassent pas leur capacité", () => {
    const sim = village(42, 40);
    const occ = new Map<number, number>();
    for (const c of sim.citizens) if (c.soul!.home >= 0) occ.set(c.soul!.home, (occ.get(c.soul!.home) ?? 0) + 1);
    for (const [id, n] of occ) { const b = sim.buildingById.get(id); if (b) expect(n, `bâtiment ${id}`).toBeLessThanOrEqual(12); }
  });
  it("les identités sont conservées après sauvegarde et chargement", () => {
    const sim = village(7, 30);
    const copy = SaveManager.deserialize(SaveManager.serialize(sim));
    expect(copy.citizens.length).toBe(sim.citizens.length);
    for (const c of sim.citizens) {
      const d = copy.citizenById.get(c.id)!;
      expect(d, c.name).toBeDefined();
      expect(d.name).toBe(c.name);
      expect(d.soul).toEqual(c.soul);
    }
  });
  it("une ancienne sauvegarde sans âme se charge : les âmes sont créées de façon déterministe", () => {
    const sim = village(7, 20);
    const json = JSON.parse(SaveManager.serialize(sim));
    for (const c of json.citizens) delete c.soul;
    const a = SaveManager.deserialize(JSON.stringify(json)), b = SaveManager.deserialize(JSON.stringify(json));
    a.runYears(1); b.runYears(1);
    expect(a.citizens.every((c) => !!c.soul)).toBe(true);
    expect(a.citizens.map((c) => c.soul!.t.join())).toEqual(b.citizens.map((c) => c.soul!.t.join()));
  });
});

describe("Soul Engine — besoins et décisions", () => {
  it("un habitant affamé cherche la nourriture disponible et la consomme réellement", () => {
    const sim = village();
    const c = adult(sim), civ = sim.civById.get(c.civ)!, city = sim.cityById.get(c.city)!;
    civ.food = 40; c.hunger = 85; c.state = "idle"; c.army = -1; c.panic = 0;
    expect(sim.soul.choose(sim, c, civ)).toBe(ACT.FOOD);
    const before = civ.food, h0 = c.hunger;
    let steps = 0;
    while (sim.citizenSys.seekFood(sim, c, civ, city) && steps++ < 2000) { /* marche jusqu'au grenier */ }
    expect(steps).toBeLessThan(2000);
    expect(civ.food).toBeCloseTo(before - 1, 5); // exactement une ration consommée
    expect(c.hunger).toBeLessThan(h0 - 60);
  });
  it("il ne peut pas manger une ressource inexistante : l'action échoue proprement", () => {
    const sim = village();
    const c = adult(sim), civ = sim.civById.get(c.civ)!, city = sim.cityById.get(c.city)!;
    civ.food = 0; c.hunger = 85; c.state = "idle"; c.tx = -1;
    sim.world.fertility.fill(0); // rien à cueillir non plus
    const h0 = c.hunger;
    expect(sim.citizenSys.seekFood(sim, c, civ, city)).toBe(false);
    expect(civ.food).toBe(0);
    expect(c.hunger).toBe(h0);
    // la décision suivante ne s'obstine pas : l'action impossible est écartée un moment
    sim.soul.fail(sim, c, ACT.FOOD, 12);
    expect(sim.soul.choose(sim, c, civ)).not.toBe(ACT.FOOD);
  });
  it("un habitant épuisé cherche du repos, ne récupère qu'une fois au logis ou sur place, et le repos coûte du temps", () => {
    const sim = village();
    const c = adult(sim), civ = sim.civById.get(c.civ)!, city = sim.cityById.get(c.city)!;
    c.hunger = 10; c.panic = 0; c.soul!.fat = 92; c.soul!.fear = 0; c.state = "idle";
    expect(sim.soul.choose(sim, c, civ)).toBe(ACT.REST);
    let ticks = 0, rested = false;
    while (ticks++ < 800) { sim.soul.tickNeeds(sim, c); if (!sim.soul.runRest(sim, c, city)) break; rested = rested || (c.state as string) === "rest"; }
    expect(rested).toBe(true);
    expect(c.soul!.fat).toBeLessThanOrEqual(40);
    expect(ticks).toBeGreaterThan(10); // pas instantané
  });
  it("la fatigue baisse la productivité, le repos la rétablit", () => {
    const sim = village();
    const c = adult(sim);
    c.soul!.fat = 95; const tired = sim.soul.workFactor(c);
    c.soul!.fat = 20; const fresh = sim.soul.workFactor(c);
    expect(tired).toBeLessThan(fresh);
  });
  it("un danger interrompt une action ordinaire", () => {
    const sim = village();
    const c = adult(sim);
    c.state = "work"; c.panic = 25; c.fx = c.x + 1; c.fy = c.y;
    sim.step();
    expect((c.state as string) === "flee" || c.dead).toBe(true);
    if (!c.dead) expect(c.soul!.act).toBe(ACT.FLEE);
  });
  it("deux personnalités réagissent différemment au même danger", () => {
    const sim = village();
    const w = sim.world;
    const base = adult(sim);
    const mkc = (courage: number, prudence: number): Citizen => {
      const c = sim.spawnCitizen(sim.civById.get(base.civ)!, sim.cityById.get(base.city)!, base.x, base.y, 30);
      c.courage = courage; c.soul!.t[4] = prudence; c.panic = 0; c.army = -1; return c;
    };
    const timid = mkc(0.1, 0.9), brave = mkc(0.95, 0.1);
    // un incendie voisin, d'intensité moyenne
    const cx = Math.floor(base.x), cy = Math.floor(base.y);
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) if (w.inb(cx + dx, cy + dy)) w.fire[(cy + dy) * w.size + cx + dx] = 60;
    sim.soul.sense(sim, timid); sim.soul.sense(sim, brave);
    expect(timid.panic).toBeGreaterThan(0);
    expect(brave.panic).toBe(0);
    expect(sim.soul.stats.ignoredDanger).toBeGreaterThan(0);
  });
  it("une discussion réduit réellement la solitude des deux interlocuteurs", () => {
    const sim = village();
    const a = adult(sim);
    const b = sim.spawnCitizen(sim.civById.get(a.civ)!, sim.cityById.get(a.city)!, a.x + 0.5, a.y, 30);
    sim.hash.rebuild(sim.citizens);
    a.soul!.soc = 95; b.soul!.soc = 90; a.hunger = 5; b.hunger = 5; b.panic = 0; a.panic = 0;
    a.soul!.target = b.id; a.state = "idle";
    const t0 = sim.soul.stats.talks;
    for (let i = 0; i < 40; i++) { sim.soul.tickNeeds(sim, a); sim.soul.runSocial(sim, a); }
    expect(a.state as string).toBe("talk");
    expect(a.soul!.soc).toBeLessThan(90);
    expect(b.soul!.soc).toBeLessThan(90 - 5);
    expect(sim.soul.stats.talks).toBeGreaterThan(t0);
  });
  it("les décisions sont stables (hystérésis) : peu de changements d'objectif par habitant et par tick", () => {
    const sim = village(42, 10);
    const s0 = sim.soul.stats.switches, d0 = sim.soul.stats.decisions;
    sim.runYears(5);
    const sw = sim.soul.stats.switches - s0, dec = sim.soul.stats.decisions - d0;
    const perCitizenTick = sw / (150 * sim.citizens.length);
    expect(perCitizenTick).toBeLessThan(0.06);
    expect(dec).toBeGreaterThan(0);
  });
  it("les actions variées coexistent : travail, repos, discussion et flânerie se produisent réellement", () => {
    const sim = village(42, 15);
    const seen = new Set<string>();
    for (let t = 0; t < 600; t++) { sim.step(); for (const c of sim.citizens) seen.add(c.state); }
    for (const st of ["work", "eat", "rest", "talk", "wander"]) expect(seen.has(st), st).toBe(true);
  });
});

describe("Soul Engine — déterminisme et continuité", () => {
  it("mêmes graine et mêmes événements : mêmes décisions", () => {
    const sig = (sim: SimulationEngine) => sim.citizens.map((c) => `${c.id}:${c.soul!.act}:${c.soul!.home}:${c.soul!.fat.toFixed(2)}:${c.state}`).join("|");
    const a = village(11, 20), b = village(11, 20);
    expect(sig(a)).toBe(sig(b));
    expect(a.soul.stats).toEqual(b.soul.stats);
  });
  it("la simulation (et ses décisions) continue sans aucun rendu ni caméra", () => {
    const sim = village(5, 5);
    const d0 = sim.soul.stats.decisions;
    sim.runYears(5);
    expect(sim.soul.stats.decisions).toBeGreaterThan(d0);
    expect(sim.year).toBeGreaterThan(10);
  });
});

describe("Soul Engine — performance", () => {
  it("le coût par tick reste maîtrisé quand la population grandit", () => {
    const sim = village(42, 40);
    const civ = sim.civs.find((c) => c.alive)!;
    const city = sim.cities.find((c) => c.civ === civ.id)!;
    const rows: string[] = [];
    for (const target of [250, 500, 1000, 2000]) {
      while (sim.citizens.length < target) sim.spawnCitizen(civ, city, city.x + 0.5 + (sim.citizens.length % 7) * 0.2, city.y + 0.5 + (sim.citizens.length % 5) * 0.2, 20 + (sim.citizens.length % 20));
      const t0 = performance.now();
      for (let i = 0; i < 20; i++) sim.step();
      const ms = (performance.now() - t0) / 20;
      rows.push(`${sim.citizens.length} hab. : ${ms.toFixed(2)} ms/tick`);
      expect(ms).toBeLessThan(60);
    }
    console.log("PERF-SOUL " + rows.join(" · "));
  }, 120000);
});
