import { CITIZEN_SPEED, TICKS_PER_YEAR } from "./config";
import { moveToward } from "./path";
import { hash2 } from "./rng";
import { TUNING } from "./tuning";
import type { SimulationEngine } from "./SimulationEngine";
import type { Citizen, City, Civ, Mem, Mind, Rel } from "./types";

const TPY = TICKS_PER_YEAR;
const clamp = (v: number, a = 0, b = 100) => (v < a ? a : v > b ? b : v);

/** Genres de souvenirs. */
export const MEM = { FAMINE: 0, KIN_DEATH: 1, VIOLENCE: 2, DISASTER: 3, BIRTH: 4, DIVINE: 5, LEADER: 6, BETRAYAL: 7, FRIEND: 8, QUARREL: 9, RECONCILE: 10, MIGRATE: 11, WEDDING: 12, HEALED: 13, FIRE: 14, REBEL: 15 } as const;
/** Projets (intentions à long terme). */
export const GOAL = { STAY: 0, LEAVE: 1, FAMILY: 2, REBEL: 3, REVENGE: 4, DEVOUT: 5 } as const;
/** Genres de relations. */
export const REL = { KNOWN: 0, FRIEND: 1, RIVAL: 2, PARTNER: 3, KIN: 4 } as const;
/** Idées qui circulent (bits) : elles se transmettent entre amis. */
export const IDEA = { DISTRUST: 1, WANDER: 2, FAITH: 4, FEAR_GOD: 8 } as const;
export const EMO = { FEAR: 0, JOY: 1, SAD: 2, ANGER: 3, HOPE: 4 } as const;
export const EMO_LABEL = ["Peur", "Joie", "Tristesse", "Colère", "Espoir"];

/** Raisons d'une décision (codes stockés dans `Mind.gWhy`). */
export const WHY = [
  "n'a plus confiance en son chef", "garde le souvenir de la famine", "pleure un proche disparu", "a connu la violence", "rêve d'une vie meilleure ailleurs",
  "sa famille part", "n'a pas de toit", "est attaché à son village", "veut fonder une famille", "garde rancune", "a la foi", "se sent bien ici",
  "la colère gronde", "ses amis le poussent", "un rêve l'a marqué", "un autre village est plus prospère",
];

const MEM_TEXT: Record<number, string> = {
  [MEM.FAMINE]: "La grande faim", [MEM.KIN_DEATH]: "La mort d'un proche", [MEM.VIOLENCE]: "La violence de la guerre", [MEM.DISASTER]: "Une catastrophe",
  [MEM.BIRTH]: "La naissance d'un enfant", [MEM.DIVINE]: "Un signe du ciel", [MEM.LEADER]: "Un changement de dirigeant", [MEM.BETRAYAL]: "Une trahison",
  [MEM.FRIEND]: "Une amitié", [MEM.QUARREL]: "Une dispute", [MEM.RECONCILE]: "Une réconciliation", [MEM.MIGRATE]: "L'exil vers un nouveau foyer",
  [MEM.WEDDING]: "Une union", [MEM.HEALED]: "Une guérison miraculeuse", [MEM.FIRE]: "Un incendie", [MEM.REBEL]: "La révolte",
};

/**
 * Esprit des habitants : émotions, souvenirs, relations, confiance, idées, projets.
 * Utility AI locale : aucune ressource externe, hachages déterministes (aucune consommation du générateur aléatoire de la simulation).
 * Les décisions (partir, se révolter, fonder une famille, rancune, dévotion) modifient réellement le monde : déplacement
 * des habitants entre villages, couples, naissances, stabilité, dirigeants.
 */
export class MindSystem {
  stats = { deliberations: 0, leaves: 0, rebellions: 0, coups: 0, quarrels: 0, reconciled: 0, betrayals: 0, bonds: 0, conversions: 0 };
  /** Départs de l'année par ville (pour raconter un exode) */
  private exodus = new Map<number, { n: number; to: number; first: string }>();

  /** État à sauvegarder (compteurs d'exode de l'année et statistiques) : la reprise est identique à la poursuite. */
  serialize(): { exodus: [number, { n: number; to: number; first: string }][]; stats: MindSystem["stats"] } { return { exodus: [...this.exodus], stats: { ...this.stats } }; }
  restore(d?: { exodus: [number, { n: number; to: number; first: string }][]; stats: MindSystem["stats"] }): void { if (!d) return; this.exodus = new Map(d.exodus); Object.assign(this.stats, d.stats); }

  private rnd(a: number, b: number, k: number): number { return hash2(a * 131 + (b % 100003), k, 9100); }

  // ------------------------------------------------------------ données

  ensure(sim: SimulationEngine, c: Citizen): Mind {
    if (c.mind) return c.mind;
    const civ = sim.civById.get(c.civ);
    const m: Mind = {
      v: 1, emo: [0, 25, 0, 0, 30], mem: [], rel: [],
      trust: Math.round(clamp(20 + ((civ?.stability ?? 50) - 50) * 0.3, -100, 100)),
      ideas: 0, goal: GOAL.STAY, gT: sim.tick, gTarget: -1, gWhy: [],
      next: sim.tick + 1 + Math.floor(this.rnd(c.id, 0, 1) * TPY), lastLeave: -1e9,
    };
    c.mind = m;
    const s = c.soul;
    if (s) {
      if (s.mother >= 0) this.touch(c, s.mother, 45, REL.KIN);
      if (s.father >= 0) this.touch(c, s.father, 40, REL.KIN);
      if (s.mate >= 0) this.touch(c, s.mate, 55, REL.PARTNER);
    }
    return m;
  }

