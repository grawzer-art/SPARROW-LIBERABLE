import { CITIZEN_SPEED } from "./config";
import { moveToward } from "./path";
import { hash2 } from "./rng";
import { HOUSE_CAP } from "./EconomySystem";
import type { SimulationEngine } from "./SimulationEngine";
import type { ActionId, Building, Citizen, City, Civ, SoulState } from "./types";

/** Actions du moteur de décision. L'ordre est celui du tableau d'utilités `SoulState.sc`. */
export const ACT = { WORK: 0, FOOD: 1, REST: 2, SOCIAL: 3, FLEE: 4, RELAX: 5, IDLE: 6 } as const;
export const ACT_LABEL = ["Travailler", "Se nourrir", "Se reposer", "Discuter", "Fuir un danger", "Flâner", "Attendre"];
export const TRAIT_LABEL = ["Sociabilité", "Curiosité", "Ambition", "Empathie", "Prudence"];

/** Durée d'engagement d'une action (ticks, 30 ticks = 1 an) : évite les changements d'objectif incessants. */
const DURATION = [45, 70, 90, 14, 20, 25, 10];
/** Durée minimale avant tout changement volontaire (hystérésis temporelle). */
const MIN_HOLD = 6;
/** Une action concurrente doit battre l'action en cours d'au moins 30 % pour la remplacer (hystérésis de score). */
const SWITCH_RATIO = 1.3;

/** Compensation du temps de repos et de conversation désormais simulé (≈ 12 % du temps) : l'économie reste calibrée comme avant. */
export const WORK_BASE = 1.16;

const clamp = (v: number, a = 0, b = 100) => (v < a ? a : v > b ? b : v);
const sm = (x: number, a: number, b: number) => { const t = x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a); return t * t * (3 - 2 * t); };

export interface SoulCounters { decisions: number; switches: number; fails: number; talks: number; rests: number; eats: number; flees: number; ignoredDanger: number; }

/**
 * Moteur d'âmes : besoins individuels, traits, foyer et choix d'actions par utilité (Utility AI).
 * Il ne remplace pas les systèmes existants : il décide QUELLE action un habitant entreprend,
 * et les exécuteurs existants (cueillette, métiers, déplacements) restent ceux de CitizenSystem.
 * Déterministe : aucune consommation du générateur aléatoire de la simulation, seulement des hachages de (id, tick).
 */
export class SoulSystem {
  /** Occupation des logements (id de bâtiment -> nombre d'habitants), recalculée à chaque tick. */
  occ = new Map<number, number>();
  stats: SoulCounters = { decisions: 0, switches: 0, fails: 0, talks: 0, rests: 0, eats: 0, flees: 0, ignoredDanger: 0 };

  // ------------------------------------------------------------ identité

  /** Crée l'âme d'un habitant : traits hérités (moyenne des parents) + bruit déterministe fondé sur l'identifiant. */
  init(c: Citizen, mother?: Citizen, father?: Citizen): SoulState {
    const tr = (k: number): number => {
      const own = (hash2(c.id, k, 7701) + hash2(c.id, k, 7702) + hash2(c.id, k, 7703)) / 3; // loi centrée, peu d'extrêmes
      const ps = [mother?.soul?.t[k], father?.soul?.t[k]].filter((v): v is number => v !== undefined);
      const mix = ps.length ? 0.45 * own + 0.55 * (ps.reduce((a, b) => a + b, 0) / ps.length) + (own - 0.5) * 0.25 : own;
      return Math.round(clamp(mix, 0.02, 0.98, ) * 100) / 100;
    };
    const s: SoulState = {
      v: 1,
      fat: Math.round(hash2(c.id, 1, 7710) * 60), soc: Math.round(hash2(c.id, 2, 7710) * 60), com: 60, fear: 0,
      t: [tr(0), tr(1), tr(2), tr(3), tr(4)],
      home: -1, mother: mother ? mother.id : -1, father: father ? father.id : -1, mate: -1,
      act: ACT.WORK, since: 0, until: 0, target: -1, sc: [0, 0, 0, 0, 0, 0, 0], fail: -1, failUntil: 0,
    };
    c.soul = s;
    return s;
  }
  /** Un nouveau-né rejoint le logis de sa mère, si celui-ci a encore de la place. */
  inheritHome(sim: SimulationEngine, c: Citizen, mother: Citizen): void {
    const mh = mother.soul?.home ?? -1;
    const b = mh >= 0 ? sim.buildingById.get(mh) : undefined;
    if (b && b.type === "house" && (this.occ.get(mh) ?? 0) < HOUSE_CAP[Math.min(5, b.era)]) { c.soul!.home = mh; this.occ.set(mh, (this.occ.get(mh) ?? 0) + 1); }
  }
  ensure(c: Citizen): SoulState {
    return c.soul ?? this.init(c);
  }

