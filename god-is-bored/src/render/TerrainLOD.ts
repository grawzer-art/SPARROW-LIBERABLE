import * as THREE from "three";
import { Geo, type GeoSample } from "../sim/Geo";
import type { Planet, Vec3 } from "../sim/Planet";
import { TILE_RAD } from "../sim/scale";
import { GRID, buildChunkData, faceDir, nodeSize, nodeUV, type ChunkData } from "../sim/terrainChunk";
import TerrainWorker from "./terrain.worker?worker&inline";

const MAX_LEVEL = 9;
/** Finesse minimale partout : un globe lisse (cases de ≈ 0,012 rad) même vu de loin. */
const MIN_LEVEL = 3;
interface Chunk { mesh: THREE.Mesh; used: number; }

/**
 * Terrain multi-échelle de la planète : quadtree sur une sphère « cube », tuiles générées à la demande (worker) depuis la géographie continue.
 * Le globe, le continent, la région et les abords des villages sont UN SEUL maillage à niveaux de détail : zoomer ne change jamais la géographie,
 * seulement la finesse. Les tuiles ne sont chargées que près de la caméra, réutilisées (cache LRU) et culling (frustum + horizon) ;
 * les fissures entre niveaux sont masquées par des jupes. Le relief est déplacé dans le vertex shader (exagération verticale pilotée par le zoom) ;
 * l'océan est dessiné par le shader lui-même (côte nette à toute échelle) : pas de sphère d'eau séparée.
 */
