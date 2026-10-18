/**
 * RPG — remaster graphique du QUARTIER 404 (décor seulement : aucune collision, aucun gameplay).
 *
 * Trois passes ajoutées au rendu existant (tiles.ts), seulement pour la carte « quartier » :
 *   - SOL (après le sol de base) : variations de l'herbe, dalles et fissures des trottoirs,
 *     asphalte usé, passages piétons, plaques d'égout, flaques, incrustations de la place…
 *   - DÉCOR (après les éléments posés) : gouttières, climatiseurs, tags, affiches, lierre,
 *     antenne, nénuphars, roseaux, marelle, bandes de sécurité de la station… (calque BASE),
 *     câbles électriques et linge suspendu (calque HAUT, Sparrow passe dessous).
 *   - ANIMATIONS (à chaque image) : reflets des flaques, vapeur de la ruelle, papillons de nuit
 *     autour des lampadaires, néon qui grésille, yeux du chat dans la ruelle.
 * Même grille (cases de 16 px), même palette de nuit (P) que le reste de la carte.
 */

import { TILE, type MapDef } from "@/lib/rpg/mapdef";
import { hash } from "./pixel";

type Ctx = CanvasRenderingContext2D;

const px = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

/** Bruit de valeur lissé (taches d'herbe, usure) : 0..1, continu d'une case à l'autre. */
function noise(x: number, y: number, cell: number, seed: number) {
  const gx = Math.floor(x / cell);
  const gy = Math.floor(y / cell);
  const fx = (x - gx * cell) / cell;
  const fy = (y - gy * cell) / cell;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(gx, gy, seed);
  const b = hash(gx + 1, gy, seed);
  const c = hash(gx, gy + 1, seed);
  const d = hash(gx + 1, gy + 1, seed);
  const u = s(fx);
  const v = s(fy);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Palette (identique à la palette de nuit de tiles.ts, plus quelques nuances)
const C = {
  grass: "#2c4a3a",
  grassD: "#233c2f",
  grassDD: "#1d3328",
  grassL: "#3a5f48",
  grassT: "#4a7458",
  walk: "#545366",
  walkD: "#444356",
  walkDD: "#3a394b",
  walkL: "#636277",
  road: "#272631",
  roadD: "#211f29",
  roadDD: "#1b1a22",
  roadL: "#302f3b",
  roadP: "#2c2b36",
  zebra: "#c9c4b4",
  zebraD: "#a39e90",
  cob: "#5d5868",
  cobL: "#6c6778",
  cobD: "#494454",
  stoneL: "#827c8e",
  puddle: "#1c2638",
  puddleL: "#2f4566",
  puddleR: "#4d6c94",
  metal: "#5c6170",
  metalD: "#3c404c",
  metalL: "#7a8090",
  ink: "#141022",
  leaf: "#22432d",
  leafM: "#2d573a",
  leafL: "#3b6c48",
  moss: "#3e5a3a",
  rust: "#7a4a32",
  gold: "#f2c14e",
  warm: "#ffd98a",
  shadow: "rgba(8,6,20,0.38)",
  shadow2: "rgba(8,6,20,0.22)",
};

/** Flaques (cases) : dessinées dans le sol, puis reflets animés. */
const PUDDLES: { x: number; y: number; w: number; h: number }[] = [
  { x: 13 * TILE + 3, y: 11 * TILE + 6, w: 14, h: 5 },
  { x: 25 * TILE + 5, y: 12 * TILE + 4, w: 11, h: 4 },
  { x: 9 * TILE + 2, y: 10 * TILE + 7, w: 9, h: 4 },
  { x: 20 * TILE + 2, y: 7 * TILE + 5, w: 12, h: 5 },
  { x: 31 * TILE + 4, y: 13 * TILE + 8, w: 10, h: 4 },
  { x: 14 * TILE + 6, y: 23 * TILE + 6, w: 9, h: 4 },
];

/** Passages piétons (colonnes), au travers de la route (rangées 11 et 12). */
const CROSSINGS = [5, 17];

const isQuartier = (m: MapDef) => m.id === "quartier";
const ground = (m: MapDef, x: number, y: number) => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.ground[y][x]);

// ═══════════════════════════════ SOL ═══════════════════════════════

