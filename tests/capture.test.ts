import { describe, expect, it } from "vitest";
import { BATTLES, CONSUMABLES, FOES, MEMBERS, MOVES, SHOPS } from "@/lib/rpg/bestiary";
import { ally, catchChance, foe, makeAlly, mustSwap, playTurn, startBattle, type Battle, type Team } from "@/lib/rpg/combat";
import { reachable, wildAt } from "@/lib/rpg/mapdef";
import { mapOf } from "@/lib/rpg/maps";
import { ACTIVE, addCaught, isSeen, monsGainXp, toggleTeam, wildBattle, xpNeed } from "@/lib/rpg/monsters";
import { emptyRpg, restoreRpg, type Rpg } from "@/lib/rpg/quest";

const team = (over: Partial<Team> = {}): Team => ({ level: 6, party: ["chevalier", "gerard"], gear: {}, skills: [], bag: { "capsule-echo": 5 }, ...over });
/** Joue jusqu'à capture (ou fin), en tapant d'abord pour affaiblir. */
function hunt(seed: number, weaken = true) {
  let b = startBattle("brokito-sauvage", team(), seed);
  let tries = 0;
  for (let t = 0; t < 40 && !b.over; t++) {
    const low = foe(b).hp / foe(b).maxHp < 0.45;
    const act = (weaken && !low) ? { kind: "move" as const, move: "coup-manette" } : { kind: "item" as const, item: "capsule-echo" };
    if (act.kind === "item") tries++;
    if (act.kind === "item" && !b.bag["capsule-echo"]) break;
    if (mustSwap(b)) {
      b = playTurn(b, { kind: "swap", to: b.allies.findIndex((x) => x.hp > 0) }).battle;
      continue;
    }
    b = playTurn(b, act).battle;
  }
  return { b, tries };
}

describe("Capture — données", () => {
  it("Brokito existe partout : espèce, ennemi sauvage, combat, capsule en boutique", () => {
    expect(MEMBERS.brokito.moves.every((m) => MOVES[m])).toBe(true);
    expect(FOES.brokito).toBeTruthy();
    expect(BATTLES["brokito-sauvage"].wild).toBe("brokito");
    expect(wildBattle("brokito")).toBe("brokito-sauvage");
    expect(CONSUMABLES["capsule-echo"].capture).toBeGreaterThan(0);
    expect(SHOPS.herboristerie.items).toContain("capsule-echo");
  });
  it("le potager du Jardin royal est une zone de hautes herbes accessible", () => {
    const cite = mapOf("cite")!;
    const tiles: { x: number; y: number }[] = [];
    for (let y = 0; y < cite.h; y++) for (let x = 0; x < cite.w; x++) if (wildAt(cite, { x, y })) tiles.push({ x, y });
    expect(tiles.length).toBeGreaterThan(10);
    const open: Rpg = { ...emptyRpg(), quests: { "ville-figee": "terminee", "frites-perdues": "terminee" }, flags: ["ko:roi-salade"] };
    const r = reachable(cite, cite.spawn, open);
    expect(tiles.some((t) => r.has(`${t.x},${t.y}`))).toBe(true);
    // Aucune autre carte n'a encore de rencontres sauvages
    expect(wildAt(mapOf("quartier")!, { x: 5, y: 9 })).toBeNull();
  });
});

