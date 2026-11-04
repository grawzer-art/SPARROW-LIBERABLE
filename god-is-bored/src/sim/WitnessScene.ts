import { GOAL, IDEA, MEM, REL } from "./MindSystem";
import { ACT } from "./SoulSystem";
import { SimulationEngine } from "./SimulationEngine";
import { TICKS_PER_YEAR } from "./config";
import type { Citizen, City, Civ, Job } from "./types";

/**
 * Scène témoin « Sentience » : un village, cinq habitants avec une identité et une mémoire, deux d'entre eux qui discutent
 * spontanément, une conversation qui fait basculer une décision, une action collective visible (chantier, départ d'une famille).
 * RIEN n'est scripté au-delà de l'état initial : les habitants sont de vrais habitants de la simulation (même moteur, mêmes systèmes),
 * dotés de personnalités, de souvenirs et de liens. Les conversations, les décisions et les déplacements en découlent.
 */
export interface WitnessCast { mira: Citizen; ysa: Citizen; tobias: Citizen; garen: Citizen; lenn: Citizen; kid: Citizen; home: City; dest: City; civ: Civ; site: number; sites: number[] }

const SEEDS = [42, 7, 2024, 99, 515, 3, 11, 286, 478];

function find(): { e: SimulationEngine; civ: Civ; home: City; dest: City } {
  for (const seed of SEEDS) {
    const e = SimulationEngine.create(seed);
    for (let y = 0; y < 70; y++) {
      e.runYears(1);
      for (const civ of e.aliveCivs()) {
        const cs = e.cities.filter((c) => c.civ === civ.id && c.hasHall).sort((a, b) => b.pop - a.pop);
        // la destination doit être un vrai voyage : un autre village à 9–35 cases
        const far = cs.slice(1).find((d) => { const k = Math.hypot(d.x - cs[0].x, d.y - cs[0].y); return k >= 9 && k <= 35; });
        if (cs.length >= 2 && cs[0].pop >= 9 && far) return { e, civ, home: cs[0], dest: far };
      }
    }
  }
  throw new Error("scène témoin : aucun village adapté");
}

