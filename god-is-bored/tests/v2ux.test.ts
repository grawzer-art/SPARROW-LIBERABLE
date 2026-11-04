import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { PlanetSim } from "../src/sim/PlanetSim";
import { POWERS, POWER_BY_ID } from "../src/sim/DivinePowerSystem";
import { jobOf, moodOf } from "../src/ui/UI";
import { T } from "../src/sim/World";

const young = (e: SimulationEngine) => e.citizens.find((c) => !c.dead && c.age > 16)!;

describe("Pouvoirs V2", () => {
  it("les pouvoirs existants sont conservés et Incendie s'ajoute", () => {
    const ids = POWERS.map((p) => p.id);
    for (const id of ["lightning", "meteor", "rain", "plague", "bless", "wrath", "prophecy"]) expect(ids).toContain(id);
    expect(ids).toContain("fire");
    expect(POWER_BY_ID.fire.target).toBe("area");
  });
  it("Incendie embrase réellement les arbres/toits et enregistre l'événement dans les Chroniques", () => {
    const e = SimulationEngine.create(42);
    e.runYears(2);
    let spot: { x: number; y: number } | null = null;
    for (let i = 0; i < e.world.size * e.world.size && !spot; i++) if (e.world.trees[i] > 1 && e.world.type[i] !== T.WATER) spot = { x: (i % e.world.size) + 0.5, y: Math.floor(i / e.world.size) + 0.5 };
    expect(spot).toBeTruthy();
    const n0 = e.chronicle.length;
    const r = e.divine.cast(e, "fire", spot!.x, spot!.y);
    expect(r.ok).toBe(true);
    let fires = 0; for (const f of e.world.fire) if (f > 0) fires++;
    expect(fires).toBeGreaterThan(0);
    expect(e.chronicle.length).toBeGreaterThan(n0);
    expect(e.divine.cast(e, "fire", spot!.x, spot!.y).ok).toBe(false); // repos divin
  });
  it("Incendie sur de l'eau ou du sol nu ne fait rien (pas de repos consommé)", () => {
    const e = SimulationEngine.create(42);
    let w = -1; for (let i = 0; i < e.world.size * e.world.size; i++) if (e.world.type[i] === T.WATER) { w = i; break; }
    const r = e.divine.cast(e, "fire", (w % e.world.size) + 0.5, Math.floor(w / e.world.size) + 0.5);
    expect(r.ok).toBe(false);
    expect(e.divine.cooldownLeft(e, "fire")).toBe(0);
  });
});

describe("Influence sur un habitant", () => {
  it("bénir : santé et moral augmentent ; guérir : la maladie disparaît", () => {
    const e = SimulationEngine.create(42); e.runYears(3);
    const c = young(e); c.hp = 30; c.sick = 50; c.hunger = 90;
    expect(e.divine.influence(e, c.id, "bless").ok).toBe(true);
    expect(c.hp).toBe(100); expect(c.hunger).toBeLessThanOrEqual(15);
    c.sick = 40;
    expect(e.divine.influence(e, c.id, "heal").ok).toBe(true);
    expect(c.sick).toBe(0);
  });
  it("inspirer augmente intelligence et courage (bornés) ; foudroyer tue et reste coûteux", () => {
    const e = SimulationEngine.create(42); e.runYears(3);
    const c = young(e); const i0 = c.intel;
    e.divine.influence(e, c.id, "inspire");
    expect(c.intel).toBeGreaterThanOrEqual(i0); expect(c.intel).toBeLessThanOrEqual(1);
    const d = young(e), id = d.id, pop = e.citizens.length;
    expect(e.divine.influence(e, id, "smite").ok).toBe(true);
    expect(e.citizenById.get(id)).toBeUndefined();
    expect(e.citizens.length).toBe(pop - 1);
    expect(e.divine.influence(e, young(e).id, "smite").ok).toBe(false); // repos
  });
  it("les cooldowns d'influence survivent à la sauvegarde", () => {
    const ps = PlanetSim.create(42); const e = ps.active; e.runYears(2);
    e.divine.influence(e, young(e).id, "bless");
    const back = PlanetSim.deserialize(ps.serialize()).active;
    expect(back.cooldowns["inf_bless"]).toBe(e.cooldowns["inf_bless"]);
  });
});

describe("Carte habitant", () => {
  it("humeur et métier sont déduits de l'état réel, accordés au genre", () => {
    const e = SimulationEngine.create(42); e.runYears(3);
    const c = young(e); c.female = true; c.sick = 0; c.hunger = 90;
    expect(moodOf(c)).toBe("Affamée");
    c.female = false;
    expect(moodOf(c)).toBe("Affamé");
    c.hunger = 0; c.sick = 20;
    expect(moodOf(c)).toBe("Malade");
    c.job = "farmer"; c.female = true;
    expect(jobOf(c)).toBe("Fermière");
  });
});
