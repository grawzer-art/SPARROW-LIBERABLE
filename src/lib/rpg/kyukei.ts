/**
 * RPG — cartes du chapitre 4 : le Chemin des Cerisiers, le village de Kyūkei (fête des
 * lanternes, scène de Pokeyz), l'auberge et le dojo de Maître Katsu.
 */

import { makeMap, type Dest, type Ground, type MapDef, type MapId } from "./mapdef";
import type { Rpg } from "./state";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const did = (r: Rpg, s: string) => r.done.includes(`samourai:${s}`);
export const metronomeVaincu = (r: Rpg) => flag(r, "ko:metronome");
export const LAMPIONS = [1, 2, 3, 4] as const;
export const chapitre4Fini = (r: Rpg) => r.quests.samourai === "terminee";

// ─── Chemin des Cerisiers ───

function cerisiers(): MapDef {
  const M = makeMap("cerisiers", "Chemin des Cerisiers", 36, 18, "crepuscule", "herbe");
  const { fill, add, def } = M;
  fill("chemin", 0, 9, 35, 10);
  fill("fleurs", 3, 4, 8, 6);
  fill("fleurs", 24, 13, 30, 15);
  fill("eau", 14, 13, 20, 16);
  fill("pont", 17, 11, 18, 16);
  // Bordures : cerisiers en haut et en bas
  for (let x = 0; x < 36; x += 2) {
    add({ kind: "cerisier", x, y: 0, w: 2, h: 2, solidRows: 2 });
    if (x < 14 || x > 20) add({ kind: "cerisier", x, y: 16, w: 2, h: 2, solidRows: 2 });
  }
  add({ kind: "arbre", x: 14, y: 16, w: 2, h: 2, solidRows: 2 });
  add({ kind: "arbre", x: 19, y: 16, w: 2, h: 2, solidRows: 2 });
  for (const [x, y] of [
    [3, 3],
    [10, 5],
    [26, 4],
    [31, 6],
    [7, 13],
    [24, 11],
    [30, 12],
    [11, 12],
  ])
    add({ kind: "cerisier", x, y, w: 2, h: 2, solidRows: 1 });
  // Portiques rouges au-dessus du chemin
  for (const x of [8, 22]) {
    add({ kind: "poteau", x, y: 8, w: 1, h: 1 });
    add({ kind: "poteau", x: x + 3, y: 11, w: 1, h: 1 });
    add({ kind: "poteau", x, y: 11, w: 1, h: 1 });
    add({ kind: "poteau", x: x + 3, y: 8, w: 1, h: 1 });
    add({ kind: "portique", x, y: 7, w: 4, h: 1, solidRows: 0 });
  }
  add({ kind: "pierre", x: 15, y: 8, w: 1, h: 1 });
  add({ kind: "pierre", x: 20, y: 8, w: 1, h: 1 });
  add({ kind: "panneau", x: 2, y: 8, w: 1, h: 1, text: "KYŪKEI →" });
  def.warps.push(
    { id: "ouest-1", at: { x: 0, y: 9 }, dir: "left", to: { map: "temple-cour", x: 24, y: 10, dir: "left" } },
    { id: "ouest-2", at: { x: 0, y: 10 }, dir: "left", to: { map: "temple-cour", x: 24, y: 11, dir: "left" } },
    { id: "est-1", at: { x: 35, y: 9 }, dir: "right", to: { map: "village", x: 1, y: 13, dir: "right" } },
    { id: "est-2", at: { x: 35, y: 10 }, dir: "right", to: { map: "village", x: 1, y: 14, dir: "right" } },
  );
  def.spawn = { x: 1, y: 9, dir: "right" };
  def.zones.push({ id: "cerisiers", name: "Chemin des Cerisiers", x1: 0, y1: 2, x2: 35, y2: 15 });
  def.npcs.push(
    { id: "sbire", name: "Sbire du Métronome", char: "sbire", start: { x: 13, y: 9 }, dir: "right", path: [{ x: 13, y: 9 }, { x: 19, y: 9 }], pause: 1.2, enemy: { battle: "sbire-1", sight: 3, defeated: "ko:sbire" } },
    { id: "lanterne", name: "Lanterne Folle", char: "lanterne-folle", start: { x: 28, y: 10 }, dir: "left", enemy: { battle: "lanterne-1", sight: 2, defeated: "ko:lanterne" } },
    { id: "pelerin", name: "Pèlerin essoufflé", char: "randonneur", start: { x: 5, y: 11 }, dir: "up" },
  );
  return def;
}