export function remasterGround(ctx: Ctx, m: MapDef) {
  if (!isQuartier(m)) return;
  for (let ty = 0; ty < m.h; ty++)
    for (let tx = 0; tx < m.w; tx++) {
      const k = m.ground[ty][tx];
      const X = tx * TILE;
      const Y = ty * TILE;
      if (k === "herbe" || k === "fleurs") grassDetail(ctx, X, Y, tx, ty);
      else if (k === "trottoir") walkDetail(ctx, X, Y, tx, ty, m);
      else if (k === "route" || k === "ligne") roadDetail(ctx, X, Y, tx, ty, k === "ligne");
      else if (k === "pave") cobbleDetail(ctx, X, Y, tx, ty, m);
      else if (k === "gravier") gravelDetail(ctx, X, Y, tx, ty);
      else if (k === "chemin") pathDetail(ctx, X, Y, tx, ty, m);
      else if (k === "ruelle") alleyDetail(ctx, X, Y, tx, ty);
    }
  // Ombre douce au pied des bâtiments (en plus de l'ombre courte existante)
  for (const p of m.props) {
    if (p.kind !== "batiment") continue;
    const X = p.x * TILE;
    const Y = (p.y + p.h) * TILE;
    const W = p.w * TILE;
    px(ctx, C.shadow2, X + 1, Y, W + 1, 6);
    px(ctx, C.shadow2, X + 3, Y, W - 2, 3);
  }
  for (const c of CROSSINGS) crossing(ctx, c);
  manhole(ctx, 22 * TILE + 3, 11 * TILE + 4);
  manhole(ctx, 2 * TILE + 4, 12 * TILE + 2);
  manhole(ctx, 30 * TILE + 3, 11 * TILE + 5);
  for (const p of PUDDLES) puddle(ctx, p.x, p.y, p.w, p.h);
}

/** Herbe : grandes taches plus sombres / plus claires, touffes, trèfles, cailloux. */
function grassDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const wx = X + x;
      const wy = Y + y;
      const n = noise(wx, wy, 22, 71);
      const chk = (wx + wy) % 2 === 0;
      if (n < 0.28 && chk) px(ctx, C.grassD, wx, wy);
      else if (n < 0.2) px(ctx, C.grassDD, wx, wy);
      else if (n > 0.78 && chk && hash(wx, wy, 72) < 0.5) px(ctx, C.grassL, wx, wy);
    }
  // Touffes (petit « v » clair sur ombre)
  for (let i = 0; i < 2; i++) {
    if (hash(tx, ty, 73 + i) > 0.55) continue;
    const fx = X + 2 + Math.floor(hash(tx, ty, 75 + i) * 11);
    const fy = Y + 4 + Math.floor(hash(tx, ty, 77 + i) * 9);
    px(ctx, C.grassDD, fx - 1, fy + 2, 4, 1);
    px(ctx, C.grassT, fx - 1, fy, 1, 2);
    px(ctx, C.grassL, fx, fy - 1, 1, 3);
    px(ctx, C.grassT, fx + 1, fy, 1, 2);
  }
  if (hash(tx, ty, 79) < 0.07) {
    // Petit caillou
    const fx = X + 3 + Math.floor(hash(tx, ty, 80) * 9);
    const fy = Y + 3 + Math.floor(hash(tx, ty, 81) * 9);
    px(ctx, "#3e3c4a", fx, fy + 1, 3, 1);
    px(ctx, "#6a6676", fx, fy, 2, 1);
  }
}

/** Trottoir : grandes dalles irrégulières, joints, fissures, chewing-gums, bordure ombrée. */
function walkDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  // Nuance de dalle (une dalle sur trois un peu plus usée)
  for (let s = 0; s < 4; s++) {
    const sx = X + (s % 2) * 8;
    const sy = Y + Math.floor(s / 2) * 8;
    const v = hash(tx * 2 + (s % 2), ty * 2 + Math.floor(s / 2), 82);
    if (v < 0.3) for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) if ((x + y) % 2 === 0) px(ctx, C.walkD, sx + x, sy + y);
    if (v > 0.9) px(ctx, C.walkL, sx + 2, sy + 2, 3, 1);
  }
  // Fissure fine
  if (hash(tx, ty, 83) < 0.18) {
    let cx = X + 2 + Math.floor(hash(tx, ty, 84) * 10);
    let cy = Y + 1 + Math.floor(hash(tx, ty, 85) * 4);
    for (let i = 0; i < 9; i++) {
      px(ctx, C.walkDD, cx, cy);
      cx += hash(tx + i, ty, 86) < 0.5 ? 1 : 0;
      cy += 1;
    }
  }
  // Chewing-gum / tache
  if (hash(tx, ty, 87) < 0.1) px(ctx, "#4c4b5d", X + 4 + Math.floor(hash(tx, ty, 88) * 8), Y + 4 + Math.floor(hash(tx, ty, 89) * 8), 2, 1);
  // Bordure de trottoir côté route : arête claire + ombre portée
  if (ground(m, tx, ty + 1) === "route") {
    px(ctx, "#8a87a0", X, Y + 15, TILE, 1);
  }
  if (ground(m, tx, ty - 1) === "ligne") {
    px(ctx, "#8a87a0", X, Y, TILE, 1);
  }
}

