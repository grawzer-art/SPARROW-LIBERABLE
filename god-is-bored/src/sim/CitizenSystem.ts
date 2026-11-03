import { CITIZEN_SPEED, TICKS_PER_YEAR } from "./config";
import { moveToward } from "./path";
import type { SimulationEngine } from "./SimulationEngine";
import { ACT } from "./SoulSystem";
import type { Building, Citizen, City, Civ } from "./types";
import { T } from "./World";

const TPY = TICKS_PER_YEAR;

/** Simulation individuelle : besoins, travail, déplacements, reproduction, maladie, mort. */
export class CitizenSystem {
  update(sim: SimulationEngine): void {
    const citizens = sim.citizens;
    sim.reindex();
    sim.hash.rebuild(citizens);
    sim.rebuildBuildingIndex();
    sim.soul.beginTick(sim);
    for (const b of sim.buildings) b.workers = 0;
    for (let i = 0; i < citizens.length; i++) {
      const c = citizens[i];
      if (c.dead) continue;
      this.step(sim, c);
    }
    sim.removeDead();
    sim.pruneBuildings();
    this.census(sim);
  }

  census(sim: SimulationEngine): void {
    for (const civ of sim.civs) {
      civ.pop = 0; civ.adults = 0; civ.soldiers = 0; civ.farmers = 0; civ.avgIntel = 0; civ.avgFaith = 0;
      civ.jobs = { child: 0, farmer: 0, lumberjack: 0, miner: 0, builder: 0, soldier: 0, scholar: 0 };
    }
    for (const city of sim.cities) city.pop = 0;
    for (const c of sim.citizens) {
      const civ = sim.civById.get(c.civ);
      if (!civ) continue;
      civ.pop++;
      civ.jobs[c.job]++;
      civ.avgIntel += c.intel;
      civ.avgFaith += c.faith;
      if (c.job !== "child") civ.adults++;
      if (c.job === "soldier") civ.soldiers++;
      if (c.job === "farmer") civ.farmers++;
      const city = sim.cityById.get(c.city);
      if (city) city.pop++;
    }
    for (const civ of sim.civs) {
      if (civ.pop > 0) { civ.avgIntel /= civ.pop; civ.avgFaith /= civ.pop; }
      if (civ.pop > civ.stats.peakPop) civ.stats.peakPop = civ.pop;
    }
    if (sim.tick % 10 === 0) for (const city of sim.cities) city.cap = sim.econ.cityCap(sim, city.id);
  }

