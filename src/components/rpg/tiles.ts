/**
 * RPG — tileset et décors du Quartier 404 (pixel art original, dessiné par le code).
 *
 * Tout est peint une seule fois dans deux grandes images (« calques ») :
 *   - BASE : sol + bas des éléments (troncs, façades, mobilier) → sous les personnages ;
 *   - HAUT : feuillages, têtes de lampadaires, haut des pylônes… → par-dessus les personnages
 *            (Sparrow passe « derrière » un arbre).
 * Les éléments animés (eau, portail, barrière, cœur du transformateur, néons) et les lumières
 * sont dessinés à chaque image par overworld.ts. Palette de nuit unique pour toute la carte.
 */

import { TILE, type Ground, type MapDef, type Prop } from "@/lib/rpg/mapdef";
import { hash, pixelText, textWidth } from "./pixel";

type Ctx = CanvasRenderingContext2D;

/** Palette de nuit (cohérente pour le sol, les bâtiments, la végétation et les personnages). */
export const P = {
  ink: "#141022",
  grass: "#2c4a3a",
  grassD: "#233c2f",
  grassL: "#3a5f48",
  grassT: "#4a7458",
  dirt: "#5c4c3c",
  dirtD: "#4b3d30",
  dirtL: "#6c5a47",
  road: "#272631",
  roadL: "#302f3b",
  roadD: "#211f29",
  line: "#b8973a",
  curb: "#7b7890",
  curbD: "#5b5970",
  walk: "#545366",
  walkD: "#444356",
  walkL: "#636277",
  cob: "#5d5868",
  cobL: "#6c6778",
  cobD: "#494454",
  grav: "#45444e",
  gravL: "#55545f",
  gravD: "#383740",
  water: "#1f3d63",
  waterL: "#2d5a8a",
  waterH: "#7fb4dc",
  stone: "#6b6676",
  stoneL: "#827c8e",
  stoneD: "#4c4757",
  brick: "#6b3832",
  brickD: "#552a26",
  brickL: "#7d453d",
  plaster: "#b8a68b",
  plasterD: "#9c8b72",
  blue: "#46597e",
  blueD: "#38486a",
  teal: "#2d5561",
  tealD: "#234450",
  slate: "#33364f",
  slateD: "#272940",
  slateL: "#43476a",
  tile: "#86392e",
  tileD: "#6c2c24",
  tileL: "#9e4638",
  flat: "#2a2b36",
  flatL: "#353746",
  winLit: "#f2c14e",
  winHi: "#f8dc8c",
  winOff: "#1c2333",
  winRef: "#2f3c58",
  frame: "#231b1f",
  wood: "#5a3a26",
  woodL: "#74503a",
  woodD: "#3e2819",
  leafD: "#16301f",
  leaf: "#22432d",
  leafM: "#2d573a",
  leafL: "#3b6c48",
  leafH: "#4d8559",
  trunk: "#4a3324",
  trunkD: "#33231a",
  metal: "#5c6170",
  metalL: "#7a8090",
  metalD: "#3c404c",
  red: "#c62828",
  redD: "#8e1b1b",
  white: "#e8e2d4",
  gold: "#f2c14e",
  purple: "#a66cff",
  shadow: "rgba(8,6,20,0.38)",
};