  private strength(m: Mem, tick: number): number { return m.w * Math.exp(-(tick - m.t) / (TPY * 15)); }

  /** Intensité (0..1) de l'ensemble des souvenirs d'un genre, négatifs seulement ou positifs seulement. */
  memLoad(sim: SimulationEngine, m: Mind, kind: number, sign = -1): number {
    let v = 0;
    for (const x of m.mem) if (x.k === kind && Math.sign(x.w) === sign) v += Math.abs(this.strength(x, sim.tick)) / 100;
    return Math.min(1, v);
  }

  remember(sim: SimulationEngine, c: Citizen, kind: number, w: number, who = -1): void {
    const m = this.ensure(sim, c);
    // un souvenir du même genre et de la même personne se renforce au lieu de se dupliquer
    const same = m.mem.find((x) => x.k === kind && x.who === who);
    if (same) { same.w = clamp(Math.abs(same.w) > Math.abs(w) ? same.w * 0.7 + w * 0.5 : w, -100, 100); same.t = sim.tick; return; }
    m.mem.push({ k: kind, t: sim.tick, w: clamp(w, -100, 100), who });
    if (m.mem.length > 8) {
      let wi = 0, wv = Infinity;
      m.mem.forEach((x, i) => { const v = Math.abs(this.strength(x, sim.tick)); if (v < wv) { wv = v; wi = i; } });
      m.mem.splice(wi, 1);
    }
  }

  feel(c: Citizen, emo: number, amount: number): void {
    const m = c.mind; if (!m) return;
    m.emo[emo] = clamp(m.emo[emo] + amount);
  }

  relOf(c: Citizen, id: number): Rel | undefined { return c.mind?.rel.find((r) => r.id === id); }

  touch(c: Citizen, id: number, delta: number, kind?: number): Rel {
    const m = c.mind!;
    let r = m.rel.find((x) => x.id === id);
    if (!r) {
      r = { id, a: 0, k: kind ?? REL.KNOWN };
      m.rel.push(r);
      if (m.rel.length > 7) {
        let wi = -1, wv = Infinity;
        m.rel.forEach((x, i) => { if (x === r || x.k === REL.PARTNER || x.k === REL.KIN) return; const v = Math.abs(x.a); if (v < wv) { wv = v; wi = i; } });
        if (wi >= 0) m.rel.splice(wi, 1); else m.rel.splice(m.rel.indexOf(r), 1);
      }
    }
    r.a = clamp(r.a + delta, -100, 100);
    if (kind !== undefined) r.k = kind;
    else if (r.k !== REL.PARTNER && r.k !== REL.KIN) r.k = r.a >= 35 ? REL.FRIEND : r.a <= -35 ? REL.RIVAL : REL.KNOWN;
    return r;
  }

  /** Couple durable : lien réciproque, souvenir heureux, joie. */
  bond(sim: SimulationEngine, a: Citizen, b: Citizen): void {
    this.ensure(sim, a); this.ensure(sim, b);
    sim.soul.ensure(a).mate = b.id; sim.soul.ensure(b).mate = a.id;
    this.touch(a, b.id, 60, REL.PARTNER); this.touch(b, a.id, 60, REL.PARTNER);
    this.remember(sim, a, MEM.WEDDING, 65, b.id); this.remember(sim, b, MEM.WEDDING, 65, a.id);
    this.feel(a, EMO.JOY, 40); this.feel(b, EMO.JOY, 40);
    this.stats.bonds++;
  }

  unbond(a: Citizen, b: Citizen): void {
    if (a.soul?.mate === b.id) a.soul.mate = -1;
    if (b.soul?.mate === a.id) b.soul.mate = -1;
    for (const [x, y] of [[a, b], [b, a]] as [Citizen, Citizen][]) { const r = x.mind?.rel.find((q) => q.id === y.id); if (r) r.k = REL.KNOWN; }
  }

  /** Naissance : parenté dans les deux sens. */
  onBirth(sim: SimulationEngine, child: Citizen, mother: Citizen): void {
    const father = mother.soul && mother.soul.mate >= 0 ? sim.citizenById.get(mother.soul.mate) : undefined;
    this.ensure(sim, child); this.ensure(sim, mother);
    this.touch(child, mother.id, 60, REL.KIN); this.touch(mother, child.id, 80, REL.KIN);
    this.remember(sim, mother, MEM.BIRTH, 70, child.id); this.feel(mother, EMO.JOY, 50);
    if (father) { this.ensure(sim, father); this.touch(child, father.id, 50, REL.KIN); this.touch(father, child.id, 70, REL.KIN); this.remember(sim, father, MEM.BIRTH, 60, child.id); this.feel(father, EMO.JOY, 40); }
    child.mind!.trust = mother.mind!.trust; // les enfants héritent de l'ambiance du foyer
    child.mind!.ideas = mother.mind!.ideas & (IDEA.DISTRUST | IDEA.FAITH);
  }

  // ------------------------------------------------------------ événements -> souvenirs