  step(sim: SimulationEngine, c: Citizen): void {
    const world = sim.world;
    const rng = sim.rng;
    const civ = sim.civById.get(c.civ);
    if (!civ) { sim.killCitizen(c, "unrest"); return; }
    c.px = c.x; c.py = c.y;
    c.age += 1 / TPY;

    // --- environnement ---
    const ti = world.tileAt(c.x, c.y);
    if (ti < 0 || !world.passable(c.x, c.y)) {
      if (!this.rescue(sim, c)) { sim.killCitizen(c, "drown"); return; }
    } else if (world.fire[ti] > 0) {
      c.hp -= 2.5;
      c.panic = Math.max(c.panic, 25);
      c.fx = c.x + (rng.next() - 0.5); c.fy = c.y + (rng.next() - 0.5);
      if (c.hp <= 0) { sim.killCitizen(c, "fire"); return; }
    }

    // --- biologie ---
    const campaign = c.army >= 0;
    if (campaign) {
      // ravitaillement des armées : payé par le stock de la civilisation
      if (civ.food > 0.03) { civ.food -= 0.012; c.hunger = Math.max(0, c.hunger - 0.4); }
      else c.hunger += 0.7;
    } else c.hunger += 0.7;
    if (c.hunger > 100) {
      c.hp -= 0.8;
      if (c.hp <= 0) { sim.killCitizen(c, "famine"); return; }
    } else if (c.hunger < 70 && c.sick === 0 && c.hp < 100) c.hp = Math.min(100, c.hp + (civ.blessed > 0 ? 0.2 : 0.08));

    if (c.sick > 0) {
      c.sick--;
      const vuln = (c.age < 5 || c.age > 50 ? 1.5 : 1) * (c.hunger > 60 ? 1.3 : 1) * (0.85 + ((c.id * 37) % 30) / 100);
      c.hp -= 1.15 * vuln * (1 - Math.min(0.75, 0.07 * civ.tech));
      if (c.hp <= 0) { sim.killCitizen(c, "plague"); return; }
      if (c.sick === 0) c.immune = 900;
      else if (rng.chance(0.5)) {
        sim.hash.query(sim.citizens, c.x, c.y, 1.4, (o) => {
          if (o !== c && o.sick === 0 && o.immune === 0 && !o.dead && rng.chance(0.035 * (1 - Math.min(0.7, 0.04 * civ.tech)))) o.sick = 70;
        });
      }
    } else if (c.immune > 0) c.immune--;

    // mort naturelle
    if (c.age > 55) {
      const hz = Math.pow((c.age - 55) / 25, 2) * 0.0035;
      if (rng.chance(hz) || c.age > 100) { sim.killCitizen(c, "age"); return; }
    }
    if (rng.chance(c.age < 4 ? 0.0002 : 0.00004)) { sim.killCitizen(c, "accident"); return; }

    // devenir adulte
    if (c.job === "child" && c.age >= 14) c.job = sim.civSys.pickJob(sim, civ);

    // --- âme : besoins individuels, logement, perception du danger ---
    const soul = sim.soul, ss = soul.ensure(c);
    soul.tickNeeds(sim, c);
    if (ss.home < 0 ? (sim.tick + c.id) % 20 === 0 : (sim.tick + c.id) % 90 === 0) soul.assignHome(sim, c);
    if (c.panic <= 0 && (sim.tick + c.id) % 5 === 0) soul.sense(sim, c);

    // --- comportement (priorités) ---
    // 8. fuir les dangers
    if (c.panic > 0) {
      c.panic--;
      c.state = "flee";
      if (ss.act !== ACT.FLEE) { ss.act = ACT.FLEE; ss.since = sim.tick; ss.target = -1; }
      ss.until = 0;
      const dx = c.x - c.fx, dy = c.y - c.fy, d = Math.hypot(dx, dy) || 1;
      moveToward(world, c, c.x + (dx / d) * 3, c.y + (dy / d) * 3, CITIZEN_SPEED * 1.6, 0.05);
      if (c.panic === 0) { c.state = "idle"; c.think = 0; }
      return;
    }
    // 9. participer aux conflits
    if (c.army >= 0) { this.serveArmy(sim, c); return; }

    // couple en pleine démographie
    if (c.mateT > 0) {
      c.mateT--;
      c.state = "mate";
      if (c.mateT === 0 && c.female) this.giveBirth(sim, c, civ);
      return;
    }

    const city = sim.cityById.get(c.city) ?? this.nearestCity(sim, c, civ.id);
    if (city && c.city !== city.id) c.city = city.id;

    // décision par utilité : travailler, se nourrir, se reposer, discuter ou flâner (hystérésis : pas de changement d'avis incessant)
    const act = soul.choose(sim, c, civ);
    if (act === ACT.FOOD || c.state === "eat" || c.state === "forage") {
      if (this.seekFood(sim, c, civ, city)) return;
      // nourri, ou aucune nourriture accessible : l'action se termine (ou échoue) et la décision est reprise
      if (c.hunger > 60) soul.fail(sim, c, ACT.FOOD, 12); else soul.done(sim, c);
    } else if (act === ACT.REST) {
      if (soul.runRest(sim, c, city)) return;
    } else if (act === ACT.SOCIAL) {
      if (soul.runSocial(sim, c)) return;
    } else if (act === ACT.RELAX) {
      if (c.cooldown > 0) c.cooldown--;
      this.idleAround(sim, c, city, c.job === "child" ? 3 : 4.5);
      return;
    }

    // 5. se reproduire
    if (c.female && c.job !== "child" && c.cooldown <= 0 && c.age >= 16 && c.age <= 42 && (sim.tick + c.id) % 10 === 0) {
      if (this.tryMate(sim, c, civ, city)) return;
    }
    if (c.cooldown > 0) c.cooldown--;

    // 2-4. travailler / construire / se déplacer
    this.doJob(sim, c, civ, city);
  }

  rescue(sim: SimulationEngine, c: Citizen): boolean {
    const w = sim.world;
    for (let r = 1; r <= 3; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = c.x + dx, y = c.y + dy;
          if (w.passable(x, y)) { c.x = x; c.y = y; c.panic = 20; c.fx = c.x - dx; c.fy = c.y - dy; return true; }
        }
    return false;
  }

