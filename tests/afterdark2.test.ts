import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { AD2_DOORS, AD2_MAPS } from "@/lib/rpg/afterdark2";
import { BATTLES } from "@/lib/rpg/bestiary";
import { playTurn, startBattle, type Team } from "@/lib/rpg/combat";
import { reachable, solidAt, step, type Facing } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { afterBattle, arrival, examine, talkTo, type Conversation } from "@/lib/rpg/script";
import { policy } from "./combat-policy";

const T0 = Date.UTC(2026, 9, 17, 22);
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };
const BANNED = /2031|octobre|lib[ée]r|prison|cellule|d[ée]tenu|barreaux|parloir|[ée]vasion|condamn|peine de|juge/i;
const done = (...q: string[]): Rpg => ({ ...emptyRpg(), quests: Object.fromEntries(["ville-figee", ...q].map((x) => [x, "terminee" as const])), flags: ["portail"] });
const ALL = done("frites-perdues", "confrerie", "samourai", "minuit");

function play(s: State, c: Conversation | null, picks: number[] = []): { s: State; then?: Conversation["then"]; text: string } {
  let text = "";
  while (c) {
    text += c.lines.map((l) => l.text).join(" ");
    s = applyEffects(s, c.effects ?? [], T0).state;
    if (!c.choices?.length) return { s, then: c.then, text };
    c = c.choices[picks.shift() ?? 0].next;
  }
  return { s, text };
}
const talk = (s: State, map: string, id: string, picks: number[] = []) => play(s, talkTo(id, s.rpg, map), picks);
const look = (s: State, map: string, key: string) => play(s, examine(key, s.rpg, undefined, map)).s;
function win(s: State, battle: string): State {
  s = applyEffects(s, [{ kind: "flag", id: `ko:${battle}` }, { kind: "reward", xp: BATTLES[battle].xp, coins: BATTLES[battle].fp }], T0).state;
  return play(s, afterBattle(battle, s.rpg)).s;
}
/** Combat déclenché par un dialogue, puis gagné. */
function fight(s: State, map: string, id: string, battle: string, picks: number[] = []): State {
  const t = talk(s, map, id, picks);
  expect(t.then, `${map}:${id}`).toEqual({ kind: "battle", id: battle });
  return win(t.s, battle);
}
const enter = (map: string): State => {
  const s: State = { ...newState(T0), level: 20, rpg: ALL };
  return play(s, arrival(map, s.rpg, true)).s;
};
const fl = (s: State, f: string) => s.rpg.flags.includes(`ad:${f}`);

describe("AFTER DARK 2 — portes et cartes", () => {
  it("chaque porte dérobée n'ouvre qu'après le chapitre de sa région, sur une façade", () => {
    const gates: Record<string, string> = { "ad-tripot": "frites-perdues", "ad-labo": "confrerie", "ad-snack": "samourai", "ad-casino": "minuit" };
    for (const d of AD2_DOORS) {
      const m = mapOf(d.map)!;
      expect(m.warps).toContain(d.warp);
      expect(d.warp.needs!(done()), d.warp.id).toBe(false);
      expect(d.warp.needs!(done(gates[d.warp.id])), d.warp.id).toBe(true);
      expect(solidAt(m, d.warp.at, ALL), d.warp.id).toBe(true);
      expect(solidAt(m, step(d.warp.at, "down"), ALL), d.warp.id).toBe(false);
    }
  });
  it("chaque pièce : sortie libre, tout est atteignable", () => {
    for (const m of AD2_MAPS) {
      for (const w of m.warps) if (w.to && w.to !== "appart") expect(solidAt(mapOf(w.to.map)!, w.to, ALL), `${m.id}/${w.id}`).toBe(false);
      const r = reachable(m, m.spawn, ALL);
      for (const w of m.warps) expect(r.has(`${step(w.at, back[w.dir ?? "up"]).x},${step(w.at, back[w.dir ?? "up"]).y}`), `${m.id}/${w.id}`).toBe(true);
      // (les tenanciers derrière le comptoir se parlent par-dessus : deux cases plus bas)
      const near = (n: (typeof m.npcs)[number]) => [...(["up", "down", "left", "right"] as Facing[]).map((d) => step(n.start, d)), { x: n.start.x, y: n.start.y + 2 }];
      for (const n of m.npcs) expect(near(n).some((t) => r.has(`${t.x},${t.y}`)), `${m.id}/${n.id}`).toBe(true);
    }
  });
});