const px = (ctx: Ctx, c: string, x: number, y: number, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

// ─── Sol ───

/** Carte en cours de peinture (buildLayers). */
let CUR: MapDef;
const g = (x: number, y: number): Ground | null => (x < 0 || y < 0 || x >= CUR.w || y >= CUR.h ? null : CUR.ground[y][x]);
const isGrassy = (k: Ground | null) => k === "herbe" || k === "fleurs";

function grass(ctx: Ctx, X: number, Y: number, tx: number, ty: number, flowers: boolean) {
  px(ctx, P.grass, X, Y, TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = hash(tx * 16 + x, ty * 16 + y, 1);
      if (r < 0.05) px(ctx, P.grassD, X + x, Y + y);
      else if (r < 0.085) {
        px(ctx, P.grassL, X + x, Y + y);
        if (y > 0) px(ctx, P.grassT, X + x, Y + y - 1);
      }
    }
  if (flowers) {
    const cols = ["#d9637a", "#e8c35a", "#e8e2d4", "#9a7fd8"];
    for (let i = 0; i < 5; i++) {
      const fx = Math.floor(hash(tx, ty, 10 + i) * 13) + 1;
      const fy = Math.floor(hash(tx, ty, 20 + i) * 13) + 1;
      const c = cols[Math.floor(hash(tx, ty, 30 + i) * cols.length)];
      px(ctx, P.leafM, X + fx, Y + fy + 1, 1, 2);
      px(ctx, c, X + fx - 1, Y + fy, 3, 1);
      px(ctx, c, X + fx, Y + fy - 1, 1, 3);
      px(ctx, "#fff3c0", X + fx, Y + fy);
    }
  } else if (hash(tx, ty, 5) < 0.12) {
    const fx = Math.floor(hash(tx, ty, 6) * 12) + 2;
    const fy = Math.floor(hash(tx, ty, 7) * 12) + 2;
    px(ctx, "#cfc79a", X + fx, Y + fy);
  }
}

function speckle(ctx: Ctx, X: number, Y: number, tx: number, ty: number, base: string, light: string, dark: string, seed: number, rate = 0.07) {
  px(ctx, base, X, Y, TILE, TILE);
  for (let y = 0; y < TILE; y++)
    for (let x = 0; x < TILE; x++) {
      const r = hash(tx * 16 + x, ty * 16 + y, seed);
      if (r < rate) px(ctx, light, X + x, Y + y);
      else if (r < rate * 2) px(ctx, dark, X + x, Y + y);
    }
}

function paintGround(ctx: Ctx, tx: number, ty: number) {
  const X = tx * TILE;
  const Y = ty * TILE;
  const k = CUR.ground[ty][tx];
  switch (k) {
    case "herbe":
    case "fleurs":
      grass(ctx, X, Y, tx, ty, k === "fleurs");
      break;
    case "chemin":
      speckle(ctx, X, Y, tx, ty, P.dirt, P.dirtL, P.dirtD, 2, 0.08);
      for (let i = 0; i < 3; i++) {
        const sx = Math.floor(hash(tx, ty, 40 + i) * 13);
        const sy = Math.floor(hash(tx, ty, 50 + i) * 13);
        px(ctx, P.stoneD, X + sx, Y + sy + 1, 2, 1);
        px(ctx, P.stone, X + sx, Y + sy, 2, 1);
      }
      break;
    case "route":
    case "ligne":
      speckle(ctx, X, Y, tx, ty, P.road, P.roadL, P.roadD, 3, 0.06);
      if (k === "route") {
        px(ctx, P.curb, X, Y, TILE, 2);
        px(ctx, P.curbD, X, Y + 2, TILE, 1);
      } else {
        if (tx % 2 === 0) px(ctx, P.line, X + 3, Y, 10, 1);
        px(ctx, P.curbD, X, Y + 13, TILE, 1);
        px(ctx, P.curb, X, Y + 14, TILE, 2);
        // Bouche d'égout
        if (tx % 9 === 4) {
          px(ctx, P.roadD, X + 4, Y + 5, 8, 5);
          for (let i = 0; i < 4; i++) px(ctx, P.roadL, X + 5 + i * 2, Y + 6, 1, 3);
        }
      }
      break;
    case "trottoir": {
      px(ctx, P.walk, X, Y, TILE, TILE);
      for (let s = 0; s < 4; s++) {
        const sx = X + (s % 2) * 8;
        const sy = Y + Math.floor(s / 2) * 8;
        px(ctx, P.walkL, sx, sy, 7, 1);
        px(ctx, P.walkL, sx, sy, 1, 7);
        px(ctx, P.walkD, sx, sy + 7, 8, 1);
        px(ctx, P.walkD, sx + 7, sy, 1, 8);
      }
      if (hash(tx, ty, 9) < 0.15) {
        const cx = X + 3 + Math.floor(hash(tx, ty, 11) * 9);
        px(ctx, P.walkD, cx, Y + 9, 1, 2);
        px(ctx, P.walkD, cx + 1, Y + 11, 2, 1);
      }
      break;
    }
    case "pave": {
      px(ctx, P.cobD, X, Y, TILE, TILE);
      for (let r = 0; r < 4; r++)
        for (let c = 0; c < 5; c++) {
          const sx = X + c * 4 - (r % 2) * 2;
          const sy = Y + r * 4;
          const col = hash(tx * 5 + c, ty * 4 + r, 12) < 0.5 ? P.cob : P.cobL;
          ctx.save();
          ctx.beginPath();
          ctx.rect(X, Y, TILE, TILE);
          ctx.clip();
          px(ctx, col, sx, sy, 3, 3);
          px(ctx, P.stoneL, sx, sy, 2, 1);
          ctx.restore();
        }
      break;
    }
    case "gravier":
      speckle(ctx, X, Y, tx, ty, P.grav, P.gravL, P.gravD, 4, 0.12);
      break;
    case "ruelle":
      speckle(ctx, X, Y, tx, ty, "#25242e", "#2d2c37", "#1e1d26", 6, 0.08);
      if (hash(tx, ty, 13) < 0.35) {
        px(ctx, "#2c3a52", X + 3, Y + 8, 7, 3);
        px(ctx, "#3d5070", X + 4, Y + 8, 3, 1);
      }
      break;
    case "eau":
      px(ctx, P.water, X, Y, TILE, TILE);
      break;
  }
  // Bordures douces : l'herbe déborde un peu sur les surfaces voisines
  if (!isGrassy(k) && k !== "eau") {
    const edges: [number, number, (i: number) => [number, number]][] = [
      [0, -1, (i) => [i, 0]],
      [0, 1, (i) => [i, 15]],
      [-1, 0, (i) => [0, i]],
      [1, 0, (i) => [15, i]],
    ];
    for (const [dx, dy, at] of edges)
      if (isGrassy(g(tx + dx, ty + dy)))
        for (let i = 0; i < TILE; i++) if (hash(tx * 31 + i, ty * 17 + dx * 3 + dy, 14) < 0.55) {
          const [ex, ey] = at(i);
          px(ctx, P.grassD, X + ex, Y + ey);
        }
  }
  if (k === "eau") {
    const edges: [number, number, (i: number) => [number, number, number, number]][] = [
      [0, -1, (i) => [i, 0, 1, 2]],
      [0, 1, (i) => [i, 14, 1, 2]],
      [-1, 0, (i) => [0, i, 2, 1]],
      [1, 0, (i) => [14, i, 2, 1]],
    ];
    for (const [dx, dy, at] of edges)
      if (g(tx + dx, ty + dy) !== "eau")
        for (let i = 0; i < TILE; i++) {
          const [ex, ey, w, h] = at(i);
          px(ctx, i % 4 === 0 ? P.stoneD : P.stone, X + ex, Y + ey, w, h);
        }
  }
}

// ─── Éléments posés ───

export interface Light {
  x: number;
  y: number;
  r: number;
  color: string;
  flicker?: boolean;
  /** Teinte colorée autour de la lumière (lampadaires, néons) ; pas pour les fenêtres. */
  tint?: boolean;
}

/** Lumières fixes de la carte en cours de peinture (lampadaires, fenêtres, néons). */
let LIGHTS: Light[] = [];

function shadowEllipse(ctx: Ctx, cx: number, cy: number, rx: number, ry: number) {
  ctx.fillStyle = P.shadow;
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    ctx.fillRect(cx - half, cy + y, half * 2, 1);
  }
}

