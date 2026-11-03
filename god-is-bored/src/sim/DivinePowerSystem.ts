import { TICKS_PER_YEAR } from "./config";
import { PROPHECIES, PROPHECY_MISREAD } from "./data";
import type { SimulationEngine } from "./SimulationEngine";
import type { Civ, City } from "./types";
import { T } from "./World";

const TPY = TICKS_PER_YEAR;

export type PowerId = "lightning" | "meteor" | "rain" | "plague" | "bless" | "wrath" | "prophecy";

export interface PowerInfo {
  id: PowerId; name: string; glyph: string; radius: number; cooldown: number; target: "area" | "civ"; blurb: string; detail: string;
}

export const POWERS: PowerInfo[] = [
  { id: "lightning", name: "Foudre", glyph: "ϟ", radius: 2.2, cooldown: 40, target: "area", blurb: "Rappelle à un village qui est le patron.",
    detail: "Détruit des bâtiments, tue des habitants, déclenche la panique et des incendies dans les forêts." },
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
      case "meteor": res = this.meteor(sim, x, y); break;
      case "rain": res = this.rain(sim, x, y); break;
      case "plague": res = this.plague(sim, x, y); break;
      case "wrath": res = this.wrath(sim, x, y); break;
      case "bless": res = this.bless(sim, opts.civ ?? this.civAt(sim, x, y)?.id ?? -1); break;
      case "prophecy": res = this.prophecy(sim, opts.civ ?? this.civAt(sim, x, y)?.id ?? -1, opts.prophecy ?? "peace"); break;
    }
    sim.removeDead();
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

  // --------------------------------------------------------------- météorite

  meteor(sim: SimulationEngine, x: number, y: number): CastResult {
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
          if (s) { sim.addBuilding("temple", civ.id, city.id, s.x, s.y, false); civ.stability = Math.min(100, civ.stability + 4); effect = "Chantier d'un temple ouvert (gratuit), stabilité +4."; }
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