describe("Capture — combat", () => {
  it("le combat sauvage se gagne facilement, même sans capturer", () => {
    for (const lv of [4, 8, 14]) {
      let wins = 0;
      for (let i = 0; i < 100; i++) {
        let b = startBattle("brokito-sauvage", team({ level: lv, bag: {} }), 900 + i * 13);
        for (let t = 0; t < 60 && !b.over; t++) b = playTurn(b, mustSwap(b) ? { kind: "swap", to: b.allies.findIndex((x) => x.hp > 0) } : { kind: "move", move: "coup-manette" }).battle;
        if (b.over === "win") wins++;
      }
      expect(wins, `niveau ${lv}`).toBeGreaterThan(95);
    }
  });
  it("plus Brokito est affaibli, plus la capture est probable", () => {
    const b = startBattle("brokito-sauvage", team(), 1);
    const x = foe(b);
    const full = catchChance(0.5, x);
    const weak = catchChance(0.5, { ...x, hp: Math.round(x.maxHp * 0.1) });
    const stunned = catchChance(0.5, { ...x, hp: Math.round(x.maxHp * 0.1), status: { id: "etourdi", turns: 1 } });
    expect(full).toBeLessThan(0.5);
    expect(weak).toBeGreaterThan(full * 2);
    expect(stunned).toBeGreaterThan(weak);
  });
  it("affaiblir puis capturer marche presque toujours avec 5 capsules", () => {
    let ok = 0;
    let tries = 0;
    for (let i = 0; i < 200; i++) {
      const r = hunt(500 + i * 17);
      if (r.b.captured) ok++;
      tries += r.tries;
    }
    expect(ok / 200).toBeGreaterThan(0.85);
    // Ce n'est pas gratuit : en moyenne plus d'une capsule
    expect(tries / 200).toBeGreaterThan(1.2);
  });
  it("une capture réussie termine le combat et donne l'espèce et son niveau", () => {
    let b: Battle | null = null;
    for (let seed = 1; seed < 200 && !b; seed++) {
      const r = hunt(seed);
      if (r.b.captured) b = r.b;
    }
    expect(b!.over).toBe("win");
    expect(b!.captured).toEqual({ species: "brokito", level: foe(b!).lv });
    expect(b!.used["capsule-echo"]).toBeGreaterThan(0);
  });
  it("un échec consomme la capsule, le combat continue ; animation : 0 à 2 secousses", () => {
    for (let seed = 1; seed < 100; seed++) {
      const b = startBattle("brokito-sauvage", team(), seed);
      const r = playTurn(b, { kind: "item", item: "capsule-echo" });
      const cap = r.events.find((e) => e.kind === "capture");
      expect(cap).toBeTruthy();
      if (cap?.kind === "capture" && !cap.ok) {
        expect(cap.shakes).toBeLessThanOrEqual(2);
        expect(r.battle.over).toBeNull();
        expect(r.battle.bag["capsule-echo"]).toBe(4);
        return;
      }
    }
    throw new Error("aucun échec trouvé");
  });
  it("impossible de capturer hors rencontre sauvage (la capsule n'est pas perdue)", () => {
    const b = startBattle("brocolis-porte", team(), 3);
    const r = playTurn(b, { kind: "item", item: "capsule-echo" });
    expect(r.events.some((e) => e.kind === "capture")).toBe(false);
    expect(r.battle.bag["capsule-echo"]).toBe(5);
    expect(r.battle.used["capsule-echo"] ?? 0).toBe(0);
  });
  it("Brokito capturé combat dans l'équipe, à son propre niveau", () => {
    const b = startBattle("brocolis-porte", team({ level: 9, party: ["brokito", "chevalier"], mons: { brokito: { level: 4 } } }), 7);
    expect(b.allies.map((x) => x.id)).toEqual(["sparrow", "brokito", "chevalier"]);
    expect(b.allies[1].lv).toBe(4);
    expect(b.allies[0].lv).toBe(9);
    let st = playTurn(b, { kind: "swap", to: 1 }).battle;
    expect(ally(st).id).toBe("brokito");
    st = playTurn(st, { kind: "move", move: "fouet-tige" }).battle;
    expect(st.turn).toBe(2);
    expect(makeAlly("brokito", { level: 20, gear: {}, skills: [], mons: { brokito: { level: 4 } } }).lv).toBe(4);
  });
});

describe("Capture — Bestiaire et sauvegarde", () => {
  it("capture, expérience, montée de niveau", () => {
    let r = addCaught(emptyRpg(), "brokito", 5, 1000);
    expect(isSeen(r, "brokito")).toBe(true);
    expect(r.mons!.brokito).toEqual({ level: 5, xp: 0, caught: 1000 });
    // Au Bestiaire seulement : pas d'expérience
    expect(monsGainXp(r, 500).rpg.mons!.brokito.xp).toBe(0);
    r = toggleTeam(r, "brokito");
    expect(r.party).toEqual(["brokito"]);
    const g = monsGainXp(r, xpNeed(5) + 3);
    expect(g.rpg.mons!.brokito).toMatchObject({ level: 6, xp: 3 });
    expect(g.ups[0]).toMatch(/niveau 6/);
    // Recapturer garde le meilleur niveau
    expect(addCaught(g.rpg, "brokito", 3, 2000).mons!.brokito.level).toBe(6);
  });
  it("équipe pleine : Brokito passe devant, le dernier compagnon reste en réserve (jamais perdu)", () => {
    let r: Rpg = addCaught({ ...emptyRpg(), party: ["chevalier", "gerard", "lili", "pokeyz"] }, "brokito", 8, 1);
    r = toggleTeam(r, "brokito");
    expect(r.party).toEqual(["brokito", "chevalier", "gerard", "lili", "pokeyz"]);
    expect(r.party.slice(0, ACTIVE)).not.toContain("pokeyz");
    const b = startBattle("brokito-sauvage", { level: 10, party: r.party, gear: {}, skills: [], bag: {}, mons: r.mons }, 1);
    expect(b.allies.map((x) => x.id)).toEqual(["sparrow", "brokito", "chevalier", "gerard", "lili"]);
    r = toggleTeam(r, "brokito");
    expect(r.party).toEqual(["chevalier", "gerard", "lili", "pokeyz"]);
    // Une créature non capturée ne peut pas rejoindre l'équipe
    expect(toggleTeam(emptyRpg(), "brokito").party).toEqual([]);
  });
  it("la sauvegarde garde la capture (aller-retour JSON, comme une fermeture de l'app)", () => {
    const r = toggleTeam(addCaught({ ...emptyRpg(), party: ["chevalier"] }, "brokito", 7, 123), "brokito");
    const back = restoreRpg(JSON.parse(JSON.stringify(r)));
    expect(back.mons).toEqual({ brokito: { level: 7, xp: 0, caught: 123 } });
    expect(back.party).toEqual(["brokito", "chevalier"]);
    expect(back.flags).toContain("vu:brokito");
  });
  it("les anciennes sauvegardes se chargent sans créature, et les données abîmées sont ignorées", () => {
    const old = { ...emptyRpg(), party: ["chevalier"] } as Partial<Rpg>;
    delete old.mons;
    expect(restoreRpg(JSON.parse(JSON.stringify(old))).mons ?? {}).toEqual({});
    expect(restoreRpg({ mons: { brokito: { level: "x" }, autre: null, bon: { level: 3.7, xp: -4 } } }).mons).toEqual({ bon: { level: 3, xp: 0, caught: 0 } });
  });
});
