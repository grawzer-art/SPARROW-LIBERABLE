/**
 * RPG — tileset du chapitre 2 (pixel art original, dessiné par le code) :
 * Cité des Frites Perdues, intérieurs, égouts et palais du Roi de la Salade.
 *
 * Même principe que tiles.ts : le sol et les éléments fixes sont peints une fois dans les
 * calques ; les éléments qui changent (coffres, vannes, eaux qui se retirent, grille)
 * sont redessinés à chaque image par `drawLive`.
 */

import { TILE, type Ground, type MapDef, type Prop } from "@/lib/rpg/mapdef";
import { hash, pixelText, textWidth } from "./pixel";

type Ctx = CanvasRenderingContext2D;

/** Outils partagés avec tiles.ts (pour ne pas dupliquer les primitives ni les lumières). */
export interface Kit {
  px: (ctx: Ctx, c: string, x: number, y: number, w?: number, h?: number) => void;
  blob: (ctx: Ctx, cx: number, cy: number, r: number, c: string) => void;
  shadow: (ctx: Ctx, cx: number, cy: number, rx: number, ry: number) => void;
  light: (l: { x: number; y: number; r: number; color: string; tint?: boolean; flicker?: boolean }) => void;
  map: MapDef;
}

const Q = {
  ink: "#141022",
  slab: "#9c8a78",
  slabL: "#b09e8a",
  slabD: "#7e6e60",
  soil: "#4a3424",
  soilL: "#5c4230",
  sprout: "#6fae4b",
  plank: "#7a5232",
  plankL: "#8e6440",
  plankD: "#5a3a22",
  parquet: "#8a5e3a",
  parquetL: "#9c6e46",
  parquetD: "#6e4a2c",
  tileA: "#e8e2d4",
  tileB: "#c9c1ae",
  carpet: "#8e1b1b",
  carpetL: "#a82a2a",
  gold: "#e8b830",
  goldD: "#a87a18",
  wall: "#c9b48e",
  wallL: "#d8c6a2",
  wallD: "#a8946e",
  base: "#5a3a26",
  rampart: "#7a6e66",
  rampartL: "#8e827a",
  rampartD: "#5a504a",
  sewer: "#3a4a40",
  sewerL: "#4a5c50",
  sewerD: "#2a362e",
  muck: "#2f5a3a",
  muckL: "#3f7a4a",
  muckH: "#7fbf6a",
  marble: "#e6e0d4",
  marbleV: "#cfc6b4",
  marbleD: "#b8ae98",
  green: "#2f7d3a",
  greenL: "#4fa055",
  greenD: "#1f5a2a",
  metal: "#7d8590",
  metalD: "#4a505a",
  metalL: "#a3abb5",
  red: "#c62828",
  white: "#f1efe8",
  wood: "#6a4628",
  woodL: "#8a6038",
  woodD: "#4a3018",
  stone: "#8a8478",
  stoneD: "#625c52",
  stoneL: "#a8a296",
};

// ─── Sol ───

const at = (m: MapDef, x: number, y: number): Ground | null => (x < 0 || y < 0 || x >= m.w || y >= m.h ? null : m.ground[y][x]);

