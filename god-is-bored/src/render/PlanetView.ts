import * as THREE from "three";
import { hash2 } from "../sim/rng";
import { BIOME_NAME, dirOf, fbm3, frameAt, type Planet, type Region, type Vec3 } from "../sim/Planet";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { T } from "../sim/World";
import type { Renderer } from "./Renderer";

export type PlanetMode = "planet" | "region";
export interface PlanetCard { kind: "continent" | "ocean" | "region" | "settlement" | "tile"; title: string; lines: string[]; actions: { id: string; label: string }[]; }
export interface LocalPose { x: number; y: number; dist: number; el: number; az: number; }
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

/**
 * Vue planétaire : globe stylisé (terrain, océan, atmosphère, nuages, étoiles) et région tracée d'après le VRAI terrain local.
 * Deux états : PLANET (globe entier, glisser = faire tourner) et REGION (survol d'un territoire : même géométrie que la carte locale
 * à l'échelle, déformée sur la sphère). Le mode LOCAL est la scène 3D existante, gérée par `Renderer`.
 * Ne stocke aucune donnée de simulation : colonies, bâtiments et arbres sont relus dans le moteur.
 */
export class PlanetView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.002, 60);
  mode: PlanetMode = "planet";
  active = false;
  private globe = new THREE.Group();
  private sim!: SimulationEngine;
  private planet!: Planet;
  private region!: Region;
  private land!: THREE.Mesh;
  private ocean!: THREE.Mesh;
  private clouds!: THREE.Mesh;
  private atmo!: THREE.Mesh;
  private stars!: THREE.Points;
  private patch: THREE.Mesh | null = null;
  private patchDirs = new Float32Array(0);
  private patchRadial = new Float32Array(0);
  private patchN = 0;
  private houses: THREE.InstancedMesh;
  private trees: THREE.InstancedMesh;
  private marks: THREE.Points;
  private ring: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private labelsEl: HTMLElement;
  private labels = new Map<string, HTMLElement>();
  private ray = new THREE.Raycaster();
  private deep = new THREE.Color(0x17506f);

  // état de vue
  private q = new THREE.Quaternion(); // orientation du globe en mode PLANET
  private D = 3.4; // distance caméra en mode PLANET
  private P: Vec3 = [0, 1, 0]; // point survolé en mode REGION (direction globale)
  private dist = 0.5; private el = 0.72; private az = Math.PI / 4;
  private vel = { ax: 0, ay: 0, w: 0 }; // inertie de rotation
  private tween: { t: number; dur: number; kind: "dive" | "ascend" | "focus"; fq: THREE.Quaternion; tq: THREE.Quaternion; fD: number; tD: number; done?: () => void } | null = null;
  private lastSig = ""; private lastSync = -9; private time = 0;
  private ptrs = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; t: number } | null = null; private moved = 0; private multi = false;
  private pinch0 = 0; private twist0 = 0; private cy0 = 0;
  private introGoal = 0; // survol d'introduction : distance cible (0 : inactif)
  /** Distance régionale maximale et par défaut : plus grandes en portrait (iPhone) pour voir tout le territoire. */
  private get portrait(): boolean { const el = this.r.three.domElement; return (el.clientWidth || 1) / (el.clientHeight || 1) < 0.9; }
  private get dMax(): number { return this.portrait ? 11 : 6; }
  private get dDefault(): number { return this.portrait ? 8 : 3.5; }
  private get distMax(): number { return this.portrait ? 1.8 : 1.0; }
  private get distDefault(): number { return this.portrait ? 1.3 : 0.55; }
  private get elDefault(): number { return this.portrait ? 0.95 : 0.72; }
  private lock = 0; // délai avant tout changement automatique de niveau
  private sel: { kind: string; x: number; y: number; id: number } | null = null;
  stats = { buildings: 0, trees: 0, landTris: 0, patchTris: 0, drawCalls: 0 };

  constructor(private r: Renderer, labelsParent: HTMLElement, private mobile: boolean, private hooks: PlanetHooks) {
    this.labelsEl = document.createElement("div");
    this.labelsEl.id = "plabels";
    labelsParent.appendChild(this.labelsEl);
    this.scene.background = null;
    this.hemi = new THREE.HemisphereLight(0xb8d0ff, 0x1a2233, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.globe);
    // étoiles
    const sp = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) { const z = hash2(i, 1, 9) * 2 - 1, a = hash2(i, 2, 9) * Math.PI * 2, q = Math.sqrt(1 - z * z); sp[i * 3] = q * Math.cos(a) * 40; sp[i * 3 + 1] = z * 40; sp[i * 3 + 2] = q * Math.sin(a) * 40; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd8e2ff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true }));
    this.scene.add(this.stars);
    // atmosphère (halo de Fresnel), nuages
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.1, 64, 40), new THREE.ShaderMaterial({
      side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uFade: { value: 1 } },
      vertexShader: "varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
      fragmentShader: "uniform float uFade; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.7 - dot(vN, vec3(0.0,0.0,1.0))), 3.6); gl_FragColor = vec4(vec3(0.42,0.68,1.0)*i*1.05, i*0.7) * uFade; }",
    }));
    this.scene.add(this.atmo);
    this.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.03, 72, 44), new THREE.MeshLambertMaterial({ transparent: true, depthWrite: false, opacity: 0.85 }));
    this.globe.add(this.clouds);
    // instances
    const house = new THREE.BoxGeometry(1, 0.7, 1); house.translate(0, 0.35, 0);
    const roof = new THREE.ConeGeometry(0.85, 0.6, 4); roof.rotateY(Math.PI / 4); roof.translate(0, 1.0, 0);
    const paint = (g: THREE.BufferGeometry, c: number) => { const n = g.attributes.position.count, a = new Float32Array(n * 3), col = new THREE.Color(c); for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; } g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
    const hg = mergeGeos([paint(house.toNonIndexed(), 0xe9dcc0), paint(roof.toNonIndexed(), 0xd8d0c8)]);
    this.houses = new THREE.InstancedMesh(hg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 1400);
    this.houses.count = 0; this.houses.frustumCulled = false;
    const tg = mergeGeos([paint(new THREE.ConeGeometry(0.55, 1.5, 5).translate(0, 0.9, 0).toNonIndexed(), 0x2f6b3a)]);
    this.trees = new THREE.InstancedMesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }), mobile ? 3500 : 7000);
    this.trees.count = 0; this.trees.frustumCulled = false;
    this.globe.add(this.houses, this.trees);
    const mg = new THREE.BufferGeometry(); mg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 64), 3)); mg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(3 * 64), 3)); mg.setDrawRange(0, 0);
    this.marks = new THREE.Points(mg, new THREE.PointsMaterial({ size: 9, sizeAttenuation: false, vertexColors: true, transparent: true, depthTest: true }));
    this.marks.frustumCulled = false;
    this.globe.add(this.marks);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.ring.visible = false; this.ring.renderOrder = 20;
    this.globe.add(this.ring);
    this.bindInput();
  }

  // ------------------------------------------------------------------ construction

  /** (Re)construit le globe pour la simulation courante : relief reproductible issu de la graine, région d'origine incluse. */
  setSim(sim: SimulationEngine): void {
    this.sim = sim;
    this.planet = sim.planet;
    this.region = this.planet.regions[0];
    for (const m of [this.land, this.ocean, this.patch]) if (m) { this.globe.remove(m); m.geometry.dispose(); }
    this.patch = null; this.patchN = 0;
    this.buildLand();
    this.buildOcean();
    this.buildClouds();
    this.lastSig = ""; this.lastSync = -9;
    this.ring.visible = false; this.sel = null;
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.facing(this.planet.regionCenter(this.region), true);
    this.D = this.dDefault;
    this.mode = "planet";
  }

  /** Arrivée dans l'espace : la caméra s'approche lentement de la planète. */
  intro(): void { this.introGoal = this.D; this.D = this.dMax; this.vel.w = 0; }

  private buildLand(): void {
    const detail = this.mobile ? 24 : 34;
    const g = new THREE.IcosahedronGeometry(1, detail);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const n = pos.count, col = new Float32Array(n * 3);
    const c: [number, number, number] = [0, 0, 0];
    const cache = new Map<string, number>();
    const p = this.planet;
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const key = `${Math.round(x * 4e5)},${Math.round(y * 4e5)},${Math.round(z * 4e5)}`;
      let h: number;
      const hit = cache.get(key);
      if (hit !== undefined) h = hit; else { h = p.heightWithRegions([x, y, z]); cache.set(key, h); }
      p.colorAt([x, y, z], h, c);
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
      const rad = h >= 0 ? 1 + Math.pow(h, 1.1) * 0.048 : 1 + Math.max(h, -0.6) * 0.02;
      pos.setXYZ(i, x * rad, y * rad, z * rad);
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.land = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true }));
    this.globe.add(this.land);
    this.stats.landTris = n / 3;
    const dc: [number, number, number] = [0, 0, 0];
    p.colorAt(p.regionCenter(this.region), -0.45, dc);
    this.deep.setRGB(dc[0], dc[1], dc[2]);
  }

  private buildOcean(): void {
    this.ocean = new THREE.Mesh(new THREE.SphereGeometry(1, 96, 64), new THREE.MeshStandardMaterial({ color: 0x3a8fb5, transparent: true, opacity: 0.8, roughness: 0.5, metalness: 0.0, depthWrite: true }));
    this.ocean.renderOrder = 1;
    this.globe.add(this.ocean);
  }

  private buildClouds(): void {
    const W = 512, H = 256, data = new Uint8Array(W * H * 4);
    const s = this.planet.seed + 77;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2, lat = (j / H - 0.5) * Math.PI;
      const d = dirOf(lat, lon);
      const f = fbm3(d[0] * 2.6, d[1] * 2.6, d[2] * 2.6, s, 4), f2 = fbm3(d[0] * 6 + 5, d[1] * 6, d[2] * 6, s + 9, 2);
      const a = sstep(0.54, 0.74, f * 0.8 + f2 * 0.25);
      const o = (j * W + i) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = Math.round(a * 235);
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    (this.clouds.material as THREE.MeshLambertMaterial).map?.dispose();
    (this.clouds.material as THREE.MeshLambertMaterial).map = tex;
    (this.clouds.material as THREE.MeshLambertMaterial).needsUpdate = true;
  }

  /** Région : copie du terrain local (positions, couleurs, chemins, territoires) déformée sur la sphère à l'échelle d'une case. */
  private buildPatch(): void {
    const geo = this.r.terrainGeometry;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const n = pos.count, N = this.sim.world.size;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setIndex(geo.index!);
    this.patchDirs = new Float32Array(n * 3);
    this.patchRadial = new Float32Array(n);
    const p = this.planet, sr = p.spanRad(this.region), f = frameAt(p.regionCenter(this.region));
    for (let i = 0; i < n; i++) {
      const x = pos.getX(i) + N / 2, y = pos.getZ(i) + N / 2;
      const a = (x / N - 0.5) * sr, b = (y / N - 0.5) * sr;
      const L = Math.hypot(Math.tan(a), 1, Math.tan(b)), vx = Math.tan(a) / L, vy = 1 / L, vz = Math.tan(b) / L;
      this.patchDirs[i * 3] = f.e[0] * vx + f.c[0] * vy + f.s[0] * vz;
      this.patchDirs[i * 3 + 1] = f.e[1] * vx + f.c[1] * vy + f.s[1] * vz;
      this.patchDirs[i * 3 + 2] = f.e[2] * vx + f.c[2] * vy + f.s[2] * vz;
    }
    this.patch = new THREE.Mesh(pg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
    this.patch.frustumCulled = false;
    this.globe.add(this.patch);
    this.patchN = n;
    this.stats.patchTris = (geo.index!.count / 3) | 0;
    this.remapPatch(true);
  }

  private remapPatch(heights: boolean): void {
    if (!this.patch) return;
    const geo = this.r.terrainGeometry, src = geo.attributes.position as THREE.BufferAttribute, scol = geo.attributes.color as THREE.BufferAttribute;
    const pos = this.patch.geometry.attributes.position as THREE.BufferAttribute, col = this.patch.geometry.attributes.color as THREE.BufferAttribute;
    const N = this.sim.world.size, s = this.planet.tileScale(this.region), n = this.patchN;
    const d = this.patchDirs;
    for (let i = 0; i < n; i++) {
      const x = src.getX(i) + N / 2, y = src.getZ(i) + N / 2;
      const edge = Math.min(x, y, N - x, N - y), t = sstep(0, 9, edge);
      if (heights) {
        const rad = (1 - 0.012) + ((1 + src.getY(i) * s) - (1 - 0.012)) * t;
        pos.setXYZ(i, d[i * 3] * rad, d[i * 3 + 1] * rad, d[i * 3 + 2] * rad);
      }
      let r0 = scol.getX(i), g0 = scol.getY(i), b0 = scol.getZ(i);
      const hh = src.getY(i);
      if (hh < -0.05) { // eau : même dégradé que l'océan du globe (plateau turquoise -> abysses), sans rupture au bord de la région
        const k = sstep(0.1, 1.3, -hh);
        r0 = 0.25 + (this.deep.r - 0.25) * k; g0 = 0.61 + (this.deep.g - 0.61) * k; b0 = 0.69 + (this.deep.b - 0.69) * k;
      }
      col.setXYZ(i, r0 + (this.deep.r - r0) * (1 - t), g0 + (this.deep.g - g0) * (1 - t), b0 + (this.deep.b - b0) * (1 - t));
    }
    col.needsUpdate = true;
    if (heights) { pos.needsUpdate = true; this.patch.geometry.computeVertexNormals(); }
  }

  /** Relit le moteur : bâtiments, forêts, colonies. Appelé à intervalle réduit et seulement si l'état a changé. */
  private syncWorld(force: boolean): void {
    const sim = this.sim, w = sim.world;
    const sig = `${w.terrainV}:${w.ownerV}:${w.fireV}:${w.treeV}:${sim.stats.buildingsBuilt}:${sim.stats.upgrades}:${sim.stats.buildingsLost}:${sim.buildings.length}:${sim.cities.length}`;
    if (!force && (sig === this.lastSig || this.time - this.lastSync < 1.2)) return;
    const heightsChanged = !this.lastSig || this.lastSig.split(":")[0] !== String(w.terrainV);
    this.lastSig = sig; this.lastSync = this.time;
    this.r.syncTerrainOnly();
    if (!this.patch || this.patchN !== (this.r.terrainGeometry.attributes.position as THREE.BufferAttribute).count) this.buildPatch(); else this.remapPatch(heightsChanged);
    this.syncInstances();
    this.syncMarks();
  }

  private tileDir(x: number, y: number, rad: number): Vec3 {
    const d = this.planet.localToDir(this.region, x, y);
    return [d[0] * rad, d[1] * rad, d[2] * rad];
  }

  private syncInstances(): void {
    const sim = this.sim, w = sim.world, s = this.planet.tileScale(this.region), N = w.size;
    const up = new THREE.Vector3(), xa = new THREE.Vector3(), za = new THREE.Vector3(), ya = new THREE.Vector3(), m = new THREE.Matrix4(), col = new THREE.Color();
    const east = V(frameAt(this.planet.regionCenter(this.region)).e);
    // bâtiments réels
    let n = 0;
    for (const b of sim.buildings) {
      if (b.hp < 0 || b.progress < 1 || b.civ < 0 || n >= this.houses.instanceMatrix.count) continue;
      const civ = sim.civById.get(b.civ);
      const cx = b.x + 0.5, cy = b.y + 0.5, h = Math.max(0, w.heightAt(cx, cy));
      const d = this.planet.localToDir(this.region, cx, cy);
      up.set(d[0], d[1], d[2]);
      xa.copy(east).addScaledVector(up, -east.dot(up)).normalize();
      za.crossVectors(xa, up);
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      const x2 = xa.clone().multiplyScalar(c).addScaledVector(za, -sn), z2 = xa.clone().multiplyScalar(sn).addScaledVector(za, c);
      ya.copy(up);
      const big = (b.type === "hall" || b.type === "castle" ? 1.7 : b.type === "temple" ? 1.4 : b.type === "farm" ? 1.0 : 0.95) * 1.25;
      const flat = b.type === "farm" ? 0.07 : 1;
      const tall = b.type === "farm" ? 1 : 0.8 + b.era * 0.28 + (b.type === "hall" || b.type === "castle" ? 0.6 : 0);
      m.makeBasis(x2, ya, z2);
      m.scale(new THREE.Vector3(s * big * (b.type === "farm" ? 1.25 : 1), s * big * tall * flat, s * big * (b.type === "farm" ? 1.25 : 1)));
      m.setPosition(d[0] * (1 + h * s), d[1] * (1 + h * s), d[2] * (1 + h * s));
      this.houses.setMatrixAt(n, m);
      col.setHex(b.type === "farm" ? 0xb69a50 : civ ? civ.color : 0x888888).lerp(new THREE.Color(0xffffff), b.type === "farm" ? 0 : 0.5);
      this.houses.setColorAt(n, col);
      n++;
    }
    this.houses.count = n; this.houses.instanceMatrix.needsUpdate = true; if (this.houses.instanceColor) this.houses.instanceColor.needsUpdate = true;
    this.stats.buildings = n;
    // forêts réelles (world.trees)
    let t = 0;
    const cap = this.trees.instanceMatrix.count;
    for (let ty = 0; ty < N && t < cap; ty++) for (let tx = 0; tx < N && t < cap; tx++) {
      const cnt = w.trees[ty * N + tx];
      if (!cnt || w.type[ty * N + tx] === T.WATER) continue;
      for (let k = 0; k < Math.min(cnt, 2) && t < cap; k++) {
        const cx = tx + 0.15 + hash2(tx, ty, k * 3 + 1) * 0.7, cy = ty + 0.15 + hash2(tx, ty, k * 3 + 2) * 0.7, h = Math.max(0, w.heightAt(cx, cy));
        const d = this.planet.localToDir(this.region, cx, cy);
        up.set(d[0], d[1], d[2]); xa.copy(east).addScaledVector(up, -east.dot(up)).normalize(); za.crossVectors(xa, up);
        m.makeBasis(xa, up, za);
        const sc = s * (0.9 + hash2(tx, ty, k + 9) * 0.8);
        m.scale(new THREE.Vector3(sc, sc * (0.9 + hash2(tx, ty, k + 4) * 0.5), sc));
        m.setPosition(d[0] * (1 + h * s), d[1] * (1 + h * s), d[2] * (1 + h * s));
        this.trees.setMatrixAt(t, m);
        col.setRGB(0.7 + hash2(tx, ty, k + 21) * 0.5, 0.85 + hash2(tx, ty, k + 22) * 0.35, 0.7 + hash2(tx, ty, k + 23) * 0.4);
        this.trees.setColorAt(t, col);
        t++;
      }
    }
    this.trees.count = t; this.trees.instanceMatrix.needsUpdate = true; if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true;
    this.stats.trees = t;
  }

  private syncMarks(): void {
    const st = this.planet.settlements(this.sim, this.region).slice(0, 64);
    const pos = this.marks.geometry.attributes.position as THREE.BufferAttribute, col = this.marks.geometry.attributes.color as THREE.BufferAttribute;
    const c = new THREE.Color();
    st.forEach((s, i) => {
      const h = Math.max(0, this.sim.world.heightAt(s.x, s.y)), d = this.planet.localToDir(this.region, s.x, s.y), rad = 1 + h * this.planet.tileScale(this.region) + 0.004;
      pos.setXYZ(i, d[0] * rad, d[1] * rad, d[2] * rad);
      c.setHex(s.color); col.setXYZ(i, c.r, c.g, c.b);
    });
    pos.needsUpdate = true; col.needsUpdate = true;
    this.marks.geometry.setDrawRange(0, st.length);
  }

  // ------------------------------------------------------------------ états de vue

  /** Quaternion « point P face à la caméra, nord vers le haut » (mode PLANET). */
  private facingQuat(P: Vec3): THREE.Quaternion {
    const z = V(P).normalize(), x = new THREE.Vector3(0, 1, 0).cross(z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = z.clone().cross(x);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).invert();
  }
  /** Quaternion REGION : le repère local (est, haut, sud) du point P est aligné sur (x, y, z) du monde. */
  private regionQuat(P: Vec3): THREE.Quaternion {
    const f = frameAt(P);
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(f.e), V(f.c), V(f.s))).invert();
  }
  private facing(P: Vec3, instant: boolean): void {
    const tq = this.facingQuat(P);
    if (instant) { this.q.copy(tq); this.globe.quaternion.copy(tq); } else this.tween = { t: 0, dur: 0.7, kind: "focus", fq: this.globe.quaternion.clone(), tq, fD: this.D, tD: this.D };
  }

  private surfaceH(P: Vec3): number {
    const l = this.planet.dirToLocal(this.region, P);
    return l && this.sim ? Math.max(0, this.sim.world.heightAt(clamp(l.x, 0, this.region.size - 0.01), clamp(l.y, 0, this.region.size - 0.01))) : 0;
  }
  private regionTarget(): THREE.Vector3 {
    const s = this.planet.tileScale(this.region);
    return new THREE.Vector3(0, 1 + (this.surfaceH(this.P) + 0.2) * s, 0);
  }
  private regionCamPos(): THREE.Vector3 {
    const T0 = this.regionTarget();
    return T0.clone().add(new THREE.Vector3(Math.cos(this.el) * Math.cos(this.az), Math.sin(this.el), Math.cos(this.el) * Math.sin(this.az)).multiplyScalar(this.dist));
  }

  /** Entre dans le mode REGION au-dessus d'un point (direction globale), avec transition fluide depuis le globe. */
  dive(P?: Vec3, instant = false): void {
    if (!this.active) return;
    const c = P ?? this.planet.regionCenter(this.region);
    this.P = this.clampToRegion(c);
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

  /** Retour au globe (région au centre de l'écran). */
  ascend(instant = false): void {
    if (!this.active) return;
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

  /** Reprend la vue régionale à partir d'une pose locale (retour depuis la scène détaillée) : même point, même distance, même azimut. */
  enterRegionFromLocal(p: LocalPose): void {
    const r = this.region, s = this.planet.tileScale(r);
    this.P = this.clampToRegion(this.planet.localToDir(r, p.x, p.y));
    this.dist = clamp(Math.max(p.dist * s, this.distDefault * 0.45), DIST_MIN * 1.15, this.distMax); // on recule un peu : le contexte du territoire reste visible this.el = clamp(p.el, 0.12, 1.45); this.az = p.az;
    this.mode = "region"; this.tween = null;
    this.ring.visible = false; this.sel = null; this.hooks.card(null);
    this.globe.quaternion.copy(this.regionQuat(this.P));
    this.hooks.modeChanged("region");
    this.lock = 1.0;
    this.applyCamera();
  }

  /** Pose locale équivalente à la vue régionale (mêmes axes, 1 case = 1 unité). */
  localPose(): LocalPose {
    const l = this.planet.dirToLocal(this.region, this.P) ?? { x: this.region.size / 2, y: this.region.size / 2 };
    const N = this.region.size;
    return { x: clamp(l.x, 2, N - 2), y: clamp(l.y, 2, N - 2), dist: this.dist / this.planet.tileScale(this.region), el: this.el, az: this.az };
  }

  private clampToRegion(P: Vec3): Vec3 {
    const l = this.planet.dirToLocal(this.region, P), N = this.region.size;
    if (!l) return this.planet.regionCenter(this.region);
    const x = clamp(l.x, -4, N + 4), y = clamp(l.y, -4, N + 4);
    return x === l.x && y === l.y ? P : this.planet.localToDir(this.region, x, y);
  }

  activate(on: boolean): void {
    this.active = on;
    const t = this.r.three;
    if (on) { t.setClearColor(SPACE, 1); this.lastSync = -9; this.syncWorld(true); this.applyCamera(); this.labelsEl.style.display = "block"; }
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
    const air = this.mode === "planet" && !this.tween ? 1 : sstep(1.25, 2.4, alt); // 0 près du sol (ciel bleu), 1 dans l'espace
    this.atmo.visible = true;
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uFade.value = sstep(1.18, 1.9, alt);
    (this.clouds.material as THREE.MeshLambertMaterial).opacity = 0.85 * sstep(1.3, 1.9, alt);
    this.clouds.visible = alt > 1.3;
    (this.stars.material as THREE.PointsMaterial).opacity = air;
    const bg = SPACE.clone().lerp(SKY, 1 - air);
    this.r.three.setClearColor(bg, 1);
    (this.marks.material as THREE.PointsMaterial).opacity = sstep(0.5, 1.4, alt) * 0.95;
    this.marks.visible = (this.marks.material as THREE.PointsMaterial).opacity > 0.02;
    // soleil : fixe dans l'espace sur le globe, plus haut à l'approche du sol
    const blend = 1 - air;
    const sd = new THREE.Vector3(-3.6, 2.0, 3.0).normalize().lerp(new THREE.Vector3(-0.45, 0.85, 0.3).normalize(), blend).normalize();
    this.sun.position.copy(sd.multiplyScalar(10)); this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 2.8 - 0.4 * blend; this.hemi.intensity = 0.55 + 0.7 * blend;
    cam.near = Math.max(0.0015, Math.min(0.1, (this.mode === "region" ? this.dist : alt - 1) * 0.03));
    cam.updateProjectionMatrix();
  }

  /** À appeler à chaque image tant que la vue planète est active. */
  frame(dt: number): void {
    if (!this.active) return;
    this.time += dt;
    this.lock = Math.max(0, this.lock - dt);
    const el = this.r.three.domElement;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    if (Math.abs(this.camera.aspect - w / h) > 1e-3) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.syncWorld(false);
    this.clouds.rotation.y += dt * 0.012;
    // transitions
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      this.globe.quaternion.slerpQuaternions(tw.fq, tw.tq, k);
      if (tw.kind === "dive") {
        const T1 = this.regionTarget(), c1 = this.regionCamPos(), c0 = new THREE.Vector3(0, 0, tw.fD);
        // trajectoire : le point visé monte vers le sommet pendant que la caméra descend
        this.camera.position.lerpVectors(c0, c1, k);
        this.camera.lookAt(new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), T1, k));
      } else if (tw.kind === "ascend") {
        const T0 = this.regionTarget(), c0 = this.regionCamPos(), c1 = new THREE.Vector3(0, 0, tw.tD);
        this.camera.position.lerpVectors(c0, c1, k);
        this.camera.lookAt(new THREE.Vector3().lerpVectors(T0, new THREE.Vector3(0, 0, 0), k));
      }
      if (tw.t >= 1) { this.tween = null; tw.done?.(); if (tw.kind === "focus") this.q.copy(tw.tq); }
      this.applyCamera();
    } else {
      if (this.introGoal > 0) { this.D += (this.introGoal - this.D) * Math.min(1, dt * 1.3); this.q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dt * 0.12 * Math.min(1, (this.D - this.introGoal) / 1.5))); if (Math.abs(this.D - this.introGoal) < 0.02) this.introGoal = 0; }
      // inertie de rotation du globe
      if (this.mode === "planet" && this.vel.w > 1e-4) {
        const dq = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(this.vel.ax, this.vel.ay, 0).normalize(), this.vel.w);
        this.q.premultiply(dq);
        this.vel.w *= Math.pow(0.9, dt * 60);
      } else this.vel.w = 0;
      this.applyCamera();
    }
    this.updateSelection();
    this.updateLabels();
    this.r.three.render(this.scene, this.camera);
    this.stats.drawCalls = this.r.three.info.render.calls;
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
      // zoom maximal + région au centre : descente automatique vers la région
      if (nd < D_MIN * 0.97 && this.lock <= 0) {
        const fwd = V(this.planet.regionCenter(this.region)).applyQuaternion(this.globe.quaternion);
        if (fwd.z > 0.78) this.dive();
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
    const h = this.r.three.domElement.clientHeight || 800;
    const wpp = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.dist) / h;
    const fx = -Math.cos(this.az), fz = -Math.sin(this.az); // direction horizontale caméra -> cible
    const rx = Math.sin(this.az), rz = -Math.cos(this.az);
    const mx = (-dx * rx + dy * fx) * wpp, mz = (-dx * rz + dy * fz) * wpp;
    const f = frameAt(this.P);
    const P2 = [this.P[0] + f.e[0] * mx + f.s[0] * mz, this.P[1] + f.e[1] * mx + f.s[1] * mz, this.P[2] + f.e[2] * mx + f.s[2] * mz] as Vec3;
    const l = Math.hypot(...P2);
    this.P = this.clampToRegion([P2[0] / l, P2[1] / l, P2[2] / l]);
  }

  private pickGlobeDir(cx: number, cy: number): Vec3 | null {
    const el = this.r.three.domElement, rect = el.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), this.camera);
    this.globe.updateMatrixWorld(true);
    if (this.mode === "region" && this.patch) {
      const hit = this.ray.intersectObject(this.patch, false)[0];
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

  /** Colonie la plus proche du doigt, en pixels (zone de toucher de 44 px minimum) : fiable même quand la région est dézoomée. */
  private settlementNear(cx: number, cy: number): { id: number; x: number; y: number } | null {
    const el = this.r.three.domElement, rect = el.getBoundingClientRect(), v = new THREE.Vector3();
    let best: { id: number; x: number; y: number; d: number } | null = null;
    this.globe.updateMatrixWorld(true);
    for (const s of this.planet.settlements(this.sim, this.region)) {
      const h = Math.max(0, this.sim.world.heightAt(s.x, s.y)), sc = this.planet.tileScale(this.region), d = this.planet.localToDir(this.region, s.x, s.y), rad = 1 + (h + 0.8) * sc;
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
    if (!d && near) d = this.planet.localToDir(this.region, near.x, near.y);
    if (!d) { this.hooks.card(null); this.ring.visible = false; this.sel = null; return; }
    const sim = this.sim, pl = this.planet, r = this.region;
    const loc = pl.dirToLocal(r, d);
    const N = r.size;
    const inRegion = !!loc && loc.x > -1 && loc.y > -1 && loc.x < N + 1 && loc.y < N + 1;
    if (this.mode === "planet") {
      if (inRegion) {
        const s = pl.summary(sim, r);
        this.placeRing(d, 0.05);
        this.sel = { kind: "region", x: 0, y: 0, id: r.id };
        this.hooks.card({
          kind: "region", title: s.name,
          lines: [`An ${s.year} · ${s.population} habitants · ${s.cities} villes`, ...s.civs.map((c) => `${c.name} — ${c.pop} hab., ${c.cities} villes, ère ${c.era + 1}`)],
          actions: [{ id: "dive", label: "Zoomer sur la région" }],
        });
        return;
      }
      const cont = pl.continentAt(d);
      const h = pl.height(d);
      this.placeRing(d, 0.07);
      this.sel = { kind: cont ? "continent" : "ocean", x: 0, y: 0, id: cont?.id ?? -1 };
      if (cont) {
        this.hooks.card({ kind: "continent", title: cont.name, lines: [`${cont.kind === "continent" ? "Continent" : "Île"} · ${cont.areaPct.toFixed(1)} % de la planète`, `Terrain ici : ${BIOME_NAME[pl.biomeOf(d, h)]}`, "Aucune civilisation connue pour l'instant."], actions: [] });
      } else {
        this.hooks.card({ kind: "ocean", title: h < -0.3 ? "Fosse océanique" : "Océan", lines: ["Eaux ouvertes. Aucune terre à proximité immédiate."], actions: [] });
      }
      this.facing(d, false);
      return;
    }
    // REGION : colonie la plus proche sinon case
    if (!loc && !near) return;
    let best: { id: number; name: string; d: number; x: number; y: number } | null = near ? { id: near.id, name: "", d: 0, x: near.x, y: near.y } : null;
    if (!best && loc) for (const s of pl.settlements(sim, r)) { const dd = Math.hypot(s.x - loc.x, s.y - loc.y); if (dd < 3.2 && (!best || dd < best.d)) best = { id: s.id, name: s.name, d: dd, x: s.x, y: s.y }; }
    if (best) {
      const city = sim.cityById.get(best.id)!, civ = sim.civById.get(city.civ);
      const nb = sim.buildings.filter((b) => b.city === city.id && b.progress >= 1 && b.civ >= 0).length;
      this.placeRing(pl.localToDir(r, best.x, best.y), 0.012);
      this.sel = { kind: "settlement", x: best.x, y: best.y, id: best.id };
      this.hooks.card({ kind: "settlement", title: city.name, lines: [`${civ?.name ?? "?"}${civ?.capital === city.id ? " · capitale" : ""}`, `${city.pop} habitants · ${nb} bâtiments`, `Époque ${civ ? civ.era + 1 : "?"} · An ${sim.year}`], actions: [{ id: "enter", label: "Entrer dans le village" }] });
      return;
    }
    if (!loc) return;
    const tx = Math.floor(clamp(loc.x, 0, N - 1)), ty = Math.floor(clamp(loc.y, 0, N - 1)), i = ty * N + tx, w = sim.world;
    const owner = w.owner[i] >= 0 ? sim.civById.get(w.owner[i])?.name : undefined;
    const kind = ["Eau", "Sable", "Plaine", "Colline", "Montagne", "Rivière"][w.type[i]] ?? "Terrain";
    this.placeRing(pl.localToDir(r, tx + 0.5, ty + 0.5), 0.006);
    this.sel = { kind: "tile", x: tx + 0.5, y: ty + 0.5, id: -1 };
    this.hooks.card({
      kind: "tile", title: kind, lines: [owner ? `Territoire de ${owner}` : "Terres libres", `Fertilité ${Math.round(w.fertility[i] * 100)} % · Arbres ${w.trees[i]} · Pierre ${Math.round(w.stone[i])}`], actions: w.type[i] === T.WATER ? [] : [{ id: "enter", label: "Descendre ici" }],
    });
  }

  /** Action d'un bouton de la fiche. */
  action(id: string): void {
    if (id === "dive") this.dive();
    else if (id === "enter") {
      const s = this.sel;
      if (s && (s.kind === "settlement" || s.kind === "tile")) {
        const N = this.region.size;
        this.P = this.clampToRegion(this.planet.localToDir(this.region, clamp(s.x, 2, N - 2), clamp(s.y, 2, N - 2)));
        this.dist = Math.min(this.dist, 0.14);
      }
      this.hooks.enterLocal(this.localPose());
    }
  }

  private placeRing(d: Vec3, size: number): void {
    const rad = 1.012;
    this.ring.position.set(d[0] * rad, d[1] * rad, d[2] * rad);
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(d));
    this.ring.scale.setScalar(size);
    this.ring.userData.base = size;
    this.ring.visible = true;
  }
  private updateSelection(): void {
    if (!this.ring.visible) return;
    const p = 1 + Math.sin(this.time * 4) * 0.06;
    this.ring.scale.setScalar((this.ring.userData.base as number) * p);
  }

  /** Reprise externe (tests, scripts) : place la vue sans animation. */
  setView(v: { mode: PlanetMode; D?: number; P?: Vec3; dist?: number; el?: number; az?: number }): void {
    this.tween = null;
    if (v.D) this.D = v.D;
    if (v.mode === "planet") {
      if (v.P) { this.q.copy(this.facingQuat(v.P)); }
      this.mode = "planet";
    } else {
      this.P = v.P ? this.clampToRegion(v.P) : this.planet.regionCenter(this.region);
      this.dist = v.dist ?? this.distDefault; this.el = v.el ?? 0.72; this.az = v.az ?? Math.PI / 4;
      this.mode = "region";
    }
    this.hooks.modeChanged(this.mode);
    this.applyCamera();
  }
  get state() { return { mode: this.mode, D: this.D, dist: this.dist, el: this.el, az: this.az, P: this.P.slice() as Vec3, tween: !!this.tween }; }

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
    const place = (key: string, text: string, cls: string, d: Vec3, rad: number, lift = 0) => {
      const e = this.label(key, text, cls);
      live.add(key);
      v.set(d[0] * rad, d[1] * rad, d[2] * rad).applyMatrix4(this.globe.matrixWorld);
      nrm.set(d[0], d[1], d[2]).transformDirection(this.globe.matrixWorld);
      const facing = nrm.dot(new THREE.Vector3().subVectors(cam, v).normalize()) > 0.12;
      v.project(this.camera);
      const vis = facing && v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      e.style.display = vis ? "block" : "none";
      if (vis) e.style.transform = `translate(-50%,-100%) translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h - lift}px)`;
    };
    this.globe.updateMatrixWorld(true);
    if (this.mode === "planet") {
      for (const c of this.planet.continents().slice(0, 7)) if (c.areaPct > 2.5) place("c" + c.id, c.name, "cont", dirOf(c.lat, c.lon), 1.05);
      place("region", this.region.name, "reg", this.planet.regionCenter(this.region), 1.03, 10);
    } else if (this.dist < 1.9) {
      for (const s of this.planet.settlements(this.sim, this.region)) {
        const hh = Math.max(0, this.sim.world.heightAt(s.x, s.y)), sc = this.planet.tileScale(this.region);
        place("s" + s.id, `${s.capital ? "★ " : ""}${s.name} · ${s.pop}`, "city", this.planet.localToDir(this.region, s.x, s.y), 1 + (hh + 1.6) * sc, 0);
      }
    }
    for (const [k, e] of this.labels) if (!live.has(k)) { e.remove(); this.labels.delete(k); }
  }
}

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
