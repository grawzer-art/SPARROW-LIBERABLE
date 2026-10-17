import { describe, expect, it } from "vitest";
import { newState, type State } from "@/lib/gotchi/engine";
import { BATTLES } from "@/lib/rpg/bestiary";
import { vannesOk } from "@/lib/rpg/cite";
import { npcsOf, reachable, solidAt, step, thingAt, type Facing, type MapDef, type Tile } from "@/lib/rpg/mapdef";
import { MAPS, mapOf, restoreWhere } from "@/lib/rpg/maps";
import { applyEffects, emptyRpg, status, type Rpg } from "@/lib/rpg/quest";
import { afterBattle, afterMinigame, arrival, chapterCard, evenement, examine, scene, talkTo, zoneEffects, type Conversation, NPC_TALK } from "@/lib/rpg/script";
import { CUISSON, buyRpg, cookScore, equipRpg, rate } from "@/lib/rpg/shop";

const T0 = Date.UTC(2026, 9, 17, 22);
const key = (t: Tile) => `${t.x},${t.y}`;
const around = (t: Tile) => (["up", "down", "left", "right"] as Facing[]).map((d) => step(t, d));
const back: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

/** Un état où tout est ouvert (fin du chapitre 2). */
const open: Rpg = {
  ...emptyRpg(),
  flags: ["portail", "ko:eclaireur", "porte-secrete", "vanne-1", "vanne-3", "ko:roi-salade", "passe-garde", "ko:porte-ruelle", "ko:patates", "ko:patate-egout", "ko:ronde", "ko:patrouille"],
  quests: { "ville-figee": "terminee" },
  party: ["chevalier", "gerard"],
};

const ch2 = Object.values(MAPS).filter((m): m is MapDef => !!m && m.id !== "quartier");

describe("Chapitre 2 — cartes", () => {
  it("7 cartes, chaque porte mène à une case libre d'une carte existante", () => {
    expect(ch2.map((m) => m.id).sort()).toEqual(["armurerie", "cite", "egouts", "herboristerie", "maison-chou", "palais", "restaurant"]);
    for (const m of Object.values(MAPS)) {
      for (const w of m!.warps) {
        const to = w.to;
        if (!to || to === "appart") continue;
        const dest = mapOf(to.map);
        expect(dest, `${m!.id}/${w.id}`).not.toBeNull();
        expect(solidAt(dest!, to, open), `${m!.id}/${w.id} → ${to.map} ${key(to)}`).toBe(false);
        expect(dest!.npcs.some((n) => n.start.x === to.x && n.start.y === to.y), `${w.id}: PNJ sur l'arrivée`).toBe(false);
      }
    }
  });
  it("chaque porte, PNJ et objet clé est atteignable (tout ouvert)", () => {
    for (const m of ch2) {
      const r = reachable(m, m.spawn, open);
      for (const w of m.warps) {
        const from = step(w.at, back[w.dir ?? "up"]);
        expect(r.has(key(from)) || r.has(key(w.at)), `${m.id}/${w.id}`).toBe(true);
      }
      // On parle aux marchands par-dessus le comptoir
      const counter = (t: Tile) => m.props.some((p) => p.kind === "comptoir" && t.x >= p.x && t.x < p.x + p.w && t.y >= p.y && t.y < p.y + p.h);
      const near = (n: Tile) => around(n).some((t) => r.has(key(t)) || (counter(t) && around(t).some((u) => r.has(key(u)))));
      for (const n of npcsOf(m, { ...open, flags: [] }).concat(npcsOf(m, open))) expect(near(n.start), `${m.id}/${n.id}`).toBe(true);
      for (const p of m.props.filter((p) => p.key)) {
        const tiles: Tile[] = [];
        for (let y = p.y; y < p.y + p.h; y++) for (let x = p.x; x < p.x + p.w; x++) tiles.push({ x, y });
        expect(tiles.some((t) => around(t).some((a) => r.has(key(a)))), `${m.id}/${p.key}`).toBe(true);
      }
    }
  });
  it("aucun élément ne sort de sa carte", () => {
    for (const m of ch2) for (const p of m.props) expect(p.x >= 0 && p.y >= 0 && p.x + p.w <= m.w && p.y + p.h <= m.h, `${m.id} ${p.kind} ${p.x},${p.y}`).toBe(true);
  });
  it("égouts : l'échelle du palais n'est accessible qu'avec les vannes bien réglées", () => {
    const m = mapOf("egouts")!;
    const ladder = { x: 26, y: 11 };
    const shut = reachable(m, m.spawn, { ...open, flags: [] });
    expect(shut.has(key(ladder))).toBe(false);
    expect(reachable(m, m.spawn, open).has(key(ladder))).toBe(true);
    expect(vannesOk({ ...emptyRpg(), flags: ["vanne-1", "vanne-2", "vanne-3"] })).toBe(false);
    expect(thingAt(m, { x: 26, y: 10 }, open)?.key).toBe("echelle-palais");
  });
  it("la ruelle n'est accessible qu'après avoir battu les deux gardes", () => {
    const m = mapOf("cite")!;
    const npcsBlock = (r: Rpg) => {
      const occ = new Set(npcsOf(m, r).map((n) => key(n.start)));
      // BFS en tenant compte des PNJ immobiles
      const seen = new Set([key(m.spawn)]);
      const q = [m.spawn as Tile];
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
    };
    const before = npcsBlock({ ...open, flags: open.flags.filter((f) => f !== "ko:porte-ruelle") });
    expect(before.has("35,17")).toBe(false);
    expect(npcsBlock(open).has("35,17")).toBe(true);
  });
  it("reprise : position sauvegardée dans une carte du chapitre 2", () => {
    expect(restoreWhere({ map: "cite", x: 19, y: 30, dir: "up" }, open)).toEqual({ map: "cite", x: 19, y: 30, dir: "up" });
    expect(restoreWhere({ map: "egouts", x: 0, y: 0 }, open)).toBeNull();
    expect(restoreWhere({ map: "inconnue", x: 1, y: 1 }, open)).toBeNull();
  });
});