  /** Mort d'un habitant : proches et amis en gardent un souvenir selon le lien et la cause. */
  onDeath(sim: SimulationEngine, c: Citizen, cause: string): void {
    const m = c.mind; if (!m) return;
    const violent = cause === "war" || cause === "god" || cause === "unrest" || cause === "fire";
    for (const r of m.rel) {
      if (r.a < 20 && r.k !== REL.KIN && r.k !== REL.PARTNER) continue;
      const o = sim.citizenById.get(r.id);
      if (!o || o.dead) continue;
      this.ensure(sim, o);
      const w = -(r.k === REL.PARTNER ? 90 : r.k === REL.KIN ? 70 : 40);
      this.remember(sim, o, MEM.KIN_DEATH, w, c.id);
      if (violent) this.remember(sim, o, cause === "war" ? MEM.VIOLENCE : MEM.DISASTER, w * 0.6, -1);
      this.feel(o, EMO.SAD, 50); if (violent) this.feel(o, EMO.ANGER, 30);
      if (cause === "famine") this.remember(sim, o, MEM.FAMINE, -70, -1);
      if (o.soul?.mate === c.id) o.soul.mate = -1;
      if (cause === "war" || cause === "unrest") { const mo = o.mind!; mo.ideas |= IDEA.DISTRUST; mo.trust = clamp(mo.trust - 12, -100, 100); }
    }
  }

  /** Catastrophe visible (foudre, incendie, météorite…) : témoins marqués, peur, éventuelle crainte du ciel. */
  onDisaster(sim: SimulationEngine, x: number, y: number, radius: number, kind: "fire" | "disaster"): void {
    for (const c of sim.citizens) {
      if (c.dead || Math.hypot(c.x - x, c.y - y) > radius) continue;
      const m = this.ensure(sim, c);
      this.remember(sim, c, kind === "fire" ? MEM.FIRE : MEM.DISASTER, -50, -1);
      this.feel(c, EMO.FEAR, 45);
      if (this.rnd(c.id, sim.tick, 5) < 0.35 + 0.3 * (c.soul?.t[4] ?? 0.5)) m.ideas |= IDEA.FEAR_GOD;
    }
  }

  // ------------------------------------------------------------ interactions sociales

  /** Conversation entre deux habitants : l'affinité évolue selon leurs personnalités, des idées circulent, des disputes éclatent. */
  interact(sim: SimulationEngine, a: Citizen, b: Citizen): void {
    if (!TUNING.mind) return;
    const ma = this.ensure(sim, a), mb = this.ensure(sim, b);
    if ((sim.tick + a.id + b.id) % 5 !== 0) return;
    const sa = a.soul!, sb = b.soul!;
    const compat = 1 - Math.abs(a.aggr - b.aggr) * 0.7 - Math.abs(sa.t[2] - sb.t[2]) * 0.3;
    const ra = this.touch(a, b.id, 0), rb = this.touch(b, a.id, 0);
    // dispute : deux caractères vifs et peu empathiques, surtout si l'un est irrité
    const heat = (a.aggr + b.aggr) / 2 * (1 - (sa.t[3] + sb.t[3]) / 2) * (1 + (ma.emo[EMO.ANGER] + mb.emo[EMO.ANGER]) / 120) * (compat < 0.55 ? 1.4 : 0.5);
    if (this.rnd(a.id, b.id + sim.tick, 11) < heat * 0.45) {
      this.touch(a, b.id, -22); this.touch(b, a.id, -22);
      this.remember(sim, a, MEM.QUARREL, -35, b.id); this.remember(sim, b, MEM.QUARREL, -35, a.id);
      this.feel(a, EMO.ANGER, 25); this.feel(b, EMO.ANGER, 25);
      this.stats.quarrels++;
      if (ra.a < -50 && this.rnd(a.id, b.id, 12) < a.aggr * 0.5) { b.hp = Math.max(5, b.hp - 6); this.feel(b, EMO.FEAR, 15); } // coups échangés, sans mort
      return;
    }
    // réconciliation : l'empathie adoucit une rivalité installée
    if (ra.k === REL.RIVAL && this.rnd(a.id, b.id + sim.tick, 13) < 0.3 * (sa.t[3] + sb.t[3])) {
      this.touch(a, b.id, 28); this.touch(b, a.id, 28);
      this.remember(sim, a, MEM.RECONCILE, 40, b.id); this.remember(sim, b, MEM.RECONCILE, 40, a.id);
      this.feel(a, EMO.JOY, 20); this.feel(b, EMO.JOY, 20);
      this.stats.reconciled++;
      return;
    }
    const gain = 9 * (0.4 + compat) * (0.6 + sa.t[0] * 0.5 + sb.t[0] * 0.5);
    const before = ra.k;
    const na = this.touch(a, b.id, gain); this.touch(b, a.id, gain);
    if (before !== REL.FRIEND && na.k === REL.FRIEND) { this.remember(sim, a, MEM.FRIEND, 45, b.id); this.remember(sim, b, MEM.FRIEND, 45, a.id); this.feel(a, EMO.JOY, 20); this.feel(b, EMO.JOY, 20); }
    this.feel(a, EMO.JOY, 4); this.feel(b, EMO.JOY, 4);
    // transmission d'idées entre amis
    if (ra.a >= 35) this.spread(a, b, sim.tick); if (rb.a >= 35) this.spread(b, a, sim.tick);
  }