function blob(ctx: Ctx, cx: number, cy: number, r: number, c: string) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++) {
    const half = Math.round(Math.sqrt(r * r - y * y));
    ctx.fillRect(cx - half, cy + y, half * 2, 1);
  }
}

function window_(ctx: Ctx, x: number, y: number, w: number, h: number, lit: boolean, seed: number) {
  px(ctx, P.frame, x - 1, y - 1, w + 2, h + 2);
  if (lit) {
    px(ctx, P.winLit, x, y, w, h);
    px(ctx, P.winHi, x, y, w, 2);
    // Rideaux ou silhouette
    const kind = Math.floor(seed * 3);
    if (kind === 0) {
      px(ctx, "#c96f3a", x, y, 2, h);
      px(ctx, "#c96f3a", x + w - 2, y, 2, h);
    } else if (kind === 1) {
      px(ctx, "#8a5a2e", x + Math.floor(w / 2) - 1, y + h - 5, 3, 5);
      px(ctx, "#8a5a2e", x + Math.floor(w / 2) - 2, y + h - 7, 5, 3);
    } else px(ctx, "#e0a840", x, y + Math.floor(h / 2), w, 1);
    LIGHTS.push({ x: x + w / 2, y: y + h / 2, r: 9, color: "#f2c14e" });
  } else {
    px(ctx, P.winOff, x, y, w, h);
    for (let i = 0; i < Math.min(w, h); i++) px(ctx, P.winRef, x + i, y + h - 1 - i);
  }
  px(ctx, P.frame, x + Math.floor(w / 2), y, 1, h);
  px(ctx, "#8d877c", x - 1, y + h + 1, w + 2, 1); // rebord
}

