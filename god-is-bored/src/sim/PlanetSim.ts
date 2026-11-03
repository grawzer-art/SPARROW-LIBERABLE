import { SAVE_KEY } from "./config";
import { Planet, type Region } from "./Planet";
import { SaveManager } from "./SaveManager";
import { SimulationEngine } from "./SimulationEngine";
import { generateRegionWorld } from "./WorldGen";

/** Nombre de régions habitées créées au départ d'une nouvelle partie (la carte d'origine R1 en fait partie). */
export const START_INHABITED_REGIONS = 2;

export interface PlanetTotals { population: number; civs: number; wars: number; regions: number; inhabited: number; }

/**
 * Monde planétaire : UNE simulation complète par région (terrain, civilisations, habitants, bâtiments, chroniques), toutes cadencées
 * sur la même horloge, et UNE planète partagée (relief, biomes, régions). La simulation ne dépend jamais de la caméra : toutes les régions
 * habitées avancent à chaque tick, qu'on les regarde ou non. Les régions inhabitées (sans civilisation) ne coûtent aucun calcul ; elles gardent
 * leur terrain, leurs modifications et leur historique, et sont créées à la première visite (déterministes : graine de la région).
 * Les identifiants d'entités sont uniques DANS une région ; l'adresse globale est (région, identifiant).
 * Limite connue : pas encore d'interaction entre régions (commerce, guerre, migrations).
 */
export class PlanetSim {
  readonly engines = new Map<number, SimulationEngine>();
  activeId = 1;
  private globalTick = 0;

  constructor(public planet: Planet, public seed: number) {}

  /** Nouvelle partie : R1 (carte d'origine, inchangée) + régions habitées sur d'autres continents. */
  static create(seed: number, inhabited = START_INHABITED_REGIONS): PlanetSim {
    const home = SimulationEngine.create(seed);
    const ps = new PlanetSim(home.planet, seed);
    ps.attach(home, 1);
    ps.addInhabitedRegions(inhabited - 1);
    return ps;
  }

  /** Enveloppe une partie existante (ancienne sauvegarde : une seule région) ; les régions peuvent être ajoutées ensuite. */
  static fromEngine(engine: SimulationEngine): PlanetSim {
    const ps = new PlanetSim(engine.planet, engine.seed);
    ps.attach(engine, engine.regionId || 1);
    ps.globalTick = engine.tick;
    return ps;
  }

  get active(): SimulationEngine { return this.engines.get(this.activeId)!; }
  get tick(): number { return this.globalTick; }

  private attach(engine: SimulationEngine, regionId: number): void {
    engine.regionId = regionId;
    engine.planet = this.planet;
    this.engines.set(regionId, engine);
    // couleurs de civilisation uniques sur toute la planète
    engine.extraUsedColors = [...this.engines.values()].filter((e) => e !== engine).flatMap((e) => e.civs.map((c) => c.color));
  }

  isInhabited(e: SimulationEngine): boolean { return e.civs.some((c) => c.alive) || e.citizens.length > 0; }

  /**
   * Crée la simulation d'une région (terrain dérivé du globe). Si `civs` > 0, des civilisations de départ y sont fondées ; si le terrain
   * n'offre aucun site viable, la région reste inhabitée. L'horloge est alignée sur celle du monde.
   */
  makeEngine(region: Region, civs: number): SimulationEngine {
    const world = generateRegionWorld(this.planet, region);
    const eng = new SimulationEngine(world, region.seed ?? region.id);
    eng.regionId = region.id;
    eng.planet = this.planet;
    eng.tick = this.globalTick;
    this.attach(eng, region.id);
    if (civs > 0) {
      eng.civSys.initWorld(eng, civs);
      if (eng.civs.length === 0) region.inhabited = false; else region.inhabited = true;
    }
    eng.reindex();
    return eng;
  }

  /** Fonde de nouvelles régions habitées sur des continents distincts, loin de R1. */
  addInhabitedRegions(count: number): Region[] {
    const out: Region[] = [];
    if (count <= 0) return out;
    const cands = this.planet.suggestStartRegions(count + 4);
    for (const c of cands) {
      if (out.length >= count) break;
      if (this.planet.regionById(c.id)) continue;
      const r = this.planet.createRegion(c.lat, c.lon, c.id, true);
      const eng = this.makeEngine(r, out.length === 0 ? 2 : 1);
      if (eng.civs.length === 0) { this.engines.delete(r.id); this.planet.regions = this.planet.regions.filter((x) => x.id !== r.id); continue; }
      out.push(r);
    }
    return out;
  }

