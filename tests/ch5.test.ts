import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { BATTLES } from "@/lib/rpg/bestiary";
import { CREDITS } from "@/lib/rpg/ch5";
import { npcsOf, reachable, solidAt, step, type Facing, type MapDef, type Tile } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { CADRANS, CH5_MAPS, rouagesOk } from "@/lib/rpg/tour";
import { afterBattle, arrival, chapterCard, examine, openingCard, scene, talkTo, type Conversation } from "@/lib/rpg/script";

const T0 = Date.UTC(2026, 9, 17, 22);
const key = (t: Tile) => `${t.x},${t.y}`;
const around = (t: Tile) => (["up", "down", "left", "right"] as Facing[]).map((d) => step(t, d));
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

const ch4Done: Rpg = {
  ...emptyRpg(),
  quests: { "ville-figee": "terminee", "frites-perdues": "terminee", confrerie: "terminee", samourai: "terminee" },
  items: ["fragment-1", "fragment-2", "fragment-3", "fragment-4", "liste-cadran"],
  flags: ["ko:roi-salade", "ko:gonflax", "ko:metronome", "ko:katsu", "inconnu-parti"],
  party: ["chevalier", "gerard", "lili", "pokeyz"],
  skills: ["pluie-frites", "titan", "samourai"],
};
const open: Rpg = {
  ...ch4Done,
  done: ["minuit:seconde", "minuit:rouages"],
  flags: [...ch4Done.flags, "ko:sablier", "ko:trotteuse-parvis", "ko:coucou-parvis", "ko:trotteuses", "ko:coucous"],
};

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

describe("Chapitre 5 — cartes", () => {
  it("chaque porte mène à une case libre", () => {
    for (const m of [...CH5_MAPS, mapOf("village")!])
      for (const w of m.warps) {
        const to = w.to;
        if (!to || to === "appart") continue;
        const d = mapOf(to.map)!;
        expect(d, w.id).toBeTruthy();
        expect(solidAt(d, to, open), `${m.id}/${w.id} → ${to.map} ${key(to)}`).toBe(false);
      }
  });
  it("tout est atteignable quand tout est ouvert", () => {
    for (const m of CH5_MAPS) {
      const r = reachable(m, m.spawn, open);
      for (const w of m.warps) expect(r.has(key(step(w.at, back[w.dir ?? "up"]))) || r.has(key(w.at)), `${m.id}/${w.id}`).toBe(true);
      for (const n of m.npcs) expect(around(n.start).some((t) => r.has(key(t))), `${m.id}/${n.id}`).toBe(true);
      for (const p of m.props.filter((p) => p.key)) {
        const tiles: Tile[] = [];
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) tiles.push({ x, y });
        expect(tiles.some((t) => around(t).some((a) => r.has(key(a)))), `${m.id}/${p.key}`).toBe(true);
      }
    }
  });
  it("la route de la Tour n'ouvre qu'après le chapitre 4, la porte qu'après Seconde", () => {
    const nord = mapOf("village")!.warps.find((x) => x.id === "nord-2")!;
    expect(nord.needs!({ ...ch4Done, quests: { samourai: "active" } })).toBe(false);
    expect(nord.needs!(ch4Done)).toBe(true);
    const porte = mapOf("tour-parvis")!.warps.find((x) => x.id === "porte")!;
    expect(porte.needs!(ch4Done)).toBe(false);
    expect(porte.needs!(open)).toBe(true);
    expect(examine("porte-minuit", ch4Done, undefined, "tour-parvis").lines[0].text).toMatch(/verrouillée/);
    expect(openingCard("tour-parvis", ch4Done)?.[0]).toMatch(/CHAPITRE 5/);
  });
  it("le Grand Sablier garde le nord de la salle, la grille garde l'escalier", () => {
    const m = mapOf("tour")!;
    const r0 = { ...ch4Done, done: ["minuit:seconde"] };
    expect(walk(m, r0).has("10,4")).toBe(false);
    const r1 = { ...r0, flags: [...r0.flags, "ko:sablier", "ko:coucous"] };
    expect(walk(m, r1).has("10,4")).toBe(true);
    expect(walk(m, r1).has("10,1")).toBe(false);
    expect(walk(m, { ...r1, done: [...r1.done, "minuit:rouages"] }).has("10,1")).toBe(true);
  });
  it("les combats du chapitre existent", () => {
    for (const id of ["trotteuse", "trotteuses", "coucou", "coucous", "sablier", "minuit", "minuit-revanche"]) expect(BATTLES[id], id).toBeTruthy();
  });
});

