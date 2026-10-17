/**
 * RPG — cartes du chapitre 2 : la Cité des Frites Perdues, ses intérieurs, les égouts et le palais.
 * Logique pure (testée dans tests/ch2.test.ts) ; le rendu est dans components/rpg/tiles*.ts.
 */

import { makeMap, type Dest, type Ground, type MapDef, type MapId } from "./mapdef";
import type { Rpg } from "./state";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const has = (r: Rpg, i: string) => r.items.includes(i);
const roiVaincu = (r: Rpg) => flag(r, "ko:roi-salade");

/** Énigme des égouts : vanne gauche ouverte, milieu fermée, droite ouverte. */
export const vannesOk = (r: Rpg) => flag(r, "vanne-1") && !flag(r, "vanne-2") && flag(r, "vanne-3");

// ─── La Cité des Frites Perdues ───

function cite(): MapDef {
  const M = makeMap("cite", "Cité des Frites Perdues", 40, 32, "crepuscule", "pave");
  const { fill, add, def } = M;
  // Remparts (avec la porte nord vers le Mont Biscotto)
  fill("mur", 0, 0, 39, 0);
  fill("chemin", 33, 0, 34, 2);
  fill("mur", 0, 0, 0, 31);
  fill("mur", 39, 0, 39, 31);
  fill("mur", 0, 31, 18, 31);
  fill("mur", 21, 31, 39, 31);
  // Cour du palais, place, ruelle, jardin
  fill("dalle", 12, 7, 27, 9);
  fill("dalle", 12, 13, 27, 23);
  fill("ruelle", 28, 17, 38, 21);
  fill("herbe", 28, 1, 38, 10);
  fill("potager", 30, 3, 33, 5);
  fill("potager", 35, 3, 37, 5);
  fill("chemin", 28, 8, 38, 8);
  fill("herbe", 1, 24, 10, 30);
  fill("chemin", 2, 28, 10, 28);
  fill("herbe", 23, 25, 38, 30);
  fill("fleurs", 24, 28, 27, 29);

  // Palais du Roi de la Salade
  add({ kind: "batiment", x: 14, y: 1, w: 12, h: 6, b: { name: "Palais royal", style: "palais", roof: "dome", door: 19, sign: "PALAIS", lit: 5 } });
  // Maisons (nord-ouest)
  add({ kind: "batiment", x: 2, y: 2, w: 6, h: 6, b: { name: "Maison Chou", style: "maison", roof: "vert", door: 4, lit: 9 } });
  add({ kind: "batiment", x: 9, y: 2, w: 5, h: 6, b: { name: "Maison fermée", style: "enduit", roof: "tuiles", door: 11, lit: 4 } });
  // Boutiques (au-dessus du marché)
  add({ kind: "batiment", x: 2, y: 10, w: 6, h: 6, b: { name: "Herboristerie", style: "echoppe", roof: "vert", door: 4, sign: "HERBES", awning: "vert", lit: 2 } });
  add({ kind: "batiment", x: 8, y: 10, w: 4, h: 6, b: { name: "Armurerie", style: "brique", roof: "ardoise", door: 9, sign: "ARMES", lit: 1 } });
  // Ruelle (est)
  add({ kind: "batiment", x: 29, y: 13, w: 4, h: 4, b: { name: "Bistrot fermé", style: "enduit", roof: "plat", door: 30, awning: "rouge", lit: 0 } });
  add({ kind: "batiment", x: 33, y: 12, w: 6, h: 5, b: { name: "Échoppe", style: "echoppe", roof: "plat", door: 35, lit: 6 } });
  add({ kind: "batiment", x: 29, y: 22, w: 8, h: 5, b: { name: "Maison du sud", style: "maison", roof: "tuiles", door: 33, lit: 7 } });
  add({ kind: "batiment", x: 2, y: 23, w: 6, h: 4, b: { name: "Grange", style: "echoppe", roof: "tuiles", door: 4, lit: 8 } });

  // Place des Cornets
  add({ kind: "fontaine-seche", x: 18, y: 16, w: 3, h: 3 });
  add({ kind: "statue", x: 14, y: 14, w: 2, h: 3, solidRows: 2, text: "ROI" });
  add({ kind: "pancarte", x: 22, y: 21, w: 1, h: 1, key: "decret", text: "DÉCRET ROYAL" });
  add({ kind: "banc", x: 13, y: 20, w: 2, h: 1 });
  add({ kind: "banc", x: 25, y: 20, w: 2, h: 1 });
  add({ kind: "massif", x: 24, y: 14, w: 3, h: 1 });
  for (const [x, y] of [
    [12, 12],
    [27, 12],
    [12, 22],
    [27, 22],
    [17, 25],
    [22, 25],
    [17, 29],
    [22, 29],
  ])
    add({ kind: "lanterne", x, y, w: 1, h: 2, solidRows: 1 });

  // Rue du Marché
  add({ kind: "etal", x: 2, y: 21, w: 2, h: 1, variant: 0 });
  add({ kind: "etal", x: 5, y: 21, w: 2, h: 1, variant: 1 });
  add({ kind: "etal", x: 8, y: 21, w: 2, h: 1, variant: 2 });
  add({ kind: "pancarte", x: 11, y: 21, w: 1, h: 1, text: "MANGEZ VERT" });
  add({ kind: "cageots", x: 1, y: 16, w: 1, h: 1 });

  // Ruelle des Friteurs : l'entrée est étroite (deux gardes la bloquent)
  add({ kind: "tonneau", x: 28, y: 17, w: 1, h: 1 });
  add({ kind: "caisse", x: 28, y: 20, w: 1, h: 1 });
  add({ kind: "caisse", x: 28, y: 21, w: 1, h: 1 });
  add({ kind: "tonneau", x: 38, y: 21, w: 1, h: 1, key: "tonneau-sachet" });
  add({ kind: "caisse", x: 38, y: 17, w: 1, h: 1 });
  add({ kind: "plaque", x: 37, y: 19, w: 1, h: 1 });
  add({ kind: "cloture", x: 37, y: 22, w: 2, h: 1 });
  add({ kind: "affiche", x: 34, y: 21, w: 1, h: 1, text: "ON RECHERCHE : GÉRARD LA FRITE" });

  // Jardin royal (nord-est)
  for (const [x, y] of [
    [28, 1],
    [36, 1],
    [28, 9],
    [37, 9],
  ])
    add({ kind: "arbre", x, y, w: 2, h: 2, solidRows: 1 });
  add({ kind: "buisson", x: 34, y: 3, w: 1, h: 1 });
  add({ kind: "panneau", x: 29, y: 7, w: 1, h: 1, text: "JARDIN ROYAL" });
  add({ kind: "panneau", x: 32, y: 1, w: 1, h: 1, text: "MONT BISCOTTO" });
  // Sud
  for (const [x, y] of [
    [1, 29],
    [8, 25],
    [24, 25],
    [36, 28],
    [31, 28],
  ])
    add({ kind: "arbre", x, y, w: 2, h: 2, solidRows: 1 });
  add({ kind: "buisson", x: 12, y: 27, w: 1, h: 1 });
  add({ kind: "buisson", x: 26, y: 27, w: 1, h: 1 });
  add({ kind: "panneau", x: 21, y: 29, w: 1, h: 1, text: "CITÉ DES FRITES PERDUES" });

  // Portes
  const toQuartier = (y: number): Dest => ({ map: "quartier", x: 33, y, dir: "left" });
  def.warps.push(
    { id: "sud-1", at: { x: 19, y: 31 }, dir: "down", to: toQuartier(11) },
    { id: "sud-2", at: { x: 20, y: 31 }, dir: "down", to: toQuartier(12) },
    { id: "maison-chou", at: { x: 4, y: 7 }, to: { map: "maison-chou", x: 4, y: 6, dir: "up" } },
    { id: "maison-fermee", at: { x: 11, y: 7 }, to: null, text: "« ABSENT POUR CAUSE DE RÉGIME FORCÉ ». Charmant." },
    { id: "herboristerie", at: { x: 4, y: 15 }, to: { map: "herboristerie", x: 4, y: 6, dir: "up" } },
    { id: "armurerie", at: { x: 9, y: 15 }, to: { map: "armurerie", x: 4, y: 6, dir: "up" } },
    { id: "bistrot", at: { x: 30, y: 16 }, to: null, text: "« FERMÉ PAR DÉCRET ROYAL ». Derrière la vitre, des friteuses sous des draps blancs. Comme des fantômes." },
    { id: "friterie", at: { x: 35, y: 16 }, to: { map: "restaurant", x: 7, y: 8, dir: "up" }, needs: (r) => flag(r, "porte-secrete"), lockedKey: "porte-secrete" },
    { id: "maison-sud", at: { x: 33, y: 26 }, to: null, text: "On entend quelqu'un manger du céleri en pleurant." },
    { id: "grange", at: { x: 4, y: 26 }, to: null, text: "Fermé. Une étiquette : « RÉSERVE DE POIREAUX — PROPRIÉTÉ DU ROI »." },
    { id: "nord-1", at: { x: 33, y: 0 }, dir: "up", to: { map: "sentier", x: 11, y: 38, dir: "up" }, needs: (r) => r.quests["frites-perdues"] === "terminee", lockedKey: "porte-nord" },
    { id: "nord-2", at: { x: 34, y: 0 }, dir: "up", to: { map: "sentier", x: 12, y: 38, dir: "up" }, needs: (r) => r.quests["frites-perdues"] === "terminee", lockedKey: "porte-nord" },
    { id: "palais", at: { x: 19, y: 6 }, to: { map: "palais", x: 12, y: 15, dir: "up" }, needs: roiVaincu, lockedKey: "palais-porte" },
  );
  def.spawn = { x: 19, y: 30, dir: "up" };
  // Hautes herbes du potager royal : des Brokito sauvages y poussent
  def.wild = [{ ground: "potager", battle: "brokito-sauvage", rate: 0.22 }];

  def.zones.push(
    { id: "cite-place", name: "Place des Cornets", x1: 12, y1: 13, x2: 27, y2: 23 },
    { id: "cite-marche", name: "Rue du Marché", x1: 1, y1: 16, x2: 12, y2: 21 },
    { id: "cite-ruelle", name: "Ruelle des Friteurs", x1: 29, y1: 17, x2: 38, y2: 21 },
    { id: "cite-cour", name: "Cour du Palais", x1: 12, y1: 7, x2: 27, y2: 9 },
    { id: "cite-jardin", name: "Jardin royal", x1: 28, y1: 1, x2: 38, y2: 10 },
  );

  const apres = roiVaincu;
  def.npcs.push(
    { id: "carotte", name: "Monsieur Carotte", char: "carotte", start: { x: 21, y: 27 }, dir: "down" },
    { id: "pois", name: "Petit Pois", char: "pois", start: { x: 16, y: 21 }, dir: "right", path: [{ x: 16, y: 21 }, { x: 23, y: 21 }], pause: 1.8 },
    { id: "panais", name: "Vieux Panais", char: "panais", start: { x: 24, y: 17 }, dir: "left" },
    { id: "tubercule", name: "Mamie Tubercule", char: "tubercule", start: { x: 3, y: 20 }, dir: "down" },
    { id: "garde-1", name: "Garde Laitue", char: "laitue", start: { x: 18, y: 7 }, dir: "down", when: (r) => !apres(r) },
    { id: "garde-2", name: "Garde Laitue", char: "laitue", start: { x: 21, y: 7 }, dir: "down", when: (r) => !apres(r) },
    {
      id: "patrouille",
      name: "Soldat Brocoli",
      char: "brocoli",
      start: { x: 2, y: 18 },
      dir: "right",
      path: [{ x: 2, y: 18 }, { x: 11, y: 18 }],
      pause: 1.6,
      when: (r) => !apres(r),
      enemy: { battle: "brocoli-cite", sight: 3, defeated: "ko:patrouille" },
    },
    { id: "porte-1", name: "Soldat Brocoli", char: "brocoli", start: { x: 28, y: 18 }, dir: "left", enemy: { battle: "brocolis-porte", sight: 2, defeated: "ko:porte-ruelle" } },
    { id: "porte-2", name: "Soldat Brocoli", char: "brocoli", start: { x: 28, y: 19 }, dir: "left", enemy: { battle: "brocolis-porte", sight: 2, defeated: "ko:porte-ruelle" } },
    // Après la victoire : le Roi, repenti, distribue des frites sur la place
    { id: "roi-place", name: "Roi de la Salade", char: "roi", start: { x: 21, y: 15 }, dir: "down", when: apres },
  );
  return def;
}

