import { describe, expect, it } from "vitest";
import { newState, restore, type State } from "@/lib/gotchi/engine";
import { DOORS, MAP_H, MAP_W, NPCS, PROPS, SPAWN, ZONES, isSolid, reachable, restoreTile, step, thingAt, zoneAt, type Facing, type Tile } from "@/lib/rpg/quartier";
import { QUESTS, applyEffects, emptyRpg, has, nextStep, restoreRpg, status, type Effect } from "@/lib/rpg/quest";
import { NPC_TALK, evenement, examine, talkTo } from "@/lib/rpg/script";
import { CHAR_IDS, charPalette, charRows, type Dir, type Frame } from "@/components/rpg/actors";

const T0 = Date.UTC(2026, 9, 17, 22);
const key = (t: Tile) => `${t.x},${t.y}`;
const around = (t: Tile) => (["up", "down", "left", "right"] as Facing[]).map((d) => step(t, d));

describe("Quartier 404 — level design", () => {
  const open = reachable(SPAWN);
  const all = reachable(SPAWN, { gateOpen: true });

  it("Sparrow apparaît sur une case libre, devant chez lui", () => {
    expect(isSolid(SPAWN)).toBe(false);
    expect(DOORS.find((d) => d.id === "residence")!.at).toEqual(step(SPAWN, "up"));
  });
  it("chaque PNJ est atteignable (on peut se placer à côté de lui)", () => {
    for (const n of NPCS) expect(around(n.start).some((t) => open.has(key(t))), n.id).toBe(true);
  });
  it("chaque porte, l'horloge, la benne et le portail sont accessibles sans badge", () => {
    for (const d of DOORS) expect(open.has(key(step(d.at, "down"))), d.id).toBe(true);
    expect(open.has("21,17")).toBe(true); // devant l'horloge
    expect(open.has("20,3")).toBe(true); // devant la benne
    expect(open.has("29,14")).toBe(true); // devant le portail
  });
  it("la station n'est accessible qu'avec le portail ouvert", () => {
    expect(open.has("29,22")).toBe(false);
    expect(all.has("29,22")).toBe(true);
    expect(thingAt({ x: 29, y: 21 })?.id).toBe("transfo");
  });
  it("les zones existent et contiennent des cases accessibles", () => {
    for (const z of ZONES) {
      let ok = false;
      for (let y = z.y1; y <= z.y2 && !ok; y++) for (let x = z.x1; x <= z.x2 && !ok; x++) ok = all.has(`${x},${y}`);
      expect(ok, z.id).toBe(true);
    }
    expect(zoneAt({ x: 17, y: 22 })?.id).toBe("place");
  });
  it("aucun élément ne sort de la carte et on ne peut pas quitter la carte", () => {
    for (const p of PROPS) {
      expect(p.x >= 0 && p.y >= 0 && p.x + p.w <= MAP_W && p.y + p.h <= MAP_H, `${p.kind} ${p.x},${p.y}`).toBe(true);
    }
    for (const k of all) {
      const [x, y] = k.split(",").map(Number);
      expect(x >= 0 && y >= 0 && x < MAP_W && y < MAP_H).toBe(true);
    }
  });
  it("une bonne partie de la carte est explorable (pas une carte vide ni un couloir)", () => {
    expect(all.size).toBeGreaterThan(400);
  });
  it("position sauvegardée dehors validée", () => {
    expect(restoreTile({ x: 5, y: 9, dir: "up" })).toEqual({ x: 5, y: 9, dir: "up" });
    expect(restoreTile({ x: 5, y: 5 })).toBeNull(); // dans l'immeuble
    expect(restoreTile("n'importe quoi")).toBeNull();
  });
});

/** Joue une conversation : applique ses effets. */
function play(s: State, effects: Effect[] | undefined) {
  return applyEffects(s, effects ?? [], T0).state;
}

