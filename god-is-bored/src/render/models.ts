import * as THREE from "three";
import type { BuildingType } from "../sim/types";
import { ball, box, cone, cyl, dome, merge, prism } from "./geo";

type G = THREE.BufferGeometry;
export interface ModelInfo { body: G; accent: G | null; smoke: [number, number, number][]; height: number; }

const C = {
  straw: 0xcfa95a, wood: 0x8a6a47, dwood: 0x5e4630, fur: 0x7a5a3c, earth: 0x9d7f4a, stone: 0xb3ada0, sand: 0xe2d6b0, marble: 0xf1ede2,
  plaster: 0xece0c4, beam: 0x4e3a2a, brick: 0xa5543d, brickD: 0x7d3f2e, soot: 0x3e3b3b, iron: 0x6b6f76, steel: 0x9aa2ab,
  concrete: 0xbfc2c5, glass: 0x86bfdc, white: 0xf4f7fa, panel: 0x2f3d4d, cyan: 0x62e4ff, glow: 0xffe9a0, crate: 0xa07a4a,
  green: 0x5fa05a, hay: 0xdcbc5c, red: 0xb8453a, orange: 0xff8a2a, yellow: 0xe8b930, door: 0x3a2c22,
};
const Q = Math.PI / 4;
/** Époque minimale à laquelle un type de bâtiment existe (les époques plus basses utilisent cette variante). */
export const MIN_ERA: Partial<Record<BuildingType, number>> = { castle: 2, market: 1, walls: 1, mill: 2, forge: 2, factory: 3, station: 3, power: 4, lab: 4 };

/** Les types dont le style de la civilisation modifie la forme (identité visuelle à niveau égal). */
export function styleMatters(type: BuildingType, era: number): boolean {
  return type === "hall" || type === "temple" || type === "castle" || (type === "house" && era <= 2);
}
/** Nombre de variantes de forme/taille par type : plusieurs maisons distinctes par époque et par culture. */
export function variantCount(type: BuildingType): number {
  return type === "house" ? 3 : type === "hall" || type === "temple" ? 2 : 1;
}
export function modelKey(type: BuildingType, era: number, style: number, variant = 0): string {
  const e = Math.max(MIN_ERA[type] ?? 0, Math.min(5, era));
  return `${type}:${e}:${styleMatters(type, e) ? style & 3 : 0}:${variant % variantCount(type)}`;
}

const win = (x: number, y: number, z: number, w = 0.07, h = 0.08, col: number = C.door): G => box(w, h, 0.02, x, y, z, col);
const winSide = (x: number, y: number, z: number, col: number = C.door): G => box(0.02, 0.08, 0.07, x, y, z, col);

/** Motif propre à la civilisation, posé sur ses bâtiments majeurs (accent : couleur de la civilisation). */
function motif(style: number, x: number, y: number, z: number, k = 1): G[] {
  switch (style & 3) {
    case 0: return [cone(0.05 * k, 0.3 * k, 4, x, y, z, 0xffffff, Q)];
    case 1: return [ball(0.07 * k, x, y + 0.07 * k, z, 0xffffff), cyl(0.012, 0.012, 0.1 * k, 4, x, y + 0.1 * k, z, 0xffffff)];
    case 2: return [cone(0.16 * k, 0.07 * k, 4, x, y, z, 0xffffff, Q), cone(0.1 * k, 0.07 * k, 4, x, y + 0.07 * k, z, 0xffffff, Q), cone(0.05 * k, 0.12 * k, 4, x, y + 0.14 * k, z, 0xffffff, Q)];
    default: return [cyl(0.02 * k, 0.02 * k, 0.25 * k, 5, x, y, z, 0xffffff), ball(0.05 * k, x, y + 0.28 * k, z, 0xffffff, 6, 5), box(0.14 * k, 0.03 * k, 0.03 * k, x, y + 0.2 * k, z, 0xffffff)];
  }
}