// ─── Intérieurs ───

/** Pièce simple : murs en haut et sur les côtés, porte en bas qui ressort dans la cité. */
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

function maisonChou(): MapDef {
  const M = room("maison-chou", "Maison Chou", 9, 8, "parquet", 4, { map: "cite", x: 4, y: 8, dir: "down" });
  M.add({ kind: "bibliotheque", x: 1, y: 2, w: 2, h: 1 });
  M.add({ kind: "lit-int", x: 6, y: 2, w: 2, h: 2 });
  M.add({ kind: "table", x: 2, y: 4, w: 2, h: 1 });
  M.add({ kind: "chaise", x: 1, y: 4, w: 1, h: 1 });
  M.add({ kind: "plante", x: 7, y: 6, w: 1, h: 1 });
  M.add({ kind: "etagere", x: 4, y: 2, w: 1, h: 1 });
  M.def.npcs.push({ id: "chou", name: "Madame Chou", char: "chou", start: { x: 5, y: 3 }, dir: "down" });
  return M.def;
}

function boutique(id: "herboristerie" | "armurerie", name: string, keeper: { id: string; name: string; char: string }, back: Dest): MapDef {
  const M = room(id, name, 9, 8, id === "herboristerie" ? "carrelage" : "parquet", 4, back);
  M.add({ kind: "comptoir", x: 2, y: 3, w: 5, h: 1, variant: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "etagere", x: 7, y: 2, w: 1, h: 1 });
  M.add({ kind: id === "herboristerie" ? "plante" : "caisse", x: 1, y: 6, w: 1, h: 1 });
  M.add({ kind: id === "herboristerie" ? "plante" : "tonneau", x: 7, y: 6, w: 1, h: 1 });
  M.def.npcs.push({ id: keeper.id, name: keeper.name, char: keeper.char, start: { x: 4, y: 2 }, dir: "down" });
  return M.def;
}

