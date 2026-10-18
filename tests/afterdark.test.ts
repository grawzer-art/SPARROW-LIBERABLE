import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { AD_MAPS, BAR_DOOR } from "@/lib/rpg/afterdark";
import { BATTLES, EQUIPMENT } from "@/lib/rpg/bestiary";
import { reachable, solidAt, step, type Facing } from "@/lib/rpg/mapdef";
import { playTurn, startBattle, type Team } from "@/lib/rpg/combat";
import { mapOf } from "@/lib/rpg/maps";
import { policy } from "./combat-policy";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { afterBattle, arrival, examine, talkTo, type Conversation } from "@/lib/rpg/script";
import { QUARTIER } from "@/lib/rpg/quartier";

const T0 = Date.UTC(2026, 9, 17, 22);
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };
const ch1: Rpg = { ...emptyRpg(), quests: { "ville-figee": "terminee" }, flags: ["portail"], items: ["fragment-1"] };
const BANNED = /2031|octobre|lib[ée]r|prison|cellule|d[ée]tenu|barreaux|parloir|[ée]vasion|condamn|peine de|juge/i;

/** Joue une conversation en suivant les choix donnés (index), puis rend l'action finale. */
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
function win(s: State, battle: string): State {
  s = applyEffects(s, [{ kind: "flag", id: `ko:${battle}` }, { kind: "reward", xp: BATTLES[battle].xp, coins: BATTLES[battle].fp }], T0).state;
  return play(s, afterBattle(battle, s.rpg)).s;
}
const fl = (s: State, f: string) => s.rpg.flags.includes(`ad:${f}`);
function enter(): State {
  const s: State = { ...newState(T0), level: 9, rpg: ch1 };
  return play(s, arrival("bar", s.rpg, true)).s;
}
function finish(s: State): State {
  s = talk(s, "bar", "dede").s;
  expect(s.rpg.items).toContain("cle-local");
  expect(mapOf("cave")!.warps.find((w) => w.id === "local")!.needs!(s.rpg)).toBe(true);
  s = play(s, arrival("local", s.rpg, true)).s;
  s = play(s, examine("ad-coffre", s.rpg, undefined, "local")).s;
  expect(status(s.rpg, "dernier-verre")).toBe("terminee");
  expect(s.rpg.owned).toContain("montre-maudite");
  return s;
}

describe("AFTER DARK — cartes", () => {
  it("l'escalier du bar n'ouvre qu'après le chapitre 1, sur une case libre", () => {
    expect(QUARTIER.warps).toContain(BAR_DOOR);
    expect(BAR_DOOR.needs({ ...emptyRpg(), quests: { "ville-figee": "active" } })).toBe(false);
    expect(BAR_DOOR.needs(ch1)).toBe(true);
    expect(solidAt(QUARTIER, BAR_DOOR.at, ch1)).toBe(false);
  });
  it("chaque porte mène à une case libre, tout est atteignable", () => {
    const open = { ...ch1, flags: [...ch1.flags, "ad:acces-cave"], items: ["cle-local"] };
    for (const m of AD_MAPS) {
      for (const w of m.warps) {
        if (!w.to || w.to === "appart") continue;
        expect(solidAt(mapOf(w.to.map)!, w.to, open), `${m.id}/${w.id}`).toBe(false);
      }
      const r = reachable(m, m.spawn, open);
      for (const w of m.warps) expect(r.has(`${step(w.at, back[w.dir ?? "up"]).x},${step(w.at, back[w.dir ?? "up"]).y}`) || r.has(`${w.at.x},${w.at.y}`), `${m.id}/${w.id}`).toBe(true);
    }
  });
  it("les combats sont brutaux, en fond « club », et l'équipement reste raisonnable", () => {
    for (const id of ["ad-kevin", "ad-bertrand", "ad-ginette", "ad-bulldozer", "ad-kiki"]) expect(BATTLES[id]?.brutal, id).toBe(true);
    const montre = EQUIPMENT["montre-maudite"];
    expect(Object.values(montre.bonus).some((v) => (v ?? 0) < 0)).toBe(true);
  });
});

function rate(id: string, team: Team, n = 150) {
  let w = 0;
  for (let i = 0; i < n; i++) {
    let b = startBattle(id, team, 1000 + i * 31);
    for (let k = 0; !b.over && k < 80; k++) b = playTurn(b, policy(b)).battle;
    if (b.over === "win") w++;
  }
  return w / n;
}

