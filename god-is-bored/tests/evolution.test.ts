import { describe, expect, it } from "vitest";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { SaveManager } from "../src/sim/SaveManager";
import { ERA_GOLD, ERA_MIN_TECH, ERA_POP, TECHS, eraOfTech, isUnlocked, setTech } from "../src/sim/TechTree";
import { TICKS_PER_YEAR } from "../src/sim/config";
import { buildingModel, geometryFingerprint, modelKey, vertexCount, MIN_ERA } from "../src/render/models";
import { armyProp, citizenBody, citizenHead, soldierGear } from "../src/render/units";
import type { BuildingType, Civ } from "../src/sim/types";

const mk = (seed = 42) => SimulationEngine.create(seed);

/** Aide légitime au test : on finance la recherche (les systèmes réels font le reste : découvertes, époques, chantiers). */
function boost(sim: SimulationEngine, civ: Civ, years: number): void {
  for (let y = 0; y < years; y++) {
    civ.techProg += 120;
    civ.gold += 60;
    sim.runYears(1);
  }
}
function peace(sim: SimulationEngine): void {
  for (const a of sim.civs) for (const b of sim.civs) if (a.id < b.id) sim.truce[sim.pairKey(a.id, b.id)] = 1e9;
}

describe("Technologies et époques : état réel de la simulation", () => {
  it("une civilisation avancée possède réellement toutes les connaissances de son époque", () => {
    const sim = mk(42);
    peace(sim);
    const civ = sim.civs[0];
    boost(sim, civ, 260);
    expect(civ.era).toBeGreaterThanOrEqual(3);
    // liste des technologies cohérente avec le niveau
    expect(civ.techs.length).toBe(civ.tech + 1);
    expect(civ.techs).toEqual(TECHS.slice(0, civ.tech + 1).map((t) => t.id));
    // l'époque est permise par la technologie : la première techno de chaque époque franchie est connue
    for (let e = 1; e <= civ.era; e++) expect(civ.techs).toContain(TECHS[ERA_MIN_TECH[e]].id);
    expect(civ.era).toBeLessThanOrEqual(eraOfTech(civ.tech));
    // chaque type de bâtiment « avancé » existant a été débloqué par une technologie connue
    const advanced: Partial<Record<BuildingType, string>> = { factory: "steam", station: "steam", power: "engine", lab: "ai", forge: "iron", market: "masonry", mill: "medicine" };
    for (const b of sim.buildings) {
      if (b.civ !== civ.id) continue;
      const need = advanced[b.type];
      if (need) expect(civ.techs, `${b.type} sans ${need}`).toContain(need);
    }
  });

  it("l'époque ne dépend jamais de l'année seule : population, or, stabilité et technologie sont exigés", () => {
    const sim = mk(7);
    peace(sim);
    const civ = sim.civs[0];
    sim.runYears(2);
    // technologie maximale octroyée d'un coup, mais population / or / stabilité insuffisants
    setTech(civ, 11);
    civ.gold = 0;
    for (let i = 0; i < 5; i++) sim.runYears(1);
    expect(civ.era).toBeLessThanOrEqual(1);
    expect(civ.era).toBeLessThan(eraOfTech(civ.tech));
    // avec de l'or mais une stabilité nulle : pas de progrès
    civ.gold = 5000; civ.stability = 0;
    const era0 = civ.era;
    sim.civSys.evaluateEra(sim, civ);
    expect(civ.era).toBe(era0);
    // conditions réunies : l'époque avance d'un cran à la fois
    civ.stability = 80; civ.gold = 5000;
    const before = civ.era;
    sim.civSys.evaluateEra(sim, civ);
    if (civ.pop >= ERA_POP[before + 1]) expect(civ.era).toBe(before + 1);
    else expect(civ.era).toBe(before);
    expect(ERA_GOLD[1]).toBeGreaterThan(0);
  });

  it("deux civilisations peuvent être à des époques différentes au même moment", () => {
    const sim = mk(42);
    peace(sim);
    const [a, b] = sim.civs;
    boost(sim, a, 240);
    expect(a.era).toBeGreaterThan(b.era);
    expect(sim.civs.filter((c) => c.alive).length).toBeGreaterThanOrEqual(2);
    expect(new Set(sim.civs.filter((c) => c.alive).map((c) => c.era)).size).toBeGreaterThanOrEqual(2);
  });

  it("une civilisation peut stagner ou régresser après un effondrement", () => {
    const sim = mk(42);
    peace(sim);
    const civ = sim.civs[0];
    boost(sim, civ, 200);
    const high = civ.era;
    expect(high).toBeGreaterThanOrEqual(2);
    setTech(civ, 3); // perte de savoir
    civ.stability = 60;
    sim.civSys.evaluateEra(sim, civ);
    expect(civ.era).toBe(eraOfTech(3));
    expect(civ.era).toBeLessThan(high);
    // les bâtiments modernes restent debout (rien ne disparaît)
    expect(sim.buildings.some((b) => b.civ === civ.id && b.era >= high)).toBe(true);
    expect(isUnlocked(civ, "factory")).toBe(false);
    // déclin par effondrement de population
    civ.era = 2; civ.tech = 8; setTech(civ, 8);
    civ.eraLow = 0;
    let keep = 8;
    for (const c of sim.citizens) if (c.civ === civ.id && keep-- <= 0) sim.killCitizen(c, "unrest");
    sim.removeDead();
    sim.citizenSys.census(sim);
    for (let i = 0; i < 8; i++) sim.civSys.evaluateEra(sim, civ);
    expect(civ.era).toBeLessThan(2);
  });
});