describe("Quête « La Ville Figée »", () => {
  const Q = "ville-figee";
  it("disponible au départ, active en sortant", () => {
    let s = newState(T0);
    expect(status(s.rpg, Q)).toBe("disponible");
    const r = applyEffects(s, [{ kind: "step", quest: Q, step: "sortir" }], T0);
    s = r.state;
    expect(status(s.rpg, Q)).toBe("active");
    expect(r.notes[0]).toMatch(/Nouvelle quête/);
    expect(nextStep(s.rpg, Q)?.id).toBe("explorer");
  });
  it("se termine (dans l'ordre du scénario) avec récompenses et objet", () => {
    let s = newState(T0);
    s = play(s, [{ kind: "step", quest: Q, step: "sortir" }, { kind: "step", quest: Q, step: "explorer" }]);
    s = play(s, talkTo("nico", s.rpg).effects);
    expect(has(s.rpg, "pizza")).toBe(true);
    s = play(s, examine("horloge", s.rpg).effects);
    s = play(s, talkTo("raymond", s.rpg).effects);
    s = play(s, examine("benne", s.rpg).effects);
    expect(has(s.rpg, "badge")).toBe(true);
    s = play(s, examine("portail", s.rpg).effects);
    s = play(s, [{ kind: "step", quest: Q, step: "station" }]);
    const tr = examine("transfo", s.rpg);
    expect(tr.cutscene).toBe("evenement");
    const coins = s.coins;
    const r = applyEffects(s, evenement().effects!, T0);
    expect(r.completed?.id).toBe(Q);
    expect(status(r.state.rpg, Q)).toBe("terminee");
    expect(has(r.state.rpg, "fragment-1")).toBe(true);
    expect(r.state.coins).toBeGreaterThanOrEqual(coins + QUESTS[0].reward.coins); // + éventuelle prime de niveau
    // Les dialogues changent après la quête
    expect(talkTo("nico", r.state.rpg).lines[0].text).toMatch(/minute a bougé/);
    expect(examine("barriere", r.state.rpg, "CENTRE-VILLE").lines.some((l) => /CHAPITRE 2/.test(l.text))).toBe(true);
  });
  it("aucun blocage : badge trouvé avant de parler à quiconque, puis le reste", () => {
    let s = newState(T0);
    s = play(s, examine("benne", s.rpg).effects);
    expect(has(s.rpg, "badge")).toBe(true);
    expect(examine("transfo", s.rpg).cutscene).toBeUndefined(); // il manque des indices, mais rien n'est bloqué
    s = play(s, examine("horloge", s.rpg).effects);
    s = play(s, talkTo("nico", s.rpg).effects);
    expect(examine("transfo", s.rpg).cutscene).toBe("evenement");
  });
  it("fouiller la benne deux fois ne donne pas deux badges ; terminer deux fois ne paie qu'une fois", () => {
    let s = play(newState(T0), examine("benne", newState(T0).rpg).effects);
    s = play(s, examine("benne", s.rpg).effects);
    expect(s.rpg.items.filter((i) => i === "badge")).toHaveLength(1);
    const all: Effect[] = QUESTS[0].steps.map((x) => ({ kind: "step", quest: "ville-figee", step: x.id }));
    const a = applyEffects(s, all, T0).state;
    const b = applyEffects(a, all, T0);
    expect(b.completed).toBeNull();
    expect(b.state.coins).toBe(a.coins);
  });
  it("chaque PNJ a plusieurs répliques et une réplique par défaut", () => {
    for (const id of NPCS.map((n) => n.id)) {
      const rules = NPC_TALK[id];
      expect(rules.length).toBeGreaterThanOrEqual(3);
      expect(rules[rules.length - 1].when).toBeUndefined();
      expect(talkTo(id, emptyRpg()).lines.length).toBeGreaterThan(0);
    }
  });
  it("la scène finale n'évoque pas le compte à rebours réel", () => {
    const txt = evenement().lines.map((l) => l.text).join(" ");
    expect(txt).not.toMatch(/2031|octobre|libér/i);
  });
});

describe("Sauvegarde RPG", () => {
  it("une ancienne sauvegarde reçoit une aventure vide, sans rien perdre", () => {
    const s = restore({ ...newState(T0), rpg: undefined, coins: 321, level: 4 }, T0);
    expect(s.rpg).toEqual(emptyRpg());
    expect(s.coins).toBe(321);
  });
  it("aller-retour JSON de la progression de quête", () => {
    const s = applyEffects(newState(T0), [{ kind: "item", id: "badge" }, { kind: "step", quest: "ville-figee", step: "sortir" }, { kind: "flag", id: "portail" }], T0).state;
    const back = restore(JSON.parse(JSON.stringify(s)), T0);
    expect(back.rpg).toEqual(s.rpg);
    expect(restoreRpg({ quests: { "ville-figee": "n'importe" }, items: [1, "badge"] })).toEqual({ ...emptyRpg(), items: ["badge"] });
  });
});

describe("Sprites des personnages", () => {
  it("5 personnages, 3 directions, 3 images, 16 × 20, couleurs connues", () => {
    expect(CHAR_IDS).toEqual(["sparrow", "nico", "bouchon", "raymond", "inconnu"]);
    for (const id of CHAR_IDS)
      for (const d of ["down", "up", "side"] as Dir[])
        for (const f of [0, 1, 2] as Frame[]) {
          const rows = charRows(id, d, f);
          expect(rows, `${id}/${d}/${f}`).toHaveLength(20);
          const pal = charPalette(id);
          for (const r of rows) {
            expect(r.length, `${id}/${d}/${f} « ${r} »`).toBe(16);
            for (const c of r) if (c !== ".") expect(pal[c], `${id}/${d}/${f} « ${c} »`).toBeDefined();
          }
        }
  });
});