/** Générateur de maisons détaillées : socle, murs, fenêtres encadrées, porte, toit à débord, cheminée, annexe selon la variante. */
function houseV2(era: number, st: number, v: number): [G[], G[], [number, number, number][]] {
  const body: G[] = [], acc: G[] = [], smoke: [number, number, number][] = [];
  const dims = [[0.5, 0.42], [0.62, 0.46], [0.72, 0.48]][v];
  const [w, d] = dims;
  const win = (x: number, y: number, z: number, ww = 0.075, hh = 0.09, glass: number = C.door, frame: number = C.beam, shutter = 0): void => {
    body.push(box(ww + 0.03, hh + 0.03, 0.018, x, y - 0.015, z, frame), box(ww, hh, 0.024, x, y, z + 0.002, glass));
    if (shutter) { body.push(box(0.03, hh, 0.014, x - ww / 2 - 0.03, y, z, shutter), box(0.03, hh, 0.014, x + ww / 2 + 0.03, y, z, shutter)); }
  };
  const door = (x: number, z: number, hh = 0.15, col: number = C.door, frame: number = C.beam): void => { body.push(box(0.1, hh + 0.02, 0.02, x, 0, z, frame), box(0.075, hh, 0.026, x, 0, z + 0.002, col), box(0.13, 0.02, 0.07, x, 0, z + 0.03, C.stone)); };
  const chim = (x: number, z: number, y: number, hh: number, col: number): void => { body.push(box(0.08, hh, 0.08, x, y, z, col), box(0.1, 0.02, 0.1, x, y + hh, z, C.iron)); smoke.push([x, y + hh + 0.04, z]); };
  switch (era) {
    case 0: { // huttes : forme selon la culture, enrichie selon la variante
      const wall = 0xb59a6e, straw = C.straw;
      if (st === 0) { body.push(cyl(0.27 + v * 0.03, 0.31 + v * 0.03, 0.2, 9, 0, 0, 0, wall), cone(0.4 + v * 0.04, 0.34 + v * 0.05, 9, 0, 0.2, 0, straw), cone(0.3 + v * 0.03, 0.2, 9, 0, 0.34 + v * 0.03, 0, 0xb8964c), box(0.1, 0.14, 0.03, 0, 0, 0.3 + v * 0.03, C.door)); acc.push(cyl(0.325 + v * 0.03, 0.325 + v * 0.03, 0.035, 9, 0, 0.1, 0, 0xffffff), ball(0.04, 0, 0.62 + v * 0.05, 0, 0xffffff, 5, 4)); }
      else if (st === 1) { body.push(dome(0.34 + v * 0.03, 0, 0.01, 0, straw, 0.95), cyl(0.3 + v * 0.03, 0.33 + v * 0.03, 0.12, 9, 0, 0, 0, wall), box(0.1, 0.13, 0.03, 0, 0, 0.3, C.door)); acc.push(box(0.2, 0.05, 0.04, 0, 0.14, 0.3, 0xffffff), ball(0.04, 0, 0.36 + v * 0.03, 0, 0xffffff, 5, 4)); }
      else if (st === 2) { body.push(prism(0.6 + v * 0.06, 0.44 + v * 0.05, 0.5, 0, 0, 0, straw), box(0.4, 0.1, 0.03, 0, 0, 0.255, C.door), cyl(0.012, 0.012, 0.16, 4, -0.31 - v * 0.03, 0.4, 0, C.dwood), cyl(0.012, 0.012, 0.16, 4, 0.31 + v * 0.03, 0.4, 0, C.dwood)); acc.push(box(0.04, 0.1, 0.04, -0.3, 0, 0.26, 0xffffff), box(0.04, 0.1, 0.04, 0.3, 0, 0.26, 0xffffff), box(0.62 + v * 0.06, 0.03, 0.03, 0, 0.14, 0.27, 0xffffff)); }
      else { body.push(box(0.72 + v * 0.06, 0.18, 0.4, 0, 0, 0, C.wood), prism(0.82 + v * 0.06, 0.24, 0.48, 0, 0.18, 0, straw), box(0.1, 0.13, 0.02, -0.12, 0, 0.205, C.door), box(0.1, 0.13, 0.02, 0.18, 0, 0.205, C.door)); acc.push(box(0.04, 0.22, 0.44, 0.38 + v * 0.03, 0.04, 0, 0xffffff), box(0.04, 0.22, 0.44, -0.38 - v * 0.03, 0.04, 0, 0xffffff)); }
      if (v === 1) body.push(box(0.26, 0.02, 0.02, 0.42, 0.18, 0.1, C.dwood), cyl(0.012, 0.012, 0.2, 4, 0.34, 0, 0.1, C.dwood), cyl(0.012, 0.012, 0.2, 4, 0.5, 0, 0.1, C.dwood), box(0.16, 0.02, 0.06, 0.42, 0.14, 0.1, 0xc9b184)); // séchoir à peaux
      if (v === 2) body.push(cyl(0.14, 0.16, 0.12, 7, -0.4, 0, 0.18, wall), cone(0.2, 0.2, 7, -0.4, 0.12, 0.18, straw)); // appentis rond
      for (const g of [...body, ...acc]) g.scale(0.9, 0.9, 0.9); // huttes lisibles à tous les zooms
      return [body, acc, smoke];
    }
    case 1: { // maisons de pierre : appareil en assises, linteaux, toit selon la culture
      const wallH = 0.28 + (v === 2 ? 0.05 : 0);
      body.push(box(w + 0.04, 0.045, d + 0.04, 0, 0, 0, C.stone), box(w, wallH, d, 0, 0.045, 0, C.sand));
      for (const y of [0.1, 0.17, 0.24]) body.push(box(w + 0.006, 0.012, d + 0.006, 0, y, 0, 0xc9bb92));
      win(-w * 0.28, 0.14, d / 2 + 0.002, 0.07, 0.085, C.door, 0xb09a78); win(w * 0.28, 0.14, d / 2 + 0.002, 0.07, 0.085, C.door, 0xb09a78);
      door(0, d / 2 + 0.002, 0.14, C.dwood, 0xb09a78);
      if (v >= 1) body.push(box(0.012, 0.085, 0.07, w / 2 + 0.006, 0.14, 0, C.door));
      if (v === 2) { body.push(box(0.3, 0.2, 0.28, w / 2 + 0.12, 0.045, -0.05, C.sand), box(0.32, 0.03, 0.3, w / 2 + 0.12, 0.245, -0.05, 0xc9bb92)); }
      if (st === 0) acc.push(prism(w + 0.1, 0.24, d + 0.1, 0, 0.045 + wallH, 0, 0xffffff), box(w + 0.1, 0.02, 0.025, 0, 0.045 + wallH + 0.235, 0, 0xffffff));
      else if (st === 1) acc.push(dome(0.25 + v * 0.02, 0, 0.045 + wallH, 0, 0xffffff, 1.0), box(w + 0.08, 0.035, d + 0.08, 0, 0.045 + wallH - 0.02, 0, 0xffffff));
      else if (st === 2) { body.push(box(w * 0.7, 0.18, d * 0.7, 0, 0.045 + wallH, 0, C.sand)); acc.push(prism(w + 0.14, 0.12, d + 0.14, 0, 0.045 + wallH - 0.02, 0, 0xffffff), prism(w * 0.7 + 0.14, 0.12, d * 0.7 + 0.14, 0, 0.045 + wallH + 0.17, 0, 0xffffff)); }
      else { acc.push(cone(Math.max(w, d) * 0.62, 0.3, 9, 0, 0.045 + wallH, 0, 0xffffff)); }
      if (v === 1) chim(w * 0.25, -d * 0.2, 0.045 + wallH + 0.1, 0.16, C.stone);
      return [body, acc, smoke];
    }
    case 2: { // colombages : jambage de pierre, jetée, poutres, lucarne, cheminée
      body.push(box(w + 0.04, 0.09, d + 0.04, 0, 0, 0, C.stone), box(w, 0.25, d, 0, 0.09, 0, C.plaster), box(w + 0.07, 0.22, d + 0.07, 0, 0.34, 0, C.plaster));
      for (const x of [-w / 2 + 0.01, 0, w / 2 - 0.01]) body.push(box(0.035, 0.47, 0.035, x, 0.09, d / 2 + 0.003, C.beam), box(0.035, 0.22, 0.035, x * 1.1, 0.34, (d + 0.07) / 2 + 0.003, C.beam));
      body.push(box(w + 0.02, 0.03, 0.03, 0, 0.33, d / 2 + 0.03, C.beam), box(w * 0.9, 0.025, 0.025, 0, 0.55, (d + 0.07) / 2 + 0.003, C.beam));
      win(-w * 0.26, 0.16, d / 2 + 0.004, 0.07, 0.08, 0x7a96a8, C.beam, 0x6a8a4a); win(w * 0.26, 0.16, d / 2 + 0.004, 0.07, 0.08, 0x7a96a8, C.beam, 0x6a8a4a);
      win(-w * 0.2, 0.41, (d + 0.07) / 2 + 0.004, 0.07, 0.08, 0x7a96a8, C.beam, 0x8a4a3a); win(w * 0.2, 0.41, (d + 0.07) / 2 + 0.004, 0.07, 0.08, 0x7a96a8, C.beam, 0x8a4a3a);
      door(0, d / 2 + 0.004, 0.16, C.dwood, C.beam);
      chim(-w * 0.28, -d * 0.2, 0.5, 0.28 + v * 0.04, C.stone);
      if (v === 2) body.push(box(0.3, 0.3, 0.3, w / 2 + 0.12, 0.09, 0.0, C.plaster), box(0.04, 0.3, 0.04, w / 2 + 0.12, 0.09, 0.16, C.beam));
      if (st === 0) acc.push(prism(w + 0.14, 0.34, d + 0.14, 0, 0.56, 0, 0xffffff), box(w + 0.14, 0.02, 0.025, 0, 0.9, 0, 0xffffff));
      else if (st === 1) acc.push(cone(Math.max(w, d) * 0.85, 0.3, 4, 0, 0.56, 0, 0xffffff, Q));
      else if (st === 2) acc.push(prism(w + 0.18, 0.14, d + 0.18, 0, 0.55, 0, 0xffffff), prism(w * 0.62, 0.2, d * 0.62, 0, 0.67, 0, 0xffffff));
      else { body.push(cyl(0.12, 0.13, 0.52, 8, -w / 2 - 0.02, 0.09, -d / 2 + 0.04, C.plaster)); acc.push(prism(w + 0.14, 0.32, d + 0.14, 0.02, 0.56, 0, 0xffffff), cone(0.17, 0.22, 8, -w / 2 - 0.02, 0.61, -d / 2 + 0.04, 0xffffff)); }
      if (v >= 1) acc.push(prism(0.16, 0.12, 0.14, -w * 0.2, 0.62, d / 2 - 0.02, 0xffffff)); // lucarne
      return [body, acc, smoke];
    }
    case 3: { // maisons de brique : bandeaux, encadrements blancs, cheminées multiples
      const wh = v === 2 ? 0.56 : 0.42;
      body.push(box(w + 0.04, 0.08, d + 0.04, 0, 0, 0, C.brickD), box(w, wh, d, 0, 0.08, 0, C.brick), box(w + 0.03, 0.025, d + 0.03, 0, 0.08 + wh * 0.5, 0, 0x8a3f2c));
      const rows = v === 2 ? [0.16, 0.38, 0.6] : [0.2, 0.42];
      for (const y of rows) for (const xs of v === 0 ? [-0.2, 0.2] : [-0.24, 0, 0.24]) win(xs * (w / 0.7), y, d / 2 + 0.004, 0.075, 0.1, C.glow, 0xe8e2d4);
      door(v === 0 ? 0 : -w * 0.34, d / 2 + 0.004, 0.17, 0x3a2c22, 0xe8e2d4);
      chim(-w * 0.28, -d * 0.2, 0.08 + wh + 0.06, 0.26, C.soot); if (v >= 1) chim(w * 0.26, -d * 0.2, 0.08 + wh + 0.06, 0.3, C.soot);
      if (st === 0) acc.push(prism(w + 0.1, 0.2, d + 0.1, 0, 0.08 + wh, 0, 0xffffff));
      else if (st === 1) acc.push(cone(Math.max(w, d) * 0.8, 0.2, 4, 0, 0.08 + wh, 0, 0xffffff, Q));
      else if (st === 2) acc.push(box(w + 0.07, 0.07, d + 0.07, 0, 0.08 + wh, 0, 0xffffff), box(w + 0.07, 0.04, 0.025, 0, 0.15 + wh, d / 2 + 0.04, 0xffffff));
      else acc.push(prism(w + 0.1, 0.12, d + 0.1, 0, 0.08 + wh, 0, 0xffffff), prism(w * 0.6, 0.1, d * 0.8, 0, 0.2 + wh, 0, 0xffffff));
      return [body, acc, smoke];
    }
    case 4: { // immeubles de béton : bandeaux vitrés, balcons, toit-terrasse équipé
      const floors = [3, 5, 7][v], fh = 0.15, H = floors * fh;
      body.push(box(w * 0.86 + 0.04, 0.05, d * 0.9 + 0.04, 0, 0, 0, C.stone), box(w * 0.86, H, d * 0.9, 0, 0.05, 0, C.concrete));
      for (let f = 0; f < floors; f++) {
        body.push(box(w * 0.86 + 0.012, 0.062, d * 0.9 + 0.012, 0, 0.05 + f * fh + 0.05, 0, C.glass));
        if (f % 2 === 1 && f > 0) body.push(box(w * 0.5, 0.012, 0.09, -w * 0.12, 0.05 + f * fh + 0.03, d * 0.45 + 0.045, C.steel));
      }
      body.push(box(0.14, 0.1, 0.16, -w * 0.18, 0.05 + H, -d * 0.1, C.steel), cyl(0.07, 0.07, 0.1, 7, w * 0.16, 0.05 + H, d * 0.1, C.iron), cyl(0.012, 0.012, 0.2, 4, w * 0.3, 0.05 + H, -d * 0.2, C.steel));
      acc.push(box(w * 0.86 + 0.06, 0.04, d * 0.9 + 0.06, 0, 0.05 + H, 0, 0xffffff), box(w * 0.86 + 0.012, 0.03, d * 0.9 + 0.012, 0, 0.05 + fh * 0.5, 0, 0xffffff));
      return [body, acc, smoke];
    }
    default: { // futuriste : tours effilées, bandes vitrées, passerelles, terrasses végétalisées, lumière
      const glassBands = (r: number, x: number, z: number, h0: number, h1: number) => { for (let y = h0; y < h1; y += 0.16) body.push(cyl(r, r, 0.07, 10, x, y, z, C.glass)); };
      if (v === 0) { body.push(cyl(0.14, 0.21, 0.9, 10, 0, 0, 0, C.white), cyl(0.18, 0.2, 0.05, 10, 0, 0, 0, C.panel), cyl(0.012, 0.012, 0.34, 4, 0, 0.96, 0, C.cyan), box(0.84, 0.025, 0.84, 0, 0, 0, C.panel)); glassBands(0.16, 0, 0, 0.14, 0.82); body.push(cyl(0.155, 0.155, 0.025, 10, 0, 0.88, 0, C.cyan)); acc.push(cyl(0.152, 0.152, 0.035, 10, 0, 0.9, 0, 0xffffff), cyl(0.06, 0.06, 0.05, 8, 0, 0.935, 0, 0xffffff)); }
      else if (v === 1) { body.push(cyl(0.1, 0.14, 0.78, 8, -0.2, 0, 0, C.white), cyl(0.1, 0.14, 1.02, 8, 0.2, 0, 0, C.white), box(0.4, 0.045, 0.09, 0, 0.5, 0, C.glass), box(0.4, 0.012, 0.09, 0, 0.545, 0, C.cyan), box(0.84, 0.025, 0.84, 0, 0, 0, C.panel)); glassBands(0.115, -0.2, 0, 0.14, 0.7); glassBands(0.115, 0.2, 0, 0.14, 0.95); body.push(cyl(0.012, 0.012, 0.26, 4, 0.2, 1.02, 0, C.cyan)); acc.push(cyl(0.1, 0.1, 0.03, 8, -0.2, 0.76, 0, 0xffffff), cyl(0.1, 0.1, 0.03, 8, 0.2, 1.0, 0, 0xffffff)); }
      else { body.push(box(0.62, 0.28, 0.5, 0, 0, 0, C.white), box(0.48, 0.28, 0.4, 0, 0.28, 0, C.white), box(0.34, 0.28, 0.3, 0, 0.56, 0, C.white), box(0.64, 0.025, 0.52, 0, 0.28, 0, C.green), box(0.5, 0.025, 0.42, 0, 0.56, 0, C.green), box(0.62, 0.05, 0.512, 0, 0.14, 0, C.glass), box(0.48, 0.05, 0.412, 0, 0.42, 0, C.glass), box(0.34, 0.05, 0.312, 0, 0.7, 0, C.glass), box(0.62, 0.014, 0.014, 0, 0.1, 0.26, C.cyan), box(0.84, 0.025, 0.84, 0, 0, 0, C.panel), ball(0.07, 0.2, 0.34, 0.1, C.green, 6, 5), ball(0.06, -0.14, 0.62, 0.0, C.green, 6, 5)); acc.push(box(0.36, 0.03, 0.32, 0, 0.84, 0, 0xffffff)); }
      return [body, acc, smoke];
    }
  }
}