describe("Bâtiments : évolution progressive sans disparition arbitraire", () => {
  it("les bâtiments sont modernisés un cran à la fois, gardent leur identité historique et ne disparaissent pas", () => {
    const sim = mk(42);
    peace(sim);
    // pas de catastrophe naturelle : on retire les sécheresses/feux aléatoires en restant en paix ; aucune guerre
    const civ = sim.civs[0];
    sim.runYears(3);
    const initial = sim.buildings.filter((b) => b.civ === civ.id && b.progress >= 1).map((b) => ({ id: b.id, era: b.era, type: b.type }));
    expect(initial.length).toBeGreaterThan(3);
    const eraTrack = new Map<number, number>(initial.map((b) => [b.id, b.era]));
    for (let y = 0; y < 220; y++) {
      civ.techProg += 120; civ.gold += 60;
      sim.runYears(1);
      for (const b of sim.buildings) {
        const prev = eraTrack.get(b.id);
        if (prev !== undefined && b.hp >= 0) {
          expect(b.era).toBeGreaterThanOrEqual(prev); // jamais de retour en arrière arbitraire
          expect(b.era - prev).toBeLessThanOrEqual(1 + (y % 1)); // pas de saut brutal : un cran à la fois
          eraTrack.set(b.id, b.era);
        }
      }
    }
    const ids = new Set(sim.buildings.filter((b) => b.hp >= 0).map((b) => b.id));
    const lost = initial.filter((b) => !ids.has(b.id));
    expect(lost.length, "bâtiments disparus").toBe(0);
    const now = sim.buildings.filter((b) => initial.some((i) => i.id === b.id));
    expect(now.some((b) => b.era > (initial.find((i) => i.id === b.id)!.era))).toBe(true); // certains ont été modernisés
    expect(sim.stats.upgrades).toBeGreaterThan(5);
    // une ville garde des bâtiments historiques d'époques précédentes
    expect(sim.buildings.some((b) => b.civ === civ.id && b.era < civ.era)).toBe(true);
    // toute modernisation en cours reste un bâtiment debout, à un seul cran du niveau actuel
    for (const b of sim.buildings) if (b.up >= 0) { expect(b.progress).toBe(1); expect(b.upTo).toBe(b.era + 1); }
  });

  it("la capacité des maisons dépend de leur époque (effet réel de la modernisation)", () => {
    const sim = mk(42);
    const city = sim.cities[0];
    const base = sim.econ.cityCap(sim, city.id);
    for (const b of sim.buildings) if (b.city === city.id && b.type === "house") b.era = 4;
    expect(sim.econ.cityCap(sim, city.id)).toBeGreaterThan(base);
  });

  it("les bâtiments avancés ont des effets réels (moulins, marchés, laboratoires)", () => {
    const sim = mk(42);
    const civ = sim.civs[0];
    const city = sim.cities.find((c) => c.civ === civ.id)!;
    const add = (t: BuildingType, x: number) => sim.addBuilding(t, civ.id, city.id, city.x + x, city.y + 5, true, 4);
    const f0 = civ.mods.farm, g0 = civ.mods.gold, t0 = civ.mods.tech;
    add("mill", 0); add("market", 1); add("lab", 2);
    sim.civSys.recomputeMods(sim, civ);
    expect(civ.mods.farm).toBeGreaterThan(f0);
    expect(civ.mods.gold).toBeGreaterThan(g0);
    expect(civ.mods.tech).toBeGreaterThan(t0);
  });
});

