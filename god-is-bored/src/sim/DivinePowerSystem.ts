import { TICKS_PER_YEAR } from "./config";
import { PROPHECIES, PROPHECY_MISREAD } from "./data";
import type { SimulationEngine } from "./SimulationEngine";
import type { Citizen, Civ, City } from "./types";
import { TUNING } from "./tuning";
import { techThreshold } from "./CivilizationSystem";
import { T } from "./World";
import { EMO, GOAL, IDEA, MEM } from "./MindSystem";

const TPY = TICKS_PER_YEAR;

export type PowerId = "lightning" | "fire" | "meteor" | "rain" | "plague" | "bless" | "wrath" | "prophecy";

export interface PowerInfo {
  id: PowerId; name: string; glyph: string; radius: number; cooldown: number; target: "area" | "civ"; blurb: string; detail: string;
}

export const POWERS: PowerInfo[] = [
  { id: "lightning", name: "Foudre", glyph: "ϟ", radius: 2.2, cooldown: 40, target: "area", blurb: "Rappelle à un village qui est le patron.",
    detail: "Détruit des bâtiments, tue des habitants, déclenche la panique et des incendies dans les forêts." },
  { id: "fire", name: "Incendie", glyph: "♨", radius: 3.2, cooldown: 90, target: "area", blurb: "Une étincelle. La forêt fait le reste.",
    detail: "Embrase forêts et toits dans la zone ; le feu se propage seul et chasse les habitants." },
  { id: "meteor", name: "Météorite", glyph: "◉", radius: 4, cooldown: 500, target: "area", blurb: "Un caillou. Très gros. Sans préavis.",
    detail: "Rase la zone, creuse un cratère (parfois un lac) et rend les voisins nerveux." },
  { id: "rain", name: "Pluie divine", glyph: "≋", radius: 7, cooldown: 240, target: "area", blurb: "Ils avaient demandé autre chose, mais bon.",
    detail: "Récoltes ×1,5 pendant plusieurs années, fertilité et forêts régénérées, incendies et sécheresses éteints." },
  { id: "plague", name: "Peste", glyph: "☣", radius: 3, cooldown: 500, target: "area", blurb: "Un petit cadeau contagieux.",
    detail: "Infecte les habitants de la zone ; se propage par proximité (villes, armées, colons)." },
  { id: "bless", name: "Bénédiction", glyph: "✦", radius: 0, cooldown: 420, target: "civ", blurb: "Choisir un favori. Les autres le sauront.",
    detail: "20 ans de prospérité : récoltes +30 %, natalité et stabilité en hausse, cadeau de vivres et d'or." },
  { id: "wrath", name: "Colère divine", glyph: "✺", radius: 7, cooldown: 1400, target: "area", blurb: "Une journée difficile. Pour eux.",
    detail: "Tempête de foudres, secousses, incendies : une catastrophe majeure sur une large zone." },
  { id: "prophecy", name: "Prophétie", glyph: "❡", radius: 0, cooldown: 300, target: "civ", blurb: "Leur parler. Ils comprendront de travers.",
    detail: "Un message influence la civilisation selon son intelligence, sa foi et son dirigeant. Risque d'interprétation créative." },
];
export const POWER_BY_ID = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerInfo>;

export interface CastResult { ok: boolean; msg: string; }

/** Pouvoirs divins : chaque effet modifie réellement l'état de la simulation. */
export class DivinePowerSystem {
  update(_sim: SimulationEngine): void { /* les effets durables vivent dans le monde (feu, météo, maladie) */ }

  cooldownLeft(sim: SimulationEngine, id: PowerId): number {
    return Math.max(0, (sim.cooldowns[id] ?? 0) - sim.tick);
  }