/** Route : asphalte irrégulier, réparations, traces d'usure, fissures. */
function roadDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, lower: boolean) {
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const wx = X + x;
      const wy = Y + y;
      if (!lower && y < 3) continue; // bordure
      if (lower && y > 12) continue;
      const n = noise(wx, wy, 14, 90);
      if (n < 0.22 && (wx + wy) % 2 === 0) px(ctx, C.roadDD, wx, wy);
      else if (n > 0.8 && (wx * 3 + wy) % 4 === 0) px(ctx, C.roadL, wx, wy);
    }
  // Traces de pneus (bandes légèrement plus claires)
  const band = lower ? Y + 4 : Y + 8;
  for (let x = 0; x < TILE; x++) if (hash(X + x, band, 91) < 0.55) px(ctx, C.roadP, X + x, band, 1, 2);
  // Rustine d'enrobé
  if (hash(tx, ty, 92) < 0.14) {
    const rx = X + 2 + Math.floor(hash(tx, ty, 93) * 6);
    const ry = Y + (lower ? 2 : 5) + Math.floor(hash(tx, ty, 94) * 3);
    px(ctx, "#2e2d39", rx, ry, 8, 5);
    px(ctx, C.roadDD, rx, ry + 5, 8, 1);
    px(ctx, C.roadDD, rx + 8, ry, 1, 6);
  }
  // Fissure
  if (hash(tx, ty, 95) < 0.16) {
    let cx = X + Math.floor(hash(tx, ty, 96) * 10);
    const cy = Y + (lower ? 3 : 6) + Math.floor(hash(tx, ty, 97) * 4);
    for (let i = 0; i < 7; i++) {
      px(ctx, C.roadDD, cx, cy + (hash(tx, i, 98) < 0.5 ? 0 : 1));
      cx++;
    }
  }
  // Ombre de la bordure sur la chaussée
  if (!lower) px(ctx, "rgba(8,6,20,0.35)", X, Y + 3, TILE, 1);
  else px(ctx, "rgba(8,6,20,0.35)", X, Y + 12, TILE, 1);
}

/** Passage piéton (2 cases de large) au travers des rangées 11–12. */
function crossing(ctx: Ctx, col: number) {
  const X = col * TILE + 2;
  const W = 2 * TILE - 4;
  // Le marquage central s'efface sous le passage
  px(ctx, C.road, X - 2, 12 * TILE, W + 4, 1);
  for (let y = 11 * TILE + 5; y < 12 * TILE + 12; y += 5) {
    for (let x = 0; x < W; x++) {
      const worn = hash(X + x, y, 99) < 0.12;
      px(ctx, worn ? C.zebraD : C.zebra, X + x, y, 1, 3);
    }
    px(ctx, "rgba(8,6,20,0.25)", X, y + 3, W, 1);
  }
}

function manhole(ctx: Ctx, x: number, y: number) {
  const r = 4;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    px(ctx, C.roadDD, x + 4 - half, y + 4 + dy, half * 2, 1);
  }
  for (let dy = -3; dy <= 3; dy++) {
    const half = Math.round(Math.sqrt(9 - dy * dy));
    px(ctx, "#33323d", x + 4 - half, y + 4 + dy, half * 2, 1);
  }
  for (let i = -2; i <= 2; i += 2) px(ctx, C.roadDD, x + 2, y + 4 + i, 5, 1);
  px(ctx, "#454452", x + 2, y + 1, 3, 1);
}

function puddle(ctx: Ctx, x: number, y: number, w: number, h: number) {
  for (let dy = 0; dy < h; dy++) {
    const k = Math.abs(dy - (h - 1) / 2) / (h / 2);
    const inset = Math.round(k * k * (w / 3));
    px(ctx, C.puddle, x + inset, y + dy, w - inset * 2, 1);
  }
  px(ctx, C.puddleL, x + Math.round(w / 3), y + 1, Math.round(w / 3), 1);
  px(ctx, "rgba(8,6,20,0.3)", x + 2, y + h, w - 4, 1);
}

