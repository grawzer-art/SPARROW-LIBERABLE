import { describe, expect, it } from "vitest";
import { buy, equip, farmReward, isEquipped, muscuReward, newState, restore } from "@/lib/gotchi/engine";
import { MUSCLE_STAGES, TITLES, muscleStage, tierOf, titleFor } from "@/lib/gotchi/items";
import { MINIGAMES, gameForSpot } from "@/lib/gotchi/minigames";
import { MAX_FAILS, MUSCU_DUR, newMuscu, press, stepMuscu } from "@/lib/gotchi/muscu";
import { SPOTS } from "@/lib/gotchi/map";
import { sparrow, sparrowBack } from "@/components/gotchi/sprites";
import { PALETTE } from "@/components/game/sprites";

const T0 = Date.UTC(2026, 9, 17, 12);
const always = (v: number) => () => v;

describe("Rangs et évolution", () => {
  it("rangs humoristiques dans l'ordre", () => {
    expect(titleFor(1)).toBe("Stagiaire du canapé");
    expect(titleFor(3)).toBe("Rôdeur du salon");
    expect(titleFor(5)).toBe("Farmeur de Dofus");
    expect(titleFor(8)).toBe("Athlète du dimanche");
    expect(titleFor(12)).toBe("Prince de la frite");
    expect(titleFor(16)).toBe("Samouraï du sujet");
    expect(TITLES.length).toBeGreaterThanOrEqual(6);
  });
  it("stades musculaires jusqu'à SPARROW TITAN", () => {
    expect(muscleStage(0)).toBe(0);
    expect(muscleStage(95)).toBe(2);
    expect(muscleStage(9999)).toBe(4);
    expect(MUSCLE_STAGES[4][1]).toBe("SPARROW TITAN");
  });
  it("une ancienne sauvegarde n'a aucun muscle mais reste intacte", () => {
    const s = restore({ ...newState(T0), muscle: undefined, coins: 77 }, T0);
    expect(s.muscle).toBe(0);
    expect(s.coins).toBe(77);
  });
});

describe("Mini-jeu muscu", () => {
  it("appuyer dans la zone = répétition, hors zone = raté ; 3 ratés = crampe", () => {
    let m = newMuscu();
    m = { ...m, cur: m.zone };
    const ok = press(m, always(0.5));
    expect(ok.kind).toBe("parfait");
    expect(ok.m.reps).toBe(1);
    expect(ok.m.combo).toBe(1);
    let bad = { ...ok.m, cur: 0, zone: 0.9 };
    for (let i = 0; i < MAX_FAILS; i++) bad = press(bad).m;
    expect(bad.over).toBe(true);
  });
  it("le combo rétrécit la zone ; la séance se termine au chrono", () => {
    let m = newMuscu();
    for (let i = 0; i < 6; i++) m = press({ ...m, cur: m.zone }, always(0.5)).m;
    expect(m.half).toBeLessThan(newMuscu().half);
    for (let t = 0; t < MUSCU_DUR + 50; t += 33) m = stepMuscu(m, 33);
    expect(m.over).toBe(true);
    expect(m.cur).toBeGreaterThanOrEqual(0);
    expect(m.cur).toBeLessThanOrEqual(1);
  });
  it("récompense : muscle, FP, XP, évolution et missions", () => {
    const s = { ...newState(T0), muscle: 25 };
    const r = muscuReward(s, { reps: 10, perfects: 4, bestCombo: 6, crampe: false }, T0);
    expect(r.gained).toBe(12);
    expect(r.state.muscle).toBe(37);
    expect(r.stageUp).toBe("Sec");
    expect(r.state.counters.trainings).toBe(1);
    expect(r.state.counters.reps).toBe(10);
    expect(r.coins).toBeGreaterThan(0);
    expect(r.state.trophies["t-muscu-1"]).toBeDefined();
  });
});

describe("Meubles améliorables", () => {
  it("acheter un niveau l'installe et donne son bonus", () => {
    const s = { ...newState(T0), coins: 1000, level: 7 };
    expect(tierOf(s.owned, "pc")).toBe(1);
    const a = buy(s, "pc-2", T0).state;
    expect(tierOf(a.owned, "pc")).toBe(2);
    expect(isEquipped(a, "pc-2")).toBe(true);
    expect(equip(a, "pc-2")).toBe(a);
    const base = farmReward(s, { score: 800, monsters: 0, resources: 0, egg: false }, T0, always(0.99)).coins;
    const better = farmReward(a, { score: 800, monsters: 0, resources: 0, egg: false }, T0, always(0.99)).coins;
    expect(better).toBeGreaterThan(base);
    const sport = buy(s, "sport-2", T0).state;
    expect(muscuReward(sport, { reps: 10, perfects: 0, bestCombo: 0, crampe: false }, T0).gained).toBeGreaterThan(
      muscuReward(s, { reps: 10, perfects: 0, bestCombo: 0, crampe: false }, T0).gained,
    );
  });
});

describe("Registre des mini-jeux", () => {
  it("chaque mini-jeu prêt se lance depuis un objet de l'appart", () => {
    for (const g of MINIGAMES.filter((x) => x.ready)) {
      expect(SPOTS.some((s) => s.id === g.spot)).toBe(true);
      expect(gameForSpot(g.spot)?.id).toBe(g.id);
    }
  });
});

describe("Sprites console", () => {
  const ok = (rows: string[], name: string) => {
    expect(rows, name).toHaveLength(20);
    for (const r of rows) {
      expect(r.length, name).toBe(16);
      for (const c of r) if (c !== ".") expect(PALETTE[c], `${name} « ${c} »`).toBeDefined();
    }
  };
  it("vue de dos et stades musculaires valides", () => {
    for (let m = 0; m <= 4; m++) {
      ok(sparrowBack("normal", "walkA", { muscle: m, tenue: "ten-survet" }), `dos/${m}`);
      ok(sparrow("lunettes", "sourire", "normal", "stand", { muscle: m }), `face/${m}`);
    }
    ok(sparrowBack("gras", "assis"), "dos/gras");
  });
});
