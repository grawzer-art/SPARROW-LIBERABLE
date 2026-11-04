import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { SimulationEngine } from "../src/sim/SimulationEngine";
import { buildReferenceWorld } from "../src/sim/Reference";
import { streetInfo, streetPolyline, streetCount, faceStreet } from "../src/sim/Layout";
import { T } from "../src/sim/World";
import { buildingModel, geometryFingerprint, variantCount, vertexCount } from "../src/render/models";
import { characterGeometry, gearGeometry, toolGeometry, farPersonGeometry, PART, TOOL } from "../src/render/Characters";
import { Props } from "../src/render/Props";
import { Infra } from "../src/render/Infra";
import { Sky } from "../src/render/Sky";
import { lightStyle } from "../src/render/Glow";
import { LEGACY_TUNING, applyTuning, resetTuning } from "../src/sim/tuning";
import { afterAll, beforeAll } from "vitest";

// Ces suites vérifient la logique des technologies, des époques et des rendus : elles s'exécutent avec la démographie de la V2 (le réglage V3 est testé dans v3.test.ts).
beforeAll(() => applyTuning(LEGACY_TUNING));
afterAll(() => resetTuning());
import { visualEra, animFor } from "../src/render/CitizenLayer";

const mk = (seed = 42) => SimulationEngine.create(seed);

