import * as THREE from "three";
import { hash2 } from "../sim/rng";
import { BIOME_NAME, dirOf, fbm3, frameAt, latLonOf, type Planet, type Region, type Vec3 } from "../sim/Planet";
import type { PlanetSim } from "../sim/PlanetSim";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { T } from "../sim/World";
import type { Renderer } from "./Renderer";
import { tileBaseColor } from "./Terrain";

export type PlanetMode = "planet" | "region";
export interface PlanetCard { kind: "continent" | "ocean" | "region" | "settlement" | "tile"; title: string; lines: string[]; actions: { id: string; label: string }[]; }
export interface LocalPose { region: number; x: number; y: number; dist: number; el: number; az: number; }
export interface PlanetHooks {
  card(c: PlanetCard | null): void;
  enterLocal(p: LocalPose): void;
  modeChanged(m: PlanetMode): void;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t: number) => t * t * (3 - 2 * t);
const V = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);

const SPACE = new THREE.Color(0x05070e), SKY = new THREE.Color(0x86a3c6);
const D_MIN = 1.5, DIST_MIN = 0.06;

/** Une région affichée sur le globe : relief réel (maillage dérivé de SA simulation), bâtiments, forêts, colonies, contour du territoire. */
interface Layer {
  region: Region; sim: SimulationEngine;
  patch: THREE.Mesh | null; hi: boolean; dirs: Float32Array; W: number; R: number;
  houses: THREE.InstancedMesh; trees: THREE.InstancedMesh; marks: THREE.Points; halos: THREE.Points; outline: THREE.LineLoop;
  sig: string; lastSync: number; nHouses: number; nTrees: number;
}

/**
 * Vue planétaire : globe stylisé (terrain, océan, atmosphère, nuages, étoiles) et régions tracées d'après le VRAI terrain de leur simulation.
 * Deux états : PLANET (globe entier, glisser = faire tourner sur 360°) et REGION (survol d'une région : même géométrie que la carte locale à
 * l'échelle, déformée sur la sphère). Le mode LOCAL est la scène 3D existante, gérée par `Renderer`.
 * Aucune donnée de simulation n'est stockée ici : colonies, bâtiments et arbres sont relus dans les moteurs de chaque région.
 */
