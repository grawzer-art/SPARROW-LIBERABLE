import { TICKS_PER_YEAR } from "./config";
import { PERS } from "./data";
import type { SimulationEngine } from "./SimulationEngine";
import type { CasusBelli, Civ, War } from "./types";
import { techAttack } from "./WarSystem";

const TPY = TICKS_PER_YEAR;

/** Relations entre civilisations : opinions, rancunes, alliances, déclarations de guerre. */
export class DiplomacySystem {
  initRelations(sim: SimulationEngine, civ: Civ): void {
    for (const o of sim.civs) {
      if (o.id === civ.id) continue;
      for (const [a, b] of [[civ, o], [o, civ]] as [Civ, Civ][]) {
        const k = `${a.id}>${b.id}`;
        if (sim.rel[k] === undefined) sim.rel[k] = this.baseline(sim, a, b);
      }
    }
  }

  distance(sim: SimulationEngine, a: number, b: number): number {
    let best = 99;
    for (const c1 of sim.cities) {
      if (c1.civ !== a) continue;
      for (const c2 of sim.cities) if (c2.civ === b) best = Math.min(best, Math.hypot(c1.x - c2.x, c1.y - c2.y));
    }
    return best;
  }

  baseline(sim: SimulationEngine, a: Civ, b: Civ): number {
    let v = 8;
    if (a.religion.name !== b.religion.name) v -= a.personality === "fanatic" ? 22 : 8;
    const d = this.distance(sim, a.id, b.id);
    if (d < 14) v -= 12;
    else if (d < 22) v -= 5;
    switch (a.personality) {
      case "pacifist": v += 18; break;
      case "paranoid": v -= 16; break;
      case "arrogant": v -= 10; break;
      case "expansionist": v -= 6; break;
      case "opportunist": v += 2; break;
    }
    if (a.religion.dogma === "peace") v += 6; else if (a.religion.dogma === "war") v -= 6;
    return v;
  }

  power(civ: Civ): number {
    return civ.soldiers * techAttack(civ.tech) + civ.pop * 0.05 + 1;
  }

