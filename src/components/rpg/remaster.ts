/**
 * RPG — remaster graphique de toutes les cartes (hors Quartier 404, voir remaster404.ts).
 *
 * Décor seulement : aucune case bloquée ajoutée, aucun élément de jeu modifié.
 *   - SOL : chaque type de sol reçoit ses détails (herbe tachetée, dalles fissurées et moussues,
 *     parquet veiné, tatamis bordés, marbre veiné, tapis à bordure dorée, roche moussue…),
 *     tapis sous les tables, ombres au pied des bâtiments, pétales sous les cerisiers,
 *     cadran gravé au sol de la Tour.
 *   - DÉCOR : chaque mur d'intérieur reçoit des objets accrochés selon le lieu (tableaux, herbes
 *     séchées, armes, casseroles, miroirs et affiches de muscu, rouleaux calligraphiés, engrenages…),
 *     façades enrichies (gouttières, lierre, lanternes), guirlandes entre les lanternes de la Cité
 *     et du village (calque HAUT), mousse sur les rochers, chaînes dans la Tour.
 *   - ANIMATIONS : reflets sur l'eau, carpes koï, brume de montagne, engrenages qui tournent,
 *     pendule, gouttes dans les égouts, pétales de cerisier, rayons de lumière et poussière.
 * Les éléments hauts (guirlandes, chaînes) ne sont jamais posés sur une case libre au sol : ils sont
 * suspendus (calque HAUT) ou accrochés aux murs (cases déjà bloquées).
 */

import { TILE, type MapDef, type Prop } from "@/lib/rpg/mapdef";
import { hash } from "./pixel";
import { C, cobbleDetail, drainpipe, grassDetail, gravelDetail, ivy, lantern, leaves, noise, pathDetail, poster, puddle, px, walkDetail, wire } from "./remaster404";

type Ctx = CanvasRenderingContext2D;
type Theme = "maison" | "herbes" | "armes" | "cuisine" | "refuge" | "palais" | "muscu" | "japon" | "dojo" | "tour" | "egout" | "bar";

const THEME: Partial<Record<string, Theme>> = {
  "maison-chou": "maison",
  herboristerie: "herbes",
  armurerie: "armes",
  restaurant: "cuisine",
  refuge: "refuge",
  palais: "palais",
  temple: "muscu",
  auberge: "japon",
  dojo: "dojo",
  tour: "tour",
  "tour-sommet": "tour",
  egouts: "egout",
  bar: "bar",
  cave: "bar",
  local: "egout",
};

const skip = (m: MapDef) => m.id === "quartier";
const at = (m: MapDef, x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.ground[y][x]);
const isFloor = (k: string | null) => !!k && k !== "mur" && k !== "eau" && k !== "eaux-usees";
/** Case de façade de mur (le mur dont on voit la face : un sol juste en dessous). */
const wallFront = (m: MapDef, x: number, y: number) => at(m, x, y) === "mur" && isFloor(at(m, x, y + 1));
/** Un élément du jeu occupe (ou touche visuellement) cette colonne de mur. */
/** Meubles bas : ils ne cachent pas le mur (on peut accrocher au-dessus). */
const LOW = new Set(["comptoir", "table", "chaise", "caisse", "tonneau", "coffre", "banc", "banc-muscu", "podium", "pancarte"]);
const propNear = (m: MapDef, x: number, y: number) => m.props.some((p) => !LOW.has(p.kind) && x >= p.x && x < p.x + p.w && y + 1 >= p.y - 1 && y - 1 < p.y + p.h);

// ═══════════════════════════════ SOL ═══════════════════════════════

export function remasterGroundAll(ctx: Ctx, m: MapDef) {
  if (skip(m)) return;
  for (let ty = 0; ty < m.h; ty++)
    for (let tx = 0; tx < m.w; tx++) {
      const k = m.ground[ty][tx];
      const X = tx * TILE;
      const Y = ty * TILE;
      switch (k) {
        case "herbe":
        case "fleurs":
          grassDetail(ctx, X, Y, tx, ty);
          break;
        case "trottoir":
          walkDetail(ctx, X, Y, tx, ty, m);
          break;
        case "pave":
          cobbleDetail(ctx, X, Y, tx, ty, m);
          break;
        case "gravier":
          gravelDetail(ctx, X, Y, tx, ty);
          break;
        case "chemin":
          pathDetail(ctx, X, Y, tx, ty, m);
          break;
        case "dalle":
          slabDetail(ctx, X, Y, tx, ty, m);
          break;
        case "roche":
          rockDetail(ctx, X, Y, tx, ty);
          break;
        case "parquet":
          parquetDetail(ctx, X, Y, tx, ty);
          break;
        case "carrelage":
          tileDetail(ctx, X, Y, tx, ty);
          break;
        case "tatami":
          tatamiDetail(ctx, X, Y, tx, ty, m);
          break;
        case "marbre":
          marbleDetail(ctx, X, Y, tx, ty);
          break;
        case "tapis":
          carpetDetail(ctx, X, Y, tx, ty, m);
          break;
        case "egout":
          sewerDetail(ctx, X, Y, tx, ty);
          break;
      }
    }
  // Ombre douce au pied des bâtiments
  for (const p of m.props)
    if (p.kind === "batiment") {
      px(ctx, C.shadow2, p.x * TILE + 1, (p.y + p.h) * TILE, p.w * TILE + 1, 6);
      px(ctx, C.shadow2, p.x * TILE + 3, (p.y + p.h) * TILE, p.w * TILE - 2, 3);
    }
  // Tapis sous les tables (intérieurs)
  for (const p of m.props) if (p.kind === "table") rug(ctx, p, m);
  // Pétales tombés sous les cerisiers
  for (const p of m.props) if (p.kind === "cerisier") petals(ctx, p);
  // Flaques sur les places de nuit
  if (m.region === "nuit")
    for (let ty = 0; ty < m.h; ty++)
      for (let tx = 0; tx < m.w; tx++) if ((m.ground[ty][tx] === "pave" || m.ground[ty][tx] === "dalle") && hash(tx, ty, 300) < 0.025) puddle(ctx, tx * TILE + 3, ty * TILE + 6, 10, 4);
  // Cadran gravé au sol de la Tour
  if (m.id === "tour" || m.id === "tour-sommet") engraving(ctx, m);
}

function slabDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  // Usure en taches
  for (let y = 1; y < TILE - 1; y++)
    for (let x = 1; x < TILE - 1; x++) {
      const n = noise(X + x, Y + y, 18, 301);
      if (n < 0.22 && (x + y) % 2 === 0) px(ctx, "rgba(20,16,34,0.18)", X + x, Y + y);
      else if (n > 0.82 && (x + y) % 3 === 0) px(ctx, "rgba(255,248,230,0.12)", X + x, Y + y);
    }
  // Fissure
  if (hash(tx, ty, 302) < 0.15) {
    let cx = X + 3 + Math.floor(hash(tx, ty, 303) * 8);
    let cy = Y + 2;
    for (let i = 0; i < 10; i++) {
      px(ctx, "rgba(20,16,34,0.45)", cx, cy);
      cx += hash(tx, i, 304) < 0.5 ? 1 : -1;
      cy++;
    }
  }
  // Mousse dans les joints près de l'herbe
  const nearGrass = [at(m, tx - 1, ty), at(m, tx + 1, ty), at(m, tx, ty - 1), at(m, tx, ty + 1)].some((g) => g === "herbe" || g === "fleurs");
  if (nearGrass) for (let i = 0; i < 5; i++) px(ctx, C.moss, X + Math.floor(hash(tx, ty, 305 + i) * 16), Y + (hash(tx, ty, 310 + i) < 0.5 ? 0 : 15), 2, 1);
}

function rockDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const n = noise(X + x, Y + y, 12, 320);
      if (n < 0.25 && (x + y) % 2 === 0) px(ctx, "#5c544c", X + x, Y + y);
      else if (n > 0.8 && (x * 2 + y) % 3 === 0) px(ctx, "#958a7e", X + x, Y + y);
    }
  if (hash(tx, ty, 321) < 0.3) {
    // Touffe de mousse
    const mx = X + 2 + Math.floor(hash(tx, ty, 322) * 10);
    const my = Y + 2 + Math.floor(hash(tx, ty, 323) * 10);
    px(ctx, "#4a6a3a", mx, my, 4, 2);
    px(ctx, "#5e8248", mx + 1, my, 2, 1);
  }
  if (hash(tx, ty, 324) < 0.2) {
    // Fissure
    const cx = X + 4 + Math.floor(hash(tx, ty, 325) * 8);
    for (let i = 0; i < 6; i++) px(ctx, "#4a423c", cx + (i % 2), Y + 4 + i);
  }
}

function parquetDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  for (let i = 0; i < 4; i++) {
    const y = Y + i * 4 + 1;
    // Veinage
    for (let x = 0; x < TILE; x++) if (hash(X + x, y, 330) < 0.18) px(ctx, "rgba(60,36,20,0.35)", X + x, y);
    // Nœud du bois
    if (hash(tx, ty * 4 + i, 331) < 0.08) {
      const kx = X + 2 + Math.floor(hash(tx, ty + i, 332) * 11);
      px(ctx, "#5a3a22", kx, y, 2, 1);
      px(ctx, "#4a2e1a", kx + 1, y, 1, 1);
    }
  }
  // Usure au centre de la pièce (plus claire)
  if (hash(tx, ty, 333) < 0.12) px(ctx, "rgba(255,230,190,0.08)", X + 2, Y + 2, 12, 12);
}

function tileDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  // Joints
  px(ctx, "rgba(60,50,40,0.25)", X, Y + 7, TILE, 1);
  px(ctx, "rgba(60,50,40,0.25)", X + 7, Y, 1, TILE);
  // Éclat de lumière et tache
  if (hash(tx, ty, 340) < 0.25) px(ctx, "rgba(255,255,255,0.35)", X + 2, Y + 2, 2, 1);
  if (hash(tx, ty, 341) < 0.08) px(ctx, "rgba(90,70,40,0.25)", X + 9, Y + 10, 3, 2);
  if (hash(tx, ty, 342) < 0.06) for (let i = 0; i < 4; i++) px(ctx, "rgba(60,50,40,0.4)", X + 3 + i, Y + 4 + (i % 2));
}

function tatamiDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  const vert = (tx + ty) % 2 === 0;
  // Reflet de la paille
  for (let i = 0; i < 3; i++) if (hash(tx, ty, 350 + i) < 0.6) px(ctx, "rgba(255,250,210,0.18)", X + 3 + Math.floor(hash(tx, ty, 353 + i) * 10), Y + 3 + Math.floor(hash(tx, ty, 356 + i) * 10), vert ? 1 : 3, vert ? 3 : 1);
  if (!isFloor(at(m, tx, ty - 1))) px(ctx, "rgba(20,16,34,0.25)", X, Y, TILE, 3); // ombre du mur
}

function marbleDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  // Veines continues d'une dalle à l'autre
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const n = noise(X + x + y * 0.6, Y + y, 10, 360);
      if (Math.abs(n - 0.5) < 0.02) px(ctx, "rgba(90,80,100,0.35)", X + x, Y + y);
    }
  // Reflet
  if ((tx * 3 + ty) % 5 === 0) {
    px(ctx, "rgba(255,255,255,0.28)", X + 3, Y + 3, 4, 1);
    px(ctx, "rgba(255,255,255,0.18)", X + 3, Y + 4, 2, 1);
  }
}

function carpetDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  // Bordure dorée là où le tapis s'arrête
  const gold = "#c99a2e";
  const goldD = "#8e6a1c";
  if (at(m, tx - 1, ty) !== "tapis") {
    px(ctx, goldD, X, Y, 2, TILE);
    px(ctx, gold, X + 2, Y, 1, TILE);
    for (let y = 1; y < TILE; y += 4) px(ctx, gold, X, Y + y, 1, 1);
  }
  if (at(m, tx + 1, ty) !== "tapis") {
    px(ctx, goldD, X + 14, Y, 2, TILE);
    px(ctx, gold, X + 13, Y, 1, TILE);
    for (let y = 1; y < TILE; y += 4) px(ctx, gold, X + 15, Y + y, 1, 1);
  }
  if (at(m, tx, ty - 1) !== "tapis") px(ctx, gold, X, Y, TILE, 1);
  if (at(m, tx, ty + 1) !== "tapis") {
    px(ctx, gold, X, Y + 15, TILE, 1);
    for (let x = 1; x < TILE; x += 2) px(ctx, "#e8d8b0", X + x, Y + 15, 1, 1); // franges
  }
  // Motif central (losange)
  if ((tx + ty) % 2 === 0) {
    px(ctx, "rgba(240,200,100,0.35)", X + 7, Y + 5, 2, 1);
    px(ctx, "rgba(240,200,100,0.35)", X + 6, Y + 7, 4, 2);
    px(ctx, "rgba(240,200,100,0.35)", X + 7, Y + 10, 2, 1);
  }
}

function sewerDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  if (hash(tx, ty, 370) < 0.2) {
    const sx = X + 2 + Math.floor(hash(tx, ty, 371) * 10);
    px(ctx, "#3f5a2e", sx, Y + 3, 1, 8);
    px(ctx, "#557a3a", sx, Y + 3, 1, 2);
  }
  if (hash(tx, ty, 372) < 0.1) puddle(ctx, X + 3, Y + 7, 9, 3);
}

function rug(ctx: Ctx, p: Prop, m: MapDef) {
  const X = p.x * TILE - 6;
  const Y = p.y * TILE - 5;
  const W = p.w * TILE + 12;
  const H = p.h * TILE + 12;
  const japon = m.ground[p.y]?.[p.x] === "tatami";
  const [a, b, c] = japon ? ["#3a2a4a", "#5a4270", "#c99a2e"] : ["#6a2a2e", "#8e3a3a", "#d8b060"];
  px(ctx, "rgba(8,6,20,0.25)", X + 1, Y + 1, W, H);
  px(ctx, a, X, Y, W, H);
  px(ctx, b, X + 2, Y + 2, W - 4, H - 4);
  px(ctx, c, X + 3, Y + 3, W - 6, 1);
  px(ctx, c, X + 3, Y + H - 4, W - 6, 1);
  for (let x = X + 6; x < X + W - 6; x += 6) px(ctx, c, x, Y + Math.floor(H / 2), 2, 1);
  for (let x = X; x < X + W; x += 2) {
    px(ctx, "#e8d8b0", x, Y - 1, 1, 1);
    px(ctx, "#e8d8b0", x, Y + H, 1, 1);
  }
}

function petals(ctx: Ctx, p: Prop) {
  const cx = p.x * TILE + (p.w * TILE) / 2;
  const cy = (p.y + p.h) * TILE - 2;
  for (let i = 0; i < 12; i++) {
    const a = hash(p.x, p.y + i, 380) * Math.PI * 2;
    const r = 5 + hash(p.x + i, p.y, 381) * 15;
    px(ctx, i % 3 ? "#f0a8c0" : "#ffd0e0", Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.45), i % 4 ? 1 : 2, 1);
  }
}

/** Grand cadran gravé au centre de la salle (Tour des Heures). */
function engraving(ctx: Ctx, m: MapDef) {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++)
      if (isFloor(m.ground[y][x])) {
        sx += x;
        sy += y;
        n++;
      }
  if (!n) return;
  const cx = Math.round((sx / n + 0.5) * TILE);
  const cy = Math.round((sy / n + 0.5) * TILE);
  const R = m.id === "tour" ? 40 : 34;
  const line = "rgba(255,230,160,0.22)";
  for (const r of [R, R - 4]) {
    for (let a = 0; a < 360; a += 2) {
      const t = (a * Math.PI) / 180;
      px(ctx, line, Math.round(cx + Math.cos(t) * r), Math.round(cy + Math.sin(t) * r * 0.8));
    }
  }
  for (let h = 0; h < 12; h++) {
    const t = (h / 12) * Math.PI * 2;
    for (let k = R - 10; k < R - 5; k++) px(ctx, "rgba(255,230,160,0.3)", Math.round(cx + Math.cos(t) * k), Math.round(cy + Math.sin(t) * k * 0.8));
  }
  // Aiguilles figées sur minuit moins une
  for (let k = 0; k < R - 14; k++) px(ctx, "rgba(255,230,160,0.28)", cx, Math.round(cy - k * 0.8));
  for (let k = 0; k < R - 20; k++) px(ctx, "rgba(255,230,160,0.28)", Math.round(cx - k * 0.1), Math.round(cy - k * 0.78));
}

// ═══════════════════════════════ DÉCOR ═══════════════════════════════

export function remasterDecorAll(base: Ctx, top: Ctx, m: MapDef) {
  if (skip(m)) return;
  const theme = THEME[m.id];
  // Objets accrochés aux murs
  if (theme) {
    let n = 0;
    for (let ty = 0; ty < m.h; ty++)
      for (let tx = 1; tx < m.w - 1; tx++) {
        if (!wallFront(m, tx, ty) || propNear(m, tx, ty)) continue;
        // Une place sur deux ou trois, régulière mais pas monotone
        if ((tx + ty * 3) % (theme === "tour" || theme === "egout" ? 3 : 2) !== 0) continue;
        wallItem(base, theme, tx * TILE, ty * TILE, n++, m);
      }
  }
  // AFTER DARK : portes percées dans le mur du fond (cave, local technique, escalier)
  if (m.id === "bar" || m.id === "cave") for (const w of m.warps) if (at(m, w.at.x, w.at.y) === "mur") ironDoor(base, w.at.x * TILE, w.at.y * TILE, w.id === "escalier");
  // Façades des bâtiments
  for (const p of m.props) if (p.kind === "batiment") facade(base, p);
  // Mousse sur les rochers (Mont)
  for (const p of m.props) if (p.kind === "rocher" || p.kind === "pierre") moss(base, p);
  // Feuilles mortes sous les arbres
  for (const p of m.props) if (p.kind === "arbre") leaves(base, p.x * TILE + 16, p.y * TILE + 28, p.x * 7 + p.y);
  // Guirlandes suspendues entre les lanternes d'une même rangée (Cité, village)
  if (m.id === "cite" || m.id === "village") garlands(top, m, m.id === "village");
  // Chaînes qui pendent du plafond de la Tour
  if (m.id === "tour" || m.id === "tour-sommet")
    for (let tx = 2; tx < m.w - 2; tx += 5) for (let ty = 0; ty < m.h - 1; ty++) if (wallFront(m, tx, ty) && !propNear(m, tx, ty)) chain(top, tx * TILE + 12, ty * TILE + 4, 18 + ((tx * 7) % 10));
}