export class PlanetView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.002, 60);
  mode: PlanetMode = "planet";
  active = false;
  private globe = new THREE.Group();
  private ps!: PlanetSim;
  private planet!: Planet;
  private layers = new Map<number, Layer>();
  private cur: Layer | null = null; // région survolée en mode REGION
  private land!: THREE.Mesh;
  private landBase = new Float32Array(0); // positions du relief avant enfoncement sous les régions dérivées
  private ocean!: THREE.Mesh;
  private clouds!: THREE.Mesh;
  private atmo!: THREE.Mesh;
  private stars!: THREE.Points;
  private ring: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private labelsEl: HTMLElement;
  private labels = new Map<string, HTMLElement>();
  private ray = new THREE.Raycaster();
  private deep = new THREE.Color(0x17506f);
  private houseGeo: THREE.BufferGeometry;
  private treeGeo: THREE.BufferGeometry;

  // état de vue
  private q = new THREE.Quaternion(); // orientation du globe en mode PLANET
  private D = 3.4; // distance caméra en mode PLANET
  private P: Vec3 = [0, 1, 0]; // point survolé en mode REGION (direction globale)
  private dist = 0.5; private el = 0.72; private az = Math.PI / 4;
  private vel = { ax: 0, ay: 0, w: 0 }; // inertie de rotation
  private tween: { t: number; dur: number; kind: "dive" | "ascend" | "focus"; fq: THREE.Quaternion; tq: THREE.Quaternion; fD: number; tD: number } | null = null;
  private time = 0;
  private ptrs = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; t: number } | null = null; private moved = 0; private multi = false;
  private pinch0 = 0; private twist0 = 0; private cy0 = 0;
  private introGoal = 0;
  private lock = 0;
  private sel: { kind: string; x: number; y: number; id: number; region: number; dir?: Vec3 } | null = null;
  stats = { buildings: 0, trees: 0, landTris: 0, patchTris: 0, drawCalls: 0, layers: 0 };

  private get portrait(): boolean { const el = this.r.three.domElement; return (el.clientWidth || 1) / (el.clientHeight || 1) < 0.9; }
  private get dMax(): number { return this.portrait ? 11 : 6; }
  private get dDefault(): number { return this.portrait ? 8 : 3.5; }
  private get distMax(): number { return this.portrait ? 1.8 : 1.0; }
  private get distDefault(): number { return this.portrait ? 1.3 : 0.55; }
  private get elDefault(): number { return this.portrait ? 0.95 : 0.72; }

  constructor(private r: Renderer, labelsParent: HTMLElement, private mobile: boolean, private hooks: PlanetHooks) {
    this.labelsEl = document.createElement("div");
    this.labelsEl.id = "plabels";
    labelsParent.appendChild(this.labelsEl);
    this.hemi = new THREE.HemisphereLight(0xb8d0ff, 0x1a2233, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.globe);
    const sp = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) { const z = hash2(i, 1, 9) * 2 - 1, a = hash2(i, 2, 9) * Math.PI * 2, q = Math.sqrt(1 - z * z); sp[i * 3] = q * Math.cos(a) * 40; sp[i * 3 + 1] = z * 40; sp[i * 3 + 2] = q * Math.sin(a) * 40; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8e2ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true }));
    this.scene.add(this.stars);
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 40), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uFade: { value: 1 } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform float uFade; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.7 - dot(vN, vec3(0.0,0.0,1.0))), 3.6); gl_FragColor = vec4(vec3(0.42,0.68,1.0)*i*1.05, i*0.7) * uFade; }",
    }));
    this.scene.add(this.atmo);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.03, 72, 44), new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, opacity: 0.6 }));
    this.globe.add(this.clouds);
    const paint = (g: THREE.BufferGeometry, c: number) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
    const house = new THREE.BoxGeometry(1, 0.7, 1); house.translate(0, 0.35, 0);
    const roof = new THREE.ConeGeometry(0.85, 0.6, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 1.0, 0);
    this.houseGeo = mergeGeos([paint(house.toNonIndexed(), 0xe9dcc0), paint(roof.toNonIndexed(), 0xd8d0c8)]);
    this.treeGeo = mergeGeos([paint(new THREE.ConeGeometry(0.55, 1.5, 5).translate(0, 0.9, 0).toNonIndexed(), 0x2f6b3a)]);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.ring.visible = false; this.ring.renderOrder = 20;
    this.globe.add(this.ring);
    this.bindInput();
  }

  // ------------------------------------------------------------------ construction

  /** (Re)construit le globe pour un monde planétaire : relief reproductible issu de la graine + une couche par région existante. */
  setPlanetSim(ps: PlanetSim): void {
    this.ps = ps;
    this.planet = ps.planet;
    for (const l of [...this.layers.values()]) this.disposeLayer(l);
    this.layers.clear(); this.cur = null;
    for (const m of [this.land, this.ocean]) if (m) { this.globe.remove(m); m.geometry.dispose(); }
    this.buildLand();
    this.buildOcean();
    this.buildClouds();
    this.ring.visible = false; this.sel = null;
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.syncLayers();
    const home = this.planet.regionById(ps.activeId) ?? this.planet.regions[0];
    this.facing(this.planet.regionCenter(home), true);
    this.D = this.dDefault;
    this.mode = "planet";
  }

  /** Arrivée dans l'espace : la caméra s'approche lentement de la planète. */
  intro(): void { this.introGoal = this.D; this.D = this.dMax; this.vel.w = 0; }

  private planetRadial(h: number): number { return h >= 0 ? 1 + Math.pow(h, 1.1) * 0.048 : 1 + Math.max(h, -0.6) * 0.02; }

  private buildLand(): void {
    const detail = this.mobile ? 24 : 34;
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n = pos.count, col = new Float32Array(n * 3);
    const c: [number, number, number] = [0, 0, 0];
    const cache = new Map<string, number>();
    const p = this.planet;
    this.landBase = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = `${Math.round(x * 4e5)},${Math.round(y * 4e5)},${Math.round(z * 4e5)}`;
      let h: number;
      const hit = cache.get(key);
      if (hit !== undefined) h = hit; else { h = p.heightWithRegions([x, y, z]); cache.set(key, h); }
      p.colorAt([x, y, z], h, c);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      const rad = this.planetRadial(h);
      pos.setXYZ(i, x * rad, y * rad, z * rad);
      this.landBase[i * 3] = x * rad; this.landBase[i * 3 + 1] = y * rad; this.landBase[i * 3 + 2] = z * rad;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    this.globe.add(this.land);
    this.stats.landTris = n / 3;
    const dc: [number, number, number] = [0, 0, 0];
    p.colorAt(p.regionCenter(p.regions[0]), -0.45, dc);
    this.deep.setRGB(dc[0], dc[1], dc[2]);
  }

  /** Le relief du globe passe sous les régions dérivées (leur maillage détaillé le remplace sur leur emprise). */
  private depressLand(region: Region): void {
    if (!region.derived || !this.land) return;
    const pos = this.land.geometry.attributes.position as THREE.BufferAttribute, base = this.landBase;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2];
      const len = Math.hypot(x, y, z), d: Vec3 = [x / len, y / len, z / len];
      const w = this.planet.regionWeight(region, d);
      if (w > 0) { const k = 1 - 0.007 * w / len; pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k); }
    }
    pos.needsUpdate = true;
  }

  private buildOcean(): void {
    this.ocean = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0x2f7fb0, transparent: true, opacity: 0.78, roughness: 0.5, metalness: 0.0, depthWrite: true }));
    this.ocean.renderOrder = 1;
    this.globe.add(this.ocean);
  }

  /** Nuages discrets : couverture partielle et peu opaque, pour ne jamais masquer les continents. */
  private buildClouds(): void {
    const W = 512, H = 256, data = new Uint8Array(W * H * 4);
    const s = this.planet.seed + 77;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2, lat = (j / H - 0.5) * Math.PI;
      const d = dirOf(lat, lon);
      const f = fbm3(d[0] * 2.6, d[1] * 2.6, d[2] * 2.6, s, 4), f2 = fbm3(d[0] * 6 + 5, d[1] * 6, d[2] * 6, s + 9, 2);
      const a = sstep(0.6, 0.8, f * 0.8 + f2 * 0.25);
      const o = (j * W + i) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = Math.round(a * 200);
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const m = this.clouds.material as THREE.MeshLambertMaterial;
    m.map?.dispose(); m.map = tex; m.needsUpdate = true;
  }

  /** Crée une couche pour chaque région qui possède une simulation (les régions jamais visitées n'ont aucune géométrie détaillée). */
  syncLayers(): void {
    for (const [id, eng] of this.ps.engines) {
      if (this.layers.has(id)) continue;
      const region = this.planet.regionById(id);
      if (region) this.makeLayer(region, eng);
    }
    this.stats.layers = this.layers.size;
  }

  private makeLayer(region: Region, sim: SimulationEngine): Layer {
    const houses = new THREE.InstancedMesh(this.houseGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 900);
    houses.count = 0; houses.frustumCulled = false;
    const trees = new THREE.InstancedMesh(this.treeGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), this.mobile ? 2200 : 4200);
    trees.count = 0; trees.frustumCulled = false;
    const mk = (size: number, color: number | null, opacity: number, test: boolean): THREE.Points => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
      g.setDrawRange(0, 0);
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: color === null, color: color ?? 0xffffff, transparent: true, opacity, depthTest: test }));
      p.frustumCulled = false;
      return p;
    };
    const halos = mk(17, 0x0a0d14, 0.55, true), marks = mk(10, null, 0.98, true);
    // contour du territoire habité : cadre doré fin sur l'emprise de la région (lisibilité des peuples sur le globe)
    const pts: number[] = [], N = region.size;
    for (let k = 0; k < 128; k++) {
      const t = k / 128, e = t * 4, side = Math.floor(e), u = (e - side) * N;
      const [x, y] = side === 0 ? [u, 0] : side === 1 ? [N, u] : side === 2 ? [N - u, N] : [0, N - u];
      const d = this.planet.localToDir(region, x, y);
      pts.push(d[0] * 1.004, d[1] * 1.004, d[2] * 1.004);
    }
    const og = new THREE.BufferGeometry(); og.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const outline = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: 0xf0cf86, transparent: true, opacity: 0.8, depthTest: true }));
    outline.visible = this.ps.isInhabited(sim);
    this.globe.add(houses, trees, halos, marks, outline);
    const layer: Layer = { region, sim, patch: null, hi: false, dirs: new Float32Array(0), W: 0, R: 1, houses, trees, marks, halos, outline, sig: "", lastSync: -9, nHouses: 0, nTrees: 0 };
    this.layers.set(region.id, layer);
    this.depressLand(region);
    this.buildPatch(layer, false);
    this.syncLayer(layer, true);
    return layer;
  }

  private disposeLayer(l: Layer): void {
    this.globe.remove(l.houses, l.trees, l.halos, l.marks, l.outline);
    for (const o of [l.houses, l.trees]) o.dispose();
    for (const o of [l.halos, l.marks]) o.geometry.dispose();
    l.outline.geometry.dispose();
    if (l.patch) { this.globe.remove(l.patch); l.patch.geometry.dispose(); }
  }

  /** Maillage de la région depuis SA simulation (altitudes et couleurs réelles), résolution basse (1/case) ou haute (2/case) selon la distance. */
  private buildPatch(l: Layer, hi: boolean): void {
    if (l.patch) { this.globe.remove(l.patch); l.patch.geometry.dispose(); }
    const N = l.sim.world.size, R = hi ? 2 : 1, W = N * R + 1, n = W * W;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = new Uint32Array((W - 1) * (W - 1) * 6);
    let k = 0;
    for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) {
      const a = j * W + i, b = a + 1, c = a + W, d = c + 1;
      if ((i + j) & 1) idx.set([a, c, d, a, d, b], k); else idx.set([a, c, b, b, c, d], k);
      k += 6;
    }
    pg.setIndex(new THREE.BufferAttribute(idx, 1));
    l.dirs = new Float32Array(n * 3); l.W = W; l.R = R; l.hi = hi;
    const f = frameAt(this.planet.regionCenter(l.region)), sr = this.planet.spanRad(l.region);
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const o = (j * W + i) * 3, a = (i / R / N - 0.5) * sr, b = (j / R / N - 0.5) * sr;
      const L = Math.hypot(Math.tan(a), 1, Math.tan(b)), vx = Math.tan(a) / L, vy = 1 / L, vz = Math.tan(b) / L;
      l.dirs[o] = f.e[0] * vx + f.c[0] * vy + f.s[0] * vz; l.dirs[o + 1] = f.e[1] * vx + f.c[1] * vy + f.s[1] * vz; l.dirs[o + 2] = f.e[2] * vx + f.c[2] * vy + f.s[2] * vz;
    }
    l.patch = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    l.patch.frustumCulled = false;
    this.globe.add(l.patch);
    this.fillPatch(l, true);
    if (hi) this.stats.patchTris = (idx.length / 3) | 0;
  }

  /** Positions (relief réel à l'échelle d'une case) et couleurs (biome, territoire, eau) ; le bord se fond dans le relief du globe. */
  private fillPatch(l: Layer, heights: boolean): void {
    const patch = l.patch;
    if (!patch) return;
    const w = l.sim.world, N = w.size, R = l.R, W = l.W, s = this.planet.tileScale(l.region);
    const pos = patch.geometry.attributes.position as THREE.BufferAttribute, col = patch.geometry.attributes.color as THREE.BufferAttribute;
    // couleur de base par case
    const tc = new Float32Array(N * N * 3), c = new THREE.Color(), tmp = new THREE.Color();
    const civ = l.sim.civById;
    const urban = new Uint8Array(N * N);
    for (const b of l.sim.buildings) if (b.hp >= 0 && b.progress >= 1 && b.civ >= 0 && b.type !== "farm" && w.inb(b.x, b.y)) urban[b.y * N + b.x] = (b.era + 1) | 8;
    for (let i = 0; i < N * N; i++) {
      const o = w.owner[i], cv = o >= 0 ? civ.get(o) : undefined;
      tileBaseColor(w, i, cv ? cv.color : -1, urban[i], c, tmp);
      // arbres : sol un peu plus sombre
      c.multiplyScalar(1 - Math.min(0.2, w.trees[i] * 0.04));
      tc[i * 3] = c.r; tc[i * 3 + 1] = c.g; tc[i * 3 + 2] = c.b;
    }
    const d = l.dirs, planetCol: [number, number, number] = [0, 0, 0];
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const o = j * W + i, x = i / R, y = j / R;
      const edge = Math.min(x, y, N - x, N - y), t = sstep(0, 9, edge);
      const h = heights ? w.heightAt(Math.min(N - 0.001, x), Math.min(N - 0.001, y)) : 0;
      // couleur : interpolation bilinéaire entre centres de cases
      const u = clamp(x - 0.5, 0, N - 1.001), v = clamp(y - 0.5, 0, N - 1.001), i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
      const A = (j0 * N + i0) * 3, B = A + 3, C = ((j0 + 1) * N + i0) * 3, D2 = C + 3;
      let r = 0, g = 0, b = 0;
      for (let q = 0; q < 3; q++) { const val = (tc[A + q] * (1 - fu) + tc[B + q] * fu) * (1 - fv) + (tc[C + q] * (1 - fu) + tc[D2 + q] * fu) * fv; if (q === 0) r = val; else if (q === 1) g = val; else b = val; }
      const hh = w.heightAt(Math.min(N - 0.001, x), Math.min(N - 0.001, y));
      if (hh < -0.05) { const k = sstep(0.1, 1.3, -hh); r = 0.25 + (this.deep.r - 0.25) * k; g = 0.61 + (this.deep.g - 0.61) * k; b = 0.69 + (this.deep.b - 0.69) * k; }
      let er = this.deep.r, eg = this.deep.g, eb = this.deep.b, edgeRad = 1 - 0.012;
      if (t < 1) {
        if (l.region.derived) { // le bord rejoint exactement le relief et la couleur du globe voisin
          const pd: Vec3 = [d[o * 3], d[o * 3 + 1], d[o * 3 + 2]], ph = this.planet.height(pd);
          this.planet.colorAt(pd, ph, planetCol); er = planetCol[0]; eg = planetCol[1]; eb = planetCol[2];
          edgeRad = this.planetRadial(ph) - 0.002;
        }
        r += (er - r) * (1 - t); g += (eg - g) * (1 - t); b += (eb - b) * (1 - t);
      }
      col.setXYZ(o, r, g, b);
      if (heights) {
        const rad = edgeRad + ((1 + h * s) - edgeRad) * t;
        pos.setXYZ(o, d[o * 3] * rad, d[o * 3 + 1] * rad, d[o * 3 + 2] * rad);
      }
    }
    col.needsUpdate = true;
    if (heights) { pos.needsUpdate = true; patch.geometry.computeVertexNormals(); }
  }

  /** Relit le moteur de la région : bâtiments, forêts, colonies. Seulement si l'état a changé et à intervalle réduit. */
  private syncLayer(l: Layer, force: boolean): void {
    const sim = l.sim, w = sim.world;
    const sig = `${w.terrainV}:${w.ownerV}:${w.fireV}:${w.treeV}:${sim.stats.buildingsBuilt}:${sim.stats.upgrades}:${sim.stats.buildingsLost}:${sim.buildings.length}:${sim.cities.length}`;
    const every = l === this.cur ? 1.2 : 3;
    if (!force && (sig === l.sig || this.time - l.lastSync < every)) return;
    const heightsChanged = !l.sig || l.sig.split(":")[0] !== String(w.terrainV);
    l.sig = sig; l.lastSync = this.time;
    l.outline.visible = this.ps.isInhabited(sim);
    this.fillPatch(l, heightsChanged);
    this.syncInstances(l);
    this.syncMarks(l);
  }

  private syncInstances(l: Layer): void {
    const sim = l.sim, w = sim.world, s = this.planet.tileScale(l.region), N = w.size;
    const up = new THREE.Vector3(), xa = new THREE.Vector3(), za = new THREE.Vector3(), m = new THREE.Matrix4(), col = new THREE.Color();
    const east = V(frameAt(this.planet.regionCenter(l.region)).e);
    let n = 0;
    for (const b of sim.buildings) {
      if (b.hp < 0 || b.progress < 1 || b.civ < 0 || n >= l.houses.instanceMatrix.count) continue;
      const civ = sim.civById.get(b.civ);
      const cx = b.x + 0.5, cy = b.y + 0.5, h = Math.max(0, w.heightAt(cx, cy));
      const d = this.planet.localToDir(l.region, cx, cy);
      up.set(d[0], d[1], d[2]);
      xa.copy(east).addScaledVector(up, -east.dot(up)).normalize();
      za.crossVectors(xa, up);
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      const x2 = xa.clone().multiplyScalar(c).addScaledVector(za, -sn), z2 = xa.clone().multiplyScalar(sn).addScaledVector(za, c);
      const big = (b.type === "hall" || b.type === "castle" ? 1.7 : b.type === "temple" ? 1.4 : b.type === "farm" ? 1.0 : 0.95) * 1.25;
      const flat = b.type === "farm" ? 0.07 : 1;
      const tall = b.type === "farm" ? 1 : 0.8 + b.era * 0.28 + (b.type === "hall" || b.type === "castle" ? 0.6 : 0);
      m.makeBasis(x2, up, z2);
      m.scale(new THREE.Vector3(s * big * (b.type === "farm" ? 1.25 : 1), s * big * tall * flat, s * big * (b.type === "farm" ? 1.25 : 1)));
      m.setPosition(d[0] * (1 + h * s), d[1] * (1 + h * s), d[2] * (1 + h * s));
      l.houses.setMatrixAt(n, m);
      col.setHex(b.type === "farm" ? 0xb69a50 : civ ? civ.color : 0x888888).lerp(new THREE.Color(0xffffff), b.type === "farm" ? 0 : 0.5);
      l.houses.setColorAt(n, col);
      n++;
    }
    l.houses.count = n; l.houses.instanceMatrix.needsUpdate = true; if (l.houses.instanceColor) l.houses.instanceColor.needsUpdate = true;
    l.nHouses = n;
    let t = 0;
    const cap = l.trees.instanceMatrix.count;
    for (let ty = 0; ty < N && t < cap; ty++) for (let tx = 0; tx < N && t < cap; tx++) {
      const cnt = w.trees[ty * N + tx];
      if (!cnt || w.type[ty * N + tx] === T.WATER) continue;
      for (let k = 0; k < Math.min(cnt, 2) && t < cap; k++) {
        const cx = tx + 0.15 + hash2(tx, ty, k * 3 + 1) * 0.7, cy = ty + 0.15 + hash2(tx, ty, k * 3 + 2) * 0.7, h = Math.max(0, w.heightAt(cx, cy));
        const d = this.planet.localToDir(l.region, cx, cy);
        up.set(d[0], d[1], d[2]); xa.copy(east).addScaledVector(up, -east.dot(up)).normalize(); za.crossVectors(xa, up);
        m.makeBasis(xa, up, za);
        const sc = s * (0.9 + hash2(tx, ty, k + 9) * 0.8);
        m.scale(new THREE.Vector3(sc, sc * (0.9 + hash2(tx, ty, k + 4) * 0.5), sc));
        m.setPosition(d[0] * (1 + h * s), d[1] * (1 + h * s), d[2] * (1 + h * s));
        l.trees.setMatrixAt(t, m);
        const bio = w.biome[ty * N + tx];
        // teinte : jungle/forêt plus vertes, taïga bleutée, savane/toundra pâles
        if (bio === 8) col.setRGB(0.55 + hash2(tx, ty, k + 21) * 0.25, 0.8, 0.85); else if (bio === 4 || bio === 9) col.setRGB(1.25, 1.2, 0.8); else col.setRGB(0.7 + hash2(tx, ty, k + 21) * 0.5, 0.85 + hash2(tx, ty, k + 22) * 0.35, 0.7 + hash2(tx, ty, k + 23) * 0.4);
        l.trees.setColorAt(t, col);
        t++;
      }
    }
    l.trees.count = t; l.trees.instanceMatrix.needsUpdate = true; if (l.trees.instanceColor) l.trees.instanceColor.needsUpdate = true;
    l.nTrees = t;
  }

  private syncMarks(l: Layer): void {
    const st = this.planet.settlements(l.sim, l.region).slice(0, 64);
    const c = new THREE.Color();
    for (const pts of [l.marks, l.halos]) {
      const pos = pts.geometry.attributes.position as THREE.BufferAttribute, col = pts.geometry.attributes.color as THREE.BufferAttribute;
      st.forEach((s, i) => {
        const h = Math.max(0, l.sim.world.heightAt(s.x, s.y)), d = this.planet.localToDir(l.region, s.x, s.y), rad = 1 + h * this.planet.tileScale(l.region) + 0.004;
        pos.setXYZ(i, d[0] * rad, d[1] * rad, d[2] * rad);
        c.setHex(s.color); col.setXYZ(i, c.r, c.g, c.b);
      });
      pos.needsUpdate = true; col.needsUpdate = true;
      pts.geometry.setDrawRange(0, st.length);
    }
  }

  // ------------------------------------------------------------------ états de vue

  private facingQuat(P: Vec3): THREE.Quaternion {
    const z = V(P).normalize(), x = new THREE.Vector3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = z.clone().cross(x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).invert();
  }
  private regionQuat(P: Vec3): THREE.Quaternion {
    const f = frameAt(P);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(f.e), V(f.c), V(f.s))).invert();
  }
  /** Recentre le globe sur un point (animation ou instantané), nord vers le haut. */
  facing(P: Vec3, instant: boolean): void {
    const tq = this.facingQuat(P);
    if (instant) { this.q.copy(tq); this.globe.quaternion.copy(tq); }
    else this.tween = { t: 0, dur: 0.7, kind: "focus", fq: this.globe.quaternion.clone(), tq, fD: this.D, tD: this.D };
  }

  private surfaceH(P: Vec3): number {
    const l = this.cur ? this.planet.dirToLocal(this.cur.region, P) : null;
    return l && this.cur ? Math.max(0, this.cur.sim.world.heightAt(clamp(l.x, 0, this.cur.region.size - 0.01), clamp(l.y, 0, this.cur.region.size - 0.01))) : 0;
  }
  private regionTarget(): THREE.Vector3 {
    const s = this.cur ? this.planet.tileScale(this.cur.region) : 0.007;
    return new THREE.Vector3(0, 1 + (this.surfaceH(this.P) + 0.2) * s, 0);
  }
  private regionCamPos(): THREE.Vector3 {
    return this.regionTarget().add(new THREE.Vector3(Math.cos(this.el) * Math.cos(this.az), Math.sin(this.el), Math.cos(this.el) * Math.sin(this.az)).multiplyScalar(this.dist));
  }

  /** Descend vers une région (existante ou à créer) avec un vol continu depuis le globe. */
  dive(regionId?: number, P?: Vec3, instant = false): void {
    if (!this.active) return;
    const layer = this.layerFor(regionId);
    if (!layer) return;
    this.cur = layer;
    if (!layer.hi) this.buildPatch(layer, true);
    const c = P ?? this.planet.regionCenter(layer.region);
    this.P = this.clampToRegion(layer, c);
    this.dist = this.distDefault; this.el = this.elDefault; this.az = Math.PI / 4;
    const toQ = this.regionQuat(this.P);
    this.hooks.card(null); this.ring.visible = false; this.sel = null;
    const fromQ = this.globe.quaternion.clone();
    this.mode = "region";
    this.hooks.modeChanged("region");
    this.lock = 1.2;
    if (instant) { this.tween = null; this.globe.quaternion.copy(toQ); this.applyCamera(); return; }
    this.tween = { t: 0, dur: 1.5, kind: "dive", fq: fromQ, tq: toQ, fD: this.D, tD: 0 };
  }

  private layerFor(regionId?: number): Layer | null {
    this.syncLayers();
    if (regionId !== undefined) return this.layers.get(regionId) ?? null;
    return this.cur ?? this.layers.get(this.ps.activeId) ?? [...this.layers.values()][0] ?? null;
  }

  /** Retour au globe (région au centre de l'écran). */
  ascend(instant = false): void {
    if (!this.active || !this.cur) return;
    const P = this.P, fromQ = this.globe.quaternion.clone(), toQ = this.facingQuat(P);
    this.q.copy(toQ);
    this.D = this.portrait ? 7.4 : 3.1;
    this.hooks.card(null); this.ring.visible = false; this.sel = null;
    this.mode = "planet";
    this.hooks.modeChanged("planet");
    this.lock = 1.2;
    if (instant) { this.tween = null; this.globe.quaternion.copy(toQ); this.applyCamera(); return; }
    this.tween = { t: 0, dur: 1.4, kind: "ascend", fq: fromQ, tq: toQ, fD: 0, tD: this.D };
  }

  /** Reprend la vue régionale à partir d'une pose locale : même point, azimut, distance élargie. */
  enterRegionFromLocal(p: LocalPose): void {
    const layer = this.layerFor(p.region);
    if (!layer) return;
    this.cur = layer;
    if (!layer.hi) this.buildPatch(layer, true);
    const s = this.planet.tileScale(layer.region);
    this.P = this.clampToRegion(layer, this.planet.localToDir(layer.region, p.x, p.y));
    this.dist = clamp(Math.max(p.dist * s, this.distDefault * 0.45), DIST_MIN * 1.15, this.distMax);
    this.el = clamp(p.el, 0.12, 1.45); this.az = p.az;
    this.mode = "region"; this.tween = null;
    this.ring.visible = false; this.sel = null; this.hooks.card(null);
    this.globe.quaternion.copy(this.regionQuat(this.P));
    this.hooks.modeChanged("region");
    this.lock = 1.0;
    this.applyCamera();
  }

  /** Pose locale équivalente à la vue régionale (mêmes axes, 1 case = 1 unité). */
  localPose(): LocalPose {
    const l = this.cur ? this.planet.dirToLocal(this.cur.region, this.P) : null, N = this.cur?.region.size ?? 64;
    const lx = l?.x ?? N / 2, ly = l?.y ?? N / 2;
    return { region: this.cur?.region.id ?? 1, x: clamp(lx, 2, N - 2), y: clamp(ly, 2, N - 2), dist: this.dist / (this.cur ? this.planet.tileScale(this.cur.region) : 0.007), el: this.el, az: this.az };
  }

  private clampToRegion(l: Layer, P: Vec3): Vec3 {
    const loc = this.planet.dirToLocal(l.region, P), N = l.region.size;
    if (!loc) return this.planet.regionCenter(l.region);
    const x = clamp(loc.x, -4, N + 4), y = clamp(loc.y, -4, N + 4);
    return x === loc.x && y === loc.y ? P : this.planet.localToDir(l.region, x, y);
  }

  activate(on: boolean): void {
    this.active = on;
    const t = this.r.three;
    if (on) { t.setClearColor(SPACE, 1); this.syncLayers(); for (const l of this.layers.values()) this.syncLayer(l, true); this.applyCamera(); this.labelsEl.style.display = "block"; }
    else { t.setClearColor(0x000000, 0); this.labelsEl.style.display = "none"; this.ptrs.clear(); this.down = null; }
  }

  // ------------------------------------------------------------------ boucle

  private applyCamera(): void {
    const cam = this.camera;
    if (this.mode === "planet" && !this.tween) {
      this.globe.quaternion.copy(this.q);
      cam.position.set(0, 0, this.D); cam.lookAt(0, 0, 0);
    } else if (this.mode === "region" && !this.tween) {
      this.globe.quaternion.copy(this.regionQuat(this.P));
      cam.position.copy(this.regionCamPos()); cam.lookAt(this.regionTarget());
    }
    const alt = cam.position.length();
    const air = this.mode === "planet" && !this.tween ? 1 : sstep(1.25, 2.4, alt);
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uFade.value = sstep(1.18, 1.9, alt);
    (this.clouds.material as THREE.MeshLambertMaterial).opacity = 0.6 * sstep(1.3, 1.9, alt);
    this.clouds.visible = alt > 1.3;
    (this.stars.material as THREE.PointsMaterial).opacity = air;
    this.r.three.setClearColor(SPACE.clone().lerp(SKY, 1 - air), 1);
    // lisibilité : repères d'habitation nets sur le globe, discrets près du sol
    const markA = sstep(0.5, 1.4, alt);
    for (const l of this.layers.values()) {
      (l.marks.material as THREE.PointsMaterial).opacity = markA * 0.98; (l.halos.material as THREE.PointsMaterial).opacity = markA * 0.55;
      l.marks.visible = l.halos.visible = markA > 0.02;
      (l.outline.material as THREE.LineBasicMaterial).opacity = 0.8 * sstep(1.3, 2.4, alt);
      l.outline.visible = this.ps.isInhabited(l.sim) && markA > 0.05 && this.mode === "planet" && !this.tween;
      // économie de rendu : à l'échelle du globe la couleur du biome suffit ; en vue régionale seules les forêts de la région survolée sont tracées
      l.trees.visible = alt < 2.5 && (this.mode !== "region" || l === this.cur);
    }
    const blend = 1 - air;
    const sd = new THREE.Vector3(-3.6, 2.0, 3.0).normalize().lerp(new THREE.Vector3(-0.45, 0.85, 0.3).normalize(), blend).normalize();
    this.sun.position.copy(sd.multiplyScalar(10)); this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 2.8 - 0.4 * blend; this.hemi.intensity = 0.7 + 0.6 * blend;
    cam.near = Math.max(0.0015, Math.min(0.1, (this.mode === "region" ? this.dist : alt - 1) * 0.03));
    cam.updateProjectionMatrix();
  }

  frame(dt: number): void {
    if (!this.active) return;
    this.time += dt;
    this.lock = Math.max(0, this.lock - dt);
    const el = this.r.three.domElement;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    if (Math.abs(this.camera.aspect - w / h) > 1e-3) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.syncLayers();
    for (const l of this.layers.values()) this.syncLayer(l, false);
    this.clouds.rotation.y += dt * 0.012;
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.globe.quaternion.slerpQuaternions(tw.fq, tw.tq, k);
      if (tw.kind === "dive") {
        const T1 = this.regionTarget(), c1 = this.regionCamPos(), c0 = new THREE.Vector3(0, 0, tw.fD);
        this.camera.position.lerpVectors(c0, c1, k);
        this.camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), T1, k));
      } else if (tw.kind === "ascend") {
        const T0 = this.regionTarget(), c0 = this.regionCamPos(), c1 = new THREE.Vector3(0, 0, tw.tD);
        this.camera.position.lerpVectors(c0, c1, k);
        this.camera.lookAt(new THREE.Vector3().lerpVectors(T0, new THREE.Vector3(0, 0, 0), k));
      }
      if (tw.t >= 1) {
        this.tween = null;
        if (tw.kind === "focus") this.q.copy(tw.tq);
        if (tw.kind === "ascend" && this.cur) { const old = this.cur; if (old.hi) this.buildPatch(old, false); }
      }
      this.applyCamera();
    } else {
      if (this.mode === "planet" && this.introGoal > 0) { this.D += (this.introGoal - this.D) * Math.min(1, dt * 1.3); this.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.12 * Math.min(1, (this.D - this.introGoal) / 1.5))); if (Math.abs(this.D - this.introGoal) < 0.02) this.introGoal = 0; }
      if (this.mode === "planet" && this.vel.w > 1e-4) {
        const dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(this.vel.ax, this.vel.ay, 0).normalize(), this.vel.w);
        this.q.premultiply(dq);
        this.vel.w *= Math.pow(0.9, dt * 60);
      } else this.vel.w = 0;
      this.applyCamera();
    }
    if (this.ring.visible) { const p = 1 + Math.sin(this.time * 4) * 0.06; this.ring.scale.setScalar((this.ring.userData.base as number) * p); }
    this.updateLabels();
    this.r.three.render(this.scene, this.camera);
    this.stats.drawCalls = this.r.three.info.render.calls;
    this.stats.buildings = [...this.layers.values()].reduce((s, l) => s + l.nHouses, 0);
    this.stats.trees = [...this.layers.values()].reduce((s, l) => s + l.nTrees, 0);
  }

  // ------------------------------------------------------------------ interaction

  private bindInput(): void {
    const el = this.r.three.domElement;
    el.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.vel.w = 0; this.introGoal = 0;
      if (this.ptrs.size === 1) { this.down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; this.moved = 0; this.multi = false; }
      else if (this.ptrs.size === 2) { this.multi = true; this.pinchInit(); }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      const p = this.ptrs.get(e.pointerId);
      if (!p || this.tween) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 1) {
        this.moved += Math.abs(dx) + Math.abs(dy);
        const rightBtn = e.buttons === 2 || e.shiftKey;
        if (this.mode === "planet") this.rotateGlobe(dx, dy);
        else if (rightBtn) { this.az -= dx * 0.006; this.el = clamp(this.el + dy * 0.005, 0.12, 1.45); }
        else this.panRegion(dx, dy);
      } else if (this.ptrs.size === 2) this.pinchMove();
    });
    const up = (e: PointerEvent, cancel: boolean) => {
      if (!this.active) return;
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size === 0) {
        const d = this.down; this.down = null;
        if (!cancel && d && !this.multi && this.moved < 14 && e.timeStamp - d.t < 600) this.tap(e.clientX, e.clientY);
        this.multi = false;
      } else if (this.ptrs.size === 1) this.pinchInit();
    };
    el.addEventListener("pointerup", (e) => up(e, false));
    el.addEventListener("pointercancel", (e) => up(e, true));
    el.addEventListener("wheel", (e) => { if (!this.active) return; e.preventDefault(); this.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }

  private pinchInit(): void {
    const pts = [...this.ptrs.values()];
    if (pts.length < 2) return;
    this.pinch0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    this.twist0 = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x);
    this.cy0 = (pts[0].y + pts[1].y) / 2;
  }
  private pinchMove(): void {
    const pts = [...this.ptrs.values()];
    const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), cy = (pts[0].y + pts[1].y) / 2;
    this.zoomBy(this.pinch0 / d);
    if (this.mode === "region") {
      let da = ang - this.twist0; da = Math.atan2(Math.sin(da), Math.cos(da));
      this.az -= da;
      this.el = clamp(this.el + (cy - this.cy0) * 0.004, 0.12, 1.45);
    }
    this.pinch0 = d; this.twist0 = ang; this.cy0 = cy;
  }

  zoomBy(f: number): void {
    if (this.tween) return;
    if (this.mode === "planet") {
      const nd = this.D * f;
      this.D = clamp(nd, D_MIN, this.dMax);
      // zoom maximal avec une région habitée ou visitée au centre : descente automatique
      if (nd < D_MIN * 0.97 && this.lock <= 0) {
        for (const l of this.layers.values()) {
          const fwd = V(this.planet.regionCenter(l.region)).applyQuaternion(this.globe.quaternion);
          if (fwd.z > 0.78) { this.dive(l.region.id); break; }
        }
      }
    } else {
      const nd = this.dist * f;
      this.dist = clamp(nd, DIST_MIN, this.distMax);
      if (this.lock <= 0 && nd < DIST_MIN * 0.9) this.hooks.enterLocal(this.localPose());
      else if (this.lock <= 0 && nd > this.distMax * 1.12) this.ascend();
    }
  }

  private rotateGlobe(dx: number, dy: number): void {
    const h = this.r.three.domElement.clientHeight || 800;
    const k = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * Math.max(0.6, this.D - 1) / h) * 1.25;
    const len = Math.hypot(dx, dy);
    if (len < 0.01) return;
    const ax = dy / len, ay = dx / len, ang = len * k;
    this.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(ax, ay, 0), ang));
    this.vel = { ax, ay, w: ang * 0.9 };
  }

  private panRegion(dx: number, dy: number): void {
    if (!this.cur) return;
    const h = this.r.three.domElement.clientHeight || 800;
    const wpp = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.dist) / h;
    const fx = -Math.cos(this.az), fz = -Math.sin(this.az);
    const rx = Math.sin(this.az), rz = -Math.cos(this.az);
    const mx = (-dx * rx + dy * fx) * wpp, mz = (-dx * rz + dy * fz) * wpp;
    const f = frameAt(this.P);
    const P2 = [this.P[0] + f.e[0] * mx + f.s[0] * mz, this.P[1] + f.e[1] * mx + f.s[1] * mz, this.P[2] + f.e[2] * mx + f.s[2] * mz] as Vec3;
    const len = Math.hypot(...P2);
    this.P = this.clampToRegion(this.cur, [P2[0] / len, P2[1] / len, P2[2] / len]);
  }

  private pickGlobeDir(cx: number, cy: number): Vec3 | null {
    const el = this.r.three.domElement, rect = el.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), this.camera);
    this.globe.updateMatrixWorld(true);
    const patches = [...this.layers.values()].filter((l) => l.patch && (this.mode === "region" ? l === this.cur : true)).map((l) => l.patch!) as THREE.Object3D[];
    if (this.mode === "region" && patches.length) {
      const hit = this.ray.intersectObjects(patches, false)[0];
      if (hit) { const p = this.globe.worldToLocal(hit.point.clone()).normalize(); return [p.x, p.y, p.z]; }
    }
    const o = this.ray.ray.origin, d = this.ray.ray.direction;
    const b = o.dot(d), c = o.lengthSq() - 1.03 * 1.03, disc = b * b - c;
    if (disc < 0) return null;
    const t = -b - Math.sqrt(disc);
    if (t < 0) return null;
    const p = this.globe.worldToLocal(o.clone().addScaledVector(d, t)).normalize();
    return [p.x, p.y, p.z];
  }

  private settlementNear(cx: number, cy: number): { id: number; x: number; y: number } | null {
    const l = this.cur;
    if (!l) return null;
    const el = this.r.three.domElement, rect = el.getBoundingClientRect(), v = new THREE.Vector3();
    let best: { id: number; x: number; y: number; d: number } | null = null;
    this.globe.updateMatrixWorld(true);
    for (const s of this.planet.settlements(l.sim, l.region)) {
      const h = Math.max(0, l.sim.world.heightAt(s.x, s.y)), sc = this.planet.tileScale(l.region), d = this.planet.localToDir(l.region, s.x, s.y), rad = 1 + (h + 0.8) * sc;
      v.set(d[0] * rad, d[1] * rad, d[2] * rad).applyMatrix4(this.globe.matrixWorld).project(this.camera);
      if (v.z > 1) continue;
      const px = rect.left + (v.x * 0.5 + 0.5) * rect.width, py = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      const dd = Math.hypot(px - cx, py - cy);
      if (dd < 44 && (!best || dd < best.d)) best = { id: s.id, x: s.x, y: s.y, d: dd };
    }
    return best;
  }

  private tap(cx: number, cy: number): void {
    const near = this.mode === "region" ? this.settlementNear(cx, cy) : null;
    let d = this.pickGlobeDir(cx, cy);
    if (!d && near && this.cur) d = this.planet.localToDir(this.cur.region, near.x, near.y);
    if (!d) { this.hooks.card(null); this.ring.visible = false; this.sel = null; return; }
    const pl = this.planet;
    if (this.mode === "planet") { this.tapPlanet(d); return; }
    const l = this.cur;
    if (!l) return;
    const sim = l.sim, r = l.region, loc = pl.dirToLocal(r, d), N = r.size;
    let best: { id: number; x: number; y: number; d: number } | null = near ? { id: near.id, x: near.x, y: near.y, d: 0 } : null;
    if (!best && loc) for (const s of pl.settlements(sim, r)) { const dd = Math.hypot(s.x - loc.x, s.y - loc.y); if (dd < 3.2 && (!best || dd < best.d)) best = { id: s.id, x: s.x, y: s.y, d: dd }; }
    if (best) {
      const city = sim.cityById.get(best.id)!, civ = sim.civById.get(city.civ);
      const nb = sim.buildings.filter((b) => b.city === city.id && b.progress >= 1 && b.civ >= 0).length;
      this.placeRing(pl.localToDir(r, best.x, best.y), 0.012);
      this.sel = { kind: "settlement", x: best.x, y: best.y, id: best.id, region: r.id };
      this.hooks.card({ kind: "settlement", title: city.name, lines: [`${civ?.name ?? "?"}${civ?.capital === city.id ? " · capitale" : ""} — ${r.name}`, `${city.pop} habitants · ${nb} bâtiments`, `Époque ${civ ? civ.era + 1 : "?"} · An ${sim.year}`], actions: [{ id: "enter", label: "Entrer dans le village" }] });
      return;
    }
    if (!loc) return;
    const tx = Math.floor(clamp(loc.x, 0, N - 1)), ty = Math.floor(clamp(loc.y, 0, N - 1)), i = ty * N + tx, w = sim.world;
    const owner = w.owner[i] >= 0 ? sim.civById.get(w.owner[i])?.name : undefined;
    const kind = ["Eau", "Sable", "Plaine", "Colline", "Montagne", "Rivière"][w.type[i]] ?? "Terrain";
    const bio = w.biome[i] > 0 ? BIOME_NAME[w.biome[i]] : kind;
    this.placeRing(pl.localToDir(r, tx + 0.5, ty + 0.5), 0.006);
    this.sel = { kind: "tile", x: tx + 0.5, y: ty + 0.5, id: -1, region: r.id };
    this.hooks.card({
      kind: "tile", title: bio === kind ? kind : `${bio} · ${kind}`, lines: [owner ? `Territoire de ${owner}` : "Terres libres", `Fertilité ${Math.round(w.fertility[i] * 100)} % · Arbres ${w.trees[i]} · Pierre ${Math.round(w.stone[i])}`], actions: w.type[i] === T.WATER ? [] : [{ id: "enter", label: "Descendre ici" }],
    });
  }

  /** Toucher sur le globe : région habitée/visitée (synthèse), n'importe quelle terre (région à explorer), ou océan. */
  private tapPlanet(d: Vec3): void {
    const pl = this.planet;
    const existing = pl.regionAt(d, 1);
    const layer = existing ? this.layers.get(existing.id) : undefined;
    if (existing && layer) {
      const sim = layer.sim, civs = sim.civs.filter((c) => c.alive);
      this.placeRing(pl.regionCenter(existing), 0.05);
      this.sel = { kind: "region", x: 0, y: 0, id: existing.id, region: existing.id };
      const lines = this.ps.isInhabited(sim)
        ? [`An ${sim.year} · ${sim.citizens.length} habitants · ${sim.cities.length} villes`, ...civs.map((c) => `${c.name} — ${c.pop} hab., ${sim.cities.filter((k) => k.civ === c.id).length} villes, ère ${c.era + 1}`)]
        : ["Région visitée, sans civilisation.", "Terrain, reliefs et modifications conservés."];
      this.hooks.card({ kind: "region", title: existing.name, lines, actions: [{ id: "dive", label: this.ps.isInhabited(sim) ? "Zoomer sur la région" : "Explorer la région" }] });
      return;
    }
    const h = pl.height(d), cont = pl.continentAt(d);
    this.placeRing(d, 0.06);
    if (h > 0.005) {
      const r = existing ?? pl.previewRegionAt(d);
      this.sel = { kind: "land", x: 0, y: 0, id: r?.id ?? -1, region: r?.id ?? -1, dir: d };
      this.hooks.card({
        kind: "continent", title: cont?.name ?? "Terres émergées",
        lines: [`${cont ? (cont.kind === "continent" ? "Continent" : "Île") + ` · ${cont.areaPct.toFixed(1)} % de la planète` : "Île"}`, `Ici : ${BIOME_NAME[pl.biomeOf(d, h)]}${r ? ` — ${r.name}` : ""}`, "Aucune civilisation connue — région libre à explorer."],
        actions: [{ id: "explore", label: "Explorer cette région" }],
      });
    } else {
      this.sel = { kind: "ocean", x: 0, y: 0, id: -1, region: -1 };
      this.hooks.card({ kind: "ocean", title: h < -0.3 ? "Fosse océanique" : "Océan", lines: ["Eaux ouvertes. Aucune terre à proximité immédiate."], actions: [] });
    }
    this.facing(d, false);
  }

  /** Action d'un bouton de la fiche. */
  action(id: string): void {
    if (id === "dive") { if (this.sel) this.dive(this.sel.region); else this.dive(); }
    else if (id === "explore") {
      const s = this.sel;
      if (!s || !s.dir) return;
      const r = this.planet.ensureRegionAt(s.dir);
      if (!r) return;
      this.ps.ensure(r.id); // la région est créée (terrain dérivé du globe) à la première visite
      this.syncLayers();
      this.dive(r.id, s.dir);
    } else if (id === "enter") {
      const s = this.sel;
      if (s && (s.kind === "settlement" || s.kind === "tile") && this.cur) {
        const N = this.cur.region.size;
        this.P = this.clampToRegion(this.cur, this.planet.localToDir(this.cur.region, clamp(s.x, 2, N - 2), clamp(s.y, 2, N - 2)));
        this.dist = Math.min(this.dist, 0.14);
      }
      this.hooks.enterLocal(this.localPose());
    }
  }

  /** Recentre le globe sur un continent (sélecteur) et affiche sa fiche. */
  focusContinent(id: number): void {
    const c = this.planet.continents()[id];
    if (!c) return;
    if (this.mode === "region") this.ascend(true);
    const d = dirOf(c.lat, c.lon);
    this.D = Math.min(this.D, this.portrait ? 6.5 : 3.1);
    this.facing(d, false);
    // sélectionne le point terrestre le plus proche du centre géométrique du continent
    let best: Vec3 = d;
    for (let k = 0; k < 40 && this.planet.height(best) < 0.03; k++) { const a = k * 2.4, rr = 0.03 * (1 + k * 0.25); const f = frameAt(d); best = norm3([d[0] + (f.e[0] * Math.cos(a) + f.s[0] * Math.sin(a)) * rr, d[1] + (f.e[1] * Math.cos(a) + f.s[1] * Math.sin(a)) * rr, d[2] + (f.e[2] * Math.cos(a) + f.s[2] * Math.sin(a)) * rr]); }
    this.tapPlanet(best);
  }
  /** Recentre sur la région d'origine / réinitialise le zoom. */
  recenter(): void {
    if (this.mode === "region") { this.ascend(); return; }
    const home = this.planet.regionById(this.ps.activeId) ?? this.planet.regions[0];
    this.D = this.dDefault;
    this.facing(this.planet.regionCenter(home), false);
  }
  /** Continents et régions habitées pour le sélecteur. */
  continentChoices(): { id: number; name: string }[] {
    return this.planet.continents().filter((c) => c.areaPct > 2.5).slice(0, 7).map((c) => ({ id: c.id, name: c.name }));
  }

  private placeRing(d: Vec3, size: number): void {
    const rad = 1.012;
    this.ring.position.set(d[0] * rad, d[1] * rad, d[2] * rad);
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(d));
    this.ring.scale.setScalar(size);
    this.ring.userData.base = size;
    this.ring.visible = true;
  }

  /** Placement direct (tests, scripts). */
  setView(v: { mode: PlanetMode; D?: number; P?: Vec3; dist?: number; el?: number; az?: number; region?: number }): void {
    this.tween = null;
    if (v.D) this.D = v.D;
    if (v.mode === "planet") {
      if (v.P) this.q.copy(this.facingQuat(v.P));
      this.mode = "planet";
    } else {
      const layer = this.layerFor(v.region);
      if (!layer) return;
      this.cur = layer;
      if (!layer.hi) this.buildPatch(layer, true);
      this.P = v.P ? this.clampToRegion(layer, v.P) : this.planet.regionCenter(layer.region);
      this.dist = v.dist ?? this.distDefault; this.el = v.el ?? this.elDefault; this.az = v.az ?? Math.PI / 4;
      this.mode = "region";
    }
    this.hooks.modeChanged(this.mode);
    this.applyCamera();
  }
  get state() { return { mode: this.mode, D: this.D, dist: this.dist, el: this.el, az: this.az, P: this.P.slice() as Vec3, tween: !!this.tween, region: this.cur?.region.id ?? -1 }; }
  get layerIds(): number[] { return [...this.layers.keys()]; }

  // ------------------------------------------------------------------ étiquettes

  private label(key: string, text: string, cls: string): HTMLElement {
    let e = this.labels.get(key);
    if (!e) { e = document.createElement("div"); e.className = "plbl " + cls; this.labelsEl.appendChild(e); this.labels.set(key, e); }
    if (e.textContent !== text) e.textContent = text;
    return e;
  }
  private updateLabels(): void {
    const el = this.r.three.domElement, w = el.clientWidth, h = el.clientHeight;
    const v = new THREE.Vector3(), nrm = new THREE.Vector3(), cam = this.camera.position;
    const live = new Set<string>();
    const placed: { x: number; y: number }[] = [];
    const place = (key: string, text: string, cls: string, d: Vec3, rad: number, lift = 0) => {
      const e = this.label(key, text, cls);
      live.add(key);
      v.set(d[0] * rad, d[1] * rad, d[2] * rad).applyMatrix4(this.globe.matrixWorld);
      nrm.set(d[0], d[1], d[2]).transformDirection(this.globe.matrixWorld);
      const facing = nrm.dot(new THREE.Vector3().subVectors(cam, v).normalize()) > 0.18;
      v.project(this.camera);
      const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h - lift;
      // évite de superposer deux étiquettes : la plus importante (placée en premier) gagne
      const clash = placed.some((p) => Math.abs(p.x - px) < 70 && Math.abs(p.y - py) < 16);
      const vis = facing && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && !clash;
      e.style.display = vis ? "block" : "none";
      if (vis) { e.style.transform = `translate(-50%,-100%) translate(${px}px,${py}px)`; placed.push({ x: px, y: py }); }
    };
    this.globe.updateMatrixWorld(true);
    if (this.mode === "planet") {
      for (const l of this.layers.values()) if (this.ps.isInhabited(l.sim)) place("r" + l.region.id, `${l.region.name} · ${l.sim.citizens.length}`, "reg", this.planet.regionCenter(l.region), 1.03, 12);
      for (const c of this.planet.continents().slice(0, 7)) if (c.areaPct > 2.5) place("c" + c.id, c.name, "cont", dirOf(c.lat, c.lon), 1.05);
      for (const l of this.layers.values()) if (!this.ps.isInhabited(l.sim)) place("r" + l.region.id, l.region.name, "cont", this.planet.regionCenter(l.region), 1.03, 8);
    } else if (this.cur && this.dist < 1.9) {
      const l = this.cur;
      for (const s of this.planet.settlements(l.sim, l.region)) {
        const hh = Math.max(0, l.sim.world.heightAt(s.x, s.y)), sc = this.planet.tileScale(l.region);
        place("s" + s.id, `${s.capital ? "★ " : ""}${s.name} · ${s.pop}`, "city", this.planet.localToDir(l.region, s.x, s.y), 1 + (hh + 1.6) * sc, 0);
      }
    }
    for (const [k, e] of this.labels) if (!live.has(k)) { e.remove(); this.labels.delete(k); }
  }
}

const norm3 = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
void latLonOf;

function mergeGeos(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let n = 0;
  for (const g of list) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array as Float32Array, o * 3);
    col.set(g.attributes.color.array as Float32Array, o * 3);
    nor.set(g.attributes.normal.array as Float32Array, o * 3);
    o += c;
  }
  const m = new THREE.BufferGeometry();
  m.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  m.setAttribute("color", new THREE.BufferAttribute(col, 3));
  m.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return m;
}