  private spread(from: Citizen, to: Citizen, tick: number): void {
    const mf = from.mind!, mt = to.mind!;
    const p = 0.22 * (0.4 + (from.soul?.t[0] ?? 0.5)) * (1 - 0.5 * (to.soul?.t[4] ?? 0.5));
    for (const bit of [IDEA.DISTRUST, IDEA.WANDER, IDEA.FAITH, IDEA.FEAR_GOD]) {
      if ((mf.ideas & bit) && !(mt.ideas & bit) && this.rnd(from.id, to.id + tick, 20 + bit) < p) {
        mt.ideas |= bit;
        if (bit === IDEA.DISTRUST) mt.trust = clamp(mt.trust - 8, -100, 100);
        if (bit === IDEA.FAITH) to.faith = Math.min(1, to.faith + 0.06);
      }
    }
  }

  // ------------------------------------------------------------ boucle par habitant

  /** Appelé à chaque tick pour chaque habitant : émotions qui retombent, délibération échelonnée (1 fois par an environ). */
  tick(sim: SimulationEngine, c: Citizen, civ: Civ): void {
    if (!TUNING.mind) return;
    const m = this.ensure(sim, c);
    if ((sim.tick + c.id) % 10 === 0) {
      for (let i = 0; i < 5; i++) m.emo[i] = clamp(m.emo[i] - (i === EMO.JOY ? 0.8 : 2.2));
      if (c.hunger > 80) { this.feel(c, EMO.SAD, 3); this.feel(c, EMO.ANGER, 2); }
      if (c.hunger > 85 && civ.famine > 0 && this.rnd(c.id, sim.tick, 31) < 0.08) this.remember(sim, c, MEM.FAMINE, -35 - Math.min(40, civ.famine * 8), -1);
      if ((c.soul?.com ?? 60) > 60 && c.hunger < 40) this.feel(c, EMO.JOY, 1.5);
    }
    if (sim.tick >= m.next && c.army < 0 && c.panic <= 0) {
      m.next = sim.tick + Math.round(TUNING.deliberateYears * TPY) + Math.floor(this.rnd(c.id, sim.tick, 2) * 20);
      this.deliberate(sim, c, civ, m);
    }
  }

  /** Meilleur village où s'installer (null si aucun n'est vraiment plus attirant). */
  private destination(sim: SimulationEngine, c: Citizen, civ: Civ, m: Mind): { city: City; score: number } | null {
    const own = sim.cityById.get(c.city);
    let best: City | null = null, bs = -1;
    for (const o of sim.cities) {
      if (o.id === c.city || o.pop >= o.cap * 0.92) continue;
      const dc = sim.civById.get(o.civ);
      if (!dc || !dc.alive || (dc.id !== civ.id && sim.statusOf(civ.id, dc.id) === "war")) continue;
      const dist = own ? Math.hypot(o.x - own.x, o.y - own.y) : 20;
      if (dist > 45) continue;
      let sc = (o.cap - o.pop) / Math.max(4, o.cap) * 0.8 + dc.stability / 100 * 0.7 + (dc.food > dc.pop * 0.5 ? 0.35 : 0) - dist / 70 * 0.45 + (dc.id === civ.id ? 0.1 + (m.trust > -30 ? 0.2 : 0) : (m.trust < -70 ? 0 : -0.7));
      if (sc > bs) { bs = sc; best = o; }
    }
    return best ? { city: best, score: bs } : null;
  }