function wallItem(ctx: Ctx, theme: Theme, X: number, Y: number, n: number, m: MapDef) {
  const k = Math.floor(hash(X, Y, 400) * 3 + n) % 3;
  const y = Y - 2; // la façade utile : de Y - 2 à Y + 10 (le soubassement commence à Y + 11)
  switch (theme) {
    case "maison":
      if (k === 0) frame(ctx, X + 3, y, 10, 8, "#5a7a9a", "#c8b878");
      else if (k === 1) wallClock(ctx, X + 4, y + 1);
      else shelf(ctx, X + 2, y + 6, ["#d9637a", "#e8c35a", "#6fae4b"]);
      break;
    case "herbes":
      if (k === 2) shelf(ctx, X + 2, y + 6, ["#6fae4b", "#9a7fd8", "#e8c35a"]);
      else herbs(ctx, X + 3, y);
      break;
    case "armes":
      if (k === 0) sword(ctx, X + 7, y - 2);
      else if (k === 1) shield(ctx, X + 4, y);
      else {
        sword(ctx, X + 5, y - 2);
        sword(ctx, X + 9, y - 2);
      }
      break;
    case "cuisine":
      if (k === 0) pans(ctx, X + 2, y);
      else if (k === 1) frame(ctx, X + 3, y, 10, 8, "#e8e2d4", "#d23a3a");
      else shelf(ctx, X + 2, y + 6, ["#e8e2d4", "#c96f3a", "#e8e2d4"]);
      break;
    case "refuge":
      if (k === 0) frame(ctx, X + 2, y, 12, 8, "#7a9ab8", "#e8e2d4", true);
      else if (k === 1) antlers(ctx, X + 3, y + 1);
      else shelf(ctx, X + 2, y + 6, ["#a86a3a", "#6fae4b", "#c96f3a"]);
      break;
    case "palais":
      if (k === 0) frame(ctx, X + 3, y - 3, 10, 12, "#7a2a4a", "#e8b830", false, true);
      else if (k === 1) sconce(ctx, X + 6, y + 1);
      else tapestry(ctx, X + 3, y - 4);
      break;
    case "muscu":
      if (k === 0) mirror(ctx, X + 2, y - 3);
      else if (k === 1) gymPoster(ctx, X + 3, y - 2);
      else trophies(ctx, X + 1, y + 5);
      break;
    case "japon":
    case "dojo":
      if (k === 0) scroll(ctx, X + 5, y - 4, theme === "dojo");
      else if (k === 1) paperLantern(ctx, X + 5, y);
      else if (theme === "dojo") rack(ctx, X + 1, y + 1);
      else fan(ctx, X + 3, y + 1);
      break;
    case "tour":
      if (k === 1) wallClock(ctx, X + 4, y + 1, true);
      else gearPlate(ctx, X + 8, y + 4);
      break;
    case "egout":
      if (k === 0) grate(ctx, X + 3, Y + 4);
      else pipe(ctx, X, Y + 3);
      break;
    case "bar":
      if (k === 0) neonTube(ctx, X + 2, y + 2, n % 2 ? "#ff4a5a" : "#ff6ad8");
      else if (k === 1) dartboard(ctx, X + 4, y + 1);
      else poster(ctx, X + 5, y, n % 2 ? "#c62828" : "#e8b830", "#1b1626");
      break;
  }
  void m;
}

/** Porte en fer (ou départ d'escalier) dans une façade de mur. */
function ironDoor(ctx: Ctx, X: number, Y: number, stairs: boolean) {
  px(ctx, "#0f0c14", X + 2, Y - 4, 12, 16);
  if (stairs) {
    ["#4a4656", "#3d3a49", "#312e3c", "#26242f"].forEach((c, i) => px(ctx, c, X + 3, Y + 8 - i * 3, 10, 3));
    return;
  }
  px(ctx, "#3a3a46", X + 3, Y - 3, 10, 14);
  px(ctx, "#4a4a58", X + 3, Y - 3, 10, 1);
  for (const yy of [0, 4, 8]) px(ctx, "#2a2a34", X + 3, Y + yy, 10, 1);
  px(ctx, "#e8c35a", X + 11, Y + 3, 1, 2);
  px(ctx, "#ff4a5a", X + 5, Y - 2, 6, 1);
}

/** Néon de bar (AFTER DARK) : tube coudé et halo. */
function neonTube(ctx: Ctx, x: number, y: number, c: string) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  px(ctx, c, x - 2, y - 2, 16, 9);
  ctx.restore();
  px(ctx, c, x, y, 12, 1);
  px(ctx, c, x, y, 1, 5);
  px(ctx, c, x + 11, y, 1, 5);
  px(ctx, c, x + 3, y + 2, 6, 1);
  px(ctx, "#fff0f4", x + 4, y + 2, 2, 1);
}

/** Cible de fléchettes, deux fléchettes plantées. */
function dartboard(ctx: Ctx, x: number, y: number) {
  const rings = ["#1b1626", "#c62828", "#e8e2d4", "#2e7a4a", "#c62828"];
  rings.forEach((c, i) => {
    const r = 4 - i;
    for (let dy = -r; dy <= r; dy++) {
      const half = Math.round(Math.sqrt(r * r - dy * dy));
      px(ctx, c, x + 4 - half, y + 4 + dy, half * 2 + 1, 1);
    }
  });
  px(ctx, "#e8c35a", x + 6, y + 2, 3, 1);
  px(ctx, "#e8c35a", x + 1, y + 5, 3, 1);
}

function frame(ctx: Ctx, x: number, y: number, w: number, h: number, sky: string, accent: string, window = false, gold = false) {
  px(ctx, "rgba(8,6,20,0.35)", x + 1, y + 1, w + 2, h + 2);
  px(ctx, gold ? "#c99a2e" : "#4a2e1a", x - 1, y - 1, w + 2, h + 2);
  px(ctx, sky, x, y, w, h);
  if (window) {
    px(ctx, "#c8d8e8", x, y, w, 2);
    px(ctx, "#4a2e1a", x + Math.floor(w / 2), y, 1, h);
    px(ctx, "#4a2e1a", x, y + Math.floor(h / 2), w, 1);
    px(ctx, "#e8e2d4", x + 1, y + h - 2, 3, 1); // neige
  } else {
    px(ctx, accent, x + 2, y + h - 3, w - 4, 2);
    px(ctx, "#2f4a2a", x, y + h - 2, w, 2);
    px(ctx, "#f2e6b0", x + w - 3, y + 1, 2, 2);
  }
}

function wallClock(ctx: Ctx, x: number, y: number, brass = false) {
  const rim = brass ? "#c99a2e" : "#4a2e1a";
  for (let dy = -4; dy <= 4; dy++) {
    const half = Math.round(Math.sqrt(16 - dy * dy));
    px(ctx, rim, x + 4 - half, y + 4 + dy, half * 2 + 1, 1);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.round(Math.sqrt(9 - dy * dy));
    px(ctx, "#f2ecd8", x + 4 - half, y + 4 + dy, half * 2 + 1, 1);
  }
  px(ctx, "#141022", x + 4, y + 1, 1, 4);
  px(ctx, "#141022", x + 4, y + 4, 2, 1);
}

function shelf(ctx: Ctx, x: number, y: number, cols: string[]) {
  px(ctx, "#4a2e1a", x, y, 12, 2);
  px(ctx, "rgba(8,6,20,0.3)", x, y + 2, 12, 1);
  cols.forEach((c, i) => {
    px(ctx, "#141022", x + 1 + i * 4, y - 5, 3, 5);
    px(ctx, c, x + 1 + i * 4, y - 4, 3, 4);
    px(ctx, "rgba(255,255,255,0.4)", x + 1 + i * 4, y - 4, 1, 2);
  });
}

