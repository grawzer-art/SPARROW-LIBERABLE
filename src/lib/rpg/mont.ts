/**
 * RPG — cartes du chapitre 3 : le Mont Biscotto et le Temple de la Confrérie du Muscle.
 * Logique pure (testée dans tests/ch3.test.ts) ; le rendu est dans components/rpg/tiles*.ts.
 */

import { makeMap, type Dest, type Ground, type MapDef, type MapId } from "./mapdef";
import type { Rpg } from "./state";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const did = (r: Rpg, s: string) => r.done.includes(`confrerie:${s}`);
/** La porte du sanctuaire s'ouvre quand Sparrow a éveillé le Titan. */
export const sanctuaireOuvert = (r: Rpg) => did(r, "titan");
export const templeOuvert = (r: Rpg) => flag(r, "temple-ouvert");

// ─── Sentier du Mont Biscotto ───

function sentier(): MapDef {
  const M = makeMap("sentier", "Sentier du Mont Biscotto", 24, 40, "aube", "herbe");
  const { fill, add, def } = M;
  // Rivière et pont étroit
  fill("eau", 1, 17, 22, 18);
  fill("pont", 5, 17, 5, 18);
  // Sentier qui serpente
  fill("chemin", 11, 30, 12, 39);
  fill("chemin", 11, 30, 18, 31);
  fill("chemin", 17, 22, 18, 31);
  fill("chemin", 5, 22, 18, 23);
  fill("chemin", 5, 13, 6, 21);
  fill("chemin", 5, 12, 12, 13);
  fill("chemin", 11, 0, 12, 13);
  fill("chemin", 13, 13, 16, 13);
  fill("roche", 1, 1, 9, 6);
  fill("roche", 14, 1, 22, 6);
  fill("fleurs", 2, 33, 6, 35);
  // Forêt tout autour (et deux murs d'arbres qui forment le col du sommet)
  for (let y = 2; y < 40; y += 2) {
    add({ kind: "sapin", x: 0, y, w: 1, h: 2, solidRows: 2 });
    add({ kind: "sapin", x: 23, y, w: 1, h: 2, solidRows: 2 });
  }
  for (const x of [0, 2, 4, 6, 8, 13, 15, 17, 19, 21]) add({ kind: "arbre", x, y: 0, w: 2, h: 2, solidRows: 2 });
  add({ kind: "sapin", x: 10, y: 0, w: 1, h: 2, solidRows: 2 });
  for (const y of [2, 4]) {
    add({ kind: "sapin", x: 10, y, w: 1, h: 2, solidRows: 2 });
    add({ kind: "sapin", x: 13, y, w: 1, h: 2, solidRows: 2 });
  }
  // Rochers et sapins épars
  for (const [x, y, w] of [
    [3, 30, 2],
    [20, 34, 1],
    [8, 26, 2],
    [20, 14, 2],
    [2, 9, 1],
    [8, 8, 1],
    [15, 26, 1],
    [2, 22, 1],
  ] as const)
    add({ kind: "rocher", x, y, w, h: w, solidRows: w });
  for (const [x, y] of [
    [3, 36],
    [8, 33],
    [15, 36],
    [20, 29],
    [9, 19],
    [14, 19],
    [19, 20],
    [2, 13],
    [9, 15],
    [20, 9],
  ])
    add({ kind: "sapin", x, y, w: 1, h: 2, solidRows: 1 });
  add({ kind: "panneau", x: 13, y: 37, w: 1, h: 1, text: "MONT BISCOTTO" });
  add({ kind: "panneau", x: 7, y: 21, w: 1, h: 1, text: "PONT DU SHAKER" });
  // Refuge
  add({ kind: "batiment", x: 14, y: 8, w: 6, h: 5, b: { name: "Refuge", style: "echoppe", roof: "ardoise", door: 16, sign: "REFUGE", lit: 3 } });

  const toCite = (x: number): Dest => ({ map: "cite", x, y: 1, dir: "down" });
  def.warps.push(
    { id: "bas-1", at: { x: 11, y: 39 }, dir: "down", to: toCite(33) },
    { id: "bas-2", at: { x: 12, y: 39 }, dir: "down", to: toCite(34) },
    { id: "refuge", at: { x: 16, y: 12 }, to: { map: "refuge", x: 5, y: 6, dir: "up" } },
    { id: "col-1", at: { x: 11, y: 0 }, dir: "up", to: { map: "temple-cour", x: 12, y: 20, dir: "up" } },
    { id: "col-2", at: { x: 12, y: 0 }, dir: "up", to: { map: "temple-cour", x: 13, y: 20, dir: "up" } },
  );
  def.spawn = { x: 11, y: 38, dir: "up" };
  def.zones.push(
    { id: "mont-bas", name: "Pied du Mont Biscotto", x1: 1, y1: 24, x2: 22, y2: 39 },
    { id: "mont-pont", name: "Pont du Shaker", x1: 1, y1: 15, x2: 22, y2: 21 },
    { id: "mont-col", name: "Col du Sommet", x1: 1, y1: 1, x2: 22, y2: 13 },
  );
  def.npcs.push(
    { id: "randonneur", name: "Randonneur épuisé", char: "randonneur", start: { x: 13, y: 33 }, dir: "left" },
    {
      id: "haltere",
      name: "Haltère Sauvage",
      char: "haltere",
      start: { x: 18, y: 25 },
      dir: "down",
      path: [{ x: 18, y: 25 }, { x: 18, y: 29 }],
      pause: 1.4,
      enemy: { battle: "haltere-1", sight: 3, defeated: "ko:haltere" },
    },
    { id: "proteinator", name: "Protéinator", char: "proteinator", start: { x: 5, y: 17 }, dir: "down", enemy: { battle: "proteinator", sight: 2, defeated: "ko:proteinator" } },
    { id: "halteres-1", name: "Haltère Sauvage", char: "haltere", start: { x: 11, y: 4 }, dir: "down", enemy: { battle: "halteres-2", sight: 3, defeated: "ko:halteres" } },
    { id: "halteres-2", name: "Haltère Sauvage", char: "haltere", start: { x: 12, y: 4 }, dir: "down", enemy: { battle: "halteres-2", sight: 3, defeated: "ko:halteres" } },
  );
  return def;
}

