import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { BATTLES } from "@/lib/rpg/bestiary";
import { CH4_MAPS, LAMPIONS, metronomeVaincu } from "@/lib/rpg/kyukei";
import { npcsOf, reachable, solidAt, step, type Facing, type MapDef, type Tile } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { afterBattle, afterMinigame, arrival, chapterCard, examine, openingCard, scene, talkTo, type Conversation } from "@/lib/rpg/script";

const T0 = Date.UTC(2026, 9, 17, 22);
const key = (t: Tile) => `${t.x},${t.y}`;
const around = (t: Tile) => (["up", "down", "left", "right"] as Facing[]).map((d) => step(t, d));
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

const ch3Done: Rpg = {
  ...emptyRpg(),
  quests: { "ville-figee": "terminee", "frites-perdues": "terminee", confrerie: "terminee" },
  items: ["fragment-1", "fragment-2", "fragment-3", "liste-cadran"],
  flags: ["ko:roi-salade", "ko:gonflax"],
  party: ["chevalier", "gerard", "lili"],
  skills: ["pluie-frites", "titan"],
};
const open: Rpg = { ...ch3Done, flags: [...ch3Done.flags, "ko:metronome", "ko:sbire", "ko:lanterne", "ko:sbires", "ko:tambour"] };

function walk(m: MapDef, r: Rpg, from: Tile = m.spawn) {
  const occ = new Set(npcsOf(m, r).filter((n) => !n.path).map((n) => key(n.start)));
  const seen = new Set([key(from)]);
  const q = [from];
  while (q.length) {
    const c = q.shift()!;
    for (const n of around(c)) {
      const k = key(n);
      if (seen.has(k) || solidAt(m, n, r) || occ.has(k)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return seen;
}

describe("Chapitre 4 — cartes", () => {
  it("chaque porte mène à une case libre", () => {
    for (const m of [...CH4_MAPS, mapOf("temple-cour")!])
      for (const w of m.warps) {
        const to = w.to;
        if (!to || to === "appart") continue;
        const d = mapOf(to.map)!;
        expect(d, w.id).toBeTruthy();
        expect(solidAt(d, to, open), `${m.id}/${w.id} → ${to.map} ${key(to)}`).toBe(false);
      }
  });
  it("tout est atteignable quand tout est ouvert", () => {
    for (const m of CH4_MAPS) {
      const r = reachable(m, m.spawn, open);
      for (const w of m.warps) expect(r.has(key(step(w.at, back[w.dir ?? "up"]))) || r.has(key(w.at)), `${m.id}/${w.id}`).toBe(true);
      const counter = (t: Tile) => m.props.some((p) => (p.kind === "comptoir" || p.kind === "platines") && t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h);
      for (const n of m.npcs) expect(around(n.start).some((t) => r.has(key(t)) || (counter(t) && around(t).some((u) => r.has(key(u))))), `${m.id}/${n.id}`).toBe(true);
      for (const p of m.props.filter((p) => p.key)) {
        const tiles: Tile[] = [];
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) tiles.push({ x, y });
        expect(tiles.some((t) => around(t).some((a) => r.has(key(a)))), `${m.id}/${p.key}`).toBe(true);
      }
    }
  });
  it("le chemin est accessible au départ, sans avoir à battre les ennemis", () => {
    const m = mapOf("cerisiers")!;
    const w = walk(m, ch3Done);
    expect(w.has("34,9") || w.has("34,10")).toBe(true);
    const v = walk(mapOf("village")!, ch3Done);
    for (const t of ["5,8", "16,10", "7,16"]) expect(v.has(t), t).toBe(true);
  });
  it("la sortie est du temple n'ouvre qu'après le chapitre 3, le dojo qu'après le Métronome", () => {
    const est = mapOf("temple-cour")!.warps.find((x) => x.id === "est-1")!;
    expect(est.needs!({ ...ch3Done, quests: { confrerie: "active" } })).toBe(false);
    expect(est.needs!(ch3Done)).toBe(true);
    const dojo = mapOf("village")!.warps.find((x) => x.id === "dojo")!;
    expect(dojo.needs!(ch3Done)).toBe(false);
    expect(dojo.needs!(open)).toBe(true);
    expect(metronomeVaincu(open)).toBe(true);
    expect(examine("porte-est", ch3Done, undefined, "temple-cour").lines.length).toBeGreaterThan(0);
    expect(examine("porte-dojo", ch3Done, undefined, "village").lines[0].text).toMatch(/dojo/);
    expect(openingCard("cerisiers", ch3Done)?.[0]).toMatch(/CHAPITRE 4/);
  });
  it("les combats du chapitre existent", () => {
    for (const id of ["sbire-1", "sbires-2", "tambour-1", "lanterne-1", "metronome", "katsu"]) expect(BATTLES[id], id).toBeTruthy();
  });
});

function play(s: State, c: Conversation | null, pick = 0): { s: State; then?: Conversation["then"] } {
  if (!c) return { s };
  const st = applyEffects(s, c.effects ?? [], T0).state;
  if (c.choices?.length) return play(st, c.choices[Math.min(pick, c.choices.length - 1)].next);
  return { s: st, then: c.then };
}
function win(s: State, battle: string, defeated?: string): State {
  let st = applyEffects(s, [...(defeated ? [{ kind: "flag" as const, id: defeated }] : []), { kind: "flag" as const, id: `ko:${battle}` }, { kind: "reward" as const, xp: BATTLES[battle].xp, coins: BATTLES[battle].fp }], T0).state;
  const a = afterBattle(battle, st.rpg);
  if (a) {
    const r = play(st, a);
    st = r.s;
    if (r.then?.kind === "scene") st = play(st, scene(r.then.id)).s;
  }
  return st;
}

describe("Chapitre 4 — partie complète (sans interface)", () => {
  it("des cerisiers jusqu'à Maître Katsu, avec Pokeyz et les lampions", () => {
    let s: State = { ...newState(T0), level: 11, rpg: ch3Done };
    s = play(s, arrival("cerisiers", s.rpg, true)).s;
    expect(status(s.rpg, "samourai")).toBe("active");
    s = play(s, talkTo("pelerin", s.rpg, "cerisiers")).s;
    expect(play(s, talkTo("sbire", s.rpg, "cerisiers")).then).toEqual({ kind: "battle", id: "sbire-1" });
    s = win(s, "sbire-1", "ko:sbire");
    s = play(s, arrival("village", s.rpg, true)).s;
    // Le Métronome provoque mais ne se bat pas tant que le mix n'est pas fait
    expect(play(s, talkTo("metronome", s.rpg, "village")).then).toBeUndefined();
    s = play(s, talkTo("pokeyz", s.rpg, "village")).s;
    expect(s.rpg.done).toContain("samourai:pokeyz");
    // Les vinyles, dans le désordre
    const se = play(s, talkTo("sencha", s.rpg, "auberge"));
    expect(se.then).toEqual({ kind: "shop", id: "auberge" });
    s = se.s;
    s = win(s, "tambour-1", "ko:tambour");
    expect(s.rpg.done).not.toContain("samourai:vinyles");
    expect(play(s, talkTo("sbires-2", s.rpg, "village")).then).toEqual({ kind: "battle", id: "sbires-2" });
    s = win(s, "sbires-2", "ko:sbires");
    expect(s.rpg.items).toEqual(expect.arrayContaining(["vinyle-1", "vinyle-2", "vinyle-3"]));
    expect(s.rpg.done).toContain("samourai:vinyles");
    // Le mix
    const mx = play(s, talkTo("pokeyz", s.rpg, "village"));
    expect(mx.then).toEqual({ kind: "minigame", id: "rythme" });
    expect(play(s, examine("platines", s.rpg, undefined, "village")).then).toEqual({ kind: "minigame", id: "rythme" });
    s = play(s, afterMinigame("rythme", false, s.rpg)).s;
    expect(s.rpg.done).not.toContain("samourai:mix");
    const ok = play(s, afterMinigame("rythme", true, s.rpg));
    expect(ok.then).toEqual({ kind: "battle", id: "metronome" });
    s = ok.s;
    // Défaite puis revanche : le Métronome se relance
    expect(play(s, talkTo("metronome", s.rpg, "village")).then).toEqual({ kind: "battle", id: "metronome" });
    s = win(s, "metronome");
    expect(s.rpg.party).toContain("pokeyz");
    expect(s.rpg.owned).toContain("casque-audio");
    expect(npcsOf(mapOf("village")!, s.rpg).some((n) => n.id === "pokeyz" || n.id === "metronome")).toBe(false);
    // Les lampions
    s = play(s, talkTo("matcha", s.rpg, "village")).s;
    expect(status(s.rpg, "lampions")).toBe("active");
    for (const n of LAMPIONS) s = play(s, examine(`lampion-${n}`, s.rpg, undefined, "village")).s;
    expect(s.rpg.done).toContain("lampions:allumer");
    s = play(s, talkTo("matcha", s.rpg, "village")).s;
    expect(status(s.rpg, "lampions")).toBe("terminee");
    // Le dojo
    s = play(s, arrival("dojo", s.rpg, true)).s;
    s = play(s, examine("coffre-dojo", s.rpg, undefined, "dojo")).s;
    expect(s.rpg.flags).toContain("coffre-dojo");
    const ka = play(s, talkTo("katsu", s.rpg, "dojo"));
    expect(ka.then).toEqual({ kind: "battle", id: "katsu" });
    s = win(ka.s, "katsu");
    expect(status(s.rpg, "samourai")).toBe("terminee");
    expect(s.rpg.skills).toContain("samourai");
    expect(s.rpg.items).toContain("fragment-4");
    expect(s.rpg.owned).toContain("ruban-katsu");
    expect(s.rpg.party).toEqual(["chevalier", "gerard", "lili", "pokeyz"]);
    expect(chapterCard("samourai")?.[0]).toMatch(/CHAPITRE 4/);
    expect(chapterCard("samourai")?.[4]).toMatch(/Protocole Minuit/);
    // Rejouer le mix après coup ne casse rien
    expect(afterMinigame("rythme", true, s.rpg)?.then).toBeUndefined();
  });
  it("si le joueur quitte après sa victoire sur Katsu sans voir la scène, Katsu la rejoue", () => {
    const r: Rpg = { ...open, flags: [...open.flags, "ko:katsu", "katsu-1"] };
    expect(talkTo("katsu", r, "dojo").then).toEqual({ kind: "scene", id: "katsu-ch4" });
  });
  it("aucun texte du chapitre n'évoque autre chose que la fiction", () => {
    const all: string[] = [];
    const push = (c: Conversation | null) => {
      if (!c) return;
      for (const l of c.lines) all.push(l.text);
      for (const ch of c.choices ?? []) {
        all.push(ch.label);
        push(ch.next);
      }
    };
    const states = [ch3Done, open, { ...open, done: ["samourai:pokeyz", "samourai:vinyles", "samourai:mix"], items: [...open.items, "vinyle-1", "vinyle-2", "vinyle-3"] }];
    for (const m of CH4_MAPS) {
      for (const n of m.npcs) for (const r of states) push(talkTo(n.id, r, m.id));
      for (const p of m.props) for (const r of states) push(examine(p.key ?? p.kind, r, p.text, m.id));
      push(arrival(m.id, ch3Done, true));
    }
    for (const id of ["sbires-2", "tambour-1", "metronome", "katsu"]) push(afterBattle(id, ch3Done));
    push(scene("katsu-ch4"));
    push(afterMinigame("rythme", true, ch3Done));
    expect(all.length).toBeGreaterThan(80);
    expect(all.join(" ")).not.toMatch(/2031|octobre|lib[ée]r|prison|cellule|d[ée]tenu|barreaux|parloir|[ée]vasion|condamn|peine de|juge/i);
  });
});
