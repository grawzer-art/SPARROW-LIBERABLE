import { ARMY_SPEED, TICKS_PER_YEAR } from "./config";
import { findPath, moveToward } from "./path";
import type { SimulationEngine } from "./SimulationEngine";
import type { Army, Citizen, City, Civ, War } from "./types";

const TPY = TICKS_PER_YEAR;

export function techAttack(tech: number): number {
  return 1 + (tech >= 3 ? 0.25 : 0) + (tech >= 5 ? 0.25 : 0) + (tech >= 7 ? 0.4 : 0) + (tech >= 10 ? 0.3 : 0) + tech * 0.02;
}

interface BattleAcc { lostA: number; lostB: number; x: number; y: number; last: number; a: number; b: number; w: number; }

/** Guerres : mobilisation, armées, combats calculés, sièges, conquête, paix. */
export class WarSystem {
  private battles = new Map<string, BattleAcc>();

  // ------------------------------------------------------------ utilitaires

  sideOf(war: War, civId: number): "A" | "D" | null {
    if (war.a === civId || war.aAllies.includes(civId)) return "A";
    if (war.d === civId || war.dAllies.includes(civId)) return "D";
    return null;
  }
  hostiles(war: War, civId: number): number[] {
    const s = this.sideOf(war, civId);
    return s === "A" ? [war.d, ...war.dAllies] : s === "D" ? [war.a, ...war.aAllies] : [];
  }

  soldierPower(sim: SimulationEngine, c: Citizen, a: Army, civ: Civ, defending: boolean): number {
    const barracks = Math.min(3, sim.econ.countBuilt(sim, civ.id, "barracks"));
    return techAttack(civ.tech) * (0.6 + 0.4 * (c.hp / 100)) * (0.8 + 0.4 * c.courage) * (0.5 + a.morale / 200)
      * (defending ? 1.15 : 1) * (1 + 0.1 * barracks) * civ.mods.army * (civ.blessed > 0 ? 1.1 : 1);
  }

  // ------------------------------------------------------------ mobilisation

  mobilize(sim: SimulationEngine, war: War): void {
    const A = sim.civById.get(war.a)!, D = sim.civById.get(war.d)!;
    this.createArmy(sim, A, war, D, 0.24);
    this.createArmy(sim, D, war, A, 0.2);
    for (const id of war.aAllies) { const c = sim.civById.get(id); if (c) this.createArmy(sim, c, war, D, 0.15); }
    for (const id of war.dAllies) { const c = sim.civById.get(id); if (c) this.createArmy(sim, c, war, A, 0.15); }
  }

  createArmy(sim: SimulationEngine, civ: Civ, war: War, enemy: Civ, ratio: number): Army | null {
    const cities = sim.cities.filter((c) => c.civ === civ.id);
    if (!cities.length) return null;
    const enemyCities = sim.cities.filter((c) => c.civ === enemy.id);
    let muster = cities[0], bd = Infinity;
    for (const c of cities) for (const e of enemyCities) { const d = Math.hypot(c.x - e.x, c.y - e.y); if (d < bd) { bd = d; muster = c; } }
    const mine = sim.citizens.filter((c) => c.civ === civ.id && c.job !== "child" && c.army < 0 && !c.dead);
    const soldiers = mine.filter((c) => c.job === "soldier");
    const want = Math.floor(mine.length * ratio);
    if (soldiers.length < want) {
      const rest = mine.filter((c) => c.job !== "soldier" && c.job !== "builder").sort((a, b) => b.courage - a.courage);
      for (const c of rest) {
        if (soldiers.length >= want) break;
        c.job = "soldier"; c.work = -1; c.wx = -1;
        soldiers.push(c);
      }
    }
    if (!soldiers.length) return null;
    const army: Army = {
      id: sim.newId(), civ: civ.id, war: war.id, x: muster.x + 0.5, y: muster.y + 0.5, soldiers: soldiers.map((s) => s.id), state: "muster",
      target: -1, home: muster.id, morale: 80 + (sim.civById.get(civ.id)!.leader.aggr * 10), combat: false, startSize: soldiers.length,
      path: null, pathI: 0, pathTarget: -1, stuck: 0, born: sim.tick,
    };
    soldiers.forEach((s, i) => { s.army = army.id; s.slot = i; });
    sim.armies.push(army);
    sim.armyById.set(army.id, army);
    return army;
  }