/** Peint une case de sol propre au chapitre 2. Renvoie false si ce n'en est pas une. */
export function paintGround2(ctx: Ctx, k: Ground, tx: number, ty: number, kit: Kit): boolean {
  const { px } = kit;
  const X = tx * TILE;
  const Y = ty * TILE;
  const m = kit.map;
  switch (k) {
    case "dalle": {
      px(ctx, Q.slabD, X, Y, TILE, TILE);
      const off = ty % 2 ? 8 : 0;
      for (let i = -1; i < 2; i++) {
        const sx = X + off + i * 16;
        const c = hash(tx * 2 + i, ty, 61) < 0.5 ? Q.slab : Q.slabL;
        ctx.save();
        ctx.beginPath();
        ctx.rect(X, Y, TILE, TILE);
        ctx.clip();
        px(ctx, c, sx + 1, Y + 1, 14, 14);
        px(ctx, Q.slabL, sx + 1, Y + 1, 14, 1);
        if (hash(tx, ty, 62 + i) < 0.2) px(ctx, Q.slabD, sx + 4, Y + 7, 5, 1);
        ctx.restore();
      }
      return true;
    }
    case "potager":
      px(ctx, Q.soil, X, Y, TILE, TILE);
      for (let r = 0; r < 4; r++) {
        px(ctx, Q.soilL, X, Y + r * 4, TILE, 1);
        for (let c = 2; c < TILE; c += 5) {
          px(ctx, Q.sprout, X + c, Y + r * 4 + 1, 1, 2);
          px(ctx, Q.greenL, X + c - 1, Y + r * 4 + 1, 1, 1);
        }
      }
      return true;
    case "pont":
      px(ctx, Q.plankD, X, Y, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        px(ctx, hash(tx, ty * 4 + i, 63) < 0.5 ? Q.plank : Q.plankL, X, Y + i * 4, TILE, 3);
        px(ctx, Q.ink, X + 2 + ((ty + i) % 3) * 4, Y + i * 4 + 1, 1, 1);
      }
      return true;
    case "parquet":
      px(ctx, Q.parquetD, X, Y, TILE, TILE);
      for (let i = 0; i < 4; i++) {
        const off = ((tx + i) % 2) * 8;
        px(ctx, hash(tx, ty * 4 + i, 64) < 0.5 ? Q.parquet : Q.parquetL, X, Y + i * 4, TILE, 3);
        px(ctx, Q.parquetD, X + off, Y + i * 4, 1, 3);
      }
      return true;
    case "carrelage":
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) px(ctx, (tx * 2 + i + ty * 2 + j) % 2 ? Q.tileA : Q.tileB, X + i * 8, Y + j * 8, 8, 8);
      return true;
    case "tapis": {
      px(ctx, Q.carpet, X, Y, TILE, TILE);
      for (let i = 0; i < 16; i += 4) px(ctx, Q.carpetL, X + i, Y + ((i / 4 + ty) % 2) * 8, 2, 2);
      const edge = (dx: number, dy: number) => at(m, tx + dx, ty + dy) !== "tapis";
      if (edge(-1, 0)) px(ctx, Q.gold, X, Y, 2, TILE);
      if (edge(1, 0)) px(ctx, Q.gold, X + 14, Y, 2, TILE);
      if (edge(0, -1)) px(ctx, Q.gold, X, Y, TILE, 2);
      if (edge(0, 1)) px(ctx, Q.gold, X, Y + 14, TILE, 2);
      return true;
    }
    case "mur": {
      const below = at(m, tx, ty + 1);
      if (m.region === "interieur" || m.region === "palais") {
        const pal = m.region === "palais" ? ["#5a3a6a", "#6a4a7a", "#46305a"] : m.id === "bar" ? ["#3a1e26", "#462630", "#2a141c"] : [Q.wall, Q.wallL, Q.wallD];
        px(ctx, pal[0], X, Y, TILE, TILE);
        for (let i = 2; i < TILE; i += 6) px(ctx, pal[1], X + i, Y, 2, TILE);
        if (below && below !== "mur") {
          px(ctx, Q.base, X, Y + 11, TILE, 5);
          px(ctx, "#7a5236", X, Y + 11, TILE, 1);
        } else if (!at(m, tx, ty - 1) || at(m, tx, ty - 1) === "mur") px(ctx, pal[2], X, Y, TILE, 2);
      } else if (m.region === "egout") {
        px(ctx, Q.sewerD, X, Y, TILE, TILE);
        for (let y = 0; y < TILE; y += 4) {
          px(ctx, "#1f2a24", X, Y + y, TILE, 1);
          const off = (y / 4 + ty) % 2 ? 4 : 0;
          for (let x = off; x < TILE; x += 8) px(ctx, "#1f2a24", X + x, Y + y, 1, 4);
        }
        if (hash(tx, ty, 65) < 0.18) px(ctx, Q.muckL, X + 5, Y + 6, 1, 6); // suintement
        if (below && below !== "mur") px(ctx, "#16201a", X, Y + 14, TILE, 2);
      } else {
        // Rempart de la cité
        px(ctx, Q.rampart, X, Y, TILE, TILE);
        for (let y = 0; y < TILE; y += 5) {
          px(ctx, Q.rampartD, X, Y + y + 4, TILE, 1);
          const off = (y / 5 + ty) % 2 ? 4 : 0;
          for (let x = off; x < TILE; x += 8) px(ctx, Q.rampartD, X + x, Y + y, 1, 4);
          px(ctx, Q.rampartL, X + off + 1, Y + y, 5, 1);
        }
        if (!at(m, tx, ty - 1) || at(m, tx, ty - 1) !== "mur") for (let x = 0; x < TILE; x += 6) px(ctx, Q.rampartL, X + x, Y, 4, 3); // créneaux
      }
      return true;
    }
    case "egout": {
      px(ctx, Q.sewer, X, Y, TILE, TILE);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          px(ctx, Q.sewerL, X + i * 8, Y + j * 8, 7, 1);
          px(ctx, Q.sewerD, X + i * 8 + 7, Y + j * 8, 1, 8);
        }
      if (hash(tx, ty, 66) < 0.12) px(ctx, Q.muck, X + 4, Y + 9, 5, 2);
      const water = (dx: number, dy: number) => at(m, tx + dx, ty + dy) === "eaux-usees";
      if (water(0, 1)) px(ctx, Q.sewerD, X, Y + 14, TILE, 2);
      return true;
    }
    case "eaux-usees":
      px(ctx, Q.muck, X, Y, TILE, TILE);
      if (at(m, tx, ty - 1) !== "eaux-usees") px(ctx, "#1f3a28", X, Y, TILE, 2);
      return true;
    case "tatami": {
      const vert = (tx + ty) % 2 === 0;
      px(ctx, "#c8b878", X, Y, TILE, TILE);
      for (let i = 1; i < TILE; i += 3) px(ctx, "#b8a868", vert ? X + i : X, vert ? Y : Y + i, vert ? 1 : TILE, vert ? TILE : 1);
      px(ctx, "#5a3a22", X, Y, TILE, 1);
      px(ctx, "#5a3a22", X, Y, 1, TILE);
      return true;
    }
    case "roche":
      px(ctx, "#7a7068", X, Y, TILE, TILE);
      for (let i = 0; i < 6; i++) {
        const sx = Math.floor(hash(tx, ty, 80 + i) * 13);
        const sy = Math.floor(hash(tx, ty, 90 + i) * 13);
        px(ctx, i % 2 ? "#8e847a" : "#625a52", X + sx, Y + sy, 3, 2);
      }
      return true;
    case "marbre": {
      const c = (tx + ty) % 2 ? Q.marble : Q.marbleV;
      px(ctx, c, X, Y, TILE, TILE);
      px(ctx, Q.marbleD, X, Y + 15, TILE, 1);
      px(ctx, Q.marbleD, X + 15, Y, 1, TILE);
      if (hash(tx, ty, 67) < 0.4) {
        const vx = Math.floor(hash(tx, ty, 68) * 10) + 2;
        for (let i = 0; i < 6; i++) px(ctx, Q.marbleD, X + vx + (i % 3), Y + 3 + i * 2, 1, 1);
      }
      return true;
    }
  }
  return false;
}