export class TerrainLOD {
  readonly group = new THREE.Group();
  readonly geo: Geo;
  readonly uniforms = { uExag: { value: 1.4 }, uTile: { value: TILE_RAD }, uHoleC: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uHoleE: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) }, uHoleS: { value: Array.from({ length: 8 }, () => new THREE.Vector4()) } };
  stats = { chunks: 0, drawn: 0, tris: 0, pending: 0, builtTotal: 0, workers: 0 };
  private chunks = new Map<string, Chunk>();
  private wanted = new Map<string, { face: number; level: number; i: number; j: number; pri: number }>();
  private inflight = new Set<string>();
  private worker: Worker | null = null;
  private frame = 0;
  private material: THREE.MeshStandardMaterial;
  private index: THREE.BufferAttribute;
  private visible: Chunk[] = [];
  private maxChunks: number;
  private splitK: number;
  private tmpV = new THREE.Vector3();
  private smp: GeoSample = { h: 0, riv: 0, bio: 0, hp: 0 };

  constructor(private planet: Planet, mobile: boolean) {
    this.geo = new Geo(planet);
    this.maxChunks = mobile ? 360 : 700;
    this.splitK = mobile ? 3.4 : 5;
    // index commun à toutes les tuiles : grille + jupes
    const G = GRID, idx: number[] = [];
    for (let b = 0; b < G - 1; b++) for (let a = 0; a < G - 1; a++) { const v00 = b * G + a, v10 = v00 + 1, v01 = v00 + G, v11 = v01 + 1; idx.push(v00, v10, v01, v10, v11, v01); }
    const base = G * G;
    for (let e = 0; e < 4; e++) for (let t = 0; t < G - 1; t++) {
      const m0 = this.edgeVertex(e, t), m1 = this.edgeVertex(e, t + 1), s0 = base + e * G + t, s1 = base + e * G + t + 1;
      if (e === 0 || e === 3) idx.push(m0, s0, m1, m1, s0, s1); else idx.push(m0, m1, s0, m1, s1, s0);
    }
    this.index = new THREE.BufferAttribute(new Uint16Array(idx), 1);
    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    this.material.onBeforeCompile = (sh) => {
      sh.uniforms.uExag = this.uniforms.uExag; sh.uniforms.uTile = this.uniforms.uTile; sh.uniforms.uHoleC = this.uniforms.uHoleC; sh.uniforms.uHoleE = this.uniforms.uHoleE; sh.uniforms.uHoleS = this.uniforms.uHoleS;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aH; attribute float aRiv; attribute float aSkirt; attribute float aTree; uniform float uExag; uniform float uTile; uniform vec4 uHoleC[8]; uniform vec4 uHoleE[8]; uniform vec4 uHoleS[8]; varying float vH; varying float vRiv; varying float vTree; varying vec3 vDir;")
        .replace("#include <begin_vertex>", `vH = aH; vRiv = aRiv; vTree = aTree; vDir = normalize(position);
float hole = 0.0;
for (int i = 0; i < 8; i++) { float cy = dot(vDir, uHoleC[i].xyz); if (cy > 0.2 && uHoleC[i].w > 0.0) { float X = dot(vDir, uHoleE[i].xyz) / cy, Z = dot(vDir, uHoleS[i].xyz) / cy; if (abs(X) < uHoleC[i].w && abs(Z) < uHoleC[i].w) hole = 1.0; } }
vec3 transformed = vDir * (1.0 + max(aH, 0.0) * uTile * uExag - aSkirt - hole * 0.004);`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uTile; varying float vH; varying float vRiv; varying float vTree; varying vec3 vDir; float hsh(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }")
        .replace("#include <color_fragment>", `#include <color_fragment>
{
  float depth = max(-vH, 0.0);
  float water = smoothstep(0.0, 0.03, depth);
  vec3 wc = mix(vec3(0.23, 0.66, 0.74), vec3(0.06, 0.25, 0.46), smoothstep(0.08, 1.7, depth));
  float foam = 1.0 - smoothstep(0.0, 0.16, abs(vH));
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.79, 0.55), clamp((1.0 - smoothstep(0.03, 0.2, vH)) * step(0.0, vH), 0.0, 1.0) * 0.9);
  diffuseColor.rgb = mix(diffuseColor.rgb, wc, water);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.97, 0.96), foam * 0.3 * (1.0 - water * 0.4));
  // canopée procédurale : points sombres au rythme des cases, estompés quand ils deviennent plus petits qu'un pixel (pas de scintillement)
  if (vTree > 0.04 && water < 0.5) {
    vec3 q = vDir / (uTile * 2.2);
    float fade = 1.0 - smoothstep(0.25, 0.8, length(fwidth(q)));
    vec3 cell = floor(q);
    float r = hsh(cell);
    vec3 f = fract(q) - 0.5;
    float dotm = (1.0 - smoothstep(0.18, 0.5, length(f.xy + f.yz * 0.5))) * step(1.0 - vTree * 0.85, r);
    vec3 canopy = vec3(0.12, 0.34, 0.16) * (0.75 + 0.5 * hsh(cell + 7.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, canopy, dotm * fade * 0.85);
  }
}`);
    };
    this.tryWorker();
    // les 6 tuiles racine sont indispensables (aucun trou possible) : générées tout de suite
    for (let f = 0; f < 6; f++) this.install(`${f}:0:0:0`, f, 0, 0, 0, buildChunkData(this.geo, f, 0, 0, 0));
  }

  private tryWorker(): void {
    try {
      this.worker = new TerrainWorker();
      this.worker.postMessage({ type: "init", seed: this.planet.seed, gen: this.planet.gen });
      this.worker.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.type !== "chunk") return;
        this.inflight.delete(m.key);
        const [f, l, i, j] = (m.key as string).split(":").map(Number);
        this.install(m.key, f, l, i, j, { h: m.h, riv: m.riv, col: m.col, tree: m.tree });
      };
      this.worker.onerror = () => { this.worker = null; this.inflight.clear(); this.stats.workers = 0; };
      this.stats.workers = 1;
    } catch { this.worker = null; }
  }

  private edgeVertex(e: number, t: number): number {
    const G = GRID;
    return e === 0 ? t : e === 1 ? (G - 1) * G + t : e === 2 ? t * G : t * G + (G - 1);
  }

  private install(key: string, face: number, level: number, i: number, j: number, d: ChunkData): void {
    if (this.chunks.has(key)) return;
    const G = GRID, n = G * G, total = n + 4 * G;
    const pos = new Float32Array(total * 3), aH = new Float32Array(total), aRiv = new Float32Array(total), col = new Float32Array(total * 3), aSk = new Float32Array(total), aTr = new Float32Array(total);
    const { u0, u1, v0, v1 } = nodeUV(level, i, j), dir: Vec3 = [0, 0, 0];
    for (let b = 0; b < G; b++) for (let a = 0; a < G; a++) {
      faceDir(face, u0 + ((u1 - u0) * a) / (G - 1), v0 + ((v1 - v0) * b) / (G - 1), dir);
      const o = b * G + a;
      pos[o * 3] = dir[0]; pos[o * 3 + 1] = dir[1]; pos[o * 3 + 2] = dir[2];
      aH[o] = d.h[o]; aRiv[o] = d.riv[o]; aTr[o] = d.tree[o];
      col[o * 3] = d.col[o * 3]; col[o * 3 + 1] = d.col[o * 3 + 1]; col[o * 3 + 2] = d.col[o * 3 + 2];
    }
    const drop = nodeSize(level) * 0.015;
    for (let e = 0; e < 4; e++) for (let t = 0; t < G; t++) {
      const m = this.edgeVertex(e, t), s = n + e * G + t;
      pos.copyWithin(s * 3, m * 3, m * 3 + 3); col.copyWithin(s * 3, m * 3, m * 3 + 3);
      aH[s] = aH[m]; aRiv[s] = aRiv[m]; aTr[s] = aTr[m]; aSk[s] = drop;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("aH", new THREE.BufferAttribute(aH, 1));
    g.setAttribute("aRiv", new THREE.BufferAttribute(aRiv, 1));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    g.setAttribute("aSkirt", new THREE.BufferAttribute(aSk, 1));
    g.setAttribute("aTree", new THREE.BufferAttribute(aTr, 1));
    g.setIndex(this.index);
    const mesh = new THREE.Mesh(g, this.material);
    mesh.frustumCulled = false; mesh.visible = false;
    this.group.add(mesh);
    this.chunks.set(key, { mesh, used: this.frame });
    this.stats.builtTotal++;
  }

  /** Sélectionne les tuiles à afficher pour cette caméra et lance le chargement des manquantes. */
  update(camera: THREE.PerspectiveCamera, frustum: THREE.Frustum): void {
    this.frame++;
    const cp = camera.position, camLen = cp.length(), camDir = this.tmpV.copy(cp).normalize();
    const minLevel = camLen - 1 > 2.2 ? MIN_LEVEL : MIN_LEVEL + 1; // vue continent : cases de ≈ 3 px
    const horizon = Math.acos(Math.min(1, 1 / Math.max(1.0001, camLen)));
    for (const c of this.visible) c.mesh.visible = false;
    this.visible.length = 0;
    this.wanted.clear();
    const center: Vec3 = [0, 0, 0], sph = new THREE.Sphere();
    const visit = (face: number, level: number, i: number, j: number): void => {
      const { u0, u1, v0, v1 } = nodeUV(level, i, j);
      faceDir(face, (u0 + u1) / 2, (v0 + v1) / 2, center);
      const size = nodeSize(level);
      // horizon : la tuile est-elle de l'autre côté de la planète ?
      const cosA = center[0] * camDir.x + center[1] * camDir.y + center[2] * camDir.z;
      if (Math.acos(Math.min(1, Math.max(-1, cosA))) > horizon + size * 0.9 + 0.06) return;
      sph.center.set(center[0], center[1], center[2]); sph.radius = size * 0.85 + 0.05;
      if (!frustum.intersectsSphere(sph)) return;
      const dx = cp.x - center[0], dy = cp.y - center[1], dz = cp.z - center[2];
      const dist = Math.max(0.0005, Math.hypot(dx, dy, dz) - size * 0.5);
      const key = `${face}:${level}:${i}:${j}`;
      if (level < MAX_LEVEL && (level < minLevel || size * this.splitK > dist)) {
        let ready = true;
        for (let k = 0; k < 4; k++) {
          const ci = i * 2 + (k & 1), cj = j * 2 + (k >> 1), ck = `${face}:${level + 1}:${ci}:${cj}`;
          if (!this.chunks.has(ck)) { ready = false; if (!this.inflight.has(ck) && !this.wanted.has(ck)) this.wanted.set(ck, { face, level: level + 1, i: ci, j: cj, pri: dist }); }
        }
        if (ready) { for (let k = 0; k < 4; k++) visit(face, level + 1, i * 2 + (k & 1), j * 2 + (k >> 1)); return; }
      }
      const ch = this.chunks.get(key);
      if (ch) { ch.mesh.visible = true; ch.used = this.frame; this.visible.push(ch); }
    };
    for (let f = 0; f < 6; f++) visit(f, 0, 0, 0);
    this.dispatch();
    this.evict();
    this.stats.chunks = this.chunks.size; this.stats.drawn = this.visible.length; this.stats.tris = this.visible.length * (GRID - 1) * (GRID - 1) * 2 + this.visible.length * 4 * (GRID - 1) * 2;
    this.stats.pending = this.inflight.size + this.wanted.size;
  }

  private dispatch(): void {
    if (!this.wanted.size) return;
    const list = [...this.wanted.entries()].sort((a, b) => a[1].pri - b[1].pri);
    if (this.worker) {
      let room = 8 - this.inflight.size;
      for (const [key, w] of list) { if (room-- <= 0) break; this.inflight.add(key); this.worker.postMessage({ type: "chunk", key, face: w.face, level: w.level, i: w.i, j: w.j }); }
    } else {
      // repli sans worker : une tuile par image (la plus proche)
      const [key, w] = list[0];
      this.install(key, w.face, w.level, w.i, w.j, buildChunkData(this.geo, w.face, w.level, w.i, w.j));
    }
  }

  private evict(): void {
    if (this.chunks.size <= this.maxChunks) return;
    const old = [...this.chunks.entries()].filter(([k, c]) => c.used < this.frame - 90 && k.split(":")[1] !== "0").sort((a, b) => a[1].used - b[1].used);
    for (const [k, c] of old) {
      if (this.chunks.size <= this.maxChunks * 0.85) break;
      if (k.split(":")[1] === "0") continue; // les racines restent
      this.group.remove(c.mesh); c.mesh.geometry.dispose(); this.chunks.delete(k);
    }
  }

  /** Cartes d'anciennes parties incrustées : le terrain continu est abaissé sous leur emprise (le maillage de la carte les remplace). */
  setHoles(holes: { c: Vec3; e: Vec3; s: Vec3; half: number }[]): void {
    for (let i = 0; i < 8; i++) {
      const h = holes[i];
      this.uniforms.uHoleC.value[i].set(h ? h.c[0] : 0, h ? h.c[1] : 0, h ? h.c[2] : 0, h ? h.half : 0);
      this.uniforms.uHoleE.value[i].set(h ? h.e[0] : 0, h ? h.e[1] : 0, h ? h.e[2] : 0, 0);
      this.uniforms.uHoleS.value[i].set(h ? h.s[0] : 0, h ? h.s[1] : 0, h ? h.s[2] : 0, 0);
    }
  }
  /** Altitude (cases) au point, à la finesse d'une case. */
  heightAt(d: Vec3): number { return this.geo.sample(d, TILE_RAD * 3, this.smp).h; }
  /** Rayon de la surface au point (planète de rayon 1) avec l'exagération courante. */
  radiusAt(d: Vec3): number { return 1 + Math.max(0, this.heightAt(d)) * TILE_RAD * this.uniforms.uExag.value; }

  dispose(): void {
    this.worker?.terminate();
    for (const c of this.chunks.values()) c.mesh.geometry.dispose();
    this.chunks.clear();
    this.material.dispose();
  }
}