function hall(era: number, st: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 0: return [[cyl(0.38, 0.42, 0.34, 10, 0, 0, 0, C.wood), cone(0.52, 0.42, 10, 0, 0.34, 0, C.straw), cyl(0.03, 0.03, 0.9, 5, 0.34, 0, 0.34, C.dwood), box(0.12, 0.12, 0.03, 0, 0, 0.4, C.door),
      cyl(0.1, 0.12, 0.05, 8, -0.34, 0, 0.34, C.stone)], [ball(0.06, 0.34, 0.95, 0.34, 0xffffff, 5, 4), box(0.28, 0.14, 0.02, 0.5, 0.7, 0.34, 0xffffff), cyl(0.43, 0.43, 0.04, 10, 0, 0.16, 0, 0xffffff), ...motif(st, 0, 0.76, 0, 0.8)], smoke];
    case 1: return [[box(0.92, 0.08, 0.82, 0, 0, 0, C.sand), box(0.5, 0.4, 0.46, 0, 0.08, -0.05, C.marble), cyl(0.05, 0.05, 0.44, 8, -0.36, 0.08, 0.3, C.marble), cyl(0.05, 0.05, 0.44, 8, -0.12, 0.08, 0.3, C.marble),
      cyl(0.05, 0.05, 0.44, 8, 0.12, 0.08, 0.3, C.marble), cyl(0.05, 0.05, 0.44, 8, 0.36, 0.08, 0.3, C.marble)], [prism(0.86, 0.22, 0.7, 0, 0.52, 0.02, 0xffffff), ...motif(st, 0, 0.7, 0, 0.9), box(0.2, 0.12, 0.02, 0.4, 0.8, -0.3, 0xffffff)], smoke];
    case 2: smoke.push([-0.3, 1.0, -0.24]); return [[box(0.7, 0.5, 0.6, 0, 0, 0.04, C.stone), box(0.26, 0.82, 0.26, -0.3, 0, -0.24, C.stone), win(-0.18, 0.28, 0.345, 0.08, 0.1, C.door), win(0.15, 0.28, 0.345, 0.08, 0.1, C.door),
      box(0.12, 0.2, 0.03, 0, 0, 0.345, C.door), cyl(0.02, 0.02, 0.5, 5, 0.34, 0.5, 0.3, C.dwood)], [prism(0.76, 0.3, 0.66, 0, 0.5, 0.04, 0xffffff), cone(0.22, 0.34, 4, -0.3, 0.82, -0.24, 0xffffff, Q), box(0.26, 0.15, 0.02, 0.48, 0.8, 0.3, 0xffffff), ...motif(st, 0.04, 0.8, 0.04, 0.8)], smoke];
    case 3: smoke.push([0.3, 1.0, -0.1], [0.4, 0.98, -0.1]); return [[box(0.84, 0.1, 0.64, 0, 0, 0, C.brickD), box(0.8, 0.5, 0.6, 0, 0.1, 0, C.brick), box(0.26, 0.9, 0.26, 0, 0.1, -0.06, C.brick), cyl(0.09, 0.09, 0.02, 10, 0, 0.62, 0.075, C.plaster),
      win(-0.26, 0.28, 0.305, 0.09, 0.12, C.glow), win(0.26, 0.28, 0.305, 0.09, 0.12, C.glow), box(0.07, 0.4, 0.07, 0.3, 0.6, -0.1, C.soot), box(0.07, 0.36, 0.07, 0.4, 0.6, -0.1, C.soot)], [prism(0.86, 0.22, 0.66, 0, 0.6, 0, 0xffffff), cone(0.2, 0.26, 4, 0, 1.0, -0.06, 0xffffff, Q), ...motif(st, 0, 1.2, -0.06, 0.7)], smoke];
    case 4: return [[box(0.58, 1.3, 0.58, 0, 0, 0, C.concrete), box(0.6, 0.07, 0.6, 0, 0.2, 0, C.glass), box(0.6, 0.07, 0.6, 0, 0.45, 0, C.glass), box(0.6, 0.07, 0.6, 0, 0.7, 0, C.glass), box(0.6, 0.07, 0.6, 0, 0.95, 0, C.glass), box(0.6, 0.07, 0.6, 0, 1.2, 0, C.glass),
      box(0.9, 0.06, 0.9, 0, 0, 0, C.steel)], [box(0.62, 0.07, 0.62, 0, 1.3, 0, 0xffffff), box(0.3, 0.1, 0.02, 0, 1.0, 0.31, 0xffffff), ...motif(st, 0, 1.37, 0, 0.8)], smoke];
    default: return [[cyl(0.34, 0.42, 0.28, 12, 0, 0, 0, C.white), cyl(0.2, 0.28, 0.7, 12, 0, 0.28, 0, C.white), cyl(0.3, 0.3, 0.03, 12, 0, 0.45, 0, C.cyan), cyl(0.22, 0.22, 0.03, 12, 0, 0.8, 0, C.cyan), cyl(0.012, 0.012, 0.4, 4, 0, 1.3, 0, C.cyan)],
      [dome(0.3, 0, 0.98, 0, 0xffffff, 1), ...motif(st, 0, 1.28, 0, 0.7)], smoke];
  }
}

