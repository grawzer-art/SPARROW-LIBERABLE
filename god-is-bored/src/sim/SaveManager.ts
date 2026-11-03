import { SAVE_KEY, SAVE_VERSION } from "./config";
import { SimulationEngine } from "./SimulationEngine";
import { World } from "./World";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Sauvegarde / chargement JSON (LocalStorage). La simulation est sérialisable de bout en bout. */
export class SaveManager {
  static serialize(sim: SimulationEngine): string {
    const w = sim.world;
    const data = {
      version: SAVE_VERSION,
      seed: sim.seed, tick: sim.tick, nextId: sim.nextId, rng: sim.rng.s, speed: sim.speed,
      civs: sim.civs, cities: sim.cities,
      buildings: sim.buildings.filter((b) => b.hp >= 0),
      citizens: sim.citizens.filter((c) => !c.dead).map((c) => ({ ...c, path: null, pathI: 0 })),
      armies: sim.armies.map((a) => ({ ...a, path: null, pathI: 0, pathTarget: -1 })),
      wars: sim.wars.slice(-60),
      rel: sim.rel, grudge: sim.grudge, grudgeWhy: sim.grudgeWhy, status: sim.status, truce: sim.truce,
      chronicle: sim.chronicle.slice(-1200),
      weather: sim.weather, cooldowns: sim.cooldowns, boredom: sim.boredom, lastTribeTick: sim.lastTribeTick, stats: sim.stats,
      world: {
        seedUsed: w.seedUsed, hillH: w.hillH, mtnH: w.mtnH,
        height: Array.from(w.height, r3), type: Array.from(w.type), trees: Array.from(w.trees), maxTrees: Array.from(w.maxTrees),
        fertility: Array.from(w.fertility, r3), stone: Array.from(w.stone, (v) => Math.round(v)), owner: Array.from(w.owner),
        fire: Array.from(w.fire), scorch: Array.from(w.scorch, r3),
      },
    };
    return JSON.stringify(data);
  }

  static deserialize(json: string): SimulationEngine {
    const d = JSON.parse(json);
    if (!d || d.version !== SAVE_VERSION) throw new Error("Sauvegarde incompatible");
    const w = new World();
    w.seed = d.seed; w.seedUsed = d.world.seedUsed; w.hillH = d.world.hillH; w.mtnH = d.world.mtnH;
    w.height.set(d.world.height); w.type.set(d.world.type); w.trees.set(d.world.trees); w.maxTrees.set(d.world.maxTrees);
    w.fertility.set(d.world.fertility); w.stone.set(d.world.stone); w.owner.set(d.world.owner); w.fire.set(d.world.fire);
    w.scorch.set(d.world.scorch);
    w.recomputeCorners();
    w.computeRegions();
    const sim = new SimulationEngine(w, d.seed);
    sim.tick = d.tick; sim.nextId = d.nextId; sim.rng.s = d.rng; sim.speed = d.speed ?? 1;
    sim.civs = d.civs; sim.cities = d.cities; sim.buildings = d.buildings; sim.citizens = d.citizens; sim.armies = d.armies; sim.wars = d.wars;
    sim.rel = d.rel; sim.grudge = d.grudge; sim.grudgeWhy = d.grudgeWhy; sim.status = d.status; sim.truce = d.truce;
    sim.chronicle = d.chronicle; sim.weather = d.weather; sim.cooldowns = d.cooldowns; sim.boredom = d.boredom;
    sim.lastTribeTick = d.lastTribeTick; sim.stats = d.stats;
    for (const b of sim.buildings) w.bld[w.idx(b.x, b.y)] = b.id;
    sim.reindex();
    sim.citizenSys.census(sim);
    sim.civSys.updateTerritory(sim);
    return sim;
  }

  static save(sim: SimulationEngine, storage: StorageLike = localStorage): { ok: boolean; bytes: number; error?: string } {
    try {
      const json = SaveManager.serialize(sim);
      storage.setItem(SAVE_KEY, json);
      return { ok: true, bytes: json.length };
    } catch (e) {
      return { ok: false, bytes: 0, error: String(e) };
    }
  }

  static load(storage: StorageLike = localStorage): SimulationEngine | null {
    try {
      const json = storage.getItem(SAVE_KEY);
      if (!json) return null;
      return SaveManager.deserialize(json);
    } catch {
      return null;
    }
  }

  static hasSave(storage: StorageLike = localStorage): boolean {
    try { return !!storage.getItem(SAVE_KEY); } catch { return false; }
  }

  static clear(storage: StorageLike = localStorage): void {
    try { storage.removeItem(SAVE_KEY); } catch { /* ignore */ }
  }
}