/** Animation des eaux usées (dessinée par-dessus le sol). */
export function drawMuck(ctx: Ctx, map: MapDef, t: number, ox: number, oy: number) {
  const x0 = Math.max(0, Math.floor(ox / TILE));
  const y0 = Math.max(0, Math.floor(oy / TILE));
  const x1 = Math.min(map.w, Math.ceil((ox + ctx.canvas.width) / TILE) + 1);
  const y1 = Math.min(map.h, Math.ceil((oy + ctx.canvas.height) / TILE) + 1);
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      if (map.ground[y][x] !== "eaux-usees") continue;
      const X = x * TILE - ox;
      const Y = y * TILE - oy;
      for (let i = 0; i < 3; i++) {
        const wx = Math.floor((hash(x, y, 70 + i) * 12 + t * 4) % 12) + 2;
        const wy = 4 + i * 4 + (Math.floor(t * 1.5 + i) % 2);
        ctx.fillStyle = i === 1 ? Q.muckH : Q.muckL;
        ctx.fillRect(X + wx, Y + wy, 3, 1);
      }
      if (hash(x, y, 73) < 0.15 && Math.floor(t * 2 + x) % 5 === 0) {
        ctx.fillStyle = Q.muckH;
        ctx.fillRect(X + 7, Y + 7, 2, 2); // bulle
      }
    }
}

// ─── Éléments posés ───