function building(ctx: Ctx, p: Prop) {
  const b = p.b!;
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  const H = p.h * TILE;
  const roofH = b.roof === "plat" ? 20 : 30;
  const fY = Y + roofH;
  const fH = H - roofH;
  const wall = b.style === "brique" ? [P.brick, P.brickD, P.brickL] : b.style === "boutique" ? [P.teal, P.tealD, "#376877"] : b.style === "enduit" ? [P.blue, P.blueD, "#546890"] : [P.plaster, P.plasterD, "#c8b79c"];

  // Ombre portée au sol
  px(ctx, P.shadow, X + 2, Y + H, W, 3);
  // Façade
  px(ctx, wall[0], X, fY, W, fH);
  if (b.style === "brique") {
    for (let y = fY; y < Y + H; y += 4) {
      px(ctx, wall[1], X, y + 3, W, 1);
      const off = ((y - fY) / 4) % 2 ? 4 : 0;
      for (let x = X + off; x < X + W; x += 8) px(ctx, wall[1], x, y, 1, 3);
      for (let x = X + off + 1; x < X + W; x += 8) if (hash(x, y, 15) < 0.3) px(ctx, wall[2], x, y, 3, 1);
    }
  } else {
    for (let y = fY; y < Y + H; y++) for (let x = X; x < X + W; x++) if (hash(x, y, 16) < 0.04) px(ctx, wall[1], x, y);
    if (b.style === "maison") for (let x = X + 6; x < X + W; x += 12) px(ctx, P.woodD, x, fY, 2, fH); // colombages
  }
  // Soubassement
  px(ctx, P.stoneD, X, Y + H - 4, W, 4);
  px(ctx, P.stone, X, Y + H - 4, W, 1);
  // Toit
  if (b.roof === "plat") {
    px(ctx, P.flat, X, Y, W, roofH);
    px(ctx, P.flatL, X, Y, W, 2);
    px(ctx, "#1f2029", X, Y + roofH - 3, W, 3);
    // Climatiseur + antenne
    px(ctx, P.metalD, X + 6, Y + 5, 14, 9);
    px(ctx, P.metal, X + 7, Y + 6, 12, 7);
    for (let i = 0; i < 5; i++) px(ctx, P.metalD, X + 8 + i * 2, Y + 7, 1, 5);
    px(ctx, P.metalL, X + W - 14, Y + 3, 1, 10);
    px(ctx, P.metalL, X + W - 17, Y + 5, 7, 1);
  } else {
    const [c, d, l] = b.roof === "tuiles" ? [P.tile, P.tileD, P.tileL] : [P.slate, P.slateD, P.slateL];
    px(ctx, c, X - 2, Y, W + 4, roofH);
    for (let y = Y + 3; y < Y + roofH - 2; y += 4) {
      px(ctx, d, X - 2, y, W + 4, 1);
      const off = ((y - Y) / 4) % 2 ? 3 : 0;
      for (let x = X - 2 + off; x < X + W + 2; x += 6) px(ctx, d, x, y - 3, 1, 3);
    }
    px(ctx, l, X - 2, Y, W + 4, 2); // faîtage
    px(ctx, "#1a1b28", X - 2, Y + roofH - 2, W + 4, 2); // gouttière
    // Cheminée
    const cx = X + W - 18;
    px(ctx, P.brickD, cx, Y - 6, 8, 10);
    px(ctx, P.brick, cx + 1, Y - 5, 6, 8);
    px(ctx, P.stone, cx - 1, Y - 7, 10, 2);
    if (b.style === "maison") {
      // Lucarne ronde
      blob(ctx, X + W / 2, Y + 14, 5, P.frame);
      blob(ctx, X + W / 2, Y + 14, 4, P.winLit);
      LIGHTS.push({ x: X + W / 2, y: Y + 14, r: 8, color: "#f2c14e" });
    }
  }
  // Fenêtres
  const doorX = b.door * TILE;
  const rows = Math.max(1, Math.floor((fH - 6) / 16));
  let n = 0;
  for (let r = 0; r < rows; r++) {
    const wy = fY + 4 + r * 16;
    const bottom = r === rows - 1;
    if (b.style === "boutique" && bottom) continue;
    for (let x = X + 6; x + 10 <= X + W - 4; x += 16) {
      if (bottom && Math.abs(x + 5 - (doorX + 8)) < 14) continue;
      n++;
      const lit = hash(n, b.lit ?? 0, 17) < 0.45;
      window_(ctx, x, wy, 10, 9, lit, hash(n, 3, 18));
      if (b.style === "maison") {
        px(ctx, P.woodD, x - 1, wy + 11, 12, 3); // jardinière
        for (let i = 0; i < 5; i++) px(ctx, ["#d9637a", "#e8c35a", "#9a7fd8"][i % 3], x + i * 2, wy + 10, 1, 1);
      }
    }
  }
  // Vitrine de la supérette
  if (b.style === "boutique") {
    const vy = Y + H - 17;
    px(ctx, P.frame, X + 3, vy - 1, doorX - X - 6, 14);
    px(ctx, "#ffe6a0", X + 4, vy, doorX - X - 8, 12);
    for (let i = 0; i < 3; i++) {
      px(ctx, "#b88a3a", X + 4, vy + 3 + i * 4, doorX - X - 8, 1);
      for (let k = 0; k < 6; k++) px(ctx, ["#d9637a", "#6fae4b", "#3a7ad9", "#e8c35a"][(k + i) % 4], X + 6 + k * 5, vy + 1 + i * 4, 3, 2);
    }
    LIGHTS.push({ x: (X + doorX) / 2, y: vy + 12, r: 30, color: "#ffe6a0", tint: true });
    const rx = doorX + 18;
    if (rx + 10 < X + W) window_(ctx, rx, vy, X + W - rx - 4, 10, true, 0.9);
  }
  // Porte
  const dy = Y + H - 16;
  if (b.style === "brique") {
    px(ctx, P.frame, doorX + 1, dy - 1, 14, 17);
    px(ctx, P.winLit, doorX + 2, dy, 12, 12);
    px(ctx, P.winHi, doorX + 2, dy, 12, 2);
    px(ctx, P.frame, doorX + 7, dy, 1, 12);
    px(ctx, P.stoneL, doorX, dy + 12, 16, 4);
    LIGHTS.push({ x: doorX + 8, y: dy + 14, r: 24, color: "#f2c14e", tint: true });
  } else {
    px(ctx, P.frame, doorX + 2, dy - 1, 12, 17);
    px(ctx, b.style === "boutique" ? "#3a6f7c" : P.wood, doorX + 3, dy, 10, 14);
    px(ctx, b.style === "boutique" ? "#ffe6a0" : P.woodL, doorX + 4, dy + 1, 8, 5);
    px(ctx, P.gold, doorX + 11, dy + 8, 1, 2);
    px(ctx, P.stone, doorX + 1, dy + 14, 14, 2);
  }
  // Auvent
  if (b.awning) {
    const [a1, a2] = b.awning === "rouge" ? [P.red, P.white] : ["#2e7d4f", P.white];
    const ax = b.style === "boutique" ? X + 1 : doorX - 4;
    const aw = b.style === "boutique" ? W - 2 : 24;
    const ay = b.style === "boutique" ? Y + H - 24 : dy - 6;
    for (let x = 0; x < aw; x++) px(ctx, Math.floor(x / 4) % 2 ? a1 : a2, ax + x, ay, 1, 5);
    for (let x = 0; x < aw; x += 4) px(ctx, Math.floor(x / 4) % 2 ? a1 : a2, ax + x + 1, ay + 5, 2, 1);
    px(ctx, P.shadow, ax, ay + 6, aw, 2);
  }
  // Enseigne
  if (b.sign) {
    const tw = textWidth(b.sign);
    if (b.style === "boutique") {
      const sx = X + Math.round((W - tw) / 2);
      px(ctx, P.ink, sx - 3, fY - 1, tw + 6, 9);
      pixelText(ctx, b.sign, sx, fY + 1, "#ff6fae");
      LIGHTS.push({ x: X + W / 2, y: fY + 4, r: 22, color: "#ff6fae", tint: true });
    } else {
      const sx = doorX + 8 - Math.round(tw / 2);
      px(ctx, P.ink, sx - 2, dy - 15, tw + 4, 8);
      pixelText(ctx, b.sign, sx, dy - 14, P.gold);
    }
  }
}

