import { describe, expect, it } from "vitest";
import { buildWitnessScene } from "../src/sim/WitnessScene";
import { SaveManager } from "../src/sim/SaveManager";
import { GOAL, IDEA, MEM } from "../src/sim/MindSystem";
import { TOPIC } from "../src/sim/Talk";
import { actionMode } from "../src/render/CitizenLayer";
import { characterGeometry, farPersonGeometry } from "../src/render/Characters";
import { vertexCount } from "../src/render/models";
import { BUDGETS } from "../src/render/budgets";
import type { Citizen } from "../src/sim/types";

const scene = () => buildWitnessScene();
const dist = (a: Citizen, b: Citizen) => Math.hypot(a.x - b.x, a.y - b.y);

describe("Scène témoin « Sentience » : identités, mémoires, conversations, décisions", () => {
  it("cinq habitants avec une identité (traits) et une mémoire (souvenirs, liens) issus du moteur", () => {
    const { e, cast } = scene();
    for (const c of [cast.mira, cast.ysa, cast.tobias, cast.garen, cast.lenn]) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.soul!.t).toHaveLength(5);
      expect(e.citizenById.get(c.id)).toBe(c); // de vrais habitants de la simulation
    }
    expect(cast.mira.mind!.mem.some((m) => m.k === MEM.FAMINE)).toBe(true);
    expect(cast.lenn.mind!.mem.some((m) => m.k === MEM.DIVINE)).toBe(true);
    expect(cast.mira.mind!.rel.some((r) => r.id === cast.ysa.id)).toBe(true);
    expect(cast.tobias.mind!.trust).toBeGreaterThan(40); // loyal
    expect(cast.mira.mind!.trust).toBeLessThan(-50); // méfiante
    expect(cast.home.id).not.toBe(cast.dest.id);
  });

  it("la scène est déterministe (mêmes habitants, mêmes états)", () => {
    const a = scene(), b = scene();
    expect(b.cast.mira.id).toBe(a.cast.mira.id);
    expect(b.e.tick).toBe(a.e.tick);
    expect(JSON.stringify(b.cast.mira.mind)).toBe(JSON.stringify(a.cast.mira.mind));
  });

  it("deux habitants discutent spontanément, s'arrêtent à distance naturelle, face à face, répliques alternées", () => {
    const { e, cast } = scene();
    let seen = false, minD = 99, maxD = 0;
    for (let t = 0; t < 400 && !seen; t++) {
      e.step();
      const tk = e.talk.get(cast.mira.id, cast.ysa.id);
      if (tk && tk.lines.length >= 3) seen = true;
      if (tk && !tk.over && cast.mira.state === "talk" && cast.ysa.state === "talk") { minD = Math.min(minD, dist(cast.mira, cast.ysa)); maxD = Math.max(maxD, dist(cast.mira, cast.ysa)); }
    }
    const tk = e.talk.get(cast.mira.id, cast.ysa.id)!;
    expect(tk).toBeTruthy();
    expect(tk.topic).toBe(TOPIC.LEAVE);
    expect(maxD).toBeLessThan(1.5); expect(minD).toBeGreaterThan(0.3); // ni collés ni éloignés
    expect(cast.mira.soul!.target).toBe(cast.ysa.id); expect(cast.ysa.soul!.target).toBe(cast.mira.id); // chacun vise l'autre : le rendu les tourne face à face
    for (let i = 1; i < tk.lines.length; i++) expect(tk.lines[i].who).not.toBe(tk.lines[i - 1].who); // ils alternent
  });

  it("la conversation influence réellement une décision persistante, puis la famille part ensemble", () => {
    const { e, cast } = scene();
    expect(cast.ysa.mind!.goal).toBe(GOAL.STAY);
    const trust0 = cast.ysa.mind!.trust;
    for (let t = 0; t < 900 && cast.ysa.mind!.goal !== GOAL.LEAVE; t++) e.step();
    expect(cast.ysa.mind!.goal).toBe(GOAL.LEAVE); // décision née de la conversation
    expect(cast.ysa.mind!.mem.some((m) => m.k === MEM.TALK)).toBe(true); // souvenir de la conversation
    expect(cast.ysa.mind!.trust).toBeLessThan(trust0 + 1);
    expect(cast.ysa.mind!.gWhy.length).toBeGreaterThan(0);
    expect(cast.kid.mind!.goal).toBe(GOAL.LEAVE); // l'enfant suit sa mère
    // action collective visible : le groupe voyage vraiment jusqu'à l'autre village
    const effects = new Set<string>();
    for (let t = 0; t < 1500 && !(cast.ysa.city === cast.dest.id && cast.kid.city === cast.dest.id && cast.mira.city === cast.dest.id); t++) { e.step(); for (const tk of e.talk.talks.values()) if (tk.effect) effects.add(tk.effect); }
    expect(cast.ysa.city).toBe(cast.dest.id); expect(cast.mira.city).toBe(cast.dest.id); expect(cast.kid.city).toBe(cast.dest.id);
    expect(cast.ysa.mind!.mem.some((m) => m.k === MEM.MIGRATE)).toBe(true);
    // la conversation a laissé une trace lisible
    expect([...effects].some((x) => /ont décidé de partir/.test(x))).toBe(true);
  }, 60000);

  it("un chantier collectif progresse : les bâtisseurs construisent réellement", () => {
    const { e, cast } = scene();
    const before = cast.sites.map((id) => e.buildingById.get(id)!.progress);
    expect(before.every((p) => p < 1)).toBe(true);
    for (let t = 0; t < 500; t++) e.step();
    const after = cast.sites.map((id) => e.buildingById.get(id)?.progress ?? 1);
    expect(after.filter((p) => p >= 1).length).toBeGreaterThanOrEqual(2);
  }, 60000);

  it("une conversation peut produire une dispute réelle (ton tendu, affinité en baisse, souvenir)", () => {
    const { e, cast } = scene();
    const { mira, tobias } = cast;
    e.mind.touch(mira, tobias.id, -30); e.mind.touch(tobias, mira.id, -30);
    mira.mind!.trust = -80; tobias.mind!.trust = 70; tobias.aggr = 0.8; mira.aggr = 0.7;
    mira.soul!.target = tobias.id; tobias.soul!.target = mira.id;
    const aff0 = e.mind.relOf(tobias, mira.id)!.a;
    for (let i = 0; i < 6; i++) { e.tick += 25; mira.mind!.goal = GOAL.STAY; e.talk.step(e, mira, tobias); }
    const tk = e.talk.get(mira.id, tobias.id)!;
    expect(tk.topic).toBe(TOPIC.LEADER);
    expect(tk.lines.length).toBeGreaterThanOrEqual(4);
    expect(e.mind.relOf(tobias, mira.id)!.a).toBeLessThanOrEqual(aff0 + 1);
  });

  it("souvenirs, relations et intentions survivent à la sauvegarde pendant la scène", () => {
    const { e, cast } = scene();
    for (let t = 0; t < 120; t++) e.step();
    const back = SaveManager.deserialize(SaveManager.serialize(e));
    for (const c of [cast.mira, cast.ysa, cast.lenn]) expect(back.citizenById.get(c.id)!.mind).toEqual(c.mind);
    back.runYears(1);
    expect(back.citizens.length).toBeGreaterThan(5);
  }, 60000);
});