// ─── Refuge ───

function room(id: MapId, name: string, w: number, h: number, floor: Ground, door: number, back: Dest, region: MapDef["region"] = "interieur") {
  const M = makeMap(id, name, w, h, region, floor);
  M.fill("mur", 0, 0, w - 1, 1);
  M.fill("mur", 0, 0, 0, h - 1);
  M.fill("mur", w - 1, 0, w - 1, h - 1);
  M.fill("mur", 0, h - 1, w - 1, h - 1);
  M.def.ground[h - 1][door] = floor;
  M.def.warps.push({ id: "sortie", at: { x: door, y: h - 1 }, dir: "down", to: back });
  M.def.spawn = { x: door, y: h - 2, dir: "up" };
  return M;
}

function refuge(): MapDef {
  const M = room("refuge", "Refuge du Mont Biscotto", 10, 8, "parquet", 5, { map: "sentier", x: 16, y: 13, dir: "down" });
  M.add({ kind: "comptoir", x: 3, y: 3, w: 5, h: 1, variant: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "lit-int", x: 8, y: 2, w: 1, h: 2, variant: 1 });
  M.add({ kind: "brasero", x: 1, y: 5, w: 1, h: 1 });
  M.add({ kind: "table", x: 6, y: 5, w: 2, h: 1, variant: 1 });
  M.def.npcs.push(
    { id: "brenda", name: "Brenda", char: "brenda", start: { x: 5, y: 2 }, dir: "down" },
    { id: "alpiniste", name: "Vieil alpiniste", char: "randonneur", start: { x: 2, y: 4 }, dir: "right" },
  );
  return M.def;
}

// ─── Parvis du Temple ───