function herbs(ctx: Ctx, x: number, y: number) {
  px(ctx, "#4a2e1a", x - 1, y, 12, 1);
  for (let i = 0; i < 3; i++) {
    const hx = x + i * 4;
    px(ctx, "#8a6a3a", hx + 1, y + 1, 1, 2);
    px(ctx, i === 1 ? "#6a8a3a" : "#4f7a3a", hx, y + 3, 3, 4);
    px(ctx, i === 1 ? "#9a7fd8" : "#7fa04a", hx, y + 3, 1, 2);
    px(ctx, "#3a5a2a", hx + 1, y + 7, 1, 1);
  }
}

function sword(ctx: Ctx, x: number, y: number) {
  px(ctx, "#c8ccd8", x, y, 1, 10);
  px(ctx, "#ffffff", x, y, 1, 3);
  px(ctx, "#8a6a3a", x - 2, y + 10, 5, 1);
  px(ctx, "#5a3a22", x, y + 11, 1, 2);
  px(ctx, "#e8b830", x, y + 13, 1, 1);
}

function shield(ctx: Ctx, x: number, y: number) {
  for (let j = 0; j < 10; j++) {
    const w = j < 6 ? 8 : 8 - (j - 5) * 2;
    px(ctx, "#4a2e1a", x + (8 - w) / 2 - 1, y + j, w + 2, 1);
    px(ctx, j < 5 ? "#3a6aa8" : "#2f5a90", x + (8 - w) / 2, y + j, w, 1);
  }
  px(ctx, "#e8b830", x + 3, y + 2, 2, 5);
  px(ctx, "#e8b830", x + 1, y + 3, 6, 1);
}

function pans(ctx: Ctx, x: number, y: number) {
  px(ctx, "#4a2e1a", x, y, 12, 1);
  for (let i = 0; i < 2; i++) {
    const px0 = x + 1 + i * 6;
    px(ctx, "#2a2a33", px0 + 2, y + 1, 1, 3);
    px(ctx, "#3c404c", px0, y + 4, 5, 5);
    px(ctx, "#5c6170", px0 + 1, y + 4, 2, 1);
  }
}

function antlers(ctx: Ctx, x: number, y: number) {
  px(ctx, "#5a3a22", x + 3, y + 4, 4, 4);
  for (const s of [-1, 1]) {
    const bx = s < 0 ? x + 2 : x + 7;
    px(ctx, "#e8d8b0", bx, y + 1, 1, 4);
    px(ctx, "#e8d8b0", bx + s, y, 1, 2);
    px(ctx, "#e8d8b0", bx + s * 2, y + 2, 1, 1);
  }
}

function sconce(ctx: Ctx, x: number, y: number) {
  px(ctx, "#c99a2e", x, y + 4, 5, 2);
  px(ctx, "#8e6a1c", x + 2, y + 6, 1, 3);
  px(ctx, "#f8f4e8", x + 2, y + 1, 1, 3);
  px(ctx, "#ffcf6a", x + 2, y - 1, 1, 2);
}

function tapestry(ctx: Ctx, x: number, y: number) {
  px(ctx, "#8e6a1c", x - 1, y, 12, 1);
  px(ctx, "#2f7d3a", x, y + 1, 10, 11);
  px(ctx, "#e8b830", x + 4, y + 3, 2, 5);
  px(ctx, "#e8b830", x + 2, y + 4, 6, 1);
  for (let i = 0; i < 10; i += 2) px(ctx, "#e8b830", x + i, y + 12, 1, 1);
}

function mirror(ctx: Ctx, x: number, y: number) {
  px(ctx, "#2a2a33", x - 1, y - 1, 14, 13);
  px(ctx, "#8aa8c8", x, y, 12, 11);
  for (let i = 0; i < 5; i++) px(ctx, "#c8e0f0", x + 2 + i, y + 6 - i, 1, 1);
  px(ctx, "#b8d0e8", x + 8, y + 2, 2, 1);
}

function gymPoster(ctx: Ctx, x: number, y: number) {
  px(ctx, "#141022", x - 1, y - 1, 12, 13);
  px(ctx, "#f2c14e", x, y, 10, 11);
  px(ctx, "#d23a3a", x, y, 10, 3);
  // Haltère
  px(ctx, "#141022", x + 1, y + 5, 2, 4);
  px(ctx, "#141022", x + 7, y + 5, 2, 4);
  px(ctx, "#141022", x + 3, y + 6, 4, 2);
  px(ctx, "#5c6170", x + 1, y + 5, 1, 1);
  px(ctx, "#5c6170", x + 7, y + 5, 1, 1);
  px(ctx, "#141022", x + 2, y + 1, 6, 1); // titre
}

function trophies(ctx: Ctx, x: number, y: number) {
  px(ctx, "#4a2e1a", x, y + 4, 14, 2);
  for (let i = 0; i < 3; i++) {
    const tx = x + 1 + i * 5;
    const c = i === 1 ? "#e8b830" : i === 0 ? "#c8ccd8" : "#c96f3a";
    px(ctx, c, tx, y - 2, 3, 3);
    px(ctx, c, tx + 1, y + 1, 1, 2);
    px(ctx, c, tx, y + 3, 3, 1);
    px(ctx, "rgba(255,255,255,0.5)", tx, y - 2, 1, 1);
  }
}

function scroll(ctx: Ctx, x: number, y: number, ink: boolean) {
  px(ctx, "#5a3a22", x - 1, y, 8, 1);
  px(ctx, "#f2ead0", x, y + 1, 6, 12);
  px(ctx, "#5a3a22", x - 1, y + 13, 8, 1);
  // Calligraphie
  px(ctx, ink ? "#141022" : "#8e1b1b", x + 2, y + 3, 2, 1);
  px(ctx, ink ? "#141022" : "#8e1b1b", x + 3, y + 3, 1, 5);
  px(ctx, ink ? "#141022" : "#8e1b1b", x + 1, y + 6, 4, 1);
  px(ctx, "#d23a3a", x + 3, y + 10, 2, 2); // sceau
}

function paperLantern(ctx: Ctx, x: number, y: number) {
  px(ctx, "#2a2a33", x + 2, y - 2, 1, 2);
  px(ctx, "#141022", x, y, 6, 1);
  px(ctx, "#d23a3a", x, y + 1, 6, 7);
  px(ctx, "#ff8a6a", x + 1, y + 2, 4, 5);
  px(ctx, "#ffd0a0", x + 2, y + 3, 2, 3);
  px(ctx, "#141022", x, y + 8, 6, 1);
}