function tree(ctx: Ctx, p: Prop, top: boolean) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const cx = X + 16;
  if (!top) {
    shadowEllipse(ctx, cx + 2, Y + 29, 13, 3);
    px(ctx, P.trunkD, cx - 3, Y + 18, 6, 12);
    px(ctx, P.trunk, cx - 2, Y + 18, 3, 12);
    px(ctx, P.trunkD, cx - 5, Y + 28, 3, 2);
    px(ctx, P.trunkD, cx + 3, Y + 28, 3, 2);
    return;
  }
  const s = hash(p.x, p.y, 19);
  blob(ctx, cx, Y + 11, 14, P.leafD);
  blob(ctx, cx - 1, Y + 10, 13, P.leaf);
  blob(ctx, cx - 6, Y + 8, 8, P.leafM);
  blob(ctx, cx + 5, Y + 6, 7, P.leafM);
  blob(ctx, cx - 1, Y + 14, 8, P.leafM);
  blob(ctx, cx - 6, Y + 5, 4, P.leafL);
  blob(ctx, cx + 4, Y + 3, 3, P.leafL);
  for (let i = 0; i < 26; i++) {
    const a = hash(p.x * 7 + i, p.y, 20) * Math.PI * 2;
    const r = hash(p.x, p.y * 7 + i, 21) * 11;
    const lx = Math.round(cx + Math.cos(a) * r);
    const ly = Math.round(Y + 10 + Math.sin(a) * r * 0.9);
    px(ctx, ly < Y + 9 ? P.leafH : P.leafD, lx, ly);
  }
  if (s < 0.3) for (let i = 0; i < 3; i++) px(ctx, "#c94a4a", cx - 6 + i * 6, Y + 8 + (i % 2) * 5, 2, 2); // fruits
}

function sapin(ctx: Ctx, p: Prop, top: boolean) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  if (!top) {
    shadowEllipse(ctx, X + 9, Y + 30, 7, 2);
    px(ctx, P.trunkD, X + 6, Y + 25, 4, 6);
    return;
  }
  for (let layer = 0; layer < 3; layer++) {
    const ly = Y + 2 + layer * 7;
    const w = 6 + layer * 3;
    for (let i = 0; i < 9; i++) {
      const half = Math.round((w * i) / 9);
      px(ctx, P.leafD, X + 8 - half - 1, ly + i, half * 2 + 2, 1);
      px(ctx, i < 4 ? P.leafM : P.leaf, X + 8 - half, ly + i, half * 2, 1);
    }
    px(ctx, P.leafL, X + 7, ly + 1, 2, 3);
  }
}

function lamp(ctx: Ctx, p: Prop, top: boolean) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  if (!top) {
    shadowEllipse(ctx, X + 8, Y + 30, 5, 2);
    px(ctx, P.metalD, X + 7, Y + 10, 3, 21);
    px(ctx, P.metal, X + 7, Y + 10, 1, 21);
    px(ctx, P.metalD, X + 5, Y + 28, 7, 3);
    LIGHTS.push({ x: X + 8, y: Y + 22, r: 44, color: "#ffd98a", flicker: hash(p.x, p.y, 22) < 0.25, tint: true });
    return;
  }
  px(ctx, P.ink, X + 3, Y + 2, 11, 3);
  px(ctx, P.metalD, X + 4, Y + 3, 9, 2);
  px(ctx, "#ffe9a8", X + 5, Y + 5, 7, 4);
  px(ctx, "#fff7d6", X + 6, Y + 5, 5, 2);
  px(ctx, P.metalD, X + 7, Y + 9, 3, 2);
}

function bench(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  shadowEllipse(ctx, X + W / 2, Y + 14, W / 2 - 1, 2);
  px(ctx, P.woodD, X + 1, Y + 2, W - 2, 5);
  px(ctx, P.woodL, X + 1, Y + 2, W - 2, 1);
  px(ctx, P.wood, X + 1, Y + 4, W - 2, 1);
  px(ctx, P.woodD, X + 1, Y + 8, W - 2, 4);
  px(ctx, P.woodL, X + 1, Y + 8, W - 2, 1);
  px(ctx, P.metalD, X + 3, Y + 7, 2, 7);
  px(ctx, P.metalD, X + W - 5, Y + 7, 2, 7);
}

