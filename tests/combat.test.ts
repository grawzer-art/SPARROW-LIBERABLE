import { describe, expect, it } from "vitest";
import { BATTLES, CONSUMABLES, EQUIPMENT, FOES, MEMBERS, MOVES, SHOPS } from "@/lib/rpg/bestiary";
import { bagAfter, foe, forced, makeAlly, mustSwap, playTurn, spoils, startBattle, type Team } from "@/lib/rpg/combat";
import { policy } from "./combat-policy";

function fight(id: string, team: Team, seed: number) {
  let b = startBattle(id, team, seed);
  let turns = 0;
  while (!b.over && turns < 80) {
    b = playTurn(b, policy(b)).battle;
    turns++;
  }
  return { b, turns };
}

function stats(id: string, team: Team, n = 300) {
  let wins = 0;
  let turns = 0;
  for (let i = 0; i < n; i++) {
    const r = fight(id, team, 1000 + i * 31);
    if (r.b.over === "win") wins++;
    turns += r.turns;
  }
  return { rate: wins / n, turns: turns / n };
}

const T = (level: number, party: string[], bag: Record<string, number> = {}, gear: Team["gear"] = {}, skills: string[] = []): Team => ({ level, party, gear, skills, bag });

describe("Données de combat", () => {
  it("toutes les références existent", () => {
    for (const m of Object.values(MEMBERS)) for (const id of m.moves) expect(MOVES[id], id).toBeDefined();
    for (const f of Object.values(FOES)) {
      for (const id of f.moves) expect(MOVES[id], id).toBeDefined();
      for (const p of f.phases ?? []) for (const id of p.moves) expect(MOVES[id], id).toBeDefined();
    }
    for (const b of Object.values(BATTLES)) {
      for (const f of b.foes) expect(FOES[f], f).toBeDefined();
      for (const d of Object.keys(b.drops ?? {})) expect(CONSUMABLES[d], d).toBeDefined();
    }
    for (const s of Object.values(SHOPS)) for (const i of s.items) expect(CONSUMABLES[i] ?? EQUIPMENT[i], i).toBeDefined();
  });
  it("4 techniques par équipier, avec puissance et précision", () => {
    for (const m of Object.values(MEMBERS)) {
      expect(m.moves).toHaveLength(4);
      for (const id of m.moves) {
        expect(MOVES[id].acc).toBeGreaterThan(0);
        expect(MOVES[id].desc.length).toBeGreaterThan(5);
      }
    }
  });
});

describe("Moteur de combat", () => {
  it("un tour produit des événements et fait baisser des PV", () => {
    const b = startBattle("eclaireur", T(1, ["chevalier"]), 42);
    const { battle, events } = playTurn(b, { kind: "move", move: "coup-manette" });
    expect(events.some((e) => e.kind === "use")).toBe(true);
    expect(foe(battle).hp < foe(b).hp || events.some((e) => e.kind === "miss")).toBe(true);
    expect(b.turn).toBe(0); // l'état d'origine n'est pas modifié
  });
  it("même graine → même combat (rejouable)", () => {
    const a = fight("roi-salade", T(5, ["chevalier", "gerard"], { frites: 3 }), 7);
    const b = fight("roi-salade", T(5, ["chevalier", "gerard"], { frites: 3 }), 7);
    expect(a.b.foes[0].hp).toBe(b.b.foes[0].hp);
    expect(a.turns).toBe(b.turns);
  });
  it("une attaque préparée est annoncée, puis lancée au tour suivant", () => {
    let b = startBattle("eclaireur", T(3, []), 1);
    const t1 = playTurn(b, { kind: "move", move: "rage-lag" });
    expect(t1.events.some((e) => e.kind === "charge")).toBe(true);
    b = t1.battle;
    expect(forced(b)).toEqual({ kind: "move", move: "rage-lag" });
    const t2 = playTurn(b, forced(b)!);
    expect(t2.events.some((e) => e.kind === "use" && e.move === "rage-lag")).toBe(true);
  });
  it("le boss change de phase sous 50 % de PV", () => {
    let b = startBattle("roi-salade", T(6, ["chevalier", "gerard"]), 3);
    b.foes[0].hp = Math.floor(b.foes[0].maxHp * 0.52);
    let phased = false;
    for (let i = 0; i < 14 && !phased && !b.over; i++) {
      const r = playTurn(b, policy(b));
      phased = r.events.some((e) => e.kind === "phase");
      b = r.battle;
    }
    expect(phased).toBe(true);
    expect(b.foes[0].moves).toContain("tornade-croutons");
  });
  it("objets : soin, consommation et sac après combat", () => {
    let b = startBattle("brocoli-cite", T(2, ["chevalier"], { frites: 2 }), 5);
    b.allies[0].hp = 10;
    b = playTurn(b, { kind: "item", item: "frites" }).battle;
    expect(b.bag.frites).toBe(1);
    expect(b.allies[0].hp).toBeGreaterThan(10);
    const s = spoils({ ...b, over: "win" });
    expect(bagAfter({ frites: 2 }, s)).toEqual({ frites: 2 }); // 1 utilisée, 1 gagnée
  });
  it("changer d'équipier coûte le tour (l'ennemi frappe le nouveau)", () => {
    const b = startBattle("brocoli-cite", T(2, ["chevalier"]), 9);
    const r = playTurn(b, { kind: "swap", to: 1 });
    expect(r.battle.a).toBe(1);
    expect(r.events.some((e) => e.kind === "use" && e.side === "foe")).toBe(true);
  });
  it("on ne peut pas fuir le tutoriel ni un boss", () => {
    for (const id of ["eclaireur", "roi-salade"]) {
      const r = playTurn(startBattle(id, T(9, ["chevalier"]), 2), { kind: "flee" });
      expect(r.battle.over).toBeNull();
    }
  });
  it("Sparrow K.O. : on choisit un autre équipier, sans tour ennemi", () => {
    let b = startBattle("brocoli-cite", T(3, ["chevalier"]), 4);
    b.allies[0].hp = 1;
    b.foes[0].atk = 999;
    for (let i = 0; i < 5 && !mustSwap(b); i++) b = playTurn(b, { kind: "move", move: "coup-manette" }).battle;
    expect(mustSwap(b)).toBe(true);
    const r = playTurn(b, { kind: "swap", to: 1 });
    expect(r.battle.a).toBe(1);
    expect(r.events.some((e) => e.kind === "use" && e.side === "foe")).toBe(false);
  });
  it("équipement et techniques apprises", () => {
    const base = makeAlly("sparrow", { level: 5, gear: {}, skills: [] });
    const eq = makeAlly("sparrow", { level: 5, gear: { arme: "spatule", armure: "tablier" }, skills: ["pluie-frites"] });
    expect(eq.atk).toBe(base.atk + 5);
    expect(eq.maxHp).toBe(base.maxHp + 14);
    expect(eq.moves).toContain("pluie-frites");
    expect(eq.moves).not.toContain("coup-manette");
  });
});