  nearestCity(sim: SimulationEngine, x: number, y: number, maxD = 99): City | null {
    let best: City | null = null, bd = maxD;
    for (const c of sim.cities) { const d = Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y); if (d < bd) { bd = d; best = c; } }
    return best;
  }

  civAt(sim: SimulationEngine, x: number, y: number): Civ | null {
    const w = sim.world;
    const i = w.tileAt(x, y);
    if (i >= 0 && w.owner[i] >= 0) return sim.civById.get(w.owner[i]) ?? null;
    const c = this.nearestCity(sim, x, y, 9);
    return c ? sim.civById.get(c.civ) ?? null : null;
  }

  cast(sim: SimulationEngine, id: PowerId, x: number, y: number, opts: { civ?: number; prophecy?: string } = {}): CastResult {
    const info = POWER_BY_ID[id];
    if (this.cooldownLeft(sim, id) > 0) return { ok: false, msg: `${info.name} : encore ${Math.ceil(this.cooldownLeft(sim, id) / TPY)} ans de repos divin.` };
    let res: CastResult;
    switch (id) {
      case "lightning": res = this.lightning(sim, x, y); break;
      case "fire": res = this.fire(sim, x, y); break;
      case "meteor": res = this.meteor(sim, x, y); break;
      case "rain": res = this.rain(sim, x, y); break;
      case "plague": res = this.plague(sim, x, y); break;
      case "wrath": res = this.wrath(sim, x, y); break;
      case "bless": res = this.bless(sim, opts.civ ?? this.civAt(sim, x, y)?.id ?? -1); break;
      case "prophecy": res = this.prophecy(sim, opts.civ ?? this.civAt(sim, x, y)?.id ?? -1, opts.prophecy ?? "peace"); break;
    }
    sim.removeDead();
    sim.citizenSys.census(sim);
    for (const c of sim.civs) if (c.alive && c.pop === 0 && sim.tick > 5) sim.civSys.extinguish(sim, c); // une civilisation sans habitant disparaît aussitôt
    if (res.ok) sim.cooldowns[id] = sim.tick + info.cooldown;
    return res;
  }

  // --------------------------------------------------------------- foudre

  /** Un impact de foudre. Retourne les dégâts causés. */
  strike(sim: SimulationEngine, x: number, y: number, r: number, power = 1): { killed: number; destroyed: number; leaderKilled: Civ | null } {
    const w = sim.world, rng = sim.rng;
    let killed = 0, destroyed = 0;
    let leaderKilled: Civ | null = null;
    sim.fx.push({ kind: "lightning", x, y });
    sim.mind.onDisaster(sim, x, y, r + 4, "disaster");
    for (const b of sim.buildings) {
      if (b.hp < 0 || b.civ === undefined) continue;
      const d = Math.hypot(b.x + 0.5 - x, b.y + 0.5 - y);
      if (d > r) continue;
      b.hp -= b.maxHp * 0.75 * power * (1 - 0.5 * d / r) + 5;
      const i = w.idx(b.x, b.y);
      if (b.type !== "hall" || b.hp <= 0) { if (rng.chance(0.5)) w.fire[i] = 30 + rng.int(30); }
      if (b.hp <= 0) { sim.destroyBuilding(b); destroyed++; }
    }
    sim.pruneBuildings();
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (!w.inb(tx, ty)) continue;
        const i = ty * w.size + tx;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r) continue;
        if ((w.trees[i] > 0 || w.bld[i] >= 0) && w.type[i] !== T.WATER && rng.chance(0.6)) { w.fire[i] = Math.max(w.fire[i], 40 + rng.int(40)); w.fireV++; }
        w.scorch[i] = Math.max(w.scorch[i], 0.6);
      }
    for (const c of sim.citizens) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= 1.4 * power + 0.2 && rng.chance(Math.min(1, 0.95 - d * 0.3))) { sim.killCitizen(c, "god"); killed++; }
      else if (d < 5) { c.panic = 45; c.fx = x; c.fy = y; }
    }
    for (const civ of sim.civs) {
      if (!civ.alive) continue;
      const cap = sim.cityById.get(civ.capital);
      if (cap && Math.hypot(cap.x + 0.5 - x, cap.y + 0.5 - y) < r + 0.6 && rng.chance(0.55)) {
        leaderKilled = civ;
      }
    }
    return { killed, destroyed, leaderKilled };
  }

  lightning(sim: SimulationEngine, x: number, y: number): CastResult {
    const r = POWER_BY_ID.lightning.radius;
    const near = this.nearestCity(sim, x, y, 10);
    const civ = near ? sim.civById.get(near.civ) ?? null : null;
    const res = this.strike(sim, x, y, r);
    if (civ) {
      civ.strikes++;
      civ.stability = Math.max(0, civ.stability - 6);
      sim.events.prayerResult(sim, civ, "lightning");
      if (civ.strikes >= 3 && sim.rng.chance(0.4)) sim.events.adoptLaw(sim, civ, "cloudBan", "après la troisième foudre en peu de temps");
    }
    if (res.leaderKilled) sim.civSys.leaderDies(sim, res.leaderKilled, "lightning");
    const where = near ? `près de ${near.name}` : "dans la nature";
    sim.events.log(sim, { civ: civ?.id ?? -1, type: "divine", importance: res.killed + res.destroyed > 2 ? 2 : 1,
      text: `La foudre frappe ${where}. ${res.killed > 0 ? "Les survivants y voient un signe ; les morts n'ont pas d'avis." : "Un arbre a des opinions fortes à ce sujet."}`,
      consequences: `${res.killed} mort(s), ${res.destroyed} bâtiment(s) détruit(s), panique et incendies.` });
    return { ok: true, msg: `Foudre : ${res.killed} mort(s), ${res.destroyed} bâtiment(s) détruit(s).` };
  }

  // --------------------------------------------------------------- incendie

  fire(sim: SimulationEngine, x: number, y: number): CastResult {
    const w = sim.world, rng = sim.rng, r = POWER_BY_ID.fire.radius;
    let lit = 0;
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (!w.inb(tx, ty)) continue;
        const i = ty * w.size + tx;
        if (Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > r || w.type[i] === T.WATER || w.type[i] === T.RIVER) continue;
        if ((w.trees[i] > 0 || w.bld[i] >= 0) && rng.chance(0.8)) { w.fire[i] = Math.max(w.fire[i], 45 + rng.int(40)); lit++; }
      }
    if (lit === 0) return { ok: false, msg: "Rien à brûler ici : il faut des arbres ou des toits." };
    w.fireV++;
    sim.fx.push({ kind: "fire", x, y });
    sim.mind.onDisaster(sim, x, y, r + 5, "fire");
    for (const c of sim.citizens) if (!c.dead && Math.hypot(c.x - x, c.y - y) < r + 3) { c.panic = Math.max(c.panic, 40); c.fx = x; c.fy = y; }
    const near = this.nearestCity(sim, x, y, 10), civ = near ? sim.civById.get(near.civ) ?? null : null;
    sim.events.log(sim, { civ: civ?.id ?? -1, type: "divine", importance: near && Math.hypot(near.x - x, near.y - y) < r + 3 ? 2 : 1,
      text: `Un incendie ravage ${near ? `les abords de ${near.name}` : "la forêt"}. Personne n'avoue avoir vu l'étincelle.`, consequences: `${lit} case(s) en flammes.` });
    return { ok: true, msg: `Incendie : ${lit} case(s) en flammes.` };
  }

  // --------------------------------------------------------------- influence sur un habitant

  /** Actions divines sur UN habitant : bénir, guérir, inspirer, foudroyer. Modifient réellement son état (jamais le décor). */
  influence(sim: SimulationEngine, citizenId: number, kind: "bless" | "heal" | "inspire" | "smite"): CastResult {
    const c = sim.citizenById.get(citizenId);
    if (!c || c.dead) return { ok: false, msg: "Cet habitant n'est plus là." };
    const key = "inf_" + kind, cd = Math.max(0, (sim.cooldowns[key] ?? 0) - sim.tick);
    if (cd > 0) return { ok: false, msg: `Encore ${Math.ceil(cd / TPY)} an(s) de repos divin.` };
    const CD: Record<string, number> = { bless: 60, heal: 30, inspire: 90, smite: 200 };
    const civ = sim.civById.get(c.civ);
    let msg = "";
    if (kind === "bless") {
      c.hp = 100; c.hunger = Math.min(c.hunger, 15); c.faith = Math.min(1, c.faith + 0.25);
      if (c.soul) { c.soul.com = Math.min(100, c.soul.com + 40); c.soul.fear = 0; c.soul.fat = Math.max(0, c.soul.fat - 40); }
      msg = `${c.name} est béni(e).`;
      sim.events.log(sim, { civ: c.civ, type: "miracle", importance: 1, text: `${c.name} se sent soudain étrangement bien. ${civ ? civ.religion.name : "On"} y voit un signe.`, consequences: "Santé, foi et moral en hausse." });
    } else if (kind === "heal") {
      c.sick = 0; c.hp = Math.max(c.hp, 90); c.immune = Math.max(c.immune, 400);
      msg = `${c.name} est guéri(e).`;
      sim.events.log(sim, { civ: c.civ, type: "miracle", importance: 1, text: `${c.name} se relève, guéri(e). Les médecins sont vexés.`, consequences: "Maladie dissipée, immunité temporaire." });
    } else if (kind === "inspire") {
      c.intel = Math.min(1, c.intel + 0.12); c.courage = Math.min(1, c.courage + 0.12);
      msg = `${c.name} a une idée de génie.`;
      sim.events.log(sim, { civ: c.civ, type: "divine", importance: 1, text: `${c.name} est saisi(e) d'une inspiration subite. Ça ne durera pas.`, consequences: "Intelligence et courage en hausse." });
    } else {
      sim.fx.push({ kind: "lightning", x: c.x, y: c.y });
      sim.killCitizen(c, "god");
      sim.removeDead(); sim.citizenSys.census(sim);
      msg = `${c.name} a été foudroyé(e).`;
      sim.events.log(sim, { civ: c.civ, type: "divine", importance: 2, text: `${c.name} est foudroyé(e) en plein champ. La météo n'a pas été consultée.`, consequences: "1 mort. Les voisins ont des questions." });
    }
    sim.cooldowns[key] = sim.tick + CD[kind];
    return { ok: true, msg };
  }


  // --------------------------------------------------------------- interventions subtiles (V3) : rêves, liens, foi, dirigeants, protection

  /** Repos individuel d'une intervention (clé libre). Retourne le nombre de ticks restants, 0 si libre. */
  gate(sim: SimulationEngine, key: string): number { return Math.max(0, (sim.cooldowns[key] ?? 0) - sim.tick); }
  private arm(sim: SimulationEngine, key: string, years: number): void { sim.cooldowns[key] = sim.tick + Math.round(years * TPY); }
  private wait(sim: SimulationEngine, key: string): CastResult | null {
    const l = this.gate(sim, key);
    return l > 0 ? { ok: false, msg: `Encore ${Math.ceil(l / TPY)} an(s) de repos divin.` } : null;
  }

  /** Compréhension d'un message divin : foi, intelligence, souvenirs de signes passés. Chaque habitant lit le ciel à sa façon. */
  citizenUnderstanding(sim: SimulationEngine, c: Citizen): number {
    const m = sim.mind.ensure(sim, c);
    return Math.max(0.1, Math.min(0.95, 0.22 + 0.42 * c.faith + 0.2 * c.intel + 0.2 * sim.mind.memLoad(sim, m, MEM.DIVINE, 1) - 0.15 * (m.emo[EMO.FEAR] / 100)));
  }

  /**
   * Rêve envoyé à un habitant. Selon sa personnalité et ses souvenirs il le comprend, le déforme ou le rejette ;
   * l'effet passe ensuite par son esprit (confiance, idées, projets) et peut se propager à son entourage.
   */
  dream(sim: SimulationEngine, citizenId: number, kind: "hope" | "flee" | "doubt" | "bond"): CastResult {
    const c = sim.citizenById.get(citizenId);
    if (!c || c.dead) return { ok: false, msg: "Cet habitant n'est plus là." };
    const w = this.wait(sim, "dream"); if (w) return w;
    const m = sim.mind.ensure(sim, c);
    const civ = sim.civById.get(c.civ);
    const U = this.citizenUnderstanding(sim, c);
    const got = (((c.id * 7919 + sim.tick) % 1000) / 1000) < U;
    this.arm(sim, "dream", 6);
    let msg = "", text = "";
    if (got) {
      sim.mind.remember(sim, c, MEM.DIVINE, 45, -1);
      sim.mind.feel(c, EMO.HOPE, 25);
      m.ideas |= IDEA.FAITH; c.faith = Math.min(1, c.faith + 0.08);
      if (kind === "hope") { m.trust = Math.min(100, m.trust + 18); m.ideas &= ~IDEA.DISTRUST; sim.mind.feel(c, EMO.JOY, 25); msg = `${c.name} s'éveille apaisé(e) : « Tout ira mieux. »`; text = `${c.name} fait un rêve de blé mûr et de ciel clair ; elle en parle toute la journée.`; }
      else if (kind === "doubt") { m.trust = Math.max(-100, m.trust - 28); m.ideas |= IDEA.DISTRUST; sim.mind.feel(c, EMO.ANGER, 25); msg = `${c.name} comprend : son chef lui ment.`; text = `${c.name} rêve que ${civ?.leader.name ?? "le chef"} cache quelque chose. Au réveil, elle en est certaine.`; }
      else if (kind === "flee") { m.ideas |= IDEA.WANDER; m.lastLeave = -1e9; msg = `${c.name} comprend : il faut quitter ce lieu.`; text = `${c.name} rêve d'une terre lointaine et verte. Elle commence à faire ses bagages dans sa tête.`; m.next = sim.tick + 2; }
      else { const o = this.bestCompanion(sim, c); if (o) { sim.mind.touch(c, o.id, 35); sim.mind.touch(o, c.id, 30); sim.mind.ensure(sim, o); msg = `${c.name} rêve de ${o.name}.`; text = `${c.name} rêve de ${o.name} et ne la regarde plus de la même façon.`; } else msg = `${c.name} rêve de compagnie, mais n'y trouve personne.`; }
      // le rêve se raconte : amis et famille en entendent parler
      for (const r of m.rel) if (r.a >= 30 || r.k === 4) { const o = sim.citizenById.get(r.id); if (o && !o.dead) { const mo = sim.mind.ensure(sim, o); if (sim.mind.relOf(c, o.id) && ((o.id + sim.tick) % 3 === 0)) mo.ideas |= IDEA.FAITH; } }
    } else {
      // mal compris : cauchemar, crainte du ciel, ou simple confusion selon le caractère
      sim.mind.feel(c, EMO.FEAR, 30);
      if ((c.soul?.t[4] ?? 0.5) > 0.5) { m.ideas |= IDEA.FEAR_GOD; sim.mind.remember(sim, c, MEM.DIVINE, -30, -1); msg = `${c.name} a mal compris : cauchemar, et crainte du ciel.`; text = `${c.name} s'éveille en sueur, persuadée d'avoir offensé quelque chose là-haut.`; }
      else { msg = `${c.name} a oublié son rêve au réveil.`; text = ""; }
    }
    if (text) sim.events.log(sim, { civ: c.civ, type: "divine", importance: 1, text, consequences: got ? "Le rêve a été compris." : "Le rêve a été mal interprété." });
    return { ok: true, msg };
  }

  /** Meilleur compagnon possible : un rival à réconcilier, sinon une personne libre et compatible. */
  bestCompanion(sim: SimulationEngine, c: Citizen): Citizen | null {
    const m = sim.mind.ensure(sim, c);
    const foe = m.rel.filter((r) => r.k === 2).sort((a, b) => a.a - b.a)[0];
    const fo = foe ? sim.citizenById.get(foe.id) : undefined;
    if (fo && !fo.dead) return fo;
    let best: Citizen | null = null, bs = -1;
    sim.hash.query(sim.citizens, c.x, c.y, 9, (o) => {
      if (o === c || o.dead || o.civ !== c.civ || o.job === "child") return;
      const kin = o.soul?.mother === c.id || c.soul?.mother === o.id || (o.soul && c.soul && o.soul.mother >= 0 && o.soul.mother === c.soul.mother);
      if (kin) return;
      const free = o.female !== c.female && (o.soul?.mate ?? -1) < 0 && (c.soul?.mate ?? -1) < 0 && o.age >= TUNING.minParentAge && c.age >= TUNING.minParentAge;
      const sc = (free ? 0.6 : 0.2) + (1 - Math.abs(o.aggr - c.aggr)) * 0.3 + (1 - Math.abs((o.soul?.t[3] ?? 0.5) - (c.soul?.t[3] ?? 0.5))) * 0.2;
      if (sc > bs) { bs = sc; best = o; }
    });
    return best;
  }

  /** Favoriser une relation : réconcilie un rival, noue une amitié, ou un couple si les deux sont libres et compatibles. */
  favorBond(sim: SimulationEngine, citizenId: number): CastResult {
    const c = sim.citizenById.get(citizenId);
    if (!c || c.dead) return { ok: false, msg: "Cet habitant n'est plus là." };
    const w = this.wait(sim, "bond"); if (w) return w;
    const o = this.bestCompanion(sim, c);
    if (!o) return { ok: false, msg: "Personne à rapprocher ici." };
    sim.mind.ensure(sim, c); sim.mind.ensure(sim, o);
    this.arm(sim, "bond", 4);
    const r = sim.mind.relOf(c, o.id);
    let msg: string, text: string;
    if (r && r.k === 2) {
      // une rivalité ne cède pas toujours : l'empathie décide
      const ok = ((c.soul?.t[3] ?? 0.5) + (o.soul?.t[3] ?? 0.5)) / 2 + 0.25 > 0.5;
      if (ok) { sim.mind.touch(c, o.id, 55); sim.mind.touch(o, c.id, 55); sim.mind.remember(sim, c, MEM.RECONCILE, 50, o.id); sim.mind.remember(sim, o, MEM.RECONCILE, 50, c.id); msg = `${c.name} et ${o.name} se réconcilient.`; text = `${c.name} et ${o.name} enterrent leur querelle, sans trop savoir pourquoi.`; sim.mind.stats.reconciled++; }
      else { sim.mind.touch(c, o.id, -10); sim.mind.touch(o, c.id, -10); msg = `${c.name} refuse de pardonner à ${o.name}.`; text = `${o.name} tend la main à ${c.name}, qui la refuse. Le ciel n'y peut rien.`; }
    } else {
      sim.mind.touch(c, o.id, 45); sim.mind.touch(o, c.id, 45);
      const couple = o.female !== c.female && (o.soul?.mate ?? -1) < 0 && (c.soul?.mate ?? -1) < 0 && o.age >= TUNING.minParentAge && c.age >= TUNING.minParentAge;
      if (couple) { sim.mind.bond(sim, c, o); msg = `${c.name} et ${o.name} forment un couple.`; text = `${c.name} et ${o.name} se découvrent soudain beaucoup de points communs. Le village parle de mariage.`; }
      else { sim.mind.remember(sim, c, MEM.FRIEND, 40, o.id); sim.mind.remember(sim, o, MEM.FRIEND, 40, c.id); msg = `${c.name} et ${o.name} deviennent amis.`; text = `${c.name} et ${o.name} deviennent inséparables.`; }
    }
    sim.events.log(sim, { civ: c.civ, type: "divine", importance: 1, text, consequences: "Un lien durable : il influence leurs décisions futures." });
    return { ok: true, msg };
  }

  /** Inspirer une découverte : les érudits de la civilisation avancent réellement vers la prochaine technologie. */
  inspireDiscovery(sim: SimulationEngine, civId: number): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation ici." };
    const w = this.wait(sim, "inspire_" + civId); if (w) return w;
    const scholars = sim.citizens.filter((c) => c.civ === civId && !c.dead && c.job === "scholar");
    const gain = techThreshold(civ.tech) * (0.25 + 0.1 * Math.min(4, scholars.length));
    civ.techProg += gain;
    this.arm(sim, "inspire_" + civId, 25);
    for (const c of scholars.concat(sim.citizens.filter((c) => c.civ === civId && !c.dead && c.job !== "child").slice(0, 6))) { sim.mind.remember(sim, c, MEM.DIVINE, 35, -1); sim.mind.feel(c, EMO.HOPE, 25); }
    sim.events.log(sim, { civ: civId, type: "discovery", importance: 2, text: `Une idée traverse ${civ.name} comme un éclair : ${scholars[0]?.name ?? "quelqu'un"} jure ne l'avoir volée à personne.`, consequences: "La recherche progresse nettement." });
    return { ok: true, msg: `${civ.name} : une idée germe.` };
  }

  /** Encourager une croyance : la foi se répand par les amitiés ; assez d'adeptes, et c'est un mouvement. */
  encourageFaith(sim: SimulationEngine, civId: number): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation ici." };
    const w = this.wait(sim, "faith_" + civId); if (w) return w;
    this.arm(sim, "faith_" + civId, 15);
    let n = 0;
    for (const c of sim.citizens) {
      if (c.civ !== civId || c.dead || c.job === "child") continue;
      const m = sim.mind.ensure(sim, c);
      const open = 0.25 + 0.5 * c.faith + 0.25 * (c.soul?.t[0] ?? 0.5) - 0.25 * (c.soul?.t[1] ?? 0.5) * (1 - c.faith);
      if (((c.id * 31 + sim.tick) % 100) / 100 < open) { m.ideas |= IDEA.FAITH; c.faith = Math.min(1, c.faith + 0.1); sim.mind.remember(sim, c, MEM.DIVINE, 30, -1); sim.mind.feel(c, EMO.HOPE, 20); n++; }
    }
    sim.events.log(sim, { civ: civId, type: "miracle", importance: 2, text: `Des murmures de foi se répandent dans ${civ.name} : ${n} habitants disent avoir senti une présence.`, consequences: "La foi gagne du terrain ; elle se transmet maintenant de proche en proche." });
    return { ok: true, msg: `${n} habitants sentent une présence.` };
  }

  /** Influencer le dirigeant : sa réaction dépend de son intelligence, de sa vanité et de son ambition. */
  influenceLeader(sim: SimulationEngine, civId: number, kind: "peace" | "war" | "generosity"): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation ici." };
    const w = this.wait(sim, "leader_" + civId); if (w) return w;
    const L = civ.leader;
    this.arm(sim, "leader_" + civId, 12);
    const vain = L.vanity > 0.6;
    const clear = L.intel + 0.15 > 0.45 && !L.goat;
    let text: string, cons: string;
    if (!clear) { civ.stability = Math.max(0, civ.stability - 3); text = `${L.title} ${L.name} reçoit un message du ciel et en tire une conclusion absurde.`; cons = "Message mal compris : la stabilité baisse."; }
    else if (kind === "peace") { L.aggr = Math.max(0, L.aggr - 0.3); civ.stability = Math.min(100, civ.stability + 4); for (const o of sim.civs) if (o.id !== civId && o.alive && sim.statusOf(civId, o.id) !== "war") sim.truce[sim.pairKey(civId, o.id)] = Math.max(sim.truce[sim.pairKey(civId, o.id)] ?? 0, sim.tick + 12 * TPY); text = `${L.title} ${L.name} se réveille pacifique ${vain ? "et s'attribue le mérite de cette sagesse" : "et ne sait pas pourquoi"}.`; cons = "Dirigeant moins belliqueux ; trêve avec les voisins."; }
    else if (kind === "war") { L.aggr = Math.min(1, L.aggr + 0.3); civ.stability = Math.max(0, civ.stability - 2); text = `${L.title} ${L.name} se réveille avec l'envie d'en découdre.`; cons = "Dirigeant plus belliqueux : de nouvelles guerres deviennent plausibles."; for (const c of sim.citizens) if (c.civ === civId && !c.dead && c.aggr < 0.4) sim.mind.feel(c, EMO.FEAR, 10); }
    else { civ.food += civ.pop * 1.5; civ.gold += civ.pop * 0.8; for (const c of sim.citizens) if (c.civ === civId && !c.dead && c.mind) c.mind.trust = Math.min(100, c.mind.trust + 8); text = `${L.title} ${L.name} ouvre les greniers au peuple, ${vain ? "en s'assurant que tout le monde le sache" : "sans trop comprendre pourquoi"}.`; cons = "Vivres distribuées ; la confiance monte."; }
    sim.events.log(sim, { civ: civId, type: "leader", importance: 2, text, consequences: cons });
    return { ok: true, msg: `${L.name} reçoit votre message.` };
  }

  /** Protéger une civilisation : guérisons, immunité, courage, signe de bienveillance. */
  protect(sim: SimulationEngine, civId: number): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation ici." };
    const w = this.wait(sim, "protect_" + civId); if (w) return w;
    this.arm(sim, "protect_" + civId, 18);
    let healed = 0;
    for (const c of sim.citizens) {
      if (c.civ !== civId || c.dead) continue;
      if (c.sick > 0) { c.sick = 0; healed++; }
      c.immune = Math.max(c.immune, 900); c.hp = Math.min(100, c.hp + 25);
      const m = sim.mind.ensure(sim, c);
      sim.mind.remember(sim, c, MEM.DIVINE, 40, -1); sim.mind.feel(c, EMO.HOPE, 30); sim.mind.feel(c, EMO.FEAR, -30); m.trust = Math.min(100, m.trust + 4);
      if (!(m.ideas & IDEA.FAITH) && ((c.id + sim.tick) % 4 === 0)) m.ideas |= IDEA.FAITH;
    }
    civ.stability = Math.min(100, civ.stability + 8);
    sim.events.log(sim, { civ: civId, type: "miracle", importance: 2, text: `${civ.name} se sent soudain à l'abri : ${healed} malades guéris, et une impression étrange de bienveillance.`, consequences: "Immunité, stabilité en hausse, foi qui grandit." });
    return { ok: true, msg: `${civ.name} est protégée.` };
  }

  /** Punir une civilisation : disette, peur. Les fidèles y voient un châtiment mérité (et blâment leur chef), les sceptiques s'indignent. */
  punish(sim: SimulationEngine, civId: number): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation ici." };
    const w = this.wait(sim, "punish_" + civId); if (w) return w;
    this.arm(sim, "punish_" + civId, 30);
    civ.food *= 0.5; civ.stability = Math.max(0, civ.stability - 14);
    let pious = 0, angry = 0;
    for (const c of sim.citizens) {
      if (c.civ !== civId || c.dead) continue;
      const m = sim.mind.ensure(sim, c);
      sim.mind.remember(sim, c, MEM.DISASTER, -45, -1); sim.mind.feel(c, EMO.FEAR, 40);
      if (c.faith > 0.55) { pious++; m.ideas |= IDEA.FEAR_GOD | IDEA.FAITH; m.trust = Math.max(-100, m.trust - 14); sim.mind.remember(sim, c, MEM.DIVINE, -20, -1); } // « le chef a attiré la colère du ciel »
      else { angry++; m.ideas |= IDEA.FEAR_GOD; m.ideas |= IDEA.DISTRUST; m.trust = Math.max(-100, m.trust - 8); sim.mind.feel(c, EMO.ANGER, 30); }
    }
    sim.events.log(sim, { civ: civId, type: "catastrophe", importance: 2, text: `Les greniers de ${civ.name} pourrissent en une nuit. ${pious} habitants y voient un châtiment ; ${angry} y voient surtout une injustice.`, consequences: "Vivres divisées par deux ; confiance et stabilité en baisse." });
    return { ok: true, msg: `${civ.name} est punie.` };
  }

  // --------------------------------------------------------------- météorite

  meteor(sim: SimulationEngine, x: number, y: number): CastResult {
    sim.mind.onDisaster(sim, x, y, POWER_BY_ID.meteor.radius + 6, "disaster");
    const w = sim.world, rng = sim.rng;
    const R = POWER_BY_ID.meteor.radius;
    sim.fx.push({ kind: "meteor", x, y, r: R });
    let killed = 0, destroyed = 0;
    const leaders: Civ[] = [];
    for (const b of sim.buildings) {
      if (b.hp < 0) continue;
      if (Math.hypot(b.x + 0.5 - x, b.y + 0.5 - y) <= R) { sim.destroyBuilding(b); destroyed++; }
    }
    sim.pruneBuildings();
    for (const c of sim.citizens) {
      if (c.dead) continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d <= R - 0.2 && rng.chance(0.95)) { sim.killCitizen(c, "god"); killed++; }
      else if (d < R + 1.5 && rng.chance(0.45)) { sim.killCitizen(c, "god"); killed++; }
      else if (d < 10) { c.panic = 60; c.fx = x; c.fy = y; }
    }
    for (const civ of sim.civs) {
      const cap = sim.cityById.get(civ.capital);
      if (civ.alive && cap && Math.hypot(cap.x + 0.5 - x, cap.y + 0.5 - y) < R) leaders.push(civ);
    }
    // les armées prises dans l'impact
    for (const a of sim.armies) if (Math.hypot(a.x - x, a.y - y) < R) a.morale -= 40;
    w.crater(x, y, R * 0.8);
    // fires on rim
    for (let ty = Math.floor(y - R - 2); ty <= Math.floor(y + R + 2); ty++)
      for (let tx = Math.floor(x - R - 2); tx <= Math.floor(x + R + 2); tx++) {
        if (!w.inb(tx, ty)) continue;
        const i = ty * w.size + tx, d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d > R * 0.8 && d < R + 2 && w.trees[i] > 0 && rng.chance(0.5)) { w.fire[i] = 40 + rng.int(40); }
      }
    w.fireV++;
    // les villes détruites
    for (const city of sim.cities.slice()) {
      if (Math.hypot(city.x + 0.5 - x, city.y + 0.5 - y) <= R) { city.hasHall = false; }
    }
    // retombées : les civilisations proches perdent des vivres
    const hit: Civ[] = [];
    for (const civ of sim.aliveCivs()) {
      const near = sim.cities.some((c) => c.civ === civ.id && Math.hypot(c.x - x, c.y - y) < 16);
      if (near) { civ.food *= 0.88; civ.stability = Math.max(0, civ.stability - 7); hit.push(civ); }
    }
    for (const l of leaders) sim.civSys.leaderDies(sim, l, "meteor");
    sim.civSys.updateTerritory(sim);
    // diplomatie : un voisin accuse l'autre
    if (hit.length >= 2) {
      const [a, b] = hit;
      sim.addOpinion(a.id, b.id, -14);
      sim.grudge[`${a.id}>${b.id}`] = Math.min(1, (sim.grudge[`${a.id}>${b.id}`] ?? 0) + 0.3);
      sim.grudgeWhy[`${a.id}>${b.id}`] = "les accusations d'avoir lancé un caillou depuis le ciel";
      sim.events.log(sim, { civ: a.id, civ2: b.id, type: "absurd", importance: 2,
        text: `${a.formal} accuse ${b.name} d'avoir lancé un caillou du ciel sur ses terres. Les deux ignorent que le ciel ne répond à personne.`,
        consequences: `Relations en baisse entre ${a.name} et ${b.name}.` });
    }
    for (const civ of hit) sim.events.prayerResult(sim, civ, "meteor");
    const near = this.nearestCity(sim, x, y, 12);
    sim.events.log(sim, { civ: near?.civ ?? -1, type: "catastrophe", importance: 3,
      text: `Une météorite s'écrase ${near ? `près de ${near.name}` : "au milieu de nulle part"}. Les astronomes locaux, qui n'existent pas, avaient tout prévu.`,
      consequences: `${killed} mort(s), ${destroyed} bâtiment(s) détruits, cratère creusé, vivres −12 % chez les voisins.` });
    return { ok: true, msg: `Météorite : ${killed} morts, ${destroyed} bâtiments rasés, relief modifié.` };
  }

  // --------------------------------------------------------------- pluie

  rain(sim: SimulationEngine, x: number, y: number): CastResult {
    const w = sim.world, rng = sim.rng;
    const R = POWER_BY_ID.rain.radius;
    for (const z of sim.weather) if (z.kind === "drought" && Math.hypot(z.x - x, z.y - y) < R + z.r * 0.5) z.ttl = 0;
    sim.weather = sim.weather.filter((z) => z.ttl > 0);
    sim.weather.push({ kind: "rain", x, y, r: R, ttl: 8 });
    let fires = 0;
    for (let ty = Math.floor(y - R); ty <= Math.floor(y + R); ty++)
      for (let tx = Math.floor(x - R); tx <= Math.floor(x + R); tx++) {
        if (!w.inb(tx, ty) || Math.hypot(tx + 0.5 - x, ty + 0.5 - y) > R) continue;
        const i = ty * w.size + tx;
        if (w.fire[i] > 0) { w.fire[i] = 0; fires++; }
        if (w.type[i] === T.GRASS || w.type[i] === T.RIVER) w.fertility[i] = Math.min(0.95, w.fertility[i] + 0.15);
        w.scorch[i] *= 0.4;
        if (w.maxTrees[i] > 0 && w.trees[i] < w.maxTrees[i] && rng.chance(0.5)) w.trees[i]++;
      }
    w.treeV++; w.fireV++;
    sim.fx.push({ kind: "rain", x, y, r: R });
    const civs = sim.aliveCivs().filter((c) => sim.cities.some((k) => k.civ === c.id && Math.hypot(k.x - x, k.y - y) < R + 2));
    for (const c of civs) { c.stability = Math.min(100, c.stability + 3); sim.events.prayerResult(sim, c, "rain"); }
    const near = this.nearestCity(sim, x, y, 14);
    sim.events.log(sim, { civ: near?.civ ?? -1, type: "miracle", importance: civs.length ? 2 : 1,
      text: `Une pluie bienfaisante tombe ${near ? `sur ${near.name} et ses environs` : "sur des champs vides"}. ${civs.length ? "Les paysans l'attribuent à leur danse." : "Personne n'est là pour s'en attribuer le mérite."}`,
      consequences: `Récoltes ×1,5 durant 8 ans${fires ? `, ${fires} incendie(s) éteints` : ""}. Fertilité en hausse.` });
    return { ok: true, msg: "La pluie tombe. Les récoltes devraient s'en souvenir." };
  }

  // --------------------------------------------------------------- peste

  plague(sim: SimulationEngine, x: number, y: number): CastResult {
    const R = POWER_BY_ID.plague.radius;
    let n = 0;
    for (const c of sim.citizens) {
      if (c.dead || c.sick > 0 || c.immune > 0) continue;
      if (Math.hypot(c.x - x, c.y - y) <= R && sim.rng.chance(0.85)) { c.sick = 70; n++; }
    }
    if (n === 0) return { ok: false, msg: "Personne à infecter ici. Même la peste a des standards." };
    sim.fx.push({ kind: "plague", x, y, r: R });
    const near = this.nearestCity(sim, x, y, 12);
    const civ = near ? sim.civById.get(near.civ) : undefined;
    if (civ) sim.events.prayerResult(sim, civ, "plague");
    sim.events.log(sim, { civ: civ?.id ?? -1, type: "catastrophe", importance: 3,
      text: `Une maladie inconnue apparaît ${near ? `à ${near.name}` : "en rase campagne"}. ${n} personnes toussent. Le conseil étudie la possibilité de ne pas tousser.`,
      consequences: `${n} infecté(s). Se propage par proximité ; mortalité réduite par la médecine.` });
    return { ok: true, msg: `Peste : ${n} infectés. Elle choisira le reste toute seule.` };
  }

  // --------------------------------------------------------------- bénédiction

  bless(sim: SimulationEngine, civId: number): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation à bénir ici. Clique sur un territoire." };
    civ.blessed = 20 * TPY;
    civ.stability = Math.min(100, civ.stability + 12);
    civ.food += 60; civ.gold += 40;
    for (const c of sim.citizens) if (c.civ === civ.id) { c.faith = Math.min(1, c.faith + 0.1); c.hunger = Math.max(0, c.hunger - 20); c.hp = Math.min(100, c.hp + 15); }
    const cap = sim.cityById.get(civ.capital);
    if (cap) sim.fx.push({ kind: "bless", x: cap.x + 0.5, y: cap.y + 0.5 });
    sim.events.prayerResult(sim, civ, "bless");
    // jalousie des voisins
    for (const o of sim.aliveCivs()) if (o.id !== civ.id) sim.addOpinion(o.id, civ.id, -6);
    sim.events.log(sim, { civ: civ.id, type: "miracle", importance: 2,
      text: `Dieu bénit ${civ.formal}. ${civ.leader.name} attribue aussitôt la faveur divine à sa politique fiscale.`,
      consequences: "20 ans de prospérité : récoltes +30 %, natalité accrue. Les voisins en prennent ombrage." });
    return { ok: true, msg: `${civ.name} est bénie. Les voisins ont remarqué.` };
  }

  // --------------------------------------------------------------- colère

  wrath(sim: SimulationEngine, x: number, y: number): CastResult {
    sim.mind.onDisaster(sim, x, y, POWER_BY_ID.wrath.radius + 4, "disaster");
    const R = POWER_BY_ID.wrath.radius, rng = sim.rng, w = sim.world;
    sim.fx.push({ kind: "wrath", x, y, r: R });
    let killed = 0, destroyed = 0;
    const n = 9 + rng.int(4);
    const dead: Civ[] = [];
    for (let i = 0; i < n; i++) {
      const a = rng.next() * Math.PI * 2, d = Math.sqrt(rng.next()) * R;
      const res = this.strike(sim, x + Math.cos(a) * d, y + Math.sin(a) * d, 1.8, 1.1);
      killed += res.killed; destroyed += res.destroyed;
      if (res.leaderKilled && !dead.includes(res.leaderKilled)) dead.push(res.leaderKilled);
    }
    // secousses
    for (const b of sim.buildings) {
      if (b.hp < 0) continue;
      if (Math.hypot(b.x + 0.5 - x, b.y + 0.5 - y) <= R) {
        b.hp -= b.maxHp * 0.3;
        if (b.hp <= 0) { sim.destroyBuilding(b); destroyed++; }
      }
    }
    sim.pruneBuildings();
    for (const c of sim.citizens) if (!c.dead && Math.hypot(c.x - x, c.y - y) <= R + 3) { c.panic = Math.max(c.panic, 60); c.fx = x; c.fy = y; if (rng.chance(0.07)) { sim.killCitizen(c, "god"); killed++; } }
    w.fireV++;
    const civs = sim.aliveCivs().filter((c) => sim.cities.some((k) => k.civ === c.id && Math.hypot(k.x - x, k.y - y) < R + 3));
    for (const c of civs) { c.stability = Math.max(0, c.stability - 16); sim.events.prayerResult(sim, c, "wrath"); }
    for (const l of dead) sim.civSys.leaderDies(sim, l, "wrath");
    const near = this.nearestCity(sim, x, y, 14);
    sim.events.log(sim, { civ: near?.civ ?? -1, type: "catastrophe", importance: 3,
      text: `La colère divine s'abat ${near ? `sur ${near.name}` : "sur une région peu fréquentée"} : ${n} foudres, des secousses et un incendie. Les théologiens préfèrent parler de « signe ».`,
      consequences: `${killed} mort(s), ${destroyed} bâtiment(s) détruit(s), stabilité −16.` });
    sim.civSys.updateTerritory(sim);
    return { ok: true, msg: `Colère divine : ${killed} morts, ${destroyed} bâtiments détruits.` };
  }

  // --------------------------------------------------------------- prophétie

  /** Probabilité de bonne interprétation (0..1), calculée à partir de l'intelligence, de la foi et du dirigeant. */
  understanding(civ: Civ): number {
    return Math.max(0.03, Math.min(0.97, 0.28 + 0.35 * civ.avgIntel + 0.25 * civ.leader.intel + 0.2 * civ.avgFaith
      - (civ.personality === "stupid" ? 0.25 : 0) + (civ.personality === "fanatic" ? 0.1 : 0) - (civ.leader.goat ? 0.2 : 0)));
  }

  prophecy(sim: SimulationEngine, civId: number, msgId: string): CastResult {
    const civ = sim.civById.get(civId);
    if (!civ || !civ.alive) return { ok: false, msg: "Aucune civilisation destinataire. Clique sur un territoire." };
    const rng = sim.rng;
    const def = PROPHECIES.find((p) => p.id === msgId) ?? PROPHECIES[0];
    const q = this.understanding(civ) + rng.range(-0.08, 0.08);
    const good = q > 0.55;
    const cap = sim.cityById.get(civ.capital);
    if (cap) sim.fx.push({ kind: "prophecy", x: cap.x + 0.5, y: cap.y + 0.5 });
    for (const c of sim.citizens) if (c.civ === civ.id) c.faith = Math.min(1, c.faith + 0.05);
    let effect = "";
    const others = sim.aliveCivs().filter((o) => o.id !== civ.id);
    switch (def.id) {
      case "peace": {
        if (good) {
          for (const o of others) { sim.addOpinion(civ.id, o.id, 25); sim.addOpinion(o.id, civ.id, 10); sim.grudge[`${civ.id}>${o.id}`] = 0; }
          let ended = 0;
          for (const w of sim.wars.filter((x) => x.active && (x.a === civ.id || x.d === civ.id))) { sim.war.endWar(sim, w, "white"); ended++; }
          civ.stability = Math.min(100, civ.stability + 6);
          effect = `Opinions envers les voisins +25${ended ? `, ${ended} guerre(s) terminée(s)` : ""}, stabilité +6.`;
        } else {
          const t = others.filter((o) => sim.statusOf(civ.id, o.id) === "peace").sort((a, b) => a.pop - b.pop)[0];
          if (t && civ.soldiers >= 2 && sim.tick - civ.lastWarEnd > 3 * TPY) { sim.diplo.declareWar(sim, civ, t, "ego", "une prophétie mal comprise (« pacifier »)"); effect = `Guerre déclarée à ${t.name} « pour la paix ».`; }
          else { civ.stability -= 4; effect = "Confusion générale, stabilité −4."; }
        }
        break;
      }
      case "war": {
        if (good) {
          const t = others.filter((o) => sim.statusOf(civ.id, o.id) === "peace" && (sim.truce[sim.pairKey(civ.id, o.id)] ?? 0) <= sim.tick).sort((a, b) => sim.opinion(civ.id, a.id) - sim.opinion(civ.id, b.id))[0];
          if (t && civ.soldiers >= 2) { sim.diplo.declareWar(sim, civ, t, "ego", "une prophétie divine (authentique, ce qui n'arrange rien)"); effect = `Guerre sainte contre ${t.name}.`; }
          else effect = "Personne de disponible à purifier. Les fidèles sont déçus.";
          civ.stability = Math.min(100, civ.stability + 4);
        } else {
          let n = 0;
          for (const c of sim.citizens) if (c.civ === civ.id && !c.dead && c.army < 0 && rng.chance(0.06)) { sim.killCitizen(c, "unrest"); n++; }
          civ.stability = Math.max(0, civ.stability - 8);
          effect = `Purge des « hérétiques » : ${n} morts, stabilité −8.`;
        }
        break;
      }
      case "temple": {
        const city = cap ?? sim.citiesOf(civ.id)[0];
        if (good && city) {
          const s = sim.civSys.findSite(sim, civ, city, "temple");
          if (s) { sim.addBuilding("temple", civ.id, city.id, s.x, s.y, false, civ.era, s.rot); civ.stability = Math.min(100, civ.stability + 4); effect = "Chantier d'un temple ouvert (gratuit), stabilité +4."; }
          else effect = "Pas d'emplacement convenable. Le temple restera spirituel.";
        } else { civ.wood = Math.max(0, civ.wood - 30); civ.gold = Math.max(0, civ.gold - 20); civ.stability = Math.min(100, civ.stability + 3); effect = "30 bois et 20 or dépensés pour une statue du dirigeant. Stabilité +3."; }
        break;
      }
      case "harvest": {
        if (good && cap) {
          civ.food += 50;
          sim.weather.push({ kind: "rain", x: cap.x + 0.5, y: cap.y + 0.5, r: 6, ttl: 4 });
          effect = "Semailles bénies : vivres +50 et récoltes ×1,5 durant 4 ans autour de la capitale.";
        } else { civ.food += 15; civ.stability = Math.max(0, civ.stability - 3); effect = "Vivres +15 (des navets), stabilité −3."; }
        break;
      }
      case "expand": {
        const ok = sim.civSys.tryFoundCity(sim, civ, good ? "good" : "bad");
        effect = ok ? (good ? "Nouvelle ville fondée en un lieu raisonnable." : "Nouvelle ville fondée en un lieu... discutable.") : "Aucun site disponible : les colons restent sur place.";
        break;
      }
    }
    const text = good
      ? `${civ.formal} reçoit la prophétie « ${def.name} » et la comprend. ${civ.leader.name} dit l'avoir toujours su.`
      : `${civ.formal} reçoit la prophétie « ${def.name} ». ${this.pickMisread(sim, def.id)}`;
    sim.events.log(sim, { civ: civ.id, type: "divine", importance: 2, text, consequences: `${effect} (Compréhension : ${(Math.max(0, Math.min(1, q)) * 100).toFixed(0)} %)` });
    return { ok: true, msg: good ? `Prophétie comprise (${(q * 100).toFixed(0)} %). ${effect}` : `Prophétie mal interprétée (${(q * 100).toFixed(0)} %). ${effect}` };
  }

  private pickMisread(sim: SimulationEngine, id: string): string {
    return sim.events.pick(sim, "mis" + id, PROPHECY_MISREAD[id]);
  }
}