function restaurant(): MapDef {
  const M = room("restaurant", "La Friterie Clandestine", 14, 10, "carrelage", 7, { map: "cite", x: 35, y: 17, dir: "down" });
  M.add({ kind: "cuisiniere", x: 10, y: 2, w: 2, h: 1 });
  M.add({ kind: "comptoir", x: 8, y: 4, w: 5, h: 1 });
  M.add({ kind: "etagere", x: 12, y: 2, w: 1, h: 1 });
  M.add({ kind: "etal", x: 1, y: 3, w: 2, h: 1, variant: 1 });
  M.add({ kind: "table", x: 3, y: 6, w: 2, h: 1, variant: 1 });
  M.add({ kind: "chaise", x: 2, y: 6, w: 1, h: 1 });
  M.add({ kind: "table", x: 9, y: 7, w: 2, h: 1, variant: 1 });
  M.add({ kind: "chaise", x: 11, y: 7, w: 1, h: 1 });
  M.add({ kind: "tonneau", x: 1, y: 8, w: 1, h: 1 });
  M.add({ kind: "plante", x: 12, y: 8, w: 1, h: 1 });
  M.add({ kind: "pancarte", x: 6, y: 2, w: 1, h: 1, text: "ICI ON FRIT EN SILENCE" });
  M.def.npcs.push(
    { id: "gerard", name: "Gérard la Frite", char: "gerard", start: { x: 11, y: 3 }, dir: "down", when: (r) => !r.party.includes("gerard") },
    { id: "frida", name: "Frida la Friteuse", char: "frida", start: { x: 2, y: 4 }, dir: "down" },
    { id: "lili-ombre", name: "???", char: "lili", start: { x: 12, y: 6 }, dir: "left", watch: true, when: (r) => !flag(r, "lili-vue") },
    { id: "client", name: "Client masqué", char: "poireau", start: { x: 5, y: 6 }, dir: "left" },
  );
  return M.def;
}