function templeCour(): MapDef {
  const M = makeMap("temple-cour", "Parvis du Temple", 26, 22, "aube", "herbe");
  const { fill, add, def } = M;
  fill("dalle", 5, 8, 20, 18);
  fill("chemin", 12, 19, 13, 21);
  fill("roche", 1, 1, 5, 6);
  fill("roche", 20, 1, 24, 6);
  for (let y = 0; y < 22; y += 2) {
    add({ kind: "sapin", x: 0, y, w: 1, h: 2, solidRows: 2 });
    // Passage à l'est (chapitre 4) vers le Chemin des Cerisiers
    if (y !== 10) add({ kind: "sapin", x: 25, y, w: 1, h: 2, solidRows: 2 });
  }
  fill("chemin", 21, 10, 25, 11);
  // Rangée d'arbres en bas (passage au milieu) et en haut (de part et d'autre du temple)
  for (const x of [1, 3, 5, 7, 9, 15, 17, 19, 21, 23]) add({ kind: "arbre", x, y: 20, w: 2, h: 2, solidRows: 2 });
  add({ kind: "sapin", x: 11, y: 20, w: 1, h: 2, solidRows: 2 });
  add({ kind: "sapin", x: 14, y: 20, w: 1, h: 2, solidRows: 2 });
  for (const x of [1, 3, 5, 19, 21, 23]) add({ kind: "arbre", x, y: 0, w: 2, h: 2, solidRows: 2 });
  // Le temple
  add({ kind: "batiment", x: 7, y: 0, w: 12, h: 8, b: { name: "Temple de la Confrérie", style: "palais", roof: "tuiles", door: 12, sign: "CONFRÉRIE", awning: "rouge", lit: 4 } });
  add({ kind: "haltere-geant", x: 11, y: 13, w: 3, h: 2 });
  add({ kind: "gong", x: 5, y: 9, w: 1, h: 2 });
  add({ kind: "brasero", x: 8, y: 9, w: 1, h: 1 });
  add({ kind: "brasero", x: 17, y: 9, w: 1, h: 1 });
  add({ kind: "sac-frappe", x: 20, y: 12, w: 1, h: 2 });
  add({ kind: "sac-frappe", x: 5, y: 12, w: 1, h: 2 });
  add({ kind: "pancarte", x: 15, y: 17, w: 1, h: 1, text: "LA DOULEUR EST UNE INFORMATION" });
  def.warps.push(
    { id: "porte", at: { x: 12, y: 7 }, to: { map: "temple", x: 14, y: 20, dir: "up" }, needs: templeOuvert, lockedKey: "porte-temple" },
    { id: "est-1", at: { x: 25, y: 10 }, dir: "right", to: { map: "cerisiers", x: 1, y: 9, dir: "right" }, needs: (r) => r.quests.confrerie === "terminee", lockedKey: "porte-est" },
    { id: "est-2", at: { x: 25, y: 11 }, dir: "right", to: { map: "cerisiers", x: 1, y: 10, dir: "right" }, needs: (r) => r.quests.confrerie === "terminee", lockedKey: "porte-est" },
    { id: "bas-1", at: { x: 12, y: 21 }, dir: "down", to: { map: "sentier", x: 11, y: 1, dir: "down" } },
    { id: "bas-2", at: { x: 13, y: 21 }, dir: "down", to: { map: "sentier", x: 12, y: 1, dir: "down" } },
  );
  def.spawn = { x: 12, y: 20, dir: "up" };
  def.zones.push({ id: "temple-parvis", name: "Parvis du Temple", x1: 5, y1: 8, x2: 20, y2: 18 });
  def.npcs.push(
    { id: "gardien", name: "Frère Haltère", char: "frere-haltere", start: { x: 12, y: 8 }, dir: "down", when: (r) => !templeOuvert(r) },
    { id: "lili", name: "Lili", char: "lili", start: { x: 16, y: 11 }, dir: "left", watch: true, when: (r) => !templeOuvert(r) },
    { id: "moine-a", name: "Moine du Gain", char: "moine", start: { x: 7, y: 15 }, dir: "right" },
    { id: "moine-b", name: "Moine du Gain", char: "moine", start: { x: 18, y: 15 }, dir: "left" },
  );
  return def;
}

// ─── Temple de la Confrérie (intérieur) ───