  update(sim: SimulationEngine, yearly: boolean): void {
    if (!yearly) return;
    const alive = sim.aliveCivs();
    // dérive des opinions
    for (const a of alive) {
      for (const b of alive) {
        if (a.id === b.id) continue;
        const k = `${a.id}>${b.id}`;
        if (sim.rel[k] === undefined) sim.rel[k] = this.baseline(sim, a, b);
        let target = this.baseline(sim, a, b);
        const st = sim.statusOf(a.id, b.id);
        if (st === "alliance") target += 30;
        if (st === "war") target = -70;
        target -= (sim.grudge[k] ?? 0) * 40;
        const cur = sim.rel[k];
        sim.rel[k] = Math.max(-100, Math.min(100, cur + Math.max(-4, Math.min(4, target - cur))));
        if (sim.grudge[k]) sim.grudge[k] = Math.max(0, sim.grudge[k] * 0.97 - 0.004);
      }
    }
    // équilibre des puissances : l'hégémon inquiète tout le monde
    if (alive.length >= 3) {
      const powers = alive.map((c) => this.power(c));
      const total = powers.reduce((a, b) => a + b, 0);
      alive.forEach((h, i) => {
        if (powers[i] > 1.7 * ((total - powers[i]) / (alive.length - 1))) {
          for (const o of alive) if (o.id !== h.id) { sim.addOpinion(o.id, h.id, -3); sim.addOpinion(h.id, o.id, 0); }
        }
      });
    }
    // alliances
    for (let i = 0; i < alive.length; i++)
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i], b = alive[j];
        const key = sim.pairKey(a.id, b.id);
        const st = sim.statusOf(a.id, b.id);
        const oa = sim.opinion(a.id, b.id), ob = sim.opinion(b.id, a.id);
        if (st === "alliance") {
          if (Math.min(oa, ob) < 0) { sim.status[key] = "peace"; sim.events.allianceBroken(sim, a, b); }
        } else if (st === "peace" && oa > 28 && ob > 28) {
          const common = alive.some((c) => c.id !== a.id && c.id !== b.id && sim.opinion(a.id, c.id) < -10 && sim.opinion(b.id, c.id) < -10);
          if (sim.rng.chance(0.1 + (common ? 0.25 : 0))) {
            sim.status[key] = "alliance";
            sim.addOpinion(a.id, b.id, 10); sim.addOpinion(b.id, a.id, 10);
            sim.events.alliance(sim, a, b);
          }
        }
      }
    // guerres
    for (const civ of alive) this.considerWar(sim, civ);
  }

  atWar(sim: SimulationEngine, civId: number): boolean {
    return sim.wars.some((w) => w.active && (w.a === civId || w.d === civId || w.aAllies.includes(civId) || w.dAllies.includes(civId)));
  }

  considerWar(sim: SimulationEngine, civ: Civ): void {
    const rng = sim.rng;
    if (sim.year < 35 || civ.pop < 12 || civ.soldiers < 3 || civ.leader.goat) return; // âge d'innocence
    if (this.atWar(sim, civ.id)) return;
    if (sim.tick - civ.lastWarEnd < 10 * TPY) return;
    const P = PERS[civ.personality];
    const L = civ.leader;
    const amb = L.aggr * 0.5 + L.ambition * 0.5;
    let best: { civ: Civ; desire: number; cb: CasusBelli } | null = null;
    for (const b of sim.aliveCivs()) {
      if (b.id === civ.id || b.pop < 5) continue;
      const key = sim.pairKey(civ.id, b.id);
      if ((sim.truce[key] ?? 0) > sim.tick) continue;
      if (sim.statusOf(civ.id, b.id) !== "peace") continue;
      const dist = this.distance(sim, civ.id, b.id);
      if (dist > 40) continue;
      const k = `${civ.id}>${b.id}`;
      const oppose = Math.max(0, -sim.opinion(civ.id, b.id) / 100);
      const grudge = sim.grudge[k] ?? 0;
      const rel = civ.religion.name !== b.religion.name ? (civ.personality === "fanatic" ? 0.35 : 0.08) : 0;
      let weak = Math.max(0, Math.min(1, (this.power(civ) / this.power(b) - 0.8) / 1.2));
      if (civ.personality === "stupid") weak = rng.next(); // ne sait pas compter
      const resNeed = civ.food < civ.pop * 0.4 && b.food > b.pop * 0.5 ? 0.3 : civ.wood < 15 && b.wood > 60 ? 0.2 : 0;
      const near = Math.max(0, 1 - dist / 32);
      const opp = civ.personality === "opportunist" && sim.wars.some((w) => w.active && (w.a === b.id || w.d === b.id)) ? 0.22 : 0;
      const conquest = 0.25 * amb + 0.35 * weak + 0.2 * near;
      const revenge = 0.45 * grudge + 0.3 * oppose;
      const ego = L.vanity > 0.6 ? 0.1 + 0.15 * L.vanity : 0;
      let desire = P.war * (conquest + revenge + rel + resNeed + opp + (L.vanity > 0.6 ? ego * 0.5 : 0));
      if (civ.stability < 40) desire *= 0.6;
      let cb: CasusBelli = "conquest";
      const parts: [CasusBelli, number][] = [["conquest", conquest], ["resources", resNeed * 2], ["revenge", revenge], ["ego", ego]];
      let bv = -1;
      for (const [n, v] of parts) if (v > bv) { bv = v; cb = n; }
      if (cb === "revenge" && (sim.grudgeWhy[k] ?? "").startsWith("les accusations")) cb = "provocation";
      if (!best || desire > best.desire) best = { civ: b, desire, cb };
    }
    if (best && best.desire > 0.5 && rng.chance(0.3)) this.declareWar(sim, civ, best.civ, best.cb);
  }

  insult(sim: SimulationEngine, target: Civ): string {
    const l = [`la forme d'un nuage au-dessus de ${target.name}`, `une remarque sur sa moustache venue de ${target.name}`,
      `la façon dont l'ambassadeur de ${target.name} a mangé son fromage`, `un regard trop long du dirigeant de ${target.name}`];
    return l[sim.rng.int(l.length)];
  }

  declareWar(sim: SimulationEngine, a: Civ, d: Civ, cb: CasusBelli, reasonOverride?: string): War {
    const k = `${a.id}>${d.id}`;
    let reason = reasonOverride ?? "";
    if (!reason) {
      if (cb === "revenge" || cb === "provocation") reason = sim.grudgeWhy[k] ?? "un vieil incident dont plus personne ne parle";
      else if (cb === "ego") reason = this.insult(sim, d);
      else if (cb === "alliance") reason = "une alliance";
    }
    const target = this.chooseTarget(sim, a, d);
    const war: War = {
      id: sim.newId(), a: a.id, d: d.id, aAllies: [], dAllies: [], cb, start: sim.tick, casA: 0, casD: 0, takenA: 0, takenD: 0,
      active: true, leaderName: a.leader.name, reason, target: target ? target.id : -1, forgotten: false, lastBattle: sim.tick, civCas: 0,
    };
    sim.wars.push(war);
    sim.warById.set(war.id, war);
    sim.status[sim.pairKey(a.id, d.id)] = "war";
    sim.addOpinion(a.id, d.id, -40);
    sim.addOpinion(d.id, a.id, -50);
    sim.stats.warsStarted++;
    // alliés
    for (const c of sim.aliveCivs()) {
      if (c.id === a.id || c.id === d.id) continue;
      const p = PERS[c.personality];
      if (sim.statusOf(c.id, d.id) === "alliance" && sim.statusOf(c.id, a.id) !== "alliance" && sim.rng.chance(Math.min(1, 0.45 + sim.opinion(c.id, d.id) / 200) * (p.war < 0.3 ? 0.5 : 1))) {
        war.dAllies.push(c.id);
        sim.status[sim.pairKey(c.id, a.id)] = "war";
        sim.addOpinion(c.id, a.id, -30);
      } else if (sim.statusOf(c.id, a.id) === "alliance" && sim.statusOf(c.id, d.id) !== "alliance" && sim.rng.chance(0.5 * (p.war < 0.3 ? 0.5 : 1))) {
        war.aAllies.push(c.id);
        sim.status[sim.pairKey(c.id, d.id)] = "war";
        sim.addOpinion(c.id, d.id, -30);
      }
    }
    sim.events.warDeclared(sim, war, a, d);
    sim.war.mobilize(sim, war);
    return war;
  }

  chooseTarget(sim: SimulationEngine, attacker: Civ, defender: Civ) {
    let best = null as ReturnType<typeof sim.cityById.get> | null, bs = Infinity;
    const mine = sim.cities.filter((c) => c.civ === attacker.id);
    for (const c of sim.cities) {
      if (c.civ !== defender.id) continue;
      const d = Math.min(...mine.map((m) => Math.hypot(m.x - c.x, m.y - c.y)), 99);
      const sc = d + c.pop * 0.1;
      if (sc < bs) { bs = sc; best = c; }
    }
    return best ?? undefined;
  }
}