function smallProp(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  switch (p.kind) {
    case "poubelle":
      shadowEllipse(ctx, X + 8, Y + 14, 6, 2);
      px(ctx, "#1f4a33", X + 3, Y + 3, 10, 11);
      px(ctx, "#2e6a48", X + 4, Y + 4, 2, 9);
      px(ctx, "#163525", X + 2, Y + 2, 12, 2);
      px(ctx, P.white, X + 7, Y + 7, 2, 2);
      break;
    case "benne":
      shadowEllipse(ctx, X + W / 2, Y + 15, W / 2 - 2, 2);
      px(ctx, "#1f3d2c", X + 1, Y + 2, W - 2, 12);
      px(ctx, "#2b5239", X + 2, Y + 3, W - 4, 3);
      px(ctx, "#16301f", X + 1, Y + 6, W - 2, 1);
      px(ctx, "#c94a4a", X + 6, Y + 8, 6, 1); // graffiti
      px(ctx, "#e8c35a", X + 14, Y + 9, 8, 1);
      px(ctx, P.metalD, X + 3, Y + 13, 3, 2);
      px(ctx, P.metalD, X + W - 6, Y + 13, 3, 2);
      break;
    case "cageots":
      for (let i = 0; i < p.w; i++) {
        const cx = X + i * 16;
        px(ctx, P.woodD, cx + 1, Y + 5, 14, 10);
        px(ctx, P.woodL, cx + 2, Y + 6, 12, 1);
        px(ctx, P.woodL, cx + 2, Y + 10, 12, 1);
        for (let k = 0; k < 4; k++) px(ctx, k % 2 ? "#e07a2a" : "#6fae4b", cx + 3 + k * 3, Y + 3, 3, 3);
      }
      break;
    case "panneau":
    case "affiche": {
      shadowEllipse(ctx, X + 8, Y + 15, 4, 1);
      px(ctx, P.metalD, X + 7, Y + 8, 2, 8);
      const board = p.kind === "affiche" ? P.white : "#2d4f7a";
      px(ctx, P.ink, X + 1, Y + 1, 14, 9);
      px(ctx, board, X + 2, Y + 2, 12, 7);
      if (p.text === "DANGER") {
        px(ctx, P.gold, X + 2, Y + 2, 12, 7);
        px(ctx, P.ink, X + 7, Y + 3, 2, 3);
        px(ctx, P.ink, X + 7, Y + 7, 2, 1);
      } else
        for (let i = 0; i < 3; i++) px(ctx, p.kind === "affiche" ? "#555" : P.white, X + 4, Y + 3 + i * 2, 8 - (i % 2) * 3, 1);
      break;
    }
    case "boite":
      px(ctx, P.metalD, X + 7, Y + 8, 2, 7);
      px(ctx, "#2d4f7a", X + 3, Y + 2, 10, 7);
      px(ctx, "#3a6496", X + 3, Y + 2, 10, 2);
      px(ctx, P.ink, X + 5, Y + 5, 6, 1);
      px(ctx, P.red, X + 12, Y + 1, 1, 4);
      break;
    case "velo":
      for (const wx of [X + 1, X + 9]) {
        blob(ctx, wx + 3, Y + 10, 3, P.ink);
        blob(ctx, wx + 3, Y + 10, 2, "#2a2a2a");
      }
      px(ctx, P.red, X + 4, Y + 7, 8, 1);
      px(ctx, P.red, X + 7, Y + 5, 1, 3);
      px(ctx, P.ink, X + 6, Y + 4, 3, 1);
      px(ctx, P.metal, X + 11, Y + 5, 2, 1);
      break;
    case "buisson":
      shadowEllipse(ctx, X + 8, Y + 14, 7, 2);
      blob(ctx, X + 8, Y + 8, 7, P.leafD);
      blob(ctx, X + 7, Y + 7, 6, P.leaf);
      blob(ctx, X + 5, Y + 5, 3, P.leafM);
      blob(ctx, X + 10, Y + 6, 3, P.leafM);
      px(ctx, P.leafH, X + 5, Y + 3, 2, 1);
      break;
    case "massif":
      px(ctx, P.stoneD, X, Y + 3, W, 12);
      px(ctx, P.stone, X, Y + 3, W, 2);
      for (let i = 0; i < W - 4; i += 3) {
        px(ctx, P.leafM, X + 2 + i, Y + 6, 2, 6);
        px(ctx, ["#d9637a", "#e8c35a", "#e8e2d4", "#9a7fd8"][i % 4], X + 2 + i, Y + 5, 2, 2);
      }
      break;
    case "cloture":
      if (p.h > 1) {
        for (let y = 0; y < p.h * 16; y++) {
          px(ctx, P.metalD, X + 7, Y + y, 2, 1);
          if (y % 8 === 0) px(ctx, P.metalL, X + 6, Y + y, 4, 2);
        }
        for (let y = 0; y < p.h * 16; y += 4) px(ctx, "#4a4f5c", X + 5, Y + y, 6, 1);
      } else {
        px(ctx, P.metalD, X, Y + 5, W, 1);
        px(ctx, P.metalD, X, Y + 11, W, 1);
        for (let x = 0; x < W; x += 3) px(ctx, "#4a4f5c", X + x, Y + 5, 1, 7);
        for (let x = 0; x < W; x += 8) {
          px(ctx, P.metalL, X + x, Y + 2, 2, 12);
          px(ctx, P.metalD, X + x + 1, Y + 2, 1, 12);
        }
        px(ctx, P.shadow, X, Y + 14, W, 2);
      }
      break;
  }
}

function fountainBase(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  shadowEllipse(ctx, X + 26, Y + 44, 22, 4);
  blob(ctx, X + 24, Y + 26, 23, P.stoneD);
  blob(ctx, X + 24, Y + 25, 22, P.stone);
  blob(ctx, X + 24, Y + 25, 18, P.water);
  blob(ctx, X + 24, Y + 24, 5, P.stoneD);
  px(ctx, P.stoneL, X + 22, Y + 8, 5, 16);
  px(ctx, P.stoneD, X + 26, Y + 8, 1, 16);
  blob(ctx, X + 24, Y + 8, 6, P.stoneL);
  blob(ctx, X + 24, Y + 8, 4, P.water);
  for (let a = 0; a < 24; a++) {
    const ang = (a / 24) * Math.PI * 2;
    px(ctx, P.stoneL, Math.round(X + 24 + Math.cos(ang) * 21), Math.round(Y + 25 + Math.sin(ang) * 21));
  }
}