function rack(ctx: Ctx, x: number, y: number) {
  px(ctx, "#4a2e1a", x, y + 2, 14, 1);
  px(ctx, "#4a2e1a", x, y + 7, 14, 1);
  for (let i = 0; i < 3; i++) {
    px(ctx, "#8a6a3a", x + 1, y + 1 + i * 3, 12, 1); // bokken
    px(ctx, "#5a3a22", x + 1, y + 1 + i * 3, 3, 1);
  }
}

function fan(ctx: Ctx, x: number, y: number) {
  for (let j = 0; j < 6; j++) px(ctx, j % 2 ? "#d23a3a" : "#f2ead0", x + 5 - j, y + j, 1 + j * 2, 1);
  px(ctx, "#5a3a22", x + 5, y + 6, 1, 2);
}

function gearPlate(ctx: Ctx, x: number, y: number) {
  // Socle du mécanisme (l'engrenage tourne, voir les animations)
  px(ctx, "rgba(8,6,20,0.35)", x - 7, y - 6, 15, 13);
}

function grate(ctx: Ctx, x: number, y: number) {
  px(ctx, "#141a16", x, y, 10, 7);
  for (let i = 0; i < 5; i++) px(ctx, "#3a4a3e", x + 1 + i * 2, y + 1, 1, 5);
}

function pipe(ctx: Ctx, x: number, y: number) {
  px(ctx, "#3a4a3e", x, y, TILE, 3);
  px(ctx, "#5a6e5c", x, y, TILE, 1);
  px(ctx, "#2a3a2e", x + 6, y - 1, 3, 5);
}

/** Façade : gouttière, lierre et petite lanterne selon le style (sans toucher au dessin d'origine). */
function facade(ctx: Ctx, p: Prop) {
  const b = p.b!;
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  const H = p.h * TILE;
  const roofH = b.roof === "plat" ? 20 : 30;
  if (b.style === "palais") return;
  const s = hash(p.x, p.y, 410);
  if (b.style === "brique" || b.style === "enduit" || b.style === "boutique") drainpipe(ctx, s < 0.5 ? X + 1 : X + W - 4, Y + roofH, H - roofH - 4);
  if (b.style === "maison" || b.style === "echoppe" || s > 0.6) ivy(ctx, s < 0.5 ? X + W - 9 : X, Y + roofH + 2, H - roofH - 6, 8, 411 + p.x);
  if (b.style === "echoppe" || b.style === "maison") lantern(ctx, b.door * TILE + 15, Y + H - 15);
  if (b.style === "brique" && s < 0.5) poster(ctx, X + 4, Y + H - 13, "#3a7ad9", "#e8e2d4");
}

function moss(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  for (let i = 0; i < 10; i++) {
    const mx = X + 3 + Math.floor(hash(p.x, p.y + i, 420) * (p.w * TILE - 6));
    const my = Y + 2 + Math.floor(hash(p.x + i, p.y, 421) * 5);
    px(ctx, i % 3 ? "#4a6a3a" : "#5e8248", mx, my, 2, 1);
  }
}

/** Guirlandes de fanions (Cité) ou de lampions (village) entre deux lanternes proches. */
function garlands(top: Ctx, m: MapDef, lampions: boolean) {
  const posts = m.props.filter((p) => p.kind === "lanterne" || p.kind === "lampion" || p.kind === "lampadaire");
  const cols = lampions ? ["#d23a3a", "#ff8a6a", "#e8b830"] : ["#d23a3a", "#e8b830", "#3a7ad9", "#6fae4b", "#e8e2d4"];
  for (const a of posts)
    for (const b of posts) {
      if (b === a || b.y !== a.y || b.x <= a.x || b.x - a.x > 10) continue;
      if (posts.some((c) => c !== a && c !== b && c.y === a.y && c.x > a.x && c.x < b.x)) continue;
      const x1 = a.x * TILE + 8;
      const x2 = b.x * TILE + 8;
      const y = a.y * TILE + 3;
      const sag = Math.min(8, Math.round((x2 - x1) / 16));
      wire(top, x1, y, x2, y, sag);
      const n = Math.floor((x2 - x1) / (lampions ? 14 : 7));
      for (let i = 1; i < n; i++) {
        const t = i / n;
        const fx = Math.round(x1 + (x2 - x1) * t);
        const fy = Math.round(y + sag * 4 * t * (1 - t));
        const c = cols[i % cols.length];
        if (lampions) {
          px(top, "#141022", fx - 2, fy + 1, 5, 1);
          px(top, c, fx - 2, fy + 2, 5, 4);
          px(top, "#ffe0a0", fx - 1, fy + 3, 3, 2);
        } else {
          px(top, c, fx - 1, fy + 1, 3, 1);
          px(top, c, fx, fy + 2, 2, 1);
          px(top, c, fx, fy + 3, 1, 1);
        }
      }
    }
}

function chain(top: Ctx, x: number, y: number, len: number) {
  for (let i = 0; i < len; i++) px(top, i % 3 === 0 ? "#8a8e9a" : "#4a4e5a", x + (i % 3 === 1 ? 1 : 0), y + i, i % 3 === 0 ? 2 : 1, 1);
  px(top, "#5c6170", x - 1, y + len, 4, 3);
}

// ═══════════════════════════════ LUMIÈRES ═══════════════════════════════

export function remasterLightsAll(m: MapDef): { x: number; y: number; r: number; color: string; tint?: boolean; flicker?: boolean }[] {
  if (skip(m)) return [];
  const out: { x: number; y: number; r: number; color: string; tint?: boolean; flicker?: boolean }[] = [];
  // Lanternes de façade
  for (const p of m.props)
    if (p.kind === "batiment" && (p.b!.style === "echoppe" || p.b!.style === "maison")) out.push({ x: p.b!.door * TILE + 17, y: (p.y + p.h) * TILE - 11, r: 14, color: "#ffcf6a", tint: true });
  // Lampions des guirlandes du village
  if (m.id === "village")
    for (const p of m.props) if (p.kind === "lampion") out.push({ x: p.x * TILE + 8, y: p.y * TILE + 8, r: 20, color: "#ff8a6a", tint: true });
  return out;
}

// ═══════════════════════════════ ANIMATIONS ═══════════════════════════════

const vis = (x: number, y: number, ox: number, oy: number, vw: number, vh: number, pad = 24) => x - ox > -pad && y - oy > -pad && x - ox < vw + pad && y - oy < vh + pad;