  disband(sim: SimulationEngine, a: Army): void {
    for (const id of a.soldiers) {
      const c = sim.citizenById.get(id);
      if (c && !c.dead) { c.army = -1; c.state = "idle"; c.think = 0; }
    }
    a.soldiers = [];
    sim.armies = sim.armies.filter((x) => x !== a);
    sim.armyById.delete(a.id);
  }

  // ------------------------------------------------------------ boucle

  update(sim: SimulationEngine, yearly: boolean): void {
    if (sim.armies.length === 0 && !sim.wars.some((w) => w.active)) { for (const c of sim.cities) c.siege = 0; return; }
    for (const c of sim.cities) if (c.siege > 0) c.siege--;
    // nettoyer les armées
    for (const a of sim.armies.slice()) {
      a.soldiers = a.soldiers.filter((id) => { const c = sim.citizenById.get(id); return c && !c.dead && c.army === a.id; });
      const war = sim.warById.get(a.war);
      if (!war || !war.active || a.soldiers.length === 0) this.disband(sim, a);
    }
    for (const a of sim.armies) a.combat = false;
    this.fights(sim);
    for (const a of sim.armies) this.moveArmy(sim, a);
    this.sieges(sim);
    this.battleLog(sim);
    if (sim.tick % 10 === 0) this.panicNear(sim);
    if (yearly) this.evaluate(sim);
  }

  centroidDist(a: Army, x: number, y: number): number {
    return Math.hypot(a.x - x, a.y - y);
  }