/** Place pavée : usure au centre, mousse dans les joints près des bords, pavés manquants. */
function cobbleDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  // Anneau décoratif autour de la fontaine (centre 17.5, 18.5)
  const cx = 17.5 * TILE;
  const cy = 18.5 * TILE;
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const d = Math.hypot(X + x - cx, (Y + y - cy) * 1.05);
      if (d > 34 && d < 38) px(ctx, (Math.floor(Math.atan2(Y + y - cy, X + x - cx) * 8) & 1) === 0 ? C.stoneL : "#9890a4", X + x, Y + y);
      else if (d >= 38 && d < 39.2) px(ctx, C.cobD, X + x, Y + y);
    }
  // Mousse près de l'herbe
  const nearGrass = ["herbe", "fleurs"].some((g) => [ground(m, tx - 1, ty), ground(m, tx + 1, ty), ground(m, tx, ty - 1), ground(m, tx, ty + 1)].includes(g as never));
  if (nearGrass)
    for (let i = 0; i < 6; i++) {
      const mx = X + Math.floor(hash(tx, ty, 100 + i) * 15);
      const my = Y + Math.floor(hash(tx, ty, 110 + i) * 15);
      px(ctx, C.moss, mx, my, 1, 1);
    }
  // Pavé manquant
  if (hash(tx, ty, 120) < 0.06) {
    const mx = X + 4 * Math.floor(hash(tx, ty, 121) * 3) + 1;
    const my = Y + 4 * Math.floor(hash(tx, ty, 122) * 3) + 1;
    px(ctx, "#2f2b38", mx, my, 3, 3);
    px(ctx, "#3a3644", mx, my, 3, 1);
  }
}

function gravelDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  // Taches d'huile et ornières
  if (hash(tx, ty, 130) < 0.08) {
    const ox = X + 3 + Math.floor(hash(tx, ty, 131) * 6);
    const oy = Y + 4 + Math.floor(hash(tx, ty, 132) * 6);
    px(ctx, "#2a2a33", ox, oy, 6, 3);
    px(ctx, "#33334a", ox + 1, oy, 2, 1);
  }
  for (let i = 0; i < 3; i++) if (hash(tx, ty, 133 + i) < 0.4) px(ctx, "#5f5e6b", X + Math.floor(hash(tx, ty, 136 + i) * 15), Y + Math.floor(hash(tx, ty, 139 + i) * 15), 2, 1);
}

/** Chemin de terre : bordure de petites pierres côté herbe, ornières. */
function pathDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number, m: MapDef) {
  const sides: [number, number][] = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const [dx, dy] of sides) {
    const n = ground(m, tx + dx, ty + dy);
    if (n !== "herbe" && n !== "fleurs") continue;
    for (let i = 1; i < TILE - 1; i += 4) {
      if (hash(tx * 3 + i, ty * 5 + dx + dy * 2, 140) < 0.35) continue;
      const sx = dx === -1 ? X + 1 : dx === 1 ? X + TILE - 3 : X + i;
      const sy = dy === -1 ? Y + 1 : dy === 1 ? Y + TILE - 3 : Y + i;
      px(ctx, "#3f3a40", sx, sy + 1, 2, 1);
      px(ctx, "#7a7280", sx, sy, 2, 1);
    }
  }
  // Ornière centrale
  if (hash(tx, ty, 141) < 0.5) px(ctx, "#4b3d30", X + 6, Y + 3 + Math.floor(hash(tx, ty, 142) * 8), 4, 1);
}

function alleyDetail(ctx: Ctx, X: number, Y: number, tx: number, ty: number) {
  // Grille d'aération (la vapeur en sort, voir animations)
  if (tx === 20 && ty === 4) {
    px(ctx, "#15141b", X + 3, Y + 4, 10, 8);
    for (let i = 0; i < 5; i++) px(ctx, "#3a3946", X + 4 + i * 2, Y + 5, 1, 6);
    px(ctx, "#4a4958", X + 3, Y + 4, 10, 1);
  }
  // Papiers par terre
  if (hash(tx, ty, 143) < 0.3) {
    const ox = X + 2 + Math.floor(hash(tx, ty, 144) * 11);
    const oy = Y + 2 + Math.floor(hash(tx, ty, 145) * 11);
    px(ctx, "#8a8578", ox, oy, 3, 2);
    px(ctx, "#6a6658", ox + 1, oy + 1, 2, 1);
  }
}

// ═══════════════════════════════ DÉCOR ═══════════════════════════════

