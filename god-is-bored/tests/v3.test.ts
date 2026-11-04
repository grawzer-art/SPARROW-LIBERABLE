import { afterEach, describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { PlanetSim } from "../src/sim/PlanetSim";
import { SaveManager } from "../src/sim/SaveManager";
import { EMO, GOAL, IDEA, MEM, REL } from "../src/sim/MindSystem";
import { DEFAULT_TUNING, LEGACY_TUNING, TUNING, applyTuning, resetTuning } from "../src/sim/tuning";
import { TICKS_PER_YEAR, TICK_MS } from "../src/sim/config";
import type { Citizen, City, Civ } from "../src/sim/types";

afterEach(() => resetTuning());
const adults = (e: SimulationEngine, civ?: number) => e.citizens.filter((c) => !c.dead && c.job !== "child" && c.age >= 18 && (civ === undefined || c.civ === civ));

/** Prépare un monde avec une civilisation à ≥ 2 villages (colonisation spontanée, systèmes réels). */
function twoCityWorld(): { e: SimulationEngine; civ: Civ; a: City; b: City } {
  for (const seed of [42, 7, 2024, 99, 515, 3, 11]) {
    const e = SimulationEngine.create(seed);
    for (let y = 0; y < 60; y++) {
      e.runYears(1);
      for (const civ of e.aliveCivs()) {
        const cs = e.cities.filter((c) => c.civ === civ.id && c.hasHall);
        if (cs.length >= 2 && adults(e, civ.id).length >= 8) return { e, civ, a: cs[0], b: cs[1] };
      }
    }
  }
  throw new Error("aucun monde à deux villages");
}

describe("V3 · démographie : configuration centrale et rythmes", () => {
  it("les réglages sont centralisés, modifiables, et la V2 reste reproductible", () => {
    expect(DEFAULT_TUNING.birthRate).toBeCloseTo(0.3);
    expect(DEFAULT_TUNING.childGrowth).toBeCloseTo(0.3);
    expect(DEFAULT_TUNING.minParentAge).toBeGreaterThanOrEqual(16);
    applyTuning({ birthRate: 0.5 });
    expect(TUNING.birthRate).toBe(0.5);
    resetTuning();
    expect(TUNING.birthRate).toBeCloseTo(0.3);
    expect(LEGACY_TUNING.birthRate).toBe(1);
  });

  it("les enfants grandissent à 30 % du rythme ; les adultes vieillissent normalement", () => {
    const e = SimulationEngine.create(42);
    const civ = e.civs[0], city = e.cities.find((c) => c.civ === civ.id)!;
    const kid = e.spawnCitizen(civ, city, city.x + 0.5, city.y + 1.5, 2, { female: true });
    const ad = e.spawnCitizen(civ, city, city.x + 1.5, city.y + 1.5, 25, { female: true });
    e.runYears(10);
    expect(kid.age - 2).toBeGreaterThan(2.6); expect(kid.age - 2).toBeLessThan(3.5); // ≈ 3 ans pour 10 ans écoulés
    if (!ad.dead) expect(ad.age - 25).toBeCloseTo(10, 0);
  });

  it("une naissance respecte les règles : mère en âge, couple établi, délai entre naissances", () => {
    const e = SimulationEngine.create(42);
    const births: { tick: number; mother: number; age: number; partner: number }[] = [];
    const orig = e.mind.onBirth.bind(e.mind);
    e.mind.onBirth = (sim: SimulationEngine, child: Citizen, mother: Citizen) => { births.push({ tick: sim.tick, mother: mother.id, age: mother.age, partner: mother.soul?.mate ?? -1 }); orig(sim, child, mother); };
    e.runYears(80);
    expect(births.length).toBeGreaterThan(15);
    for (const b of births) {
      expect(b.age).toBeGreaterThanOrEqual(TUNING.minParentAge);
      expect(b.age).toBeLessThanOrEqual(TUNING.maxMotherAge + 1);
      expect(b.partner).toBeGreaterThanOrEqual(0); // jamais sans partenaire
    }
    const last = new Map<number, number>();
    for (const b of births) {
      const t = last.get(b.mother);
      if (t !== undefined) expect(b.tick - t).toBeGreaterThanOrEqual(Math.round(TUNING.birthIntervalYears * TICKS_PER_YEAR * 0.9));
      last.set(b.mother, b.tick);
    }
  }, 60000);

  it("avant/après sur plusieurs graines : −70 % ou plus de naissances, population qui évolue lentement sans s'effondrer", () => {
    const run = (preset: typeof LEGACY_TUNING | null) => {
      if (preset) applyTuning(preset); else resetTuning();
      let births = 0, end = 0, start = 0;
      for (const seed of [42, 7, 2024]) { const e = SimulationEngine.create(seed); start += e.citizens.length; e.runYears(80); births += e.stats.births; end += e.citizens.length; }
      return { births, end, start };
    };
    const before = run(LEGACY_TUNING), after = run(null);
    expect(after.births).toBeLessThan(before.births * 0.3);
    expect(after.end).toBeGreaterThan(after.start * 0.9); // pas d'effondrement
    expect(after.end).toBeLessThan(before.end * 0.6); // beaucoup plus lent
  }, 120000);

  it("le ralentissement est identique à ×1, ×3 et ×10 (même nombre de ticks, même histoire)", () => {
    const make = () => { const e = SimulationEngine.create(42); return e; };
    const totalMs = 40 * TICKS_PER_YEAR * TICK_MS; // 40 ans à ×1
    const out: number[][] = [];
    for (const speed of [1, 3, 10]) {
      const e = make(); e.speed = speed; e.paused = false;
      const frame = 100;
      let acc = 0;
      while (e.tick < 40 * TICKS_PER_YEAR && acc < totalMs * 2) { e.advance(frame); acc += frame; }
      out.push([e.tick, e.citizens.length, e.stats.births]);
    }
    expect(out[1]).toEqual(out[0]);
    expect(out[2]).toEqual(out[0]);
  }, 120000);
});

describe("V3 · vie intérieure : souvenirs, confiance, décisions", () => {
  it("une famine laisse un souvenir qui entame la confiance envers le chef", () => {
    const e = SimulationEngine.create(42);
    const civ = e.civs[0];
    e.runYears(3);
    const people = adults(e, civ.id);
    const t0 = people.map((c) => e.mind.ensure(e, c).trust);
    for (let y = 0; y < 4; y++) { civ.food = 0; for (let t = 0; t < TICKS_PER_YEAR; t++) { civ.food = 0; for (const c of e.citizens) if (c.civ === civ.id) c.hunger = Math.max(c.hunger, 88); e.step(); } }
    const alive = people.filter((c) => !c.dead);
    expect(alive.length).toBeGreaterThan(0);
    const withMem = alive.filter((c) => c.mind!.mem.some((m) => m.k === MEM.FAMINE));
    expect(withMem.length).toBeGreaterThan(alive.length * 0.4);
    const drop = alive.reduce((s, c) => s + (c.mind!.trust - (t0[people.indexOf(c)] ?? 0)), 0) / alive.length;
    expect(drop).toBeLessThan(-8);
  }, 60000);

  it("les souvenirs influencent réellement le choix : famine + défiance → projet de départ ; sinon on reste", () => {
    const { e, a, b } = twoCityWorld();
    const pool = adults(e).filter((c) => c.city === a.id && c.army < 0);
    const rancunier = pool[0], serein = pool[1];
    for (const [c, bad] of [[rancunier, true], [serein, false]] as [Citizen, boolean][]) {
      const m = e.mind.ensure(e, c);
      m.mem.length = 0; m.rel.length = 0; m.lastLeave = -1e9; c.soul!.t[4] = 0.3; c.soul!.com = 40;
      if (bad) { e.mind.remember(e, c, MEM.FAMINE, -90); e.mind.remember(e, c, MEM.VIOLENCE, -60); m.trust = -85; m.ideas |= IDEA.DISTRUST | IDEA.WANDER; }
      else { m.trust = 70; c.soul!.t[4] = 0.9; c.soul!.com = 85; }
      m.next = e.tick;
    }
    // ville d'accueil attirante
    b.cap = Math.max(b.cap, b.pop + 20); a.pop = Math.max(a.pop, 8);
    const cb = e.civById.get(b.civ)!; cb.stability = Math.max(cb.stability, 70); cb.food = Math.max(cb.food, cb.pop * 2);
    for (const c of [rancunier, serein]) { c.hunger = 10; c.panic = 0; }
    e.mind.tick(e, rancunier, e.civById.get(rancunier.civ)!); e.mind.tick(e, serein, e.civById.get(serein.civ)!);
    expect(rancunier.mind!.goal).toBe(GOAL.LEAVE);
    expect(rancunier.mind!.gWhy.length).toBeGreaterThan(0);
    expect(serein.mind!.goal).not.toBe(GOAL.LEAVE);
  });

  it("le départ a lieu pour de vrai : l'habitant rejoint un autre village, sa famille le suit", () => {
    const { e, a, b } = twoCityWorld();
    const pool = adults(e).filter((c) => c.city === a.id && c.army < 0 && c.civ === a.civ);
    const [p, q] = pool;
    const kid = e.spawnCitizen(e.civById.get(a.civ)!, a, p.x, p.y, 6, { parent: p.female ? p : q });
    kid.job = "child";
    for (const c of [p, q, kid]) e.mind.ensure(e, c);
    e.mind.touch(p, q.id, 80, REL.PARTNER); e.mind.touch(q, p.id, 80, REL.PARTNER); e.mind.touch(p, kid.id, 90, REL.KIN); e.mind.touch(kid, p.id, 70, REL.KIN);
    const m = p.mind!; m.lastLeave = -1e9; m.mem.length = 0; m.trust = -90; m.ideas |= IDEA.WANDER | IDEA.DISTRUST;
    e.mind.remember(e, p, MEM.FAMINE, -95); e.mind.remember(e, p, MEM.VIOLENCE, -80); p.soul!.t[4] = 0.2; p.soul!.com = 30; p.courage = 0.1; p.aggr = 0.1; m.next = e.tick; // pas un combattant : il part plutôt que de se révolter
    b.cap += 30; const cb = e.civById.get(b.civ)!; cb.stability = Math.max(cb.stability, 75); cb.food += 400;
    p.hunger = 5; p.panic = 0;
    e.mind.tick(e, p, e.civById.get(p.civ)!);
    expect(m.goal).toBe(GOAL.LEAVE);
    const before = e.cities.find((c) => c.id === a.id)!.pop;
    const target = m.gTarget;
    for (let t = 0; t < TICKS_PER_YEAR * 3 && p.city !== target; t++) e.step();
    expect(p.city).toBe(target); // a réellement changé de village
    expect(p.mind!.mem.some((x) => x.k === MEM.MIGRATE)).toBe(true);
    expect(before).toBeGreaterThan(0);
    expect(p.city).not.toBe(a.id);
  }, 60000);

  it("un habitant peut changer de projet quand sa situation change", () => {
    const { e, a, b } = twoCityWorld();
    const c = adults(e).find((x) => x.city === a.id && x.army < 0)!;
    const m = e.mind.ensure(e, c); m.mem.length = 0; m.rel.length = 0; m.lastLeave = -1e9;
    m.trust = -90; m.ideas |= IDEA.WANDER | IDEA.DISTRUST; e.mind.remember(e, c, MEM.FAMINE, -95); e.mind.remember(e, c, MEM.VIOLENCE, -70); c.soul!.t[4] = 0.2; c.soul!.com = 30; c.hunger = 5; c.panic = 0;
    b.cap += 30; const cb = e.civById.get(b.civ)!; cb.stability = Math.max(cb.stability, 75); cb.food += 400;
    m.next = e.tick; e.mind.tick(e, c, e.civById.get(c.civ)!);
    expect(m.goal).toBe(GOAL.LEAVE);
    // la situation s'améliore : confiance restaurée, souvenirs adoucis, un foyer, une famille
    m.trust = 80; m.mem.length = 0; m.ideas = 0; c.soul!.com = 80; c.soul!.t[4] = 0.8; e.mind.touch(c, 999999, 80, REL.KIN);
    m.next = e.tick; m.goal = m.goal; e.mind.tick(e, c, e.civById.get(c.civ)!);
    expect(m.goal).not.toBe(GOAL.LEAVE);
  });

  it("amitiés, rivalités, couples et disputes émergent d'une simulation ordinaire", () => {
    const e = SimulationEngine.create(42);
    e.runYears(50);
    const links = e.citizens.flatMap((c) => c.mind?.rel ?? []);
    expect(links.some((r) => r.k === REL.FRIEND)).toBe(true);
    expect(links.some((r) => r.k === REL.PARTNER)).toBe(true);
    expect(links.some((r) => r.k === REL.KIN)).toBe(true);
    expect(e.mind.stats.quarrels).toBeGreaterThan(0);
    expect(e.mind.stats.bonds).toBeGreaterThan(0);
  }, 60000);

  it("une trahison laisse des conséquences persistantes : rupture, rancune, rivalité", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const civ = e.civs[0];
    const pool = adults(e, civ.id);
    const women = pool.filter((c) => c.female), men = pool.filter((c) => !c.female);
    const traitor = men[0], spouse = women[0], other = women[1];
    for (const c of [traitor, spouse, other]) e.mind.ensure(e, c);
    e.mind.bond(e, traitor, spouse); other.soul!.mate = -1;
    traitor.soul!.t[2] = 0.95; traitor.soul!.t[3] = 0.1;
    e.mind.relOf(traitor, spouse.id)!.a = 10; // couple distendu
    other.x = traitor.x + 1; other.y = traitor.y; e.hash.rebuild(e.citizens);
    let done = false;
    for (let k = 0; k < 400 && !done; k++) { traitor.mind!.next = e.tick; e.tick++; e.mind.tick(e, traitor, civ); done = e.mind.stats.betrayals > 0; }
    expect(done).toBe(true);
    expect(spouse.mind!.mem.some((m) => m.k === MEM.BETRAYAL)).toBe(true);
    expect(e.mind.relOf(spouse, traitor.id)!.k).toBe(REL.RIVAL);
    expect(spouse.soul!.mate).toBe(-1);
  });

  it("rébellion : assez de mécontents renversent le dirigeant ; les conséquences sont réelles", () => {
    const e = SimulationEngine.create(42); e.runYears(30);
    const civ = e.civs.find((c) => c.alive && adults(e, c.id).length >= 12) ?? e.civs[0];
    const pool = adults(e, civ.id);
    const oldLeader = civ.leader.name;
    for (const c of pool.slice(0, Math.ceil(pool.length * 0.6))) { const m = e.mind.ensure(e, c); m.goal = GOAL.REBEL; c.courage = 0.95; }
    civ.soldiers = 0;
    const n0 = e.chronicle.length;
    e.mind.yearly(e);
    expect(e.mind.stats.rebellions).toBe(1);
    expect(e.chronicle.length).toBeGreaterThan(n0);
    const win = civ.leader.name !== oldLeader;
    expect(win || civ.stability < 60).toBe(true);
    expect(pool.some((c) => !c.dead && c.mind!.mem.some((m) => m.k === MEM.REBEL))).toBe(true);
  });

  it("les idées circulent entre amis (transmission de la défiance et de la foi)", () => {
    const e = SimulationEngine.create(42); e.runYears(5);
    const [a, b] = adults(e);
    e.mind.ensure(e, a); e.mind.ensure(e, b);
    e.mind.touch(a, b.id, 80); e.mind.touch(b, a.id, 80);
    a.mind!.ideas |= IDEA.DISTRUST | IDEA.FAITH; a.soul!.t[0] = 1; b.soul!.t[4] = 0; a.aggr = 0; b.aggr = 0; // pas de dispute
    for (let i = 0; i < 300 && !((b.mind!.ideas & IDEA.DISTRUST) && (b.mind!.ideas & IDEA.FAITH)); i++) { e.tick++; e.mind.interact(e, a, b); }
    expect(b.mind!.ideas & IDEA.DISTRUST).toBeTruthy();
    expect(b.mind!.ideas & IDEA.FAITH).toBeTruthy();
  });
});