// ─── Village de Kyūkei ───

function village(): MapDef {
  const M = makeMap("village", "Village de Kyūkei", 34, 28, "nuit", "herbe");
  const { fill, add, def } = M;
  fill("dalle", 9, 5, 23, 20);
  fill("chemin", 0, 13, 9, 14);
  fill("chemin", 5, 8, 6, 12);
  fill("chemin", 24, 8, 28, 9);
  fill("chemin", 15, 0, 17, 4);
  fill("chemin", 28, 8, 28, 8);
  fill("eau", 2, 17, 6, 20);
  fill("fleurs", 26, 17, 32, 18);
  fill("chemin", 24, 19, 30, 19);
  // Bordures
  for (let x = 0; x < 34; x += 2) {
    add({ kind: "cerisier", x, y: 26, w: 2, h: 2, solidRows: 2 });
    if (x < 10 || x > 22) add({ kind: "arbre", x, y: 0, w: 2, h: 2, solidRows: 2 });
  }
  for (let y = 2; y < 26; y += 2) {
    if (y !== 12 && y !== 14) add({ kind: "sapin", x: 0, y, w: 1, h: 2, solidRows: 2 });
    add({ kind: "sapin", x: 33, y, w: 1, h: 2, solidRows: 2 });
  }
  add({ kind: "sapin", x: 0, y: 15, w: 1, h: 1, solidRows: 1 });
  // Bâtiments
  add({ kind: "batiment", x: 2, y: 2, w: 7, h: 6, b: { name: "Auberge", style: "echoppe", roof: "tuiles", door: 5, sign: "AUBERGE", awning: "rouge", lit: 3 } });
  add({ kind: "batiment", x: 24, y: 1, w: 9, h: 7, b: { name: "Dojo", style: "palais", roof: "tuiles", door: 28, sign: "DOJO", lit: 6 } });
  add({ kind: "batiment", x: 10, y: 0, w: 5, h: 4, b: { name: "Maison", style: "maison", roof: "tuiles", door: 12, lit: 1 } });
  add({ kind: "batiment", x: 18, y: 0, w: 5, h: 4, b: { name: "Maison", style: "maison", roof: "ardoise", door: 20, lit: 8 } });
  // Scène du festival
  add({ kind: "scene", x: 13, y: 5, w: 8, h: 3 });
  add({ kind: "platines", x: 15, y: 9, w: 3, h: 1 });
  // Lampions de la fête (quête secondaire) et décor
  const pos: [number, number][] = [
    [9, 5],
    [23, 5],
    [9, 20],
    [23, 20],
  ];
  LAMPIONS.forEach((n, i) => add({ kind: "lampion", x: pos[i][0], y: pos[i][1], w: 1, h: 1, key: `lampion-${n}`, on: (r) => flag(r, `lampion-${n}`) }));
  for (const [x, y] of [
    [12, 12],
    [20, 12],
    [12, 17],
    [20, 17],
  ])
    add({ kind: "pierre", x, y, w: 1, h: 1 });
  for (const [x, y] of [
    [3, 10],
    [7, 22],
    [26, 21],
    [30, 11],
  ])
    add({ kind: "cerisier", x, y, w: 2, h: 2, solidRows: 1 });
  add({ kind: "pancarte", x: 24, y: 10, w: 1, h: 1, text: "FÊTE DES LANTERNES" });
  add({ kind: "etal", x: 10, y: 22, w: 2, h: 1, variant: 1 });
  add({ kind: "etal", x: 20, y: 22, w: 2, h: 1, variant: 2 });

  def.warps.push(
    { id: "ouest-1", at: { x: 0, y: 13 }, dir: "left", to: { map: "cerisiers", x: 34, y: 9, dir: "left" } },
    { id: "ouest-2", at: { x: 0, y: 14 }, dir: "left", to: { map: "cerisiers", x: 34, y: 10, dir: "left" } },
    { id: "auberge", at: { x: 5, y: 7 }, to: { map: "auberge", x: 5, y: 6, dir: "up" } },
    { id: "dojo", at: { x: 28, y: 7 }, to: { map: "dojo", x: 9, y: 12, dir: "up" }, needs: metronomeVaincu, lockedKey: "porte-dojo" },
    { id: "nord-1", at: { x: 15, y: 0 }, dir: "up", to: { map: "tour-parvis", x: 11, y: 18, dir: "up" }, needs: chapitre4Fini, lockedKey: "porte-tour" },
    { id: "nord-2", at: { x: 16, y: 0 }, dir: "up", to: { map: "tour-parvis", x: 12, y: 18, dir: "up" }, needs: chapitre4Fini, lockedKey: "porte-tour" },
    { id: "nord-3", at: { x: 17, y: 0 }, dir: "up", to: { map: "tour-parvis", x: 13, y: 18, dir: "up" }, needs: chapitre4Fini, lockedKey: "porte-tour" },
    { id: "maison-1", at: { x: 12, y: 3 }, to: null, text: "Personne. Sur la table, un bol de soupe refroidi… Ils sont tous partis danser." },
    { id: "maison-2", at: { x: 20, y: 3 }, to: null, text: "La porte est fermée. On entend quelqu'un taper du pied derrière, en rythme, sans pouvoir s'arrêter." },
  );
  def.spawn = { x: 1, y: 13, dir: "right" };
  def.zones.push(
    { id: "village-place", name: "Place du Festival", x1: 9, y1: 5, x2: 23, y2: 20 },
    { id: "village-jardin", name: "Jardin du Tambour", x1: 25, y1: 15, x2: 32, y2: 24 },
  );
  const libre = metronomeVaincu;
  const dance = (id: string, name: string, char: string, a: [number, number], b: [number, number]) => ({
    id,
    name,
    char,
    start: { x: a[0], y: a[1] },
    dir: "down" as const,
    path: [
      { x: a[0], y: a[1] },
      { x: b[0], y: b[1] },
    ],
    pause: 0.25,
  });
  def.npcs.push(
    { id: "pokeyz", name: "Pokeyz", char: "pokeyz", start: { x: 16, y: 8 }, dir: "down", when: (r) => !r.party.includes("pokeyz") },
    { id: "metronome", name: "Le Métronome", char: "metronome", start: { x: 21, y: 8 }, dir: "down", when: (r) => !libre(r) },
    dance("danseur-1", "Danseur fatigué", "carotte", [11, 14], [14, 14]),
    dance("danseur-2", "Danseuse épuisée", "chou", [18, 15], [21, 15]),
    dance("danseur-3", "Danseur en boucle", "poireau", [13, 18], [13, 15]),
    { id: "matcha", name: "Mamie Matcha", char: "tubercule", start: { x: 7, y: 15 }, dir: "right" },
    { id: "wasabi", name: "Monsieur Wasabi", char: "navet", start: { x: 25, y: 9 }, dir: "left" },
    { id: "sbires-1", name: "Sbire du Métronome", char: "sbire", start: { x: 22, y: 18 }, dir: "left", enemy: { battle: "sbires-2", sight: 2, defeated: "ko:sbires" } },
    { id: "sbires-2", name: "Sbire du Métronome", char: "sbire", start: { x: 22, y: 19 }, dir: "left", enemy: { battle: "sbires-2", sight: 2, defeated: "ko:sbires" } },
    { id: "tambour", name: "Tambour possédé", char: "tambour", start: { x: 29, y: 21 }, dir: "left", enemy: { battle: "tambour-1", sight: 2, defeated: "ko:tambour" } },
  );
  return def;
}