describe("Chapitre 2 — dialogues", () => {
  it("chaque PNJ a des répliques, quel que soit l'avancement", () => {
    for (const m of ch2)
      for (const n of m.npcs)
        for (const r of [emptyRpg(), open]) {
          const c = talkTo(n.id, r, m.id);
          expect(c.lines.length + (c.choices?.length ?? 0), `${m.id}:${n.id}`).toBeGreaterThan(0);
        }
  });
  it("chaque objet nommé a un texte", () => {
    for (const m of ch2) for (const p of m.props.filter((p) => p.key)) expect(examine(p.key!, emptyRpg(), p.text, m.id).lines[0].text, `${m.id}:${p.key}`).not.toBe("Rien de spécial.");
  });
  it("chaque combat lancé par un dialogue existe", () => {
    for (const m of ch2)
      for (const n of m.npcs) {
        const c = talkTo(n.id, emptyRpg(), m.id);
        if (c.then?.kind === "battle") expect(BATTLES[c.then.id], c.then.id).toBeDefined();
        if (n.enemy) expect(BATTLES[n.enemy.battle], n.enemy.battle).toBeDefined();
      }
  });
  it("aucun texte n'évoque le compte à rebours réel ni ses circonstances", () => {
    const all: string[] = [];
    const push = (c: Conversation | null) => {
      if (!c) return;
      for (const l of c.lines) all.push(l.text);
      for (const ch of c.choices ?? []) {
        all.push(ch.label);
        push(ch.next);
      }
    };
    for (const m of Object.values(MAPS)) {
      for (const n of m!.npcs) for (const r of [emptyRpg(), open]) push(talkTo(n.id, r, m!.id));
      for (const p of m!.props) for (const r of [emptyRpg(), open]) push(examine(p.key ?? p.kind, r, p.text, m!.id));
      push(arrival(m!.id, emptyRpg(), true));
    }
    for (const id of Object.keys(BATTLES)) push(afterBattle(id, emptyRpg()));
    push(scene("lili"));
    push(afterMinigame("frites", true, emptyRpg()));
    push(evenement());
    for (const rules of Object.values(NPC_TALK)) for (const r of rules) push(r.talk(open));
    expect(all.length).toBeGreaterThan(150);
    const txt = all.join(" ");
    expect(txt).not.toMatch(/2031|octobre|lib[ée]r|prison|cellule|d[ée]tenu|barreaux|parloir|[ée]vasion|condamn|peine de|juge/i);
  });
});