describe("AFTER DARK 2 — La dette de Papi Lardon", () => {
  it("cogner : jumeaux puis Gras-Double, frites du diable", () => {
    let s = enter("tripot");
    s = talk(s, "tripot", "lardon").s;
    s = fight(s, "tripot", "jumeaux", "ad-jumeaux");
    s = fight(s, "tripot", "gras", "ad-gras-double", [0]);
    s = talk(s, "tripot", "lardon").s;
    expect(status(s.rpg, "dette-lardon")).toBe("terminee");
    expect(s.rpg.bag["frites-diable"]).toBe(3);
    expect(fl(s, "rep-honnete")).toBe(true);
  });
  it("tricher aux cartes avec Loulou : 180 FP, réputation de crapule", () => {
    let s = enter("tripot");
    s = talk(s, "tripot", "lardon").s;
    s = talk(s, "tripot", "loulou", [0]).s;
    const c = s.coins;
    s = talk(s, "tripot", "gras", [1]).s;
    expect(s.coins).toBe(c + 180);
    expect(status(s.rpg, "dette-lardon")).toBe("terminee");
    expect(fl(s, "rep-crapule") && fl(s, "tl-cartes")).toBe(true);
  });
  it("trahir Lardon : chevalière, Lardon rancunier ; le secret du congélateur", () => {
    let s = enter("tripot");
    s = talk(s, "tripot", "lardon").s;
    s = talk(s, "tripot", "gras", [1]).s; // sans jeu marqué : « travailler » est le 2e choix
    s = talk(s, "tripot", "lardon", [0]).s;
    s = talk(s, "tripot", "gras").s;
    expect(s.rpg.owned).toContain("chevaliere-grasse");
    expect(status(s.rpg, "dette-lardon")).toBe("terminee");
    expect(talk(s, "tripot", "lardon").text).toMatch(/vendu ma recette/);
    s = look(s, "tripot", "tl-congel");
    expect(fl(s, "tl-secret")).toBe(true);
  });
});

describe("AFTER DARK 2 — La salle du fond", () => {
  it("casser le labo : bandeau de Brindille", () => {
    let s = enter("labo");
    s = talk(s, "labo", "brindille").s;
    s = fight(s, "labo", "biscotos", "ad-biscotos");
    s = fight(s, "labo", "doc", "ad-creatine", [0]);
    s = talk(s, "labo", "brindille").s;
    expect(status(s.rpg, "salle-fond")).toBe("terminee");
    expect(s.rpg.owned).toContain("bandeau-brindille");
  });
  it("dénoncer avec le registre (sans combat) ou s'associer", () => {
    let s = enter("labo");
    s = talk(s, "labo", "brindille").s;
    s = look(s, "labo", "lf-frigo");
    expect(s.rpg.items).toContain("registre-doc");
    const d = talk(s, "labo", "rotule", [0]).s;
    expect(status(d.rpg, "salle-fond")).toBe("terminee");
    expect(fl(d, "lf-denonce") && fl(d, "rep-honnete")).toBe(true);
    const a = talk(s, "labo", "doc", [1]).s;
    expect(fl(a, "lf-associe") && fl(a, "rep-crapule")).toBe(true);
    expect(a.rpg.bag["proteine-louche"]).toBe(2);
    expect(talk(a, "labo", "brindille").text).toMatch(/bu le jus/);
  });
});

describe("AFTER DARK 2 — Le Snack Sakura", () => {
  it("duel de karaoké : une mauvaise réponse, puis la bonne chanson (indices de Jirō)", () => {
    let s = enter("snack");
    s = talk(s, "snack", "fumiko").s;
    expect(talk(s, "snack", "jiro").text).toMatch(/bol tiède/);
    const rate = talk(s, "snack", "oyabun", [1, 2]);
    expect(fl(rate.s, "ss-fini")).toBe(false);
    s = talk(s, "snack", "oyabun", [1, 0, 1, 2]).s;
    expect(status(s.rpg, "snack-sakura")).toBe("terminee");
    expect(s.rpg.bag["sake-oyabun"]).toBe(2);
    s = talk(s, "snack", "fumiko").s;
    expect(s.rpg.owned).toContain("micro-or");
  });
  it("la bagarre, ou collecter pour l'Oyabun", () => {
    let s = enter("snack");
    s = talk(s, "snack", "fumiko").s;
    const b = fight(fight(s, "snack", "sushis", "ad-sushis"), "snack", "oyabun", "ad-oyabun", [0]);
    expect(fl(b, "ss-bagarre")).toBe(true);
    const c = talk(s, "snack", "oyabun", [2]).s;
    expect(c.coins).toBe(s.coins + 300);
    expect(fl(c, "rep-crapule")).toBe(true);
  });
});