// ─── Égouts ───

function egouts(): MapDef {
  const M = makeMap("egouts", "Égouts de la Cité", 30, 18, "egout", "mur");
  const { fill, add, def } = M;
  fill("egout", 1, 2, 12, 4);
  fill("egout", 1, 5, 3, 15);
  fill("egout", 1, 12, 6, 15);
  fill("eaux-usees", 13, 2, 14, 15);
  fill("pont", 13, 3, 14, 3);
  fill("egout", 15, 2, 21, 4);
  fill("egout", 19, 5, 21, 12);
  fill("egout", 19, 11, 28, 15);
  fill("eaux-usees", 22, 5, 28, 9);
  fill("eaux-usees", 6, 6, 12, 10);
  // Vannes (sur le mur du couloir) et indice gravé
  add({ kind: "vanne", x: 4, y: 1, w: 1, h: 1, key: "vanne-1", on: (r) => flag(r, "vanne-1") });
  add({ kind: "vanne", x: 7, y: 1, w: 1, h: 1, key: "vanne-2", on: (r) => flag(r, "vanne-2") });
  add({ kind: "vanne", x: 10, y: 1, w: 1, h: 1, key: "vanne-3", on: (r) => flag(r, "vanne-3") });
  add({ kind: "pancarte", x: 12, y: 4, w: 1, h: 1, key: "indice-vannes", text: "GAUCHE OUVERTE · MILIEU FERMÉ · DROITE OUVERTE" });
  add({ kind: "tuyau", x: 15, y: 1, w: 6, h: 1 });
  add({ kind: "tuyau", x: 20, y: 10, w: 8, h: 1 });
  // Le courant qui bloque le passage : il disparaît quand les vannes sont bien réglées
  add({ kind: "flux", x: 19, y: 8, w: 3, h: 1, hidden: vannesOk });
  // Échelles
  add({ kind: "echelle", x: 2, y: 1, w: 1, h: 1, key: "echelle-cite" });
  add({ kind: "echelle", x: 26, y: 10, w: 1, h: 1, key: "echelle-palais" });
  // Recoins
  add({ kind: "caisse", x: 1, y: 15, w: 1, h: 1, key: "caisse-sachet" });
  add({ kind: "coffre", x: 6, y: 12, w: 1, h: 1, key: "coffre-egout", on: (r) => flag(r, "coffre-egout") });
  add({ kind: "tonneau", x: 28, y: 15, w: 1, h: 1 });
  def.spawn = { x: 2, y: 2, dir: "down" };
  def.zones.push({ id: "egouts", name: "Égouts de la Cité", x1: 1, y1: 2, x2: 28, y2: 15 });
  def.npcs.push(
    { id: "patate", name: "Patate Renégate", char: "patate", start: { x: 9, y: 3 }, dir: "left", path: [{ x: 9, y: 3 }, { x: 6, y: 3 }, { x: 11, y: 3 }], pause: 1.4, enemy: { battle: "patate-1", sight: 3, defeated: "ko:patate-egout" } },
    { id: "repentie", name: "Patate repentie", char: "patate", start: { x: 4, y: 13 }, dir: "down", when: (r) => flag(r, "ko:patate-egout") && !flag(r, "pin-donne") },
    { id: "patates-1", name: "Patate Renégate", char: "patate", start: { x: 24, y: 12 }, dir: "left", enemy: { battle: "patate-2", sight: 3, defeated: "ko:patates" } },
    { id: "patates-2", name: "Patate Renégate", char: "patate", start: { x: 25, y: 13 }, dir: "left", enemy: { battle: "patate-2", sight: 3, defeated: "ko:patates" } },
  );
  return def;
}