function farm(era: number): [G[], G[], [number, number, number][]] {
  const furrows = (col: number) => [box(0.84, 0.07, 0.07, 0, 0.04, -0.3, col), box(0.84, 0.07, 0.07, 0, 0.04, 0, col), box(0.84, 0.07, 0.07, 0, 0.04, 0.3, col)];
  switch (era) {
    case 0: return [[box(0.92, 0.04, 0.92, 0, 0, 0, C.earth), ...[-0.3, 0, 0.3].flatMap((z) => [-0.3, -0.1, 0.1, 0.3].map((x) => box(0.025, 0.14, 0.025, x, 0.04, z, C.green)))], null as unknown as G[], []] as never;
    case 1: return [[box(0.92, 0.05, 0.92, 0, 0, 0, 0xd2b560), ...furrows(0xa98d36), cyl(0.08, 0.09, 0.14, 7, 0.38, 0.05, 0.38, C.stone)], [], []];
    case 2: return [[box(0.92, 0.05, 0.92, 0, 0, 0, 0xd7b950), ...furrows(0xa98d36), cone(0.1, 0.2, 6, 0.36, 0.05, 0.36, C.hay), cone(0.09, 0.17, 6, 0.36, 0.05, 0.16, C.hay), box(0.02, 0.1, 0.02, -0.44, 0.05, 0.44, C.dwood)], [], []];
    case 3: return [[box(0.92, 0.05, 0.92, 0, 0, 0, 0xd7b950), ...furrows(0xa98d36).slice(0, 2), box(0.36, 0.26, 0.28, 0.26, 0.05, 0.28, C.red), win(0.26, 0.1, 0.425, 0.12, 0.12, C.beam)], [prism(0.44, 0.18, 0.34, 0.26, 0.31, 0.28, 0xffffff)], []];
    case 4: return [[box(0.92, 0.05, 0.92, 0, 0, 0, 0xc6c0a0), cyl(0.11, 0.11, 0.62, 8, -0.3, 0.05, 0.3, C.steel), cyl(0.11, 0.11, 0.55, 8, -0.06, 0.05, 0.34, C.steel), cone(0.12, 0.1, 8, -0.3, 0.67, 0.3, C.iron), prism(0.5, 0.2, 0.7, 0.2, 0.05, -0.2, C.glass), box(0.5, 0.12, 0.7, 0.2, 0.05, -0.2, C.glass)], [box(0.3, 0.04, 0.04, -0.3, 0.54, 0.3, 0xffffff)], []];
    default: return [[box(0.92, 0.04, 0.92, 0, 0, 0, C.white), box(0.22, 0.7, 0.22, -0.22, 0.04, 0, C.white), box(0.24, 0.05, 0.24, -0.22, 0.2, 0, C.green), box(0.24, 0.05, 0.24, -0.22, 0.4, 0, C.green), box(0.24, 0.05, 0.24, -0.22, 0.6, 0, C.green),
      box(0.22, 0.55, 0.22, 0.2, 0.04, 0.2, C.white), box(0.24, 0.05, 0.24, 0.2, 0.16, 0.2, C.green), box(0.24, 0.05, 0.24, 0.2, 0.34, 0.2, C.green), box(0.24, 0.05, 0.24, 0.2, 0.5, 0.2, C.green), box(0.7, 0.025, 0.04, 0, 0.05, -0.34, C.cyan)], [dome(0.16, -0.22, 0.74, 0, 0xffffff)], []];
  }
}

function lumber(era: number): [G[], G[], [number, number, number][]] {
  const logs = (x: number, z: number, col: number = 0x7b5a3a) => [cyl(0.07, 0.07, 0.34, 6, x, 0.07, z, col), cyl(0.07, 0.07, 0.34, 6, x + 0.02, 0.07, z - 0.14, col), cyl(0.07, 0.07, 0.34, 6, x + 0.01, 0.2, z - 0.07, 0x8f6c47)].map((g) => g.rotateZ(0));
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 0: return [[box(0.36, 0.22, 0.32, -0.12, 0, 0, C.wood), cone(0.34, 0.2, 5, -0.12, 0.22, 0, C.straw), ...logs(0.26, 0.15)], [box(0.03, 0.14, 0.03, -0.3, 0.22, 0.2, 0xffffff), box(0.1, 0.07, 0.02, -0.25, 0.3, 0.2, 0xffffff)], smoke];
    case 1: return [[box(0.38, 0.26, 0.34, -0.1, 0, 0, C.sand), ...logs(0.27, 0.15)], [box(0.44, 0.04, 0.4, -0.1, 0.26, 0, 0xffffff)], smoke];
    case 2: return [[box(0.42, 0.26, 0.36, -0.1, 0, 0, C.wood), ...logs(0.28, 0.15), ...logs(0.28, -0.2)], [prism(0.5, 0.2, 0.42, -0.1, 0.26, 0, 0xffffff)], smoke];
    case 3: smoke.push([-0.2, 0.9, -0.1]); return [[box(0.62, 0.32, 0.42, -0.05, 0, 0, C.brick), box(0.08, 0.6, 0.08, -0.2, 0.32, -0.1, C.soot), cyl(0.14, 0.14, 0.03, 8, 0.32, 0.05, 0.3, C.steel), ...logs(0.3, 0.3)], [prism(0.68, 0.14, 0.46, -0.05, 0.32, 0, 0xffffff)], smoke];
    case 4: return [[box(0.84, 0.4, 0.52, 0, 0, -0.1, C.concrete), win(0, 0, 0.17, 0.3, 0.26, C.iron), box(0.14, 0.12, 0.2, 0.3, 0.02, 0.3, C.yellow), box(0.14, 0.02, 0.28, 0.3, 0.14, 0.3, C.iron)], [box(0.86, 0.05, 0.54, 0, 0.4, -0.1, 0xffffff)], smoke];
    default: return [[dome(0.38, 0, 0.0, 0, C.white, 0.9), cyl(0.04, 0.04, 0.5, 5, 0.3, 0, 0.3, C.steel), box(0.3, 0.04, 0.04, 0.3, 0.5, 0.3, C.steel), cyl(0.4, 0.4, 0.03, 12, 0, 0.0, 0, C.cyan)], [cyl(0.26, 0.26, 0.04, 10, 0, 0.36, 0, 0xffffff)], smoke];
  }
}

