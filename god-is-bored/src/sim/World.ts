import { MAP_SIZE } from "./config";
import { RNG, fbm, hash2 } from "./rng";

export const T = { WATER: 0, SAND: 1, GRASS: 2, HILL: 3, MOUNTAIN: 4, RIVER: 5 } as const;

/** Terrain : données pures (aucun objet Three.js). Source de vérité de la carte. */
export class World {
  readonly size = MAP_SIZE;
  seed = 0;
  seedUsed = 0;
  height: Float32Array;
  type: Uint8Array;
  trees: Uint8Array;
  maxTrees: Uint8Array;
  fertility: Float32Array;
  stone: Float32Array;
  owner: Int16Array;
  bld: Int32Array;
  fire: Uint8Array;
  scorch: Float32Array;
  corner: Float32Array;
  region: Int16Array;
  riv: Float32Array; // masque des rivières (1 = case de rivière), pour creuser le lit visuel
  hillH = 1.0;
  mtnH = 2.0;
  // versions pour que le rendu sache quand reconstruire
  terrainV = 1;
  treeV = 1;
  ownerV = 1;
  fireV = 1;

  constructor() {
    const n = this.size * this.size;
    this.height = new Float32Array(n);
    this.type = new Uint8Array(n);
    this.trees = new Uint8Array(n);
    this.maxTrees = new Uint8Array(n);
    this.fertility = new Float32Array(n);
    this.stone = new Float32Array(n);
    this.owner = new Int16Array(n).fill(-1);
    this.bld = new Int32Array(n).fill(-1);
    this.fire = new Uint8Array(n);
    this.scorch = new Float32Array(n);
    this.corner = new Float32Array((this.size + 1) * (this.size + 1));
    this.region = new Int16Array(n).fill(-1);
    this.riv = new Float32Array(n);
  }

