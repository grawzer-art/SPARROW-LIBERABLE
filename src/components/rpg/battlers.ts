/**
 * RPG — sprites de combat (pixel art original, peint par le code, 48 × 48 ou 56 × 56).
 *
 * Les formes sont posées sur une petite grille (disques, ellipses, rectangles), ombrées
 * selon une lumière venant d'en haut à gauche, puis cernées d'un contour sombre : même
 * rendu que les décors. L'équipe est vue de dos, les ennemis de face.
 */

type C = string | null;

class Raster {
  readonly px: C[];
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.px = new Array(w * h).fill(null);
  }
  set(x: number, y: number, c: C) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.px[y * this.w + x] = c;
  }
  get(x: number, y: number): C {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }
  rect(x: number, y: number, w: number, h: number, c: C) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  /** Ellipse ombrée : clair en haut à gauche, sombre en bas à droite. */
  ball(cx: number, cy: number, rx: number, ry: number, base: string, light?: string, dark?: string, cut?: (x: number, y: number) => boolean) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        if (cut?.(x, y)) continue;
        const k = dx + dy;
        this.set(x, y, light && k < -0.75 ? light : dark && k > 0.6 ? dark : base);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: C) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, c);
  }
  /** Contour sombre d'un pixel autour de tout ce qui est peint. */
  outline(c: string) {
    const add: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.get(x, y)) continue;
        if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push(y * this.w + x);
      }
    for (const i of add) this.px[i] = c;
  }
  canvas(): HTMLCanvasElement {
    const cv = document.createElement("canvas");
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext("2d")!;
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    return cv;
  }
}

const INK = "#1b1626";

/** Yeux de face (blanc + pupille), sourcils. */
function eyes(r: Raster, x: number, y: number, gap: number, mood: "fache" | "neutre" | "rage" = "neutre", size = 2) {
  for (const ex of [x, x + gap]) {
    r.rect(ex, y, size + 1, size + 1, "#f8f4e8");
    r.rect(ex + (ex === x ? size - 1 : 0) + 1, y + 1, Math.max(1, size - 1), size, mood === "rage" ? "#c62828" : INK);
  }
  if (mood !== "neutre") {
    r.line(x - 1, y - 2, x + size + 1, y - 1, INK);
    r.line(x + gap + size + 2, y - 2, x + gap, y - 1, INK);
  }
}

// ─── Ennemis (de face) ───

function brocoli(): Raster {
  const r = new Raster(48, 48);
  // Pieds et tige
  r.ball(19, 44, 4, 2.5, "#3f7a35", "#5a9a45", "#2c5a26");
  r.ball(29, 44, 4, 2.5, "#3f7a35", "#5a9a45", "#2c5a26");
  r.ball(24, 33, 9, 11, "#8cc265", "#a9d97e", "#6a9e4b");
  // Bras
  r.ball(13, 33, 3, 2.5, "#8cc265", "#a9d97e", "#6a9e4b");
  r.ball(35, 32, 3, 2.5, "#8cc265", "#a9d97e", "#6a9e4b");
  // Fleurettes
  const flor: [number, number, number][] = [
    [24, 13, 9],
    [15, 17, 7],
    [33, 17, 7],
    [19, 9, 6],
    [29, 9, 6],
    [11, 22, 5],
    [37, 22, 5],
    [24, 20, 7],
  ];
  for (const [x, y, s] of flor) r.ball(x, y, s, s * 0.9, "#2f7d3a", "#4fa055", "#1f5a2a");
  for (const [x, y, s] of flor) {
    r.set(x - s / 3, y - s / 3, "#7cc77a");
    r.set(x + s / 4, y - s / 2, "#7cc77a");
  }
  // Casque de soldat
  r.ball(24, 6, 8, 4, "#7d8590", "#a3abb5", "#5b626c", (_x, y) => y > 6);
  r.rect(15, 6, 18, 2, "#5b626c");
  r.set(24, 1, "#c62828");
  r.set(24, 2, "#c62828");
  // Visage
  eyes(r, 18, 28, 8, "fache");
  r.rect(21, 35, 6, 1, INK);
  r.set(20, 34, INK);
  r.set(27, 34, INK);
  // Lance
  r.line(39, 14, 39, 44, "#7a5230");
  r.ball(39, 12, 2, 3, "#c9ccd2", "#ffffff", "#8a8f99");
  r.outline(INK);
  return r;
}

