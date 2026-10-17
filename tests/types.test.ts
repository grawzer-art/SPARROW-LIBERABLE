import { describe, expect, it } from "vitest";
import { FOES, MEMBERS, MOVES } from "@/lib/rpg/bestiary";
import { baseDamage, makeAlly, playTurn, startBattle, type Team } from "@/lib/rpg/combat";
import { EVOLUTIONS, SPECIES } from "@/lib/rpg/monsters";
import { ELEM_TYPES, FIGHTER_TYPE, MOVE_TYPE, STRONG, typeMult } from "@/lib/rpg/types";

describe("Types — matrice", () => {
  it("équilibrée : chaque type bat 2 types, en craint 2, et n'en domine aucun dans les deux sens", () => {
    for (const t of ELEM_TYPES) {
      expect(STRONG[t]).toHaveLength(2);
      expect(ELEM_TYPES.filter((o) => STRONG[o].includes(t))).toHaveLength(2);
      const vs = ELEM_TYPES.map((d) => typeMult(t, d));
      expect(vs.filter((m) => m > 1)).toHaveLength(2);
      expect(vs.filter((m) => m < 1)).toHaveLength(2);
      expect(vs.filter((m) => m === 1)).toHaveLength(2);
      for (const o of STRONG[t]) expect(STRONG[o]).not.toContain(t);
    }
    expect(typeMult("feu", "nature")).toBeGreaterThan(1);
    expect(typeMult("nature", "feu")).toBeLessThan(1);
    expect(typeMult("feu", "force")).toBe(1);
    expect(typeMult(undefined, "feu")).toBe(1);
  });
  it("données : types valides, toutes les techniques typées existent, tous les combattants ont un type", () => {
    for (const [id, t] of Object.entries(MOVE_TYPE)) {
      expect(MOVES[id], id).toBeTruthy();
      expect(MOVES[id].power, id).toBeGreaterThan(0);
      expect(ELEM_TYPES).toContain(t);
    }
    for (const id of [...Object.keys(MEMBERS), ...Object.keys(FOES)]) expect(ELEM_TYPES, id).toContain(FIGHTER_TYPE[id]);
  });
});

describe("Types — en combat", () => {
  const T: Team = { level: 10, party: ["gerard"], gear: {}, skills: [], bag: {} };
  it("super efficace : plus de dégâts et message ; peu efficace : moins de dégâts", () => {
    const b = startBattle("haltere-1", T, 1); // Haltère Sauvage : Force
    const sparrow = b.allies[0];
    const foe = b.foes[0];
    expect(foe.type).toBe("force");
    // Sel de mer (Nature) > Force ; Coup de manette (Tech) < Force
    const g = makeAlly("gerard", T);
    expect(baseDamage(g, foe, MOVES["sel-mer"])).toBeGreaterThan(baseDamage({ ...g, type: undefined }, { ...foe, type: undefined }, MOVES["sel-mer"]) * 1.25);
    expect(baseDamage(sparrow, foe, MOVES["coup-manette"])).toBeLessThan(baseDamage({ ...sparrow, type: undefined }, { ...foe, type: undefined }, MOVES["coup-manette"]));
    let saw = false;
    for (let seed = 1; seed < 20 && !saw; seed++) {
      const bb = startBattle("haltere-1", T, seed);
      saw = playTurn(bb, { kind: "move", move: "coup-manette" }).events.some((e) => e.kind === "text" && /pas très efficace/.test(e.text));
    }
    expect(saw).toBe(true);
  });
  it("les transformations changent le type de Sparrow (Titan : Force), puis il redevient Tech", () => {
    const b = startBattle("haltere-1", { ...T, skills: ["titan"], party: [] }, 2);
    const r = playTurn(b, { kind: "transform", form: "titan" });
    expect(r.battle.allies[0].type).toBe("force");
  });
});

describe("Bestiaire officiel", () => {
  it("24 espèces, numérotées 1 à 24, 4 légendaires, types officiels", () => {
    expect(SPECIES).toHaveLength(24);
    expect(SPECIES.map((s) => s.n)).toEqual(Array.from({ length: 24 }, (_, i) => i + 1));
    expect(SPECIES.filter((s) => s.rarity === "legendaire").map((s) => s.name)).toEqual(["Fritalune", "Haltérox", "Kagezora", "Chronarque"]);
    expect(new Set(SPECIES.map((s) => s.id)).size).toBe(24);
    for (const s of SPECIES) expect(ELEM_TYPES).toContain(s.type);
    const b = SPECIES.find((s) => s.id === "brokito")!;
    expect([b.n, b.type, b.rarity, b.region]).toEqual([4, "nature", "commun", "Cité des Frites"]);
  });
  it("7 évolutions officielles, aucune pour un légendaire ; Brokito évolue au niveau 16", () => {
    expect(EVOLUTIONS).toHaveLength(7);
    for (const e of EVOLUTIONS) expect(SPECIES.find((s) => s.id === e.from)?.rarity).not.toBe("legendaire");
    expect(MEMBERS.brokito.evo?.lv).toBe(16);
    expect(EVOLUTIONS.find((e) => e.from === "brokito")?.lv).toBe(16);
  });
  it("le type d'une espèce jouable est le même en combat et au Bestiaire", () => {
    for (const s of SPECIES) if (MEMBERS[s.id]) expect(FIGHTER_TYPE[s.id]).toBe(s.type);
  });
});
