import { describe, expect, it } from "vitest";
import { newState } from "@/lib/gotchi/engine";
import { FOES, MEMBERS } from "@/lib/rpg/bestiary";
import { makeAlly, movesOf, playTurn, startBattle } from "@/lib/rpg/combat";
import { fixLevels, levelOf, ownLevels, teamGainXp, xpNeed } from "@/lib/rpg/monsters";
import { applyEffects, emptyRpg, restoreRpg, type Rpg } from "@/lib/rpg/quest";

const base = { gear: {}, skills: [], bag: {} };

describe("Progression V2 — niveaux individuels", () => {
  it("seuls les équipiers entrés au combat gagnent de l'expérience", () => {
    const r: Rpg = { ...emptyRpg(), party: ["chevalier", "gerard"], levels: { chevalier: { level: 7, xp: 0 }, gerard: { level: 7, xp: 0 } } };
    const g = teamGainXp(r, xpNeed(7) + 5, ["sparrow", "chevalier"]);
    expect(g.rpg.levels!.chevalier).toEqual({ level: 8, xp: 5 });
    expect(g.rpg.levels!.gerard).toEqual({ level: 7, xp: 0 });
    expect(g.ups.some((u) => /Chevalier Noir passe au niveau 8/.test(u))).toBe(true);
  });
  it("un compagnon garde son niveau, même si Sparrow monte", () => {
    const r: Rpg = { ...emptyRpg(), party: ["chevalier"], levels: { chevalier: { level: 7, xp: 0 } } };
    expect(levelOf(r, "chevalier", 15)).toBe(7);
    const b = startBattle("roi-salade", { level: 15, party: r.party, mons: ownLevels(r), ...base }, 1);
    expect(b.allies.map((x) => [x.id, x.lv])).toEqual([
      ["sparrow", 15],
      ["chevalier", 7],
    ]);
  });
  it("le combat note qui est entré (changement d'équipier compris)", () => {
    let b = startBattle("roi-salade", { level: 8, party: ["chevalier", "gerard"], ...base }, 2);
    expect(b.fought).toEqual(["sparrow"]);
    b = playTurn(b, { kind: "swap", to: 2 }).battle;
    expect(b.fought).toEqual(["sparrow", "gerard"]);
  });
  it("un nouveau compagnon arrive au niveau de Sparrow ; les anciennes sauvegardes aussi", () => {
    const s = { ...newState(0), level: 11 };
    const j = applyEffects(s, [{ kind: "join", id: "lili" }], 0).state.rpg;
    expect(j.levels!.lili).toEqual({ level: 11, xp: 0 });
    const old: Rpg = { ...emptyRpg(), party: ["chevalier", "gerard"] };
    expect(fixLevels(old, 9).levels).toEqual({ chevalier: { level: 9, xp: 0 }, gerard: { level: 9, xp: 0 } });
    // Rien n'est écrasé si le niveau existe déjà
    expect(fixLevels({ ...old, levels: { chevalier: { level: 4, xp: 3 } } }, 9).levels!.chevalier).toEqual({ level: 4, xp: 3 });
    expect(restoreRpg(JSON.parse(JSON.stringify(fixLevels(old, 9)))).levels!.gerard.level).toBe(9);
  });
});

describe("Progression V2 — techniques et évolution", () => {
  it("de nouvelles techniques remplacent les plus faibles (toujours 4)", () => {
    for (const [id, m] of Object.entries(MEMBERS)) {
      for (const l of m.learn ?? []) {
        expect(movesOf(id, [], l.lv - 1)).toContain(l.replaces);
        const after = movesOf(id, [], l.lv);
        expect(after).toContain(l.move);
        expect(after).toHaveLength(4);
      }
    }
    // La technique de l'histoire (Pluie de frites) reste en place
    expect(movesOf("sparrow", ["pluie-frites"], 25)).toEqual(["pluie-frites", "frite-volcan", "micro-sieste", "rage-ultime"]);
  });
  it("le message d'apprentissage s'affiche au bon niveau", () => {
    const r: Rpg = { ...emptyRpg(), party: ["gerard"], levels: { gerard: { level: 9, xp: 0 } } };
    expect(teamGainXp(r, xpNeed(9), ["gerard"]).ups).toContain("Gérard la Frite apprend Fleur de sel !");
  });
  it("Brokito évolue en Brokolosse au niveau 16, niveau officiel (plus fort)", () => {
    const before = makeAlly("brokito", { level: 1, gear: {}, skills: [], mons: { brokito: { level: 15 } } });
    const after = makeAlly("brokito", { level: 1, gear: {}, skills: [], mons: { brokito: { level: 16 } } });
    expect(before.name).toBe("Brokito");
    expect(after.name).toBe("Brokolosse");
    expect(after.sprite).toBe("brokolosse-dos");
    expect(after.maxHp).toBeGreaterThan(before.maxHp * 1.1);
    const r: Rpg = { ...emptyRpg(), party: ["brokito"], mons: { brokito: { level: 15, xp: 0, caught: 0 } } };
    expect(teamGainXp(r, xpNeed(15), ["brokito"]).ups).toContain("Quoi ? Brokito évolue en Brokolosse !");
  });
});

describe("Progression V2 — barème des ennemis", () => {
  it("le niveau d'un ennemi dépend de sa zone, pas de Sparrow", () => {
    for (const lv of [1, 10, 40]) {
      const b = startBattle("brokito-sauvage", { level: lv, party: [], ...base }, 5);
      expect(b.foes[0].lv).toBeGreaterThanOrEqual(FOES.brokito.lv[0]);
      expect(b.foes[0].lv).toBeLessThanOrEqual(FOES.brokito.lv[0] + 1);
    }
    // Le tutoriel garde son niveau minimal ; un boss a toujours +1
    expect(startBattle("eclaireur", { level: 30, party: [], ...base }, 9).foes[0].lv).toBe(FOES[startBattle("eclaireur", { level: 1, party: [], ...base }, 1).foes[0].id].lv[0]);
    expect(startBattle("gonflax", { level: 2, party: [], ...base }, 3).foes[0].lv).toBe(FOES.gonflax.lv[0] + 1);
  });
});