function patate(): Raster {
  const r = new Raster(48, 48);
  r.ball(17, 44, 4, 2.5, "#6b4a2b", "#86613b", "#4c331d");
  r.ball(31, 44, 4, 2.5, "#6b4a2b", "#86613b", "#4c331d");
  r.ball(24, 28, 17, 15, "#b98a52", "#d2a66b", "#8f663a");
  r.ball(8, 31, 3.5, 3, "#b98a52", "#d2a66b", "#8f663a");
  r.ball(40, 31, 3.5, 3, "#b98a52", "#d2a66b", "#8f663a");
  // Taches et germes
  for (const [x, y] of [
    [13, 22],
    [33, 36],
    [16, 38],
    [36, 21],
    [28, 18],
  ])
    r.rect(x, y, 2, 1, "#7a5530");
  r.line(10, 18, 7, 14, "#8cc265");
  r.set(6, 13, "#a9d97e");
  // Bandana rouge
  r.ball(24, 18, 16, 4, "#c62828", "#e04848", "#8e1b1b", (_x, y) => y < 16 || y > 20);
  r.rect(37, 17, 5, 2, "#c62828");
  r.line(41, 19, 44, 23, "#8e1b1b");
  r.line(41, 18, 45, 20, "#c62828");
  // Visage renfrogné
  eyes(r, 16, 23, 11, "fache", 3);
  r.rect(20, 33, 9, 2, INK);
  r.rect(22, 33, 2, 1, "#f8f4e8");
  r.outline(INK);
  return r;
}

function laitue(): Raster {
  const r = new Raster(48, 48);
  r.ball(19, 44, 3.5, 2.5, "#3f7a35", "#5a9a45", "#2c5a26");
  r.ball(29, 44, 3.5, 2.5, "#3f7a35", "#5a9a45", "#2c5a26");
  // Feuilles en couches
  r.ball(24, 27, 15, 16, "#7fbf5a", "#a8db7c", "#5c9a3e");
  r.ball(24, 30, 12, 12, "#9fd673", "#c2ea94", "#7bb556");
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i - 3) * 0.42;
    r.line(24, 32, 24 + Math.cos(a) * 13, 30 + Math.sin(a) * 15, "#5c9a3e");
  }
  // Crête de feuilles
  r.ball(18, 11, 5, 4, "#7fbf5a", "#a8db7c", "#5c9a3e");
  r.ball(24, 9, 5, 5, "#8fd065", "#b5e388", "#5c9a3e");
  r.ball(30, 11, 5, 4, "#7fbf5a", "#a8db7c", "#5c9a3e");
  // Visage
  eyes(r, 18, 25, 9, "fache");
  r.rect(21, 32, 6, 1, INK);
  // Bouclier rondelle de tomate
  r.ball(9, 32, 7, 8, "#d8433a", "#f06a5a", "#a52b25");
  r.ball(9, 32, 4.5, 5.5, "#f28b74");
  for (const [x, y] of [
    [7, 29],
    [11, 30],
    [8, 34],
    [11, 35],
  ])
    r.set(x, y, "#f8e7b0");
  // Lance en céleri
  r.line(40, 10, 40, 44, "#b6d98a");
  r.line(41, 10, 41, 44, "#8cbf5f");
  r.ball(40.5, 8, 3, 3, "#6fae4a", "#94cf6a", "#4d8a33");
  r.outline(INK);
  return r;
}