/** Joue une conversation : effets, choix (premier par défaut), action finale. */
function play(s: State, c: Conversation, pick = 0): { s: State; then?: Conversation["then"] } {
  let st = applyEffects(s, c.effects ?? [], T0).state;
  if (c.choices?.length) return play(st, c.choices[pick].next);
  return { s: st, then: c.then };
}

/** Gagne un combat (comme l'interface : drapeau de l'ennemi + ko:combat + récompenses). */
function win(s: State, battle: string, defeated?: string): State {
  const eff = [...(defeated ? [{ kind: "flag" as const, id: defeated }] : []), { kind: "flag" as const, id: `ko:${battle}` }, { kind: "reward" as const, xp: BATTLES[battle].xp, coins: BATTLES[battle].fp }];
  let st = applyEffects(s, eff, T0).state;
  const after = afterBattle(battle, st.rpg);
  if (after) {
    const r = play(st, after);
    st = r.s;
    if (r.then?.kind === "scene") st = play(st, scene(r.then.id)!).s;
  }
  return st;
}

describe("Chapitre 2 — partie complète (sans interface)", () => {
  it("de la route du Centre-ville jusqu'au Roi, avec la quête secondaire", () => {
    let s: State = { ...newState(T0), rpg: { ...emptyRpg(), quests: { "ville-figee": "terminee" }, items: ["fragment-1"], flags: ["portail", "inconnu-parti"] } };
    const level0 = s.level;
    // Quartier : le Chevalier, puis l'éclaireur
    s = play(s, talkTo("chevalier", s.rpg, "quartier")).s;
    expect(s.rpg.party).toEqual(["chevalier"]);
    const ecl = play(s, talkTo("eclaireur", s.rpg, "quartier"));
    expect(ecl.then).toEqual({ kind: "battle", id: "eclaireur" });
    s = win(ecl.s, "eclaireur", "ko:eclaireur");
    expect(status(s.rpg, "frites-perdues")).toBe("active");
    // Arrivée dans la Cité
    s = play(s, arrival("cite", s.rpg, true)!).s;
    // Mamie Tubercule (quête secondaire), décret, Madame Chou
    s = play(s, talkTo("tubercule", s.rpg, "cite")).s;
    expect(status(s.rpg, "graines")).toBe("active");
    s = play(s, examine("fontaine-seche", s.rpg, undefined, "cite")).s;
    s = play(s, examine("decret", s.rpg, undefined, "cite")).s;
    s = play(s, talkTo("chou", s.rpg, "maison-chou")).s;
    expect(s.rpg.items).toContain("mot-de-passe");
    // Gardes de la ruelle, porte secrète, Gérard, cuisine
    const gard = play(s, talkTo("porte-1", s.rpg, "cite"));
    s = win(gard.s, "brocolis-porte", "ko:porte-ruelle");
    s = play(s, examine("tonneau-sachet", s.rpg, undefined, "cite")).s;
    const door = play(s, examine("porte-secrete", s.rpg, undefined, "cite"));
    expect(door.then?.kind).toBe("warp");
    s = door.s;
    expect(s.rpg.flags).toContain("porte-secrete");
    const ge = play(s, talkTo("gerard", s.rpg, "restaurant"));
    expect(ge.then).toEqual({ kind: "minigame", id: "frites" });
    s = ge.s;
    s = play(s, afterMinigame("frites", false, s.rpg)!).s; // raté : rien ne bloque
    expect(s.rpg.party).not.toContain("gerard");
    s = play(s, afterMinigame("frites", true, s.rpg)!).s;
    expect(s.rpg.party).toEqual(["chevalier", "gerard"]);
    expect(s.rpg.skills).toContain("pluie-frites");
    expect(s.rpg.items).toContain("cle-egouts");
    // Égouts : descente, vannes, coffre, sachet, patates, échelle
    const pl = play(s, examine("plaque", s.rpg, undefined, "cite"));
    expect(pl.then?.kind).toBe("warp");
    s = pl.s;
    for (const v of ["vanne-1", "vanne-2", "vanne-3", "vanne-2"]) s = play(s, examine(v, s.rpg, undefined, "egouts")).s;
    expect(vannesOk(s.rpg)).toBe(true);
    s = play(s, examine("caisse-sachet", s.rpg, undefined, "egouts")).s;
    s = play(s, examine("coffre-egout", s.rpg, undefined, "egouts")).s;
    s = win(s, "patate-1", "ko:patate-egout");
    s = play(s, talkTo("repentie", s.rpg, "egouts")).s;
    expect(s.rpg.owned).toContain("pin-patate");
    s = win(s, "patate-2", "ko:patates");
    s = play(s, examine("echelle-palais", s.rpg, undefined, "egouts")).s;
    // Palais : uniforme, gardes, salle du trône, Roi
    s = play(s, examine("armoire", s.rpg, undefined, "palais")).s;
    s = play(s, talkTo("porte-trone", s.rpg, "palais")).s;
    expect(s.rpg.flags).toContain("passe-garde");
    s = applyEffects(s, zoneEffects("palais-trone"), T0).state;
    const roi = play(s, talkTo("roi", s.rpg, "palais"));
    expect(roi.then).toEqual({ kind: "battle", id: "roi-salade" });
    s = win(roi.s, "roi-salade");
    expect(status(s.rpg, "frites-perdues")).toBe("terminee");
    expect(s.rpg.items).toEqual(expect.arrayContaining(["fragment-1", "fragment-2", "note-cadran"]));
    expect(s.rpg.owned).toContain("fourchette-sacree");
    expect(chapterCard("frites-perdues")?.[0]).toMatch(/CHAPITRE 2/);
    // Retour : Mamie Tubercule
    s = play(s, talkTo("tubercule", s.rpg, "cite")).s;
    expect(status(s.rpg, "graines")).toBe("terminee");
    expect(s.rpg.owned).toContain("bracelet-sel");
    expect(s.level).toBeGreaterThan(level0);
  });
  it("sans uniforme, les gardes du trône se battent (et la porte s'ouvre après)", () => {
    const r = talkTo("porte-trone", emptyRpg(), "palais");
    expect(r.then).toEqual({ kind: "battle", id: "laitue-2" });
    const m = mapOf("palais")!;
    expect(npcsOf(m, { ...emptyRpg(), flags: ["ko:laitue-2"] }).some((n) => n.id === "porte-trone")).toBe(false);
  });
  it("le mot de passe n'est proposé qu'avec le ticket de Madame Chou", () => {
    const without = examine("porte-secrete", emptyRpg(), undefined, "cite");
    expect(without.choices?.some((c) => c.next.then?.kind === "warp")).toBe(false);
    const withT = examine("porte-secrete", { ...emptyRpg(), items: ["mot-de-passe"] }, undefined, "cite");
    expect(withT.choices?.[0].next.then?.kind).toBe("warp");
  });
});

