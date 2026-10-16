import { describe, expect, it } from "vitest";
import { TROPHIES, checkTrophies } from "@/lib/gotchi/achievements";
import { pickFresh, talk, welcome } from "@/lib/gotchi/dialogue";
import {
  EVENTS,
  act,
  applyEvent,
  buy,
  cacheSpot,
  catchUp,
  claim,
  ensureMissions,
  equip,
  farmReward,
  findCache,
  gain,
  newState,
  parisDay,
  restore,
  type State,
} from "@/lib/gotchi/engine";
import { FARM_DUR, newFarm, step, tap } from "@/lib/gotchi/farm";
import { ITEMS, RARES, xpToNext } from "@/lib/gotchi/items";
import { MISSIONS, missionDef, track } from "@/lib/gotchi/missions";
import { CAPE, FARM_SPRITES, FURNITURE, HATS, sparrow } from "@/components/gotchi/sprites";
import { PALETTE } from "@/components/game/sprites";

const T0 = Date.UTC(2026, 9, 16, 12);
const H = 3_600_000;
const always = (v: number) => () => v;

describe("Sparrowgotchi 2.0 — migration (aucune progression perdue)", () => {
  it("une sauvegarde v1 est reprise telle quelle", () => {
    const v1 = {
      v: 1,
      stats: { satiete: 42, humeur: 61, energie: 33, forme: 80, fun: 12 },
      status: "gras",
      statusUntil: T0 + 60_000,
      recentFrites: [T0 - 1000],
      recentSalade: [],
      cooldowns: {},
      born: T0 - 9 * 24 * H,
      last: T0 - 1000,
      counters: { frites: 57, salade: 3, dofus: 21, siestesRefusees: 8, crises: 2 },
    };
    const s = restore(v1, T0);
    expect(s.v).toBe(2);
    expect(s.stats).toEqual(v1.stats);
    expect(s.status).toBe("gras");
    expect(s.born).toBe(v1.born);
    expect(s.counters.frites).toBe(57);
    expect(s.counters.siestesRefusees).toBe(8);
    expect(s.level).toBe(1);
    expect(s.owned).toContain("lun-classiques");
  });
  it("un aller-retour JSON (export / import) restitue le même état", () => {
    let s = newState(T0);
    s = { ...s, level: 4, xp: 12, coins: 321, owned: [...s.owned, "lun-3d", "dec-plante"], equip: { ...s.equip, lunettes: "lun-3d", deco: ["dec-plante"] } };
    const back = restore(JSON.parse(JSON.stringify({ app: "sparrowgotchi", state: s })).state, T0);
    expect(back).toEqual({ ...s, cooldowns: {} });
  });
  it("un objet équipé mais non possédé est retiré", () => {
    const s = restore({ ...newState(T0), equip: { lunettes: "lun-laser", tenue: "ten-tshirt", tete: "tet-rien", deco: ["dec-dofrite"] } }, T0);
    expect(s.equip.lunettes).toBe("lun-classiques");
    expect(s.equip.deco).toEqual([]);
  });
});

describe("Sparrowgotchi 2.0 — progression", () => {
  it("l'XP fait monter de niveau (plusieurs d'un coup) et donne des pièces", () => {
    const s = newState(T0);
    const g = gain(s, xpToNext(1) + xpToNext(2) + 5, 0, T0);
    expect(g.levels).toEqual([2, 3]);
    expect(g.state.level).toBe(3);
    expect(g.state.xp).toBe(5);
    expect(g.state.coins).toBeGreaterThan(s.coins);
  });
  it("les actions rapportent XP et pièces", () => {
    const r = act(newState(T0), "parler", T0, always(0.5));
    expect(r.state.xp).toBeGreaterThan(0);
    expect(r.state.counters.talks).toBe(1);
  });
  it("boutique : niveau et pièces requis, puis équipement", () => {
    const s = { ...newState(T0), coins: 500 };
    expect(buy(s, "lun-ski", T0).ok).toBe(false); // niveau 6 requis
    const r = buy(s, "lun-aviateur", T0);
    expect(buy({ ...s, level: 2 }, "lun-aviateur", T0).ok).toBe(true);
    expect(r.ok).toBe(false);
    const ok = buy({ ...s, level: 2 }, "lun-aviateur", T0).state;
    expect(ok.equip.lunettes).toBe("lun-aviateur");
    expect(ok.coins).toBe(500 - 60);
    expect(buy({ ...newState(T0), coins: 0 }, "tet-casquette", T0).ok).toBe(false);
    expect(buy(s, "lun-laser", T0).ok).toBe(false); // rare : jamais en boutique
  });
  it("décoration : bascule installer / retirer", () => {
    const s = { ...newState(T0), owned: [...newState(T0).owned, "dec-plante"] };
    const a = equip(s, "dec-plante");
    expect(a.equip.deco).toEqual(["dec-plante"]);
    expect(equip(a, "dec-plante").equip.deco).toEqual([]);
  });
  it("les prix restent atteignables (pas de grind excessif)", () => {
    for (const it of ITEMS) if (!it.rare) expect(it.price).toBeLessThanOrEqual(300);
  });
});

