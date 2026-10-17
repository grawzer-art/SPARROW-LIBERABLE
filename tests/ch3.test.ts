import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { BATTLES } from "@/lib/rpg/bestiary";
import { npcsOf, reachable, solidAt, step, type Facing, type MapDef, type Tile } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { CH3_MAPS, sanctuaireOuvert } from "@/lib/rpg/mont";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { afterBattle, afterMinigame, arrival, chapterCard, examine, openingCard, scene, talkTo, type Conversation } from "@/lib/rpg/script";

const T0 = Date.UTC(2026, 9, 17, 22);
const key = (t: Tile) => `${t.x},${t.y}`;
const around = (t: Tile) => (["up", "down", "left", "right"] as Facing[]).map((d) => step(t, d));
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

const open: Rpg = {
  ...emptyRpg(),
  quests: { "ville-figee": "terminee", "frites-perdues": "terminee" },
  done: ["confrerie:titan"],
  flags: ["temple-ouvert", "ko:proteinator", "ko:halteres", "ko:haltere", "ko:reserve", "ko:ronde-temple"],
  party: ["chevalier", "gerard"],
};

/** Accessibilité en tenant compte des PNJ immobiles (qui bloquent un passage). */
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

describe("Chapitre 3 — cartes", () => {
  it("chaque porte mène à une case libre", () => {
    for (const m of [...CH3_MAPS, mapOf("cite")!])
      for (const w of m.warps) {
        const to = w.to;
        if (!to || to === "appart") continue;
        const d = mapOf(to.map)!;
        expect(d, w.id).toBeTruthy();
        expect(solidAt(d, to, open), `${m.id}/${w.id} → ${to.map} ${key(to)}`).toBe(false);
      }
  });
  it("tout est atteignable quand tout est ouvert", () => {
    for (const m of CH3_MAPS) {
      const r = reachable(m, m.spawn, open);
      for (const w of m.warps) expect(r.has(key(step(w.at, back[w.dir ?? "up"]))) || r.has(key(w.at)), `${m.id}/${w.id}`).toBe(true);
      const counter = (t: Tile) => m.props.some((p) => p.kind === "comptoir" && t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h);
      for (const n of m.npcs) expect(around(n.start).some((t) => r.has(key(t)) || (counter(t) && around(t).some((u) => r.has(key(u))))), `${m.id}/${n.id}`).toBe(true);
      for (const p of m.props.filter((p) => p.key)) {
        const tiles: Tile[] = [];
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) tiles.push({ x, y });
        expect(tiles.some((t) => around(t).some((a) => r.has(key(a)))), `${m.id}/${p.key}`).toBe(true);
      }
    }
  });
  it("le pont est gardé par le Protéinator, le col par deux haltères", () => {
    const m = mapOf("sentier")!;
    const before = { ...open, flags: [] };
    expect(walk(m, before).has("11,1")).toBe(false);
    expect(walk(m, { ...open, flags: ["ko:proteinator"] }).has("5,16")).toBe(true);
    expect(walk(m, { ...open, flags: ["ko:proteinator"] }).has("11,1")).toBe(false);
    expect(walk(m, open).has("11,1")).toBe(true);
  });
  it("le sanctuaire n'ouvre qu'après l'éveil du Titan, la réserve est gardée", () => {
    const m = mapOf("temple")!;
    expect(walk(m, { ...open, done: [] }).has("14,3")).toBe(false);
    expect(sanctuaireOuvert(open)).toBe(true);
    expect(walk(m, open).has("14,3")).toBe(true);
    expect(walk(m, { ...open, flags: ["temple-ouvert"] }).has("2,19")).toBe(false);
    // Avant l'éveil du Titan, les trois salles d'épreuves sont accessibles depuis le hall
    const before = walk(m, { ...open, done: [], flags: ["temple-ouvert", "ko:ronde-temple"] });
    for (const t of ["5,5", "5,13", "24,13", "22,19"]) expect(before.has(t), t).toBe(true);
  });
  it("la porte nord de la Cité n'ouvre qu'après le chapitre 2", () => {
    const w = mapOf("cite")!.warps.find((x) => x.id === "nord-1")!;
    expect(w.needs!({ ...emptyRpg() })).toBe(false);
    expect(w.needs!(open)).toBe(true);
    expect(openingCard("sentier", open)?.[0]).toMatch(/CHAPITRE 3/);
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
/** Répond juste au quiz : la bonne réponse est l'option qui ne renvoie pas vers « Médite ». */
function quiz(s: State, c: Conversation): State {
  let st = applyEffects(s, c.effects ?? [], T0).state;
  if (!c.choices) return st;
  const right = c.choices.find((ch) => !/Médite/.test(ch.next.lines.map((l) => l.text).join(" ")))!;
  return quiz(st, right.next);
}

describe("Chapitre 3 — partie complète (sans interface)", () => {
  it("du portail nord jusqu'à Gonflax, avec Frère Flemme", () => {
    let s: State = { ...newState(T0), level: 8, rpg: { ...emptyRpg(), quests: { "ville-figee": "terminee", "frites-perdues": "terminee" }, items: ["fragment-1", "fragment-2"], flags: ["ko:roi-salade"], party: ["chevalier", "gerard"], skills: ["pluie-frites"] } };
    s = play(s, arrival("sentier", s.rpg, true)).s;
    expect(status(s.rpg, "confrerie")).toBe("active");
    s = play(s, talkTo("randonneur", s.rpg, "sentier")).s;
    s = win(s, "haltere-1", "ko:haltere");
    expect(play(s, talkTo("proteinator", s.rpg, "sentier")).then).toEqual({ kind: "battle", id: "proteinator" });
    s = win(s, "proteinator", "ko:proteinator");
    const br = play(s, talkTo("brenda", s.rpg, "refuge"));
    expect(br.then).toEqual({ kind: "shop", id: "refuge" });
    s = br.s;
    s = win(s, "halteres-2", "ko:halteres");
    s = play(s, arrival("temple-cour", s.rpg, true)).s;
    // Refuser Lili : il faut battre Frère Haltère
    s = play(s, talkTo("lili", s.rpg, "temple-cour"), 1).s;
    const g = play(s, talkTo("gardien", s.rpg, "temple-cour"));
    expect(g.then).toEqual({ kind: "battle", id: "moine-1" });
    s = win(g.s, "moine-1");
    expect(s.rpg.flags).toContain("temple-ouvert");
    s = play(s, arrival("temple", s.rpg, true)).s;
    // Les trois épreuves, dans le désordre
    s = quiz(s, talkTo("mollet", s.rpg, "temple"));
    expect(s.rpg.done).toContain("confrerie:esprit");
    const banc = play(s, examine("banc-force", s.rpg, undefined, "temple"));
    expect(banc.then).toEqual({ kind: "minigame", id: "muscu" });
    s = play(s, afterMinigame("muscu", false, s.rpg)).s;
    expect(s.rpg.done).not.toContain("confrerie:force");
    s = play(s, afterMinigame("muscu", true, s.rpg)).s;
    const ar = play(s, talkTo("arbitre", s.rpg, "temple"));
    expect(ar.then).toEqual({ kind: "battle", id: "arene" });
    s = win(ar.s, "arene");
    expect(examine("grille-sanctuaire", s.rpg, undefined, "temple").lines[0].text).toMatch(/ferme/);
    s = play(s, talkTo("mollet", s.rpg, "temple")).s;
    expect(s.rpg.skills).toContain("titan");
    expect(sanctuaireOuvert(s.rpg)).toBe(true);
    // Frère Flemme
    s = play(s, talkTo("flemme", s.rpg, "temple")).s;
    expect(examine("coffre-oreiller", s.rpg, undefined, "temple").lines[0].text).toMatch(/gardiens/);
    s = win(s, "moine-reserve", "ko:reserve");
    s = play(s, examine("coffre-oreiller", s.rpg, undefined, "temple")).s;
    s = play(s, talkTo("flemme", s.rpg, "temple")).s;
    expect(status(s.rpg, "flemme")).toBe("terminee");
    expect(s.rpg.owned).toContain("masque-nuit");
    // Gonflax
    const go = play(s, talkTo("gonflax", s.rpg, "temple"));
    expect(go.then).toEqual({ kind: "battle", id: "gonflax" });
    s = win(go.s, "gonflax");
    expect(status(s.rpg, "confrerie")).toBe("terminee");
    expect(s.rpg.party).toEqual(["chevalier", "gerard", "lili"]);
    expect(s.rpg.items).toEqual(expect.arrayContaining(["fragment-3", "liste-cadran"]));
    expect(s.rpg.owned).toContain("ceinture-titan");
    expect(chapterCard("confrerie")?.[0]).toMatch(/CHAPITRE 3/);
  });
  it("accepter le marché de Lili ouvre le temple sans combat", () => {
    const s = play({ ...newState(T0), rpg: open }, talkTo("lili", { ...open, flags: [] }, "temple-cour"), 0).s;
    expect(s.rpg.flags).toContain("temple-ouvert");
  });
  it("une mauvaise réponse au quiz ne valide rien", () => {
    const c = talkTo("mollet", emptyRpg(), "temple");
    const q1 = c.choices![0].next;
    const wrong = q1.choices!.find((ch) => /Médite/.test(ch.next.lines[0].text))!;
    expect(wrong.next.effects ?? []).toEqual([]);
  });
});