// ─── Intérieurs ───

function room(id: MapId, name: string, w: number, h: number, floor: Ground, door: number, back: Dest) {
  const M = makeMap(id, name, w, h, "interieur", floor);
  M.fill("mur", 0, 0, w - 1, 1);
  M.fill("mur", 0, 0, 0, h - 1);
  M.fill("mur", w - 1, 0, w - 1, h - 1);
  M.fill("mur", 0, h - 1, w - 1, h - 1);
  M.def.ground[h - 1][door] = floor;
  M.def.warps.push({ id: "sortie", at: { x: door, y: h - 1 }, dir: "down", to: back });
  M.def.spawn = { x: door, y: h - 2, dir: "up" };
  return M;
}

function auberge(): MapDef {
  const M = room("auberge", "Auberge du Thé Tiède", 10, 8, "tatami", 5, { map: "village", x: 5, y: 8, dir: "down" });
  M.add({ kind: "comptoir", x: 3, y: 3, w: 5, h: 1, variant: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "etagere", x: 8, y: 2, w: 1, h: 1 });
  M.add({ kind: "table", x: 2, y: 5, w: 2, h: 1, variant: 1 });
  M.add({ kind: "plante", x: 8, y: 6, w: 1, h: 1 });
  M.def.npcs.push(
    { id: "sencha", name: "Madame Sencha", char: "persil", start: { x: 5, y: 2 }, dir: "down" },
    { id: "client", name: "Voyageur", char: "randonneur", start: { x: 7, y: 5 }, dir: "left" },
  );
  return M.def;
}