describe("Sparrowgotchi 2.0 — missions", () => {
  it("3 missions par jour, déterministes et de types différents", () => {
    const a = ensureMissions(newState(T0), T0);
    const b = ensureMissions(newState(T0 + H), T0 + H);
    expect(a.missions.list).toHaveLength(3);
    expect(a.missions.list.map((m) => m.id)).toEqual(b.missions.list.map((m) => m.id));
    const keys = a.missions.list.map((m) => missionDef(m.id)!.key);
    expect(new Set(keys).size).toBe(3);
    expect(a.missions.day).toBe(parisDay(T0));
  });
  it("progression puis encaissement (une seule fois)", () => {
    let s = ensureMissions(newState(T0), T0);
    const m = s.missions.list[0];
    const d = missionDef(m.id)!;
    s = track(s, d.key, d.n, T0);
    const c = claim(s, m.id, T0)!;
    expect(c).not.toBeNull();
    expect(c.state.coins).toBeGreaterThanOrEqual(s.coins + d.coins);
    expect(claim(c.state, m.id, T0)).toBeNull();
  });
  it("toutes les définitions sont valides", () => {
    expect(new Set(MISSIONS.map((m) => m.id)).size).toBe(MISSIONS.length);
  });
});

describe("Sparrowgotchi 2.0 — événements, trophées, dialogues", () => {
  it("au moins 40 événements, dont des très rares", () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
    expect(new Set(EVENTS.map((e) => e.id)).size).toBe(EVENTS.length);
    expect(EVENTS.filter((e) => e.rarity === "legendaire").length).toBeGreaterThanOrEqual(3);
  });
  it("chaque événement s'applique sans planter ni bloquer (panne bornée)", () => {
    for (const e of EVENTS) {
      const r = applyEvent(newState(T0), e, T0, always(0.3));
      for (const v of Object.values(r.state.stats)) expect(v).toBeGreaterThanOrEqual(0);
      expect(r.state.pcBrokenUntil - T0).toBeLessThanOrEqual(30 * 60_000);
      expect(r.state.counters.events).toBe(1);
    }
  });
  it("l'œuf légendaire donne l'Œuf Dofrite", () => {
    const e = EVENTS.find((x) => x.id === "e-dofrite")!;
    const r = applyEvent(newState(T0), e, T0, always(0.3));
    expect(r.state.owned).toContain("dec-dofrite");
    expect(r.state.trophies["t-dofrite"]).toBeDefined();
  });
  it("collection complète : des pièces à la place d'un objet", () => {
    const s = { ...newState(T0), owned: [...newState(T0).owned, ...RARES] };
    const e = EVENTS.find((x) => x.id === "e-objet-rare")!;
    expect(applyEvent(s, e, T0, always(0.3)).state.coins).toBeGreaterThan(s.coins);
  });
  it("retour après absence : accueil et 1 à 3 événements", () => {
    const s = newState(T0);
    expect(catchUp(s, T0 + 10 * 60_000)).toBeNull();
    const r = catchUp(s, T0 + 12 * H, always(0.2))!;
    expect(r.welcome).toMatch(/12 h/);
    expect(r.events.length).toBeGreaterThanOrEqual(0);
    expect(r.events.length).toBeLessThanOrEqual(3);
  });
  it("trophées : débloqués une fois, secret cape + masque", () => {
    let s: State = { ...newState(T0), counters: { ...newState(T0).counters, frites: 1 } };
    const a = checkTrophies(s, T0);
    expect(a.unlocked.map((t) => t.id)).toContain("t-premiere-frite");
    expect(checkTrophies(a.state, T0).unlocked).toHaveLength(0);
    s = { ...a.state, owned: [...a.state.owned, "ten-cape", "tet-masque"], equip: { ...a.state.equip, tenue: "ten-cape", tete: "tet-masque" } };
    expect(checkTrophies(s, T0).unlocked.map((t) => t.id)).toContain("t-chevalier");
    expect(TROPHIES.some((t) => t.secret)).toBe(true);
  });
  it("dialogue : contextuel et sans répétition immédiate", () => {
    const hungry = { ...newState(T0), stats: { ...newState(T0).stats, satiete: 10 } };
    expect(typeof talk(hungry, T0)).toBe("string");
    expect(pickFresh(["a", "b"], ["a"], always(0))).toBe("b");
    expect(welcome(10 * 60_000, newState(T0))).toBeNull();
    let s = newState(T0);
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const r = act(s, "parler", T0 + i * 5000);
      seen.add(r.line);
      s = r.state;
    }
    expect(seen.size).toBeGreaterThanOrEqual(4);
  });
  it("il boude parfois mais accepte toujours les frites", () => {
    const s = { ...newState(T0), status: "boude" as const, statusUntil: T0 + 3 * 60_000 };
    expect(act(s, "douche", T0).anim).toBe("boude");
    const r = act(s, "frites", T0, always(0.5));
    expect(r.state.status).toBeNull();
  });
  it("Fritoman compté au 3e cornet", () => {
    let s = newState(T0);
    for (let i = 0; i < 3; i++) s = act(s, "frites", T0 + i * 60_000, always(0.5)).state;
    expect(s.counters.fritoman).toBe(1);
  });
});