function quarry(era: number): [G[], G[], [number, number, number][]] {
  const rocks = [box(0.4, 0.24, 0.36, -0.12, 0, 0.05, 0x9a9a98, 0.4), box(0.3, 0.16, 0.3, 0.2, 0, -0.12, 0xb2b0aa, 0.9), box(0.24, 0.3, 0.22, 0.16, 0, 0.2, 0x8a8987, 0.2)];
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 0: return [rocks.slice(0, 3).concat([box(0.1, 0.1, 0.1, -0.3, 0, -0.3, 0x8b8a86, 0.6)]), [], smoke];
    case 1: return [[...rocks, box(0.26, 0.12, 0.2, -0.3, 0.06, -0.28, C.wood), cyl(0.06, 0.06, 0.03, 6, -0.38, 0.0, -0.18, C.dwood), cyl(0.06, 0.06, 0.03, 6, -0.2, 0.0, -0.18, C.dwood)], [], smoke];
    case 2: return [[...rocks, cyl(0.03, 0.03, 0.7, 5, -0.3, 0, -0.3, C.dwood), box(0.5, 0.04, 0.04, -0.1, 0.66, -0.3, C.dwood)], [box(0.1, 0.1, 0.1, 0.1, 0.56, -0.3, 0xffffff)], smoke];
    case 3: smoke.push([-0.3, 0.86, -0.3]); return [[...rocks, box(0.2, 0.3, 0.2, -0.3, 0, -0.3, C.iron), cyl(0.04, 0.05, 0.4, 6, -0.3, 0.3, -0.3, C.soot), box(0.5, 0.04, 0.04, -0.05, 0.5, -0.3, C.iron)], [box(0.12, 0.12, 0.12, 0.2, 0.46, -0.3, 0xffffff)], smoke];
    case 4: return [[...rocks.slice(0, 2), box(0.56, 0.1, 0.3, -0.05, 0, -0.3, C.iron), box(0.3, 0.2, 0.26, -0.15, 0.1, -0.3, C.yellow), box(0.4, 0.06, 0.06, 0.15, 0.3, -0.3, C.yellow), box(0.1, 0.12, 0.1, 0.35, 0.18, -0.3, C.yellow)], [box(0.32, 0.04, 0.28, -0.15, 0.3, -0.3, 0xffffff)], smoke];
    default: return [[...rocks.slice(0, 2), box(0.5, 0.06, 0.5, -0.1, 0, -0.3, C.panel), cyl(0.02, 0.02, 0.6, 4, -0.1, 0.06, -0.3, C.steel), cyl(0.01, 0.01, 0.34, 4, -0.1, 0.0, -0.3, C.cyan)], [dome(0.12, -0.1, 0.66, -0.3, 0xffffff)], smoke];
  }
}

function barracks(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 0: {
      const stakes: G[] = []; for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; stakes.push(cyl(0.02, 0.025, 0.3, 4, Math.cos(a) * 0.42, 0, Math.sin(a) * 0.42, C.dwood)); }
      return [[...stakes, prism(0.32, 0.28, 0.3, -0.12, 0, -0.06, C.straw), prism(0.26, 0.22, 0.26, 0.16, 0, 0.1, C.fur)], [cyl(0.015, 0.015, 0.7, 4, 0.0, 0, -0.3, 0xffffff), box(0.2, 0.12, 0.02, 0.1, 0.55, -0.3, 0xffffff)], smoke];
    }
    case 1: return [[box(0.8, 0.3, 0.46, 0, 0, 0, C.sand), box(0.08, 0.14, 0.04, 0.2, 0, 0.25, C.dwood), win(-0.2, 0.1, 0.235)], [box(0.86, 0.04, 0.52, 0, 0.3, 0, 0xffffff)], smoke];
    case 2: return [[box(0.7, 0.38, 0.5, 0, 0, 0, C.stone), box(0.2, 0.7, 0.2, 0.28, 0, -0.14, C.stone), win(-0.15, 0.14, 0.255, 0.08, 0.1)], [prism(0.78, 0.22, 0.56, 0, 0.38, 0, 0xffffff), cone(0.16, 0.2, 4, 0.28, 0.7, -0.14, 0xffffff, Q), box(0.2, 0.14, 0.02, 0.3, 0.9, -0.14, 0xffffff)], smoke];
    case 3: smoke.push([0.3, 0.8, 0]); return [[box(0.88, 0.1, 0.46, 0, 0, 0, C.brickD), box(0.86, 0.3, 0.44, 0, 0.1, 0, C.brick), win(-0.25, 0.2, 0.225, 0.08, 0.1, C.glow), win(0.0, 0.2, 0.225, 0.08, 0.1, C.glow), box(0.08, 0.36, 0.08, 0.3, 0.4, 0, C.soot), cyl(0.015, 0.015, 0.6, 4, -0.4, 0.4, 0.2, C.dwood)], [prism(0.92, 0.16, 0.5, 0, 0.4, 0, 0xffffff), box(0.2, 0.12, 0.02, -0.3, 0.85, 0.2, 0xffffff)], smoke];
    case 4: return [[box(0.8, 0.26, 0.5, 0, 0, 0, C.concrete), box(0.84, 0.06, 0.54, 0, 0.26, 0, C.iron), cyl(0.012, 0.012, 0.6, 4, 0.3, 0.32, 0.1, C.steel), box(0.2, 0.08, 0.12, -0.3, 0, 0.32, 0x8b8466), box(0.2, 0.08, 0.12, 0, 0, 0.34, 0x8b8466)], [box(0.8, 0.04, 0.5, 0, 0.32, 0, 0xffffff), box(0.1, 0.1, 0.02, 0.38, 0.1, 0.26, 0xffffff)], smoke];
    default: return [[dome(0.48, 0, 0, 0, C.panel, 0.7), box(0.3, 0.2, 0.04, 0, 0.0, 0.44, C.cyan), cyl(0.5, 0.5, 0.04, 14, 0, 0, 0, C.white)], [cyl(0.28, 0.28, 0.05, 10, 0, 0.32, 0, 0xffffff), cyl(0.012, 0.012, 0.4, 4, 0, 0.36, 0, 0xffffff)], smoke];
  }
}

function temple(era: number, st: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 0: { const stones: G[] = [], tops: G[] = []; for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const x = Math.cos(a) * 0.34, z = Math.sin(a) * 0.34; stones.push(box(0.1, 0.36 + (i % 3) * 0.06, 0.07, x, 0, z, C.stone, a)); tops.push(ball(0.035, x, 0.4 + (i % 3) * 0.06, z, 0xffffff, 5, 4)); }
      return [[...stones, box(0.2, 0.12, 0.14, 0, 0, 0, C.stone)], [...tops, ...motif(st, 0, 0.12, 0, 0.5)], smoke]; }
    case 1: return [[box(0.86, 0.08, 0.7, 0, 0, 0, 0xf0ece0), cyl(0.05, 0.05, 0.4, 6, -0.3, 0.08, -0.22, 0xf4f1e8), cyl(0.05, 0.05, 0.4, 6, 0.3, 0.08, -0.22, 0xf4f1e8), cyl(0.05, 0.05, 0.4, 6, -0.3, 0.08, 0.22, 0xf4f1e8), cyl(0.05, 0.05, 0.4, 6, 0.3, 0.08, 0.22, 0xf4f1e8), box(0.76, 0.06, 0.6, 0, 0.48, 0, 0xe2ddd0)], [prism(0.8, 0.3, 0.64, 0, 0.54, 0, 0xffffff), ...motif(st, 0, 0.84, 0, 0.7)], smoke];
    case 2: return [[box(0.4, 0.42, 0.78, 0, 0, 0, C.stone), box(0.2, 0.72, 0.2, -0.16, 0, 0.36, C.stone), box(0.2, 0.72, 0.2, 0.16, 0, 0.36, C.stone), win(0, 0.2, 0.395, 0.1, 0.16, 0x6a8fb0), box(0.1, 0.16, 0.02, 0, 0, 0.395, C.door)], [prism(0.46, 0.22, 0.8, 0, 0.42, -0.02, 0xffffff), cone(0.16, 0.5, 4, -0.16, 0.72, 0.36, 0xffffff, Q), cone(0.16, 0.5, 4, 0.16, 0.72, 0.36, 0xffffff, Q), ...motif(st, 0, 0.64, -0.1, 0.6)], smoke];
    case 3: return [[box(0.4, 0.42, 0.78, 0, 0, 0, 0x8d8780), box(0.2, 0.8, 0.2, -0.16, 0, 0.36, 0x8d8780), box(0.2, 0.8, 0.2, 0.16, 0, 0.36, 0x8d8780), box(0.07, 0.3, 0.12, -0.26, 0, 0.0, 0x8d8780), box(0.07, 0.3, 0.12, 0.26, 0, 0.0, 0x8d8780), win(0, 0.2, 0.395, 0.1, 0.18, 0x6a8fb0), box(0.1, 0.16, 0.02, 0, 0, 0.395, C.door)],
      [prism(0.46, 0.24, 0.8, 0, 0.42, -0.02, 0xffffff), cone(0.16, 0.62, 4, -0.16, 0.8, 0.36, 0xffffff, Q), cone(0.16, 0.62, 4, 0.16, 0.8, 0.36, 0xffffff, Q), ...motif(st, 0, 0.66, -0.1, 0.6)], smoke];
    case 4: return [[box(0.5, 0.36, 0.64, 0, 0, 0, C.concrete), box(0.1, 0.9, 0.1, 0.34, 0, 0.26, C.concrete), box(0.5, 0.02, 0.5, 0, 0.1, 0.0, C.glass), box(0.06, 0.22, 0.02, 0.34, 0.9, 0.26, C.concrete)], [prism(0.56, 0.32, 0.7, 0, 0.36, 0, 0xffffff), ...motif(st, 0.34, 0.9, 0.26, 0.4)], smoke];
    default: return [[box(0.2, 1.1, 0.2, 0, 0, 0, C.panel), cyl(0.3, 0.3, 0.025, 12, 0, 0.35, 0, C.cyan), cyl(0.26, 0.26, 0.025, 12, 0, 0.7, 0, C.cyan), cyl(0.4, 0.45, 0.06, 12, 0, 0, 0, C.white)], [ball(0.1, 0, 1.25, 0, 0xffffff, 8, 6), ...motif(st, 0, 1.0, 0, 0.0)], smoke];
  }
}