/** Animations au sol (sous les personnages). */
export function remasterLiveAll(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number, vw: number, vh: number, reduced: boolean) {
  if (skip(m) || reduced) return;
  const x0 = Math.max(0, Math.floor(ox / TILE));
  const y0 = Math.max(0, Math.floor(oy / TILE));
  const x1 = Math.min(m.w - 1, Math.ceil((ox + vw) / TILE));
  const y1 = Math.min(m.h - 1, Math.ceil((oy + vh) / TILE));
  // Scintillements sur l'eau
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      if (m.ground[ty][tx] !== "eau") continue;
      const ph = (t * 0.8 + hash(tx, ty, 430) * 4) % 4;
      if (ph < 0.5) px(ctx, "rgba(200,230,255,0.7)", tx * TILE + 3 + Math.floor(hash(tx, ty, 431) * 10) - ox, ty * TILE + 4 + Math.floor(hash(tx, ty, 432) * 8) - oy, 2, 1);
    }
  // Carpes koï dans les bassins (Voie du Samouraï)
  if (m.id === "cerisiers" || m.id === "village") koi(ctx, m, t, ox, oy);
  // Engrenages qui tournent et pendule (Tour des Heures)
  if (m.id === "tour" || m.id === "tour-sommet") {
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!wallFront(m, tx, ty) || propNear(m, tx, ty) || (tx + ty * 3) % 3 !== 0) continue;
        const k = Math.floor(hash(tx * TILE, ty * TILE, 400) * 3 + 0) % 3;
        if (k === 1) continue; // horloge murale (fixe)
        gear(ctx, tx * TILE + 8 - ox, ty * TILE + 2 - oy, 6, t * (tx % 2 ? 1.2 : -1.2));
      }
    pendulum(ctx, m, t, ox, oy);
  }
  // Gouttes qui tombent des murs des égouts
  if (m.id === "egouts")
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) {
        if (!wallFront(m, tx, ty) || hash(tx, ty, 440) > 0.25) continue;
        const ph = (t * 0.6 + hash(tx, ty, 441)) % 1;
        const dx = tx * TILE + 5 + Math.floor(hash(tx, ty, 442) * 6) - ox;
        const dy = ty * TILE + 12 + Math.round(ph * 14) - oy;
        if (ph < 0.85) px(ctx, "rgba(150,200,140,0.8)", dx, dy, 1, 2);
        else px(ctx, "rgba(150,200,140,0.5)", dx - 1, ty * TILE + 26 - oy, 3, 1);
      }
}

/** Animations par-dessus (après le calque haut). */
export function remasterTopAll(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number, vw: number, vh: number, reduced: boolean) {
  if (skip(m) || reduced) return;
  // Pétales de cerisier qui tombent
  if (m.id === "cerisiers" || m.id === "village")
    for (let i = 0; i < 26; i++) {
      const sp = 9 + hash(i, 1, 450) * 8;
      const life = (t / sp + hash(i, 2, 451)) % 1;
      const x = Math.round(((hash(i, 3, 452) * (vw + 60) + life * 70 + Math.sin(t * 1.5 + i) * 6) % (vw + 60)) - 30);
      const y = Math.round(life * (vh + 20) - 10);
      px(ctx, i % 3 ? "#f8b8cc" : "#ffe0ea", x, y, Math.floor(t * 3 + i) % 2 ? 2 : 1, 1);
    }
  // Brume de montagne qui glisse
  if (m.id === "sentier" || m.id === "temple-cour")
    for (let i = 0; i < 5; i++) {
      const y = Math.round(((i * 53 + t * 2) % (vh + 30)) - 15);
      const x = Math.round(((t * (6 + i * 2) + i * 97) % (vw + 160)) - 80);
      ctx.fillStyle = "rgba(230,220,240,0.06)";
      ctx.fillRect(x, y, 90, 6);
      ctx.fillRect(x + 10, y - 3, 60, 3);
      ctx.fillRect(x + 20, y + 6, 50, 2);
    }
  // Rayons de lumière et poussière (Tour, temple)
  if (m.id === "tour" || m.id === "tour-sommet" || m.id === "temple") {
    for (let i = 0; i < 3; i++) {
      const bx = Math.round(((i * 150 + 40) % (m.w * TILE)) - ox);
      if (bx < -60 || bx > vw + 60) continue;
      ctx.fillStyle = m.id === "temple" ? "rgba(255,240,200,0.05)" : "rgba(255,230,160,0.05)";
      for (let y = 0; y < vh; y += 2) ctx.fillRect(bx + Math.round(y * 0.35), y, 22, 1);
    }
    for (let i = 0; i < 18; i++) {
      const x = Math.round((hash(i, 5, 460) * vw + Math.sin(t * 0.4 + i) * 10) % vw);
      const y = Math.round((hash(i, 6, 461) * vh - t * (2 + (i % 3))) % vh + vh) % vh;
      if (Math.floor(t * 2 + i) % 5 === 0) continue;
      px(ctx, "rgba(255,240,200,0.55)", x, y, 1, 1);
    }
  }
  // Poussière de magnésie autour des sacs de frappe
  if (m.id === "temple-cour" || m.id === "temple")
    for (const p of m.props) {
      if (p.kind !== "sac-frappe" || !vis(p.x * TILE, p.y * TILE, ox, oy, vw, vh)) continue;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.7 + i / 3) % 1;
        px(ctx, `rgba(240,240,240,${0.5 * (1 - ph)})`, Math.round(p.x * TILE + 4 + i * 4 + Math.sin(t + i) * 2 - ox), Math.round(p.y * TILE + 14 - ph * 12 - oy), 1, 1);
      }
    }
}

function koi(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number) {
  const water: [number, number][] = [];
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.ground[y][x] === "eau") water.push([x, y]);
  if (!water.length) return;
  for (let i = 0; i < 3; i++) {
    const [wx, wy] = water[Math.floor(hash(i, 7, 470) * water.length)];
    const a = t * (0.5 + i * 0.15) + i * 2;
    const cx = wx * TILE + 8 + Math.cos(a) * 5;
    const cy = wy * TILE + 8 + Math.sin(a) * 3;
    if (m.ground[Math.floor(cy / TILE)]?.[Math.floor(cx / TILE)] !== "eau") continue;
    const dx = -Math.sin(a) > 0 ? 1 : -1;
    const X = Math.round(cx - ox);
    const Y = Math.round(cy - oy);
    px(ctx, i === 1 ? "#f2ead0" : "#f08a3a", X, Y, 3, 2);
    px(ctx, "#d23a3a", X + (dx > 0 ? 1 : 0), Y, 1, 1);
    px(ctx, i === 1 ? "#f08a3a" : "#e86a2a", X - dx * 2, Y, 1, 1);
  }
}