  private deliberate(sim: SimulationEngine, c: Citizen, civ: Civ, m: Mind): void {
    this.stats.deliberations++;
    const s = c.soul!;
    const adult = c.job !== "child";
    // confiance au dirigeant : prospérité et stabilité l'entretiennent, la faim et la guerre la rongent
    const famine = this.memLoad(sim, m, MEM.FAMINE), viol = this.memLoad(sim, m, MEM.VIOLENCE), loss = this.memLoad(sim, m, MEM.KIN_DEATH);
    let dTrust = (civ.stability - 50) * 0.07 + (civ.food > civ.pop * 0.5 ? 1.5 : -2.5) - (civ.famine > 0 ? 3 + civ.famine : 0) - famine * 5 - viol * 3;
    if (m.ideas & IDEA.DISTRUST) dTrust -= 1.5;
    if (sim.activeWars().some((w) => w.a === civ.id || w.d === civ.id) && c.aggr < 0.5) dTrust -= 1.2;
    m.trust = clamp(m.trust + dTrust, -100, 100);
    if (m.trust < -35) m.ideas |= IDEA.DISTRUST; else if (m.trust > 25) m.ideas &= ~IDEA.DISTRUST;
    if (!adult) return;
    // engagement : un départ en cours n'est pas remis en cause à chaque révision (le voyage dure)
    if (m.goal === GOAL.LEAVE && m.trust < 10 && m.gTarget >= 0 && sim.cityById.has(m.gTarget) && sim.tick - m.gT < TPY * 3) return;
    // projets : chaque tendance reçoit un score et des raisons ; hystérésis pour éviter les revirements
    const kin = m.rel.filter((r) => (r.k === REL.KIN || r.k === REL.PARTNER) && sim.citizenById.has(r.id) && sim.citizenById.get(r.id)!.city === c.city).length;
    const attached = Math.min(0.4, kin * 0.08) + (s.com > 60 ? 0.12 : 0) + s.t[4] * 0.12;
    const dest = this.destination(sim, c, civ, m);
    const own = sim.cityById.get(c.city);
    const ownScore = own ? (own.cap - own.pop) / Math.max(4, own.cap) * 0.8 + civ.stability / 100 * 0.7 : 0.4;
    const better = dest ? Math.max(0, dest.score - ownScore - 0.15) : 0;
    const R: [number, number][][] = [[], [], [], [], [], []]; // raisons par projet (code, poids)
    const add = (g: number, code: number, w: number) => { if (w > 0.02) R[g].push([code, w]); return w; };
    const uStay = 0.3 + attached;
    let uLeave = 0;
    const origin = sim.cityById.get(c.city);
    const canLeave = !!origin && origin.pop > 6 && civ.pop > 10 && (this.exodus.get(origin.id)?.n ?? 0) < Math.max(2, Math.floor(origin.pop * 0.25));
    if (dest && canLeave && c.army < 0 && sim.tick - m.lastLeave > TPY * 3) {
      uLeave += add(GOAL.LEAVE, 0, Math.max(0, -m.trust / 100) * 0.38) + add(GOAL.LEAVE, 1, famine * 0.3) + add(GOAL.LEAVE, 3, viol * 0.15) + add(GOAL.LEAVE, 2, loss * 0.08)
        + add(GOAL.LEAVE, 4, (m.ideas & IDEA.WANDER ? 0.14 : 0) + s.t[1] * 0.1 * (1 - s.t[4])) + add(GOAL.LEAVE, 6, s.home < 0 ? 0.1 : 0) + add(GOAL.LEAVE, 15, better * 0.6);
      uLeave += add(GOAL.LEAVE, 13, m.rel.some((r) => r.k === REL.FRIEND && sim.citizenById.get(r.id)?.mind?.goal === GOAL.LEAVE) ? 0.12 : 0);
      uLeave *= 1 - Math.min(0.6, attached * 0.7);
    }
    let uRebel = 0;
    if (c.army < 0 && civ.alive) {
      const fire = (c.courage * 0.5 + c.aggr * 0.5);
      uRebel += add(GOAL.REBEL, 0, Math.max(0, -m.trust - 20) / 100 * 0.9 * (0.4 + fire)) + add(GOAL.REBEL, 12, m.emo[EMO.ANGER] / 100 * 0.25) + add(GOAL.REBEL, 1, famine * 0.2 * fire);
      if (m.ideas & IDEA.DISTRUST) uRebel += add(GOAL.REBEL, 13, 0.1);
      uRebel *= 1 - s.t[4] * 0.4;
    }
    let uFamily = 0;
    if (c.age >= TUNING.minParentAge && c.age <= 38 && s.mate < 0) uFamily = add(GOAL.FAMILY, 8, 0.25 + s.t[0] * 0.25 + (m.emo[EMO.JOY] > 40 ? 0.1 : 0)) * (c.hunger < 50 && s.com > 40 ? 1 : 0.3);
    let uRevenge = 0;
    const foe = m.rel.filter((r) => r.k === REL.RIVAL).sort((a, b) => a.a - b.a)[0];
    if (foe && sim.citizenById.has(foe.id)) uRevenge = add(GOAL.REVENGE, 9, (-foe.a / 100) * 0.4 * (0.4 + c.aggr) + m.emo[EMO.ANGER] / 100 * 0.2) * (1 - s.t[3] * 0.5);
    const faithMem = this.memLoad(sim, m, MEM.DIVINE, 1) + this.memLoad(sim, m, MEM.HEALED, 1);
    const uDevout = add(GOAL.DEVOUT, 10, c.faith * 0.35 + faithMem * 0.3 + (m.ideas & IDEA.FAITH ? 0.12 : 0) + (m.ideas & IDEA.FEAR_GOD ? 0.08 : 0)) * 0.9;
    const U = [uStay, uLeave, uFamily, uRebel * 1.05, uRevenge, uDevout];
    U[m.goal] += 0.12; // continuité du projet en cours
    let best = 0;
    for (let g = 1; g < U.length; g++) if (U[g] > U[best]) best = g;
    // seuils : un départ ou une révolte exigent une vraie conviction
    if ((best === GOAL.LEAVE && U[best] < 0.55) || (best === GOAL.REBEL && U[best] < 0.55)) best = U[GOAL.STAY] >= U[GOAL.FAMILY] ? GOAL.STAY : GOAL.FAMILY;
    const why = R[best].sort((a, b) => b[1] - a[1]).slice(0, 3).map((x) => x[0]);
    if (best === GOAL.STAY) { why.length = 0; why.push(7); if (s.com > 60) why.push(11); }
    if (best !== m.goal) { m.goal = best; m.gT = sim.tick; m.gTarget = best === GOAL.LEAVE && dest ? dest.city.id : best === GOAL.REVENGE && foe ? foe.id : -1; }
    m.gWhy = why;
    if (best === GOAL.LEAVE && dest) this.decideLeave(sim, c, civ, m, dest.city, why);
    if (best === GOAL.FAMILY && s.mate < 0) this.seekPartner(sim, c);
    if (best === GOAL.REVENGE && foe) { const o = sim.citizenById.get(foe.id); if (o && Math.hypot(o.x - c.x, o.y - c.y) < 8) this.confront(sim, c, o); }
    if (best === GOAL.DEVOUT) { m.ideas |= IDEA.FAITH; }
    this.maybeBetray(sim, c, m);
  }