function dojo(): MapDef {
  const M = room("dojo", "Dojo de Maître Katsu", 18, 14, "tatami", 9, { map: "village", x: 28, y: 8, dir: "down" });
  M.add({ kind: "ratelier", x: 2, y: 2, w: 2, h: 1 });
  M.add({ kind: "ratelier", x: 14, y: 2, w: 2, h: 1 });
  M.add({ kind: "banniere", x: 6, y: 1, w: 1, h: 1 });
  M.add({ kind: "banniere", x: 11, y: 1, w: 1, h: 1 });
  M.add({ kind: "brasero", x: 1, y: 6, w: 1, h: 1 });
  M.add({ kind: "brasero", x: 16, y: 6, w: 1, h: 1 });
  M.add({ kind: "sac-frappe", x: 1, y: 10, w: 1, h: 2 });
  M.add({ kind: "sac-frappe", x: 16, y: 10, w: 1, h: 2 });
  M.add({ kind: "plante", x: 8, y: 2, w: 1, h: 1 });
  M.add({ kind: "plante", x: 10, y: 2, w: 1, h: 1 });
  M.add({ kind: "coffre", x: 15, y: 4, w: 1, h: 1, key: "coffre-dojo", on: (r) => flag(r, "coffre-dojo") });
  M.def.zones.push({ id: "dojo", name: "Dojo de Maître Katsu", x1: 1, y1: 2, x2: 16, y2: 12 });
  M.def.npcs.push(
    { id: "katsu", name: "Maître Katsu", char: "katsu", start: { x: 9, y: 4 }, dir: "down" },
    { id: "disciple", name: "Disciple", char: "moine", start: { x: 5, y: 8 }, dir: "right", when: (r) => !did(r, "voie") },
  );
  return M.def;
}

export const CH4_MAPS: MapDef[] = [cerisiers(), village(), auberge(), dojo()];
