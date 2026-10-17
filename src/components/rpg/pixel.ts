/**
 * RPG — outils pixel art : cuisson de sprites texte avec une palette propre, petite police
 * bitmap 3 × 5 (panneaux, horloges) et halos de lumière en anneaux nets (pas de flou).
 */

export type Palette = Record<string, string>;

const cache = new Map<string, HTMLCanvasElement>();

/** Transforme des lignes de texte (1 caractère = 1 pixel) en canvas ; « . » = transparent. */
export function bakeRows(key: string, rows: string[], pal: Palette, flip = false): HTMLCanvasElement {
  const k = `${key}:${flip ? 1 : 0}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    }),
  );
  cache.set(k, c);
  return c;
}

/** Petite police 3 × 5 (majuscules, chiffres, ponctuation utile). */
const FONT: Record<string, string[]> = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "010"],
  K: ["101", "101", "110", "101", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "110", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "110"],
  ":": ["0", "1", "0", "1", "0"],
  "'": ["1", "1", "0", "0", "0"],
  "-": ["000", "000", "111", "000", "000"],
  " ": ["00", "00", "00", "00", "00"],
  _: ["000", "000", "000", "000", "111"],
};

export function textWidth(s: string) {
  return [...s.toUpperCase()].reduce((w, ch) => w + (FONT[ch]?.[0].length ?? 3) + 1, -1);
}

export function pixelText(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[" "];
    g.forEach((row, ry) => [...row].forEach((b, rx) => b === "1" && ctx.fillRect(cx + rx, y + ry, 1, 1)));
    cx += g[0].length + 1;
  }
}

/** Halo en anneaux nets (style pixel) : utilisé pour « percer » la nuit autour des lumières. */
export function lightSprite(r: number): HTMLCanvasElement {
  const k = `light:${r}`;
  const hit = cache.get(k);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = r * 2;
  const ctx = c.getContext("2d")!;
  const rings: [number, number][] = [
    [1, 0.14],
    [0.86, 0.3],
    [0.7, 0.5],
    [0.52, 0.72],
    [0.34, 0.92],
  ];
  for (const [k2, a] of rings) {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    const rr = r * k2;
    for (let y = -rr; y < rr; y++) {
      const half = Math.round(Math.sqrt(rr * rr - y * y));
      ctx.clearRect(r - half, r + y, half * 2, 1);
      ctx.fillRect(r - half, r + y, half * 2, 1);
    }
  }
  cache.set(k, c);
  return c;
}

/** Bruit déterministe (variations de tuiles reproductibles). */
export function hash(x: number, y: number, s = 0): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