/** Peint un élément fixe du chapitre 2 (false si inconnu). `top` = calque haut. */
export function paintProp2(base: Ctx, top: Ctx, p: Prop, kit: Kit): boolean {
  const { px, blob, shadow, light } = kit;
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  const H = p.h * TILE;
  const b = base;
  switch (p.kind) {
    case "statue": {
      // Statue du Roi de la Salade sur son socle
      shadow(b, X + W / 2, Y + H - 2, W / 2 - 2, 3);
      px(b, Q.stoneD, X + 3, Y + H - 14, W - 6, 13);
      px(b, Q.stone, X + 4, Y + H - 13, W - 8, 2);
      px(b, Q.stoneL, X + 2, Y + H - 16, W - 4, 3);
      if (p.text) pixelText(b, p.text, X + W / 2 - Math.round(textWidth(p.text) / 2), Y + H - 9, Q.gold);
      const t = top;
      blob(t, X + W / 2, Y + 18, 10, Q.stoneD);
      blob(t, X + W / 2 - 1, Y + 17, 9, Q.stone);
      blob(t, X + W / 2 - 4, Y + 14, 3, Q.stoneL);
      for (let i = 0; i < 5; i++) px(t, Q.stoneD, X + W / 2 - 6 + i * 3, Y + 13 + (i % 2) * 6, 1, 4);
      px(t, Q.goldD, X + W / 2 - 7, Y + 4, 14, 4);
      for (let i = 0; i < 4; i++) px(t, Q.gold, X + W / 2 - 7 + i * 4, Y + 1, 2, 4);
      px(t, Q.stoneD, X + W / 2 - 4, Y + 28, 8, 6);
      return true;
    }
    case "fontaine-seche": {
      shadow(b, X + 26, Y + 44, 22, 4);
      blob(b, X + 24, Y + 26, 23, Q.stoneD);
      blob(b, X + 24, Y + 25, 22, Q.stone);
      blob(b, X + 24, Y + 25, 18, "#5a5248");
      for (let i = 0; i < 6; i++) px(b, "#4a4238", X + 12 + i * 4, Y + 20 + (i % 3) * 4, 3, 1); // fissures
      px(b, "#6a5a3a", X + 30, Y + 30, 4, 2); // feuilles mortes
      blob(b, X + 24, Y + 24, 5, Q.stoneD);
      px(b, Q.stoneL, X + 22, Y + 8, 5, 16);
      px(b, Q.stoneD, X + 26, Y + 8, 1, 16);
      // Cornet de frites géant en pierre au sommet (souvenir d'avant le décret)
      for (let y = 0; y < 8; y++) px(b, (y % 2 ? Q.stone : Q.stoneL), X + 20 + Math.floor(y / 3), Y + 2 + y, 9 - Math.floor(y / 3) * 2, 1);
      for (let i = 0; i < 4; i++) px(b, Q.stoneL, X + 20 + i * 2, Y - 2 + (i % 2) * 2, 1, 5);
      return true;
    }
    case "etal": {
      // Étal du marché : tréteaux, cageots de légumes, petit auvent
      shadow(b, X + W / 2, Y + 15, W / 2 - 1, 2);
      px(b, Q.woodD, X + 1, Y + 7, W - 2, 6);
      px(b, Q.woodL, X + 1, Y + 7, W - 2, 1);
      px(b, Q.woodD, X + 2, Y + 12, 2, 4);
      px(b, Q.woodD, X + W - 4, Y + 12, 2, 4);
      const veg = p.variant === 1 ? ["#e07a2a", "#c94a2a"] : p.variant === 2 ? ["#8a4a9a", "#e8e0ee"] : ["#6fae4b", "#a8db7c"];
      for (let i = 0; i < W - 6; i += 3) {
        px(b, veg[i % 2 ? 1 : 0], X + 3 + i, Y + 4 + (i % 2), 3, 3);
      }
      const aw = p.variant === 1 ? Q.red : p.variant === 2 ? "#6a3a9a" : Q.green;
      for (let x = 0; x < W; x++) px(top, Math.floor(x / 4) % 2 ? aw : Q.white, X + x, Y - 6, 1, 4);
      px(top, Q.woodD, X + 1, Y - 3, 1, 8);
      px(top, Q.woodD, X + W - 2, Y - 3, 1, 8);
      return true;
    }
    case "tonneau":
      shadow(b, X + 8, Y + 15, 6, 2);
      px(b, Q.woodD, X + 3, Y + 2, 10, 13);
      px(b, Q.wood, X + 4, Y + 2, 8, 13);
      px(b, Q.woodL, X + 5, Y + 3, 2, 11);
      px(b, Q.metalD, X + 3, Y + 4, 10, 1);
      px(b, Q.metalD, X + 3, Y + 12, 10, 1);
      px(b, "#3a2a18", X + 4, Y + 1, 8, 2);
      return true;
    case "caisse":
      shadow(b, X + 8, Y + 15, 7, 2);
      px(b, Q.woodD, X + 1, Y + 3, 14, 12);
      px(b, Q.woodL, X + 2, Y + 4, 12, 10);
      px(b, Q.woodD, X + 2, Y + 8, 12, 1);
      px(b, Q.woodD, X + 7, Y + 4, 1, 10);
      return true;
    case "pancarte": {
      shadow(b, X + 8, Y + 15, 5, 1);
      px(b, Q.woodD, X + 7, Y + 8, 2, 8);
      px(b, Q.ink, X, Y, 16, 10);
      px(b, Q.woodL, X + 1, Y + 1, 14, 8);
      px(b, Q.white, X + 3, Y + 2, 10, 6);
      px(b, Q.green, X + 4, Y + 3, 8, 1);
      px(b, "#555", X + 4, Y + 5, 6, 1);
      px(b, Q.red, X + 10, Y + 6, 2, 1);
      return true;
    }
    case "plaque":
      // Plaque d'égout (on l'examine avec A)
      blob(b, X + 8, Y + 8, 6, Q.metalD);
      blob(b, X + 8, Y + 8, 5, "#5a606a");
      for (let i = -3; i <= 3; i += 2) px(b, Q.metalD, X + 5, Y + 8 + i, 7, 1);
      px(b, Q.metalL, X + 6, Y + 4, 3, 1);
      return true;
    case "echelle":
      for (let y = 0; y < H; y += 4) px(b, Q.metal, X + 4, Y + y + 2, 8, 1);
      px(b, Q.metalD, X + 3, Y, 2, H);
      px(b, Q.metalD, X + 11, Y, 2, H);
      px(b, "#0a0e0c", X + 2, Y - 2, 12, 3);
      return true;
    case "tuyau":
      px(b, Q.metalD, X, Y + 5, W, 6);
      px(b, Q.metal, X, Y + 6, W, 2);
      for (let x = 8; x < W; x += 24) px(b, Q.metalL, X + x, Y + 4, 3, 8);
      return true;
    case "comptoir":
      shadow(b, X + W / 2, Y + 15, W / 2, 2);
      px(b, Q.woodD, X, Y + 3, W, 12);
      px(b, Q.woodL, X, Y + 3, W, 3);
      for (let x = 4; x < W; x += 10) px(b, Q.wood, X + x, Y + 8, 6, 5);
      if (p.variant === 1) {
        // Caisse enregistreuse
        px(b, Q.metalD, X + W - 13, Y - 2, 10, 6);
        px(b, "#9fe8a0", X + W - 11, Y - 1, 6, 2);
      }
      return true;
    case "etagere": {
      px(b, Q.woodD, X, Y, W, H);
      for (let s = 0; s < 3; s++) {
        const sy = Y + 2 + s * 5;
        px(b, Q.woodL, X + 1, sy + 4, W - 2, 1);
        for (let i = 2; i < W - 2; i += 3) px(b, ["#d9637a", "#6fae4b", "#e8c35a", "#9a7fd8", "#e8e2d4"][(i + s * 2 + p.x) % 5], X + i, sy + 1, 2, 3);
      }
      return true;
    }
    case "bibliotheque":
      px(b, Q.woodD, X, Y, W, H);
      for (let s = 0; s < 3; s++) {
        const sy = Y + 1 + s * 5;
        px(b, Q.wood, X + 1, sy + 4, W - 2, 1);
        for (let i = 1; i < W - 1; i += 2) px(b, ["#8e1b1b", "#2f5a7a", "#3f7a35", "#a87a18"][(i + s) % 4], X + i, sy, 1, 4);
      }
      return true;
    case "cuisiniere": {
      // Grande friteuse de Gérard
      shadow(b, X + W / 2, Y + 15, W / 2, 2);
      px(b, Q.metalD, X + 1, Y + 2, W - 2, 13);
      px(b, Q.metalL, X + 2, Y + 3, W - 4, 2);
      px(b, "#c9952e", X + 4, Y + 6, W - 8, 4); // huile dorée
      px(b, "#f2c14e", X + 5, Y + 6, W - 10, 1);
      px(b, Q.ink, X + 4, Y + 11, 3, 2);
      px(b, Q.red, X + 5, Y + 11, 1, 1);
      light({ x: X + W / 2, y: Y + 8, r: 18, color: "#ffb04a", tint: true });
      return true;
    }
    case "table":
      shadow(b, X + W / 2, Y + 15, W / 2 - 1, 2);
      px(b, Q.woodD, X + 1, Y + 4, W - 2, 8);
      px(b, Q.woodL, X + 1, Y + 4, W - 2, 2);
      px(b, Q.white, X + 3, Y + 5, W - 6, 1);
      px(b, Q.woodD, X + 2, Y + 11, 2, 4);
      px(b, Q.woodD, X + W - 4, Y + 11, 2, 4);
      if (p.variant === 1) {
        px(b, "#f2c14e", X + W / 2 - 3, Y + 3, 6, 3); // frites
        px(b, Q.red, X + W / 2 - 2, Y + 5, 4, 2);
      }
      return true;
    case "chaise":
      px(b, Q.woodD, X + 4, Y + 2, 8, 3);
      px(b, Q.wood, X + 4, Y + 7, 8, 4);
      px(b, Q.woodD, X + 4, Y + 11, 2, 4);
      px(b, Q.woodD, X + 10, Y + 11, 2, 4);
      return true;
    case "lit-int":
      shadow(b, X + W / 2, Y + H - 1, W / 2, 2);
      px(b, Q.woodD, X + 1, Y + 1, W - 2, H - 2);
      px(b, Q.white, X + 2, Y + 2, W - 4, 6);
      px(b, p.variant === 1 ? "#6a8ac8" : "#5f9e4a", X + 2, Y + 8, W - 4, H - 10);
      px(b, p.variant === 1 ? "#8aa8e0" : "#7cc75a", X + 2, Y + 8, W - 4, 2);
      return true;
    case "armoire":
      shadow(b, X + W / 2, Y + H - 1, W / 2, 2);
      px(b, Q.woodD, X + 1, Y, W - 2, H);
      px(b, Q.wood, X + 2, Y + 1, W / 2 - 3, H - 3);
      px(b, Q.wood, X + W / 2 + 1, Y + 1, W / 2 - 3, H - 3);
      px(b, Q.gold, X + W / 2 - 2, Y + H / 2, 1, 2);
      px(b, Q.gold, X + W / 2 + 1, Y + H / 2, 1, 2);
      return true;
    case "plante":
      shadow(b, X + 8, Y + 15, 5, 2);
      px(b, "#a8502a", X + 4, Y + 9, 8, 6);
      px(b, "#c86a3a", X + 4, Y + 9, 8, 1);
      blob(b, X + 8, Y + 6, 5, Q.greenD);
      blob(b, X + 7, Y + 5, 4, Q.green);
      px(b, Q.greenL, X + 5, Y + 3, 2, 1);
      return true;
    case "colonne":
      shadow(b, X + 8, Y + H - 1, 7, 2);
      px(b, Q.marbleD, X + 2, Y + H - 4, 12, 4);
      px(b, Q.marble, X + 4, Y + 4, 8, H - 8);
      px(b, Q.marbleD, X + 10, Y + 4, 2, H - 8);
      px(top, Q.marbleD, X + 1, Y, 14, 4);
      px(top, Q.marble, X + 2, Y, 12, 2);
      return true;
    case "banniere":
      px(b, Q.goldD, X + 2, Y, 12, 2);
      px(b, Q.green, X + 3, Y + 2, 10, 11);
      px(b, Q.greenD, X + 11, Y + 2, 2, 11);
      px(b, Q.gold, X + 6, Y + 5, 4, 4);
      px(b, Q.green, X + 3, Y + 13, 3, 2);
      px(b, Q.green, X + 10, Y + 13, 3, 2);
      return true;
    case "trone": {
      shadow(b, X + W / 2, Y + H - 1, W / 2, 3);
      px(b, Q.goldD, X + 2, Y, W - 4, H - 2);
      px(b, Q.gold, X + 4, Y + 2, W - 8, H - 8);
      px(b, Q.green, X + 7, Y + 5, W - 14, H - 14);
      px(b, Q.goldD, X, Y + H - 12, W, 4);
      px(b, Q.gold, X + 1, Y + H - 12, W - 2, 1);
      for (let i = 0; i < 3; i++) px(b, Q.red, X + 8 + i * 6, Y + 2, 2, 2);
      light({ x: X + W / 2, y: Y + 10, r: 26, color: "#ffe6a0", tint: true });
      return true;
    }
    case "rocher":
      shadow(b, X + W / 2, Y + H - 2, W / 2 - 1, 3);
      blob(b, X + W / 2, Y + H / 2 + 1, Math.min(W, H) / 2 - 1, "#4a4440");
      blob(b, X + W / 2 - 1, Y + H / 2, Math.min(W, H) / 2 - 2, "#7a7068");
      blob(b, X + W / 2 - 3, Y + H / 2 - 3, Math.min(W, H) / 4, "#9a9088");
      return true;
    case "haltere-geant": {
      // Statue : haltère d'or géant sur un socle
      shadow(b, X + W / 2, Y + H - 2, W / 2, 3);
      px(b, Q.stoneD, X + 6, Y + H - 10, W - 12, 9);
      px(b, Q.stoneL, X + 5, Y + H - 12, W - 10, 3);
      px(top, Q.goldD, X + 10, Y + 6, W - 20, 5);
      px(top, Q.gold, X + 10, Y + 6, W - 20, 2);
      for (const dx of [2, W - 10]) {
        px(top, Q.goldD, X + dx, Y - 2, 8, 20);
        px(top, Q.gold, X + dx + 1, Y - 1, 3, 18);
      }
      px(b, Q.goldD, X + W / 2 - 2, Y + 11, 4, H - 22);
      light({ x: X + W / 2, y: Y + 8, r: 30, color: "#ffe6a0", tint: true });
      return true;
    }
    case "banc-muscu":
      shadow(b, X + W / 2, Y + 15, W / 2, 2);
      px(b, "#2a2a32", X + 4, Y + 8, W - 8, 4);
      px(b, "#c62828", X + 5, Y + 7, W - 10, 3);
      px(b, Q.metalD, X + 6, Y + 11, 2, 5);
      px(b, Q.metalD, X + W - 8, Y + 11, 2, 5);
      px(b, Q.metal, X + 1, Y + 2, W - 2, 2);
      px(b, "#1b1626", X, Y, 4, 7);
      px(b, "#1b1626", X + W - 4, Y, 4, 7);
      return true;
    case "sac-frappe":
      shadow(b, X + 8, Y + H - 1, 5, 2);
      px(b, Q.metalD, X + 7, Y, 2, 4);
      px(b, "#8e1b1b", X + 3, Y + 4, 10, H - 7);
      px(b, "#c62828", X + 4, Y + 5, 3, H - 9);
      px(b, "#1b1626", X + 3, Y + 10, 10, 1);
      return true;
    case "gong":
      shadow(b, X + 8, Y + H - 1, 7, 2);
      px(b, Q.woodD, X + 1, Y + 2, 2, H - 2);
      px(b, Q.woodD, X + 13, Y + 2, 2, H - 2);
      px(b, Q.woodD, X, Y + 1, 16, 2);
      blob(b, X + 8, Y + 12, 6, Q.goldD);
      blob(b, X + 8, Y + 12, 5, Q.gold);
      blob(b, X + 7, Y + 11, 2, "#f8dc70");
      return true;
    case "brasero":
      shadow(b, X + 8, Y + 15, 5, 2);
      px(b, Q.metalD, X + 4, Y + 8, 8, 6);
      px(b, Q.metalD, X + 6, Y + 13, 4, 3);
      px(top, "#ff7a2a", X + 5, Y + 4, 6, 4);
      px(top, "#ffd04a", X + 6, Y + 2, 4, 4);
      px(top, "#fff0b0", X + 7, Y + 3, 2, 2);
      light({ x: X + 8, y: Y + 6, r: 34, color: "#ff9a4a", tint: true, flicker: true });
      return true;
    case "statue-titan": {
      // Statue du Premier Titan : il dort, les bras croisés sur son haltère
      shadow(b, X + W / 2, Y + H - 2, W / 2, 3);
      px(b, Q.stoneD, X + 2, Y + H - 10, W - 4, 9);
      px(b, Q.stoneL, X + 1, Y + H - 12, W - 2, 3);
      blob(top, X + W / 2, Y + 14, 9, Q.stoneD);
      blob(top, X + W / 2 - 1, Y + 13, 8, Q.stone);
      blob(top, X + W / 2, Y + 3, 5, Q.stone);
      px(top, Q.stoneD, X + W / 2 - 3, Y + 3, 2, 1);
      px(top, Q.stoneD, X + W / 2 + 1, Y + 3, 2, 1);
      px(top, Q.stoneL, X + 4, Y + 20, W - 8, 3);
      pixelText(b, "ZZZ", X + W / 2 - 5, Y + H - 9, Q.gold);
      return true;
    }
    case "podium":
      px(b, Q.goldD, X, Y + 4, W, H - 4);
      px(b, Q.gold, X, Y + 4, W, 2);
      px(b, Q.red, X + W / 2 - 4, Y + 8, 8, 4);
      return true;
    case "cerisier": {
      shadow(b, X + 16, Y + 29, 13, 3);
      px(b, "#4a2a2a", X + 13, Y + 18, 6, 12);
      px(b, "#6a3a3a", X + 14, Y + 18, 2, 12);
      const t = top;
      blob(t, X + 16, Y + 11, 14, "#c86a8a");
      blob(t, X + 15, Y + 10, 13, "#e88aa8");
      blob(t, X + 10, Y + 8, 7, "#f8b8c8");
      blob(t, X + 21, Y + 6, 6, "#f8b8c8");
      for (let i = 0; i < 18; i++) px(t, "#fff0f4", X + 4 + Math.floor(hash(p.x * 9 + i, p.y, 81) * 24), Y + 2 + Math.floor(hash(p.x, p.y * 9 + i, 82) * 18), 1, 1);
      // Pétales au sol
      for (let i = 0; i < 6; i++) px(b, "#f8b8c8", X + Math.floor(hash(p.x + i, p.y, 83) * 30), Y + 26 + Math.floor(hash(p.x, p.y + i, 84) * 6), 2, 1);
      return true;
    }
    case "poteau":
      shadow(b, X + 8, Y + 15, 4, 2);
      px(b, "#8e1b1b", X + 5, Y, 6, 16);
      px(b, "#c62828", X + 6, Y, 2, 16);
      px(b, "#1b1626", X + 4, Y + 13, 8, 3);
      return true;
    case "portique":
      // Poutre haute, dessinée au-dessus des personnages (on passe dessous)
      px(top, "#1b1626", X - 2, Y - 2, W + 4, 4);
      px(top, "#c62828", X - 1, Y - 1, W + 2, 2);
      px(top, "#8e1b1b", X + 2, Y + 4, W - 4, 3);
      px(top, "#c62828", X + 2, Y + 4, W - 4, 1);
      px(top, "#c62828", X + 5, Y + 2, 6, 10);
      px(top, "#c62828", X + W - 11, Y + 2, 6, 10);
      return true;
    case "pierre":
      shadow(b, X + 8, Y + 15, 6, 2);
      px(b, Q.stoneD, X + 5, Y + 11, 6, 4);
      px(b, Q.stone, X + 6, Y + 6, 4, 5);
      px(b, "#ffd04a", X + 7, Y + 7, 2, 2);
      px(b, Q.stoneD, X + 3, Y + 3, 10, 3);
      px(b, Q.stoneL, X + 4, Y + 3, 8, 1);
      light({ x: X + 8, y: Y + 8, r: 16, color: "#ffd04a", tint: true });
      return true;
    case "scene": {
      // Scène du festival : estrade, enceintes, banderole
      shadow(b, X + W / 2, Y + H, W / 2, 3);
      px(b, "#3a2a1a", X, Y + H - 14, W, 14);
      px(b, "#5a3a22", X, Y + H - 14, W, 3);
      for (let x = 4; x < W; x += 12) px(b, "#2a1a10", X + x, Y + H - 10, 2, 10);
      px(b, "#1a1430", X + 4, Y + 2, W - 8, H - 16);
      for (const sx of [X + 2, X + W - 14]) {
        px(b, "#1b1626", sx, Y + 4, 12, H - 18);
        blob(b, sx + 6, Y + 12, 4, "#3a3a46");
        blob(b, sx + 6, Y + 12, 2, "#a66cff");
        blob(b, sx + 6, Y + 24, 3, "#3a3a46");
      }
      px(b, "#c62828", X + 18, Y + 3, W - 36, 7);
      pixelText(b, "FESTIVAL", X + W / 2 - Math.round(textWidth("FESTIVAL") / 2), Y + 4, "#f8f4e8");
      light({ x: X + W / 2, y: Y + H - 10, r: 46, color: "#a66cff", tint: true });
      return true;
    }
    case "platines":
      shadow(b, X + W / 2, Y + 15, W / 2, 2);
      px(b, "#1b1626", X + 1, Y + 4, W - 2, 10);
      px(b, "#2a2a32", X + 2, Y + 5, W - 4, 8);
      for (const cx of [X + 10, X + W - 10]) {
        blob(b, cx, Y + 9, 4, "#1b1626");
        blob(b, cx, Y + 9, 1, "#a66cff");
      }
      for (let i = 0; i < 4; i++) px(b, ["#3ccf6a", "#f2c14e", "#ff6fae", "#6ad0ff"][i], X + W / 2 - 4 + i * 2, Y + 7, 1, 3);
      return true;
    case "ratelier":
      px(b, Q.woodD, X + 1, Y + 2, W - 2, 12);
      for (let x = 5; x < W - 3; x += 6) {
        px(b, "#c8a06a", X + x, Y + 1, 2, 12);
        px(b, "#1b1626", X + x, Y + 9, 2, 2);
      }
      return true;
    case "lanterne": {
      // Lanterne de la cité (comme un lampadaire, plus chaude)
      shadow(b, X + 8, Y + 30, 5, 2);
      px(b, Q.woodD, X + 7, Y + 10, 2, 21);
      px(b, Q.woodD, X + 5, Y + 28, 6, 3);
      px(top, Q.ink, X + 4, Y + 1, 8, 2);
      px(top, Q.woodD, X + 4, Y + 3, 8, 7);
      px(top, "#ffcf6a", X + 5, Y + 4, 6, 5);
      px(top, "#fff0b0", X + 6, Y + 4, 4, 2);
      light({ x: X + 8, y: Y + 14, r: 40, color: "#ffb04a", tint: true, flicker: hash(p.x, p.y, 75) < 0.2 });
      return true;
    }
  }
  return false;
}

