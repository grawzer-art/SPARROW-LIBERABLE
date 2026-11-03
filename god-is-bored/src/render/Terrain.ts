import * as THREE from "three";
import { fbm, valueNoise } from "../sim/rng";
import type { World } from "../sim/World";
import { T } from "../sim/World";

export interface PathSeg { ax: number; ay: number; bx: number; by: number; w: number; col: number; }

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/**
 * Terrain doux : maillage indexé à haute résolution (hauteur bicubique), normales lissées, couleurs par sommet
 * interpolées entre les cases (aucune limite de case visible), bruit, pentes rocheuses, berges, sable mouillé,
 * occlusion ambiante cuite (forêts, bâtiments) et chemins de terre peints dans la matière.
 */
export class Terrain {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private W: number; // sommets par côté
  private R: number; // sous-divisions par case
  private N: number;
  private pos: Float32Array;
  private col: Float32Array;
  private nrm: Float32Array;
  private tileCol: Float32Array;
  private occ: Float32Array;
  private pathMask: Float32Array;
  private pathCol: Float32Array;
  private tmp = new THREE.Color();

  constructor(scene: THREE.Scene, N: number, mobile: boolean) {
    this.N = N;
    this.R = mobile ? 2 : 3;
    this.W = N * this.R + 1;
    const V = this.W * this.W;
    this.pos = new Float32Array(V * 3);
    this.col = new Float32Array(V * 3);
    this.nrm = new Float32Array(V * 3);
    this.tileCol = new Float32Array(N * N * 3);
    this.occ = new Float32Array(N * N);
    this.pathMask = new Float32Array(V);
    this.pathCol = new Float32Array(V * 3);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute("normal", new THREE.BufferAttribute(this.nrm, 3));
    const W = this.W;
    const idx = new Uint32Array((W - 1) * (W - 1) * 6);
    let k = 0;
    for (let j = 0; j < W - 1; j++)
      for (let i = 0; i < W - 1; i++) {
        const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
        if ((i + j) & 1) { idx.set([a, c, d, a, d, b], k); } else { idx.set([a, c, b, b, c, d], k); }
        k += 6;
      }
    this.geo.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mesh = new THREE.Mesh(this.geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 }));
    this.mesh.receiveShadow = true;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.geo.dispose();
  }

  /** Positions et normales (à refaire quand le relief change : météorite). */
  rebuildHeights(w: World): void {
    const { W, R, N } = this;
    for (let j = 0; j < W; j++)
      for (let i = 0; i < W; i++) {
        const x = i / R, y = j / R, o = (j * W + i) * 3;
        this.pos[o] = x - N / 2; this.pos[o + 1] = w.heightAt(x, y); this.pos[o + 2] = y - N / 2;
      }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.geo.computeVertexNormals();
    this.geo.computeBoundingSphere();
    this.geo.computeBoundingBox();
  }

  /** Couleur de base d'une case (avant interpolation) : matériaux naturels, légère teinte de territoire, feu, cendres, sol urbanisé. */
  private tileBase(w: World, i: number, ownerColor: number, urban: number, out: THREE.Color): void {
    const t = w.type[i], h = w.height[i], f = w.fertility[i];
    const x = i % this.N, y = (i / this.N) | 0;
    switch (t) {
      case T.WATER: out.setHex(0xcbbf94); break;
      case T.SAND: out.setHex(0xd9c795); break;
      case T.GRASS: {
        out.setHex(0x6f9d49).lerp(this.tmp.setHex(0x4f8040), Math.min(1, h / 1.6)).lerp(this.tmp.setHex(0xa59d58), Math.max(0, 0.5 - f) * 1.4);
        break;
      }
      case T.HILL: out.setHex(0x8f9a58).lerp(this.tmp.setHex(0x9a8f66), Math.min(1, (h - w.hillH) / 1.0)); break;
      case T.MOUNTAIN: out.setHex(0x8b857d).lerp(this.tmp.setHex(0xf0f2f4), smooth(2.9, 3.6, h)); break;
      default: out.setHex(0x7d6a4a); // berge de rivière : boue
    }
    if (t !== T.WATER) {
      if (w.scorch[i] > 0) out.lerp(this.tmp.setHex(0x2f2a26), Math.min(0.88, w.scorch[i] * 0.9));
      if (w.fire[i] > 0) out.lerp(this.tmp.setHex(0x40200e), 0.5);
      if (ownerColor >= 0) out.lerp(this.tmp.setHex(ownerColor), 0.075);
      if (urban > 0) {
        const e = (urban & 7) - 1, strong = (urban & 8) !== 0;
        out.lerp(this.tmp.setHex([0x8d7650, 0xb9ae8c, 0x938c80, 0x59574f, 0x6a6d72, 0xbcd0dc][e]), strong ? 0.58 : 0.26);
      }
    }
    void x; void y;
  }

  /**
   * Couleurs par sommet. `owner(i)` donne la couleur du propriétaire ou -1 ; `urban` : codes d'urbanisation par case ;
   * `paths` : chemins de terre peints dans le sol.
   */
  rebuildColors(w: World, owner: (i: number) => number, urban: Uint8Array, paths: PathSeg[]): void {
    const { W, R, N } = this;
    const c = new THREE.Color();
    for (let i = 0; i < N * N; i++) {
      this.tileBase(w, i, owner(i), urban[i] ?? 0, c);
      this.tileCol[i * 3] = c.r; this.tileCol[i * 3 + 1] = c.g; this.tileCol[i * 3 + 2] = c.b;
      // occlusion cuite : arbres et bâtiments assombrissent légèrement le sol autour d'eux
      this.occ[i] = Math.min(1, w.trees[i] * 0.12 + (w.bld[i] >= 0 ? 0.35 : 0));
    }
    // chemins
    this.pathMask.fill(0);
    for (const s of paths) {
      const x0 = Math.floor((Math.min(s.ax, s.bx) - s.w - 0.2) * R), x1 = Math.ceil((Math.max(s.ax, s.bx) + s.w + 0.2) * R);
      const y0 = Math.floor((Math.min(s.ay, s.by) - s.w - 0.2) * R), y1 = Math.ceil((Math.max(s.ay, s.by) + s.w + 0.2) * R);
      const dx = s.bx - s.ax, dy = s.by - s.ay, L2 = dx * dx + dy * dy || 1;
      this.tmp.setHex(s.col);
      for (let j = Math.max(0, y0); j <= Math.min(W - 1, y1); j++)
        for (let i = Math.max(0, x0); i <= Math.min(W - 1, x1); i++) {
          const px = i / R, py = j / R;
          const t = Math.max(0, Math.min(1, ((px - s.ax) * dx + (py - s.ay) * dy) / L2));
          const d = Math.hypot(px - (s.ax + dx * t), py - (s.ay + dy * t));
          const m = 1 - smooth(s.w * 0.55, s.w, d);
          const o = j * W + i;
          if (m > this.pathMask[o]) { this.pathMask[o] = m; this.pathCol[o * 3] = this.tmp.r; this.pathCol[o * 3 + 1] = this.tmp.g; this.pathCol[o * 3 + 2] = this.tmp.b; }
        }
    }
    const tc = this.tileCol, nrm = this.geo.attributes.normal.array as Float32Array;
    const rock = new THREE.Color(0x8a847b), shoreWet = new THREE.Color(0xb7ab80), foam = new THREE.Color(0xe9efe6), teal = new THREE.Color(0x3f8fa0), deep = new THREE.Color(0x1c4a66), sandy = new THREE.Color(0xc4ba92);
    const col = new THREE.Color();
    for (let j = 0; j < W; j++)
      for (let i = 0; i < W; i++) {
        const o = j * W + i;
        const x = i / R, y = j / R;
        const h = this.pos[o * 3 + 1];
        // interpolation bilinéaire entre centres de cases : transitions naturelles
        const u = Math.max(0, Math.min(N - 1.001, x - 0.5)), v = Math.max(0, Math.min(N - 1.001, y - 0.5));
        const i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
        const A = (j0 * N + i0) * 3, B = A + 3, C = ((j0 + 1) * N + i0) * 3, D = C + 3;
        let r = 0, g = 0, b = 0;
        for (let k = 0; k < 3; k++) {
          const val = (tc[A + k] * (1 - fu) + tc[B + k] * fu) * (1 - fv) + (tc[C + k] * (1 - fu) + tc[D + k] * fu) * fv;
          if (k === 0) r = val; else if (k === 1) g = val; else b = val;
        }
        col.setRGB(r, g, b);
        // bruit : plaques de végétation et micro-variations
        const n1 = fbm(x * 0.55, y * 0.55, 31, 3) - 0.5, n2 = valueNoise(x * 4.2, y * 4.2, 77) - 0.5, n3 = valueNoise(x * 11, y * 11, 91) - 0.5;
        const lum = 1 + n1 * 0.32 + n2 * 0.14 + n3 * 0.06;
        col.r *= lum * (1 + n1 * 0.12); col.g *= lum * (1 - n1 * 0.05); col.b *= lum * (1 - n1 * 0.1);
        // pentes rocheuses
        const ny = nrm[o * 3 + 1];
        if (h > -0.02) {
          const slope = smooth(0.9, 0.66, ny);
          if (slope > 0) col.lerp(rock, slope * (0.75 + n2 * 0.4));
        }
        // sol dénudé sous les arbres
        const ox = Math.max(0, Math.min(N - 1.001, x - 0.5)), oy = Math.max(0, Math.min(N - 1.001, y - 0.5));
        const oi = Math.floor(ox), oj = Math.floor(oy);
        const occ = (this.occ[oj * N + oi] * (1 - (ox - oi)) + this.occ[oj * N + Math.min(N - 1, oi + 1)] * (ox - oi)) * (1 - (oy - oj)) + (this.occ[Math.min(N - 1, oj + 1) * N + oi] * (1 - (ox - oi)) + this.occ[Math.min(N - 1, oj + 1) * N + Math.min(N - 1, oi + 1)] * (ox - oi)) * (oy - oj);
        col.multiplyScalar(1 - 0.22 * occ);
        // eau : fond sableux -> turquoise -> bleu profond ; berge mouillée et écume
        if (h < 0.12) {
          const depth = Math.max(0, -h);
          if (h < -0.02) { col.copy(sandy).lerp(teal, smooth(0.0, 0.35, depth)).lerp(deep, smooth(0.3, 1.2, depth)); col.multiplyScalar(1 + n2 * 0.1); }
          else col.lerp(shoreWet, smooth(0.12, -0.02, h) * 0.75);
          const fz = 1 - Math.min(1, Math.abs(h + 0.03) / 0.07);
          if (fz > 0) col.lerp(foam, fz * (0.35 + 0.35 * (valueNoise(x * 7, y * 7, 5) )));
        }
        // chemins de terre
        const pm = this.pathMask[o];
        if (pm > 0 && h > -0.02) { this.tmp.setRGB(this.pathCol[o * 3], this.pathCol[o * 3 + 1], this.pathCol[o * 3 + 2]); col.lerp(this.tmp, pm * (0.85 + n3 * 0.3)); }
        this.col[o * 3] = col.r; this.col[o * 3 + 1] = col.g; this.col[o * 3 + 2] = col.b;
      }
    (this.geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
  }
}