  beginTick(sim: SimulationEngine): void {
    this.occ.clear();
    for (const c of sim.citizens) {
      const h = c.soul?.home ?? -1;
      if (h >= 0 && !c.dead) this.occ.set(h, (this.occ.get(h) ?? 0) + 1);
    }
  }

  private homeOf(sim: SimulationEngine, s: SoulState): Building | undefined {
    if (s.home < 0) return undefined;
    const b = sim.buildingById.get(s.home);
    return b && b.hp > 0 && b.progress >= 1 && b.civ >= 0 && b.type === "house" ? b : undefined;
  }

  /** Attribue un logement libre le plus proche (capacité selon l'époque). Un enfant reste chez ses parents. */
  assignHome(sim: SimulationEngine, c: Citizen): void {
    const s = c.soul!;
    let cur = this.homeOf(sim, s);
    if (cur && cur.civ !== c.civ) cur = undefined;
    if (cur) return;
    s.home = -1;
    let best: Building | undefined, bd = Infinity;
    for (const b of sim.bOf(c.civ, "house")) {
      if (b.progress < 1 || b.hp <= 0 || (c.city >= 0 && b.city !== c.city)) continue;
      if ((this.occ.get(b.id) ?? 0) >= HOUSE_CAP[Math.min(5, b.era)]) continue;
      const d = Math.hypot(b.x - c.x, b.y - c.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { s.home = best.id; this.occ.set(best.id, (this.occ.get(best.id) ?? 0) + 1); }
  }

  // ------------------------------------------------------------ besoins

  /** Évolution des besoins : coûts de l'activité en cours, repos réel, solitude, confort du logement, peur qui retombe. */
  tickNeeds(sim: SimulationEngine, c: Citizen): void {
    const s = this.ensure(c);
    const k = c.job === "child" ? 0.6 : 1;
    switch (c.state) {
      case "rest": {
        const home = this.homeOf(sim, s);
        const indoors = !!home && Math.hypot(home.x + 0.5 - c.x, home.y + 0.5 - c.y) < 1.4;
        s.fat -= indoors ? 2.4 : 1.2;
        if (indoors && c.hp < 100 && c.sick === 0 && c.hunger < 70) c.hp = Math.min(100, c.hp + 0.12);
        break;
      }
      case "talk": s.fat += 0.02; break;
      case "idle": case "wander": s.fat += 0.04 * k; break;
      default: s.fat += 0.12 * k; // travail, marche, combat, fuite
    }
    s.soc += c.state === "talk" ? -4 : 0.08 + 0.12 * s.t[0];
    // confort : un logement non surpeuplé rassure ; sans toit (ou entassé), il s'érode
    const home = this.homeOf(sim, s);
    const crowd = home ? (this.occ.get(home.id) ?? 1) / HOUSE_CAP[Math.min(5, home.era)] : 2;
    const target = !home ? 25 : crowd > 1 ? 45 : 72;
    s.com += Math.sign(target - s.com) * Math.min(0.3, Math.abs(target - s.com));
    s.fear = c.panic > 0 ? Math.max(s.fear, 60) : s.fear - 0.8;
    s.fat = clamp(s.fat); s.soc = clamp(s.soc); s.com = clamp(s.com); s.fear = clamp(s.fear);
  }

  /** Rendement du travail : la fatigue extrême, le mal-être et l'isolement pèsent ; un habitant reposé produit un peu plus. */
  workFactor(c: Citizen): number {
    const s = c.soul;
    if (!s) return 1;
    return WORK_BASE * (s.fat > 90 ? 0.7 : s.fat < 35 ? 1.04 : 1) * (s.com < 20 ? 0.92 : 1) * (s.soc > 90 ? 0.95 : 1);
  }

  // ------------------------------------------------------------ perception du danger

  /**
   * Danger perçu (0..1) : feux voisins et armées ennemies proches. La réaction dépend de la personnalité :
   * un prudent fuit tôt, un courageux tient bon face au même danger.
   */
  sense(sim: SimulationEngine, c: Citizen): void {
    const s = this.ensure(c), w = sim.world;
    let d = 0, sx = 0, sy = 0, n = 0;
    const cx = Math.floor(c.x), cy = Math.floor(c.y);
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = cx + dx, y = cy + dy;
        if (w.inb(x, y) && w.fire[y * w.size + x] > 0) { d += 0.22; sx += x + 0.5; sy += y + 0.5; n++; }
      }
    for (const a of sim.armies) {
      if (a.civ === c.civ || a.soldiers.length === 0 || sim.statusOf(c.civ, a.civ) !== "war") continue;
      const dist = Math.hypot(a.x - c.x, a.y - c.y);
      if (dist < 5) { d += (1 - dist / 5) * 0.9; sx += a.x * 2; sy += a.y * 2; n += 2; }
    }
    if (d <= 0) return;
    d = Math.min(1, d);
    s.fear = clamp(s.fear + 10 * d);
    // soldats et combattants engagés ne fuient pas ; les autres comparent danger perçu et courage
    if (c.army >= 0 || c.job === "soldier") return;
    const threshold = 0.22 + 0.5 * c.courage;
    if (d * (0.7 + 0.6 * s.t[4]) > threshold) {
      c.panic = 20 + Math.round(20 * d); c.fx = sx / n; c.fy = sy / n;
      this.stats.flees++;
    } else this.stats.ignoredDanger++;
  }

  // ------------------------------------------------------------ décision

  /** Utilités des actions pour cet habitant (0 = impossible ou sans intérêt). Les raisons sont conservées pour le diagnostic. */
  score(sim: SimulationEngine, c: Citizen, civ: Civ, out: number[]): void {
    const s = c.soul!;
    const t = sim.tick;
    const adult = c.job !== "child";
    const [soc, , amb, , prud] = s.t;
    out.fill(0);
    // se nourrir : seuil proche de l'ancien (≈50) ; le prudent mange plus tôt
    const hs = (0.5 - prud) * 12;
    out[ACT.FOOD] = sm(c.hunger, 30 + hs, 80 + hs) * 1.3 + (c.state === "eat" || c.state === "forage" ? 0.12 : 0);
    // se reposer : la fatigue seule ne suffit pas, il faut être en sécurité et pas affamé
    out[ACT.REST] = c.hunger > 85 || s.fear > 40 ? 0 : sm(s.fat, 45, 95) + (s.fat > 92 ? 0.5 : 0);
    // discuter : la solitude pèse selon la sociabilité ; exige un voisin disponible (vérifié à l'exécution)
    out[ACT.SOCIAL] = s.fear > 30 || c.hunger > 70 || s.fat > 85 ? 0 : sm(s.soc, 45, 100) * (0.45 + 0.75 * soc) * 0.85;
    out[ACT.WORK] = adult ? 0.6 + 0.12 * (amb - 0.5) - (s.com < 20 ? 0.05 : 0) : 0;
    out[ACT.RELAX] = 0.15 + 0.25 * sm(s.fat, 50, 85) * (1 - 0.6 * amb) + (adult ? 0 : 0.75);
    out[ACT.FLEE] = c.panic > 0 ? 2 : s.fear / 200;
    if (s.failUntil > t && s.fail >= 0) out[s.fail] = 0;
  }

  private tmp = [0, 0, 0, 0, 0, 0, 0];

  /** Choisit l'action de l'habitant (avec hystérésis) et la mémorise ; retourne son identifiant. */
  choose(sim: SimulationEngine, c: Citizen, civ: Civ): ActionId {
    const s = this.ensure(c), t = sim.tick;
    const cur = s.act;
    const emergency = c.hunger > 90 || s.fat > 95;
    if (!emergency && t < s.until && t - s.since < MIN_HOLD && !(s.failUntil > t && s.fail === cur)) return cur;
    const u = this.tmp;
    this.score(sim, c, civ, u);
    let best: ActionId = ACT.WORK;
    for (const a of [ACT.WORK, ACT.FOOD, ACT.REST, ACT.SOCIAL, ACT.RELAX] as ActionId[]) if (u[a] > u[best]) best = a;
    if (best !== cur && t < s.until && u[cur] > 0 && cur !== ACT.FLEE && !emergency && u[best] < u[cur] * SWITCH_RATIO) best = cur;
    s.sc = u.map((v) => Math.round(v * 100));
    this.stats.decisions++;
    if (best !== cur || t >= s.until) {
      if (best !== cur) this.stats.switches++;
      s.act = best; s.since = t; s.until = t + DURATION[best]; if (best !== cur) s.target = -1;
    }
    return s.act;
  }

  /** Une action échoue proprement : elle est écartée un moment et la décision est reprise au prochain tick. */
  fail(sim: SimulationEngine, c: Citizen, act: ActionId, ticks = 14): void {
    const s = c.soul!;
    s.fail = act; s.failUntil = sim.tick + ticks; s.until = 0;
    this.stats.fails++;
  }
  done(sim: SimulationEngine, c: Citizen): void {
    const s = c.soul!;
    s.until = 0;
    void sim;
  }

  // ------------------------------------------------------------ exécuteurs propres à l'âme

  /** Aller se reposer au logis (ou près du centre du village s'il n'y en a pas) ; la fatigue ne baisse qu'une fois sur place. */
  runRest(sim: SimulationEngine, c: Citizen, city: City | null): boolean {
    const s = c.soul!;
    const home = this.homeOf(sim, s);
    let tx: number, ty: number;
    if (home) { tx = home.x + 0.5 + Math.sin(home.rot) * 0.62; ty = home.y + 0.5 + Math.cos(home.rot) * 0.62; }
    else if (city) { tx = city.x + 0.5 + ((c.id % 5) - 2) * 0.45; ty = city.y + 1.7; }
    else { this.fail(sim, c, ACT.REST); return false; }
    if (s.fat <= 38 && c.state === "rest") { this.done(sim, c); c.state = "idle"; return false; }
    // logis trop loin : on se repose sur place (moins efficace) plutôt que de perdre le temps d'un long trajet
    if (Math.hypot(tx - c.x, ty - c.y) > 2.5) { if (c.state !== "rest") this.stats.rests++; c.state = "rest"; return true; }
    const r = moveToward(sim.world, c, tx, ty, CITIZEN_SPEED, 0.3);
    if (r === 2) { this.fail(sim, c, ACT.REST); c.state = "idle"; return false; }
    if (r === 1) { if (c.state !== "rest") this.stats.rests++; c.state = "rest"; } else c.state = "travel";
    return true;
  }

  private findPartner(sim: SimulationEngine, c: Citizen): Citizen | null {
    let best: Citizen | null = null, bd = Infinity;
    sim.hash.query(sim.citizens, c.x, c.y, 6, (o) => {
      if (o === c || o.dead || o.civ !== c.civ || o.army >= 0 || o.panic > 0 || o.hunger > 80 || o.state === "rest" || o.state === "mate" || o.state === "flee") return;
      const d = Math.hypot(o.x - c.x, o.y - c.y) - (c.soul?.mate === o.id ? 3 : 0) - (o.soul?.mother === c.id || c.soul?.mother === o.id ? 2 : 0);
      if (d < bd) { bd = d; best = o; }
    });
    return best;
  }

  /** Discuter avec un voisin : se rapprocher puis parler ; la solitude des DEUX interlocuteurs baisse réellement. */
  runSocial(sim: SimulationEngine, c: Citizen): boolean {
    const s = c.soul!;
    let p = s.target >= 0 ? sim.citizenById.get(s.target) ?? null : null;
    if (p && (p.dead || p.civ !== c.civ || p.panic > 0 || Math.hypot(p.x - c.x, p.y - c.y) > 9)) p = null;
    if (!p) { p = this.findPartner(sim, c); s.target = p ? p.id : -1; }
    if (!p) { this.fail(sim, c, ACT.SOCIAL, 30); return false; }
    if (s.soc < 18 && c.state === "talk") { this.done(sim, c); c.state = "idle"; return false; }
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d > 1.15) {
      const r = moveToward(sim.world, c, p.x, p.y, CITIZEN_SPEED, 1.0);
      if (r === 2) { this.fail(sim, c, ACT.SOCIAL, 20); return false; }
      c.state = "travel";
      return true;
    }
    if (c.state !== "talk") this.stats.talks++;
    c.state = "talk";
    const ps = this.ensure(p);
    ps.soc = clamp(ps.soc - 3);
    // l'interlocuteur s'arrête aussi, s'il n'a pas d'urgence
    if (ps.act !== ACT.SOCIAL && p.hunger < 70 && ps.fat < 85 && p.panic === 0 && p.army < 0) { ps.act = ACT.SOCIAL; ps.target = c.id; ps.since = sim.tick; ps.until = sim.tick + 10; }
    return true;
  }

  // ------------------------------------------------------------ diagnostic

  /** Explication lisible de la dernière décision (pour la fiche et les tests). */
  explain(c: Citizen): { action: string; reasons: [string, number][]; needs: Record<string, number> } {
    const s = c.soul;
    if (!s) return { action: "—", reasons: [], needs: {} };
    const reasons = s.sc.map((v, i) => [ACT_LABEL[i], v] as [string, number]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    return {
      action: ACT_LABEL[s.act],
      reasons,
      needs: { faim: Math.round(c.hunger), fatigue: Math.round(s.fat), solitude: Math.round(s.soc), inconfort: Math.round(100 - s.com), peur: Math.round(s.fear), santé: Math.round(c.hp) },
    };
  }
}