function roi(colere: boolean): Raster {
  const r = new Raster(56, 56);
  // Cape
  r.ball(28, 42, 21, 13, colere ? "#7a1f3a" : "#5b2b86", colere ? "#a3304f" : "#7a43ad", colere ? "#55142a" : "#3f1d60", (_x, y) => y < 34);
  r.rect(9, 46, 38, 6, colere ? "#7a1f3a" : "#5b2b86");
  for (let x = 10; x < 46; x += 3) r.set(x, 50, "#f2e6c8");
  // Corps salade
  r.ball(28, 30, 17, 17, colere ? "#6fa648" : "#7fbf5a", colere ? "#90c766" : "#a8db7c", colere ? "#4d7a2e" : "#5c9a3e");
  r.ball(28, 31, 13, 13, colere ? "#88bf5e" : "#9fd673", colere ? "#aad47e" : "#c2ea94", colere ? "#679c43" : "#7bb556");
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (i - 4) * 0.36;
    r.line(28, 36, 28 + Math.cos(a) * 15, 33 + Math.sin(a) * 17, colere ? "#4d7a2e" : "#5c9a3e");
  }
  // Couronne
  const cy = colere ? 12 : 11;
  r.rect(18, cy, 20, 5, "#e8b830");
  r.rect(18, cy + 4, 20, 1, "#a87a18");
  for (const x of [18, 23, 28, 33, 37]) {
    r.rect(x, cy - 3, 2, 3, "#e8b830");
    r.set(x, cy - 4, "#f8dc70");
  }
  r.rect(22, cy + 1, 2, 2, "#c62828");
  r.rect(27, cy + 1, 2, 2, "#2e7dd2");
  r.rect(32, cy + 1, 2, 2, "#c62828");
  // Visage
  if (colere) {
    eyes(r, 20, 26, 12, "rage", 3);
    r.rect(23, 35, 10, 3, INK);
    for (let x = 24; x < 32; x += 2) r.set(x, 35, "#f8f4e8");
    // Vapeur de colère
    r.line(12, 16, 9, 12, "#f8f4e8");
    r.line(44, 16, 47, 12, "#f8f4e8");
    // Vinaigrette
    r.rect(15, 38, 1, 3, "#e8c33a");
    r.rect(41, 36, 1, 3, "#e8c33a");
  } else {
    eyes(r, 21, 26, 11, "fache", 2);
    r.rect(24, 35, 8, 1, INK);
    r.set(23, 34, INK);
    r.set(32, 34, INK);
    // Moustache de persil
    r.rect(22, 33, 4, 1, "#2f7d3a");
    r.rect(30, 33, 4, 1, "#2f7d3a");
  }
  // Sceptre-céleri
  r.line(49, 14, 49, 52, "#b6d98a");
  r.line(50, 14, 50, 52, "#8cbf5f");
  r.ball(49.5, 11, 4, 4, "#6fae4a", "#94cf6a", "#4d8a33");
  r.ball(47, 33, 3, 3, colere ? "#88bf5e" : "#9fd673");
  r.outline(INK);
  return r;
}

// ─── Équipe (de dos) ───

const OUTFIT: Record<string, [string, string, string]> = {
  "ten-survet": ["#e53935", "#ff6a5f", "#9e1f1c"],
  "ten-peignoir": ["#f1efe8", "#ffffff", "#c9c5b8"],
  "ten-cape": ["#191919", "#3b3b3b", "#090909"],
  "ten-frite": ["#f2c14e", "#f8dc8c", "#b5851c"],
  "ten-armure": ["#777777", "#9a9aa8", "#5a5a6e"],
};