/** Détails posés sur les façades, la station, le parc et la place (calque BASE), plus les câbles (calque HAUT). */
export function remasterDecor(base: Ctx, top: Ctx, m: MapDef) {
  if (!isQuartier(m)) return;
  const b = base;
  // ── Résidence Les Lilas (brique, x 1–9, y 2–8)
  drainpipe(b, 1 * TILE + 1, 2 * TILE + 30, 6 * TILE - 30);
  drainpipe(b, 10 * TILE - 4, 2 * TILE + 30, 6 * TILE - 30);
  // Petits climatiseurs dans l'espace entre deux fenêtres (fenêtres : x = 22 + 16k, rangées y = 66 + 16r)
  acUnit(b, 33, 68);
  acUnit(b, 33 + 16 * 5, 84);
  acUnit(b, 33 + 16 * 3, 100);
  balcony(b, 3 * TILE + 4, 5 * TILE + 12, 26);
  balcony(b, 6 * TILE + 4, 4 * TILE + 12, 26);
  graffiti(b, 2 * TILE + 2, 8 * TILE + 2);
  poster(b, 7 * TILE + 3, 7 * TILE + 13, "#d23a3a", "#f2c14e");
  poster(b, 8 * TILE + 5, 7 * TILE + 14, "#3a7ad9", "#e8e2d4");
  // ── Supérette (x 12–18, y 4–8) : affiches de promo dans la vitrine, néon « 24h »
  px(b, "#d23a3a", 12 * TILE + 8, 7 * TILE + 13, 6, 4);
  px(b, "#f8f4e8", 12 * TILE + 9, 7 * TILE + 14, 4, 1);
  px(b, "#e8c35a", 14 * TILE + 6, 7 * TILE + 13, 6, 4);
  px(b, "#141022", 14 * TILE + 7, 7 * TILE + 14, 4, 1);
  neon24(b, 17 * TILE + 3, 6 * TILE + 3);
  // ── Chez Madame Bouchon (x 22–27, y 3–7) : lierre, lanterne
  ivy(b, 22 * TILE, 4 * TILE + 14, 4 * TILE - 14, 9, 150);
  lantern(b, 25 * TILE + 2, 6 * TILE + 2);
  // ── Maison bleue (x 29–34, y 3–7) : lierre, parabole, numéro
  ivy(b, 34 * TILE + 10, 4 * TILE + 16, 3 * TILE - 2, 6, 151);
  dish(b, 30 * TILE + 2, 3 * TILE + 6);
  px(b, "#e8e2d4", 32 * TILE + 3, 7 * TILE + 2, 5, 6);
  px(b, "#33364f", 32 * TILE + 5, 7 * TILE + 3, 1, 4);
  // ── Ruelle : tag sur le mur, vieux vélo d'affiches déchirées
  graffiti(b, 19 * TILE + 1, 3 * TILE + 10, true);
  poster(b, 21 * TILE + 10, 3 * TILE + 6, "#9a7fd8", "#e8e2d4");
  // ── Place de la Fontaine : marelle à la craie
  hopscotch(b, 14 * TILE + 4, 16 * TILE + 2);
  // ── Parc : nénuphars, roseaux, feuilles mortes sous les arbres
  for (const [x, y] of [
    [1 * TILE + 6, 23 * TILE + 8],
    [3 * TILE + 2, 24 * TILE + 5],
    [2 * TILE + 9, 25 * TILE + 3],
  ])
    lily(b, x, y);
  reeds(b, 1 * TILE + 1, 25 * TILE + 6);
  reeds(b, 4 * TILE + 9, 23 * TILE + 1);
  for (const p of m.props) if (p.kind === "arbre" && p.y > 2 && p.y < m.h - 2) leaves(b, p.x * TILE + 16, p.y * TILE + 28, p.x * 7 + p.y);
  // ── Station électrique : bandes de sécurité, caniveaux à câbles
  hazard(b, 27 * TILE + 8, 21 * TILE + 14, 5 * TILE);
  conduit(b, 26 * TILE + 8, 19 * TILE + 2, 28 * TILE, 19 * TILE + 2);
  conduit(b, 32 * TILE, 19 * TILE + 2, 33 * TILE + 8, 19 * TILE + 2);
  conduit(b, 30 * TILE, 22 * TILE + 12, 30 * TILE, 26 * TILE + 8);
  // ── Calque HAUT : câbles au-dessus de la rue, linge dans la ruelle
  wire(top, 10 * TILE - 2, 3 * TILE + 8, 12 * TILE + 2, 4 * TILE + 6, 3);
  wire(top, 18 * TILE + 14, 4 * TILE + 4, 22 * TILE + 1, 3 * TILE + 10, 4);
  wire(top, 26 * TILE + 8, 16 * TILE + 3, 33 * TILE + 8, 16 * TILE + 3, 5);
  laundry(top, 19 * TILE + 1, 5 * TILE + 2, 22 * TILE - 1, 5 * TILE + 2);
}