  /** Quitter son village : la famille est persuadée selon l'affinité et ses propres convictions. */
  private decideLeave(sim: SimulationEngine, c: Citizen, civ: Civ, m: Mind, dest: City, why: number[]): void {
    m.lastLeave = sim.tick;
    for (const r of m.rel) {
      if (r.k !== REL.KIN && r.k !== REL.PARTNER) continue;
      const o = sim.citizenById.get(r.id);
      if (!o || o.dead || o.city !== c.city || o.army >= 0) continue;
      const mo = this.ensure(sim, o);
      if (mo.goal === GOAL.LEAVE) continue;
      const p = r.a / 100 * 0.55 + (o.job === "child" ? 0.4 : 0) + Math.max(0, -mo.trust) / 100 * 0.2 - (o.soul?.t[4] ?? 0.5) * 0.15;
      if (this.rnd(c.id, o.id + sim.tick, 40) < p) { mo.goal = GOAL.LEAVE; mo.gT = sim.tick; mo.gTarget = dest.id; mo.gWhy = [5]; mo.lastLeave = sim.tick; this.touch(o, c.id, 4); }
    }
    void civ; void why;
  }

  private seekPartner(sim: SimulationEngine, c: Citizen): void {
    let best: Citizen | null = null, bs = 0.15;
    sim.hash.query(sim.citizens, c.x, c.y, 6, (o) => {
      if (o === c || o.dead || o.female === c.female || o.civ !== c.civ || o.age < TUNING.minParentAge || (o.soul?.mate ?? -1) >= 0 || o.soul?.mother === c.id || c.soul?.mother === o.id) return;
      if (o.soul && c.soul && o.soul.mother >= 0 && o.soul.mother === c.soul.mother) return;
      const r = this.relOf(c, o.id);
      const sc = (r ? r.a / 100 : 0) * 0.6 + (1 - Math.abs((o.soul?.t[0] ?? 0.5) - (c.soul?.t[0] ?? 0.5))) * 0.3 + (1 - Math.abs(o.age - c.age) / 25) * 0.3;
      if (sc > bs) { bs = sc; best = o; }
    });
    const o = best as Citizen | null;
    if (o) this.bond(sim, c, o);
  }

  private confront(sim: SimulationEngine, c: Citizen, o: Citizen): void {
    this.ensure(sim, o);
    this.touch(c, o.id, -10); this.touch(o, c.id, -14);
    this.remember(sim, o, MEM.QUARREL, -45, c.id);
    this.feel(o, EMO.FEAR, 15); this.feel(o, EMO.ANGER, 25);
    if (c.aggr > 0.65 && this.rnd(c.id, o.id + sim.tick, 50) < 0.3) o.hp = Math.max(5, o.hp - 14); // la rancune se paie parfois en coups
    if (this.rnd(c.id, o.id + sim.tick, 51) < 0.3 + (c.soul?.t[3] ?? 0.5) * 0.4) { // ou s'apaise
      this.touch(c, o.id, 25); this.touch(o, c.id, 25);
      this.remember(sim, c, MEM.RECONCILE, 35, o.id); this.remember(sim, o, MEM.RECONCILE, 35, c.id);
      this.stats.reconciled++;
      c.mind!.goal = GOAL.STAY;
    }
  }

  /** Trahison conjugale : ambitieux, peu empathique, couple distendu. Conséquences : rupture, rancune, rivalité durable. */
  private maybeBetray(sim: SimulationEngine, c: Citizen, m: Mind): void {
    const s = c.soul!;
    if (s.mate < 0 || s.t[2] < 0.7 || s.t[3] > 0.4) return;
    const p = sim.citizenById.get(s.mate);
    if (!p || p.dead) return;
    const r = this.relOf(c, p.id);
    if (!r || r.a > 55 || this.rnd(c.id, sim.tick, 60) > 0.18) return;
    let other: Citizen | null = null;
    sim.hash.query(sim.citizens, c.x, c.y, 6, (o) => { if (!other && o !== c && o !== p && !o.dead && o.female !== c.female && o.civ === c.civ && o.age >= TUNING.minParentAge && (o.soul?.mate ?? -1) < 0) other = o; });
    const o = other as Citizen | null;
    if (!o) return;
    const mp = this.ensure(sim, p);
    this.unbond(c, p);
    this.touch(p, c.id, -80, REL.RIVAL); this.touch(c, p.id, -40, REL.RIVAL);
    this.remember(sim, p, MEM.BETRAYAL, -85, c.id); this.feel(p, EMO.ANGER, 55); this.feel(p, EMO.SAD, 45); mp.ideas |= 0;
    this.remember(sim, c, MEM.BETRAYAL, -25, p.id);
    this.ensure(sim, o); this.bond(sim, c, o);
    this.stats.betrayals++;
    const civ = sim.civById.get(c.civ);
    sim.events.log(sim, { civ: c.civ, type: "absurd", importance: 1, text: `${c.name} abandonne ${p.name} pour ${o.name}. Le village a un avis sur la question.`, consequences: `${p.name} garde rancune.` });
    void civ; void m;
  }

  // ------------------------------------------------------------ exécution des projets

  /** Exécute le projet en cours (déplacement vers un autre village…). Retourne true si l'habitant a agi ce tick. */
  act(sim: SimulationEngine, c: Citizen): boolean {
    const m = c.mind;
    if (!TUNING.mind || !m || c.army >= 0) return false;
    if (m.goal === GOAL.LEAVE && m.gTarget >= 0) {
      const dest = sim.cityById.get(m.gTarget);
      if (!dest || sim.tick - m.gT > TPY * 4) { m.goal = GOAL.STAY; return false; }
      if (c.city === dest.id) { m.goal = GOAL.STAY; return false; }
      const r = moveToward(sim.world, c, dest.x + 0.5 + ((c.id % 5) - 2) * 0.4, dest.y + 1.6, CITIZEN_SPEED, 0.9);
      c.state = "travel";
      if (r === 1) this.arrive(sim, c, dest);
      else if (r === 2) { m.goal = GOAL.STAY; c.state = "idle"; return false; }
      return true;
    }
    return false;
  }