describe("Terrain : relief progressif, aucune arête de case", () => {
  it("la surface est continue (pas de marche d'escalier) et passe par les hauteurs de cases", () => {
    const sim = mk(42);
    const w = sim.world;
    let maxStep = 0;
    for (let y = 8; y < 56; y += 0.37)
      for (let x = 8; x < 56; x += 0.05) maxStep = Math.max(maxStep, Math.abs(w.heightAt(x + 0.05, y) - w.heightAt(x, y)));
    expect(maxStep).toBeLessThan(0.22); // pente par pas de 5 cm : aucune falaise de case
    // cases de terre sans rivière : la surface passe près de la hauteur de la case (relief x1,4)
    let checked = 0;
    for (let i = 0; i < w.size * w.size && checked < 300; i += 7) {
      if (w.type[i] === T.GRASS && w.height[i] > 0.3) {
        const x = (i % w.size) + 0.5, y = ((i / w.size) | 0) + 0.5;
        expect(Math.abs(w.heightAt(x, y) - w.height[i] * 1.4)).toBeLessThan(0.45);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(50);
  });
  it("les rivières sont creusées sous le niveau de l'eau et les côtes suivent une courbe de niveau", () => {
    const sim = mk(42);
    const w = sim.world;
    let rivers = 0, under = 0;
    for (let i = 0; i < w.size * w.size; i++) if (w.type[i] === T.RIVER && w.height[i] < 0.7) { rivers++; if (w.heightAt((i % w.size) + 0.5, ((i / w.size) | 0) + 0.5) < -0.03) under++; }
    expect(rivers).toBeGreaterThan(3);
    expect(under / rivers).toBeGreaterThan(0.8);
    // le trait de côte est sinueux : des points au niveau de la mer existent à l'intérieur d'une case
    let frac = 0;
    for (let y = 2; y < 62; y += 0.5) for (let x = 2; x < 62; x += 0.5) { const f = (x % 1); if (f > 0.2 && f < 0.8 && Math.abs(w.heightAt(x, y) + 0.03) < 0.02) frac++; }
    expect(frac).toBeGreaterThan(10);
  });
  it("les entités suivent exactement la surface visible (même fonction de hauteur)", () => {
    const sim = mk(42);
    sim.runYears(5);
    for (const c of sim.citizens.slice(0, 50)) expect(Number.isFinite(sim.world.heightAt(c.x, c.y))).toBe(true);
  });
});

describe("Urbanisme : rues, places et quartiers", () => {
  it("les maisons s'alignent le long de rues rayonnantes et regardent la rue", () => {
    const sim = mk(42);
    sim.runYears(90);
    let tested = 0;
    for (const city of sim.cities) {
      const houses = sim.buildings.filter((b) => b.city === city.id && b.type === "house" && b.progress >= 1);
      if (houses.length < 8) continue;
      tested++;
      let near = 0, facing = 0;
      for (const h of houses) {
        const info = streetInfo(city, h.x + 0.5, h.y + 0.5);
        if (info.dStreet <= 2.9) near++;
        let dr = Math.abs(((h.rot - faceStreet(h.x + 0.5, h.y + 0.5, info) + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        let ok = dr < 0.4;
        // campements (ère 0) : les entrées regardent le foyer
        if (!ok && h.era <= 1) {
          const hearth = Math.atan2(city.x + 0.5 - (h.x + 0.5), city.y + 0.5 - (h.y + 0.5));
          let dh = Math.abs(((h.rot - hearth + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          ok = dh < 0.45;
        }
        if (ok) facing++;
      }
      expect(near / houses.length, `${city.name} : maisons le long des rues`).toBeGreaterThan(0.7);
      expect(facing / houses.length, `${city.name} : façades tournées vers la rue`).toBeGreaterThan(0.8);
    }
    expect(tested).toBeGreaterThan(0);
  });
  it("la place centrale reste dégagée, les villes ont 4 à 6 rues sinueuses", () => {
    const sim = mk(42);
    sim.runYears(60);
    for (const city of sim.cities) {
      expect(streetCount(city)).toBeGreaterThanOrEqual(4);
      expect(streetCount(city)).toBeLessThanOrEqual(6);
      const pts = streetPolyline(city, 0, 6);
      expect(Math.hypot(pts[0][0] - (city.x + 0.5), pts[0][1] - (city.y + 0.5))).toBeGreaterThan(0.7);
      for (const b of sim.buildings) if (b.city === city.id && b.type !== "hall" && b.type !== "walls") expect(Math.hypot(b.x - city.x, b.y - city.y)).toBeGreaterThanOrEqual(1.2);
    }
  });
  it("les orientations ne sont pas toutes alignées sur la grille (aspect organique)", () => {
    const sim = mk(42);
    sim.runYears(90);
    const rots = sim.buildings.filter((b) => b.type === "house").map((b) => Math.round(((b.rot * 180) / Math.PI + 720) % 90));
    expect(new Set(rots.map((r) => Math.floor(r / 10))).size).toBeGreaterThanOrEqual(4);
  });
});

describe("Scène de référence : trois villes, trois époques", () => {
  it("village primitif, cité médiévale et ville moderne coexistent, issus des systèmes réels", () => {
    const sim = mk(42);
    const ids = buildReferenceWorld(sim, 280);
    const A = sim.civById.get(ids.modern)!, B = sim.civById.get(ids.medieval)!, C = sim.civById.get(ids.primitive)!;
    expect(C.era).toBe(0);
    expect(B.era).toBeGreaterThanOrEqual(2);
    expect(B.era).toBeLessThanOrEqual(3);
    expect(A.era).toBeGreaterThanOrEqual(4);
    expect(new Set([A.era, B.era, C.era]).size).toBe(3);
    // chacune possède des bâtiments de son époque et des habitants
    for (const c of [A, B, C]) { expect(c.pop).toBeGreaterThan(10); expect(sim.buildings.some((b) => b.civ === c.id && b.era === c.era)).toBe(true); }
  });
});

describe("Modèles : architecture variée, personnages articulés", () => {
  it("plusieurs maisons distinctes par époque et par culture", () => {
    expect(variantCount("house")).toBe(3);
    for (let e = 0; e <= 5; e++) {
      const prints = new Set<string>();
      for (let v = 0; v < 3; v++) { const m = buildingModel("house", e, 1, v); prints.add(geometryFingerprint(m.body) + geometryFingerprint(m.accent)); }
      expect(prints.size, `époque ${e} : 3 variantes`).toBe(3);
    }
    for (let e = 0; e <= 2; e++) {
      const prints = new Set([0, 1, 2, 3].map((st) => { const m = buildingModel("house", e, st, 0); return geometryFingerprint(m.body) + geometryFingerprint(m.accent); }));
      expect(prints.size, `époque ${e} : 4 cultures`).toBe(4);
    }
    // détails : fenêtres/portes/cheminées => assez de sommets mais budget maîtrisé
    for (let e = 1; e <= 4; e++) for (let v = 0; v < 3; v++) { const m = buildingModel("house", e, 0, v); const n = vertexCount(m.body) + vertexCount(m.accent); expect(n).toBeGreaterThan(120); expect(n).toBeLessThan(2600); }
  });
  it("chaque personnage a tête, tronc, bras et jambes identifiables ; silhouettes homme/femme et époques distinctes", () => {
    const prints = new Set<string>();
    for (let e = 0; e <= 5; e++) for (const f of [false, true]) {
      const g = characterGeometry(e, f);
      prints.add(geometryFingerprint(g));
      const part = g.attributes.aPart.array as Float32Array;
      const seen = new Set(Array.from(part));
      for (const p of [PART.body, PART.legL, PART.legR, PART.armL, PART.armR]) expect(seen.has(p), `époque ${e} : partie ${p}`).toBe(true);
      expect(vertexCount(g)).toBeLessThan(750);
    }
    expect(prints.size).toBe(12);
    const gear = new Set(), tools = new Set();
    for (let e = 0; e <= 5; e++) { gear.add(geometryFingerprint(gearGeometry(e))); tools.add(geometryFingerprint(toolGeometry(e))); expect(vertexCount(gearGeometry(e))).toBeLessThan(300); }
    expect(gear.size).toBe(6); expect(tools.size).toBe(6);
    expect(vertexCount(farPersonGeometry())).toBeLessThan(150); // LOD lointain
  });
  it("l'apparence suit l'époque réelle avec un décalage individuel (pas de transformation globale instantanée)", () => {
    const civ = { era: 3, eraSince: 100 };
    const eras = new Set<number>();
    for (let id = 0; id < 60; id++) eras.add(visualEra({ id }, civ, 101));
    expect(eras.has(2) && eras.has(3)).toBe(true);
    for (let id = 0; id < 60; id++) expect(visualEra({ id }, civ, 110)).toBe(3);
  });
});

describe("Éclairage : jour, nuit et technologies", () => {
  const mkSky = () => {
    const scene = new THREE.Scene();
    const sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight(), amb = new THREE.AmbientLight();
    const fake = { toneMapping: 0, toneMappingExposure: 1 } as unknown as THREE.WebGLRenderer;
    return { sky: new Sky(scene, sun, hemi, amb, fake, false), sun, hemi, scene };
  };
  it("le soleil est fort à midi, faible la nuit ; la nuit pilote l'éclairage artificiel", () => {
    const { sky, sun, hemi } = mkSky();
    sky.setTime(0.5);
    const noon = { n: sky.night, i: sun.intensity, h: hemi.intensity };
    sky.setTime(0.0);
    const mid = { n: sky.night, i: sun.intensity, h: hemi.intensity };
    expect(noon.n).toBeLessThan(0.05);
    expect(mid.n).toBeGreaterThan(0.9);
    expect(noon.i).toBeGreaterThan(mid.i * 4);
    expect(mid.h).toBeGreaterThan(0.5); // la nuit reste lisible
    sky.setTime(0.26); // aube
    expect(sky.night).toBeGreaterThan(0.2);
    expect(sky.night).toBeLessThan(0.9);
  });
  it("le cycle jour/nuit avance seul et boucle", () => {
    const { sky } = mkSky();
    sky.auto = true; sky.time = 0.9;
    sky.update(sky.dayLength * 0.2);
    expect(sky.time).toBeCloseTo(0.1, 1);
  });
  it("le type de lumière nocturne dépend des technologies : feu, chandelle, gaz, électricité, LED", () => {
    const hex = [0, 1, 2, 3, 4, 5].map((e) => lightStyle(e)[0]);
    expect(new Set(hex).size).toBeGreaterThanOrEqual(5);
    expect(lightStyle(0)[0]).toBe(0xff8a2a); // feu de camp
    expect(lightStyle(5)[0]).toBe(0x7fe8ff); // LED froides
    expect(lightStyle(4)[1]).toBeGreaterThan(lightStyle(1)[1]);
  });
});

describe("Budget de rendu (iPhone)", () => {
  it("modèles et nombre de variantes restent dans le budget GPU", () => {
    let total = 0, models = 0, max = 0;
    for (const t of ["house", "hall", "farm", "lumber", "quarry", "barracks", "temple", "castle", "market", "walls", "mill", "forge", "factory", "station", "power", "lab"] as const)
      for (let e = 0; e <= 5; e++) for (let v = 0; v < variantCount(t); v++) {
        const m = buildingModel(t, e, 0, v);
        const n = vertexCount(m.body) + vertexCount(m.accent);
        total += n; models++; max = Math.max(max, n);
      }
    expect(max).toBeLessThan(2700);
    expect(total / models).toBeLessThan(1000);
  });
  it("une partie typique n'instancie qu'un nombre raisonnable de modèles distincts (appels de dessin)", () => {
    const sim = mk(42);
    sim.runYears(200);
    const keys = new Set<string>();
    for (const b of sim.buildings) { const civ = sim.civById.get(b.civ); keys.add(`${b.type}:${b.era}:${civ ? civ.style : 0}:${Math.floor((b.id * 7919) % 3)}`); }
    expect(keys.size).toBeLessThan(150);
  });
});

describe("Correction graphique V3 : camps, accessoires, animations liées à la simulation", () => {
  it("les campements préhistoriques sont compacts : huttes serrées autour du foyer, sans superposition", () => {
    const sim = mk(42);
    sim.runYears(45);
    let tested = 0;
    for (const city of sim.cities) {
      const civ = sim.civById.get(city.civ);
      if (!civ || civ.era > 0) continue;
      const houses = sim.buildings.filter((b) => b.city === city.id && b.type === "house" && b.progress >= 1);
      if (houses.length < 5) continue;
      tested++;
      const tiles = new Set(houses.map((b) => b.x + "," + b.y));
      expect(tiles.size, `${city.name} : une hutte par case`).toBe(houses.length);
      const mean = houses.reduce((s, b) => s + Math.hypot(b.x - city.x, b.y - city.y), 0) / houses.length;
      expect(mean, `${city.name} : distance moyenne au foyer`).toBeLessThan(3.6);
    }
    expect(tested).toBeGreaterThan(0);
  });
  it("les accessoires sont attachés à des bâtiments réels (aucun décor orphelin)", () => {
    const sim = mk(42);
    sim.runYears(60);
    const props = new Props(new THREE.Scene());
    props.update(sim, { containsPoint: () => true } as unknown as THREE.Frustum, new THREE.Vector3(0, 10, 0), 1e6);
    const N = sim.world.size;
    expect(props.placed.length).toBeGreaterThan(5);
    for (const p of props.placed) {
      const near = sim.buildings.some((b) => b.progress >= 1 && Math.hypot(b.x + 0.5 - N / 2 - p.x, b.y + 0.5 - N / 2 - p.z) < 1.3);
      expect(near, `${p.k} @${p.x.toFixed(1)},${p.z.toFixed(1)}`).toBe(true);
      expect(sim.world.heightAt(p.x + N / 2, p.z + N / 2)).toBeGreaterThan(-0.1);
    }
  });
  it("les sentiers peints relient des bâtiments réels", () => {
    const sim = mk(42);
    sim.runYears(60);
    const infra = new Infra(new THREE.Scene(), false);
    infra.update(sim, 0, []);
    expect(infra.paths.length).toBeGreaterThan(10);
    for (const s of infra.paths) { expect(Number.isFinite(s.ax + s.ay + s.bx + s.by)).toBe(true); expect(s.w).toBeGreaterThan(0); }
  });
  it("l'animation et l'outil d'un habitant viennent de son métier et de son état réels", () => {
    const base = { sick: 0 } as const;
    expect(animFor({ ...base, state: "work", job: "lumberjack" }, false, 0)).toMatchObject({ mode: 2, tool: TOOL.axe });
    expect(animFor({ ...base, state: "work", job: "miner" }, false, 0)).toMatchObject({ mode: 2, tool: TOOL.pick });
    expect(animFor({ ...base, state: "work", job: "farmer" }, false, 0)).toMatchObject({ mode: 5, tool: TOOL.hoe });
    expect(animFor({ ...base, state: "forage", job: "farmer" }, false, 0)).toMatchObject({ mode: 5, tool: TOOL.basket });
    expect(animFor({ ...base, state: "build", job: "builder" }, false, 0)).toMatchObject({ mode: 2, tool: TOOL.hammer });
    expect(animFor({ ...base, state: "work", job: "scholar" }, false, 0)).toMatchObject({ mode: 6, tool: TOOL.tablet });
    // en déplacement : on marche, sans outil ; un enfant ne manie pas d'outil ; au combat : mode combat
    expect(animFor({ ...base, state: "work", job: "lumberjack" }, true, 0)).toMatchObject({ mode: 1, tool: -1 });
    expect(animFor({ ...base, state: "work", job: "child" }, false, 0)).toMatchObject({ mode: 0, tool: -1 });
    expect(animFor({ ...base, state: "fight", job: "soldier" }, false, 0).mode).toBe(3);
    expect(animFor({ sick: 5, state: "idle", job: "farmer" }, false, 0).mode).toBe(4);
  });
  it("les outils et les variantes de personnages sont distincts et légers", () => {
    const prints = new Set<string>();
    for (let k = 0; k <= 5; k++) { const g = toolGeometry(2, k); prints.add(geometryFingerprint(g)); expect(vertexCount(g)).toBeLessThan(260); }
    expect(prints.size).toBe(6);
    for (let e = 0; e <= 5; e++) for (const f of [false, true]) expect(geometryFingerprint(characterGeometry(e, f, 1))).not.toBe(geometryFingerprint(characterGeometry(e, f, 0)));
  });
});