describe("Représentation visuelle liée à l'état réel", () => {
  const types: BuildingType[] = ["house", "hall", "farm", "lumber", "quarry", "barracks", "temple", "castle", "market", "walls", "mill", "forge", "factory", "station", "power", "lab"];

  it("chaque époque a un modèle visuellement distinct pour les types principaux", () => {
    for (const t of ["house", "hall", "farm", "lumber", "quarry", "barracks", "temple"] as BuildingType[]) {
      const prints = new Set<string>();
      for (let e = 0; e <= 5; e++) prints.add(geometryFingerprint(buildingModel(t, e, 0).body) + geometryFingerprint(buildingModel(t, e, 0).accent));
      expect(prints.size, `${t} : 6 époques distinctes`).toBe(6);
    }
    for (const t of types) {
      const min = MIN_ERA[t] ?? 0;
      const prints = new Set<string>();
      for (let e = min; e <= 5; e++) prints.add(modelKey(t, e, 0) + geometryFingerprint(buildingModel(t, e, 0).body));
      expect(prints.size).toBeGreaterThanOrEqual(Math.min(3, 6 - min));
    }
  });

  it("à niveau technologique identique, les civilisations gardent une identité visuelle propre", () => {
    for (let e = 0; e <= 2; e++) {
      const prints = new Set([0, 1, 2, 3].map((s) => geometryFingerprint(buildingModel("house", e, s).body) + geometryFingerprint(buildingModel("house", e, s).accent)));
      expect(prints.size, `maisons d'époque ${e}`).toBe(4);
    }
    for (let e = 0; e <= 5; e++) {
      const prints = new Set([0, 1, 2, 3].map((s) => geometryFingerprint(buildingModel("hall", e, s).accent)));
      expect(prints.size, `hôtels de ville d'époque ${e}`).toBe(4);
    }
    const sim = mk(42);
    expect(new Set(sim.civs.map((c) => c.color)).size).toBe(3);
  });

  it("les habitants et les armées changent visuellement avec l'époque", () => {
    const bodies = new Set(), heads = new Set(), gear = new Set(), props = new Set();
    for (let e = 0; e <= 5; e++) {
      bodies.add(geometryFingerprint(citizenBody(e)));
      heads.add(geometryFingerprint(citizenHead(e)));
      gear.add(geometryFingerprint(soldierGear(e)));
      props.add(geometryFingerprint(armyProp(e)));
    }
    expect(bodies.size).toBe(6);
    expect(heads.size).toBe(6);
    expect(gear.size).toBe(6);
    expect(props.size).toBe(6);
  });

  it("budget géométrique compatible Safari iPhone", () => {
    let total = 0, max = 0, models = 0;
    for (const t of types) for (let e = MIN_ERA[t] ?? 0; e <= 5; e++) {
      const m = buildingModel(t, e, 0);
      const v = vertexCount(m.body) + vertexCount(m.accent);
      total += v; max = Math.max(max, v); models++;
    }
    expect(max).toBeLessThan(2600);
    expect(total / models).toBeLessThan(900);
    for (let e = 0; e <= 5; e++) {
      expect(vertexCount(citizenBody(e)) + vertexCount(citizenHead(e))).toBeLessThan(350);
      expect(vertexCount(soldierGear(e))).toBeLessThan(260);
    }
  });
});