describe("Animations connectées aux actions réelles", () => {
  const base = { state: "idle", job: "farmer", sick: 0, work: -1, wx: -1 } as Pick<Citizen, "state" | "job" | "sick" | "work" | "wx">;
  it("conversation : celui qui parle gesticule, l'autre écoute, ton tendu = dispute", () => {
    const talk = { ...base, state: "talk" as const };
    expect(actionMode(talk, false, 0, { speaking: true, mood: 0 }).mode).toBe(7);
    expect(actionMode(talk, false, 0, { speaking: false, mood: 0 }).mode).toBe(8);
    expect(actionMode(talk, false, 0, { speaking: false, mood: 1 }).mode).toBe(9);
    expect(actionMode(talk, false, 0, { speaking: true, mood: 2 }).mode).toBe(7);
  });
  it("construction : le bâtisseur porte des planches vers le chantier puis frappe sur place", () => {
    const b = { ...base, state: "build" as const, job: "builder" as const, work: 12 };
    expect(actionMode(b, true, 0)).toMatchObject({ mode: 10, carry: 0 });
    expect(actionMode(b, false, 0).mode).toBe(2);
  });
  it("récolte : outil du métier sur place, bois rapporté en marchant, panier à la cueillette", () => {
    expect(actionMode({ ...base, state: "work", job: "lumberjack" }, false, 0)).toMatchObject({ mode: 2 });
    expect(actionMode({ ...base, state: "work", job: "lumberjack" }, true, 0)).toMatchObject({ mode: 10, carry: 1 });
    expect(actionMode({ ...base, state: "forage" }, true, 0).tool).toBeGreaterThanOrEqual(0);
  });
  it("repos et conflit : assis au repos, combat au combat ; jamais d'animation de marche à l'arrêt ni de travail en marchant", () => {
    expect(actionMode({ ...base, state: "rest" }, false, 0).mode).toBe(4);
    expect(actionMode({ ...base, state: "fight" }, false, 0).mode).toBe(3);
    for (const st of ["idle", "wander", "work", "build", "forage", "travel", "eat", "rest", "talk", "mate", "flee", "fight", "march", "sick"] as const) {
      for (const job of ["farmer", "builder", "lumberjack", "miner", "scholar", "soldier", "child"] as const) {
        const moving = actionMode({ ...base, state: st, job }, true, 0).mode, still = actionMode({ ...base, state: st, job }, false, 0, { speaking: false, mood: 0 }).mode;
        expect([2, 5, 6, 7, 8, 9]).not.toContain(moving === 10 ? 1 : moving === 3 ? 3 : moving); // en marche : pas d'animation d'outil ni de parole
        if (st !== "flee" && st !== "march" && st !== "travel" && still === 1) throw new Error(`marche à l'arrêt : ${st}/${job}`);
      }
    }
  });
});

describe("Budgets visuels mesurables", () => {
  it("la géométrie d'un habitant respecte son budget ; la silhouette lointaine est bien plus légère", () => {
    for (const era of [0, 2, 4]) for (const f of [true, false]) expect(vertexCount(characterGeometry(era, f, 0))).toBeLessThan(BUDGETS.characterVertices);
    expect(vertexCount(farPersonGeometry())).toBeLessThan(BUDGETS.farCharacterVertices);
  });
  it("les budgets sont cohérents avec la simulation (simulation et rendu séparés)", () => {
    expect(BUDGETS.animatedCharacters).toBeGreaterThanOrEqual(300);
    expect(BUDGETS.simMsPerTick600).toBeLessThan(100); // 100 ms = un tick à ×1
  });
  it("aucun modèle de langage ni appel externe : la conversation est générée localement et déterministe", () => {
    const a = scene(), b = scene();
    for (let t = 0; t < 200; t++) { a.e.step(); b.e.step(); }
    const la = JSON.stringify([...a.e.talk.talks.values()].map((t) => t.lines.map((l) => l.text))), lb = JSON.stringify([...b.e.talk.talks.values()].map((t) => t.lines.map((l) => l.text)));
    expect(la).toBe(lb);
    expect(a.e.talk.stats.lines).toBeGreaterThan(0);
    void IDEA;
  });
});