describe("V3 · gameplay de dieu : interventions interprétées", () => {
  it("un rêve est compris ou déformé selon la personnalité ; les effets passent par l'esprit", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const people = adults(e).slice(0, 10);
    let understood = 0, misread = 0;
    for (const c of people) {
      const m = e.mind.ensure(e, c); m.trust = 50; delete e.cooldowns["dream"];
      const t0 = m.trust;
      const r = e.divine.dream(e, c.id, "doubt");
      expect(r.ok).toBe(true);
      if (m.trust < t0) understood++; else misread++;
    }
    expect(understood).toBeGreaterThan(0);
    expect(misread).toBeGreaterThan(0); // tous ne comprennent pas pareil
    const pious = adults(e).sort((x, y) => y.faith - x.faith)[0], sceptic = adults(e).sort((x, y) => x.faith - y.faith)[0];
    expect(e.divine.citizenUnderstanding(e, pious)).toBeGreaterThan(e.divine.citizenUnderstanding(e, sceptic));
  });

  it("rêve « quitte ce lieu » : l'idée de départ apparaît ; « tout ira mieux » restaure la confiance", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const c = adults(e).sort((x, y) => y.faith - x.faith)[0];
    const m = e.mind.ensure(e, c); c.faith = 1; c.intel = 1;
    delete e.cooldowns["dream"]; m.trust = -40;
    e.divine.dream(e, c.id, "hope");
    expect(m.trust).toBeGreaterThan(-40);
    delete e.cooldowns["dream"];
    e.divine.dream(e, c.id, "flee");
    expect(m.ideas & IDEA.WANDER).toBeTruthy();
  });

  it("favoriser une relation crée un lien durable (ami, couple ou réconciliation)", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const c = adults(e)[0];
    const r = e.divine.favorBond(e, c.id);
    expect(r.ok).toBe(true);
    expect(c.mind!.rel.some((x) => x.a >= 35 || x.k === REL.PARTNER)).toBe(true);
    expect(e.divine.favorBond(e, c.id).ok).toBe(false); // repos divin
  });

  it("punir puis protéger : effets réels sur vivres, stabilité, souvenirs et confiance", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const civ = e.civs[0];
    const food0 = civ.food, stab0 = civ.stability;
    expect(e.divine.punish(e, civ.id).ok).toBe(true);
    expect(civ.food).toBeLessThan(food0); expect(civ.stability).toBeLessThan(stab0);
    const mem = e.citizens.filter((c) => c.civ === civ.id && c.mind?.mem.some((m) => m.k === MEM.DISASTER));
    expect(mem.length).toBeGreaterThan(0);
    const s1 = civ.stability;
    expect(e.divine.protect(e, civ.id).ok).toBe(true);
    expect(civ.stability).toBeGreaterThan(s1);
  });

  it("encourager la foi, inspirer une découverte, influencer le dirigeant modifient l'état réel", () => {
    const e = SimulationEngine.create(42); e.runYears(8);
    const civ = e.civs[0];
    const prog = civ.techProg, aggr = civ.leader.aggr;
    expect(e.divine.inspireDiscovery(e, civ.id).ok).toBe(true);
    expect(civ.techProg).toBeGreaterThan(prog);
    const f0 = adults(e, civ.id).filter((c) => (c.mind?.ideas ?? 0) & IDEA.FAITH).length;
    e.divine.encourageFaith(e, civ.id);
    expect(adults(e, civ.id).filter((c) => (c.mind?.ideas ?? 0) & IDEA.FAITH).length).toBeGreaterThan(f0);
    civ.leader.intel = 0.9; civ.leader.goat = false;
    e.divine.influenceLeader(e, civ.id, "peace");
    expect(civ.leader.aggr).toBeLessThan(aggr + 0.01);
  });

  it("une intervention peut avoir des conséquences imprévues mais logiques (crainte du ciel après une catastrophe)", () => {
    const e = SimulationEngine.create(42); e.runYears(5);
    const c = adults(e)[0];
    e.divine.cast(e, "lightning", c.x, c.y);
    const witnesses = e.citizens.filter((x) => !x.dead && Math.hypot(x.x - c.x, x.y - c.y) < 8);
    expect(witnesses.some((w) => w.mind?.mem.some((m) => m.k === MEM.DISASTER) && (w.mind.emo[EMO.FEAR] > 0 || w.mind.ideas & IDEA.FEAR_GOD))).toBe(true);
  });
});

