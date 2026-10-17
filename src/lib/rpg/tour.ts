/**
 * RPG — cartes du chapitre 5 : le parvis de la Tour de Minuit, la Salle des Rouages
 * (le Grand Sablier et l'énigme des cadrans) et le sommet, où attend Monsieur Minuit.
 */

import { makeMap, type MapDef, type MapId, type Region, type Ground } from "./mapdef";
import type { Rpg } from "./state";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const did = (r: Rpg, s: string) => r.done.includes(`minuit:${s}`);
export const CADRANS = [1, 2, 3, 4] as const;
/** Les quatre cadrans sont sur 00:00 (ou l'énigme a déjà été résolue). */
export const rouagesOk = (r: Rpg) => did(r, "rouages") || CADRANS.every((n) => flag(r, `cadran-${n}`));
export const porteTour = (r: Rpg) => did(r, "seconde");
export const modeLibre = (r: Rpg) => flag(r, "mode-libre");

function walled(id: MapId, name: string, w: number, h: number, region: Region, floor: Ground) {
  const M = makeMap(id, name, w, h, region, floor);
  M.fill("mur", 0, 0, w - 1, 1);
  M.fill("mur", 0, 0, 0, h - 1);
  M.fill("mur", w - 1, 0, w - 1, h - 1);
  M.fill("mur", 0, h - 1, w - 1, h - 1);
  return M;
}

// ─── Parvis de la Tour ───

function parvis(): MapDef {
  const M = makeMap("tour-parvis", "Parvis de la Tour de Minuit", 24, 20, "nuit", "pave");
  const { fill, add, def } = M;
  fill("dalle", 9, 7, 15, 18);
  fill("herbe", 1, 1, 6, 6);
  fill("herbe", 18, 1, 22, 6);
  add({ kind: "batiment", x: 7, y: 0, w: 10, h: 7, b: { name: "Tour de Minuit", style: "palais", roof: "dome", door: 12, sign: "TOUR DE MINUIT", lit: 8 } });
  for (let y = 0; y < 20; y += 2) {
    if (y < 18) add({ kind: "sapin", x: 0, y, w: 1, h: 2, solidRows: 2 });
    if (y < 18) add({ kind: "sapin", x: 23, y, w: 1, h: 2, solidRows: 2 });
  }
  for (const x of [1, 3, 5, 18, 20]) add({ kind: "arbre", x, y: 0, w: 2, h: 2, solidRows: 2 });
  for (const x of [1, 3, 5, 7, 15, 17, 19, 21]) add({ kind: "sapin", x, y: 18, w: 1, h: 2, solidRows: 2 });
  for (const x of [2, 4, 6, 8, 14, 16, 18, 20, 22]) add({ kind: "buisson", x, y: 19, w: 1, h: 1 });
  for (const [x, y] of [
    [8, 9],
    [16, 9],
    [8, 15],
    [16, 15],
  ])
    add({ kind: "lampadaire", x, y, w: 1, h: 2, solidRows: 1 });
  add({ kind: "banc", x: 4, y: 15, w: 2, h: 1 });
  add({ kind: "banc", x: 19, y: 15, w: 2, h: 1 });
  add({ kind: "armoire", x: 18, y: 8, w: 1, h: 2, solidRows: 1, key: "distributeur" });
  add({ kind: "panneau", x: 10, y: 17, w: 1, h: 1, text: "TOUR DE MINUIT" });
  add({ kind: "coffre", x: 2, y: 4, w: 1, h: 1, key: "coffre-parvis", on: (r) => flag(r, "coffre-parvis") });

  def.warps.push(
    { id: "porte", at: { x: 12, y: 6 }, to: { map: "tour", x: 10, y: 14, dir: "up" }, needs: porteTour, lockedKey: "porte-minuit" },
    { id: "sud-1", at: { x: 11, y: 19 }, dir: "down", to: { map: "village", x: 15, y: 1, dir: "down" } },
    { id: "sud-2", at: { x: 12, y: 19 }, dir: "down", to: { map: "village", x: 16, y: 1, dir: "down" } },
    { id: "sud-3", at: { x: 13, y: 19 }, dir: "down", to: { map: "village", x: 17, y: 1, dir: "down" } },
  );
  def.spawn = { x: 12, y: 18, dir: "up" };
  def.zones.push({ id: "parvis", name: "Parvis de la Tour", x1: 1, y1: 7, x2: 22, y2: 18 });
  def.npcs.push(
    { id: "seconde", name: "Seconde", char: "inconnu", start: { x: 14, y: 8 }, dir: "down" },
    { id: "trotteuse", name: "Trotteuse", char: "trotteuse", start: { x: 3, y: 11 }, dir: "right", path: [{ x: 3, y: 11 }, { x: 7, y: 11 }], pause: 1, enemy: { battle: "trotteuse", sight: 3, defeated: "ko:trotteuse-parvis" } },
    { id: "coucou", name: "Coucou mécanique", char: "coucou", start: { x: 20, y: 12 }, dir: "left", enemy: { battle: "coucou", sight: 2, defeated: "ko:coucou-parvis" } },
  );
  return def;
}

// ─── Salle des Rouages ───

