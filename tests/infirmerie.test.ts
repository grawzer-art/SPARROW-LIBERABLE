import { describe, expect, it } from "vitest";
import { BATTLES, FOES } from "@/lib/rpg/bestiary";
import { freshFight, healOutside, hpAfter, playTurn, startBattle, type Battle, type Team } from "@/lib/rpg/combat";
import { INFIRMERIES } from "@/lib/rpg/infirmerie";
import { solidAt } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { applyEffects, emptyRpg, restoreRpg } from "@/lib/rpg/quest";
import { talkTo } from "@/lib/rpg/script";
import { newState } from "@/lib/gotchi/core";

const team = (over: Partial<Team> = {}): Team => ({ level: 10, party: ["chevalier", "gerard"], gear: {}, skills: [], bag: {}, ...over });

describe("PV gardés entre les combats", () => {
  it("un combat ordinaire commence avec les PV gardés ; un K.O. ne commence pas", () => {
    const b = startBattle("haltere-1", team({ hp: { sparrow: 0, chevalier: 0.5 } }), 1);
    expect(b.allies[0].hp).toBe(0);
    expect(b.allies[1].hp).toBe(Math.round(b.allies[1].maxHp * 0.5));
    expect(b.allies[2].hp).toBe(b.allies[2].maxHp);
    expect(b.a).toBe(1);
    expect(b.fought).toEqual(["chevalier"]);
  });
  it("boss et tutoriel : toujours en pleine forme", () => {
    const boss = Object.values(BATTLES).find((d) => d.foes.some((f) => FOES[f]?.boss))!;
    expect(freshFight(boss)).toBe(true);
    const b = startBattle(boss.id, team({ hp: { sparrow: 0.1, chevalier: 0 } }), 1);
    expect(b.allies.every((x) => x.hp === x.maxHp)).toBe(true);
  });
  it("toute l'équipe K.O. (sauvegarde abîmée) : pleine forme plutôt qu'un combat impossible", () => {
    const b = startBattle("haltere-1", team({ hp: { sparrow: 0, chevalier: 0, gerard: 0 } }), 1);
    expect(b.allies.every((x) => x.hp === x.maxHp)).toBe(true);
  });
  it("après le combat, seuls les blessés sont notés", () => {
    let b: Battle = startBattle("haltere-1", team(), 3);
    for (let i = 0; i < 30 && !b.over; i++) b = playTurn(b, { kind: "move", move: "coup-manette" }).battle;
    const hp = hpAfter(b);
    for (const x of b.allies) {
      if (x.hp === x.maxHp) expect(hp[x.id]).toBeUndefined();
      else expect(hp[x.id]).toBeCloseTo(x.hp / x.maxHp, 2);
    }
  });
});

describe("Soins hors combat (SAC)", () => {
  it("soigne l'équipier le plus blessé, réanime seulement un K.O.", () => {
    const t = team({ hp: { sparrow: 0.9, chevalier: 0.2, gerard: 0 } });
    const u = healOutside(t, "tisane")!;
    expect(u.who).toBe("Chevalier Noir");
    expect(u.hp.chevalier).toBeGreaterThan(0.2);
    expect(u.hp.gerard).toBe(0);
    const k = healOutside(t, "ketchup")!;
    expect(k.hp.gerard).toBeCloseTo(0.5, 1);
    expect(healOutside(team(), "frites")).toBeNull();
    expect(healOutside(t, "sauce-piquante")).toBeNull();
    expect(healOutside(t, "capsule-echo")).toBeNull();
  });
  it("un soin qui remplit les PV retire l'équipier de la liste des blessés", () => {
    expect(healOutside(team({ hp: { sparrow: 0.99 } }), "cafe-minuit")!.hp).toEqual({});
  });
});

describe("Infirmeries", () => {
  it("une infirmière dans chaque grande région, sur une case libre, avec une case de retour libre", () => {
    expect(INFIRMERIES.map((s) => s.map)).toEqual(["herboristerie", "refuge", "auberge", "tour-parvis"]);
    const r = emptyRpg();
    for (const s of INFIRMERIES) {
      const m = mapOf(s.map)!;
      const npcs = m.npcs.filter((n) => n.id === "camomille");
      expect(npcs).toHaveLength(1);
      expect(solidAt(m, s.at, r)).toBe(false);
      expect(solidAt(m, s.back, r)).toBe(false);
      expect(m.warps.some((w) => w.at.x === s.back.x && w.at.y === s.back.y)).toBe(false);
      expect(m.npcs.filter((n) => n.id !== "camomille").some((n) => (n.start.x === s.at.x && n.start.y === s.at.y) || (n.start.x === s.back.x && n.start.y === s.back.y))).toBe(false);
    }
  });
  it("Camomille soigne toute l'équipe et enregistre le point de retour", () => {
    const s0 = newState(Date.now());
    const s = { ...s0, rpg: { ...s0.rpg, hp: { sparrow: 0.3, gerard: 0 } } };
    const c = talkTo("camomille", s.rpg, "refuge");
    const out = applyEffects(s, c.effects!, Date.now());
    expect(out.state.rpg.hp).toBeUndefined();
    expect(out.state.rpg.respawn).toEqual({ map: "refuge", x: 8, y: 5, dir: "up" });
    expect(out.notes).toContain("Toute l'équipe est soignée.");
  });
  it("sauvegarde : PV et point de retour relus, valeurs abîmées ignorées, anciennes sauvegardes intactes", () => {
    const r = restoreRpg(JSON.parse(JSON.stringify({ ...emptyRpg(), hp: { sparrow: 0.25, x: 7, y: -1, z: "a" }, respawn: { map: "auberge", x: 7, y: 4, dir: "right" } })));
    expect(r.hp).toEqual({ sparrow: 0.25 });
    expect(r.respawn).toEqual({ map: "auberge", x: 7, y: 4, dir: "right" });
    expect(restoreRpg({ ...emptyRpg(), respawn: { map: "x", x: 1.5, y: 0, dir: "up" } }).respawn).toBeUndefined();
    const old = restoreRpg(JSON.parse(JSON.stringify(emptyRpg())));
    expect(old.hp).toBeUndefined();
    expect(old.respawn).toBeUndefined();
  });
});

describe("État « Endormi »", () => {
  it("l'endormi perd 1 à 3 tours puis se réveille ; un soin d'état le réveille", () => {
    let lost = 0;
    for (let seed = 1; seed < 40; seed++) {
      let b = startBattle("moine-1", team(), seed);
      b.allies[0].status = { id: "endormi", turns: 3 };
      const r = playTurn(b, { kind: "move", move: "coup-manette" });
      b = r.battle;
      if (r.events.some((e) => e.kind === "text" && /dort profondément/.test(e.text))) lost++;
    }
    expect(lost).toBeGreaterThan(5);
    const b = startBattle("moine-1", team({ bag: { tisane: 1 } }), 2);
    b.allies[0].status = { id: "endormi", turns: 3 };
    const r = playTurn(b, { kind: "item", item: "tisane", target: 0 });
    expect(r.battle.allies[0].status?.id === "endormi").toBe(false);
  });
  it("le Moine du Gain et la Lanterne Folle savent endormir", () => {
    expect(FOES["moine-gain"].moves).toContain("mantra-sommeil");
    expect(FOES["lanterne-folle"].moves).toContain("lueur-hypnose");
  });
});