describe("Sauvegarde de l'évolution", () => {
  it("les époques, technologies, bâtiments modernisés et remparts survivent à la sauvegarde", () => {
    const sim = mk(42);
    peace(sim);
    boost(sim, sim.civs[0], 170);
    const civ = sim.civs[0];
    const city = sim.cities.find((c) => c.civ === civ.id)!;
    city.walls = 2;
    const up = sim.buildings.find((b) => b.civ === civ.id && b.progress >= 1 && b.type === "house")!;
    up.up = 0.4; up.upTo = up.era + 1;
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    expect(SaveManager.save(sim, storage).ok).toBe(true);
    const loaded = SaveManager.load(storage)!;
    expect(loaded).not.toBeNull();
    for (const c of sim.civs) {
      const l = loaded.civById.get(c.id)!;
      expect([l.era, l.tech, l.eraSince, l.style, l.techs.join(",")]).toEqual([c.era, c.tech, c.eraSince, c.style, c.techs.join(",")]);
      expect(l.mods).toEqual(c.mods);
    }
    expect(loaded.buildings.map((b) => [b.id, b.type, b.era, b.up, b.upTo])).toEqual(sim.buildings.map((b) => [b.id, b.type, b.era, b.up, b.upTo]));
    expect(loaded.cityById.get(city.id)!.walls).toBe(2);
    expect(loaded.stats.upgrades).toBe(sim.stats.upgrades);
    loaded.runYears(40);
    expect(loaded.citizens.length).toBeGreaterThan(0);
  });

  it("une ancienne sauvegarde sans époques est migrée proprement", () => {
    const sim = mk(42);
    sim.runYears(30);
    const data = JSON.parse(SaveManager.serialize(sim));
    for (const c of data.civs) { delete c.techs; delete c.era; delete c.eraSince; delete c.eraLow; delete c.style; delete c.mods; }
    for (const c of data.cities) delete c.walls;
    for (const b of data.buildings) { delete b.era; delete b.up; delete b.upTo; }
    const loaded = SaveManager.deserialize(JSON.stringify(data));
    for (const c of loaded.civs) { expect(c.techs.length).toBe(c.tech + 1); expect(c.mods.farm).toBe(1); }
    expect(loaded.buildings.every((b) => b.era === 0 && b.up === -1)).toBe(true);
    loaded.runYears(20);
    expect(loaded.citizens.length).toBeGreaterThan(0);
  });
});

describe("Évolution sur plusieurs siècles (organique)", () => {
  it("sans aide : les civilisations évoluent à des rythmes différents et le monde reste cohérent", () => {
    const sim = mk(42);
    sim.runYears(300);
    const alive = sim.aliveCivs();
    const eras = alive.map((c) => c.era);
    expect(Math.max(...eras)).toBeGreaterThanOrEqual(3);
    expect(new Set(eras).size).toBeGreaterThanOrEqual(2);
    for (const c of sim.civs) { expect(c.era).toBeLessThanOrEqual(eraOfTech(c.tech)); expect(c.techs.length).toBe(c.tech + 1); }
    for (const b of sim.buildings) { expect(b.era).toBeGreaterThanOrEqual(0); expect(b.era).toBeLessThanOrEqual(5); }
    expect(sim.citizens.length).toBeLessThan(3000);
    expect(TICKS_PER_YEAR).toBe(30);
  });
});
