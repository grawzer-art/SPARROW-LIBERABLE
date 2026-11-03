import { MAX_TECH, TICKS_PER_YEAR } from "./config";
import {
  CIV_COLORS, CITY_SUFFIX, genLeaderName, genPlaceName, genReligion, PERS, TITLES,
} from "./data";
import type { SimulationEngine } from "./SimulationEngine";
import type { Building, BuildingType, Citizen, City, Civ, Job, Leader, PersonalityId } from "./types";
import { T } from "./World";
import { RNG } from "./rng";

const TPY = TICKS_PER_YEAR;
const PERSONALITIES: PersonalityId[] = ["pacifist", "expansionist", "fanatic", "opportunist", "arrogant", "paranoid", "stupid"];

export function formalName(prefix: string, name: string): string {
  return /^[AEIOUYÉÈ]/i.test(name) && prefix.endsWith(" de") ? `${prefix.slice(0, -3)} d'${name}` : `${prefix} ${name}`;
}

export function techThreshold(level: number): number {
  return 35 * Math.pow(level + 1, 1.7);
}

/** Civilisations : création, planification des bâtiments, métiers, territoire, dirigeant, technologie, effondrement. */
export class CivilizationSystem {
  // ------------------------------------------------------------ création

  initWorld(sim: SimulationEngine): void {
    const rng = sim.rng;
    const sites = sim.world.pickStartSites(3, rng);
    const pool = [...PERSONALITIES];
    for (let i = pool.length - 1; i > 0; i--) { const j = rng.int(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const picked: PersonalityId[] = [];
    for (const p of pool) {
      if (picked.length >= 3) break;
      if (p === "pacifist" && picked.length === 2 && picked.every((q) => q !== "expansionist" && q !== "arrogant")) continue;
      picked.push(p);
    }
    sites.forEach((s, i) => this.createCiv(sim, s.x, s.y, picked[i % picked.length], 16 + rng.int(4)));
    for (const c of sim.civs) sim.diplo.initRelations(sim, c);
    this.updateTerritory(sim);
    sim.citizenSys.census(sim);
  }

  makeLeader(sim: SimulationEngine, civ: { personality: PersonalityId }, dynasty: number, goat = false, age?: number): Leader {
    const rng = sim.rng, P = PERS[civ.personality];
    const female = rng.chance(0.4);
    const titles = TITLES[civ.personality];
    return {
      name: genLeaderName(rng, dynasty, female, goat),
      title: goat ? "Cheffe de troupeau" : titles[female ? Math.min(1, titles.length - 1) : 0] ?? titles[0],
      age: age ?? 28 + rng.int(18),
      intel: goat ? 0.1 : clamp01(P.intel + rng.gauss() * 0.15),
      aggr: goat ? 0 : clamp01(P.aggr + rng.gauss() * 0.15),
      ambition: goat ? 0 : rng.next(),
      vanity: goat ? 0 : rng.next(),
      goat, dynasty, since: sim.year,
    };
  }

  createCiv(sim: SimulationEngine, x: number, y: number, personality: PersonalityId, startPop: number, opts: { fromSplit?: boolean } = {}): Civ {
    const rng = sim.rng;
    const idx = sim.civs.length;
    const culture = rng.int(4);
    const name = genPlaceName(rng, culture);
    const id = sim.newId();
    const used = new Set(sim.civs.filter((c) => c.alive).map((c) => c.color));
    const color = CIV_COLORS.find((c) => !used.has(c)) ?? CIV_COLORS[idx % CIV_COLORS.length];
    const civ: Civ = {
      id, name, formal: formalName(rng.pick(CIV_PREFIX_FOR(personality)), name), color, alive: true, personality,
      religion: genReligion(rng), leader: null as unknown as Leader, culture,
      tech: 0, techProg: 0, food: 60, wood: 40, stone: 12, gold: 10, stability: 55, lowStab: 0, capital: -1,
      foundedYear: sim.year, extinctYear: 0, laws: [], blessed: 0, prayer: null, lastWarEnd: -9999, lastCityTick: sim.tick, lastBoast: 0,
      lastEvt: {}, pop: 0, adults: 0, soldiers: 0, farmers: 0,
      jobs: { child: 0, farmer: 0, lumberjack: 0, miner: 0, builder: 0, soldier: 0, scholar: 0 },
      avgIntel: 0.5, avgFaith: 0.5, famine: 0,
      stats: { births: 0, deaths: 0, kills: 0, warsWon: 0, warsLost: 0, peakPop: 0, collapses: 0 },
      strikes: 0, tiles: 0,
    };
    civ.leader = this.makeLeader(sim, civ, 1);
    sim.civs.push(civ);
    sim.civById.set(civ.id, civ);
    const city = this.addCity(sim, civ, x, y, true);
    civ.capital = city.id;
    // village de départ
    sim.addBuilding("hall", civ.id, city.id, x, y, true);
    city.hasHall = true;
    for (const [type, n] of [["house", 3], ["farm", 2]] as [BuildingType, number][]) {
      for (let k = 0; k < n; k++) {
        const s = this.findSite(sim, civ, city, type);
        if (s) sim.addBuilding(type, civ.id, city.id, s.x, s.y, true);
      }
    }
    // premiers habitants
    for (let i = 0; i < startPop; i++) {
      const a = rng.next() * Math.PI * 2, r = 0.8 + rng.next() * 2;
      const age = i < 4 ? rng.range(2, 12) : rng.range(16, 42);
      const px = x + 0.5 + Math.cos(a) * r, py = y + 0.5 + Math.sin(a) * r;
      const c = sim.spawnCitizen(civ, city, sim.world.passable(px, py) ? px : x + 0.5, sim.world.passable(px, py) ? py : y + 0.5, age, { female: i % 2 === 0 });
      c.job = age < 14 ? "child" : "farmer";
    }
    this.initialJobs(sim, civ);
    if (!opts.fromSplit) sim.events.civBorn(sim, civ, city);
    return civ;
  }

  initialJobs(sim: SimulationEngine, civ: Civ): void {
    const adults = sim.citizens.filter((c) => c.civ === civ.id && c.job !== "child");
    const want: Job[] = ["builder", "builder", "lumberjack", "soldier", "scholar"];
    adults.forEach((c, i) => { c.job = i < want.length ? want[i] : "farmer"; });
  }

  addCity(sim: SimulationEngine, civ: Civ, x: number, y: number, first = false): City {
    const rng = sim.rng;
    let name = genPlaceName(rng, civ.culture);
    if (!first) name += rng.pick(CITY_SUFFIX);
    const city: City = {
      id: sim.newId(), civ: civ.id, name: first ? civ.name + (rng.chance(0.3) ? "-Ville" : "") : name, x, y, pop: 0, cap: 8,
      hp: 200, maxHp: 200, foundedYear: sim.year, siege: 0, hasHall: false,
    };
    sim.cities.push(city);
    sim.cityById.set(city.id, city);
    return city;
  }

  // ------------------------------------------------------------ métiers

  desiredJobs(sim: SimulationEngine, civ: Civ, adults: number): Record<Job, number> {
    const P = PERS[civ.personality];
    const A = Math.max(1, adults);
    const atWar = sim.wars.some((w) => w.active && (w.a === civ.id || w.d === civ.id));
    let sites = 0;
    for (const b of sim.buildings) if (b.civ === civ.id && b.progress < 1) sites++;
    const hasStone = this.civHasStone(sim, civ);
    const soldiers = A > 5 ? Math.max(1, Math.round(A * (P.soldiers + (atWar ? 0.12 : 0)))) : 0;
    const builders = A > 4 ? Math.round(Math.min(A * 0.22, Math.max(A * 0.05, sites * 1.5))) : 1;
    const scholars = civ.tech < MAX_TECH && A > 6 ? Math.max(1, Math.round(A * (0.05 + (civ.religion.dogma === "scholar" ? 0.04 : 0)))) : 0;
    const miners = hasStone ? Math.round(A * (civ.stone < 60 ? 0.1 : 0.03)) : 0;
    const lumber = Math.max(1, Math.round(A * (civ.wood < 40 ? 0.2 : civ.wood > 300 ? 0.04 : 0.12)));
    const farmers = Math.max(Math.ceil(A * 0.38), A - soldiers - builders - scholars - miners - lumber);
    return { child: 0, farmer: farmers, lumberjack: lumber, miner: miners, builder: builders, soldier: soldiers, scholar: scholars };
  }

  civHasStone(sim: SimulationEngine, civ: Civ): boolean {
    for (const city of sim.cities) if (city.civ === civ.id && sim.econ.hasStoneNear(sim, city.x, city.y, 10)) return true;
    return false;
  }

  pickJob(sim: SimulationEngine, civ: Civ): Job {
    const want = this.desiredJobs(sim, civ, civ.adults + 1);
    let best: Job = "farmer", bd = -Infinity;
    for (const j of ["farmer", "lumberjack", "miner", "builder", "soldier", "scholar"] as Job[]) {
      const d = want[j] - (civ.jobs[j] ?? 0);
      if (d > bd) { bd = d; best = j; }
    }
    civ.jobs[best] = (civ.jobs[best] ?? 0) + 1;
    return best;
  }

  rebalanceJobs(sim: SimulationEngine, civ: Civ): void {
    const adults = sim.citizens.filter((c) => c.civ === civ.id && c.job !== "child" && !c.dead);
    if (adults.length < 4) return;
    const want = this.desiredJobs(sim, civ, adults.length);
    const cur: Record<string, Citizen[]> = {};
    for (const c of adults) (cur[c.job] ??= []).push(c);
    const jobs: Job[] = ["farmer", "lumberjack", "miner", "builder", "soldier", "scholar"];
    let budget = Math.max(2, Math.floor(adults.length * 0.25));
    const deficits = jobs.map((j) => ({ j, d: want[j] - (cur[j]?.length ?? 0) })).filter((x) => x.d >= 1).sort((a, b) => b.d - a.d);
    for (const def of deficits) {
      let need = def.d;
      while (need > 0 && budget > 0) {
        const donors = jobs.map((j) => ({ j, s: (cur[j]?.length ?? 0) - want[j] })).filter((x) => x.s >= 1 && x.j !== def.j).sort((a, b) => b.s - a.s);
        if (!donors.length) break;
        const donorList = cur[donors[0].j];
        const idx = donorList.findIndex((c) => c.army < 0);
        if (idx < 0) break;
        const c = donorList.splice(idx, 1)[0];
        c.job = def.j; c.work = -1; c.wx = -1; c.state = "idle";
        (cur[def.j] ??= []).push(c);
        need--; budget--;
      }
    }
  }

  // ------------------------------------------------------------ construction

  nextBuilding(sim: SimulationEngine, civ: Civ, city: City): BuildingType | null {
    const bs = sim.buildings.filter((b) => b.city === city.id && b.civ === civ.id);
    const count = (t: BuildingType) => bs.filter((b) => b.type === t).length;
    const civCount = (t: BuildingType) => sim.buildings.filter((b) => b.civ === civ.id && b.type === t).length;
    if (!city.hasHall && count("hall") === 0) return "hall";
    const housesUnder = bs.filter((b) => b.type === "house" && b.progress < 1).length;
    if (civ.personality === "stupid" && sim.rng.chance(0.12)) return sim.rng.pick(["temple", "house", "farm"] as BuildingType[]);
    if (city.pop + 4 >= city.cap + housesUnder * 5) return "house";
    const farmsNeeded = Math.ceil(Math.max(city.pop * 0.42, 2) / 3);
    if (count("farm") < farmsNeeded) return "farm";
    if (count("lumber") === 0 && civ.jobs.lumberjack >= 2 && city.pop > 12) return "lumber";
    if (count("quarry") === 0 && civ.jobs.miner >= 2 && city.pop > 15) return "quarry";
    const atWar = sim.wars.some((w) => w.active && (w.a === civ.id || w.d === civ.id));
    if (civ.tech >= 3 && civ.soldiers >= 5 && civCount("barracks") < 1 + Math.floor(civ.pop / 90)) return "barracks";
    const templeWant = Math.floor(civ.pop / 35) + (civ.personality === "fanatic" ? 1 : 0);
    if (civ.tech >= 1 && civ.pop > 18 && civCount("temple") < Math.min(templeWant, 4) && civ.avgFaith > 0.4) return "temple";
    if (civ.tech >= 4 && city.pop >= 26 && count("castle") === 0 && (civ.personality === "paranoid" || civ.pop > 45 || atWar)) return "castle";
    if (city.pop + 9 >= city.cap + housesUnder * 5) return "house";
    return null;
  }

  findSite(sim: SimulationEngine, civ: Civ, city: City, type: BuildingType): { x: number; y: number } | null {
    const w = sim.world;
    const R = type === "castle" || type === "temple" ? 6 : 8;
    let best: { x: number; y: number } | null = null, bs = Infinity;
    for (let y = Math.max(0, city.y - R); y <= Math.min(w.size - 1, city.y + R); y++)
      for (let x = Math.max(0, city.x - R); x <= Math.min(w.size - 1, city.x + R); x++) {
        const i = y * w.size + x;
        const t = w.type[i];
        if (w.bld[i] >= 0 || w.fire[i] > 0) continue;
        const d = Math.hypot(x - city.x, y - city.y);
        if (d < 1.2 || d > R) continue;
        const own = w.owner[i];
        if (own !== -1 && own !== civ.id) continue;
        let ok = t === T.GRASS || t === T.SAND;
        if (type === "quarry") ok = t === T.HILL && w.stone[i] > 1;
        else if (type === "house" || type === "temple" || type === "castle" || type === "barracks") ok = ok || (t === T.HILL && w.height[i] < w.hillH + 0.4);
        if (!ok) continue;
        if (type !== "lumber" && w.trees[i] > 0) continue;
        let s = d;
        const noise = ((x * 73 + y * 151 + sim.tick) % 11) * 0.12;
        if (type === "farm") s = d * 0.5 - w.fertility[i] * 6 + (d > 6 ? 3 : 0);
        else if (type === "lumber") {
          let tr = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tx = x + dx, ty = y + dy; if (w.inb(tx, ty) && w.trees[ty * w.size + tx] > 0) tr++; }
          if (tr < 3) continue;
          s = d * 0.4 - tr * 0.5;
        } else if (type === "quarry") s = d;
        else if (type === "castle" || type === "temple") s = Math.abs(d - 3.2) + noise;
        else {
          // maison : se serre autour des autres bâtiments
          let adj = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tx = x + dx, ty = y + dy; if (w.inb(tx, ty) && w.bld[ty * w.size + tx] >= 0) adj++; }
          s = d - Math.min(adj, 3) * 0.5;
        }
        s += noise;
        if (s < bs) { bs = s; best = { x, y }; }
      }
    return best;
  }