  idx(x: number, y: number): number {
    return y * this.size + x;
  }
  inb(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }
  tileAt(x: number, y: number): number {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.inb(tx, ty)) return -1;
    return ty * this.size + tx;
  }
  passable(x: number, y: number): boolean {
    const i = this.tileAt(x, y);
    if (i < 0) return false;
    const t = this.type[i];
    return t !== T.WATER && t !== T.MOUNTAIN;
  }
  isLand(i: number): boolean {
    const t = this.type[i];
    return t !== T.WATER;
  }
  speedMult(x: number, y: number): number {
    const i = this.tileAt(x, y);
    if (i < 0) return 0;
    switch (this.type[i]) {
      case T.RIVER: return 0.5;
      case T.HILL: return 0.75;
      case T.SAND: return 0.9;
      default: return 1;
    }
  }

  recomputeCorners(): void {
    const n = this.size, m = n + 1;
    for (let cy = 0; cy <= n; cy++) {
      for (let cx = 0; cx <= n; cx++) {
        let s = 0, c = 0;
        for (let dy = -1; dy <= 0; dy++)
          for (let dx = -1; dx <= 0; dx++) {
            const tx = cx + dx, ty = cy + dy;
            if (tx >= 0 && ty >= 0 && tx < n && ty < n) {
              s += this.height[ty * n + tx];
              c++;
            }
          }
        this.corner[cy * m + cx] = s / c;
      }
    }
    for (let i = 0; i < n * n; i++) this.riv[i] = this.type[i] === T.RIVER ? 1 : 0;
    this.terrainV++;
  }

  /**
   * Hauteur de surface continue : interpolation bicubique (Catmull-Rom) des hauteurs de cases, avec lit de rivière creusé.
   * Aucune arête de case n'est visible : relief progressif, côtes et berges sinueuses. Le rendu et les entités utilisent
   * exactement cette fonction, donc personne ne flotte ni ne s'enfonce.
   */
  heightAt(x: number, y: number): number {
    const n = this.size;
    const u = Math.max(0, Math.min(n - 0.001, x)) - 0.5, v = Math.max(0, Math.min(n - 0.001, y)) - 0.5;
    const i0 = Math.floor(u), j0 = Math.floor(v);
    const fu = u - i0, fv = v - j0;
    const H = this.height, R = this.riv;
    const cl = (k: number) => (k < 0 ? 0 : k >= n ? n - 1 : k);
    const cr = (a: number, b: number, c: number, d: number, t: number) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
    const rows = [0, 0, 0, 0];
    for (let m = -1; m <= 2; m++) {
      const jj = cl(j0 + m) * n;
      rows[m + 1] = cr(H[jj + cl(i0 - 1)], H[jj + cl(i0)], H[jj + cl(i0 + 1)], H[jj + cl(i0 + 2)], fu);
    }
    let h = cr(rows[0], rows[1], rows[2], rows[3], fv);
    // lit de rivière : bilinéaire du masque, profil lissé
    const a0 = R[cl(j0) * n + cl(i0)], b0 = R[cl(j0) * n + cl(i0 + 1)], c0 = R[cl(j0 + 1) * n + cl(i0)], d0 = R[cl(j0 + 1) * n + cl(i0 + 1)];
    const rv = (a0 + (b0 - a0) * fu) * (1 - fv) + (c0 + (d0 - c0) * fu) * fv;
    if (rv > 0) { const k = rv * rv * (3 - 2 * rv); h -= Math.min(Math.max(h + 0.12, 0), 0.7) * k; }
    return h > 0 ? h * 1.4 : h; // relief un peu accentué : collines et montagnes lisibles
  }

  retype(i: number): void {
    const h = this.height[i];
    const prev = this.type[i];
    if (h < 0) this.type[i] = T.WATER;
    else if (h > this.mtnH) this.type[i] = T.MOUNTAIN;
    else if (h > this.hillH) this.type[i] = T.HILL;
    else if (prev === T.RIVER) this.type[i] = T.RIVER;
    else if (prev === T.SAND && h < 0.45) this.type[i] = T.SAND;
    else this.type[i] = T.GRASS;
  }

  /** Cratère de météorite : modifie réellement la carte. */
  crater(cx: number, cy: number, r: number, depth = 1.3): void {
    const n = this.size;
    const R = Math.ceil(r + 1);
    for (let y = Math.floor(cy) - R; y <= Math.floor(cy) + R; y++)
      for (let x = Math.floor(cx) - R; x <= Math.floor(cx) + R; x++) {
        if (!this.inb(x, y)) continue;
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > r + 0.8) continue;
        const i = y * n + x;
        if (d <= r) {
          const k = 1 - d / r;
          this.height[i] -= depth * Math.pow(k, 0.7);
          this.trees[i] = 0;
          this.fertility[i] *= 0.15;
          this.scorch[i] = 1;
          this.fire[i] = 0;
          this.stone[i] += 20;
          // un cratère profond devient un lac
          if (this.height[i] < 0.02 && this.type[i] !== T.WATER && k > 0.45) this.height[i] = -0.25 - 0.5 * k;
        } else {
          this.height[i] += 0.28; // lèvre du cratère
          this.scorch[i] = Math.max(this.scorch[i], 0.5);
        }
        this.retype(i);
      }
    this.recomputeCorners();
    this.treeV++;
    this.fireV++;
  }

  // -------------------- génération --------------------

  static generate(seed: number): World {
    for (let attempt = 0; attempt < 24; attempt++) {
      const w = new World();
      w.seed = seed;
      w.seedUsed = (seed + attempt * 7919) >>> 0;
      w.build(w.seedUsed);
      if (w.largestRegion() >= 1000) return w;
    }
    const w = new World();
    w.seed = seed;
    w.seedUsed = seed;
    w.build(seed);
    return w;
  }

  private build(seed: number): void {
    const n = this.size;
    const rng = new RNG(seed ^ 0x9e3779b9);
    const raw = new Float32Array(n * n);
    const s1 = (seed & 0xffff) + 11, s2 = ((seed >>> 8) & 0xffff) + 77;
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const nx = (x / (n - 1)) * 2 - 1, ny = (y / (n - 1)) * 2 - 1;
        const d = Math.max(Math.hypot(nx, ny), Math.max(Math.abs(nx), Math.abs(ny)) * 1.05);
        const fall = Math.pow(Math.max(0, (d - 0.5) / 0.6), 1.6);
        const e = fbm(x / 17, y / 17, s1, 4) * 0.8 + fbm(x / 6, y / 6, s2, 2) * 0.2;
        raw[y * n + x] = e + 0.22 - fall * 0.95;
      }
    const sorted = Array.from(raw).sort((a, b) => a - b);
    const sea = sorted[Math.floor(sorted.length * 0.42)];
    const landVals = sorted.filter((v) => v > sea);
    const p95 = landVals[Math.floor(landVals.length * 0.95)] ?? sea + 0.3;
    const p78 = landVals[Math.floor(landVals.length * 0.8)] ?? sea + 0.2;
    const k = 2.7 / Math.max(0.05, p95 - sea);
    this.hillH = (p78 - sea) * k;
    this.mtnH = 2.8;
    for (let i = 0; i < n * n; i++) {
      this.height[i] = raw[i] > sea ? (raw[i] - sea) * k + 0.02 : -0.15 - Math.min(0.9, (sea - raw[i]) * k * 0.8);
    }
    // types
    for (let i = 0; i < n * n; i++) this.type[i] = 0;
    for (let i = 0; i < n * n; i++) this.retype(i);
    // plages
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (this.type[i] !== T.GRASS || this.height[i] > 0.4) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = x + dx, ty = y + dy;
          if (this.inb(tx, ty) && this.type[ty * n + tx] === T.WATER) { this.type[i] = T.SAND; break; }
        }
      }
    // rivières : descendent des sommets vers la mer
    const peaks: number[] = [];
    for (let i = 0; i < n * n; i++) if (this.type[i] === T.HILL || this.type[i] === T.MOUNTAIN) peaks.push(i);
    const nRivers = 3 + rng.int(2);
    for (let r = 0; r < nRivers && peaks.length > 0; r++) {
      let cur = peaks[rng.int(peaks.length)];
      const visited = new Set<number>();
      for (let step = 0; step < 90; step++) {
        visited.add(cur);
        const cx = cur % n, cy = (cur / n) | 0;
        if (this.type[cur] === T.WATER) break;
        if (this.type[cur] !== T.MOUNTAIN) {
          this.type[cur] = T.RIVER;
          this.height[cur] = Math.max(0.03, this.height[cur] - 0.22);
        }
        let best = -1, bh = Infinity;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = cx + dx, ty = cy + dy;
          if (!this.inb(tx, ty)) continue;
          const j = ty * n + tx;
          if (visited.has(j)) continue;
          const hh = this.height[j] + rng.next() * 0.05;
          if (hh < bh) { bh = hh; best = j; }
        }
        if (best < 0) break;
        cur = best;
      }
    }
    // lacs
    for (let l = 0; l < 2; l++) {
      for (let tries = 0; tries < 40; tries++) {
        const x = 8 + rng.int(n - 16), y = 8 + rng.int(n - 16), i = y * n + x;
        if (this.type[i] !== T.GRASS || this.height[i] > 0.7) continue;
        let ok = true;
        for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3; dx++) {
          const t = this.type[(y + dy) * n + x + dx];
          if (t === T.WATER || t === T.MOUNTAIN) { ok = false; break; }
        }
        if (!ok) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 1 && rng.chance(0.6)) continue;
          const j = (y + dy) * n + x + dx;
          this.height[j] = -0.3; this.type[j] = T.WATER;
        }
        break;
      }
    }
    // fertilité, arbres, pierre
    const waterNear = new Float32Array(n * n);
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        let c = 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          const tx = x + dx, ty = y + dy;
          if (this.inb(tx, ty)) { const t = this.type[ty * n + tx]; if (t === T.WATER || t === T.RIVER) c++; }
        }
        waterNear[y * n + x] = Math.min(1, c / 10);
      }
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const i = y * n + x, t = this.type[i], h = this.height[i];
        let f = 0;
        if (t === T.GRASS || t === T.RIVER) f = 0.55 + 0.35 * waterNear[i] - Math.max(0, h - 0.8) * 0.25 + (fbm(x / 8, y / 8, s2 + 5, 2) - 0.5) * 0.5;
        else if (t === T.SAND) f = 0.18;
        else if (t === T.HILL) f = 0.3;
        this.fertility[i] = Math.max(0, Math.min(1, f));
        const forest = fbm(x / 7, y / 7, s1 + 900, 3);
        if ((t === T.GRASS || t === T.HILL) && h < 1.9) {
          if (forest > 0.52) this.maxTrees[i] = 2 + rng.int(4);
          else if (rng.chance(0.05)) this.maxTrees[i] = 1;
          this.trees[i] = this.maxTrees[i];
        }
        if (t === T.HILL) this.stone[i] = 120 + rng.int(80);
        else if (t === T.MOUNTAIN) this.stone[i] = 300;
      }
    this.recomputeCorners();
    this.computeRegions();
  }

  computeRegions(): void {
    const n = this.size;
    this.region.fill(-1);
    let id = 0;
    const stack: number[] = [];
    this.regionSizes = [];
    for (let i = 0; i < n * n; i++) {
      if (this.region[i] !== -1 || !this.passable((i % n) + 0.5, ((i / n) | 0) + 0.5)) continue;
      let count = 0;
      stack.push(i);
      this.region[i] = id;
      while (stack.length) {
        const c = stack.pop()!;
        count++;
        const cx = c % n, cy = (c / n) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const tx = cx + dx, ty = cy + dy;
          if (!this.inb(tx, ty)) continue;
          const j = ty * n + tx;
          if (this.region[j] === -1 && this.passable(tx + 0.5, ty + 0.5)) {
            this.region[j] = id;
            stack.push(j);
          }
        }
      }
      this.regionSizes.push(count);
      id++;
    }
  }
  regionSizes: number[] = [];
  largestRegion(): number {
    return this.regionSizes.length ? Math.max(...this.regionSizes) : 0;
  }
  largestRegionId(): number {
    let best = 0, bs = -1;
    this.regionSizes.forEach((s, i) => { if (s > bs) { bs = s; best = i; } });
    return best;
  }

  /** Choisit n sites de départ éloignés, sur la plus grande masse terrestre. */
  pickStartSites(count: number, rng: RNG): { x: number; y: number }[] {
    const n = this.size;
    const rid = this.largestRegionId();
    const cands: { x: number; y: number; s: number }[] = [];
    for (let y = 6; y < n - 6; y++)
      for (let x = 6; x < n - 6; x++) {
        const i = y * n + x;
        if (this.region[i] !== rid || this.type[i] !== T.GRASS || this.trees[i] > 0 || this.fertility[i] < 0.5) continue;
        let land = 0, trees = 0, tot = 0, fert = 0;
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
          const j = (y + dy) * n + x + dx; tot++;
          if (this.type[j] !== T.WATER) land++;
          if (this.trees[j] > 0) trees++;
          fert += this.fertility[j];
        }
        if (land / tot < 0.8 || trees < 2) continue;
        cands.push({ x, y, s: fert / tot + hash2(x, y, 5) * 0.2 });
      }
    const chosen: { x: number; y: number }[] = [];
    if (!cands.length) return chosen;
    cands.sort((a, b) => b.s - a.s);
    chosen.push(cands[rng.int(Math.min(12, cands.length))]);
    while (chosen.length < count) {
      let best: { x: number; y: number } | null = null, bd = -1;
      for (const c of cands) {
        const md = Math.min(...chosen.map((q) => Math.hypot(q.x - c.x, q.y - c.y)));
        const sc = md + c.s * 6;
        if (sc > bd) { bd = sc; best = c; }
      }
      if (!best) break;
      chosen.push(best);
    }
    return chosen.map((c) => ({ x: c.x, y: c.y }));
  }

  /** Repousse, feu, cicatrisation : appelé périodiquement. */
  slowTick(rng: RNG, rain: (x: number, y: number) => number): void {
    const n = this.size;
    let changed = false;
    for (let i = 0; i < n * n; i++) {
      const x = i % n, y = (i / n) | 0;
      if (this.scorch[i] > 0) this.scorch[i] = Math.max(0, this.scorch[i] - 0.004);
      const t = this.type[i];
      if (t === T.GRASS || t === T.RIVER || t === T.SAND) {
        const cap = t === T.GRASS || t === T.RIVER ? 0.9 : 0.2;
        if (this.fertility[i] < cap && this.scorch[i] < 0.3) {
          this.fertility[i] = Math.min(cap, this.fertility[i] + 0.004 * rain(x + 0.5, y + 0.5));
        }
      }
      if (this.maxTrees[i] > 0 && this.trees[i] < this.maxTrees[i] && this.fire[i] === 0 && rng.chance(0.04)) {
        this.trees[i]++;
        changed = true;
      }
    }
    if (changed) this.treeV++;
  }

  /** Propagation du feu. Retourne les tuiles qui brûlent (pour dégâts aux bâtiments). */
  fireTick(rng: RNG): void {
    const n = this.size;
    let any = false;
    const ignite: number[] = [];
    for (let i = 0; i < n * n; i++) {
      if (this.fire[i] === 0) continue;
      any = true;
      this.fire[i]--;
      if (this.trees[i] > 0 && rng.chance(0.12)) { this.trees[i]--; this.treeV++; }
      this.scorch[i] = Math.min(1, this.scorch[i] + 0.05);
      this.fertility[i] = Math.max(0, this.fertility[i] - 0.004);
      if (this.fire[i] === 0) { this.fireV++; continue; }
      const x = i % n, y = (i / n) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const tx = x + dx, ty = y + dy;
        if (!this.inb(tx, ty)) continue;
        const j = ty * n + tx;
        if (this.fire[j] === 0 && (this.trees[j] > 0 || this.bld[j] >= 0) && this.type[j] !== T.WATER && rng.chance(0.03)) ignite.push(j);
      }
    }
    for (const j of ignite) { this.fire[j] = 40 + rng.int(40); any = true; this.fireV++; }
    if (any) this.treeV += 0; // les arbres changent via trees[]
  }
}
