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
  market: { wood: 15, stone: 10, gold: 0, time: 90, hp: 60, label: "Marché" },
  walls: { wood: 20, stone: 30, gold: 0, time: 220, hp: 250, label: "Remparts" },
  mill: { wood: 20, stone: 5, gold: 0, time: 90, hp: 60, label: "Moulin" },
  forge: { wood: 15, stone: 25, gold: 0, time: 120, hp: 90, label: "Forge" },
  factory: { wood: 30, stone: 40, gold: 20, time: 200, hp: 160, label: "Usine" },
  station: { wood: 25, stone: 30, gold: 15, time: 180, hp: 120, label: "Gare" },
  power: { wood: 30, stone: 50, gold: 40, time: 260, hp: 200, label: "Centrale" },
  lab: { wood: 20, stone: 40, gold: 60, time: 240, hp: 140, label: "Laboratoire" },
};
export const BUILDING_LABEL = Object.fromEntries(Object.entries(COSTS).map(([k, v]) => [k, v.label])) as Record<BuildingType, string>;

/** Capacité d'accueil d'une maison selon son époque (cabane, maison de pierre, colombages, briques, immeuble, tour). */
export const HOUSE_CAP = [5, 5, 6, 7, 9, 11];
export const ERA_BUILDING_NAMES: Record<string, string[]> = {
  house: ["Hutte", "Maison de pierre", "Maison à colombages", "Maison de brique", "Immeuble", "Tour d'habitation"],
  hall: ["Grande hutte", "Palais de pierre", "Hôtel de ville", "Hôtel de ville de brique", "Tour de bureaux", "Dôme administratif"],
  farm: ["Champ", "Champ irrigué", "Ferme à meules", "Ferme à grange", "Silos & serre", "Ferme verticale"],
  lumber: ["Cabane de bûcherons", "Hangar de pierre", "Scierie à bras", "Scierie à vapeur", "Entrepôt", "Dépôt robotisé"],
  quarry: ["Tas de cailloux", "Carrière à chariot", "Carrière à grue", "Carrière à vapeur", "Excavatrice", "Foreuse laser"],
  barracks: ["Camp palissadé", "Caserne de pierre", "Donjon-caserne", "Caserne de brique", "Bunker", "Hangar à drones"],
  temple: ["Cercle de pierres", "Temple à colonnes", "Cathédrale", "Cathédrale gothique", "Église moderne", "Monolithe"],
  castle: ["Château", "Château", "Château", "Forteresse à canons", "Fort de béton", "Citadelle à bouclier"],
};

/** Ressources, rendements, coûts et revenus. */
export class EconomySystem {
  cost(t: BuildingType): BuildInfo {
    return COSTS[t];
  }
  /** Coût d'une modernisation d'un bâtiment vers une époque supérieure. */
  upgradeCost(t: BuildingType, toEra: number): BuildInfo {
    const c = COSTS[t], k = 0.45 * (1 + 0.25 * toEra);
    return { ...c, wood: Math.ceil(c.wood * k), stone: Math.ceil(c.stone * k), gold: Math.ceil(c.gold * k + toEra * 2), time: Math.ceil(c.time * 0.7) };
  }
  /** Les modernisations peuvent être payées en or (matériaux importés : 1 bois = 2 or, 1 pierre = 3 or). */
  private upgradeBill(civ: Civ, t: BuildingType, toEra: number): { wood: number; stone: number; gold: number } {
    const c = this.upgradeCost(t, toEra);
    const woodUse = Math.min(c.wood, civ.wood), stoneUse = Math.min(c.stone, civ.stone);
    return { wood: woodUse, stone: stoneUse, gold: c.gold + (c.wood - woodUse) * 2 + (c.stone - stoneUse) * 3 };
  }
  canAffordUpgrade(civ: Civ, t: BuildingType, toEra: number): boolean {
    return civ.gold >= this.upgradeBill(civ, t, toEra).gold;
  }
  spendUpgrade(civ: Civ, t: BuildingType, toEra: number): void {
    const c = this.upgradeBill(civ, t, toEra);
    civ.wood -= c.wood; civ.stone -= c.stone; civ.gold -= c.gold;
  }

  /** Facture d'un chantier : le bois/la pierre manquants sont importés contre de l'or (1 bois = 2 or, 1 pierre = 3 or). */
  private bill(civ: Civ, c: { wood: number; stone: number; gold: number }): { wood: number; stone: number; gold: number } {
    const woodUse = Math.min(c.wood, civ.wood), stoneUse = Math.min(c.stone, civ.stone);
    return { wood: woodUse, stone: stoneUse, gold: c.gold + (c.wood - woodUse) * 2 + (c.stone - stoneUse) * 3 };
  }
  canAfford(civ: Civ, t: BuildingType): boolean {
    const c = COSTS[t];
    if (civ.wood >= c.wood && civ.stone >= c.stone && civ.gold >= c.gold) return true;
    // import de matériaux : réservé aux civilisations riches (jamais en dessous de 150 or de réserve)
    return civ.gold >= 150 && civ.gold - this.bill(civ, c).gold >= 100;
  }
  spend(civ: Civ, t: BuildingType): void {
    const c = this.bill(civ, COSTS[t]);
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
    return 0.05 * Math.max(0.1, fert) * techM * (1 + 0.06 * b.era) * civ.mods.farm * this.weatherMult(sim, b.x, b.y) * bless * this.lawMult(civ, "farm");
  }
  woodYield(civ: Civ, nearCamp: boolean): number {
    return 0.05 * (1 + (civ.tech >= 2 ? 0.2 : 0)) * (nearCamp ? 1.3 : 1) * civ.mods.wood * this.lawMult(civ, "wood");
  }
  stoneYield(civ: Civ, nearQuarry: boolean): number {
    return 0.04 * (1 + civ.tech * 0.03) * (nearQuarry ? 1.3 : 1) * civ.mods.stone;
  }
  storageCap(sim: SimulationEngine, civ: Civ): number {
    let farms = 0, cities = 0;
    for (const b of sim.bOf(civ.id, "farm")) if (b.progress >= 1) farms++;
    for (const c of sim.cities) if (c.civ === civ.id) cities++;
    return 120 + cities * 40 + farms * 15;
  }
  nearBuilding(sim: SimulationEngine, civ: number, type: BuildingType, x: number, y: number, r: number): boolean {
    for (const b of sim.bOf(civ, type)) {
      if (b.progress >= 1 && Math.abs(b.x - x) < r && Math.abs(b.y - y) < r) return true;
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
      if (b.type === "house") cap += HOUSE_CAP[Math.min(5, b.era)];
      else if (b.type === "hall") cap += 8 + b.era;
      else if (b.type === "castle") cap += 10;
    }
    return cap;
  }

  update(sim: SimulationEngine, yearly: boolean): void {
    for (const civ of sim.civs) {
      if (!civ.alive) continue;
      const cap = this.storageCap(sim, civ);
      const gold = civ.pop * 0.0012 * (1 + civ.tech * 0.12) * (Math.max(10, civ.stability) / 60) * civ.mods.gold * this.lawMult(civ, "gold");
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
