import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { DEFAULT_LOOK, LOOK_KEYS, OPTIONS, PSEUDO_RE, heroDef, lookId, randomLook, validLook } from "@/lib/online/hero";
import { ChatLimiter, HEARTBEAT_MS, MAX_PER_INSTANCE, SendPolicy, Track, cleanMessage, isMove, pickInstance } from "@/lib/online/sync";
import { ONLINE_MAP, ONLINE_RPG, SPARROW_LINES, spawnTile } from "@/lib/online/world";
import { reachable, solidAt } from "@/lib/rpg/mapdef";
import { QUARTIER } from "@/lib/rpg/quartier";

describe("SPARROW ONLINE — héros", () => {
  it("toutes les combinaisons donnent un sprite complet (16 × 20)", () => {
    for (let i = 0; i < 300; i++) {
      const d = heroDef(randomLook());
      for (const dir of ["down", "up", "side"] as const) {
        expect(d.head[dir]).toHaveLength(10);
        expect(d.torso[dir]).toHaveLength(5);
        for (const row of [...d.head[dir], ...d.torso[dir]]) {
          expect(row).toHaveLength(16);
          for (const ch of row) expect(ch === "." || ch in d.pal, `couleur ${ch}`).toBe(true);
        }
      }
    }
  });
  it("chaque option change vraiment le sprite", () => {
    for (const k of LOOK_KEYS)
      for (let v = 1; v < OPTIONS[k].length; v++) {
        const a = heroDef({ ...DEFAULT_LOOK, [k]: 0 });
        const b = heroDef({ ...DEFAULT_LOOK, [k]: v });
        expect(JSON.stringify(b) !== JSON.stringify(a), `${k}=${v}`).toBe(true);
      }
    expect(lookId(DEFAULT_LOOK)).not.toBe(lookId({ ...DEFAULT_LOOK, acc: 1 }));
  });
  it("validation identique au serveur : options connues, rien en plus", () => {
    expect(validLook(DEFAULT_LOOK)).toBe(true);
    expect(validLook({ ...DEFAULT_LOOK, hair: 4 })).toBe(false);
    expect(validLook({ ...DEFAULT_LOOK, hair: 1.5 })).toBe(false);
    expect(validLook({ ...DEFAULT_LOOK, level: 99 })).toBe(false);
    const { acc: _acc, ...partial } = DEFAULT_LOOK;
    expect(validLook(partial)).toBe(false);
    // Les bornes du SQL correspondent aux options de l'éditeur
    const sql = readFileSync("supabase/migrations/20261018000000_sparrow_online.sql", "utf8");
    for (const k of LOOK_KEYS) expect(sql).toContain(`(l->>'${k}')::int between 0 and ${OPTIONS[k].length - 1}`);
    expect(PSEUDO_RE.test("Sparrow_404")).toBe(true);
    expect(PSEUDO_RE.test("ab")).toBe(false);
    expect(PSEUDO_RE.test("<script>")).toBe(false);
  });
});

describe("SPARROW ONLINE — synchronisation", () => {
  it("n'envoie qu'au changement de case ou en battement, jamais à chaque image", () => {
    const p = new SendPolicy();
    let sent = 0;
    for (let t = 0; t < 10_000; t += 16) if (p.next({ x: 5, y: 5, dir: "down" }, t)) sent++;
    expect(sent).toBe(1 + Math.floor(9984 / HEARTBEAT_MS));
    const q = new SendPolicy();
    const a = q.next({ x: 5, y: 5, dir: "down" }, 0)!;
    expect(q.next({ x: 6, y: 5, dir: "right" }, 20)).toBeNull();
    const b = q.next({ x: 6, y: 5, dir: "right" }, 80)!;
    expect(b.s).toBeGreaterThan(a.s);
    expect(isMove(b)).toBe(true);
    expect(isMove({ x: -1, y: 0, d: 0, s: 1 })).toBe(false);
    expect(isMove({ x: 1, y: 0, d: 9, s: 1 })).toBe(false);
  });
  it("interpolation : glisse case par case, rattrape le retard, ignore le désordre", () => {
    const t = new Track({ x: 5, y: 5, dir: "down" }, 0);
    t.push({ x: 6, y: 5, d: 3, s: 1 }, 0);
    t.step(0.1);
    expect(t.px).toBeGreaterThan(80);
    expect(t.px).toBeLessThan(96);
    expect(t.walking).toBe(true);
    for (let i = 0; i < 10; i++) t.step(0.05);
    expect([t.px, t.py]).toEqual([96, 80]);
    expect(t.walking).toBe(false);
    // Message plus ancien : ignoré
    t.push({ x: 2, y: 2, d: 0, s: 0 }, 0);
    expect(t.tile).toEqual({ x: 6, y: 5 });
    // Très loin (reconnexion) : replacé directement
    t.push({ x: 30, y: 20, d: 0, s: 5 }, 0);
    expect([t.px, t.py]).toEqual([480, 320]);
  });
  it("instances : 20 joueurs par salle, puis une nouvelle", () => {
    expect(pickInstance([3])).toBe(0);
    expect(pickInstance([MAX_PER_INSTANCE, 4])).toBe(1);
    expect(pickInstance([MAX_PER_INSTANCE])).toBe(1);
  });
  it("chat : nettoyage et anti-spam (mêmes règles que le serveur)", () => {
    expect(cleanMessage("  Salut \t\n le   quartier  ")).toBe("Salut le quartier");
    const l = new ChatLimiter();
    expect(l.check("   ", 0)).toMatch(/vide/);
    expect(l.check("a".repeat(201), 0)).toMatch(/200/);
    expect(l.check("salut", 0)).toBeNull();
    l.record("salut", 0);
    expect(l.check("re", 500)).toMatch(/1,5 s/);
    expect(l.check("salut", 2000)).toMatch(/déjà/);
    for (let i = 1; i < 8; i++) l.record(`m${i}`, 2000 * i);
    expect(l.check("encore", 16_500)).toMatch(/Trop/);
  });
});

describe("SPARROW ONLINE — monde partagé", () => {
  it("même décor que le jeu solo, sans les portes de l'aventure", () => {
    expect(ONLINE_MAP.ground).toBe(QUARTIER.ground);
    expect(ONLINE_MAP.warps.every((w) => w.to === null && w.text)).toBe(true);
    // Le jeu solo garde ses portes
    expect(QUARTIER.warps.some((w) => w.to === "appart")).toBe(true);
    expect(ONLINE_MAP.npcs.map((n) => n.id)).toEqual(["sparrow"]);
    expect(SPARROW_LINES.length).toBeGreaterThan(3);
  });
  it("cases d'apparition libres et accessibles, jamais sur un autre joueur", () => {
    const sp = ONLINE_MAP.npcs[0].start;
    expect(solidAt(ONLINE_MAP, sp, ONLINE_RPG)).toBe(false);
    const taken: { x: number; y: number }[] = [];
    for (let i = 0; i < 8; i++) {
      const t = spawnTile(taken, () => 0);
      expect(solidAt(ONLINE_MAP, t, ONLINE_RPG)).toBe(false);
      expect(taken.some((o) => o.x === t.x && o.y === t.y)).toBe(false);
      expect(reachable(ONLINE_MAP, ONLINE_MAP.spawn, ONLINE_RPG).has(`${t.x},${t.y}`)).toBe(true);
      taken.push(t);
    }
  });
});