function rouages(): MapDef {
  const M = walled("tour", "Salle des Rouages", 20, 16, "palais", "marbre");
  const { fill, add, def } = M;
  def.ground[15][10] = "marbre";
  fill("tapis", 9, 8, 11, 14);
  fill("tapis", 9, 2, 11, 6);
  // Cloison : le Grand Sablier garde le seul passage vers le nord
  fill("mur", 1, 7, 9, 7);
  fill("mur", 11, 7, 18, 7);
  // Escalier, derrière la grille
  def.ground[1][10] = "tapis";
  add({ kind: "grille", x: 10, y: 2, w: 1, h: 1, key: "grille-escalier", open: rouagesOk });
  CADRANS.forEach((n, i) => add({ kind: "cadran", x: [3, 7, 13, 17][i], y: 3, w: 1, h: 1, key: `cadran-${n}`, on: (r) => flag(r, `cadran-${n}`) || did(r, "rouages") }));
  add({ kind: "pancarte", x: 8, y: 5, w: 1, h: 1, key: "pancarte-rouages" });
  add({ kind: "coffre", x: 1, y: 2, w: 1, h: 1, key: "coffre-rouages", on: (r) => flag(r, "coffre-rouages") });
  add({ kind: "banniere", x: 5, y: 1, w: 1, h: 1 });
  add({ kind: "banniere", x: 15, y: 1, w: 1, h: 1 });
  // Moitié sud
  for (const [x, y] of [
    [3, 9],
    [16, 9],
    [3, 13],
    [16, 13],
  ])
    add({ kind: "colonne", x, y, w: 1, h: 2, solidRows: 1 });
  add({ kind: "brasero", x: 1, y: 8, w: 1, h: 1 });
  add({ kind: "brasero", x: 18, y: 8, w: 1, h: 1 });
  add({ kind: "coffre", x: 18, y: 12, w: 1, h: 1, key: "coffre-tour", on: (r) => flag(r, "coffre-tour") });

  def.warps.push(
    { id: "sortie", at: { x: 10, y: 15 }, dir: "down", to: { map: "tour-parvis", x: 12, y: 7, dir: "down" } },
    { id: "escalier", at: { x: 10, y: 1 }, dir: "up", to: { map: "tour-sommet", x: 8, y: 12, dir: "up" } },
  );
  def.spawn = { x: 10, y: 14, dir: "up" };
  def.zones.push({ id: "rouages", name: "Salle des Rouages", x1: 1, y1: 2, x2: 18, y2: 14 });
  def.npcs.push(
    { id: "sablier", name: "Le Grand Sablier", char: "sablier", start: { x: 10, y: 7 }, dir: "down", when: (r) => !flag(r, "ko:sablier") },
    { id: "trotteuses-1", name: "Trotteuse", char: "trotteuse", start: { x: 14, y: 11 }, dir: "left", enemy: { battle: "trotteuses", sight: 2, defeated: "ko:trotteuses" } },
    { id: "trotteuses-2", name: "Trotteuse", char: "trotteuse", start: { x: 14, y: 12 }, dir: "left", enemy: { battle: "trotteuses", sight: 2, defeated: "ko:trotteuses" } },
    { id: "coucous-1", name: "Coucou mécanique", char: "coucou", start: { x: 5, y: 5 }, dir: "right", enemy: { battle: "coucous", sight: 2, defeated: "ko:coucous" } },
    { id: "coucous-2", name: "Trotteuse", char: "trotteuse", start: { x: 5, y: 6 }, dir: "right", enemy: { battle: "coucous", sight: 2, defeated: "ko:coucous" } },
  );
  return def;
}

// ─── Sommet ───

function sommet(): MapDef {
  const M = walled("tour-sommet", "Sommet de la Tour", 16, 14, "nuit", "dalle");
  const { fill, add, def } = M;
  fill("tapis", 7, 4, 8, 12);
  add({ kind: "horloge", x: 7, y: 0, w: 2, h: 3, solidRows: 2 });
  for (const x of [3, 12]) add({ kind: "colonne", x, y: 3, w: 1, h: 2, solidRows: 1 });
  for (const x of [3, 12]) add({ kind: "colonne", x, y: 9, w: 1, h: 2, solidRows: 1 });
  add({ kind: "brasero", x: 1, y: 2, w: 1, h: 1 });
  add({ kind: "brasero", x: 14, y: 2, w: 1, h: 1 });
  add({ kind: "banniere", x: 4, y: 1, w: 1, h: 1 });
  add({ kind: "banniere", x: 11, y: 1, w: 1, h: 1 });
  def.ground[13][8] = "tapis";
  def.warps.push({ id: "escalier", at: { x: 8, y: 13 }, dir: "down", to: { map: "tour", x: 10, y: 3, dir: "down" } });
  def.spawn = { x: 8, y: 12, dir: "up" };
  def.zones.push({ id: "sommet", name: "Sommet de la Tour", x1: 1, y1: 2, x2: 14, y2: 12 });
  def.npcs.push(
    { id: "minuit", name: "Monsieur Minuit", char: "minuit", start: { x: 8, y: 4 }, dir: "down", when: (r) => !flag(r, "ko:minuit") },
    { id: "echo", name: "Écho de Minuit", char: "minuit", start: { x: 8, y: 4 }, dir: "down", when: (r) => flag(r, "ko:minuit") && modeLibre(r) },
  );
  return def;
}

export const CH5_MAPS: MapDef[] = [parvis(), rouages(), sommet()];