function drainpipe(ctx: Ctx, x: number, y: number, h: number) {
  px(ctx, C.metalD, x, y, 3, h);
  px(ctx, C.metal, x, y, 1, h);
  for (let i = 6; i < h; i += 14) px(ctx, C.metalL, x - 1, y + i, 5, 1);
  px(ctx, C.metalD, x - 1, y + h - 2, 5, 2);
}

function acUnit(ctx: Ctx, x: number, y: number) {
  px(ctx, C.ink, x - 1, y - 1, 6, 6);
  px(ctx, "#8b8f9c", x, y, 4, 4);
  px(ctx, "#a4a8b4", x, y, 4, 1);
  px(ctx, "#5f6370", x + 1, y + 2, 2, 1);
  px(ctx, C.shadow, x, y + 5, 4, 1);
  // Goutte de condensation
  px(ctx, "#2f4566", x + 3, y + 6, 1, 2);
}

function balcony(ctx: Ctx, x: number, y: number, w: number) {
  px(ctx, C.metalD, x, y, w, 1);
  px(ctx, C.metalD, x, y + 5, w, 1);
  for (let i = 0; i < w; i += 3) px(ctx, C.metal, x + i, y, 1, 6);
  px(ctx, C.shadow2, x, y + 6, w, 2);
  // Pot de fleurs sur le balcon
  px(ctx, "#7a4a32", x + w - 6, y - 3, 4, 3);
  px(ctx, C.leafL, x + w - 6, y - 5, 4, 2);
  px(ctx, "#d9637a", x + w - 5, y - 6, 1, 1);
}

function graffiti(ctx: Ctx, x: number, y: number, alt = false) {
  const a = alt ? "#3fb8a8" : "#9a7fd8";
  const b2 = alt ? "#e8c35a" : "#3fb8a8";
  // « 404 » en tag stylisé
  const glyph = (gx: number, rows: string[]) => rows.forEach((r, j) => [...r].forEach((c, i) => c !== "." && px(ctx, c === "a" ? a : b2, gx + i, y + j)));
  glyph(x, ["a.a", "a.a", "aaa", "..a", "..b"]);
  glyph(x + 4, ["aaa", "a.a", "a.a", "aaa", "bb."]);
  glyph(x + 8, ["a.a", "a.a", "aaa", "..a", "..b"]);
}

function poster(ctx: Ctx, x: number, y: number, c1: string, c2: string) {
  px(ctx, C.ink, x - 1, y - 1, 8, 10);
  px(ctx, c1, x, y, 6, 8);
  px(ctx, c2, x + 1, y + 2, 4, 2);
  px(ctx, c2, x + 1, y + 5, 3, 1);
  // coin déchiré
  px(ctx, "#8a8578", x + 5, y + 6, 1, 2);
}

function neon24(ctx: Ctx, x: number, y: number) {
  px(ctx, C.ink, x - 1, y - 1, 13, 7);
  // « 24 » + « h »
  const on = "#6ff0ff";
  const g = ["aaa.a.a.a..", "..a.a.a.aa.", "aaa.aaa.a.a", "a.....a.a.a", "aaa...a.a.a"];
  g.forEach((r, j) => [...r].forEach((c, i) => c === "a" && px(ctx, on, x + i, y + j)));
}

function ivy(ctx: Ctx, x: number, y: number, h: number, w: number, seed: number) {
  for (let j = 0; j < h; j++) {
    const spread = Math.round(w * (0.5 + 0.5 * noise(x, y + j, 9, seed)));
    for (let i = 0; i < spread; i++) {
      const r = hash(x + i, y + j, seed);
      if (r < 0.32) px(ctx, r < 0.1 ? C.leafL : r < 0.2 ? C.leafM : C.leaf, x + i, y + j);
    }
  }
}

function lantern(ctx: Ctx, x: number, y: number) {
  px(ctx, C.metalD, x + 2, y - 3, 1, 3);
  px(ctx, C.ink, x, y, 5, 7);
  px(ctx, "#ffcf6a", x + 1, y + 1, 3, 5);
  px(ctx, "#fff3c0", x + 2, y + 2, 1, 2);
  px(ctx, C.ink, x - 1, y, 7, 1);
}

