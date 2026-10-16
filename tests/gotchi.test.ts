import { describe, expect, it } from "vitest";
import {
  COOLDOWN,
  FLOOR,
  MAX_CATCHUP,
  act,
  mood,
  newState,
  randomEvent,
  restore,
  tick,
} from "@/lib/gotchi/engine";
import { LINES } from "@/lib/gotchi/lines";

const T0 = Date.UTC(2026, 9, 16, 12);
const H = 3_600_000;
const always = (v: number) => () => v;

describe("Sparrowgotchi — temps", () => {
  it("les jauges baissent avec le temps", () => {
    const s = tick(newState(T0), T0 + 2 * H);
    expect(s.stats.satiete).toBeCloseTo(70 - 12, 5);
    expect(s.stats.fun).toBeCloseTo(55 - 9, 5);
  });
  it("rattrapage plafonné et jamais sous le plancher (Sparrow ne meurt pas)", () => {
    const s = tick(newState(T0), T0 + 30 * 24 * H);
    for (const v of Object.values(s.stats)) expect(v).toBeGreaterThanOrEqual(FLOOR - 1e-9);
    const a = tick(newState(T0), T0 + MAX_CATCHUP);
    const b = tick(newState(T0), T0 + MAX_CATCHUP * 3);
    expect(a.stats).toEqual(b.stats);
  });
  it("une nuit d'absence ne met pas Sparrow en crise", () => {
    const s = tick(newState(T0), T0 + 10 * H);
    expect(mood(s, T0 + 10 * H)).not.toBe("crise");
  });
  it("une horloge qui recule ne casse rien", () => {
    const s = newState(T0);
    expect(tick(s, T0 - H)).toEqual(s);
  });
});

describe("Sparrowgotchi — actions", () => {
  it("les frites nourrissent et font plaisir", () => {
    const s = { ...newState(T0), stats: { ...newState(T0).stats, satiete: 30, humeur: 40 } };
    const r = act(s, "frites", T0, always(0.5));
    expect(r.state.stats.satiete).toBe(60);
    expect(r.state.stats.humeur).toBe(52);
    expect(LINES.frites).toContain(r.line);
  });
  it("trois portions de frites rapprochées = état gras", () => {
    let s = newState(T0);
    for (let i = 0; i < 3; i++) s = act(s, "frites", T0 + i * 60_000, always(0.5)).state;
    expect(s.status).toBe("gras");
    expect(mood(s, T0 + 3 * 60_000)).toBe("gras");
    expect(mood(s, T0 + 3 * H)).not.toBe("gras");
  });
  it("la salade passe une fois, puis il la refuse", () => {
    let r = act(newState(T0), "salade", T0, always(0.9));
    expect(r.anim).toBe("grimace");
    expect(r.delta.forme).toBe(12);
    r = act(r.state, "salade", T0 + 60_000, always(0.9));
    expect(r.anim).toBe("refus");
    expect(LINES.saladeRefus).toContain(r.line);
  });
  it("Dofus : humeur et fun montent, l'énergie baisse", () => {
    const r = act(newState(T0), "dofus", T0, always(0.9));
    expect(r.delta.fun).toBeGreaterThan(0);
    expect(r.delta.energie).toBeLessThan(0);
  });
  it("Dofus peut provoquer une rage ou un ultra focus", () => {
    expect(act(newState(T0), "dofus", T0, always(0.1)).state.status).toBe("rage");
    const f = act(newState(T0), "dofus", T0, always(0.5)).state;
    expect(f.status).toBe("focus");
    expect(act(f, "douche", T0 + 1000).anim).toBe("refus");
  });
  it("il refuse la sieste quand il est en forme", () => {
    const fresh = { ...newState(T0), stats: { ...newState(T0).stats, energie: 85 } };
    const r = act(fresh, "sieste", T0, always(0.9));
    expect(r.anim).toBe("refus");
    expect(r.state.counters.siestesRefusees).toBe(1);
    const tired = { ...newState(T0), stats: { ...newState(T0).stats, energie: 20 } };
    expect(act(tired, "sieste", T0, always(0.9)).delta.energie).toBe(28);
  });
  it("cooldown posé après une action", () => {
    const r = act(newState(T0), "douche", T0);
    expect(r.state.cooldowns.douche).toBe(T0 + COOLDOWN.douche);
  });
});

describe("Sparrowgotchi — événements et sauvegarde", () => {
  it("crise quand tout est au plus bas", () => {
    const s = { ...newState(T0), stats: { satiete: 5, humeur: 5, energie: 5, forme: 5, fun: 5 } };
    expect(randomEvent(s, T0, always(0.9))?.anim).toBe("crise");
  });
  it("réclame des frites quand il a faim", () => {
    const s = { ...newState(T0), stats: { ...newState(T0).stats, satiete: 20 } };
    expect(LINES.reclameFrites).toContain(randomEvent(s, T0, always(0.4))?.line);
  });
  it("restaure un état abîmé sans planter", () => {
    const s = restore({ stats: { satiete: "x", humeur: 500 }, status: "nimporte", last: 1e20 }, T0);
    expect(s.stats.satiete).toBe(70);
    expect(s.stats.humeur).toBe(100);
    expect(s.status).toBeNull();
    expect(s.last).toBe(T0);
    expect(restore(null, T0).stats.satiete).toBe(70);
  });
});

import { PROPS, sparrow } from "@/components/gotchi/sprites";
import { PALETTE } from "@/components/game/sprites";

describe("Sparrowgotchi — sprites", () => {
  it("toutes les variantes font 16 × 20 et n'utilisent que des couleurs connues", () => {
    for (const e of ["lunettes", "fermes", "rage", "focus", "triste", "grands"] as const)
      for (const m of ["sourire", "neutre", "triste", "ouverte", "mache"] as const)
        for (const b of ["normal", "gras", "manette"] as const) {
          const rows = sparrow(e, m, b);
          expect(rows).toHaveLength(20);
          for (const r of rows) {
            expect(r).toHaveLength(16);
            for (const c of r) if (c !== ".") expect(PALETTE[c], `${e}/${m}/${b} « ${c} »`).toBeDefined();
          }
        }
    for (const [k, rows] of Object.entries(PROPS)) {
      const w = rows[0].length;
      for (const r of rows) {
        expect(r.length, k).toBe(w);
        for (const c of r) if (c !== ".") expect(PALETTE[c], `${k} « ${c} »`).toBeDefined();
      }
    }
  });
});
