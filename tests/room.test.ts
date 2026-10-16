import { describe, expect, it } from "vitest";
import { OBJECTS, START, R, canStand, move, nearby, nearestStandable, objectAt, path, restorePos } from "@/lib/gotchi/room";

describe("Sparrowgotchi 3.0 — déplacements", () => {
  it("le point de départ et tous les points d'utilisation sont accessibles", () => {
    expect(canStand(START.x, START.y)).toBe(true);
    for (const o of OBJECTS) expect(canStand(o.stand.x, o.stand.y), o.id).toBe(true);
  });
  it("les meubles bloquent, avec glissement le long de l'obstacle", () => {
    // Juste devant le bureau : monter est bloqué, glisser à droite reste possible.
    const p = { x: R(1, 56), y: 53 };
    const up = move(p, 0, -3);
    expect(up.blocked).toBe(true);
    expect(up.pos).toEqual(p);
    const diag = move(p, 2, -3);
    expect(diag.blocked).toBe(true);
    expect(diag.pos).toEqual({ x: p.x + 2, y: 53 });
    expect(move(p, 0, 3)).toEqual({ pos: { x: p.x, y: 56 }, blocked: false });
  });
  it("au joystick, il contourne les coins au lieu de rester coincé", () => {
    let p = START;
    for (let i = 0; i < 400; i++) p = move(p, -0.73, -0.08).pos;
    expect(p.x).toBeLessThan(R(1, 40)); // salon → coin gaming, malgré canapé, lampadaire et bureau
  });
  it("on ne sort pas de l'appartement", () => {
    expect(canStand(1, 55)).toBe(false);
    expect(canStand(R(2, 60), 30)).toBe(false);
    expect(canStand(R(2, 60), 80)).toBe(false);
  });
  it("chaque objet est atteignable depuis n'importe quel autre", () => {
    for (const a of OBJECTS)
      for (const b of OBJECTS) {
        let cur = a.stand;
        for (const wp of path(cur, b.stand)) {
          const n = Math.ceil(Math.hypot(wp.x - cur.x, wp.y - cur.y));
          for (let i = 1; i <= n; i++) {
            const x = cur.x + ((wp.x - cur.x) * i) / n;
            const y = cur.y + ((wp.y - cur.y) * i) / n;
            expect(canStand(x, y), `${a.id} → ${b.id} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
          }
          cur = wp;
        }
        expect(cur).toEqual(b.stand);
      }
  });
  it("objet à portée et objet touché", () => {
    const pc = OBJECTS.find((o) => o.id === "pc")!;
    expect(nearby(pc.stand)?.id).toBe("pc");
    expect(nearby({ x: R(2, 64), y: 58 })).toBeNull();
    expect(objectAt(R(1, 56), 40)?.id).toBe("pc");
  });
  it("un point inaccessible est ramené au plus proche", () => {
    const p = nearestStandable({ x: R(1, 56), y: 44 });
    expect(canStand(p.x, p.y)).toBe(true);
  });
  it("position sauvegardée validée", () => {
    expect(restorePos({ x: R(1, 56), y: 45 })).toEqual(START);
    expect(restorePos("n'importe quoi")).toEqual(START);
    expect(restorePos({ x: R(3, 30), y: 58 })).toEqual({ x: R(3, 30), y: 58 });
  });
});