function dish(ctx: Ctx, x: number, y: number) {
  px(ctx, C.metalD, x + 5, y + 4, 1, 6);
  for (let j = 0; j < 6; j++) px(ctx, j < 2 ? "#c8c4d0" : "#a8a4b4", x + Math.abs(j - 2), y + j, 8 - Math.abs(j - 2) * 2, 1);
  px(ctx, C.metalD, x + 4, y + 2, 1, 1);
}

function hopscotch(ctx: Ctx, x: number, y: number) {
  const chalk = "rgba(232,226,212,0.55)";
  const box = (bx: number, by: number) => {
    px(ctx, chalk, bx, by, 7, 1);
    px(ctx, chalk, bx, by + 6, 7, 1);
    px(ctx, chalk, bx, by, 1, 7);
    px(ctx, chalk, bx + 6, by, 1, 7);
  };
  box(x + 3, y);
  box(x, y + 6);
  box(x + 6, y + 6);
  box(x + 3, y + 12);
  box(x + 3, y + 18);
  px(ctx, "rgba(232,226,212,0.5)", x + 5, y + 2, 2, 2);
}

function lily(ctx: Ctx, x: number, y: number) {
  px(ctx, "#2f6a3a", x, y, 5, 3);
  px(ctx, "#3f8a48", x + 1, y, 3, 1);
  px(ctx, "#1f3d63", x + 2, y + 1, 1, 2);
  if ((x + y) % 3 === 0) px(ctx, "#f0b8c8", x + 3, y - 1, 2, 1);
}

function reeds(ctx: Ctx, x: number, y: number) {
  for (let i = 0; i < 5; i++) {
    const h = 5 + ((i * 3) % 4);
    px(ctx, i % 2 ? C.leafM : C.leafL, x + i, y - h, 1, h);
    if (i % 2 === 0) px(ctx, "#5a3a26", x + i, y - h - 1, 1, 2);
  }
}

function leaves(ctx: Ctx, cx: number, cy: number, seed: number) {
  const cols = ["#7a4a32", "#9a6a2a", "#5c3a2a"];
  for (let i = 0; i < 7; i++) {
    const a = hash(seed, i, 160) * Math.PI * 2;
    const r = 6 + hash(seed, i, 161) * 10;
    px(ctx, cols[i % 3], Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.4), 2, 1);
  }
}

function hazard(ctx: Ctx, x: number, y: number, w: number) {
  for (let i = 0; i < w; i++) px(ctx, Math.floor((i + 2) / 3) % 2 ? "#e8b830" : "#1b1a22", x + i, y, 1, 3);
  px(ctx, C.shadow2, x, y + 3, w, 1);
}

function conduit(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  const horiz = y1 === y2;
  const len = horiz ? x2 - x1 : y2 - y1;
  for (let i = 0; i < len; i++) {
    const X = horiz ? x1 + i : x1;
    const Y = horiz ? y1 : y1 + i;
    px(ctx, "#2a2a33", X, Y, horiz ? 1 : 4, horiz ? 4 : 1);
    if (i % 6 === 0) px(ctx, "#55545f", X, Y, horiz ? 1 : 4, horiz ? 4 : 1);
  }
}

/** Câble suspendu (chaînette), 1 px, sombre avec un reflet. */
function wire(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, sag: number) {
  const n = Math.max(2, Math.abs(x2 - x1));
  let last: [number, number] | null = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = Math.round(x1 + (x2 - x1) * t);
    const y = Math.round(y1 + (y2 - y1) * t + sag * 4 * t * (1 - t));
    if (last && Math.abs(y - last[1]) > 1) px(ctx, "#0e0c16", x, Math.min(y, last[1]), 1, Math.abs(y - last[1]));
    px(ctx, "#0e0c16", x, y);
    last = [x, y];
  }
}

function laundry(ctx: Ctx, x1: number, y1: number, x2: number, y2: number) {
  wire(ctx, x1, y1, x2, y2, 3);
  const cloth: [number, string, number, number][] = [
    [8, "#d23a3a", 5, 6],
    [16, "#e8e2d4", 6, 5],
    [25, "#3a7ad9", 4, 7],
    [34, "#e8c35a", 5, 5],
  ];
  for (const [dx, c, w, h] of cloth) {
    const t = dx / (x2 - x1);
    const y = Math.round(y1 + 3 * 4 * t * (1 - t));
    px(ctx, c, x1 + dx, y + 1, w, h);
    px(ctx, "rgba(8,6,20,0.35)", x1 + dx, y + h, w, 1);
    px(ctx, "#f8f4e8", x1 + dx, y, 1, 2);
  }
}