function castle(era: number, st: number): [G[], G[], [number, number, number][]] {
  const col = era >= 4 ? C.concrete : era === 3 ? 0xa9a396 : 0xc2bdae;
  const body = [box(0.96, 0.22, 0.96, 0, 0, 0, era >= 4 ? 0xa4a7aa : 0xb8b3a6), box(0.5, 0.78, 0.5, 0, 0.22, 0, col), cyl(0.15, 0.17, 0.72, 7, -0.4, 0, -0.4, col), cyl(0.15, 0.17, 0.72, 7, 0.4, 0, -0.4, col), cyl(0.15, 0.17, 0.72, 7, -0.4, 0, 0.4, col), cyl(0.15, 0.17, 0.72, 7, 0.4, 0, 0.4, col), cyl(0.02, 0.02, 0.5, 5, 0, 1, 0, C.dwood)];
  if (era === 3) body.push(cyl(0.05, 0.06, 0.3, 6, 0.0, 0.22, 0.5, C.iron).rotateX(0), box(0.1, 0.1, 0.1, 0.0, 0.22, 0.52, C.iron));
  if (era >= 4) body.push(cyl(0.012, 0.012, 0.4, 4, 0.2, 1.0, 0.1, C.steel), dome(0.1, 0.2, 1.4, 0.1, C.white, 0.5), box(0.5, 0.05, 0.02, 0, 0.5, 0.26, C.glass));
  if (era >= 5) body.push(cyl(0.6, 0.6, 0.025, 14, 0, 0.0, 0, C.cyan));
  const acc = [cone(0.2, 0.3, 7, -0.4, 0.72, -0.4, 0xffffff), cone(0.2, 0.3, 7, 0.4, 0.72, -0.4, 0xffffff), cone(0.2, 0.3, 7, -0.4, 0.72, 0.4, 0xffffff), cone(0.2, 0.3, 7, 0.4, 0.72, 0.4, 0xffffff),
    cone(0.36, 0.28, 4, 0, 1.0, 0, 0xffffff, Q), box(0.24, 0.14, 0.02, 0.14, 1.34, 0, 0xffffff), ...motif(st, 0, 1.26, 0, 0.5)];
  return [body, acc, era >= 3 ? [[0, 1.3, 0]] as [number, number, number][] : []];
}

function market(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  if (era <= 2) {
    const col = era === 1 ? C.sand : C.wood;
    const stall = (x: number, z: number) => [cyl(0.02, 0.02, 0.3, 4, x - 0.13, 0, z - 0.1, C.dwood), cyl(0.02, 0.02, 0.3, 4, x + 0.13, 0, z - 0.1, C.dwood), box(0.3, 0.12, 0.2, x, 0, z + 0.05, col), box(0.08, 0.06, 0.08, x - 0.1, 0.12, z + 0.05, C.crate)];
    const awn = (x: number, z: number) => box(0.36, 0.04, 0.3, x, 0.3, z, 0xffffff);
    return [[...stall(-0.22, -0.2), ...stall(0.22, -0.2), ...stall(0, 0.24)], [awn(-0.22, -0.2), awn(0.22, -0.2), awn(0, 0.24)], smoke];
  }
  if (era === 3) return [[box(0.84, 0.36, 0.56, 0, 0, 0, C.brick), win(-0.22, 0.12, 0.285, 0.14, 0.16, C.glow), win(0.22, 0.12, 0.285, 0.14, 0.16, C.glow), prism(0.7, 0.2, 0.44, 0, 0.36, 0, C.glass)], [box(0.5, 0.1, 0.03, 0, 0.26, 0.3, 0xffffff), box(0.86, 0.04, 0.58, 0, 0.36, 0, 0xffffff)], smoke];
  if (era === 4) return [[box(0.86, 0.4, 0.62, 0, 0, 0, C.concrete), box(0.84, 0.3, 0.02, 0, 0.04, 0.32, C.glass), box(0.8, 0.02, 0.6, 0, 0.4, 0, C.steel)], [box(0.5, 0.12, 0.04, 0, 0.44, 0.3, 0xffffff), box(0.88, 0.05, 0.64, 0, 0.4, 0, 0xffffff)], smoke];
  return [[cyl(0.44, 0.46, 0.05, 14, 0, 0, 0, C.white), cyl(0.03, 0.03, 0.5, 5, 0, 0.05, 0, C.steel), ball(0.12, 0, 0.7, 0, C.cyan, 8, 6), cyl(0.26, 0.26, 0.02, 12, 0, 0.5, 0, C.cyan)], [cyl(0.4, 0.4, 0.03, 12, 0, 0.05, 0, 0xffffff), cyl(0.2, 0.2, 0.02, 10, 0, 0.74, 0, 0xffffff)], smoke];
}