  /** Simulation d'une région ; créée (inhabitée) à la première demande. */
  ensure(regionId: number): SimulationEngine {
    let e = this.engines.get(regionId);
    if (e) return e;
    const r = this.planet.regionById(regionId);
    if (!r) throw new Error(`Région inconnue : ${regionId}`);
    e = this.makeEngine(r, 0);
    return e;
  }
  engineOf(regionId: number): SimulationEngine | undefined { return this.engines.get(regionId); }

  setActive(regionId: number): SimulationEngine {
    const e = this.ensure(regionId);
    if (!this.isInhabited(e)) e.tick = this.globalTick; // une région inhabitée suit simplement l'horloge du monde
    this.activeId = regionId;
    return e;
  }

  /** Avance toutes les régions habitées de dtMs (même vitesse et même pause que la région observée). */
  advance(dtMs: number): number {
    const act = this.active;
    let n = 0;
    for (const e of this.engines.values()) {
      e.speed = act.speed; e.paused = act.paused;
      if (e === act || this.isInhabited(e)) n = Math.max(n, e.advance(dtMs));
    }
    this.globalTick = Math.max(this.globalTick, act.tick);
    return n;
  }
  /** Avance de N ans sans rendu (tests). */
  runYears(years: number): void {
    for (const e of this.engines.values()) if (this.isInhabited(e)) e.runYears(years);
    this.globalTick += years * 30;
    for (const e of this.engines.values()) if (!this.isInhabited(e)) e.tick = this.globalTick;
  }

  totals(): PlanetTotals {
    let population = 0, civs = 0, wars = 0, inhabited = 0;
    for (const e of this.engines.values()) {
      population += e.citizens.length; civs += e.civs.filter((c) => c.alive).length; wars += e.wars.filter((w) => w.active).length;
      if (this.isInhabited(e)) inhabited++;
    }
    return { population, civs, wars, regions: this.engines.size, inhabited };
  }

  // ---------------------------------------------------------------- sauvegarde

  static save(ps: PlanetSim, storage: Pick<Storage, "setItem"> = localStorage): { ok: boolean; bytes: number; error?: string } {
    try { const json = ps.serialize(); storage.setItem(SAVE_KEY, json); return { ok: true, bytes: json.length }; }
    catch (e) { return { ok: false, bytes: 0, error: String(e) }; }
  }
  static load(storage: Pick<Storage, "getItem"> = localStorage): PlanetSim | null {
    try { const json = storage.getItem(SAVE_KEY); return json ? PlanetSim.deserialize(json) : null; } catch { return null; }
  }
  static hasSave(storage: Pick<Storage, "getItem"> = localStorage): boolean {
    try { return !!storage.getItem(SAVE_KEY); } catch { return false; }
  }

  serialize(): string {
    const regions: Record<string, unknown> = {};
    for (const [id, e] of this.engines) {
      const d = JSON.parse(SaveManager.serialize(e));
      delete d.planet; // une seule planète partagée, sauvegardée au niveau supérieur
      d.regionId = id;
      regions[id] = d;
    }
    return JSON.stringify({ format: 2, seed: this.seed, planet: this.planet.serialize(), active: this.activeId, tick: this.globalTick, regions });
  }

  /** Charge une sauvegarde multi-régions OU une ancienne sauvegarde à région unique (qui reste intacte ; R2 y est ajoutée ensuite si demandé). */
  static deserialize(json: string): PlanetSim {
    const d = JSON.parse(json);
    if (d && d.format === 2) {
      const planet = Planet.restore(d.planet, d.seed);
      const ps = new PlanetSim(planet, d.seed);
      ps.globalTick = d.tick ?? 0;
      for (const [id, rd] of Object.entries<Record<string, unknown>>(d.regions)) {
        const eng = SaveManager.deserialize(JSON.stringify({ ...rd, planet: d.planet }));
        eng.regionId = Number(id);
        ps.attach(eng, Number(id));
      }
      // régions déjà créées mais sans moteur (ne devrait pas arriver) : créées à la demande
      ps.activeId = ps.engines.has(d.active) ? d.active : 1;
      for (const e of ps.engines.values()) e.reindex();
      return ps;
    }
    return PlanetSim.fromEngine(SaveManager.deserialize(json));
  }
}
