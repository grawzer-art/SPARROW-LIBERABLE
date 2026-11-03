import { MAX_TICKS_PER_FRAME, START_YEAR, TICKS_PER_YEAR, TICK_MS } from "./config";
import { genCitizenName, PERS } from "./data";
import { RNG } from "./rng";
import { SpatialHash } from "./spatial";
import type {
  Army, Building, ChronicleEntry, Citizen, City, Civ, FxEvent, Job, War, WeatherZone,
} from "./types";
import { World } from "./World";
import { CitizenSystem } from "./CitizenSystem";
import { CivilizationSystem } from "./CivilizationSystem";
import { EconomySystem } from "./EconomySystem";
import { DiplomacySystem } from "./DiplomacySystem";
import { WarSystem } from "./WarSystem";
import { DivinePowerSystem } from "./DivinePowerSystem";
import { EventSystem } from "./EventSystem";

export interface Stats {
  births: number; deaths: number; warDeaths: number; plagueDeaths: number; famineDeaths: number;
  godDeaths: number; oldAgeDeaths: number; warsStarted: number; citiesFounded: number; peakPop: number;
  buildingsBuilt: number; buildingsLost: number; upgrades: number;
}

/**
 * Moteur de simulation : possède tout l'état (données pures, sans Three.js)
 * et l'avance par ticks de durée fixe, indépendamment du rendu.
 */
export class SimulationEngine {
  world: World;
  rng: RNG;
  seed: number;
  tick = 0;
  nextId = 1;
  civs: Civ[] = [];
  cities: City[] = [];
  buildings: Building[] = [];
  citizens: Citizen[] = [];
  armies: Army[] = [];
  wars: War[] = [];
  rel: Record<string, number> = {};
  grudge: Record<string, number> = {};
  grudgeWhy: Record<string, string> = {};
  status: Record<string, "peace" | "alliance" | "war"> = {};
  truce: Record<string, number> = {};
  chronicle: ChronicleEntry[] = [];
  weather: WeatherZone[] = [];
  cooldowns: Record<string, number> = {};
  boredom = 20;
  lastInteresting = 0;
  lastTribeTick = 0;
  stats: Stats = {
    births: 0, deaths: 0, warDeaths: 0, plagueDeaths: 0, famineDeaths: 0, godDeaths: 0, oldAgeDeaths: 0,
    warsStarted: 0, citiesFounded: 0, peakPop: 0, buildingsBuilt: 0, buildingsLost: 0, upgrades: 0,
  };

  // --- non sauvegardé ---
  speed = 1;
  paused = false;
  acc = 0;
  fx: FxEvent[] = [];
  hash: SpatialHash;
  civById = new Map<number, Civ>();
  cityById = new Map<number, City>();
  buildingById = new Map<number, Building>();
  citizenById = new Map<number, Citizen>();
  armyById = new Map<number, Army>();
  warById = new Map<number, War>();
  listeners: ((e: ChronicleEntry) => void)[] = [];
  private bIdx = new Map<string, Building[]>();
  /** Index (civilisation, type) des bâtiments, reconstruit à chaque tick par CitizenSystem. */
  bOf(civ: number, type: Building["type"]): Building[] {
    return this.bIdx.get(`${civ}:${type}`) ?? [];
  }
  rebuildBuildingIndex(): void {
    this.bIdx.clear();
    for (const b of this.buildings) {
      if (b.hp < 0) continue;
      const k = `${b.civ}:${b.type}`;
      const l = this.bIdx.get(k);
      if (l) l.push(b); else this.bIdx.set(k, [b]);
    }
  }

  citizenSys = new CitizenSystem();
  civSys = new CivilizationSystem();
  econ = new EconomySystem();
  diplo = new DiplomacySystem();
  war = new WarSystem();
  divine = new DivinePowerSystem();
  events = new EventSystem();

  constructor(world: World, seed: number) {
    this.world = world;
    this.seed = seed;
    this.rng = new RNG(seed ^ 0xabcdef);
    this.hash = new SpatialHash(world.size);
  }