  nearestCity(sim: SimulationEngine, c: Citizen, civId: number): City | null {
    let best: City | null = null, bd = Infinity;
    for (const k of sim.cities) {
      if (k.civ !== civId) continue;
      const d = Math.hypot(k.x - c.x, k.y - c.y);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  serveArmy(sim: SimulationEngine, c: Citizen): void {
    const a = sim.armyById.get(c.army);
    if (!a) { c.army = -1; c.state = "idle"; c.think = 0; return; }
    const ang = c.slot * 2.4, rad = 0.2 + 0.2 * Math.sqrt(c.slot);
    const tx = a.x + Math.cos(ang) * rad, ty = a.y + Math.sin(ang) * rad;
    const r = moveToward(sim.world, c, tx, ty, CITIZEN_SPEED * 1.6, 0.08);
    if (r === 2) { c.x = a.x; c.y = a.y; }
    c.state = a.combat ? "fight" : "march";
  }

  seekFood(sim: SimulationEngine, c: Citizen, civ: Civ, city: City | null): boolean {
    const world = sim.world;
    if (civ.food >= 1) {
      if (c.state !== "eat") {
        const site = this.nearestFoodSite(sim, c);
        if (site) { c.tx = site.x + 0.5; c.ty = site.y + 0.5; c.state = "eat"; }
      }
      if (c.state === "eat") {
        const r = moveToward(world, c, c.tx, c.ty, CITIZEN_SPEED, 1.3);
        if (r === 1) {
          civ.food -= 1;
          sim.soul.stats.eats++;
          c.hunger = Math.max(0, c.hunger - 70);
          c.state = "idle"; c.think = 0; c.tx = -1;
          return false;
        }
        if (r === 2) { c.state = "idle"; c.tx = -1; return false; }
        return true;
      }
    }
    // pas de stock : cueillette
    if (c.state !== "forage" || c.tx < 0) {
      const ox = city ? city.x : c.x, oy = city ? city.y : c.y;
      let best = -1, bd = Infinity;
      for (let k = 0; k < 14; k++) {
        const x = Math.floor(ox + (sim.rng.next() - 0.5) * 14), y = Math.floor(oy + (sim.rng.next() - 0.5) * 14);
        if (!world.inb(x, y)) continue;
        const i = y * world.size + x;
        if (world.type[i] !== T.GRASS || world.fertility[i] < 0.25 || world.fire[i] > 0) continue;
        const d = Math.hypot(x - c.x, y - c.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best < 0) { c.state = "idle"; return false; }
      c.tx = (best % world.size) + 0.5; c.ty = ((best / world.size) | 0) + 0.5;
    }
    c.state = "forage";
    const r = moveToward(world, c, c.tx, c.ty, CITIZEN_SPEED, 0.2);
    if (r === 1) {
      c.hunger -= 1.6;
      const i = world.tileAt(c.x, c.y);
      if (i >= 0) world.fertility[i] = Math.max(0, world.fertility[i] - 0.003);
      if (c.hunger <= 30) { c.state = "idle"; c.tx = -1; c.think = 0; return false; }
    } else if (r === 2) { c.tx = -1; c.state = "idle"; return false; }
    return true;
  }

  /** Bâtiment ravitaillé le plus proche (grenier, maison ou ferme). */
  nearestFoodSite(sim: SimulationEngine, c: Citizen): Building | null {
    let best: Building | null = null, bd = Infinity;
    for (const t of ["hall", "house", "farm", "barracks"] as const) {
      for (const b of sim.bOf(c.civ, t)) {
        if (b.progress < 1 || b.hp <= 0) continue;
        const d = Math.hypot(b.x - c.x, b.y - c.y);
        if (d < bd) { bd = d; best = b; }
      }
    }
    return best;
  }

  tryMate(sim: SimulationEngine, c: Citizen, civ: Civ, city: City | null): boolean {
    if (!city || city.pop >= city.cap || civ.food < 8 || c.hunger > 45 || c.hp < 50 || c.sick > 0) return false;
    let mate: Citizen | null = null;
    sim.hash.query(sim.citizens, c.x, c.y, 3.5, (o) => {
      if (mate || o.female || o.civ !== c.civ || o.age < 16 || o.age > 60 || o.sick > 0 || o.army >= 0 || o.mateT > 0 || o.panic > 0 || o.hunger > 60) return;
      mate = o;
    });
    const m = mate as Citizen | null;
    if (!m) return false;
    c.mateT = 14; m.mateT = 14;
    sim.soul.ensure(c).mate = m.id; sim.soul.ensure(m).mate = c.id;
    c.state = "mate"; m.state = "mate";
    c.cooldown = 80 + sim.rng.int(60);
    return true;
  }

  giveBirth(sim: SimulationEngine, mother: Citizen, civ: Civ): void {
    const city = sim.cityById.get(mother.city);
    if (!city || city.pop >= city.cap) return;
    // plafond mondial de population (performances, notamment sur iPhone) : la natalité s'effondre vers 2 500 habitants
    const world = Math.max(0, Math.min(1, (2500 - sim.citizens.length) / 600));
    const p = (civ.stability > 25 ? 0.75 : 0.4) * (civ.blessed > 0 ? 1.3 : 1) * world;
    if (!sim.rng.chance(p)) return;
    // équilibre démographique : une population qui manque de femmes (ou d'hommes) finit par s'éteindre sans raison narrative
    let f = 0, m = 0;
    for (const o of sim.citizens) if (o.civ === civ.id && !o.dead) { if (o.female) f++; else m++; }
    const tot = Math.max(1, f + m);
    const female = sim.rng.chance(Math.max(0.2, Math.min(0.8, 0.5 + (0.5 - f / tot))));
    const child = sim.spawnCitizen(civ, city, mother.x, mother.y, 0, { parent: mother, female });
    child.job = "child";
    civ.stats.births++;
    sim.stats.births++;
  }

  // ---------------------------------------------------------------- travail

  idleAround(sim: SimulationEngine, c: Citizen, city: City | null, radius: number): void {
    const world = sim.world;
    if (c.think <= 0) {
      const ox = city ? city.x + 0.5 : c.x, oy = city ? city.y + 0.5 : c.y;
      for (let k = 0; k < 6; k++) {
        const a = sim.rng.next() * Math.PI * 2, r = sim.rng.next() * radius;
        const x = ox + Math.cos(a) * r, y = oy + Math.sin(a) * r;
        if (world.passable(x, y)) { c.tx = x; c.ty = y; break; }
      }
      c.think = 25 + sim.rng.int(50);
      c.state = "wander";
    }
    c.think--;
    if (c.state === "wander") {
      const r = moveToward(world, c, c.tx, c.ty, CITIZEN_SPEED * 0.5, 0.15);
      if (r !== 0) c.state = "idle";
    } else c.state = "idle";
  }

  doJob(sim: SimulationEngine, c: Citizen, civ: Civ, city: City | null): void {
    const world = sim.world;
    switch (c.job) {
      case "farmer": {
        let b = c.work >= 0 ? sim.buildingById.get(c.work) : undefined;
        if (!b || b.type !== "farm" || b.progress < 1 || b.civ !== c.civ || b.hp <= 0 || b.workers >= 3 + Math.floor(civ.tech / 4) && c.state !== "work") {
          b = this.findBuilding(sim, c, "farm", 3 + Math.floor(civ.tech / 4));
          c.work = b ? b.id : -1;
        }
        if (!b) { this.idleAround(sim, c, city, 3); return; }
        b.workers++;
        const r = moveToward(world, c, b.x + 0.5, b.y + 0.5, CITIZEN_SPEED, 0.3);
        if (r === 1) {
          c.state = "work";
          civ.food += sim.econ.farmYield(sim, civ, b) * sim.soul.workFactor(c);
        } else if (r === 2) c.work = -1;
        else c.state = "travel";
        return;
      }
      case "lumberjack": {
        if (c.wx < 0 || world.trees[world.idx(Math.floor(c.wx), Math.floor(c.wy))] === 0 || world.fire[world.idx(Math.floor(c.wx), Math.floor(c.wy))] > 0) {
          if (!this.findResourceTile(sim, c, city, civ, "tree")) { this.idleAround(sim, c, city, 3); return; }
        }
        const r = moveToward(world, c, c.wx, c.wy, CITIZEN_SPEED, 0.3);
        if (r === 1) {
          c.state = "work";
          const near = sim.econ.nearBuilding(sim, civ.id, "lumber", c.x, c.y, 7);
          civ.wood += sim.econ.woodYield(civ, near) * sim.soul.workFactor(c);
          if (++c.workT >= 24) {
            c.workT = 0;
            const i = world.idx(Math.floor(c.wx), Math.floor(c.wy));
            if (world.trees[i] > 0) { world.trees[i]--; world.treeV++; }
          }
        } else if (r === 2) c.wx = -1;
        else c.state = "travel";
        return;
      }
      case "miner": {
        if (c.wx < 0 || world.stone[world.idx(Math.floor(c.wx), Math.floor(c.wy))] < 1) {
          if (!this.findResourceTile(sim, c, city, civ, "stone")) { this.idleAround(sim, c, city, 3); return; }
        }
        const r = moveToward(world, c, c.wx, c.wy, CITIZEN_SPEED, 0.3);
        if (r === 1) {
          c.state = "work";
          const near = sim.econ.nearBuilding(sim, civ.id, "quarry", c.x, c.y, 7);
          const y = sim.econ.stoneYield(civ, near) * sim.soul.workFactor(c);
          civ.stone += y;
          const i = world.idx(Math.floor(c.wx), Math.floor(c.wy));
          world.stone[i] = Math.max(0, world.stone[i] - y);
        } else if (r === 2) c.wx = -1;
        else c.state = "travel";
        return;
      }
      case "builder": {
        let b = c.work >= 0 ? sim.buildingById.get(c.work) : undefined;
        if (!b || (b.progress >= 1 && b.up < 0) || b.hp < 0 || b.civ !== c.civ) {
          b = this.findSite(sim, c);
          c.work = b ? b.id : -1;
        }
        if (!b) { this.idleAround(sim, c, city, 3); return; }
        b.workers++;
        const r = moveToward(world, c, b.x + 0.5, b.y + 0.5, CITIZEN_SPEED, 0.5);
        if (r === 1) {
          c.state = "build";
          const info = sim.econ.cost(b.type);
          if (b.progress >= 1 && b.up >= 0) {
            // modernisation : le bâtiment reste debout et utilisable pendant les travaux
            b.up += (1 / sim.econ.upgradeCost(b.type, b.upTo).time) * (1 + civ.tech * 0.06);
            if (b.up >= 1) { b.up = -1; b.era = b.upTo; c.work = -1; sim.civSys.onUpgraded(sim, civ, b); }
            return;
          }
          b.progress += (1 / info.time) * (1 + civ.tech * 0.06) * sim.soul.workFactor(c);
          b.hp = Math.min(info.hp, Math.max(b.hp, b.progress * info.hp));
          if (b.progress >= 1) {
            b.progress = 1; b.hp = info.hp; c.work = -1;
            sim.stats.buildingsBuilt++;
            sim.civSys.onBuilt(sim, civ, b);
          }
        } else if (r === 2) c.work = -1;
        else c.state = "travel";
        return;
      }
      case "scholar": {
        if (city && Math.hypot(city.x - c.x, city.y - c.y) > 3.5) {
          c.state = "travel";
          if (moveToward(world, c, city.x + 0.5 + (c.id % 3) - 1, city.y + 1.5, CITIZEN_SPEED, 0.5) === 2) c.state = "idle";
          return;
        }
        c.state = "work";
        civ.techProg += 0.02 * sim.soul.workFactor(c) * (0.4 + c.intel) * (civ.tech >= 4 ? 1.2 : 1) * civ.mods.tech;
        return;
      }
      default:
        this.idleAround(sim, c, city, c.job === "soldier" ? 3.5 : 4.5);
    }
  }

  findBuilding(sim: SimulationEngine, c: Citizen, type: Building["type"], cap: number): Building | undefined {
    let best: Building | undefined, bd = Infinity;
    for (const b of sim.bOf(c.civ, type)) {
      if (b.progress < 1 || b.hp <= 0 || b.workers >= cap) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }
  findSite(sim: SimulationEngine, c: Citizen): Building | undefined {
    let best: Building | undefined, bd = Infinity;
    for (const b of sim.buildings) {
      if (b.civ !== c.civ || (b.progress >= 1 && b.up < 0) || b.hp < 0) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y) + b.workers * 4;
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  findResourceTile(sim: SimulationEngine, c: Citizen, city: City | null, civ: Civ, kind: "tree" | "stone"): boolean {
    const w = sim.world;
    const ox = city ? city.x : c.x, oy = city ? city.y : c.y;
    const R = 12;
    let best = -1, bd = Infinity;
    for (let y = Math.max(0, Math.floor(oy - R)); y <= Math.min(w.size - 1, Math.floor(oy + R)); y++)
      for (let x = Math.max(0, Math.floor(ox - R)); x <= Math.min(w.size - 1, Math.floor(ox + R)); x++) {
        const i = y * w.size + x;
        const own = w.owner[i];
        if (own !== -1 && own !== civ.id) continue;
        if (kind === "tree" ? (w.trees[i] === 0 || w.fire[i] > 0 || w.bld[i] >= 0) : (w.type[i] !== T.HILL || w.stone[i] < 1)) continue;
        const d = Math.hypot(x + 0.5 - c.x, y + 0.5 - c.y) + (own === civ.id ? 0 : 3) + ((x * 7 + y * 13 + c.id) % 5) * 0.2;
        if (d < bd) { bd = d; best = i; }
      }
    if (best < 0) { c.wx = -1; return false; }
    c.wx = (best % w.size) + 0.5; c.wy = ((best / w.size) | 0) + 0.5;
    return true;
  }
}