// ─── Éléments vivants (redessinés à chaque image) ───

/** Dessine un élément dont l'aspect dépend de l'avancement (`state` = ouvert / tourné / activé). */
export function drawLive(ctx: Ctx, p: Prop, state: boolean, t: number, ox: number, oy: number) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  const W = p.w * TILE;
  const f = (c: string, x: number, y: number, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  };
  switch (p.kind) {
    case "coffre":
      f("rgba(8,6,20,0.4)", X + 2, Y + 13, 12, 2);
      f(Q.woodD, X + 2, Y + 5, 12, 9);
      f(Q.wood, X + 3, Y + 6, 10, 7);
      f(Q.gold, X + 2, Y + 8, 12, 1);
      if (state) {
        f(Q.woodD, X + 2, Y + 1, 12, 4);
        f("#2a1a10", X + 3, Y + 4, 10, 2);
      } else {
        f(Q.woodL, X + 2, Y + 3, 12, 3);
        f(Q.gold, X + 7, Y + 7, 2, 3);
        if (Math.floor(t * 2) % 4 === 0) f("#ffffff", X + 12, Y + 3, 1, 1);
      }
      break;
    case "vanne": {
      f(Q.metalD, X, Y + 6, 16, 4);
      f(Q.metal, X, Y + 7, 16, 1);
      const a = state ? Math.PI / 4 : 0;
      f(state ? "#3ccf6a" : Q.red, X + 6, Y + 2, 4, 4);
      for (let i = 0; i < 4; i++) {
        const ang = a + (i * Math.PI) / 2;
        f(state ? "#2a9a4a" : "#8e1b1b", X + 8 + Math.cos(ang) * 5 - 1, Y + 4 + Math.sin(ang) * 5 - 1, 2, 2);
      }
      break;
    }
    case "flux": {
      // Courant d'eaux usées qui bloque le passage (disparaît quand les vannes sont bien réglées)
      for (let y = 0; y < p.h * TILE; y += 2)
        for (let x = 0; x < W; x += 4) {
          const k = (x + y * 3 + Math.floor(t * 30)) % 12;
          f(k < 4 ? Q.muckH : k < 8 ? Q.muckL : Q.muck, X + x, Y + y, 4, 2);
        }
      break;
    }
    case "grille": {
      f(Q.metalD, X, Y, 2, 16);
      f(Q.metalD, X + W - 2, Y, 2, 16);
      if (state) {
        f(Q.metal, X + 2, Y + 2, 3, 13);
        f(Q.metal, X + W - 5, Y + 2, 3, 13);
        break;
      }
      for (let x = 3; x < W - 2; x += 3) f(Q.metal, X + x, Y + 1, 1, 15);
      f(Q.metalL, X + 2, Y + 4, W - 4, 1);
      f(Q.metalL, X + 2, Y + 11, W - 4, 1);
      f(Q.gold, X + W / 2 - 1, Y + 7, 2, 2);
      break;
    }
    case "lampion": {
      // Lampion de la fête : éteint (gris) ou rallumé (rouge et lumineux)
      f(state ? "#5a3a22" : "#3a3a46", X + 7, Y + 6, 2, 10);
      f("#1b1626", X + 3, Y - 4, 10, 12);
      f(state ? "#d23a3a" : "#6a6a74", X + 4, Y - 3, 8, 10);
      f(state ? "#f06a5a" : "#7a7a84", X + 5, Y - 3, 2, 10);
      f("#1b1626", X + 4, Y + 1, 8, 1);
      if (state) {
        const k = 0.35 + Math.sin(t * 6 + p.x) * 0.1;
        f(`rgba(255,208,74,${k})`, X - 2, Y - 8, 20, 18);
        f("#ffd04a", X + 7, Y, 2, 2);
      }
      break;
    }
    case "cadran": {
      // Cadran sur pied : 23:59 (rouge, aiguilles bloquées) ou 00:00 (vert, les aiguilles réunies)
      f("rgba(8,6,20,0.4)", X + 3, Y + 14, 10, 2);
      f(Q.metalD, X + 7, Y + 9, 2, 6);
      f(Q.metalD, X + 4, Y + 13, 8, 2);
      f("#1b1626", X + 1, Y - 6, 14, 14);
      f(state ? "#3ccf6a" : "#c62828", X + 2, Y - 5, 12, 12);
      f("#f1efe8", X + 3, Y - 4, 10, 10);
      f("#1b1626", X + 7, Y - 3, 2, 1);
      f("#1b1626", X + 7, Y + 5, 2, 1);
      f("#1b1626", X + 3, Y + 1, 1, 1);
      f("#1b1626", X + 12, Y + 1, 1, 1);
      if (state) f("#1b1626", X + 7, Y - 3, 2, 5);
      else {
        f("#1b1626", X + 7, Y - 3, 1, 5);
        f("#1b1626", X + 5, Y - 2, 2, 1);
        f("#1b1626", X + 6, Y - 1, 1, 2);
        if (Math.floor(t * 2) % 2 === 0) f("#c62828", X + 8, Y + 1, 3, 1);
      }
      f(Q.gold, X + 7, Y + 1, 2, 2);
      if (state) f(`rgba(60,207,106,${0.18 + Math.sin(t * 4 + p.x) * 0.06})`, X - 1, Y - 8, 18, 18);
      break;
    }
    case "sachet":
      if (state) break;
      f(Q.woodL, X + 5, Y + 7, 6, 6);
      f(Q.woodD, X + 6, Y + 5, 4, 2);
      if (Math.floor(t * 3) % 3 === 0) f("#ffffff", X + 11, Y + 5, 1, 1);
      break;
  }
}

export const LIVE_KINDS = new Set(["coffre", "vanne", "flux", "grille", "sachet", "lampion", "cadran"]);