export function buildWitnessScene(): { e: SimulationEngine; cast: WitnessCast } {
  const { e, civ, home, dest } = find();
  const cx = home.x + 0.5, cy = home.y + 0.5;
  const adults = e.citizens.filter((c) => !c.dead && c.civ === civ.id && c.city === home.id && c.job !== "child" && c.age >= 18 && c.army < 0);
  const make = (): Citizen => e.spawnCitizen(civ, home, cx, cy + 2, 30, { female: false });
  while (adults.length < 5) adults.push(make());
  const [mira, ysa, tobias, garen, lenn] = adults.slice(0, 5);
  const place = (c: Citizen, dx: number, dy: number) => { const x = cx + dx, y = cy + dy; c.x = c.px = x; c.y = c.py = y; c.tx = x; c.ty = y; c.state = "idle"; c.path = null; };
  const ident = (c: Citizen, name: string, female: boolean, age: number, job: Job, t: [number, number, number, number, number], courage: number, aggr: number, faith: number, intel: number) => {
    c.name = name; c.female = female; c.age = age; c.job = job; c.courage = courage; c.aggr = aggr; c.faith = faith; c.intel = intel;
    const s = e.soul.ensure(c); s.t = t; s.mate = -1; s.fat = 25; s.com = 60; s.fear = 0; c.hunger = 10; c.hp = 100; c.sick = 0; c.panic = 0; c.work = -1;
    const m = e.mind.ensure(e, c); m.mem.length = 0; m.rel.length = 0; m.ideas = 0; m.goal = GOAL.STAY; m.gTarget = -1; m.lastLeave = -1e9; m.emo = [0, 30, 0, 0, 30];
    return m;
  };
  // --- Mira : survivante de la grande famine, ne fait plus confiance au chef, décidée à partir ; sociable, tante d'Ysa
  const mm = ident(mira, "Mira", true, 41, "farmer", [0.9, 0.5, 0.4, 0.7, 0.3], 0.55, 0.3, 0.45, 0.6);
  mm.trust = -72; mm.ideas = IDEA.DISTRUST | IDEA.WANDER; mira.soul!.soc = 96;
  e.mind.remember(e, mira, MEM.FAMINE, -92); e.mind.remember(e, mira, MEM.KIN_DEATH, -78); e.mind.remember(e, mira, MEM.VIOLENCE, -40);
  mm.goal = GOAL.LEAVE; mm.gTarget = dest.id; mm.gT = e.tick; mm.gWhy = [0, 1, 15]; mm.next = e.tick + TICKS_PER_YEAR * 3;
  // --- Ysa : jeune mère, inquiète, très attachée à sa tante ; méfiance naissante envers le chef
  const my = ident(ysa, "Ysa", true, 24, "farmer", [0.7, 0.6, 0.3, 0.85, 0.35], 0.25, 0.12, 0.4, 0.55);
  my.trust = -34; ysa.soul!.soc = 90; ysa.soul!.com = 42;
  e.mind.remember(e, ysa, MEM.FAMINE, -62);
  // --- Tobias : bâtisseur loyal au chef, prudent, ami de Garen
  const mt = ident(tobias, "Tobias", false, 46, "builder", [0.55, 0.3, 0.5, 0.45, 0.8], 0.6, 0.45, 0.55, 0.5);
  mt.trust = 62; tobias.soul!.soc = 30;
  // --- Garen : bûcheron ambitieux et fier
  const mg = ident(garen, "Garen", false, 31, "lumberjack", [0.6, 0.45, 0.85, 0.35, 0.4], 0.8, 0.6, 0.3, 0.55);
  mg.trust = 20; garen.soul!.soc = 35;
  // --- Lenn : ancien pieux, calme, voit des signes dans le vent
  const ml = ident(lenn, "Lenn", false, 63, "scholar", [0.5, 0.8, 0.15, 0.9, 0.6], 0.4, 0.05, 0.95, 0.8);
  ml.trust = 35; ml.ideas = IDEA.FAITH; lenn.soul!.soc = 25;
  e.mind.remember(e, lenn, MEM.DIVINE, 55);
  // liens : Mira–Ysa (famille), Tobias–Garen (amis), Mira–Tobias (froideur), Lenn–Mira (respect)
  e.mind.touch(mira, ysa.id, 82, REL.KIN); e.mind.touch(ysa, mira.id, 85, REL.KIN);
  e.mind.touch(tobias, garen.id, 62, REL.FRIEND); e.mind.touch(garen, tobias.id, 58, REL.FRIEND);
  e.mind.touch(mira, tobias.id, -28); e.mind.touch(tobias, mira.id, -22);
  e.mind.touch(lenn, mira.id, 40); e.mind.touch(mira, lenn.id, 35);
  // l'enfant d'Ysa : sa famille la suivra
  const kid = e.spawnCitizen(civ, home, cx, cy, 6, { parent: ysa, female: false });
  kid.job = "child"; kid.name = "Pip"; e.mind.onBirth(e, kid, ysa);
  // décor humain : tout le monde est près du centre du village
  place(mira, -1.7, 2.2); place(ysa, -3.1, 2.5); place(tobias, 2.3, 2.6); place(garen, 3.5, 1.4); place(lenn, 0.3, 3.4); place(kid, -3.4, 3.1);
  // action collective visible : une maison est en chantier à côté de la place, les bâtisseurs s'y retrouvent
  // trois maisons à bâtir (une famille agrandit le village) : les bâtisseurs y travaillent à tour de rôle
  const sites: number[] = [];
  for (let i = 0; i < 3; i++) { const spot = e.civSys.findSite(e, civ, home, "house"); if (spot) sites.push(e.addBuilding("house", civ.id, home.id, spot.x, spot.y, false, civ.era, spot.rot).id); }
  const site = sites[0] ?? -1;
  civ.wood = Math.max(civ.wood, 160); civ.stone = Math.max(civ.stone, 80); civ.food = Math.max(civ.food, civ.pop * 3);
  const others = e.citizens.filter((c) => !c.dead && c.civ === civ.id && c.city === home.id && c.job !== "child" && ![mira, ysa, tobias, garen, lenn].includes(c)).slice(0, 2);
  for (const c of others) c.job = "builder";
  // l'état initial ne doit pas attendre : calme et vivres, pour que l'histoire soit celle des habitants
  for (const c of e.citizens) if (c.civ === civ.id) { c.hunger = Math.min(c.hunger, 30); c.hp = Math.max(c.hp, 70); }
  // le village reste lui-même pendant la scène : pas de colonisation ni de guerre qui disperseraient les habitants
  civ.lastCityTick = e.tick + 40 * TICKS_PER_YEAR;
  for (const a of e.civs) for (const b of e.civs) if (a.id < b.id) e.truce[e.pairKey(a.id, b.id)] = e.tick + 40 * TICKS_PER_YEAR;
  // Mira a envie de parler à sa nièce Ysa, qui est inquiète : leur intention initiale (la suite vient de la simulation)
  for (const [c, o] of [[mira, ysa], [ysa, mira]] as [Citizen, Citizen][]) { const s2 = c.soul!; s2.act = ACT.SOCIAL; s2.since = e.tick; s2.until = e.tick + 200; s2.target = o.id; }
  e.talk.talks.clear();
  e.reindex();
  e.hash.rebuild(e.citizens);
  e.speed = 1; e.paused = false;
  return { e, cast: { mira, ysa, tobias, garen, lenn, kid, home, dest, civ, site, sites } };
}