function sparrowBack(tenue?: string): Raster {
  const r = new Raster(48, 48);
  const [c, cl, cd] = OUTFIT[tenue ?? ""] ?? ["#3b3b3b", "#545454", "#262626"];
  // Buste (sweat à capuche) et bras
  r.ball(24, 42, 18, 12, c, cl, cd, (_x, y) => y > 47);
  r.ball(8, 40, 5, 7, c, cl, cd);
  r.ball(40, 40, 5, 7, c, cl, cd);
  // Capuche
  r.ball(24, 30, 11, 5, cd, c, "#1c1c1c");
  // Tête de dos : cheveux, oreilles, barbe sur les côtés
  r.ball(24, 18, 11, 12, "#8a4b22", "#a8622f", "#6b3a1a");
  r.ball(12.5, 20, 2.5, 3.5, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(35.5, 20, 2.5, 3.5, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(14, 26, 3, 3, "#c4521f", "#d8692f", "#93370f");
  r.ball(34, 26, 3, 3, "#c4521f", "#d8692f", "#93370f");
  // Branches de lunettes
  r.line(13, 16, 20, 16, "#101010");
  r.line(28, 16, 35, 16, "#101010");
  // Mèches
  for (const [x, y] of [
    [19, 10],
    [26, 8],
    [30, 13],
    [21, 21],
    [27, 23],
  ])
    r.line(x, y, x + 2, y + 3, "#6b3a1a");
  // Manette dans la main droite
  r.ball(44, 45, 4, 2.5, "#2a2a32", "#45454f", "#16161c");
  r.set(44, 44, "#c62828");
  r.outline(INK);
  return r;
}

function chevalierBack(): Raster {
  const r = new Raster(48, 48);
  // Cape
  r.ball(24, 40, 19, 13, "#1d1826", "#2e2740", "#120f18", (_x, y) => y > 47);
  r.line(24, 30, 24, 47, "#120f18");
  r.ball(24, 46, 15, 2, "#7a1f2a");
  // Épaulières
  r.ball(9, 33, 6, 5, "#3a3548", "#5a5470", "#24202e");
  r.ball(39, 33, 6, 5, "#3a3548", "#5a5470", "#24202e");
  // Épée dans le dos
  r.line(15, 22, 33, 46, "#5a5470");
  r.line(16, 22, 34, 46, "#8a849c");
  r.rect(13, 20, 5, 2, "#c9a84a");
  // Heaume
  r.ball(24, 18, 10, 11, "#3a3548", "#5a5470", "#24202e");
  r.rect(15, 22, 18, 2, "#24202e");
  r.line(24, 8, 24, 28, "#24202e");
  // Plumet rouge
  r.ball(24, 6, 3, 5, "#c62828", "#e04848", "#8e1b1b");
  r.line(24, 2, 30, 0, "#c62828");
  r.outline(INK);
  return r;
}

function gerardBack(): Raster {
  const r = new Raster(48, 48);
  // Cornet rayé rouge et blanc (le bas)
  for (let y = 30; y < 48; y++) {
    const half = 9 + (y - 30) * 0.45;
    for (let x = Math.round(24 - half); x <= Math.round(24 + half); x++) r.set(x, y, Math.floor((x + y * 0.3) / 3) % 2 ? "#d23a3a" : "#f4eee0");
  }
  // La frite (corps)
  r.rect(15, 6, 18, 28, "#f2c14e");
  r.rect(15, 6, 3, 28, "#f8dc8c");
  r.rect(30, 6, 3, 28, "#c9952e");
  r.rect(16, 4, 16, 2, "#e0a838");
  r.rect(18, 3, 12, 1, "#c9952e");
  // Croustillant et sel
  for (const [x, y] of [
    [19, 9],
    [26, 13],
    [22, 19],
    [28, 24],
    [20, 27],
    [25, 7],
  ])
    r.set(x, y, "#ffffff");
  r.rect(15, 15, 18, 1, "#d9a63c");
  // Bras
  r.line(14, 20, 8, 28, "#f2c14e");
  r.line(14, 21, 8, 29, "#c9952e");
  r.line(33, 20, 39, 28, "#f2c14e");
  r.line(33, 21, 39, 29, "#c9952e");
  // Toque
  r.ball(24, 2, 7, 3, "#ffffff", "#ffffff", "#d8d4cc", (_x, y) => y > 3);
  r.outline(INK);
  return r;
}


// ─── Chapitre 3 : la Confrérie du Muscle ───

function sparrowTitan(tenue?: string): Raster {
  const r = new Raster(56, 56);
  const [c, cl, cd] = OUTFIT[tenue ?? ""] ?? ["#3b3b3b", "#545454", "#262626"];
  // Aura dorée
  r.ball(28, 34, 27, 22, "#f8dc70", undefined, undefined, (x, y) => (x + y) % 3 !== 0 || y > 50);
  // Dos et épaules énormes (tenue déchirée aux épaules)
  r.ball(28, 50, 25, 14, c, cl, cd, (_x, y) => y > 55);
  r.ball(7, 40, 8, 10, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(49, 40, 8, 10, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(7, 36, 5, 4, "#f5c7a3");
  r.ball(49, 36, 5, 4, "#f5c7a3");
  r.ball(28, 38, 14, 6, cd, c, "#1c1c1c");
  // Tête et cheveux dressés
  r.ball(28, 24, 11, 12, "#8a4b22", "#a8622f", "#6b3a1a");
  for (const x of [20, 24, 28, 32, 36]) r.line(x, 14, x + (x < 28 ? -2 : x > 28 ? 2 : 0), 7, "#a8622f");
  r.ball(16.5, 26, 2.5, 3.5, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(39.5, 26, 2.5, 3.5, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(18, 32, 3, 3, "#c4521f", "#d8692f", "#93370f");
  r.ball(38, 32, 3, 3, "#c4521f", "#d8692f", "#93370f");
  r.line(17, 22, 24, 22, "#101010");
  r.line(32, 22, 39, 22, "#101010");
  r.outline(INK);
  return r;
}

function liliBack(): Raster {
  const r = new Raster(48, 48);
  // Cape violette et capuche
  r.ball(24, 42, 17, 11, "#4a2670", "#6a3a9a", "#2e1648", (_x, y) => y > 47);
  r.ball(9, 39, 4, 7, "#2a2438", "#3a3450", "#1a1626");
  r.ball(39, 39, 4, 7, "#2a2438", "#3a3450", "#1a1626");
  r.ball(24, 20, 11, 13, "#6a3a9a", "#8a5aba", "#4a2670");
  r.line(24, 9, 24, 30, "#4a2670");
  // Écharpe sombre
  r.ball(24, 32, 10, 3, "#1d1826", "#2a2438", "#120e18");
  r.line(30, 33, 34, 42, "#1d1826");
  // Dagues croisées à la ceinture
  r.line(14, 44, 22, 40, "#c8d0ff");
  r.line(34, 44, 26, 40, "#c8d0ff");
  r.outline(INK);
  return r;
}

function haltere(): Raster {
  const r = new Raster(48, 48);
  // Deux disques et une barre, avec un visage sur la barre
  r.ball(9, 26, 8, 16, "#4a505a", "#7d8590", "#2a2e36");
  r.ball(39, 26, 8, 16, "#4a505a", "#7d8590", "#2a2e36");
  r.ball(9, 26, 3, 6, "#2a2e36");
  r.ball(39, 26, 3, 6, "#2a2e36");
  r.rect(15, 21, 18, 10, "#a3abb5");
  r.rect(15, 21, 18, 2, "#c9ccd2");
  r.rect(15, 29, 18, 2, "#7d8590");
  eyes(r, 18, 23, 8, "fache");
  r.rect(21, 28, 6, 1, INK);
  r.set(3, 15, "#c9ccd2");
  r.set(33, 15, "#c9ccd2");
  // Petits pieds
  r.ball(9, 43, 4, 2, "#2a2e36");
  r.ball(39, 43, 4, 2, "#2a2e36");
  r.outline(INK);
  return r;
}

function proteinator(): Raster {
  const r = new Raster(52, 52);
  // Shaker géant : couvercle, gobelet, mousse qui déborde
  r.ball(26, 9, 13, 5, "#c62828", "#e04848", "#8e1b1b");
  r.rect(22, 1, 8, 5, "#c62828");
  r.rect(13, 12, 26, 34, "#e8e2d4");
  r.rect(13, 12, 4, 34, "#ffffff");
  r.rect(35, 12, 4, 34, "#c9c1ae");
  r.rect(15, 22, 22, 22, "#8a5a3a");
  r.rect(15, 22, 22, 3, "#a87a50");
  for (const [x, y] of [
    [11, 14],
    [40, 16],
    [12, 20],
  ])
    r.ball(x, y, 3, 3, "#f8f4e8", "#ffffff", "#d8d4cc");
  for (let y = 26; y < 44; y += 4) r.rect(36, y, 3, 1, "#7d8590");
  eyes(r, 18, 28, 10, "fache", 3);
  r.rect(21, 36, 10, 3, INK);
  r.rect(22, 36, 8, 1, "#f8f4e8");
  // Bras musclés
  r.ball(7, 32, 5, 6, "#e9b18a", "#f5c7a3", "#c98b66");
  r.ball(45, 32, 5, 6, "#e9b18a", "#f5c7a3", "#c98b66");
  r.rect(17, 46, 6, 4, "#2a2a32");
  r.rect(29, 46, 6, 4, "#2a2a32");
  r.outline(INK);
  return r;
}

function moine(): Raster {
  const r = new Raster(48, 48);
  // Moine du Gain : crâne rasé, bandeau rouge, kimono, bras croisés
  r.ball(24, 40, 15, 11, "#e8e0c8", "#f8f4e8", "#c8bfa4", (_x, y) => y > 47);
  r.line(24, 30, 24, 47, "#c8bfa4");
  r.rect(10, 41, 28, 3, "#1b1626");
  r.ball(24, 18, 9, 10, "#e2a982", "#f0c09a", "#c48a62");
  r.rect(15, 12, 18, 3, "#c62828");
  r.line(33, 13, 37, 17, "#c62828");
  eyes(r, 19, 17, 7, "fache");
  r.rect(21, 24, 6, 1, INK);
  r.ball(12, 34, 6, 4, "#e2a982", "#f0c09a", "#c48a62");
  r.ball(36, 34, 6, 4, "#e2a982", "#f0c09a", "#c48a62");
  r.rect(14, 34, 20, 4, "#e2a982");
  r.outline(INK);
  return r;
}

function gonflax(max: boolean): Raster {
  const r = new Raster(60, 60);
  const skin = max ? ["#e07a5a", "#f09a7a", "#b8563a"] : ["#d8946a", "#ecae86", "#b8764e"];
  // Torse énorme, débardeur, bras en V
  r.ball(30, 44, 22, 15, skin[0], skin[1], skin[2], (_x, y) => y > 59);
  r.ball(8, 34, 9, 12, skin[0], skin[1], skin[2]);
  r.ball(52, 34, 9, 12, skin[0], skin[1], skin[2]);
  r.ball(6, 24, 6, 6, skin[0], skin[1], skin[2]);
  r.ball(54, 24, 6, 6, skin[0], skin[1], skin[2]);
  r.rect(18, 36, 24, 20, max ? "#8e1b1b" : "#c62828");
  r.rect(18, 36, 24, 2, max ? "#a82a2a" : "#e04848");
  pixelText(r, "GAIN", 22, 43);
  // Tête, moustache, bandeau, sifflet
  r.ball(30, 20, 10, 11, skin[0], skin[1], skin[2]);
  r.rect(20, 11, 20, 3, max ? "#f2c14e" : "#2e7dd2");
  eyes(r, 24, 18, 8, max ? "rage" : "fache", 2);
  r.rect(24, 25, 13, 2, "#3a2a20");
  r.rect(27, 28, 6, 1, INK);
  r.line(30, 31, 30, 38, "#e8b830");
  r.ball(30, 39, 2, 2, "#e8b830");
  if (max) {
    // Veines et vapeur
    r.line(6, 30, 9, 38, "#8e1b1b");
    r.line(53, 30, 50, 38, "#8e1b1b");
    r.line(18, 6, 15, 1, "#f8f4e8");
    r.line(42, 6, 45, 1, "#f8f4e8");
  }
  r.outline(INK);
  return r;
}

/** Lettres claires sur le débardeur de Gonflax (police 3 × 5 minimaliste). */
function pixelText(r: Raster, t: string, x: number, y: number) {
  const F: Record<string, string[]> = { G: ["011", "100", "101", "101", "011"], A: ["010", "101", "111", "101", "101"], I: ["111", "010", "010", "010", "111"], N: ["101", "111", "111", "111", "101"] };
  [...t].forEach((ch, i) => F[ch]?.forEach((row, yy) => [...row].forEach((b, xx) => b === "1" && r.set(x + i * 4 + xx, y + yy, "#f8f4e8"))));
}

const PAINT: Record<string, (tenue?: string) => Raster> = {
  "sparrow-titan": sparrowTitan,
  lili: liliBack,
  haltere,
  proteinator,
  moine,
  gonflax: () => gonflax(false),
  "gonflax-max": () => gonflax(true),
  brocoli,
  patate,
  laitue,
  roi: () => roi(false),
  "roi-colere": () => roi(true),
  sparrow: sparrowBack,
  chevalier: chevalierBack,
  gerard: gerardBack,
};

const cache = new Map<string, HTMLCanvasElement>();

/** Sprite de combat (mis en cache). */
export function battler(id: string, tenue?: string): HTMLCanvasElement {
  const k = `${id}:${id.startsWith("sparrow") ? (tenue ?? "") : ""}`;
  let c = cache.get(k);
  if (!c) {
    c = (PAINT[id] ?? PAINT.brocoli)(tenue).canvas();
    cache.set(k, c);
  }
  return c;
}

export const BATTLER_IDS = Object.keys(PAINT);
