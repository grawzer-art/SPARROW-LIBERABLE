import type { SimulationEngine } from "./SimulationEngine";
import type { Building, BuildingType, Civ } from "./types";
import { T } from "./World";

export interface BuildInfo { wood: number; stone: number; gold: number; time: number; hp: number; label: string; }

const COSTS: Record<BuildingType, BuildInfo> = {
  hall: { wood: 25, stone: 0, gold: 0, time: 140, hp: 200, label: "Hôtel de ville" },
  house: { wood: 8, stone: 0, gold: 0, time: 70, hp: 60, label: "Maison" },
  farm: { wood: 6, stone: 0, gold: 0, time: 50, hp: 30, label: "Ferme" },
  lumber: { wood: 6, stone: 0, gold: 0, time: 50, hp: 40, label: "Camp de bûcherons" },
  quarry: { wood: 8, stone: 0, gold: 0, time: 60, hp: 40, label: "Carrière" },
  barracks: { wood: 20, stone: 10, gold: 0, time: 120, hp: 120, label: "Caserne" },
  temple: { wood: 15, stone: 15, gold: 0, time: 160, hp: 100, label: "Temple" },
  castle: { wood: 30, stone: 40, gold: 20, time: 400, hp: 400, label: "Château" },
};
export const BUILDING_LABEL = Object.fromEntries(Object.entries(COSTS).map(([k, v]) => [k, v.label])) as Record<BuildingType, string>;

/** Ressources, rendements, coûts et revenus. */
export class EconomySystem {
  cost(t: BuildingType): BuildInfo {
    return COSTS[t];
  }
  canAfford(civ: Civ, t: BuildingType): boolean {
    const c = COSTS[t];
    return civ.wood >= c.wood && civ.stone >= c.stone && civ.gold >= c.gold;
  }
  spend(civ: Civ, t: BuildingType): void {
    const c = COSTS[t];
    civ.wood -= c.wood; civ.stone -= c.stone; civ.gold -= c.gold;
  }

  /** Multiplicateur météo : pluie divine/naturelle (+), sécheresse (-). */
  weatherMult(sim: SimulationEngine, x: number, y: number): number {
    let m = 1;
    if (sim.inWeather("drought", x, y)) m *= 0.5;
    if (sim.inWeather("rain", x, y)) m = m < 1 ? 1 : 1.5;
    return m;
  }
  rainFactor(sim: SimulationEngine, x: number, y: number): number {
    let m = 1;
    if (sim.inWeather("drought", x, y)) m = 0.25;
    if (sim.inWeather("rain", x, y)) m = 3;
    return m;
  }

  lawMult(civ: Civ, kind: "farm" | "wood" | "gold"): number {
    let m = 1;
    for (const l of civ.laws) {
      if (kind === "wood" && l.id === "noWheels") m *= 0.8;
      if (kind === "farm" && l.id === "cloudBan") m *= 0.95;
      if (kind === "farm" && l.id === "mandatoryDance") m *= 0.97;
      if (kind === "gold" && l.id === "noTuesday") m *= 0.9;
      if (kind === "gold" && l.id === "shadowTax") m *= 1.12;
    }
    return m;
  }

  farmYield(sim: SimulationEngine, civ: Civ, b: Building): number {
    const w = sim.world;
    const i = w.idx(b.x, b.y);
    const techM = 1 + (civ.tech >= 1 ? 0.2 : 0) + Math.max(0, civ.tech - 1) * 0.04;
    const fert = 0.5 + w.fertility[i] * 0.9 - w.scorch[i] * 0.5;
    const bless = civ.blessed > 0 ? 1.3 : 1;
    return 0.05 * Math.max(0.1, fert) * techM * this.weatherMult(sim, b.x, b.y) * bless * this.lawMult(civ, "farm");
  }
  woodYield(civ: Civ, nearCamp: boolean): number {
    return 0.05 * (1 + (civ.tech >= 2 ? 0.2 : 0)) * (nearCamp ? 1.3 : 1) * this.lawMult(civ, "wood");
  }
  stoneYield(civ: Civ, nearQuarry: boolean): number {
    return 0.04 * (1 + civ.tech * 0.03) * (nearQuarry ? 1.3 : 1);
  }
  storageCap(sim: SimulationEngine, civ: Civ): number {
    let farms = 0, cities = 0;
    for (const b of sim.buildings) if (b.civ === civ.id && b.type === "farm" && b.progress >= 1) farms++;
    for (const c of sim.cities) if (c.civ === civ.id) cities++;
    return 120 + cities * 40 + farms * 15;
  }
  nearBuilding(sim: SimulationEngine, civ: number, type: BuildingType, x: number, y: number, r: number): boolean {
    for (const b of sim.buildings) {
      if (b.civ === civ && b.type === type && b.progress >= 1 && Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return true;
    }
    return false;
  }
  countBuilt(sim: SimulationEngine, civId: number, type: BuildingType, cityId = -1): number {
    let n = 0;
    for (const b of sim.buildings) if (b.civ === civId && b.type === type && b.progress >= 1 && (cityId < 0 || b.city === cityId)) n++;
    return n;
  }
  cityCap(sim: SimulationEngine, cityId: number): number {
    let cap = 4;
    for (const b of sim.buildings) {
      if (b.city !== cityId || b.progress < 1 || b.civ < 0) continue;
      if (b.type === "house") cap += 5;
      else if (b.type === "hall") cap += 8;
      else if (b.type === "castle") cap += 10;
    }
    return cap;
  }

  update(sim: SimulationEngine, yearly: boolean): void {
    for (const civ of sim.civs) {
      if (!civ.alive) continue;
      const cap = this.storageCap(sim, civ);
      const gold = civ.pop * 0.0012 * (1 + civ.tech * 0.12) * (Math.max(10, civ.stability) / 60) * this.lawMult(civ, "gold");
      const upkeep = civ.soldiers * 0.0016;
      civ.gold += gold - upkeep;
      if (civ.gold < 0) {
        civ.gold = 0;
        if (civ.soldiers > 0 && yearly) civ.stability = Math.max(0, civ.stability - 1.5); // soldats impayés
      }
      if (civ.food > cap) civ.food = cap + (civ.food - cap) * 0.9; // gaspillage
      if (civ.food > cap * 1.5) civ.food = cap * 1.5;
      civ.wood = Math.min(civ.wood, 250 + cap);
      civ.stone = Math.min(civ.stone, 250 + cap);
      civ.food = Math.max(0, civ.food);
      civ.wood = Math.max(0, civ.wood);
      civ.stone = Math.max(0, civ.stone);
      if (civ.blessed > 0) civ.blessed--;
    }
    if (yearly) {
      for (const z of sim.weather) z.ttl -= 1;
      sim.weather = sim.weather.filter((z) => z.ttl > 0);
    }
  }

  hasStoneNear(sim: SimulationEngine, x: number, y: number, r: number): boolean {
    const w = sim.world;
    for (let ty = Math.max(0, Math.floor(y - r)); ty <= Math.min(w.size - 1, Math.floor(y + r)); ty++)
      for (let tx = Math.max(0, Math.floor(x - r)); tx <= Math.min(w.size - 1, Math.floor(x + r)); tx++) {
        const i = ty * w.size + tx;
        if (w.type[i] === T.HILL && w.stone[i] > 1) return true;
      }
    return false;
  }
}