  nearestHostileArmy(sim: SimulationEngine, a: Army, maxD: number): Army | null {
    const war = sim.warById.get(a.war);
    if (!war) return null;
    const hostile = this.hostiles(war, a.civ);
    let best: Army | null = null, bd = maxD;
    for (const o of sim.armies) {
      if (o.war !== a.war || !hostile.includes(o.civ) || o.state === "retreat" && o.soldiers.length === 0) continue;
      const d = this.centroidDist(a, o.x, o.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ------------------------------------------------------------ combat

  fights(sim: SimulationEngine): void {
    const done = new Set<string>();
    for (const a of sim.armies) {
      for (const b of sim.armies) {
        if (a === b || a.war !== b.war || a.soldiers.length === 0 || b.soldiers.length === 0) continue;
        const war = sim.warById.get(a.war);
        if (!war || !this.hostiles(war, a.civ).includes(b.civ)) continue;
        const key = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (done.has(key)) continue;
        if (this.centroidDist(a, b.x, b.y) > 2.4) continue;
        done.add(key);
        this.exchange(sim, war, a, b);
      }
    }
  }

  exchange(sim: SimulationEngine, war: War, a: Army, b: Army): void {
    const ca = sim.civById.get(a.civ)!, cb = sim.civById.get(b.civ)!;
    const da = sim.world.owner[sim.world.tileAt(a.x, a.y)] === a.civ;
    const db = sim.world.owner[sim.world.tileAt(b.x, b.y)] === b.civ;
    let pa = 0, pb = 0;
    const sa = a.soldiers.map((id) => sim.citizenById.get(id)!).filter(Boolean);
    const sb = b.soldiers.map((id) => sim.citizenById.get(id)!).filter(Boolean);
    for (const c of sa) pa += this.soldierPower(sim, c, a, ca, da);
    for (const c of sb) pb += this.soldierPower(sim, c, b, cb, db);
    // une armée qui se fait déjà frapper en retraite ne riposte presque pas
    if (a.state === "retreat") pa *= 0.4;
    if (b.state === "retreat") pb *= 0.4;
    const lostA = this.applyDamage(sim, war, sa, pb * 0.9 * (0.9 + 0.2 * sim.rng.next()), ca, cb);
    const lostB = this.applyDamage(sim, war, sb, pa * 0.9 * (0.9 + 0.2 * sim.rng.next()), cb, ca);
    a.combat = b.combat = true;
    const nA = Math.max(1, a.soldiers.length + lostA), nB = Math.max(1, b.soldiers.length + lostB);
    a.morale -= (lostA / nA) * 60 + (pb > pa * 1.4 ? 0.12 : 0);
    b.morale -= (lostB / nB) * 60 + (pa > pb * 1.4 ? 0.12 : 0);
    for (const [army, orig] of [[a, nA], [b, nB]] as [Army, number][]) {
      army.soldiers = army.soldiers.filter((id) => { const c = sim.citizenById.get(id); return c && !c.dead; });
      if (army.state !== "retreat" && (army.morale < 28 || army.soldiers.length < Math.max(1, army.startSize * 0.2) && army.soldiers.length < orig)) {
        army.state = "retreat"; army.path = null; army.pathTarget = -1;
      }
    }
    const key = `${war.id}`;
    const acc = this.battles.get(key) ?? { lostA: 0, lostB: 0, x: a.x, y: a.y, last: sim.tick, a: a.civ, b: b.civ, w: war.id };
    acc.lostA += lostA; acc.lostB += lostB; acc.last = sim.tick; acc.x = (a.x + b.x) / 2; acc.y = (a.y + b.y) / 2; acc.a = a.civ; acc.b = b.civ;
    this.battles.set(key, acc);
    war.lastBattle = sim.tick;
    if (sim.tick % 12 === 0) sim.fx.push({ kind: "battle", x: acc.x, y: acc.y });
  }

  /** Répartit les dégâts sur les soldats. Retourne le nombre de morts. */
  applyDamage(sim: SimulationEngine, war: War, targets: Citizen[], dmg: number, victimCiv: Civ, killerCiv: Civ): number {
    if (!targets.length) return 0;
    let dead = 0;
    let i = sim.rng.int(targets.length);
    let guard = targets.length * 4;
    while (dmg > 0.01 && guard-- > 0) {
      const c = targets[i % targets.length];
      i++;
      if (c.dead) continue;
      const hit = Math.min(dmg, 14);
      c.hp -= hit * (1 - 0.25 * (c.courage - 0.5));
      dmg -= hit;
      if (c.hp <= 0) {
        sim.killCitizen(c, "war");
        dead++;
        killerCiv.stats.kills++;
        if (this.sideOf(war, victimCiv.id) === "A") war.casA++; else war.casD++;
      }
    }
    return dead;
  }

  battleLog(sim: SimulationEngine): void {
    for (const [k, acc] of this.battles) {
      if (sim.tick - acc.last < 20) continue;
      this.battles.delete(k);
      if (acc.lostA + acc.lostB < 4) continue;
      const war = sim.warById.get(acc.w), a = sim.civById.get(acc.a), b = sim.civById.get(acc.b);
      if (!war || !a || !b) continue;
      let near: City | null = null, bd = Infinity;
      for (const c of sim.cities) { const d = Math.hypot(c.x - acc.x, c.y - acc.y); if (d < bd) { bd = d; near = c; } }
      sim.events.battle(sim, war, a, b, near ? near.name : "nulle part", acc.lostA, acc.lostB);
    }
  }

  // ------------------------------------------------------------ mouvements

  moveArmy(sim: SimulationEngine, a: Army): void {
    const war = sim.warById.get(a.war);
    if (!war || a.soldiers.length === 0) return;
    const civ = sim.civById.get(a.civ)!;
    const side = this.sideOf(war, a.civ);
    const hostile = this.hostiles(war, a.civ);
    const home = sim.cityById.get(a.home) ?? sim.cities.find((c) => c.civ === a.civ);
    if (!home) { a.state = "retreat"; return; }
    if (!a.combat) a.morale = Math.min(100, a.morale + 0.04);

    if (a.state === "muster") {
      let near = 0;
      for (const id of a.soldiers) { const c = sim.citizenById.get(id); if (c && Math.hypot(c.x - a.x, c.y - a.y) < 3.5) near++; }
      const age = sim.tick - a.born;
      if (age > 90 || (age > 25 && near >= a.soldiers.length * 0.6)) a.state = "march";
      else if (side === "D") {
        // les défenseurs gardent la ville la plus menacée
        const threat = this.nearestHostileArmy(sim, a, 30);
        if (threat) a.state = "march";
        return;
      } else return;
    }

    if (a.state === "retreat") {
      this.walk(sim, a, home.x + 0.5, home.y + 0.5, ARMY_SPEED * 1.1);
      if (this.centroidDist(a, home.x + 0.5, home.y + 0.5) < 2 && !a.combat) {
        if (a.soldiers.length >= 3 && a.morale > 50) { a.state = "muster"; a.born = sim.tick; } 
        else a.morale += 0.2;
        if (a.soldiers.length < 3) this.disband(sim, a);
        else if (a.morale > 60) { a.state = "muster"; a.born = sim.tick; }
      }
      return;
    }

    if (a.combat) return; // on se bat sur place

    if (side === "A") {
      // attaquant : cible une ville ennemie
      let target = a.target >= 0 ? sim.cityById.get(a.target) : undefined;
      if (!target || !hostile.includes(target.civ)) {
        target = this.pickCity(sim, a, hostile);
        a.target = target ? target.id : -1;
        a.path = null; a.pathTarget = -1;
      }
      if (!target) return;
      // un ennemi proche et menaçant ? on le combat d'abord
      const foe = this.nearestHostileArmy(sim, a, 6);
      let gx = target.x + 0.5, gy = target.y + 0.5;
      if (foe && foe.state !== "retreat") { gx = foe.x; gy = foe.y; }
      if (Math.hypot(a.x - target.x - 0.5, a.y - target.y - 0.5) < 2 && !foe) { a.state = "siege"; return; }
      a.state = "march";
      this.walk(sim, a, gx, gy, ARMY_SPEED);
    } else {
      // défenseur : intercepte l'armée ennemie la plus proche, sinon garde la ville la plus proche d'elle
      const foe = this.nearestHostileArmy(sim, a, 40);
      if (foe) {
        const myCities = sim.cities.filter((c) => c.civ === a.civ);
        let nearest = Infinity;
        for (const c of myCities) nearest = Math.min(nearest, Math.hypot(c.x - foe.x, c.y - foe.y));
        if (nearest < 16 || this.centroidDist(a, foe.x, foe.y) < 10) {
          a.state = "march";
          this.walk(sim, a, foe.x, foe.y, ARMY_SPEED);
          return;
        }
      }
      a.state = "muster";
      a.born = sim.tick;
    }
    void civ;
  }

  pickCity(sim: SimulationEngine, a: Army, hostile: number[]): City | undefined {
    let best: City | undefined, bs = Infinity;
    for (const c of sim.cities) {
      if (!hostile.includes(c.civ)) continue;
      const sc = Math.hypot(c.x - a.x, c.y - a.y) + c.pop * 0.05;
      if (sc < bs) { bs = sc; best = c; }
    }
    return best;
  }

  walk(sim: SimulationEngine, a: Army, tx: number, ty: number, speed: number): void {
    if (!a.path || a.pathTarget < 0 || Math.hypot(a.path[a.path.length - 2] - tx, a.path[a.path.length - 1] - ty) > 4) {
      a.path = findPath(sim.world, a.x, a.y, tx, ty);
      a.pathI = 0;
      a.pathTarget = 1;
    }
    const r = moveToward(sim.world, a, tx, ty, speed, 0.2);
    if (r === 2) { a.path = null; a.pathTarget = -1; }
  }

  // ------------------------------------------------------------ sièges

  sieges(sim: SimulationEngine): void {
    for (const a of sim.armies) {
      if (a.state !== "siege" || a.soldiers.length === 0) continue;
      const war = sim.warById.get(a.war);
      const city = sim.cityById.get(a.target);
      if (!war || !city) { a.state = "march"; continue; }
      const att = sim.civById.get(a.civ)!, def = sim.civById.get(city.civ);
      if (!def) continue;
      city.siege = 3;
      a.combat = true;
      const soldiers = a.soldiers.map((id) => sim.citizenById.get(id)!).filter(Boolean);
      let pa = 0;
      for (const c of soldiers) pa += this.soldierPower(sim, c, a, att, false);
      // garnison de la ville
      const garrison: Citizen[] = [];
      sim.hash.query(sim.citizens, city.x + 0.5, city.y + 0.5, 4, (c) => {
        if (c.civ === city.civ && c.job === "soldier" && c.army < 0) garrison.push(c);
      });
      const castle = sim.buildings.some((b) => b.city === city.id && b.type === "castle" && b.progress >= 1);
      const wall = (castle ? 1.6 : 1.15) + (city.walls >= 0 ? 0.2 + 0.05 * city.walls : 0);
      if (garrison.length) {
        let pg = 0;
        const fake: Army = { ...a, morale: 70 };
        for (const c of garrison) { pg += this.soldierPower(sim, c, fake, def, true) * wall; c.state = "fight"; }
        const lostG = this.applyDamage(sim, war, garrison, pa * 0.9 * (0.9 + 0.2 * sim.rng.next()), def, att);
        const lostA = this.applyDamage(sim, war, soldiers, pg * 0.9 * (0.9 + 0.2 * sim.rng.next()), att, def);
        a.morale -= (lostA / Math.max(1, soldiers.length)) * 50;
        a.soldiers = a.soldiers.filter((id) => { const c = sim.citizenById.get(id); return c && !c.dead; });
        const key = `${war.id}`;
        const acc = this.battles.get(key) ?? { lostA: 0, lostB: 0, x: city.x, y: city.y, last: sim.tick, a: a.civ, b: city.civ, w: war.id };
        acc.lostA += lostA; acc.lostB += lostG; acc.last = sim.tick; acc.a = a.civ; acc.b = city.civ;
        this.battles.set(key, acc);
        if (a.morale < 25 || a.soldiers.length === 0) a.state = "retreat";
        if (sim.tick % 12 === 0) sim.fx.push({ kind: "battle", x: city.x + 0.5, y: city.y + 0.5 });
      } else {
        city.hp -= pa * 0.7;
        // pillage et victimes civiles
        if (sim.rng.chance(0.05)) {
          const vic = sim.citizens.find((c) => c.city === city.id && c.army < 0 && !c.dead && c.job !== "soldier");
          if (vic) { sim.killCitizen(vic, "war"); war.civCas++; }
        }
        if (sim.tick % 30 === 0) { const loot = Math.min(def.food, 4 + soldiers.length * 0.5); def.food -= loot; att.food += loot; }
        if (sim.tick % 12 === 0) sim.fx.push({ kind: "battle", x: city.x + 0.5, y: city.y + 0.5 });
        if (city.hp <= 0) this.captureCity(sim, war, a, city, att, def);
      }
    }
    // régénération des remparts
    for (const c of sim.cities) if (c.siege <= 0 && c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 0.25);
  }

  captureCity(sim: SimulationEngine, war: War, a: Army, city: City, att: Civ, def: Civ): void {
    const rng = sim.rng;
    const razed = city.pop <= 6 || rng.chance(0.1 + (war.cb === "revenge" ? 0.25 : 0) + (att.personality === "fanatic" ? 0.1 : 0));
    if (this.sideOf(war, att.id) === "A") war.takenA++; else war.takenD++;
    const victims = sim.citizens.filter((c) => c.city === city.id && !c.dead && c.army < 0);
    let dead = 0;
    if (razed) {
      const other = sim.cities.filter((c) => c.civ === def.id && c.id !== city.id).sort((x, y) => Math.hypot(x.x - city.x, x.y - city.y) - Math.hypot(y.x - city.x, y.y - city.y))[0];
      for (const c of victims) {
        if (rng.chance(0.4) || !other) { sim.killCitizen(c, "war"); dead++; }
        else { c.city = other.id; c.work = -1; c.wx = -1; }
      }
      war.civCas += dead;
      for (const b of sim.buildings) if (b.city === city.id) { if (b.progress >= 1) { b.ruin = 40; b.civ = -1; b.hp = 1; } else sim.destroyBuilding(b); }
      sim.cities = sim.cities.filter((c) => c.id !== city.id);
      sim.cityById.delete(city.id);
      if (def.capital === city.id) def.capital = other ? other.id : -1;
    } else {
      city.civ = att.id;
      city.hp = city.maxHp * 0.4;
      for (const b of sim.buildings) if (b.city === city.id && b.civ === def.id) b.civ = att.id;
      for (const c of victims) {
        if (rng.chance(0.2)) { sim.killCitizen(c, "war"); dead++; continue; }
        c.civ = att.id; c.work = -1; c.wx = -1; c.job = c.job === "soldier" ? "farmer" : c.job;
      }
      war.civCas += dead;
      if (def.capital === city.id) {
        const nc = sim.cities.filter((c) => c.civ === def.id).sort((x, y) => y.pop - x.pop)[0];
        def.capital = nc ? nc.id : -1;
      }
    }
    // butin & conséquences
    const loot = def.gold * 0.25;
    def.gold -= loot; att.gold += loot;
    def.stability = Math.max(0, def.stability - 14);
    att.stability = Math.min(100, att.stability + 5);
    sim.addOpinion(def.id, att.id, -25);
    sim.grudge[`${def.id}>${att.id}`] = Math.min(1, (sim.grudge[`${def.id}>${att.id}`] ?? 0) + 0.5);
    sim.grudgeWhy[`${def.id}>${att.id}`] = `la perte de ${city.name}`;
    sim.fx.push({ kind: "capture", x: city.x + 0.5, y: city.y + 0.5, civ: att.id });
    sim.civSys.updateTerritory(sim);
    sim.events.cityCaptured(sim, war, city, def, att, razed);
    a.target = -1; a.state = "march"; a.path = null;
    if (!sim.cities.some((c) => c.civ === def.id)) {
      // plus aucune ville : les derniers habitants rejoignent le vainqueur
      const home = sim.cities.filter((c) => c.civ === att.id)[0];
      for (const c of sim.citizens) if (c.civ === def.id && !c.dead) { c.civ = att.id; c.army = -1; if (home) c.city = home.id; c.job = c.job === "child" ? "child" : "farmer"; }
      sim.civSys.extinguish(sim, def);
    }
  }

  panicNear(sim: SimulationEngine): void {
    for (const a of sim.armies) {
      if (a.state !== "march" && a.state !== "siege") continue;
      const war = sim.warById.get(a.war);
      if (!war) continue;
      const hostile = this.hostiles(war, a.civ);
      for (const city of sim.cities) {
        if (!hostile.includes(city.civ) || Math.hypot(city.x - a.x, city.y - a.y) > 4.5) continue;
        sim.hash.query(sim.citizens, city.x + 0.5, city.y + 0.5, 5, (c) => {
          if (c.civ === city.civ && c.job !== "soldier" && c.army < 0 && c.panic === 0) { c.panic = 20; c.fx = a.x; c.fy = a.y; }
        });
      }
    }
  }

  // ------------------------------------------------------------ fin de guerre

  evaluate(sim: SimulationEngine): void {
    for (const war of sim.wars) {
      if (!war.active) continue;
      const A = sim.civById.get(war.a), D = sim.civById.get(war.d);
      if (!A || !D || !A.alive || !D.alive) { this.endWar(sim, war, "collapse"); continue; }
      const dur = (sim.tick - war.start) / TPY;
      const armiesA = sim.armies.filter((x) => x.war === war.id && this.sideOf(war, x.civ) === "A" && x.soldiers.length > 0);
      const armiesD = sim.armies.filter((x) => x.war === war.id && this.sideOf(war, x.civ) === "D" && x.soldiers.length > 0);
      // renforts : les soldats disponibles rejoignent leur armée
      for (const army of sim.armies) {
        if (army.war !== war.id || army.soldiers.length >= army.startSize) continue;
        const free = sim.citizens.filter((c) => c.civ === army.civ && c.job === "soldier" && c.army < 0 && !c.dead);
        for (const c of free) {
          if (army.soldiers.length >= army.startSize) break;
          c.army = army.id; c.slot = army.soldiers.length; army.soldiers.push(c.id);
        }
      }
      const lastFight = (sim.tick - war.lastBattle) / TPY;
      const goalReached = war.takenA >= 1;
      const arrogantA = A.personality === "arrogant" && armiesA.length > 0;
      const aWants = (goalReached && !arrogantA) || (armiesA.length === 0 && A.soldiers < 2) || dur > 30 || A.stability < 15 || (lastFight > 8 && dur > 22);
      const dWants = (armiesD.length === 0 && D.soldiers < 2) || (war.takenA >= 1 && armiesD.length === 0) || dur > 30 || D.stability < 12 || (lastFight > 8 && dur > 22);
      const stalemate = armiesA.length === 0 && armiesD.length === 0 && dur > 3;
      if ((aWants && dWants) || stalemate || dur > 40) {
        this.endWar(sim, war, "auto");
      }
    }
  }

  endWarsOf(sim: SimulationEngine, civ: Civ, kind: "collapse"): void {
    for (const w of sim.wars) if (w.active && (w.a === civ.id || w.d === civ.id)) this.endWar(sim, w, kind);
  }

  endWar(sim: SimulationEngine, war: War, how: "auto" | "collapse" | "white"): void {
    if (!war.active) return;
    war.active = false;
    const A = sim.civById.get(war.a)!, D = sim.civById.get(war.d)!;
    const scoreA = war.takenA * 30 - war.takenD * 30 + (war.casD - war.casA) * 0.5;
    let outcome: "victory" | "white" | "collapse" = how === "collapse" ? "collapse" : how === "white" ? "white" : Math.abs(scoreA) > 6 ? "victory" : "white";
    let winner: Civ | null = null, loser: Civ | null = null;
    if (outcome === "victory") { winner = scoreA > 0 ? A : D; loser = scoreA > 0 ? D : A; }
    else if (outcome === "collapse") {
      winner = A.alive ? A : D.alive ? D : null; loser = winner === A ? D : A;
      if (!A.alive && !D.alive) winner = null;
    }
    const until = sim.tick + (8 + sim.rng.int(6)) * TPY;
    const sides = [war.a, ...war.aAllies, war.d, ...war.dAllies];
    for (const x of [war.a, ...war.aAllies]) for (const y of [war.d, ...war.dAllies]) {
      const k = sim.pairKey(x, y);
      if (sim.status[k] === "war") sim.status[k] = "peace";
      sim.truce[k] = until;
      sim.addOpinion(x, y, 18); sim.addOpinion(y, x, 18);
    }
    for (const id of sides) {
      const c = sim.civById.get(id);
      if (c) c.lastWarEnd = sim.tick;
    }
    if (winner && loser && outcome === "victory") {
      const gold = loser.gold * 0.3, food = loser.food * 0.15;
      loser.gold -= gold; loser.food -= food; winner.gold += gold; winner.food += food;
      winner.stats.warsWon++; loser.stats.warsLost++;
      winner.stability = Math.min(100, winner.stability + 6);
    }
    for (const a of sim.armies.filter((x) => x.war === war.id)) this.disband(sim, a);
    sim.events.peace(sim, war, outcome, winner, loser, A, D);
  }
}