function clockTower(ctx: Ctx, p: Prop, top: boolean) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  if (!top) {
    shadowEllipse(ctx, X + 17, Y + 46, 10, 3);
    px(ctx, P.stoneD, X + 8, Y + 38, 16, 9);
    px(ctx, P.stone, X + 9, Y + 38, 14, 2);
    px(ctx, P.metalD, X + 13, Y + 14, 6, 25);
    px(ctx, P.metal, X + 14, Y + 14, 2, 25);
    return;
  }
  px(ctx, P.ink, X + 3, Y - 2, 26, 20);
  px(ctx, "#3a3550", X + 4, Y - 1, 24, 18);
  px(ctx, "#4b4566", X + 4, Y - 1, 24, 2);
  px(ctx, P.gold, X + 15, Y - 6, 2, 4);
  px(ctx, "#101018", X + 6, Y + 3, 20, 11);
}

function transfoBase(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  const W = p.w * TILE;
  shadowEllipse(ctx, X + W / 2 + 2, Y + 46, W / 2, 3);
  px(ctx, P.metalD, X + 2, Y + 14, W - 4, 32);
  px(ctx, P.metal, X + 3, Y + 15, W - 6, 29);
  px(ctx, P.metalL, X + 3, Y + 15, W - 6, 2);
  for (let i = 0; i < 6; i++) px(ctx, P.metalD, X + 8 + i * 4, Y + 20, 2, 12); // grilles
  for (let x = 0; x < W - 6; x += 4) px(ctx, x % 8 ? P.ink : P.gold, X + 3 + x, Y + 40, 4, 4); // rayures
  px(ctx, "#1a1424", X + 38, Y + 20, 18, 14); // hublot du cœur
  px(ctx, P.ink, X + 2, Y + 44, W - 4, 2);
  // Câbles
  px(ctx, P.ink, X - 8, Y + 30, 10, 2);
  px(ctx, P.ink, X + W - 2, Y + 26, 12, 2);
}

function transfoTop(ctx: Ctx, p: Prop) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  for (let i = 0; i < 3; i++) {
    const ix = X + 12 + i * 18;
    px(ctx, "#c9c5b8", ix, Y + 2, 4, 12);
    for (let k = 0; k < 4; k++) px(ctx, "#8d877c", ix - 1, Y + 3 + k * 3, 6, 1);
    px(ctx, P.metalD, ix + 1, Y, 2, 2);
  }
}

function pylon(ctx: Ctx, p: Prop, top: boolean) {
  const X = p.x * TILE;
  const Y = p.y * TILE;
  if (!top) {
    shadowEllipse(ctx, X + 8, Y + 46, 7, 2);
    px(ctx, P.metalD, X + 3, Y + 34, 2, 13);
    px(ctx, P.metalD, X + 11, Y + 34, 2, 13);
    for (let y = 34; y < 47; y += 4) px(ctx, P.metal, X + 4, Y + y, 8, 1);
    return;
  }
  for (let y = 0; y < 34; y++) {
    const w = Math.round(2 + (y / 34) * 6);
    px(ctx, P.metalD, X + 8 - w, Y + y, 1, 1);
    px(ctx, P.metalD, X + 7 + w, Y + y, 1, 1);
    if (y % 5 === 0) px(ctx, P.metal, X + 8 - w, Y + y, w * 2, 1);
  }
  px(ctx, P.metalL, X, Y + 6, 16, 1);
  px(ctx, P.red, X + 7, Y - 1, 2, 2);
}

/** Construit les deux calques fixes de la carte. */
export interface Layers {
  base: HTMLCanvasElement;
  top: HTMLCanvasElement;
  lights: Light[];
}

export function buildLayers(map: MapDef): Layers {
  CUR = map;
  LIGHTS = [];
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = map.w * TILE;
    c.height = map.h * TILE;
    return c;
  };
  const base = mk();
  const top = mk();
  const b = base.getContext("2d")!;
  const t = top.getContext("2d")!;
  for (let y = 0; y < map.h; y++) for (let x = 0; x < map.w; x++) paintGround(b, x, y);
  // Ordre : du fond (haut de carte) vers l'avant
  const props = [...map.props].sort((a, c) => a.y + a.h - (c.y + c.h));
  for (const p of props) {
    switch (p.kind) {
      case "batiment":
        building(b, p);
        break;
      case "arbre":
        tree(b, p, false);
        tree(t, p, true);
        break;
      case "sapin":
        sapin(b, p, false);
        sapin(t, p, true);
        break;
      case "lampadaire":
        lamp(b, p, false);
        lamp(t, p, true);
        break;
      case "banc":
        bench(b, p);
        break;
      case "fontaine":
        fountainBase(b, p);
        break;
      case "horloge":
        clockTower(b, p, false);
        clockTower(t, p, true);
        break;
      case "transfo":
        transfoBase(b, p);
        transfoTop(t, p);
        break;
      case "pylone":
        pylon(b, p, false);
        pylon(t, p, true);
        break;
      case "portail":
      case "barriere":
        break; // animés : dessinés à chaque image
      default:
        smallProp(b, p);
    }
  }
  return { base, top, lights: LIGHTS };
}