// ─── Palais ───

function palais(): MapDef {
  const M = makeMap("palais", "Palais du Roi", 24, 18, "palais", "mur");
  const { fill, add, def } = M;
  // Caves (arrivée par l'échelle des égouts)
  fill("dalle", 1, 13, 6, 16);
  // Dortoir des gardes (uniforme)
  fill("parquet", 2, 8, 7, 11);
  fill("parquet", 6, 12, 6, 12);
  // Couloirs
  fill("marbre", 7, 14, 20, 15);
  fill("marbre", 19, 5, 20, 13);
  fill("marbre", 8, 9, 20, 10);
  // Salle du trône
  fill("marbre", 6, 2, 17, 7);
  fill("tapis", 11, 3, 12, 8);
  // Grand hall de sortie
  fill("tapis", 11, 16, 12, 17);
  fill("marbre", 10, 16, 10, 16);
  fill("marbre", 13, 16, 13, 16);
  add({ kind: "trone", x: 11, y: 1, w: 2, h: 2 });
  add({ kind: "banniere", x: 7, y: 1, w: 1, h: 1 });
  add({ kind: "banniere", x: 16, y: 1, w: 1, h: 1 });
  for (const x of [7, 16]) add({ kind: "colonne", x, y: 4, w: 1, h: 2, solidRows: 1 });
  add({ kind: "plante", x: 6, y: 7, w: 1, h: 1 });
  add({ kind: "plante", x: 17, y: 7, w: 1, h: 1 });
  add({ kind: "armoire", x: 2, y: 8, w: 1, h: 1, key: "armoire" });
  add({ kind: "lit-int", x: 6, y: 8, w: 1, h: 2, variant: 1 });
  add({ kind: "lit-int", x: 4, y: 8, w: 1, h: 2, variant: 1 });
  add({ kind: "tonneau", x: 1, y: 16, w: 1, h: 1 });
  add({ kind: "caisse", x: 5, y: 16, w: 1, h: 1 });
  add({ kind: "echelle", x: 3, y: 12, w: 1, h: 1, key: "echelle-cave" });
  add({ kind: "coffre", x: 20, y: 5, w: 1, h: 1, key: "coffre-palais", on: (r) => flag(r, "coffre-palais") });
  add({ kind: "banniere", x: 15, y: 13, w: 1, h: 1 });
  add({ kind: "banniere", x: 9, y: 13, w: 1, h: 1 });
  def.warps.push(
    { id: "sortie-1", at: { x: 11, y: 17 }, dir: "down", to: { map: "cite", x: 19, y: 8, dir: "down" }, needs: roiVaincu, lockedKey: "palais-sortie" },
    { id: "sortie-2", at: { x: 12, y: 17 }, dir: "down", to: { map: "cite", x: 20, y: 8, dir: "down" }, needs: roiVaincu, lockedKey: "palais-sortie" },
  );
  def.spawn = { x: 3, y: 14, dir: "down" };
  def.zones.push(
    { id: "palais-caves", name: "Caves du palais", x1: 1, y1: 13, x2: 6, y2: 16 },
    { id: "palais-trone", name: "Salle du trône", x1: 6, y1: 2, x2: 17, y2: 7 },
  );
  const passe = (r: Rpg) => flag(r, "passe-garde") || flag(r, "ko:laitue-2");
  def.npcs.push(
    { id: "ronde", name: "Garde Laitue", char: "laitue", start: { x: 19, y: 6 }, dir: "down", path: [{ x: 19, y: 6 }, { x: 19, y: 12 }], pause: 2, enemy: { battle: "laitue-1", sight: 3, defeated: "ko:ronde" } },
    { id: "porte-trone", name: "Garde Laitue", char: "laitue", start: { x: 12, y: 9 }, dir: "down", when: (r) => !passe(r), enemy: { battle: "laitue-2", sight: 0, defeated: "ko:laitue-2" } },
    { id: "porte-trone-2", name: "Soldat Brocoli", char: "brocoli", start: { x: 11, y: 9 }, dir: "down", when: (r) => !passe(r) },
    { id: "roi", name: "Roi de la Salade", char: "roi", start: { x: 12, y: 3 }, dir: "down", when: (r) => !flag(r, "lili-partie") },
    { id: "lili", name: "Lili", char: "lili", start: { x: 15, y: 3 }, dir: "left", when: (r) => flag(r, "lili-trone") && !flag(r, "lili-partie") },
  );
  return def;
}

export const CITE = cite();
export const CH2_MAPS: MapDef[] = [
  CITE,
  maisonChou(),
  boutique("herboristerie", "Herboristerie Persil", { id: "persil", name: "Madame Persil", char: "persil" }, { map: "cite", x: 4, y: 16, dir: "down" }),
  boutique("armurerie", "Armurerie du Navet", { id: "navet", name: "Maître Navet", char: "navet" }, { map: "cite", x: 9, y: 16, dir: "down" }),
  restaurant(),
  egouts(),
  palais(),
];

/** Utilitaires pour les tests et le scénario. */
export const ch2 = { has, flag, roiVaincu };