function temple(): MapDef {
  const M = makeMap("temple", "Temple de la Confrérie", 30, 22, "interieur", "mur");
  const { fill, add, def } = M;
  // Hall central et sanctuaire
  fill("tatami", 11, 8, 18, 20);
  fill("tatami", 14, 21, 14, 21);
  fill("tatami", 11, 1, 18, 6);
  fill("tatami", 14, 7, 14, 7);
  // Salle de la Force (ouest)
  fill("parquet", 1, 10, 9, 16);
  fill("parquet", 10, 13, 10, 13);
  // Bibliothèque de l'Esprit (nord-ouest)
  fill("parquet", 1, 2, 9, 7);
  fill("parquet", 10, 7, 10, 8);
  // Arène de l'Endurance (est)
  fill("tatami", 20, 10, 28, 16);
  fill("tatami", 19, 13, 19, 13);
  // Dortoir (sud-est) et réserve (sud-ouest)
  fill("parquet", 20, 18, 28, 20);
  fill("parquet", 19, 19, 19, 19);
  fill("parquet", 1, 18, 9, 20);
  fill("parquet", 10, 19, 10, 19);

  // Sanctuaire
  add({ kind: "grille", x: 14, y: 7, w: 1, h: 1, key: "grille-sanctuaire", open: sanctuaireOuvert });
  add({ kind: "podium", x: 13, y: 1, w: 3, h: 1 });
  add({ kind: "statue-titan", x: 11, y: 1, w: 2, h: 3, solidRows: 2 });
  add({ kind: "brasero", x: 17, y: 1, w: 1, h: 1 });
  add({ kind: "brasero", x: 11, y: 6, w: 1, h: 1 });
  add({ kind: "brasero", x: 18, y: 6, w: 1, h: 1 });
  // Hall
  add({ kind: "gong", x: 17, y: 8, w: 1, h: 2 });
  add({ kind: "plante", x: 18, y: 8, w: 1, h: 1 });
  add({ kind: "sac-frappe", x: 11, y: 16, w: 1, h: 2 });
  add({ kind: "sac-frappe", x: 18, y: 16, w: 1, h: 2 });
  add({ kind: "pancarte", x: 17, y: 11, w: 1, h: 1, text: "ON NE S'ARRÊTE JAMAIS" });
  // Force
  add({ kind: "banc-muscu", x: 4, y: 12, w: 2, h: 1, key: "banc-force" });
  add({ kind: "sac-frappe", x: 1, y: 10, w: 1, h: 2 });
  add({ kind: "sac-frappe", x: 9, y: 15, w: 1, h: 2 });
  // Esprit
  add({ kind: "bibliotheque", x: 1, y: 2, w: 2, h: 1 });
  add({ kind: "bibliotheque", x: 4, y: 2, w: 2, h: 1 });
  add({ kind: "bibliotheque", x: 7, y: 2, w: 2, h: 1 });
  add({ kind: "table", x: 2, y: 6, w: 2, h: 1 });
  add({ kind: "plante", x: 9, y: 3, w: 1, h: 1 });
  // Arène
  add({ kind: "coffre", x: 28, y: 16, w: 1, h: 1, key: "coffre-arene", on: (r) => flag(r, "coffre-arene") });
  add({ kind: "brasero", x: 20, y: 10, w: 1, h: 1 });
  add({ kind: "brasero", x: 28, y: 10, w: 1, h: 1 });
  // Dortoir
  for (const x of [23, 25, 27]) add({ kind: "lit-int", x, y: 18, w: 1, h: 2, variant: 1 });
  // Réserve (gardée)
  add({ kind: "caisse", x: 4, y: 18, w: 1, h: 1 });
  add({ kind: "caisse", x: 6, y: 20, w: 1, h: 1 });
  add({ kind: "coffre", x: 1, y: 19, w: 1, h: 1, key: "coffre-oreiller", on: (r) => flag(r, "coffre-oreiller") });

  def.warps.push({ id: "sortie", at: { x: 14, y: 21 }, dir: "down", to: { map: "temple-cour", x: 12, y: 9, dir: "down" } });
  def.spawn = { x: 14, y: 20, dir: "up" };
  def.zones.push(
    { id: "temple-force", name: "Salle de la Force", x1: 1, y1: 10, x2: 9, y2: 16 },
    { id: "temple-esprit", name: "Bibliothèque de l'Esprit", x1: 1, y1: 2, x2: 9, y2: 7 },
    { id: "temple-arene", name: "Arène de l'Endurance", x1: 20, y1: 10, x2: 28, y2: 16 },
    { id: "temple-sanctuaire", name: "Sanctuaire du Titan", x1: 11, y1: 1, x2: 18, y2: 6 },
    { id: "temple-dortoir", name: "Dortoir", x1: 20, y1: 18, x2: 28, y2: 20 },
  );
  def.npcs.push(
    { id: "fonte", name: "Maître Fonte", char: "fonte", start: { x: 7, y: 11 }, dir: "down" },
    { id: "mollet", name: "Sage Mollet", char: "mollet", start: { x: 5, y: 4 }, dir: "down" },
    { id: "arbitre", name: "Maître d'Arène", char: "arbitre", start: { x: 24, y: 11 }, dir: "down" },
    { id: "flemme", name: "Frère Flemme", char: "flemme", start: { x: 21, y: 19 }, dir: "right", when: (r) => !flag(r, "flemme-dort") },
    { id: "reserve-1", name: "Moine du Gain", char: "moine", start: { x: 4, y: 19 }, dir: "right", enemy: { battle: "moine-reserve", sight: 2, defeated: "ko:reserve" } },
    { id: "reserve-2", name: "Moine du Gain", char: "moine", start: { x: 4, y: 20 }, dir: "right", enemy: { battle: "moine-reserve", sight: 2, defeated: "ko:reserve" } },
    { id: "ronde", name: "Moine du Gain", char: "moine", start: { x: 13, y: 12 }, dir: "down", path: [{ x: 13, y: 12 }, { x: 16, y: 12 }], pause: 2.2, enemy: { battle: "moine-1", sight: 2, defeated: "ko:ronde-temple" } },
    { id: "gonflax", name: "Coach Gonflax", char: "gonflax", start: { x: 14, y: 2 }, dir: "down" },
    { id: "lili-s", name: "Lili", char: "lili", start: { x: 17, y: 3 }, dir: "left", when: (r) => flag(r, "lili-sanctuaire") && !r.party.includes("lili") },
  );
  return def;
}

export const CH3_MAPS: MapDef[] = [sentier(), refuge(), templeCour(), temple()];