describe("Équilibrage (simulation d'un joueur raisonnable)", () => {
  it("le tutoriel se gagne toujours, même au niveau 1", () => {
    const s = stats("eclaireur", T(1, ["chevalier"]));
    expect(s.rate).toBe(1);
    expect(s.turns).toBeGreaterThanOrEqual(3);
  });
  it("les combats normaux du chapitre 2 se gagnent sans être gratuits", () => {
    for (const [id, team] of [
      ["brocoli-cite", T(2, ["chevalier"], { frites: 2 })],
      ["brocolis-porte", T(3, ["chevalier"], { frites: 2 })],
      ["patate-1", T(3, ["chevalier", "gerard"], { frites: 2 })],
      ["patate-2", T(4, ["chevalier", "gerard"], { frites: 2 })],
      ["laitue-1", T(4, ["chevalier", "gerard"], { frites: 2 })],
      ["laitue-2", T(5, ["chevalier", "gerard"], { frites: 2 })],
    ] as const) {
      const s = stats(id, team);
      expect(s.rate, id).toBeGreaterThan(0.9);
      expect(s.turns, id).toBeGreaterThanOrEqual(3);
    }
  });
  it("le Roi de la Salade est un vrai défi, mais battable avec préparation", () => {
    const bare = stats("roi-salade", T(4, ["chevalier", "gerard"]));
    const prepared = stats("roi-salade", T(5, ["chevalier", "gerard"], { frites: 3, "part-pizza": 1 }, { arme: "manette-pro", armure: "sweat-epais" }, ["pluie-frites"]));
    expect(prepared.rate).toBeGreaterThan(0.8);
    expect(prepared.turns).toBeGreaterThanOrEqual(8);
    expect(bare.rate).toBeLessThan(prepared.rate + 0.0001);
  });
  it("un joueur de haut niveau garde un combat (niveau ennemi qui suit)", () => {
    const s = stats("roi-salade", T(30, ["chevalier", "gerard"]));
    expect(s.rate).toBeGreaterThan(0.95);
    expect(s.turns).toBeGreaterThanOrEqual(3);
  });
});

describe("Équilibrage : un joueur qui spamme la première technique", () => {
  it("le boss ne tombe pas en quelques coups", () => {
    let total = 0;
    for (let i = 0; i < 100; i++) {
      let b = startBattle("roi-salade", { level: 5, party: ["chevalier", "gerard"], gear: {}, skills: [], bag: {} }, 500 + i);
      b = playTurn(b, { kind: "swap", to: 2 }).battle;
      let t = 1;
      while (!b.over && t < 80) {
        b = playTurn(b, mustSwap(b) ? { kind: "swap", to: b.allies.findIndex((x) => x.hp > 0) } : (forced(b) ?? { kind: "move", move: b.allies[b.a].moves[0] })).battle;
        t++;
      }
      total += t;
    }
    expect(total / 100).toBeGreaterThanOrEqual(10);
  });
});