  plan(sim: SimulationEngine, civ: Civ): void {
    const cities = sim.cities.filter((c) => c.civ === civ.id && c.siege <= 0).sort((a, b) => b.pop - a.pop);
    for (const city of cities) {
      const sites = sim.buildings.filter((b) => b.city === city.id && b.civ === civ.id && b.progress < 1);
      if (sites.length >= 1 + Math.floor(city.pop / 14)) continue;
      const type = this.nextBuilding(sim, civ, city);
      if (!type || !sim.econ.canAfford(civ, type)) continue;
      const saving = sim.tick - (civ.lastEvt.saving ?? -1e9) < 70;
      if (saving && type !== "hall" && civ.wood - sim.econ.cost(type).wood < 40 && city.pop + 2 < city.cap) continue;
      const s = this.findSite(sim, civ, city, type);
      if (!s) continue;
      sim.econ.spend(civ, type);
      sim.addBuilding(type, civ.id, city.id, s.x, s.y, false);
      return;
    }
  }

  onBuilt(sim: SimulationEngine, civ: Civ, b: Building): void {
    if (b.type === "hall") {
      const city = sim.cityById.get(b.city);
      if (city) { city.hasHall = true; city.hp = city.maxHp; }
    } else if (b.type === "castle") sim.events.castleBuilt(sim, civ, sim.cityById.get(b.city));
  }