// ─── Éléments animés ───

export function drawWater(ctx: Ctx, map: MapDef, t: number, ox: number, oy: number) {
  for (let y = Math.max(0, Math.floor(oy / TILE)); y < Math.min(map.h, Math.ceil((oy + ctx.canvas.height) / TILE) + 1); y++)
    for (let x = Math.max(0, Math.floor(ox / TILE)); x < Math.min(map.w, Math.ceil((ox + ctx.canvas.width) / TILE) + 1); x++) {
      if (map.ground[y][x] !== "eau") continue;
      const X = x * TILE - ox;
      const Y = y * TILE - oy;
      for (let i = 0; i < 3; i++) {
        const wx = Math.floor((hash(x, y, 30 + i) * 12 + t * 3) % 12) + 2;
        const wy = 3 + i * 4 + (Math.floor(t * 2 + i) % 2);
        ctx.fillStyle = i === 1 ? P.waterH : P.waterL;
        ctx.fillRect(X + wx, Y + wy, 3, 1);
      }
    }
}

export function drawFountainWater(ctx: Ctx, p: Prop, t: number, ox: number, oy: number, slow: boolean) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  const sp = slow ? 0.15 : 1;
  ctx.fillStyle = P.waterH;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + t * sp;
    ctx.fillRect(Math.round(X + 24 + Math.cos(a) * 12), Math.round(Y + 26 + Math.sin(a) * 9), 2, 1);
  }
  // Jets (figés au ralenti avant la fin de la quête)
  for (let i = 0; i < 4; i++) {
    const k = ((t * sp * 0.8 + i * 0.25) % 1);
    const jx = X + 24 + (i - 1.5) * 3;
    const jy = Y + 6 - Math.sin(k * Math.PI) * 6;
    ctx.fillStyle = i % 2 ? P.waterH : "#bfe0f5";
    ctx.fillRect(Math.round(jx), Math.round(jy), 1, 2);
  }
  if (slow) {
    ctx.fillStyle = "#bfe0f5";
    ctx.fillRect(X + 30, Y + 2, 2, 2); // la goutte suspendue
  }
}

export function drawClockFace(ctx: Ctx, p: Prop, label: string, t: number, ox: number, oy: number, glitch: boolean) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  ctx.fillStyle = "#101018";
  ctx.fillRect(X + 6, Y + 3, 20, 11);
  const on = !glitch || Math.floor(t * 3) % 4 !== 0;
  if (on) pixelText(ctx, label, X + 7, Y + 6, glitch ? "#ff6f7a" : "#6ff0a0");
}

export function drawGate(ctx: Ctx, p: Prop, open: boolean, ox: number, oy: number) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  const W = p.w * TILE;
  ctx.fillStyle = P.metalD;
  ctx.fillRect(X - 1, Y, 3, 15);
  ctx.fillRect(X + W - 2, Y, 3, 15);
  if (open) {
    ctx.fillStyle = P.metal;
    ctx.fillRect(X + 1, Y + 2, 4, 12);
    ctx.fillRect(X + W - 5, Y + 2, 4, 12);
    return;
  }
  for (let x = 0; x < W - 2; x++) {
    ctx.fillStyle = Math.floor(x / 4) % 2 ? P.gold : P.ink;
    ctx.fillRect(X + 1 + x, Y + 6, 1, 3);
  }
  ctx.fillStyle = P.metal;
  ctx.fillRect(X + 1, Y + 3, W - 2, 1);
  ctx.fillRect(X + 1, Y + 12, W - 2, 1);
  for (let x = 2; x < W - 2; x += 3) ctx.fillRect(X + x, Y + 3, 1, 10);
  ctx.fillStyle = "#3aff8a";
  ctx.fillRect(X + W - 6, Y + 1, 2, 2);
}

export function drawBarrier(ctx: Ctx, p: Prop, open: boolean, t: number, ox: number, oy: number) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  ctx.fillStyle = P.metalD;
  ctx.fillRect(X + 6, Y, 4, 32);
  if (open) {
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = Math.floor(i / 4) % 2 ? P.red : P.white;
      ctx.fillRect(X + 7, Y - 18 + i, 2, 1);
    }
    ctx.fillStyle = Math.floor(t * 2) % 2 ? "#3aff8a" : "#1f8a4a";
  } else {
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = Math.floor(i / 5) % 2 ? P.red : P.white;
      ctx.fillRect(X + 2, Y + 1 + i, 12, 1);
    }
    ctx.fillStyle = Math.floor(t * 2) % 2 ? "#ff4a4a" : "#7a1a1a";
  }
  ctx.fillRect(X + 6, Y - 3, 4, 3);
}

export function drawCore(ctx: Ctx, p: Prop, t: number, ox: number, oy: number, calm: boolean) {
  const X = p.x * TILE - ox;
  const Y = p.y * TILE - oy;
  const k = calm ? 0.4 : 0.6 + Math.sin(t * 5) * 0.4;
  ctx.fillStyle = `rgba(166,108,255,${k})`;
  ctx.fillRect(X + 39, Y + 21, 16, 12);
  ctx.fillStyle = calm ? "#c9a8ff" : "#f0e0ff";
  ctx.fillRect(X + 45 + Math.round(Math.sin(t * 9) * 3), Y + 25, 3, 3);
}

export const propOf = (map: MapDef, kind: Prop["kind"]) => map.props.filter((p) => p.kind === kind);