  static create(seed: number): SimulationEngine {
    const world = World.generate(seed);
    const sim = new SimulationEngine(world, seed);
    sim.civSys.initWorld(sim);
    sim.reindex();
    return sim;
  }

  get year(): number {
    return START_YEAR + Math.floor(this.tick / TICKS_PER_YEAR);
  }
  newId(): number {
    return this.nextId++;
  }

  reindex(): void {
    this.civById.clear(); this.cityById.clear(); this.buildingById.clear();
    this.citizenById.clear(); this.armyById.clear(); this.warById.clear();
    for (const c of this.civs) this.civById.set(c.id, c);
    for (const c of this.cities) this.cityById.set(c.id, c);
    for (const b of this.buildings) this.buildingById.set(b.id, b);
    for (const c of this.citizens) this.citizenById.set(c.id, c);
    for (const a of this.armies) this.armyById.set(a.id, a);
    for (const w of this.wars) this.warById.set(w.id, w);
  }

  // ----------- boucle à pas fixe -----------

  /** Avance de dtMs millisecondes réelles. Retourne le nombre de ticks simulés. */
  advance(dtMs: number): number {
    if (this.paused) return 0;
    this.acc += Math.min(dtMs, 250) * this.speed;
    let n = 0;
    while (this.acc >= TICK_MS && n < MAX_TICKS_PER_FRAME) {
      this.step();
      this.acc -= TICK_MS;
      n++;
    }
    if (n >= MAX_TICKS_PER_FRAME) this.acc = 0;
    return n;
  }

  /** Un tick de simulation. Ordre fixe, donc résultats cohérents quelle que soit la vitesse. */
  step(): void {
    this.tick++;
    const yearly = this.tick % TICKS_PER_YEAR === 0;
    this.world.fireTick(this.rng);
    if (this.tick % 15 === 0) this.world.slowTick(this.rng, (x, y) => this.econ.rainFactor(this, x, y));
    this.citizenSys.update(this);
    this.econ.update(this, yearly);
    this.civSys.update(this, yearly);
    this.diplo.update(this, yearly);
    this.war.update(this, yearly);
    this.divine.update(this);
    this.events.update(this, yearly);
    this.pruneBuildings();
    this.removeDead();
    const pop = this.citizens.length;
    if (pop > this.stats.peakPop) this.stats.peakPop = pop;
    this.boredom = Math.min(100, this.boredom + 0.006);
  }

  /** Simulation sans rendu (tests, accélération massive). */
  runYears(years: number): void {
    const n = years * TICKS_PER_YEAR;
    for (let i = 0; i < n; i++) this.step();
  }

  // ----------- helpers d'entités -----------

  spawnCitizen(civ: Civ, city: City | null, x: number, y: number, age: number, opts: { female?: boolean; parent?: Citizen; job?: Job } = {}): Citizen {
    const rng = this.rng;
    const female = opts.female ?? rng.chance(0.5);
    const P = PERS[civ.personality];
    const p = opts.parent;
    const mix = (base: number, par: number | undefined) =>
      Math.max(0.02, Math.min(1, (par !== undefined ? (par + base) / 2 : base) + rng.gauss() * 0.12));
    const c: Citizen = {
      id: this.newId(),
      name: genCitizenName(rng, civ.culture, female),
      age, civ: civ.id, city: city ? city.id : -1,
      x, y, px: x, py: y, hp: 100, hunger: rng.range(0, 30),
      job: age < 14 ? "child" : opts.job ?? "farmer",
      intel: mix(P.intel, p?.intel), courage: mix(0.5, p?.courage), aggr: mix(P.aggr, p?.aggr), faith: mix(P.faith, p?.faith),
      female, state: "idle", tx: x, ty: y, work: -1, wx: -1, wy: -1, think: rng.int(20), cooldown: rng.int(60), mateT: 0,
      sick: 0, immune: 0, panic: 0, fx: 0, fy: 0, army: -1, slot: 0, stuck: 0, workT: 0,
    };
    this.citizens.push(c);
    this.citizenById.set(c.id, c);
    return c;
  }