  // ------------------------------------------------------------ expansion

  tryFoundCity(sim: SimulationEngine, civ: Civ, force: "good" | "bad" | null = null): boolean {
    const cities = sim.cities.filter((c) => c.civ === civ.id);
    if (cities.length === 0 || cities.length >= 8) return false;
    const P = PERS[civ.personality];
    const wait = (civ.personality === "expansionist" ? 6 : 12) * TPY;
    if (!force && sim.tick - civ.lastCityTick < wait) return false;
    if (force) civ.wood = Math.max(civ.wood, 40);
    if (!force && civ.pop < (20 + 8 * cities.length) / Math.max(0.7, P.expand)) return false;
    if (!force && civ.wood < 40) { civ.lastEvt.saving = sim.tick; return false; }
    if (sim.wars.some((w) => w.active && (w.a === civ.id || w.d === civ.id)) && cities.length >= 2) return false;
    const w = sim.world;
    const origin = cities.slice().sort((a, b) => b.pop - a.pop)[0];
    let best: { x: number; y: number } | null = null, bs = -Infinity;
    for (let y = 3; y < w.size - 3; y++)
      for (let x = 3; x < w.size - 3; x++) {
        const i = y * w.size + x;
        if (w.type[i] !== T.GRASS || w.bld[i] >= 0 || w.trees[i] > 0) continue;
        if (w.region[i] !== w.region[w.idx(origin.x, origin.y)]) continue;
        const own = w.owner[i];
        if (own !== -1 && own !== civ.id) continue;
        let mind = Infinity;
        for (const c of sim.cities) {
          const d = Math.hypot(c.x - x, c.y - y);
          if (c.civ === civ.id) mind = Math.min(mind, d);
          else if (d < 9) { mind = -1; break; }
        }
        if (mind < 0) continue;
        let dmin = Infinity;
        for (const c of cities) dmin = Math.min(dmin, Math.hypot(c.x - x, c.y - y));
        if (dmin < 8 || dmin > 17) continue;
        let fert = 0, trees = 0, land = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const j = (y + dy) * w.size + x + dx;
          fert += w.fertility[j]; if (w.trees[j] > 0) trees++; if (w.type[j] !== T.WATER) land++;
        }
        let sc = fert / 49 * 10 + Math.min(trees, 6) * 0.5 + (land / 49) * 4 - Math.abs(dmin - 10) * 0.4;
        if (civ.personality === "stupid" || force === "bad") sc = -sc + sim.rng.next() * 4; // mauvais jugement
        if (w.owner[i] === -1) sc += 1;
        if (sc > bs) { bs = sc; best = { x, y }; }
      }
    if (!best) return false;
    this.foundCityAt(sim, civ, best.x, best.y, origin);
    return true;
  }

  foundCityAt(sim: SimulationEngine, civ: Civ, x: number, y: number, origin: City | null): City {
    const city = this.addCity(sim, civ, x, y);
    civ.lastCityTick = sim.tick;
    civ.wood = Math.max(0, civ.wood - 25);
    sim.addBuilding("hall", civ.id, city.id, x, y, false);
    const colonists = sim.citizens.filter((c) => c.civ === civ.id && c.job !== "child" && c.army < 0 && (!origin || c.city === origin.id)).slice(0, 7);
    colonists.forEach((c, i) => {
      c.city = city.id; c.work = -1; c.wx = -1;
      if (i < 3) c.job = "builder";
    });
    for (let i = 3; i < colonists.length; i++) if (colonists[i].job !== "farmer" && i > 4) colonists[i].job = "farmer";
    sim.stats.citiesFounded++;
    this.updateTerritory(sim);
    sim.events.cityFounded(sim, civ, city);
    return city;
  }

  // ------------------------------------------------------------ territoire

  cityRadius(sim: SimulationEngine, city: City): number {
    const castle = sim.buildings.some((b) => b.city === city.id && b.type === "castle" && b.progress >= 1) ? 2 : 0;
    return Math.min(14, 4 + Math.sqrt(Math.max(city.pop, 2)) * 0.9 + castle);
  }

  updateTerritory(sim: SimulationEngine): void {
    const w = sim.world, n = w.size;
    const best = new Float32Array(n * n);
    const owner = new Int16Array(n * n).fill(-1);
    for (const city of sim.cities) {
      const civ = sim.civById.get(city.civ);
      if (!civ || !civ.alive) continue;
      const R = this.cityRadius(sim, city);
      for (let y = Math.max(0, Math.floor(city.y - R)); y <= Math.min(n - 1, Math.ceil(city.y + R)); y++)
        for (let x = Math.max(0, Math.floor(city.x - R)); x <= Math.min(n - 1, Math.ceil(city.x + R)); x++) {
          const i = y * n + x;
          if (w.type[i] === T.WATER) continue;
          const d = Math.hypot(x - city.x, y - city.y);
          if (d >= R) continue;
          let infl = ((R - d) / R) * (1 + civ.tech * 0.03);
          if (w.owner[i] === city.civ) infl *= 1.3;
          if (infl > best[i]) { best[i] = infl; owner[i] = city.civ; }
        }
    }
    let changed = false;
    for (let i = 0; i < n * n; i++) if (w.owner[i] !== owner[i]) { changed = true; break; }
    if (changed) { w.owner.set(owner); w.ownerV++; }
    for (const c of sim.civs) c.tiles = 0;
    for (let i = 0; i < n * n; i++) { const c = sim.civById.get(w.owner[i]); if (c) c.tiles++; }
  }

  // ------------------------------------------------------------ boucle

  update(sim: SimulationEngine, yearly: boolean): void {
    for (const civ of sim.civs) {
      if (!civ.alive) continue;
      if ((sim.tick + civ.id) % 10 === 0) this.plan(sim, civ);
      civ.techProg += civ.pop * 0.0007 * PERS[civ.personality].tech * (civ.leader.goat ? 0.8 : 1);
      if (civ.tech < MAX_TECH && civ.techProg >= techThreshold(civ.tech)) {
        civ.techProg -= techThreshold(civ.tech);
        civ.tech++;
        sim.events.discovery(sim, civ, civ.tech);
      }
      if (civ.pop === 0 && sim.tick > 5) this.extinguish(sim, civ);
    }
    if (yearly) {
      for (const civ of sim.civs) if (civ.alive) this.yearly(sim, civ);
      this.updateTerritory(sim);
      this.checkWorldAlive(sim);
      // ruines
      for (const b of sim.buildings) if (b.ruin > 0 && --b.ruin === 0) sim.destroyBuilding(b);
      // villes sans habitants ni hall -> disparaissent
      for (const city of sim.cities.slice()) {
        if (city.pop === 0 && city.foundedYear < sim.year && !sim.buildings.some((b) => b.city === city.id && b.civ >= 0 && b.progress >= 1)) this.removeCity(sim, city);
      }
    }
  }

  removeCity(sim: SimulationEngine, city: City): void {
    sim.cities = sim.cities.filter((c) => c.id !== city.id);
    sim.cityById.delete(city.id);
    for (const b of sim.buildings) if (b.city === city.id && b.hp >= 0) sim.destroyBuilding(b);
    sim.pruneBuildings();
    const civ = sim.civById.get(city.civ);
    if (civ && civ.capital === city.id) {
      const next = sim.cities.filter((c) => c.civ === civ.id).sort((a, b) => b.pop - a.pop)[0];
      civ.capital = next ? next.id : -1;
    }
  }

  yearly(sim: SimulationEngine, civ: Civ): void {
    const rng = sim.rng;
    const P = PERS[civ.personality];
    const atWar = sim.wars.some((w) => w.active && (w.a === civ.id || w.d === civ.id));

    // dirigeant
    civ.leader.age++;
    const L = civ.leader;
    const hz = 0.003 + Math.max(0, L.age - 50) * 0.012;
    if (rng.chance(hz)) this.leaderDies(sim, civ, "age");
    else if (rng.chance(0.004)) this.leaderDies(sim, civ, "accident");

    // famine
    if (civ.food < civ.pop * 0.25 && civ.pop > 8) civ.famine++; else civ.famine = Math.max(0, civ.famine - 1);

    // sécheresse naturelle
    if (rng.chance(0.012) && !sim.inWeather("drought", 0, 0)) {
      const cities = sim.cities.filter((c) => c.civ === civ.id);
      if (cities.length) {
        const c = rng.pick(cities);
        if (!sim.weather.some((z) => z.kind === "drought" && Math.hypot(z.x - c.x, z.y - c.y) < 8)) {
          sim.weather.push({ kind: "drought", x: c.x + 0.5, y: c.y + 0.5, r: 9, ttl: 5 + rng.int(5) });
          civ.prayer = { want: "rain", tick: sim.tick };
          sim.events.drought(sim, civ, c);
        }
      }
    }

    // prières
    if (!civ.prayer || sim.tick - civ.prayer.tick > 12 * TPY) {
      let want: "rain" | "fire" | "food" | "victory" | "cure" | "gift" = "gift";
      const sick = sim.citizens.some((c) => c.civ === civ.id && c.sick > 0);
      if (sim.inWeather("drought", sim.cityById.get(civ.capital)?.x ?? 0, sim.cityById.get(civ.capital)?.y ?? 0)) want = "rain";
      else if (sick) want = "cure";
      else if (civ.food < civ.pop * 0.3) want = "food";
      else if (atWar) want = rng.chance(0.6) ? "fire" : "victory";
      else if (civ.personality === "fanatic" && rng.chance(0.5)) want = "fire";
      civ.prayer = { want, tick: sim.tick };
    }

    // technologie : bonus de recherche par les temples
    // stabilité
    const temples = Math.min(3, sim.econ.countBuilt(sim, civ.id, "temple"));
    const pop = Math.max(1, civ.pop);
    let sickShare = 0;
    for (const c of sim.citizens) if (c.civ === civ.id && c.sick > 0) sickShare++;
    sickShare /= pop;
    const warsHere = sim.wars.filter((w) => w.active && (w.a === civ.id || w.d === civ.id)).length;
    let target = 52 + (civ.food > pop * 0.6 ? 8 : civ.food < pop * 0.2 ? -12 : 0) - civ.famine * 5 + temples * 4
      + (civ.leader.intel - 0.5) * 12 - warsHere * 8 + (civ.blessed > 0 ? 15 : 0) + civ.avgFaith * 8 - sickShare * 40
      + (civ.leader.goat ? 8 : 0) - (civ.gold <= 0 && civ.soldiers > 0 ? 4 : 0) + (civ.tech >= 4 ? 4 : 0)
      - Math.max(0, sim.cities.filter((c) => c.civ === civ.id).length - 3) * 3; // surextension de l'empire
    for (const l of civ.laws) { if (l.id === "cloudBan") target += 3; if (l.id === "mandatoryDance") target += 4; if (l.id === "shadowTax") target -= 3; }
    civ.stability += Math.max(-6, Math.min(6, target - civ.stability));
    civ.stability = Math.max(0, Math.min(100, civ.stability));
    civ.strikes = Math.max(0, civ.strikes - 0.2);
    civ.lowStab = civ.stability < 12 ? civ.lowStab + 1 : 0;

    this.rebalanceJobs(sim, civ);
    this.tryFoundCity(sim, civ);

    // effondrement
    if (civ.lowStab >= 3) this.collapse(sim, civ);
    void P;
  }

  leaderDies(sim: SimulationEngine, civ: Civ, cause: "age" | "accident" | "war" | "lightning" | "meteor" | "plague" | "coup" | "wrath", detail?: string): void {
    const old = civ.leader;
    const rng = sim.rng;
    const violent = cause !== "age";
    const accident = cause === "accident" ? sim.events.pickAccident(sim, civ) : null;
    const dyn = rng.chance(violent && cause !== "accident" ? 0.5 : 0.85) ? old.dynasty + 1 : 1;
    let goat = false;
    const goatP = civ.personality === "stupid" ? 0.14 : civ.stability < 30 ? 0.06 : 0.004;
    if (rng.chance(goatP)) goat = true;
    const nl = this.makeLeader(sim, civ, dyn, goat, 22 + rng.int(14));
    civ.leader = nl;
    civ.stability = Math.max(0, civ.stability - (violent ? 10 : 3));
    sim.events.leaderDeath(sim, civ, old, nl, cause, accident, detail);
    if (goat) sim.events.goat(sim, civ, nl);
    if (accident?.law) sim.events.adoptLaw(sim, civ, accident.law, `après la mort de ${old.name}`);
  }

  collapse(sim: SimulationEngine, civ: Civ): void {
    civ.lowStab = 0;
    civ.stats.collapses++;
    const cities = sim.cities.filter((c) => c.civ === civ.id);
    const rng = sim.rng;
    const old = civ.leader;
    if (cities.length >= 2) {
      // sécession : la ville la plus éloignée de la capitale fait sécession
      const cap = sim.cityById.get(civ.capital) ?? cities[0];
      const rebels = cities.filter((c) => c.id !== cap.id).sort((a, b) => Math.hypot(b.x - cap.x, b.y - cap.y) - Math.hypot(a.x - cap.x, a.y - cap.y))[0];
      const personality = rng.pick(PERSONALITIES.filter((p) => p !== civ.personality));
      const nc = this.createRebel(sim, civ, rebels, personality);
      civ.stability = 38;
      sim.events.breakaway(sim, civ, nc, rebels);
    } else {
      // âge sombre
      let lost = 0;
      for (const c of sim.citizens) if (c.civ === civ.id && c.army < 0 && rng.chance(0.2)) { sim.killCitizen(c, "unrest"); lost++; }
      if (civ.tech > 0 && rng.chance(0.5)) civ.tech--;
      civ.techProg = 0;
      civ.gold *= 0.3;
      civ.stability = 35;
      civ.leader = this.makeLeader(sim, civ, 1, false, 30);
      sim.events.collapse(sim, civ, old, lost);
    }
  }

  createRebel(sim: SimulationEngine, from: Civ, city: City, personality: PersonalityId): Civ {
    const rng = sim.rng;
    const idx = sim.civs.length;
    const culture = from.culture;
    const name = genPlaceName(rng, (culture + 1) % 4);
    const used = new Set(sim.civs.filter((c) => c.alive).map((c) => c.color));
    const color = CIV_COLORS.find((c) => !used.has(c)) ?? CIV_COLORS[idx % CIV_COLORS.length];
    const nc: Civ = {
      ...from,
      id: sim.newId(), name, formal: formalName(rng.pick(CIV_PREFIX_FOR(personality)), name), color, personality, culture: (culture + 1) % 4,
      religion: rng.chance(0.5) ? from.religion : genReligion(rng), leader: null as unknown as Leader,
      tech: Math.max(0, from.tech - (rng.chance(0.5) ? 1 : 0)), techProg: 0, food: from.food * 0.25, wood: from.wood * 0.3, stone: from.stone * 0.3, gold: from.gold * 0.2,
      stability: 50, lowStab: 0, capital: city.id, foundedYear: sim.year, laws: [], blessed: 0, prayer: null, lastWarEnd: -9999,
      lastCityTick: sim.tick, lastEvt: {}, jobs: { ...from.jobs }, stats: { births: 0, deaths: 0, kills: 0, warsWon: 0, warsLost: 0, peakPop: 0, collapses: 0 }, famine: 0, strikes: 0, tiles: 0,
    };
    nc.leader = this.makeLeader(sim, nc, 1);
    from.food *= 0.75; from.wood *= 0.7; from.stone *= 0.7; from.gold *= 0.8;
    sim.civs.push(nc);
    sim.civById.set(nc.id, nc);
    city.civ = nc.id;
    for (const b of sim.buildings) if (b.city === city.id && b.civ >= 0) b.civ = nc.id;
    for (const c of sim.citizens) if (c.city === city.id) { c.civ = nc.id; if (c.army >= 0) { c.army = -1; } }
    // les armées de l'ancienne civ perdent les rebelles
    for (const a of sim.armies) a.soldiers = a.soldiers.filter((id) => sim.citizenById.get(id)?.civ === a.civ);
    sim.diplo.initRelations(sim, nc);
    sim.addOpinion(nc.id, from.id, -40); sim.addOpinion(from.id, nc.id, -40);
    sim.grudgeWhy[`${from.id}>${nc.id}`] = "la sécession";
    sim.grudge[`${from.id}>${nc.id}`] = 0.7;
    return nc;
  }

  extinguish(sim: SimulationEngine, civ: Civ): void {
    if (!civ.alive) return;
    civ.alive = false;
    civ.extinctYear = sim.year;
    for (const b of sim.buildings) if (b.civ === civ.id) { if (b.progress >= 1) { b.ruin = 40; b.civ = -1; b.hp = 1; } else sim.destroyBuilding(b); }
    sim.pruneBuildings();
    for (const c of sim.cities.slice()) if (c.civ === civ.id) { sim.cities = sim.cities.filter((x) => x.id !== c.id); sim.cityById.delete(c.id); }
    for (const a of sim.armies) if (a.civ === civ.id) a.soldiers = [];
    sim.war.endWarsOf(sim, civ, "collapse");
    sim.events.extinct(sim, civ);
    this.updateTerritory(sim);
  }

  /** Le monde ne doit jamais se figer : une nouvelle tribu apparaît s'il ne reste personne (ou presque). */
  checkWorldAlive(sim: SimulationEngine): void {
    const alive = sim.aliveCivs().length;
    const years = (sim.tick - sim.lastTribeTick) / TPY;
    if ((alive === 0 && years > 5) || (alive === 1 && years > 35) || (alive === 2 && years > 90)) this.spawnTribe(sim);
  }

  spawnTribe(sim: SimulationEngine): Civ | null {
    const w = sim.world;
    const rng = sim.rng;
    let best: { x: number; y: number } | null = null, bs = -Infinity;
    const rid = w.largestRegionId();
    for (let k = 0; k < 200; k++) {
      const x = 5 + rng.int(w.size - 10), y = 5 + rng.int(w.size - 10), i = y * w.size + x;
      if (w.type[i] !== T.GRASS || w.bld[i] >= 0 || w.trees[i] > 0 || w.region[i] !== rid || w.fertility[i] < 0.4) continue;
      let md = 99;
      for (const c of sim.cities) md = Math.min(md, Math.hypot(c.x - x, c.y - y));
      if (md < 12) continue;
      const sc = md + w.fertility[i] * 5 + rng.next() * 3;
      if (sc > bs) { bs = sc; best = { x, y }; }
    }
    if (!best) return null;
    sim.lastTribeTick = sim.tick;
    const pers = rng.pick(PERSONALITIES);
    const civ = this.createCiv(sim, best.x, best.y, pers, 12 + rng.int(4), { fromSplit: true });
    civ.food = 80; civ.wood = 50;
    sim.diplo.initRelations(sim, civ);
    // le monde laisse un peu de temps aux nouveaux venus : trêve de 35 ans
    for (const o of sim.civs) if (o.alive && o.id !== civ.id) sim.truce[sim.pairKey(o.id, civ.id)] = sim.tick + 35 * TPY;
    this.updateTerritory(sim);
    sim.events.newTribe(sim, civ);
    return civ;
  }
}

function CIV_PREFIX_FOR(p: PersonalityId): string[] {
  return CIV_PREFIX_MAP[p];
}
import { CIV_PREFIX as CIV_PREFIX_MAP } from "./data";

function clamp01(v: number): number {
  return Math.max(0.02, Math.min(1, v));
}
void RNG;