describe("Boutiques et équipement", () => {
  const s0 = (coins: number): State => ({ ...newState(T0), coins });
  it("acheter un consommable et un équipement, refuser sans assez de FP", () => {
    let s = s0(200);
    let r = buyRpg(s, "herboristerie", "tisane");
    expect(r.ok).toBe(true);
    s = r.state;
    expect(s.rpg.bag.tisane).toBe(1);
    expect(s.coins).toBe(185);
    r = buyRpg(s, "armurerie", "spatule");
    expect(r.ok).toBe(true);
    s = r.state;
    expect(buyRpg(s, "armurerie", "spatule").ok).toBe(false); // déjà possédée
    expect(buyRpg(s, "armurerie", "tablier").ok).toBe(false); // trop cher
    expect(buyRpg(s, "armurerie", "frites").ok).toBe(false); // pas vendu ici
    s = equipRpg(s, "spatule");
    expect(s.rpg.gear.arme).toBe("spatule");
    expect(equipRpg(s, "spatule").rpg.gear.arme).toBeUndefined();
  });
  it("mini-jeu : zones de cuisson et score", () => {
    expect(rate(0.2)).toBe("pale");
    expect(rate((CUISSON.parfait[0] + CUISSON.parfait[1]) / 2)).toBe("parfait");
    expect(rate(0.6)).toBe("bien");
    expect(rate(0.95)).toBe("brule");
    expect(cookScore(["parfait", "parfait", "bien", "pale", "brule"])).toBe(5);
  });
});