function walls(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 1: return [[cyl(0.16, 0.18, 0.62, 8, -0.3, 0, 0, C.sand), cyl(0.16, 0.18, 0.62, 8, 0.3, 0, 0, C.sand), box(0.44, 0.16, 0.22, 0, 0.34, 0, C.sand), box(0.18, 0.3, 0.2, 0, 0, 0, C.door)], [cone(0.2, 0.2, 8, -0.3, 0.62, 0, 0xffffff), cone(0.2, 0.2, 8, 0.3, 0.62, 0, 0xffffff), box(0.2, 0.14, 0.02, 0, 0.5, 0.12, 0xffffff)], smoke];
    case 2: { const m: G[] = []; for (let i = -2; i <= 2; i++) { m.push(box(0.07, 0.07, 0.07, -0.3 + i * 0.05, 0.84, 0.0, C.stone)); m.push(box(0.07, 0.07, 0.07, 0.3 + i * 0.05, 0.84, 0.0, C.stone)); }
      return [[box(0.26, 0.84, 0.26, -0.32, 0, 0, C.stone), box(0.26, 0.84, 0.26, 0.32, 0, 0, C.stone), box(0.42, 0.16, 0.24, 0, 0.52, 0, C.stone), box(0.2, 0.4, 0.04, 0, 0, 0.1, C.door), ...m], [box(0.22, 0.14, 0.02, -0.32, 0.9, 0.14, 0xffffff), box(0.22, 0.14, 0.02, 0.32, 0.9, 0.14, 0xffffff)], smoke]; }
    case 3: return [[box(0.9, 0.3, 0.3, 0, 0, 0, C.brick), box(0.2, 0.52, 0.34, -0.34, 0, 0, C.brickD), box(0.2, 0.52, 0.34, 0.34, 0, 0, C.brickD), box(0.18, 0.2, 0.04, 0, 0, 0.16, C.door)], [box(0.5, 0.05, 0.34, 0, 0.3, 0, 0xffffff)], smoke];
    case 4: return [[box(0.24, 0.5, 0.24, -0.34, 0, 0, C.concrete), box(0.24, 0.5, 0.24, 0.34, 0, 0, C.concrete), box(0.5, 0.06, 0.2, 0, 0.44, 0, C.steel), box(0.3, 0.05, 0.04, -0.1, 0.18, 0.12, C.red), box(0.1, 0.18, 0.1, 0.0, 0, 0.0, C.glass)], [box(0.26, 0.06, 0.26, -0.34, 0.5, 0, 0xffffff), box(0.26, 0.06, 0.26, 0.34, 0.5, 0, 0xffffff)], smoke];
    default: return [[cyl(0.08, 0.1, 0.6, 6, -0.34, 0, 0, C.panel), cyl(0.08, 0.1, 0.6, 6, 0.34, 0, 0, C.panel), box(0.6, 0.03, 0.03, 0, 0.3, 0, C.cyan), box(0.6, 0.03, 0.03, 0, 0.45, 0, C.cyan), box(0.3, 0.16, 0.2, 0, 0, 0.15, C.white)], [ball(0.07, -0.34, 0.66, 0, 0xffffff, 6, 5), ball(0.07, 0.34, 0.66, 0, 0xffffff, 6, 5)], smoke];
  }
}

function mill(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  if (era === 2) {
    const sails: G[] = [];
    for (let i = 0; i < 4; i++) { const a = (i * Math.PI) / 2 + 0.3; sails.push(box(0.07, 0.5, 0.01, 0, 0, 0, C.plaster).rotateZ(a).translate(0, 0.62, 0.22)); }
    return [[cyl(0.17, 0.26, 0.6, 8, 0, 0, 0, C.stone), ...sails.map((g) => g.translate(0, 0, 0))], [cone(0.2, 0.2, 8, 0, 0.6, 0, 0xffffff), box(0.1, 0.12, 0.02, 0, 0, 0.25, 0xffffff)], smoke];
  }
  if (era === 3) { smoke.push([0.25, 0.9, -0.1]); return [[cyl(0.2, 0.28, 0.62, 8, -0.1, 0, 0, C.brick), box(0.34, 0.26, 0.3, 0.26, 0, 0.0, C.brickD), box(0.07, 0.4, 0.07, 0.25, 0.26, -0.1, C.soot), win(0.26, 0.1, 0.16, 0.1, 0.1, C.glow)], [cone(0.24, 0.2, 8, -0.1, 0.62, 0, 0xffffff), prism(0.4, 0.12, 0.36, 0.26, 0.26, 0, 0xffffff)], smoke]; }
  return [[cyl(0.12, 0.12, 0.7, 8, -0.28, 0, -0.1, C.steel), cyl(0.12, 0.12, 0.6, 8, -0.28, 0, 0.18, C.steel), cyl(0.12, 0.12, 0.65, 8, 0.0, 0, 0.04, C.steel), box(0.5, 0.04, 0.1, 0.12, 0.5, -0.2, C.iron), box(0.3, 0.2, 0.3, 0.3, 0, 0.2, C.concrete)], [cone(0.13, 0.12, 8, -0.28, 0.7, -0.1, 0xffffff), cone(0.13, 0.12, 8, -0.28, 0.6, 0.18, 0xffffff), cone(0.13, 0.12, 8, 0, 0.65, 0.04, 0xffffff)], smoke];
}

function forge(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  switch (era) {
    case 2: smoke.push([-0.18, 0.78, -0.1]); return [[box(0.5, 0.28, 0.4, 0, 0, 0, C.stone), box(0.1, 0.5, 0.1, -0.18, 0.28, -0.1, C.stone), box(0.14, 0.12, 0.03, 0.1, 0.04, 0.205, C.orange), box(0.12, 0.08, 0.1, 0.3, 0, 0.16, C.iron)], [prism(0.56, 0.18, 0.46, 0, 0.28, 0, 0xffffff)], smoke];
    case 3: smoke.push([-0.22, 0.95, -0.1], [0.0, 0.95, -0.1]); return [[box(0.7, 0.38, 0.46, 0, 0, 0, C.brick), box(0.08, 0.57, 0.08, -0.22, 0.38, -0.1, C.soot), box(0.08, 0.57, 0.08, 0.0, 0.38, -0.1, C.soot), box(0.2, 0.14, 0.03, 0.18, 0.04, 0.235, C.orange)], [prism(0.76, 0.14, 0.5, 0, 0.38, 0, 0xffffff)], smoke];
    case 4: smoke.push([0.28, 1.1, -0.1]); return [[box(0.8, 0.4, 0.5, 0, 0, 0, C.steel), cyl(0.07, 0.09, 0.7, 7, 0.28, 0.4, -0.1, C.iron), box(0.3, 0.16, 0.03, -0.1, 0.06, 0.255, C.orange), box(0.2, 0.2, 0.2, -0.3, 0.4, 0.0, C.iron)], [box(0.82, 0.05, 0.52, 0, 0.4, 0, 0xffffff)], smoke];
    default: return [[box(0.7, 0.34, 0.6, 0, 0, 0, C.white), box(0.1, 0.5, 0.1, 0.2, 0.34, 0.0, C.steel), box(0.4, 0.05, 0.05, 0.0, 0.8, 0.0, C.steel), box(0.5, 0.03, 0.03, 0, 0.18, 0.31, C.cyan), cyl(0.06, 0.06, 0.1, 6, -0.2, 0.34, 0.1, C.cyan)], [dome(0.2, -0.1, 0.34, 0, 0xffffff, 0.6)], smoke];
  }
}

function factory(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  if (era === 3) { smoke.push([-0.3, 1.0, -0.2], [-0.1, 1.0, -0.2]); return [[box(0.84, 0.36, 0.6, 0, 0, 0, C.brick), box(0.07, 0.7, 0.07, -0.3, 0.3, -0.2, C.soot), box(0.07, 0.7, 0.07, -0.1, 0.3, -0.2, C.soot), win(-0.25, 0.14, 0.305, 0.12, 0.12, C.glow), win(0.1, 0.14, 0.305, 0.12, 0.12, C.glow), win(0.32, 0.14, 0.305, 0.12, 0.12, C.glow)],
    [prism(0.28, 0.14, 0.62, -0.28, 0.36, 0, 0xffffff), prism(0.28, 0.14, 0.62, 0.0, 0.36, 0, 0xffffff), prism(0.28, 0.14, 0.62, 0.28, 0.36, 0, 0xffffff)], smoke]; }
  if (era === 4) { smoke.push([0.26, 1.0, -0.2], [-0.32, 0.9, -0.22]); return [[box(0.84, 0.36, 0.56, 0, 0, 0.0, C.concrete), win(0, 0.14, 0.285, 0.7, 0.1, C.glass), cyl(0.15, 0.2, 0.7, 10, 0.26, 0.36, -0.2, C.concrete), cyl(0.05, 0.05, 0.6, 6, -0.32, 0.3, -0.22, C.iron), box(0.3, 0.1, 0.1, -0.2, 0.36, 0.2, C.steel)], [box(0.86, 0.05, 0.58, 0, 0.36, 0, 0xffffff)], smoke]; }
  return [[box(0.72, 0.4, 0.7, 0, 0, 0, C.white), box(0.74, 0.04, 0.72, 0, 0.14, 0, C.cyan), box(0.74, 0.04, 0.72, 0, 0.28, 0, C.cyan), box(0.1, 0.26, 0.1, 0.3, 0.4, 0.3, C.steel), box(0.32, 0.04, 0.04, 0.12, 0.62, 0.3, C.steel)], [dome(0.28, -0.1, 0.4, -0.05, 0xffffff, 0.9)], smoke];
}

