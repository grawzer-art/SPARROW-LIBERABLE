import type { Citizen } from "./types";

/** Grille spatiale pour les requêtes de voisinage (contagion, reproduction, combats). */
export class SpatialHash {
  cell = 2;
  w: number;
  cells: number[][];
  constructor(size: number) {
    this.w = Math.ceil(size / this.cell);
    this.cells = Array.from({ length: this.w * this.w }, () => []);
  }
  rebuild(citizens: Citizen[]): void {
    for (const c of this.cells) c.length = 0;
    for (let i = 0; i < citizens.length; i++) {
      const ct = citizens[i];
      if (ct.dead) continue;
      const cx = Math.max(0, Math.min(this.w - 1, Math.floor(ct.x / this.cell)));
      const cy = Math.max(0, Math.min(this.w - 1, Math.floor(ct.y / this.cell)));
      this.cells[cy * this.w + cx].push(i);
    }
  }
  query(citizens: Citizen[], x: number, y: number, r: number, fn: (c: Citizen) => void): void {
    const x0 = Math.max(0, Math.floor((x - r) / this.cell)), x1 = Math.min(this.w - 1, Math.floor((x + r) / this.cell));
    const y0 = Math.max(0, Math.floor((y - r) / this.cell)), y1 = Math.min(this.w - 1, Math.floor((y + r) / this.cell));
    const r2 = r * r;
    for (let cy = y0; cy <= y1; cy++)
      for (let cx = x0; cx <= x1; cx++) {
        const list = this.cells[cy * this.w + cx];
        for (let k = 0; k < list.length; k++) {
          const c = citizens[list[k]];
          if (!c || c.dead) continue;
          const dx = c.x - x, dy = c.y - y;
          if (dx * dx + dy * dy <= r2) fn(c);
        }
      }
  }
}