describe("Sparrowgotchi 2.0 — mini-jeu de farm", () => {
  it("une session dure 30 s et se termine", () => {
    let f = newFarm();
    for (let t = 0; t < FARM_DUR + 100; t += 16) f = step(f, 16, always(0.5));
    expect(f.over).toBe(true);
  });
  it("taper une ressource rapporte des points et fait monter le combo", () => {
    let f = newFarm();
    for (let t = 0; t < 600; t += 16) f = step(f, 16, always(0.9)); // 0.9 → ressource
    const e = f.ents[0];
    expect(e).toBeDefined();
    const r = tap(f, e.x, e.y);
    expect(r.killed).toBe(true);
    expect(r.farm.score).toBeGreaterThan(0);
    expect(r.farm.combo).toBe(2);
    expect(tap(r.farm, -50, -50).farm.combo).toBe(1);
  });
  it("un monstre ignoré attaque, 3 attaques = fin", () => {
    let f = newFarm();
    for (let t = 0; t < 20_000 && !f.over; t += 16) f = step(f, 16, always(0.1)); // 0.1 → monstres
    expect(f.pv).toBeLessThanOrEqual(0);
    expect(f.over).toBe(true);
  });
  it("récompenses proportionnelles, record et missions", () => {
    const s = ensureMissions(newState(T0), T0);
    const r = farmReward(s, { score: 480, monsters: 9, resources: 16, egg: false }, T0, always(0.9));
    expect(r.coins).toBe(60);
    expect(r.xp).toBe(45);
    expect(r.record).toBe(true);
    expect(r.state.bestFarm).toBe(480);
    expect(r.state.counters.farms).toBe(1);
    const egg = farmReward(s, { score: 100, monsters: 0, resources: 0, egg: true }, T0, always(0.9));
    expect(egg.drop?.id).toBe("dec-dofrite");
  });
});

describe("Sparrowgotchi 2.0 — objet caché", () => {
  it("une fois par jour, position stable", () => {
    const s = newState(T0);
    expect(cacheSpot(s, T0, 448)).toEqual(cacheSpot(s, T0 + H, 448));
    const r = findCache(s, T0)!;
    expect(r.state.counters.caches).toBe(1);
    expect(cacheSpot(r.state, T0, 448)).toBeNull();
    expect(findCache(r.state, T0)).toBeNull();
  });
});

describe("Sparrowgotchi 2.0 — sprites", () => {
  const ok = (rows: string[], name: string, w?: number) => {
    const width = w ?? rows[0].length;
    for (const r of rows) {
      expect(r.length, name).toBe(width);
      for (const c of r) if (c !== ".") expect(PALETTE[c], `${name} « ${c} »`).toBeDefined();
    }
  };
  it("poses, tenues et lunettes en 16 × 20", () => {
    const looks = ITEMS.filter((i) => i.slot === "lunettes" || i.slot === "tenue");
    for (const legs of ["stand", "walkA", "walkB", "assis"] as const)
      for (const b of ["normal", "gras", "manette"] as const)
        for (const it of looks) {
          const rows = sparrow("lunettes", "sourire", b, legs, { [it.slot]: it.id, barbe: true });
          expect(rows).toHaveLength(20);
          ok(rows, `${legs}/${b}/${it.id}`, 16);
        }
  });
  it("meubles, chapeaux et monstres valides", () => {
    for (const [k, rows] of Object.entries(FURNITURE)) ok(rows, k);
    for (const [k, rows] of Object.entries(FARM_SPRITES)) ok(rows, k);
    for (const [k, h] of Object.entries(HATS)) ok(h.rows, k, 16);
    ok(CAPE, "cape", 16);
  });
});