/** Engrenage en pixels (dents qui tournent). */
function gear(ctx: Ctx, cx: number, cy: number, r: number, a: number) {
  ctx.fillStyle = "#6a5a3a";
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    ctx.fillRect(Math.round(cx - half), Math.round(cy + dy), half * 2 + 1, 1);
  }
  for (let i = 0; i < 8; i++) {
    const t = a + (i * Math.PI) / 4;
    ctx.fillStyle = "#8e7a4a";
    ctx.fillRect(Math.round(cx + Math.cos(t) * (r + 1)) - 1, Math.round(cy + Math.sin(t) * (r + 1)) - 1, 3, 3);
  }
  ctx.fillStyle = "#c99a2e";
  for (let dy = -2; dy <= 2; dy++) ctx.fillRect(Math.round(cx - 2), Math.round(cy + dy), 5, 1);
  ctx.fillStyle = "#2a2018";
  ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
  for (let i = 0; i < 4; i++) {
    const t = a + (i * Math.PI) / 2;
    ctx.fillStyle = "#4a3a24";
    ctx.fillRect(Math.round(cx + Math.cos(t) * 4), Math.round(cy + Math.sin(t) * 4), 1, 1);
  }
}

/** Grand pendule doré sur le mur du fond. */
function pendulum(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number) {
  let wy = -1;
  for (let y = 0; y < m.h && wy < 0; y++) if (wallFront(m, Math.floor(m.w / 2) + 3, y)) wy = y;
  if (wy < 0) return;
  const px0 = (Math.floor(m.w / 2) + 3) * TILE + 8 - ox;
  const py0 = wy * TILE - 12 - oy;
  const ang = Math.sin(t * 1.6) * 0.35;
  const L = 18;
  for (let i = 0; i < L; i++) px(ctx, "#8e6a1c", Math.round(px0 + Math.sin(ang) * i), Math.round(py0 + Math.cos(ang) * i), 1, 1);
  const bx = Math.round(px0 + Math.sin(ang) * L);
  const by = Math.round(py0 + Math.cos(ang) * L);
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.round(Math.sqrt(9 - dy * dy));
    px(ctx, "#c99a2e", bx - half, by + dy, half * 2 + 1, 1);
  }
  px(ctx, "#f2dc8a", bx - 1, by - 2, 2, 1);
}

// ═══════════════════════════════ COMBATS ═══════════════════════════════

const VIGNETTE = new Map<string, HTMLCanvasElement>();
/** Vignette tramée (pixels, sans flou) : assombrit les bords pour donner de la profondeur. */
function vignette(w: number, h: number) {
  const k = `${w}:${h}`;
  let c = VIGNETTE.get(k);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const img = g.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2);
      const dy = (y - h / 2) / (h / 2);
      const d = Math.sqrt(dx * dx * 0.8 + dy * dy);
      const chk = (x + y) % 2 === 0;
      const a = d > 1.15 ? 0.3 : d > 1.0 ? (chk ? 0.26 : 0.12) : d > 0.88 ? (chk ? 0.12 : 0) : 0;
      img.data[(y * w + x) * 4 + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  VIGNETTE.set(k, c);
  return c;
}

/** Ambiance animée des arrière-plans de combat (dessinée juste après le décor, sous les combattants). */
export function battleAmbient(ctx: Ctx, kind: string, t: number, w: number, h: number, reduced: boolean) {
  const horizon = Math.round(h * 0.5);
  if (!reduced) {
    if (kind === "rue")
      for (let i = 0; i < 40; i++) {
        if (Math.floor(t * 1.5 + hash(i, 7, 3) * 10) % 7 !== 0) continue;
        px(ctx, "#ffffff", Math.floor(hash(i, 1, 3) * w), Math.floor(hash(i, 2, 3) * horizon * 0.8), 1, 1);
      }
    if (kind === "cerisiers" || kind === "festival")
      for (let i = 0; i < 18; i++) {
        const life = (t / (7 + hash(i, 1, 480) * 5) + hash(i, 2, 481)) % 1;
        const x = Math.round((hash(i, 3, 482) * (w + 40) + life * 50 + Math.sin(t * 1.4 + i) * 5) % (w + 40)) - 20;
        px(ctx, i % 3 ? "#f8b8cc" : "#ffe0ea", x, Math.round(life * h), Math.floor(t * 3 + i) % 2 ? 2 : 1, 1);
      }
    if (kind === "montagne" || kind === "temple")
      for (let i = 0; i < 3; i++) {
        const x = Math.round(((t * (5 + i * 2) + i * 90) % (w + 140)) - 70);
        ctx.fillStyle = "rgba(240,230,250,0.07)";
        ctx.fillRect(x, horizon - 18 + i * 9, 80, 4);
        ctx.fillRect(x + 12, horizon - 21 + i * 9, 50, 3);
      }
    if (kind === "egout")
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.7 + hash(i, 1, 490)) % 1;
        px(ctx, "rgba(150,200,140,0.7)", Math.floor(hash(i, 2, 491) * w), Math.round(ph * horizon), 1, 2);
      }
    if (kind === "tour" || kind === "sommet" || kind === "dojo" || kind === "palais" || kind === "trone" || kind === "sanctuaire")
      for (let i = 0; i < 16; i++) {
        if (Math.floor(t * 2 + i) % 6 === 0) continue;
        const x = Math.round((hash(i, 5, 495) * w + Math.sin(t * 0.5 + i) * 8 + w) % w);
        const y = Math.round(((hash(i, 6, 496) * h - t * (2 + (i % 3))) % h) + h) % h;
        px(ctx, "rgba(255,240,200,0.55)", x, y, 1, 1);
      }
  }
  ctx.drawImage(vignette(w, h), 0, 0);
}

// ═══════════════════════════════ APPARTEMENT ═══════════════════════════════

/** Appartement de Sparrow : grain de lumière et poussière dans l'air, par-dessus la pièce (aucun meuble touché). */
export function apartmentAmbient(ctx: Ctx, w: number, h: number, t: number, reduced: boolean, room: { x: number; y: number; w: number; h: number }) {
  if (!reduced)
    for (let i = 0; i < 10; i++) {
      if (Math.floor(t * 1.5 + i) % 5 === 0) continue;
      const x = room.x + Math.round((hash(i, 1, 500) * room.w + Math.sin(t * 0.3 + i) * 6 + room.w) % room.w);
      const y = room.y + Math.round(((hash(i, 2, 501) * room.h - t * (1.5 + (i % 3) * 0.5)) % room.h + room.h) % room.h);
      px(ctx, "rgba(255,240,210,0.45)", x, y, 1, 1);
    }
  ctx.drawImage(vignette(w, h), 0, 0);
}