/** Lumières ajoutées par le remaster (lanterne, néon). */
export function remasterLights(m: MapDef): { x: number; y: number; r: number; color: string; tint?: boolean; flicker?: boolean }[] {
  if (!isQuartier(m)) return [];
  return [
    { x: 25 * TILE + 4, y: 6 * TILE + 6, r: 16, color: "#ffcf6a", tint: true },
    { x: 17 * TILE + 8, y: 6 * TILE + 6, r: 14, color: "#6ff0ff", tint: true, flicker: true },
  ];
}

// ═══════════════════════════════ ANIMATIONS ═══════════════════════════════

/** Effets animés au sol (sous les personnages) : reflets des flaques, vapeur de la ruelle. */
export function remasterLive(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number, vw: number, vh: number, reduced: boolean) {
  if (!isQuartier(m)) return;
  const vis = (x: number, y: number, pad = 24) => x - ox > -pad && y - oy > -pad && x - ox < vw + pad && y - oy < vh + pad;
  // Flaques : un reflet qui glisse et frémit
  for (const p of PUDDLES) {
    if (!vis(p.x, p.y)) continue;
    const k = reduced ? 0.5 : (Math.sin(t * 1.3 + p.x * 0.07) + 1) / 2;
    const rx = Math.round(p.x + 2 + k * (p.w - 6));
    px(ctx, C.puddleR, rx - ox, p.y + 1 - oy, 3, 1);
    if (!reduced && Math.floor(t * 2 + p.y) % 5 === 0) px(ctx, "#8fb0d8", rx + 1 - ox, p.y + 2 - oy, 1, 1);
    // Reflet chaud d'un lampadaire voisin
    px(ctx, "rgba(255,217,138,0.35)", p.x + Math.round(p.w / 2) - 1 - ox, p.y + 2 - oy, 2, Math.max(1, p.h - 3));
  }
  // Vapeur qui sort de la grille de la ruelle
  const vx = 20 * TILE + 8;
  const vy = 4 * TILE + 6;
  if (!reduced && vis(vx, vy, 40))
    for (let i = 0; i < 4; i++) {
      const life = (t * 0.5 + i / 4) % 1;
      const x = Math.round(vx + Math.sin((t + i) * 1.7) * 3 - ox);
      const y = Math.round(vy - life * 26 - oy);
      ctx.fillStyle = `rgba(200,205,220,${0.28 * (1 - life)})`;
      const r = 2 + Math.round(life * 3);
      ctx.fillRect(x - r, y - 1, r * 2, 3);
      ctx.fillRect(x - r + 1, y - 2, r * 2 - 2, 5);
    }
}

/** Effets par-dessus (après le calque haut, avant le voile de nuit) : papillons de nuit, néon, yeux du chat. */
export function remasterTop(ctx: Ctx, m: MapDef, t: number, ox: number, oy: number, reduced: boolean) {
  if (!isQuartier(m)) return;
  // Papillons de nuit autour des têtes de lampadaires
  if (!reduced)
    for (const p of m.props) {
      if (p.kind !== "lampadaire") continue;
      const hx = p.x * TILE + 8 - ox;
      const hy = p.y * TILE + 6 - oy;
      if (hx < -20 || hy < -20 || hx > ctx.canvas.width + 20 || hy > ctx.canvas.height + 20) continue;
      for (let i = 0; i < 2; i++) {
        const a = t * (2.2 + i * 0.9) + p.x + i * 2;
        ctx.fillStyle = "#fff3c0";
        ctx.fillRect(Math.round(hx + Math.cos(a) * (5 + i * 2)), Math.round(hy + Math.sin(a * 1.3) * 3), 1, 1);
      }
    }
  // Néon « 24h » qui grésille de temps en temps
  const flick = !reduced && Math.floor(t * 9) % 23 === 0;
  if (flick) px(ctx, "rgba(20,16,34,0.85)", 17 * TILE + 3 - ox, 6 * TILE + 3 - oy, 11, 5);
  // Un chat dans l'ombre de la ruelle : deux yeux qui clignent
  const blink = Math.floor(t * 1.1) % 6 === 0;
  if (!blink) {
    px(ctx, "#d8f060", 19 * TILE + 4 - ox, 2 * TILE + 11 - oy, 1, 1);
    px(ctx, "#d8f060", 19 * TILE + 7 - ox, 2 * TILE + 11 - oy, 1, 1);
  }
}