  private arrive(sim: SimulationEngine, c: Citizen, dest: City): void {
    const m = c.mind!, from = sim.cityById.get(c.city), oldCiv = sim.civById.get(c.civ), newCiv = sim.civById.get(dest.civ);
    if (!newCiv) { m.goal = GOAL.STAY; return; }
    const crossed = newCiv.id !== c.civ;
    c.city = dest.id;
    if (crossed) {
      c.civ = newCiv.id; c.work = -1; c.wx = -1; c.wy = -1;
      if (c.job !== "child") c.job = sim.civSys.pickJob(sim, newCiv);
      c.faith = Math.max(0.05, Math.min(1, c.faith * 0.5 + newCiv.avgFaith * 0.5)); // adopte les croyances du nouveau foyer
    }
    if (c.soul) { c.soul.home = -1; c.soul.mate = c.soul.mate; }
    m.goal = GOAL.STAY; m.gT = sim.tick; m.gTarget = -1; m.lastLeave = sim.tick;
    m.trust = Math.round(clamp(15 + (newCiv.stability - 50) * 0.3, -100, 100));
    m.ideas = (m.ideas & ~IDEA.DISTRUST) | IDEA.WANDER; // il raconte à ses nouveaux voisins qu'on peut vivre ailleurs
    this.remember(sim, c, MEM.MIGRATE, 20, dest.id);
    this.feel(c, EMO.HOPE, 40);
    this.stats.leaves++;
    if (from) {
      const e = this.exodus.get(from.id) ?? { n: 0, to: dest.id, first: c.name };
      e.n++; e.to = dest.id; this.exodus.set(from.id, e);
      if (e.n === 3) {
        sim.events.log(sim, { civ: oldCiv?.id ?? -1, civ2: crossed ? newCiv.id : -1, type: "city", importance: 2,
          text: `Des familles quittent ${from.name} pour ${dest.name}. ${e.first} dit qu'on y mange mieux ; ${oldCiv?.leader.name ?? "le chef"} préfère ne pas commenter.`,
          consequences: `Exode de ${from.name}${crossed ? ` vers ${newCiv.name}` : ""} : la confiance dans le dirigeant est entamée.` });
        if (oldCiv) oldCiv.stability = Math.max(0, oldCiv.stability - 3);
      }
    }
  }

  // ------------------------------------------------------------ décisions collectives (annuelles)

  yearly(sim: SimulationEngine): void {
    if (!TUNING.mind) return;
    this.exodus.clear();
    for (const civ of sim.civs) {
      if (!civ.alive) continue;
      const pop = sim.citizens.filter((c) => c.civ === civ.id && !c.dead && c.job !== "child");
      if (pop.length < 12) continue;
      // révolte : assez de mécontents déterminés
      const rebels = pop.filter((c) => c.mind?.goal === GOAL.REBEL && c.army < 0);
      if (rebels.length >= Math.max(4, Math.floor(pop.length * 0.22))) this.rebel(sim, civ, rebels, pop.length);
      // culte : la foi se propage
      const faithful = pop.filter((c) => (c.mind?.ideas ?? 0) & IDEA.FAITH);
      if (faithful.length >= Math.max(5, pop.length * 0.3) && civ.avgFaith < 0.92 && sim.tick - (civ.lastEvt["cult"] ?? -1e9) > TPY * 12) {
        civ.lastEvt["cult"] = sim.tick;
        for (const c of faithful) { c.faith = Math.min(1, c.faith + 0.15); this.feel(c, EMO.HOPE, 20); }
        civ.stability = Math.min(100, civ.stability + 3);
        this.stats.conversions++;
        sim.events.log(sim, { civ: civ.id, type: "miracle", importance: 2, text: `Une ferveur nouvelle gagne ${civ.name} : ${faithful[0].name} et ${faithful.length - 1} autres se disent touchés par le ciel.`, consequences: "La foi collective progresse." });
      }
    }
  }