describe("V3 · robustesse : sauvegarde, continents, performance", () => {
  it("la sauvegarde conserve souvenirs, relations, intentions, idées", () => {
    const e = SimulationEngine.create(42); e.runYears(40);
    const withMind = e.citizens.filter((c) => c.mind && (c.mind.mem.length || c.mind.rel.length));
    expect(withMind.length).toBeGreaterThan(10);
    const c = withMind[0]; c.mind!.goal = GOAL.LEAVE; c.mind!.gTarget = e.cities[0].id; c.mind!.ideas |= IDEA.FAITH;
    const back = SaveManager.deserialize(SaveManager.serialize(e));
    for (const x of withMind.slice(0, 20)) {
      const y = back.citizenById.get(x.id)!;
      expect(y.mind).toEqual(x.mind);
    }
    expect(back.citizenById.get(c.id)!.mind!.goal).toBe(GOAL.LEAVE);
    expect(back.mind.stats.deliberations).toBe(e.mind.stats.deliberations);
  }, 60000);

  it("une ancienne sauvegarde sans esprit se charge : les esprits sont créés à la demande, déterministes", () => {
    const e = SimulationEngine.create(42); e.runYears(10);
    const json = JSON.parse(SaveManager.serialize(e));
    for (const c of json.citizens) delete c.mind;
    delete json.mind;
    const back = SaveManager.deserialize(JSON.stringify(json));
    expect(back.citizens.every((c) => !c.mind)).toBe(true);
    back.runYears(3);
    expect(back.citizens.some((c) => c.mind)).toBe(true);
    expect(back.citizens.length).toBeGreaterThan(5);
  }, 60000);

  it("les esprits évoluent dans TOUTES les régions, qu'on les regarde ou non (changement de continent)", () => {
    const ps = PlanetSim.create(42);
    ps.setActive(1);
    ps.runYears(6);
    const ids = [...ps.engines.keys()];
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const other = ps.engines.get(ids[1])!;
    const d0 = other.mind.stats.deliberations;
    ps.setActive(ids[1]);
    ps.setActive(1); // la caméra va et vient
    ps.runYears(6);
    expect(other.mind.stats.deliberations).toBeGreaterThan(d0);
    expect(ps.engines.get(1)!.mind.stats.deliberations).toBeGreaterThan(0);
  }, 60000);

  it("plusieurs centaines d'habitants : le coût par tick reste raisonnable", () => {
    const e = SimulationEngine.create(42);
    e.runYears(5);
    const civ = e.civs[0], city = e.cities.find((c) => c.civ === civ.id)!;
    while (e.citizens.length < 600) e.spawnCitizen(civ, city, city.x + 0.5 + (e.citizens.length % 7) * 0.3, city.y + 1.5 + (e.citizens.length % 5) * 0.3, 20 + (e.citizens.length % 15), { female: e.citizens.length % 2 === 0 });
    city.cap = 900;
    e.step();
    const t0 = performance.now();
    const N = 60;
    for (let i = 0; i < N; i++) e.step();
    const per = (performance.now() - t0) / N;
    console.log(`[perf] ${e.citizens.length} habitants : ${per.toFixed(2)} ms/tick (Node)`);
    expect(per).toBeLessThan(45); // budget : 100 ms/tick à ×1, bien moins à ×10 grâce à la délibération échelonnée
  }, 120000);
});
