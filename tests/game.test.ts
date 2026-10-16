import { describe, expect, it } from "vitest";
import { Engine, HERO_H, KEBAB_DAYS, MAX_MASKS, PX_PER_DAY, START_DAYS } from "@/components/game/engine";

const step = (e: Engine, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 60) e.update(1 / 60);
};

function seeded(seed = 1) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

describe("L'Évasion de Sparrow — moteur", () => {
  it("démarre au premier toucher", () => {
    const e = new Engine(200, 260);
    expect(e.status).toBe("ready");
    e.jump();
    expect(e.status).toBe("running");
    expect(e.daysLeft).toBe(START_DAYS);
  });

  it("le saut retombe au sol, double saut autorisé une fois", () => {
    const e = new Engine(200, 260);
    e.start();
    e.entities = [];
    e.jump();
    expect(e.hero.onGround).toBe(false);
    step(e, 0.1);
    e.jump();
    expect(e.hero.jumps).toBe(2);
    e.jump();
    expect(e.hero.jumps).toBe(2);
    // On neutralise les obstacles pour ce test.
    for (let i = 0; i < 120; i++) {
      e.entities = [];
      e.update(1 / 60);
    }
    expect(e.hero.onGround).toBe(true);
    expect(e.hero.y).toBe(e.groundY - HERO_H);
  });

  it("le compteur baisse avec la distance et les kebabs", () => {
    const e = new Engine(200, 260);
    e.start();
    e.run = PX_PER_DAY * 100;
    e.kebabs = 2;
    expect(e.daysLeft).toBe(START_DAYS - 100 - 2 * KEBAB_DAYS);
  });

  it("un obstacle coûte un masque, trois chocs = game over", () => {
    const e = new Engine(200, 260);
    e.start();
    for (let i = 0; i < MAX_MASKS; i++) {
      e.entities = [{ id: 100 + i, kind: "calendar", x: e.heroX, y: e.groundY - 13, w: 12, h: 13, baseY: 0, t: 0 }];
      e.hero.invT = 0;
      e.update(1 / 60);
    }
    expect(e.masks).toBe(0);
    expect(e.status).toBe("over");
  });

  it("le kebab rapporte des jours", () => {
    const e = new Engine(200, 260);
    e.start();
    e.entities = [{ id: 1, kind: "kebab", x: e.heroX + 2, y: e.groundY - 12, w: 10, h: 9, baseY: 0, t: 0 }];
    e.update(1 / 60);
    expect(e.kebabs).toBe(1);
  });

  it("annonce les paliers et la victoire à 0 jour", () => {
    const e = new Engine(200, 260, seeded(3));
    e.start();
    e.run = (START_DAYS - 1501) * PX_PER_DAY;
    e.entities = [];
    step(e, 0.5);
    expect(e.drain().some((ev) => ev.type === "milestone" && ev.days === 1500)).toBe(true);
    e.run = START_DAYS * PX_PER_DAY - 1;
    e.entities = [];
    e.update(1 / 60);
    expect(e.status).toBe("won");
  });

  it("rythme identique quelle que soit la largeur d'écran", () => {
    const a = new Engine(130, 240);
    const b = new Engine(260, 240);
    a.start();
    b.start();
    for (let i = 0; i < 60; i++) {
      a.entities = [];
      b.entities = [];
      a.update(1 / 60);
      b.update(1 / 60);
    }
    expect(a.run).toBeCloseTo(b.run, 6);
  });

  it("une partie automatique tient la route (pas de NaN, entités nettoyées)", () => {
    const e = new Engine(200, 260, seeded(7));
    e.start();
    step(e, 20);
    expect(Number.isFinite(e.distance)).toBe(true);
    expect(e.entities.length).toBeLessThan(40);
  });
});