describe("AFTER DARK — équilibrage", () => {
  it("dangereux juste après le chapitre 1, gagnable une fois équipé (niv. 8, deux équipiers)", () => {
    const early: Team = { level: 4, party: ["chevalier"], gear: {}, skills: [], bag: { frites: 2 } };
    const mid: Team = { level: 8, party: ["chevalier", "gerard"], gear: {}, skills: [], bag: { frites: 2 } };
    expect(rate("ad-kiki", early)).toBeLessThan(0.2);
    for (const id of ["ad-kevin", "ad-bertrand", "ad-ginette", "ad-bulldozer", "ad-kiki"]) expect(rate(id, mid), id).toBeGreaterThanOrEqual(0.75);
  });
});

describe("AFTER DARK — Dernier verre avant minuit (sans interface)", () => {
  it("méthode 1 : le ring — 4 combats, ceinture, réputation honnête", () => {
    let s = enter();
    expect(status(s.rpg, "dernier-verre")).toBe("active");
    s = talk(s, "bar", "dede").s;
    s = talk(s, "bar", "bulldozer", [0]).s;
    expect(fl(s, "acces-cave")).toBe(true);
    for (const b of ["ad-kevin", "ad-bertrand", "ad-ginette", "ad-kiki"]) {
      const t = talk(s, "cave", "tarif");
      expect(t.then).toEqual({ kind: "battle", id: b });
      s = win(t.s, b);
    }
    expect(fl(s, "m-ring") && fl(s, "rep-honnete") && fl(s, "tournoi-fini")).toBe(true);
    expect(s.rpg.owned).toContain("ceinture-ring");
    finish(s);
  });
  it("méthode 2a : acheter le videur avec la bouteille — accès au marché noir", () => {
    let s = enter();
    s = talk(s, "bar", "momo", [1]).s;
    expect(s.rpg.items).toContain("chateau-petrole");
    s = talk(s, "bar", "bulldozer", [1]).s;
    expect(fl(s, "m-videur-achete") && fl(s, "fouine-ok")).toBe(true);
    expect(talk(s, "bar", "fouine", [0]).then).toEqual({ kind: "shop", id: "marche-noir" });
    finish(s);
  });
  it("méthode 2b : intimider le videur — combat, deux cafés", () => {
    let s = enter();
    const t = talk(s, "bar", "bulldozer", [1]);
    expect(t.then).toEqual({ kind: "battle", id: "ad-bulldozer" });
    s = win(t.s, "ad-bulldozer");
    expect(fl(s, "m-videur-ko")).toBe(true);
    finish(s);
  });
  it("méthode 3 : les preuves — dénoncer (cadeau de Momo) ou faire chanter (260 FP, Momo froid)", () => {
    let s = enter();
    s = talk(s, "bar", "momo", [1]).s;
    s = play(s, examine("ad-tonneau", s.rpg, undefined, "bar")).s;
    s = talk(s, "bar", "fouine", [0]).s;
    expect(s.rpg.items).toEqual(expect.arrayContaining(["seringue", "carnet-tarif"]));
    // Dénoncer
    const d = talk(s, "bar", "momo", [0]).s;
    expect(fl(d, "m-denonce") && fl(d, "rep-honnete")).toBe(true);
    const gift = talk(d, "bar", "momo").s;
    expect(gift.rpg.bag["gnole-maison"]).toBe(3);
    finish(gift);
    // Faire chanter
    let c = talk(s, "bar", "momo", [1]).s;
    const coins = c.coins;
    c = talk(c, "cave", "tarif", [0]).s;
    expect(c.coins).toBe(coins + 260);
    expect(fl(c, "m-chantage") && fl(c, "rep-crapule") && fl(c, "fouine-ok")).toBe(true);
    expect(talk(c, "bar", "momo").text).not.toBe(talk(gift, "bar", "momo").text);
    finish(c);
  });
  it("aucun texte interdit dans la quête", () => {
    const states: Rpg[] = [ch1, { ...ch1, flags: [...ch1.flags, "ad:tournoi-fini", "ad:m-chantage", "ad:acces-cave", "ad:inscrit", "ad:dede-1"] }];
    for (const r of states)
      for (const [id, map] of [["momo", "bar"], ["dede", "bar"], ["bulldozer", "bar"], ["fouine", "bar"], ["josiane", "bar"], ["habitue", "bar"], ["tarif", "cave"], ["kevin", "cave"], ["kiki", "cave"]]) {
        const c = talkTo(id, r, map);
        expect(JSON.stringify(c), `${map}:${id}`).not.toMatch(BANNED);
      }
    for (const m of AD_MAPS) expect(JSON.stringify(arrival(m.id, ch1, true))).not.toMatch(BANNED);
    for (const b of ["ad-kevin", "ad-bertrand", "ad-ginette", "ad-bulldozer", "ad-kiki"]) expect(JSON.stringify(afterBattle(b, ch1))).not.toMatch(BANNED);
  });
});