  killCitizen(c: Citizen, cause: "age" | "famine" | "plague" | "war" | "god" | "accident" | "fire" | "drown" | "unrest"): void {
    if (c.dead) return;
    c.dead = true;
    c.hp = 0;
    const civ = this.civById.get(c.civ);
    if (civ) civ.stats.deaths++;
    this.stats.deaths++;
    if (cause === "war") this.stats.warDeaths++;
    else if (cause === "plague") this.stats.plagueDeaths++;
    else if (cause === "famine") this.stats.famineDeaths++;
    else if (cause === "god" || cause === "fire") this.stats.godDeaths++;
    else if (cause === "age") this.stats.oldAgeDeaths++;
    if (c.army >= 0) {
      const a = this.armyById.get(c.army);
      if (a) a.soldiers = a.soldiers.filter((id) => id !== c.id);
    }
  }

  removeDead(): void {
    let any = false;
    for (const c of this.citizens) if (c.dead) { any = true; this.citizenById.delete(c.id); }
    if (any) this.citizens = this.citizens.filter((c) => !c.dead);
  }

  addBuilding(type: Building["type"], civ: number, cityId: number, x: number, y: number, built = false, era = 0): Building {
    const info = this.econ.cost(type);
    const b: Building = {
      id: this.newId(), type, civ, city: cityId, x, y,
      hp: built ? info.hp : 1, maxHp: info.hp, progress: built ? 1 : 0, workers: 0, ruin: 0, era, up: -1, upTo: era,
    };
    this.buildings.push(b);
    this.buildingById.set(b.id, b);
    this.world.bld[this.world.idx(x, y)] = b.id;
    return b;
  }

  destroyBuilding(b: Building, ruin = false): void {
    const i = this.world.idx(b.x, b.y);
    if (ruin && b.progress >= 1) {
      b.ruin = 40; b.civ = -1; b.hp = 1;
      return;
    }
    if (this.world.bld[i] === b.id) this.world.bld[i] = -1;
    this.buildingById.delete(b.id);
    b.hp = -1;
    this.stats.buildingsLost++;
    if (b.type === "hall") {
      const city = this.cityById.get(b.city);
      if (city) city.hasHall = false;
    }
    if (b.type === "walls") {
      const city = this.cityById.get(b.city);
      if (city && city.walls >= 0) { city.walls = -1; city.maxHp = Math.max(200, city.maxHp - 150); city.hp = Math.min(city.hp, city.maxHp); }
    }
  }

  pruneBuildings(): void {
    if (this.buildings.some((b) => b.hp < 0)) this.buildings = this.buildings.filter((b) => b.hp >= 0);
  }

  inWeather(kind: "rain" | "drought", x: number, y: number): boolean {
    for (const z of this.weather) if (z.kind === kind && Math.hypot(z.x - x, z.y - y) < z.r) return true;
    return false;
  }

  // relations helpers
  pairKey(a: number, b: number): string {
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }
  statusOf(a: number, b: number): "peace" | "alliance" | "war" {
    return this.status[this.pairKey(a, b)] ?? "peace";
  }
  opinion(a: number, b: number): number {
    return this.rel[`${a}>${b}`] ?? 0;
  }
  addOpinion(a: number, b: number, d: number): void {
    const k = `${a}>${b}`;
    this.rel[k] = Math.max(-100, Math.min(100, (this.rel[k] ?? 0) + d));
  }

  aliveCivs(): Civ[] {
    return this.civs.filter((c) => c.alive);
  }
  citiesOf(civId: number): City[] {
    return this.cities.filter((c) => c.civ === civId);
  }
  totalPop(): number {
    return this.citizens.length;
  }
  activeWars(): War[] {
    return this.wars.filter((w) => w.active);
  }
}