describe("AFTER DARK 2 — Le Tic-Tac Club", () => {
  it("la roulette : seul le zéro gagne ; le coffre libère les minutes", () => {
    let s = enter("casino");
    s = talk(s, "casino", "joueur").s;
    expect(fl(talk(s, "casino", "veuve", [1, 0]).s, "tt-fini")).toBe(false);
    s = talk(s, "casino", "veuve", [1, 3]).s;
    expect(status(s.rpg, "tic-tac")).toBe("terminee");
    s = look(s, "casino", "tt-coffre");
    expect(fl(s, "tt-secret")).toBe(true);
  });
  it("casser la banque (jeton) ou s'associer (dé pipé maudit, coffre fermé)", () => {
    let s = enter("casino");
    s = talk(s, "casino", "joueur").s;
    const b = fight(fight(s, "casino", "pendules", "ad-pendules"), "casino", "veuve", "ad-veuve", [0]);
    expect(b.rpg.owned).toContain("jeton-minuit");
    const a = talk(s, "casino", "veuve", [2]).s;
    expect(a.rpg.owned).toContain("de-pipe");
    expect(fl(look(a, "casino", "tt-coffre"), "tt-secret")).toBe(false);
  });
});

describe("AFTER DARK 2 — textes et équilibrage", () => {
  it("aucun texte interdit", () => {
    const keys: [string, string][] = [["tripot", "lardon"], ["tripot", "gras"], ["tripot", "jumeaux"], ["tripot", "loulou"], ["tripot", "comptable"], ["labo", "brindille"], ["labo", "doc"], ["labo", "biscotos"], ["labo", "rotule"], ["snack", "fumiko"], ["snack", "oyabun"], ["snack", "sushis"], ["snack", "jiro"], ["casino", "joueur"], ["casino", "veuve"], ["casino", "pendules"], ["casino", "tic"]];
    const flagsets = [[], ["ad:tl-lardon", "ad:lf-brindille", "ad:ss-fumiko", "ad:tt-joueur"], ["ad:tl-regle", "ad:tl-trahison", "ad:lf-ferme", "ad:lf-associe", "ad:ss-fini", "ad:ss-racket", "ad:tt-fini", "ad:tt-associe"]];
    for (const f of flagsets) for (const [map, id] of keys) expect(JSON.stringify(talkTo(id, { ...ALL, flags: [...ALL.flags, ...f] }, map)), `${map}:${id}`).not.toMatch(BANNED);
    for (const m of AD2_MAPS) expect(JSON.stringify(arrival(m.id, ALL, true))).not.toMatch(BANNED);
    for (const d of AD2_DOORS) expect(d.warp.text).not.toMatch(BANNED);
  });
  it("chaque boss se gagne avec l'équipe de fin de chapitre, pas avant", () => {
    const rate = (id: string, team: Team, n = 120) => {
      let w = 0;
      for (let i = 0; i < n; i++) {
        let b = startBattle(id, team, 1000 + i * 31);
        for (let k = 0; !b.over && k < 80; k++) b = playTurn(b, policy(b)).battle;
        if (b.over === "win") w++;
      }
      return w / n;
    };
    const T = (level: number, party: string[]): Team => ({ level, party, gear: {}, skills: [], bag: { frites: 2 } });
    const cases: [string, number, string[]][] = [
      ["ad-gras-double", 7, ["chevalier", "gerard"]],
      ["ad-creatine", 11, ["chevalier", "gerard", "lili"]],
      ["ad-oyabun", 15, ["chevalier", "gerard", "lili", "pokeyz"]],
      ["ad-veuve", 19, ["chevalier", "gerard", "lili", "pokeyz"]],
    ];
    for (const [id, lv, party] of cases) {
      expect(rate(id, T(lv, party)), id).toBeGreaterThanOrEqual(0.7);
      expect(rate(id, T(lv - 4, party)), `${id} trop tôt`).toBeLessThan(0.7);
    }
  });
});