  private rebel(sim: SimulationEngine, civ: Civ, rebels: Citizen[], adults: number): void {
    const soldiers = civ.soldiers / Math.max(1, adults);
    const force = rebels.length / adults;
    const win = force * (1.2 + rebels.reduce((a, c) => a + c.courage, 0) / rebels.length) > 0.28 + soldiers * 0.8 + (civ.stability > 60 ? 0.12 : 0);
    this.stats.rebellions++;
    const old = civ.leader;
    const head = rebels.slice().sort((a, b) => (b.soul?.t[2] ?? 0) + b.courage - ((a.soul?.t[2] ?? 0) + a.courage))[0];
    for (const r of rebels) { this.remember(sim, r, MEM.REBEL, win ? 45 : -60, head.id); r.mind!.goal = GOAL.STAY; r.mind!.gT = sim.tick; }
    if (win) {
      this.stats.coups++;
      sim.civSys.leaderDies(sim, civ, "coup", `renversé par ${head.name}`);
      civ.leader = { ...civ.leader, name: head.name, age: Math.floor(head.age), intel: head.intel, aggr: head.aggr, ambition: head.soul?.t[2] ?? 0.6, goat: false };
      sim.events.log(sim, { civ: civ.id, type: "leader", importance: 3, text: `Révolte à ${civ.name} : ${head.name} renverse ${old.title} ${old.name}, porté par ${rebels.length} mécontents.`, consequences: "Nouveau dirigeant issu du peuple ; la confiance repart." });
      for (const c of sim.citizens) if (c.civ === civ.id && c.mind) { c.mind.trust = clamp(c.mind.trust + 35, -100, 100); c.mind.ideas &= ~IDEA.DISTRUST; this.remember(sim, c, MEM.LEADER, 25, head.id); }
    } else {
      let killed = 0;
      for (const r of rebels) if (this.rnd(r.id, sim.tick, 70) < 0.35) { sim.killCitizen(r, "unrest"); killed++; } else { r.mind!.trust = clamp(r.mind!.trust - 15, -100, 100); this.feel(r, EMO.FEAR, 40); }
      civ.stability = Math.max(0, civ.stability - 10);
      sim.events.log(sim, { civ: civ.id, type: "war", importance: 2, text: `La révolte de ${head.name} est écrasée à ${civ.name}.`, consequences: `${killed} rebelle(s) tué(s) ; la rancune demeure.` });
      for (const c of sim.citizens) if (c.civ === civ.id && c.mind && !c.dead) { this.remember(sim, c, MEM.VIOLENCE, -20, -1); }
    }
  }

  // ------------------------------------------------------------ lecture humaine (fiche)

  /** Description lisible de l'esprit : intention, raisons, pensée du moment et souvenirs marquants. */
  describe(sim: SimulationEngine, c: Citizen): { intent: string; why: string[]; thought: string; memories: string[]; emotion: string; relations: string[] } {
    const m = this.ensure(sim, c);
    const dest = m.gTarget >= 0 && m.goal === GOAL.LEAVE ? sim.cityById.get(m.gTarget) : undefined;
    const foe = m.goal === GOAL.REVENGE ? sim.citizenById.get(m.gTarget) : undefined;
    const intent = ({
      [GOAL.STAY]: "Reste et vit sa vie", [GOAL.LEAVE]: dest ? `Veut partir pour ${dest.name}` : "Veut partir", [GOAL.FAMILY]: "Cherche à fonder une famille",
      [GOAL.REBEL]: "Prépare la révolte", [GOAL.REVENGE]: foe ? `Rumine contre ${foe.name}` : "Rumine une rancune", [GOAL.DEVOUT]: "Se tourne vers le ciel",
    } as Record<number, string>)[m.goal] ?? "—";
    const why = m.gWhy.map((k) => WHY[k]).filter(Boolean);
    const mems = m.mem.slice().sort((a, b) => Math.abs(this.strength(b, sim.tick)) - Math.abs(this.strength(a, sim.tick))).slice(0, 4).map((x) => {
      const who = x.who >= 0 && (x.k === MEM.KIN_DEATH || x.k === MEM.FRIEND || x.k === MEM.QUARREL || x.k === MEM.BETRAYAL || x.k === MEM.RECONCILE || x.k === MEM.WEDDING || x.k === MEM.BIRTH) ? sim.citizenById.get(x.who)?.name : undefined;
      return `An ${Math.floor(x.t / TPY) + 1} · ${MEM_TEXT[x.k] ?? "Un souvenir"}${who ? ` (${who})` : ""}`;
    });
    const emoI = m.emo.indexOf(Math.max(...m.emo));
    const emotion = m.emo[emoI] > 20 ? EMO_LABEL[emoI] : "Calme";
    const famine = this.memLoad(sim, m, MEM.FAMINE);
    let thought = "La vie suit son cours.";
    if (c.hunger > 75) thought = "J'ai tellement faim…";
    else if (c.panic > 0 || m.emo[EMO.FEAR] > 55) thought = "Il faut fuir, vite !";
    else if (m.goal === GOAL.LEAVE) thought = famine > 0.2 ? "Plus jamais cette faim. Allons ailleurs." : "On serait mieux ailleurs.";
    else if (m.goal === GOAL.REBEL) thought = "Le chef nous a trahis. Ça ne peut plus durer.";
    else if (m.goal === GOAL.REVENGE) thought = foe ? `${foe.name} me le paiera.` : "Je n'oublie pas.";
    else if (m.goal === GOAL.FAMILY) thought = "Je ne voudrais pas rester seul(e).";
    else if (m.goal === GOAL.DEVOUT) thought = "Quelqu'un, là-haut, nous regarde peut-être.";
    else if (m.trust < -35) thought = "Je ne fais plus confiance au chef.";
    else if (famine > 0.3) thought = "Je n'oublierai jamais la famine.";
    else if (m.emo[EMO.SAD] > 35) thought = "Il me manque quelqu'un.";
    else if (m.emo[EMO.JOY] > 45) thought = "Quelle belle journée.";
    const rel = m.rel.filter((r) => sim.citizenById.has(r.id)).sort((a, b) => Math.abs(b.a) - Math.abs(a.a)).slice(0, 4).map((r) => {
      const o = sim.citizenById.get(r.id);
      return `${o?.name ?? "Disparu(e)"} · ${["connaissance", "ami(e)", "rival(e)", "partenaire", "famille"][r.k]}`;
    });
    return { intent, why, thought, memories: mems, emotion, relations: rel };
  }
}