function play(s: State, c: Conversation | null, pick = 0): { s: State; then?: Conversation["then"] } {
  if (!c) return { s };
  const st = applyEffects(s, c.effects ?? [], T0).state;
  if (c.choices?.length) return play(st, c.choices[Math.min(pick, c.choices.length - 1)].next);
  return { s: st, then: c.then };
}
function win(s: State, battle: string, defeated?: string, pick = 0): State {
  let st = applyEffects(s, [...(defeated ? [{ kind: "flag" as const, id: defeated }] : []), { kind: "flag" as const, id: `ko:${battle}` }, { kind: "reward" as const, xp: BATTLES[battle].xp, coins: BATTLES[battle].fp }], T0).state;
  const a = afterBattle(battle, st.rpg);
  if (a) {
    const r = play(st, a);
    st = r.s;
    if (r.then?.kind === "scene") st = play(st, scene(r.then.id), pick).s;
  }
  return st;
}
/** Résout l'énigme : tourner un cadran fait tourner ses voisins. */
function cadrans(s: State, order: number[]): State {
  for (const n of order) s = play(s, examine(`cadran-${n}`, s.rpg, undefined, "tour")).s;
  return s;
}

describe("Chapitre 5 — partie complète (sans interface)", () => {
  it("du village jusqu'à minuit, puis l'épilogue et le mode libre", () => {
    let s: State = { ...newState(T0), level: 17, rpg: ch4Done };
    s = play(s, arrival("tour-parvis", s.rpg, true)).s;
    expect(status(s.rpg, "minuit")).toBe("active");
    expect(play(s, talkTo("trotteuse", s.rpg, "tour-parvis")).then).toEqual({ kind: "battle", id: "trotteuse" });
    s = win(s, "trotteuse", "ko:trotteuse-parvis");
    s = play(s, talkTo("seconde", s.rpg, "tour-parvis")).s;
    expect(s.rpg.done).toContain("minuit:seconde");
    expect(status(s.rpg, "aiguilles")).toBe("active");
    expect(play(s, examine("distributeur", s.rpg, undefined, "tour-parvis")).then).toEqual({ kind: "shop", id: "tour" });
    s = play(s, examine("coffre-parvis", s.rpg, undefined, "tour-parvis")).s;
    // Salle des Rouages
    s = play(s, arrival("tour", s.rpg, true)).s;
    s = win(s, "trotteuses", "ko:trotteuses");
    s = play(s, examine("coffre-tour", s.rpg, undefined, "tour")).s;
    const sa = play(s, talkTo("sablier", s.rpg, "tour"));
    expect(sa.then).toEqual({ kind: "battle", id: "sablier" });
    s = win(sa.s, "sablier");
    expect(s.rpg.done).toContain("minuit:sablier");
    s = win(s, "coucous", "ko:coucous");
    s = play(s, examine("coffre-rouages", s.rpg, undefined, "tour")).s;
    // L'énigme : un mauvais essai, on revient en arrière, puis la solution (les deux bords)
    s = cadrans(s, [2]);
    expect(rouagesOk(s.rpg)).toBe(false);
    s = cadrans(s, [2, 1, 4]);
    expect(CADRANS.every((n) => s.rpg.flags.includes(`cadran-${n}`))).toBe(true);
    expect(s.rpg.done).toContain("minuit:rouages");
    // Une fois résolue, l'énigme ne se défait plus
    s = cadrans(s, [3]);
    expect(rouagesOk(s.rpg)).toBe(true);
    // Les aiguilles de Seconde
    expect(s.rpg.items).toEqual(expect.arrayContaining(["aiguille-1", "aiguille-2", "aiguille-3"]));
    s = play(s, talkTo("seconde", s.rpg, "tour-parvis")).s;
    expect(status(s.rpg, "aiguilles")).toBe("terminee");
    expect(s.rpg.owned).toContain("montre-seconde");
    // Sommet
    s = play(s, arrival("tour-sommet", s.rpg, true)).s;
    const mi = play(s, talkTo("minuit", s.rpg, "tour-sommet"));
    expect(mi.then).toEqual({ kind: "battle", id: "minuit" });
    s = mi.s;
    // Après une défaite, Minuit relance directement le combat
    expect(talkTo("minuit", s.rpg, "tour-sommet").then).toEqual({ kind: "battle", id: "minuit" });
    s = win(s, "minuit", undefined, 1);
    expect(status(s.rpg, "minuit")).toBe("terminee");
    expect(s.rpg.items).toContain("cadran");
    expect(s.rpg.flags).toContain("fin");
    expect(chapterCard("minuit")?.[0]).toMatch(/CHAPITRE 5/);
    expect(npcsOf(mapOf("tour-sommet")!, s.rpg).some((n) => n.id === "minuit")).toBe(false);
    // Épilogue au quartier, puis mode libre
    const ep = arrival("quartier", s.rpg, false);
    expect(ep?.lines.some((l) => /00:11/.test(l.text))).toBe(true);
    s = play(s, ep).s;
    expect(s.rpg.flags).toContain("mode-libre");
    expect(arrival("quartier", s.rpg, false)).toBeNull();
    expect(talkTo("nico", s.rpg, "quartier").lines[0].text).toMatch(/00:14/);
    expect(examine("affiche", s.rpg, "CHAT PERDU", "quartier").lines[0].text).toMatch(/RETROUVÉ/);
    // Revanche contre l'Écho de Minuit
    expect(npcsOf(mapOf("tour-sommet")!, s.rpg).some((n) => n.id === "echo")).toBe(true);
    expect(play(s, talkTo("echo", s.rpg, "tour-sommet")).then).toEqual({ kind: "battle", id: "minuit-revanche" });
  });
  it("les deux choix de la fin terminent l'aventure", () => {
    for (const pick of [0, 1]) {
      const st = play({ ...newState(T0), rpg: { ...open, quests: { ...open.quests, minuit: "active" }, done: ["minuit:nord", "minuit:seconde", "minuit:sablier", "minuit:rouages", "minuit:sommet", "minuit:minuit"] } }, scene("aube"), pick).s;
      expect(status(st.rpg, "minuit")).toBe("terminee");
    }
  });
  it("avant la fin, le quartier garde ses répliques habituelles", () => {
    expect(talkTo("nico", ch4Done, "quartier").lines[0].text).not.toMatch(/00:14/);
    expect(examine("affiche", ch4Done, "CHAT PERDU", "quartier").lines[0].text).toMatch(/CHAT PERDU/);
    expect(arrival("quartier", ch4Done, false)).toBeNull();
  });
  it("aucun texte du chapitre n'évoque autre chose que la fiction", () => {
    const all: string[] = CREDITS.flat();
    const push = (c: Conversation | null) => {
      if (!c) return;
      for (const l of c.lines) all.push(l.text);
      for (const ch of c.choices ?? []) {
        all.push(ch.label);
        push(ch.next);
      }
    };
    const fin = { ...open, flags: [...open.flags, "fin", "mode-libre", "ko:minuit"], items: [...open.items, "aiguille-1", "aiguille-2", "aiguille-3"] };
    const states = [ch4Done, open, fin];
    for (const m of [...CH5_MAPS, mapOf("quartier")!]) {
      for (const n of m.npcs) for (const r of states) push(talkTo(n.id, r, m.id));
      for (const p of m.props) for (const r of states) push(examine(p.key ?? p.kind, r, p.text, m.id));
      for (const r of states) push(arrival(m.id, r, true));
    }
    for (const id of ["sablier", "minuit", "minuit-revanche"]) push(afterBattle(id, ch4Done));
    push(scene("aube"));
    push(examine("porte-tour", ch4Done, undefined, "village"));
    expect(all.length).toBeGreaterThan(100);
    expect(all.join(" ")).not.toMatch(/2031|octobre|lib[ée]r|prison|cellule|d[ée]tenu|barreaux|parloir|[ée]vasion|condamn|peine de|juge/i);
  });
});