function station(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  const rails = [box(0.95, 0.03, 0.03, 0, 0.03, 0.34, C.iron), box(0.95, 0.03, 0.03, 0, 0.03, 0.44, C.iron)];
  if (era === 3) return [[box(0.95, 0.06, 0.4, 0, 0, 0.0, C.stone), box(0.5, 0.3, 0.34, -0.12, 0.06, 0.0, C.brick), win(-0.22, 0.2, 0.175, 0.08, 0.12, C.glow), cyl(0.07, 0.07, 0.02, 8, -0.12, 0.3, 0.18, C.plaster), box(0.07, 0.2, 0.07, 0.0, 0.36, 0.0, C.soot), ...rails],
    [prism(0.56, 0.16, 0.4, -0.12, 0.36, 0, 0xffffff), box(0.4, 0.04, 0.3, 0.3, 0.3, -0.02, 0xffffff)], smoke];
  if (era === 4) return [[box(0.95, 0.06, 0.4, 0, 0, 0, C.concrete), box(0.8, 0.3, 0.32, 0, 0.06, 0, C.glass), box(0.82, 0.04, 0.34, 0, 0.36, 0, C.steel), ...rails.map((g) => g)], [box(0.5, 0.06, 0.36, 0, 0.4, 0, 0xffffff), box(0.3, 0.1, 0.03, 0, 0.12, 0.17, 0xffffff)], smoke];
  return [[cyl(0.44, 0.46, 0.05, 14, 0, 0, 0, C.white), cyl(0.36, 0.36, 0.02, 14, 0, 0.05, 0, C.cyan), box(0.2, 0.24, 0.2, 0, 0.05, 0, C.white), box(0.8, 0.03, 0.12, 0, 0.12, 0, C.panel)], [dome(0.22, 0, 0.3, 0, 0xffffff, 0.6), cyl(0.012, 0.012, 0.3, 4, 0, 0.4, 0, 0xffffff)], smoke];
}

function power(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  if (era === 4) { smoke.push([-0.2, 1.0, -0.1], [0.2, 0.6, 0.2]); return [[box(0.8, 0.3, 0.5, 0, 0, 0.1, C.concrete), cyl(0.2, 0.3, 0.8, 12, -0.2, 0.3, -0.12, C.concrete), cyl(0.04, 0.05, 0.6, 6, 0.28, 0.3, 0.0, C.iron), cyl(0.012, 0.03, 0.7, 4, 0.36, 0, 0.34, C.steel), box(0.3, 0.02, 0.02, 0.36, 0.55, 0.34, C.steel)], [box(0.82, 0.04, 0.52, 0, 0.3, 0.1, 0xffffff)], smoke]; }
  return [[cyl(0.46, 0.5, 0.2, 14, 0, 0, 0, C.white), dome(0.4, 0, 0.2, 0, C.white, 1), cyl(0.42, 0.42, 0.04, 14, 0, 0.4, 0, C.cyan), cyl(0.012, 0.03, 0.8, 4, 0.44, 0, 0.44, C.steel), box(0.3, 0.02, 0.02, 0.44, 0.65, 0.44, C.steel)], [dome(0.16, 0, 0.58, 0, 0xffffff, 0.7)], smoke];
}

function lab(era: number): [G[], G[], [number, number, number][]] {
  const smoke: [number, number, number][] = [];
  if (era === 4) return [[box(0.72, 0.42, 0.5, 0, 0, 0, C.white), box(0.7, 0.06, 0.52, 0, 0.14, 0, C.glass), box(0.7, 0.06, 0.52, 0, 0.28, 0, C.glass), cyl(0.02, 0.02, 0.35, 4, 0.26, 0.42, 0.0, C.steel), dome(0.14, 0.26, 0.77, 0.0, C.white, 0.5)], [box(0.74, 0.05, 0.52, 0, 0.42, 0, 0xffffff)], smoke];
  return [[cyl(0.4, 0.44, 0.1, 14, 0, 0, 0, C.white), dome(0.36, 0, 0.1, 0, C.glass, 0.9), cyl(0.38, 0.38, 0.03, 14, 0, 0.1, 0, C.cyan), cyl(0.012, 0.012, 0.5, 4, 0.0, 0.4, 0, C.cyan), cyl(0.012, 0.012, 0.35, 4, 0.2, 0.34, 0.1, C.cyan), cyl(0.012, 0.012, 0.35, 4, -0.2, 0.34, -0.1, C.cyan)], [dome(0.12, 0, 0.42, 0, 0xffffff, 0.8)], smoke];
}

const cache = new Map<string, ModelInfo>();

/** Modèle low-poly d'un bâtiment pour une époque et un style de civilisation (mis en cache, géométrie réutilisée). */
export function buildingModel(type: BuildingType, era: number, style: number, variant = 0): ModelInfo {
  const key = modelKey(type, era, style, variant);
  const hit = cache.get(key);
  if (hit) return hit;
  const e = Math.max(MIN_ERA[type] ?? 0, Math.min(5, era));
  const st = styleMatters(type, e) ? style & 3 : 0;
  let r: [G[], G[], [number, number, number][]];
  switch (type) {
    case "house": r = houseV2(e, st, variant % 3); break;
    case "hall": r = hall(e, st); break;
    case "farm": r = farm(e) as never; break;
    case "lumber": r = lumber(e); break;
    case "quarry": r = quarry(e); break;
    case "barracks": r = barracks(e); break;
    case "temple": r = temple(e, st); break;
    case "castle": r = castle(e, st); break;
    case "market": r = market(e); break;
    case "walls": r = walls(e); break;
    case "mill": r = mill(e); break;
    case "forge": r = forge(e); break;
    case "factory": r = factory(e); break;
    case "station": r = station(e); break;
    case "power": r = power(e); break;
    default: r = lab(e);
  }
  // variante de bâtiment public : aile latérale et toit propre
  if ((type === "hall" || type === "temple") && variant % variantCount(type) > 0) {
    const wc = [C.wood, C.sand, C.stone, C.brick, C.concrete, C.white][e];
    r[0] = [...r[0], box(0.3, 0.22 + e * 0.03, 0.36, 0.52, 0, -0.08, wc), box(0.02, 0.1, 0.02, 0.52, 0, 0.11, C.door)];
    r[1] = [...(r[1] ?? []), prism(0.36, 0.16 + e * 0.02, 0.42, 0.52, 0.22 + e * 0.03, -0.08, 0xffffff)];
  }
  const [bodyParts, accParts, smoke] = r;
  const body = merge(bodyParts.filter(Boolean));
  const accent = accParts && accParts.length ? merge(accParts) : null;
  body.computeBoundingBox();
  accent?.computeBoundingBox();
  const height = Math.max(body.boundingBox?.max.y ?? 0.5, accent?.boundingBox?.max.y ?? 0);
  const info: ModelInfo = { body, accent, smoke, height };
  cache.set(key, info);
  return info;
}

/** Échafaudage affiché pendant les modernisations. */
let scaffold: G | null = null;
export function scaffoldModel(): G {
  if (scaffold) return scaffold;
  const parts: G[] = [];
  for (const [x, z] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) parts.push(cyl(0.015, 0.015, 0.8, 4, x, 0, z, C.dwood));
  for (const y of [0.25, 0.55]) { parts.push(box(0.86, 0.02, 0.02, 0, y, -0.42, C.wood), box(0.86, 0.02, 0.02, 0, y, 0.42, C.wood), box(0.02, 0.02, 0.86, -0.42, y, 0, C.wood), box(0.02, 0.02, 0.86, 0.42, y, 0, C.wood)); }
  scaffold = merge(parts);
  return scaffold;
}

/** Empreinte numérique d'une géométrie (tests : deux modèles différents ont des empreintes différentes). */
export function geometryFingerprint(g: G | null): string {
  if (!g) return "none";
  const p = g.attributes.position.array as Float32Array;
  const c = g.attributes.color?.array as Float32Array | undefined;
  let h = 2166136261;
  for (let i = 0; i < p.length; i++) h = Math.imul(h ^ Math.round(p[i] * 1000), 16777619);
  if (c) for (let i = 0; i < c.length; i += 7) h = Math.imul(h ^ Math.round(c[i] * 255), 16777619);
  return `${p.length / 3}:${(h >>> 0).toString(16)}`;
}
export function vertexCount(g: G | null): number {
  return g ? g.attributes.position.count : 0;
}
