import * as THREE from "three";
import { hash2 } from "../sim/rng";
import { Geo, type GeoSample } from "../sim/Geo";
import { BIOME_NAME, dirOf, fbm3, frameAt, latLonOf, type Planet, type Region, type Vec3 } from "../sim/Planet";
import type { PlanetSim } from "../sim/PlanetSim";
import { TILE_RAD } from "../sim/scale";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { Renderer } from "./Renderer";
import { TerrainLOD } from "./TerrainLOD";
import { tileBaseColor } from "./Terrain";

/** Niveaux d'échelle : le zoom est continu, ces niveaux ne servent qu'aux raccourcis et à l'affichage. */
export type ScaleLevel = "planet" | "continent" | "region" | "local";
export type PlanetMode = "planet" | "region";
export interface PlanetCard { kind: "continent" | "ocean" | "region" | "settlement" | "tile" | "land"; title: string; lines: string[]; actions: { id: string; label: string }[]; }
export interface LocalPose { region: number; x: number; y: number; dist: number; el: number; az: number; }
export interface PlanetHooks {
  card(c: PlanetCard | null): void;
  enterLocal(p: LocalPose): void;
  modeChanged(m: PlanetMode): void;
  levelChanged(l: ScaleLevel): void;
  place(text: string): void;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const ease = (t: number) => t * t * (3 - 2 * t);
const V = (a: Vec3) => new THREE.Vector3(a[0], a[1], a[2]);
const norm3 = (v: Vec3): Vec3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

const SPACE = new THREE.Color(0x05070e), SKY = new THREE.Color(0x86a3c6);
/** Distances caméra → point visé (rayon de la planète = 1). */
const D_LOCAL = 0.022; // en deçà, on entre dans la scène locale détaillée
const D_REGION = 0.14, D_CONTINENT = 0.9;
const LEVEL_D = { region: 0.6, continent: 1.9 }; // seuils d'affichage : < 0,6 région ; < 1,9 continent ; sinon planète

/** Une carte jouée (une simulation) : bâtiments à l'échelle, repères, contour ; carte incrustée si c'est une ancienne partie. */
interface Layer {
  region: Region; sim: SimulationEngine;
  patch: THREE.Mesh | null; dirs: Float32Array; W: number;
  houses: THREE.InstancedMesh; marks: THREE.Points; halos: THREE.Points; outline: THREE.LineLoop;
  sig: string; lastSync: number; nHouses: number; markE: number; center: Vec3;
}

/**
 * Vue planétaire continue : UNE caméra qui orbite autour d'un point de la surface ; le zoom est le moyen principal de navigation.
 * Le terrain est un seul maillage multi-échelle (TerrainLOD) tiré de la géographie continue : planète → continent → région → village,
 * sans jamais changer de géographie. Seule la scène LOCAL détaillée (villageois, bâtiments) reste une scène à part, atteinte en zoomant
 * jusqu'au sol ou par les raccourcis. Les cartes jouées (villages) sont des tranches de cette même géographie.
 */
export class PlanetView {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.0004, 40);
  active = false;
  private globe = new THREE.Group();
  private ps!: PlanetSim;
  private planet!: Planet;
  private geo!: Geo;
  private terrain: TerrainLOD | null = null;
  private layers = new Map<number, Layer>();
  private clouds!: THREE.Mesh;
  private atmo!: THREE.Mesh;
  private stars!: THREE.Points;
  private ring: THREE.Mesh;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private labelsEl: HTMLElement;
  private labels = new Map<string, HTMLElement>();
  private ray = new THREE.Raycaster();
  private houseGeo: THREE.BufferGeometry;
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private smp: GeoSample = { h: 0, riv: 0, bio: 0, hp: 0 };

  // état de vue : une seule caméra continue
  private P: Vec3 = [0, 1, 0]; // point de la surface visé
  private d = 3; // distance caméra → point visé
  private elPref = 0.8; // inclinaison préférée (rad au-dessus de l'horizon) ; vue de dessus à grande distance
  private az = -Math.PI / 2; // azimut : -π/2 = nord en haut
  private vel = { mx: 0, mz: 0 }; // inertie de déplacement (unités/s)
  private tween: { t: number; dur: number; from: { P: Vec3; d: number; el: number; az: number }; to: { P: Vec3; d: number; el: number; az: number } } | null = null;
  private time = 0;
  private lastLevel: ScaleLevel = "planet";
  private lastMode: PlanetMode = "planet";
  private lastPlace = 0;
  private ptrs = new Map<number, { x: number; y: number }>();
  private down: { x: number; y: number; t: number } | null = null; private moved = 0; private multi = false;
  private pinch0 = 0; private twist0 = 0; private cy0 = 0;
  private introGoal = 0;
  private lock = 0;
  private exag = 1.4;
  private sel: { kind: string; dir: Vec3; region: number; x: number; y: number; id: number } | null = null;
  stats = { buildings: 0, layers: 0, chunks: 0, drawn: 0, drawCalls: 0, tris: 0, pending: 0, workers: 0 };

  private get portrait(): boolean { const el = this.r.three.domElement; return (el.clientWidth || 1) / (el.clientHeight || 1) < 0.9; }
  private get dMax(): number { return this.portrait ? 9.5 : 5.5; }
  private get dPlanet(): number { return this.portrait ? 7 : 2.6; }
  private get dContinent(): number { return this.portrait ? 1.5 : D_CONTINENT; }
  private get dRegion(): number { return this.portrait ? 0.3 : D_REGION; }

  constructor(private r: Renderer, labelsParent: HTMLElement, private mobile: boolean, private hooks: PlanetHooks) {
    this.labelsEl = document.createElement("div");
    this.labelsEl.id = "plabels";
    labelsParent.appendChild(this.labelsEl);
    this.hemi = new THREE.HemisphereLight(0xb8d0ff, 0x1a2233, 0.7);
    this.sun = new THREE.DirectionalLight(0xfff0d8, 2.8);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.globe);
    const sp = new Float32Array(1400 * 3);
    for (let i = 0; i < 1400; i++) { const z = hash2(i, 1, 9) * 2 - 1, a = hash2(i, 2, 9) * Math.PI * 2, q = Math.sqrt(1 - z * z); sp[i * 3] = q * Math.cos(a) * 30; sp[i * 3 + 1] = z * 30; sp[i * 3 + 2] = q * Math.sin(a) * 30; }
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
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, side: THREE.DoubleSide }));
    this.ring.visible = false; this.ring.renderOrder = 20;
    this.globe.add(this.ring);
    this.bindInput();
  }

  // ------------------------------------------------------------------ construction

  /** (Re)construit la vue pour un monde : terrain multi-échelle de la planète + une couche par carte jouée. */
  setPlanetSim(ps: PlanetSim): void {
    this.ps = ps;
    this.planet = ps.planet;
    this.geo = new Geo(ps.planet);
    for (const l of [...this.layers.values()]) this.disposeLayer(l);
    this.layers.clear();
    if (this.terrain) { this.globe.remove(this.terrain.group); this.terrain.dispose(); }
    this.terrain = new TerrainLOD(this.planet, this.mobile);
    this.globe.add(this.terrain.group);
    this.buildClouds();
    this.ring.visible = false; this.sel = null; this.tween = null;
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.syncLayers();
    const home = this.planet.regionById(ps.activeId) ?? this.planet.regions[0];
    this.P = this.planet.regionCenter(home);
    this.d = this.dPlanet; this.az = -Math.PI / 2; this.elPref = 0.8;
    this.lastLevel = "planet"; this.lastMode = "planet";
  }

  /** Arrivée dans l'espace : la caméra s'approche lentement de la planète. */
  intro(): void { this.introGoal = this.d; this.d = this.dMax * 0.9; this.vel = { mx: 0, mz: 0 }; }

  /** Nuages discrets : couverture partielle et peu opaque, pour ne jamais masquer les continents. */
  private buildClouds(): void {
    const W = 512, H = 256, data = new Uint8Array(W * H * 4);
    const s = this.planet.seed + 77;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const lon = (i / W) * Math.PI * 2, lat = (j / H - 0.5) * Math.PI;
      const d = dirOf(lat, lon);
      const f = fbm3(d[0] * 2.6, d[1] * 2.6, d[2] * 2.6, s, 4), f2 = fbm3(d[0] * 6 + 5, d[1] * 6, d[2] * 6, s + 9, 2);
      const a = sstep(0.62, 0.8, f * 0.8 + f2 * 0.25);
      const o = (j * W + i) * 4;
      data[o] = 255; data[o + 1] = 255; data[o + 2] = 255; data[o + 3] = Math.round(a * 190);
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    tex.wrapS = THREE.RepeatWrapping; tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
    const m = this.clouds.material as THREE.MeshLambertMaterial;
    m.map?.dispose(); m.map = tex; m.needsUpdate = true;
  }

  /** Une couche par carte jouée. */
  syncLayers(): void {
    let changed = false;
    for (const [id, eng] of this.ps.engines) {
      if (this.layers.has(id)) continue;
      const region = this.planet.regionById(id);
      if (region) { this.makeLayer(region, eng); changed = true; }
    }
    if (changed) this.updateHoles();
    this.stats.layers = this.layers.size;
  }

  private updateHoles(): void {
    const holes: { c: Vec3; e: Vec3; s: Vec3; half: number }[] = [];
    for (const l of this.layers.values()) if (l.region.legacyMap && l.patch) { const f = frameAt(l.center); holes.push({ c: f.c, e: f.e, s: f.s, half: Math.tan(this.planet.spanRad(l.region) / 2) * 1.01 }); }
    this.terrain?.setHoles(holes);
  }

  private makeLayer(region: Region, sim: SimulationEngine): Layer {
    const houses = new THREE.InstancedMesh(this.houseGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 700);
    houses.count = 0; houses.frustumCulled = false; houses.visible = false;
    const mk = (size: number, color: number | null, opacity: number): THREE.Points => {
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
      g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(3 * 64), 3));
      g.setDrawRange(0, 0);
      const p = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: color === null, color: color ?? 0xffffff, transparent: true, opacity, depthTest: true }));
      p.frustumCulled = false;
      return p;
    };
    const halos = mk(15, 0x0a0d14, 0.5), marks = mk(8, null, 0.98);
    const pts: number[] = [], N = region.size;
    for (let k = 0; k < 64; k++) { // cadre du territoire (visible aux échelles planète et continent)
      const t = k / 64, e = t * 4, side = Math.floor(e), u = (e - side) * N;
      const [x, y] = side === 0 ? [u, 0] : side === 1 ? [N, u] : side === 2 ? [N - u, N] : [0, N - u];
      const dd = this.planet.localToDir(region, x, y);
      pts.push(dd[0], dd[1], dd[2]);
    }
    const og = new THREE.BufferGeometry(); og.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const outline = new THREE.LineLoop(og, new THREE.LineBasicMaterial({ color: 0xf0cf86, transparent: true, opacity: 0.8 }));
    outline.visible = false;
    this.globe.add(houses, halos, marks, outline);
    const layer: Layer = { region, sim, patch: null, dirs: new Float32Array(0), W: 0, houses, marks, halos, outline, sig: "", lastSync: -9, nHouses: 0, markE: -1, center: this.planet.regionCenter(region) };
    this.layers.set(region.id, layer);
    if (region.legacyMap) this.buildPatch(layer);
    this.syncLayer(layer, true);
    return layer;
  }

  private disposeLayer(l: Layer): void {
    this.globe.remove(l.houses, l.halos, l.marks, l.outline);
    l.houses.dispose(); l.halos.geometry.dispose(); l.marks.geometry.dispose(); l.outline.geometry.dispose();
    if (l.patch) { this.globe.remove(l.patch); l.patch.geometry.dispose(); }
  }

  // ---- carte d'une ancienne partie, incrustée dans la géographie continue (bords fondus)

  private buildPatch(l: Layer): void {
    const N = l.sim.world.size, W = N + 1, n = W * W;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    pg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const idx = new Uint32Array((W - 1) * (W - 1) * 6);
    let k = 0;
    for (let j = 0; j < W - 1; j++) for (let i = 0; i < W - 1; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; if ((i + j) & 1) idx.set([a, c, d, a, d, b], k); else idx.set([a, c, b, b, c, d], k); k += 6; }
    pg.setIndex(new THREE.BufferAttribute(idx, 1));
    l.dirs = new Float32Array(n * 3); l.W = W;
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) { const d = this.planet.localToDir(l.region, i, j), o = (j * W + i) * 3; l.dirs[o] = d[0]; l.dirs[o + 1] = d[1]; l.dirs[o + 2] = d[2]; }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    l.patch = new THREE.Mesh(pg, mat);
    l.patch.frustumCulled = false;
    this.globe.add(l.patch);
    this.fillPatch(l, true);
  }

  private fillPatch(l: Layer, heights: boolean): void {
    const patch = l.patch;
    if (!patch) return;
    const w = l.sim.world, N = w.size, W = l.W, s = TILE_RAD;
    const pos = patch.geometry.attributes.position as THREE.BufferAttribute, col = patch.geometry.attributes.color as THREE.BufferAttribute;
    const tc = new Float32Array(N * N * 3), c = new THREE.Color(), tmp = new THREE.Color(), civ = l.sim.civById;
    const urban = new Uint8Array(N * N);
    for (const b of l.sim.buildings) if (b.hp >= 0 && b.progress >= 1 && b.civ >= 0 && b.type !== "farm" && w.inb(b.x, b.y)) urban[b.y * N + b.x] = (b.era + 1) | 8;
    for (let i = 0; i < N * N; i++) {
      const o = w.owner[i], cv = o >= 0 ? civ.get(o) : undefined;
      tileBaseColor(w, i, cv ? cv.color : -1, urban[i], c, tmp);
      c.multiplyScalar(1 - Math.min(0.22, w.trees[i] * 0.045));
      tc[i * 3] = c.r; tc[i * 3 + 1] = c.g; tc[i * 3 + 2] = c.b;
    }
    const d = l.dirs, gc: [number, number, number] = [0, 0, 0];
    for (let j = 0; j < W; j++) for (let i = 0; i < W; i++) {
      const o = j * W + i, edge = Math.min(i, j, N - i, N - j), t = sstep(0, 6, edge);
      const h = heights ? w.heightAt(Math.min(N - 0.001, i), Math.min(N - 0.001, j)) : 0;
      const u = clamp(i - 0.5, 0, N - 1.001), v = clamp(j - 0.5, 0, N - 1.001), i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
      const A = (j0 * N + i0) * 3, B = A + 3, C = ((j0 + 1) * N + i0) * 3, D2 = C + 3;
      let r = 0, g = 0, b = 0;
      for (let q = 0; q < 3; q++) { const val = (tc[A + q] * (1 - fu) + tc[B + q] * fu) * (1 - fv) + (tc[C + q] * (1 - fu) + tc[D2 + q] * fu) * fv; if (q === 0) r = val; else if (q === 1) g = val; else b = val; }
      let rad = 1 + h * s;
      if (t < 1) { // le bord rejoint la géographie continue voisine (même altitude, même couleur)
        const gd: Vec3 = [d[o * 3], d[o * 3 + 1], d[o * 3 + 2]];
        this.geo.sample(gd, TILE_RAD * 3, this.smp);
        this.geo.planet.paint(this.smp.bio, gd, this.smp.hp, gc);
        const geoRad = 1 + Math.max(0, this.smp.h) * s * 1.4;
        rad = geoRad + (rad - geoRad) * t; r += (gc[0] - r) * (1 - t); g += (gc[1] - g) * (1 - t); b += (gc[2] - b) * (1 - t);
        if (this.smp.h < 0) rad = 1 + (rad - 1) * t;
      }
      col.setXYZ(o, r, g, b);
      if (heights) { rad += 0.00005; pos.setXYZ(o, d[o * 3] * rad, d[o * 3 + 1] * rad, d[o * 3 + 2] * rad); }
    }
    col.needsUpdate = true;
    if (heights) { pos.needsUpdate = true; patch.geometry.computeVertexNormals(); }
  }

  /** Relit le moteur de la carte : bâtiments (à l'échelle), repères des villages. Seulement si l'état a changé. */
  private syncLayer(l: Layer, force: boolean): void {
    const sim = l.sim, w = sim.world;
    const sig = `${w.terrainV}:${w.ownerV}:${w.fireV}:${sim.stats.buildingsBuilt}:${sim.stats.upgrades}:${sim.stats.buildingsLost}:${sim.buildings.length}:${sim.cities.length}`;
    const near = this.nearLayer(l);
    if (!force && (sig === l.sig || this.time - l.lastSync < (near ? 1.2 : 4))) return;
    const heightsChanged = !l.sig || l.sig.split(":")[0] !== String(w.terrainV);
    l.sig = sig; l.lastSync = this.time;
    if (l.patch) this.fillPatch(l, heightsChanged);
    this.syncHouses(l);
    this.syncMarks(l, true);
  }

  private nearLayer(l: Layer): boolean { return this.d < 1.2 && Math.acos(clamp(l.center[0] * this.P[0] + l.center[1] * this.P[1] + l.center[2] * this.P[2], -1, 1)) < 0.35; }

  /** Surface au point d'une case de la carte (altitude de la géographie continue ou de la carte incrustée). */
  private surfaceRad(l: Layer, x: number, y: number, e: number): number {
    if (l.region.legacyMap) return 1 + Math.max(0, l.sim.world.heightAt(x, y)) * TILE_RAD;
    return 1 + Math.max(0, l.sim.world.heightAt(x, y)) * TILE_RAD * e;
  }

  private syncHouses(l: Layer): void {
    const sim = l.sim, s = TILE_RAD;
    const up = new THREE.Vector3(), xa = new THREE.Vector3(), za = new THREE.Vector3(), m = new THREE.Matrix4(), col = new THREE.Color();
    const east = V(frameAt(this.planet.regionCenter(l.region)).e);
    let n = 0;
    for (const b of sim.buildings) {
      if (b.hp < 0 || b.progress < 1 || b.civ < 0 || n >= 700) continue;
      const civ = sim.civById.get(b.civ), cx = b.x + 0.5, cy = b.y + 0.5, d = this.planet.localToDir(l.region, cx, cy), rad = this.surfaceRad(l, cx, cy, 1.4);
      up.set(d[0], d[1], d[2]);
      xa.copy(east).addScaledVector(up, -east.dot(up)).normalize();
      za.crossVectors(xa, up);
      const c = Math.cos(b.rot), sn = Math.sin(b.rot);
      const x2 = xa.clone().multiplyScalar(c).addScaledVector(za, -sn), z2 = xa.clone().multiplyScalar(sn).addScaledVector(za, c);
      const big = (b.type === "hall" || b.type === "castle" ? 1.7 : b.type === "temple" ? 1.4 : b.type === "farm" ? 1.0 : 0.95) * 1.1;
      const flat = b.type === "farm" ? 0.07 : 1, tall = b.type === "farm" ? 1 : 0.8 + b.era * 0.28 + (b.type === "hall" || b.type === "castle" ? 0.6 : 0);
      m.makeBasis(x2, up, z2);
      m.scale(new THREE.Vector3(s * big * (b.type === "farm" ? 1.25 : 1), s * big * tall * flat, s * big * (b.type === "farm" ? 1.25 : 1)));
      m.setPosition(d[0] * rad, d[1] * rad, d[2] * rad);
      l.houses.setMatrixAt(n, m);
      col.setHex(b.type === "farm" ? 0xb69a50 : civ ? civ.color : 0x888888).lerp(new THREE.Color(0xffffff), b.type === "farm" ? 0 : 0.5);
      l.houses.setColorAt(n, col);
      n++;
    }
    l.houses.count = n; l.houses.instanceMatrix.needsUpdate = true; if (l.houses.instanceColor) l.houses.instanceColor.needsUpdate = true;
    l.nHouses = n;
  }

  /** Repères des villages : discrets, posés sur le relief avec l'exagération courante. */
  private syncMarks(l: Layer, force: boolean): void {
    if (!force && Math.abs(l.markE - this.exag) < 0.03) return;
    l.markE = this.exag;
    const st = this.planet.settlements(l.sim, l.region).slice(0, 64), c = new THREE.Color();
    const lift = 0.0012 + 0.006 * sstep(0.2, 2.2, this.d);
    for (const pts of [l.marks, l.halos]) {
      const pos = pts.geometry.attributes.position as THREE.BufferAttribute, col = pts.geometry.attributes.color as THREE.BufferAttribute;
      st.forEach((s, i) => {
        const d = this.planet.localToDir(l.region, s.x, s.y), rad = this.surfaceRad(l, s.x, s.y, this.exag) + lift;
        pos.setXYZ(i, d[0] * rad, d[1] * rad, d[2] * rad);
        c.setHex(s.color); col.setXYZ(i, c.r, c.g, c.b);
      });
      pos.needsUpdate = true; col.needsUpdate = true;
      pts.geometry.setDrawRange(0, st.length);
    }
  }

  // ------------------------------------------------------------------ vue

  /** Exagération verticale : réaliste près du sol, forte à l'échelle planète (sinon une montagne de 4 cases est invisible). */
  private exagFor(d: number): number { return 1.4 + 22 * sstep(0.12, 2.2, d); }

  private frameAxes(P: Vec3) { const f = frameAt(P); return { e: V(f.e), c: V(f.c), s: V(f.s) }; }
  private groundRadius(P: Vec3): number { return this.terrain ? 1 + Math.max(0, this.terrain.heightAt(P)) * TILE_RAD * this.exag : 1; }

  private elEff(): number { return Math.PI / 2 + (this.elPref - Math.PI / 2) * sstep(1.5, 0.4, this.d); }

  private poseCamera(): void {
    const cam = this.camera, ax = this.frameAxes(this.P), el = this.elEff();
    const ground = this.groundRadius(this.P);
    const T = V(this.P).multiplyScalar(ground);
    const off = new THREE.Vector3().addScaledVector(ax.e, Math.cos(el) * Math.cos(this.az)).addScaledVector(ax.s, Math.cos(el) * Math.sin(this.az)).addScaledVector(ax.c, Math.sin(el));
    cam.position.copy(T).addScaledVector(off, this.d);
    // « haut » de l'écran : la normale du sol en vue oblique, la direction d'avance en vue de dessus
    const fh = new THREE.Vector3().addScaledVector(ax.e, -Math.cos(this.az)).addScaledVector(ax.s, -Math.sin(this.az));
    const w = sstep(1.0, 1.5, el);
    cam.up.copy(ax.c).multiplyScalar(1 - w).addScaledVector(fh, w).normalize();
    cam.lookAt(T);
    const altitude = Math.max(0.0003, cam.position.length() - ground * 0.999);
    cam.near = clamp(altitude * 0.04, 0.00015, 0.2);
    cam.far = Math.max(3, cam.position.length() + 2.5);
    cam.updateProjectionMatrix();
  }

  /** Niveau d'échelle courant d'après la distance (le zoom est continu). */
  get level(): ScaleLevel { return this.d < LEVEL_D.region ? "region" : this.d < LEVEL_D.continent ? "continent" : "planet"; }

  /** Glisse vers une nouvelle pose (zoom/déplacement continus, jamais de changement brusque de scène). */
  flyTo(to: { P?: Vec3; d?: number; el?: number; az?: number }, dur = 1.1): void {
    const from = { P: this.P.slice() as Vec3, d: this.d, el: this.elPref, az: this.az };
    this.tween = { t: 0, dur, from, to: { P: to.P ?? this.P, d: to.d ?? this.d, el: to.el ?? this.elPref, az: to.az ?? this.az } };
    this.vel = { mx: 0, mz: 0 };
  }

  /** Raccourcis PLANÈTE / CONTINENT / RÉGION : un zoom animé vers le niveau voulu, centré sur le point courant. */
  goLevel(l: ScaleLevel): void {
    if (l === "local") { this.enterHere(); return; }
    const d = l === "planet" ? this.dPlanet : l === "continent" ? this.dContinent : this.dRegion;
    this.flyTo({ d, az: l === "planet" ? -Math.PI / 2 : this.az, el: l === "region" ? 0.78 : undefined }, 1.2);
  }

  activate(on: boolean): void {
    this.active = on;
    const t = this.r.three;
    if (on) { t.setClearColor(SPACE, 1); this.syncLayers(); for (const l of this.layers.values()) this.syncLayer(l, true); this.labelsEl.style.display = "block"; this.poseCamera(); }
    else { t.setClearColor(0x000000, 0); this.labelsEl.style.display = "none"; this.ptrs.clear(); this.down = null; }
  }

  frame(dt: number): void {
    if (!this.active || !this.terrain) return;
    this.time += dt;
    this.lock = Math.max(0, this.lock - dt);
    const el = this.r.three.domElement;
    const w = el.clientWidth || 1, h = el.clientHeight || 1;
    if (Math.abs(this.camera.aspect - w / h) > 1e-3) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    // transitions de zoom
    const tw = this.tween;
    if (tw) {
      tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = ease(tw.t);
      const a = tw.from.P, b = tw.to.P;
      this.P = norm3([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]);
      this.d = Math.exp(Math.log(tw.from.d) + (Math.log(tw.to.d) - Math.log(tw.from.d)) * k);
      this.elPref = tw.from.el + (tw.to.el - tw.from.el) * k;
      let da = tw.to.az - tw.from.az; da = Math.atan2(Math.sin(da), Math.cos(da));
      this.az = tw.from.az + da * k;
      if (tw.t >= 1) this.tween = null;
    } else {
      if (this.introGoal > 0) { this.d += (this.introGoal - this.d) * Math.min(1, dt * 1.3); this.panBy(dt * 0.1 * Math.min(1, (this.d - this.introGoal) / 1.5), 0); if (Math.abs(this.d - this.introGoal) < 0.02) this.introGoal = 0; }
      if (Math.abs(this.vel.mx) + Math.abs(this.vel.mz) > 1e-5) { this.panBy(this.vel.mx * dt, this.vel.mz * dt); const dec = Math.pow(0.05, dt); this.vel.mx *= dec; this.vel.mz *= dec; } else this.vel = { mx: 0, mz: 0 };
    }
    // exagération pilotée par le zoom ; terrain, ciel, atmosphère
    this.exag = this.exagFor(this.d);
    this.terrain.uniforms.uExag.value = this.exag;
    this.poseCamera();
    this.camera.updateMatrixWorld();
    this.pv.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    this.terrain.update(this.camera, this.frustum);
    this.syncLayers();
    for (const l of this.layers.values()) { this.syncLayer(l, false); this.syncMarks(l, false); }
    this.applyAtmosphere();
    this.clouds.rotation.y += dt * 0.012;
    if (this.ring.visible) { const p = 1 + Math.sin(this.time * 4) * 0.06; this.ring.scale.setScalar((this.ring.userData.base as number) * p); }
    this.updateLabels();
    this.reportLevel();
    this.r.three.render(this.scene, this.camera);
    const info = this.r.three.info.render;
    this.stats.drawCalls = info.calls; this.stats.tris = info.triangles;
    this.stats.chunks = this.terrain.stats.chunks; this.stats.drawn = this.terrain.stats.drawn; this.stats.pending = this.terrain.stats.pending; this.stats.workers = this.terrain.stats.workers;
    this.stats.buildings = [...this.layers.values()].reduce((s, l) => s + l.nHouses, 0);
  }

  private applyAtmosphere(): void {
    const cam = this.camera, alt = cam.position.length() - 1;
    const air = sstep(0.12, 1.2, alt); // 0 au ras du sol (ciel bleu), 1 dans l'espace
    (this.atmo.material as THREE.ShaderMaterial).uniforms.uFade.value = sstep(0.1, 0.9, alt);
    (this.clouds.material as THREE.MeshLambertMaterial).opacity = 0.55 * sstep(0.35, 1.1, alt);
    this.clouds.visible = alt > 0.35;
    (this.stars.material as THREE.PointsMaterial).opacity = air;
    this.r.three.setClearColor(SPACE.clone().lerp(SKY, 1 - air), 1);
    const blend = 1 - air;
    const sd = new THREE.Vector3(-3.6, 2.0, 3.0).normalize().lerp(new THREE.Vector3(-0.45, 0.85, 0.3).normalize(), blend).normalize();
    this.sun.position.copy(sd.multiplyScalar(10)); this.sun.target.position.set(0, 0, 0);
    this.sun.intensity = 2.8 - 0.4 * blend; this.hemi.intensity = 0.7 + 0.6 * blend;
    // repères : nets sur le globe, discrets près du sol ; bâtiments à l'échelle seulement de près
    for (const l of this.layers.values()) {
      const nearC = Math.acos(clamp(l.center[0] * this.P[0] + l.center[1] * this.P[1] + l.center[2] * this.P[2], -1, 1));
      const near = nearC < 0.5;
      const markA = sstep(0.018, 0.12, this.d);
      (l.marks.material as THREE.PointsMaterial).opacity = markA * 0.98; (l.halos.material as THREE.PointsMaterial).opacity = markA * 0.5;
      l.marks.visible = l.halos.visible = markA > 0.02;
      l.houses.visible = this.d < 0.16 && near && l.nHouses > 0;
      if (l.patch) l.patch.visible = this.d < 0.8 && near;
      const inhabited = this.ps.isInhabited(l.sim);
      l.outline.visible = inhabited && this.d > 0.25 && this.d < 2.8;
      (l.outline.material as THREE.LineBasicMaterial).opacity = 0.7 * sstep(0.25, 0.6, this.d);
    }
  }

  private reportLevel(): void {
    const mode: PlanetMode = this.d > LEVEL_D.region ? "planet" : "region";
    if (mode !== this.lastMode) { this.lastMode = mode; this.hooks.modeChanged(mode); }
    const lv = this.level;
    if (lv !== this.lastLevel) { this.lastLevel = lv; this.hooks.levelChanged(lv); if (this.sel && this.sel.kind !== "settlement") { this.hooks.card(null); this.ring.visible = false; this.sel = null; } }
    if (this.time - this.lastPlace > 0.4) { this.lastPlace = this.time; this.hooks.place(this.placeName()); }
  }

  /** « Calia · Forêts » : où se trouve le centre de l'écran. */
  placeName(): string {
    const cont = this.planet.continentAt(this.P);
    this.geo.sample(this.P, 0.02, this.smp);
    if (this.smp.h <= 0) return cont ? `${cont.name} (côte)` : "Océan";
    const bio = BIOME_NAME[this.smp.bio] ?? "";
    return `${cont?.name ?? "Terres"} · ${bio}${this.smp.riv > 0.3 ? " · vallée" : ""}`;
  }

  // ------------------------------------------------------------------ déplacement / interaction

  /** Déplace le point visé le long de la surface (mx : est, mz : axe de la carte), en radians. */
  private panBy(mx: number, mz: number): void {
    const f = frameAt(this.P);
    this.P = norm3([this.P[0] + f.e[0] * mx + f.s[0] * mz, this.P[1] + f.e[1] * mx + f.s[1] * mz, this.P[2] + f.e[2] * mx + f.s[2] * mz]);
  }

  private bindInput(): void {
    const el = this.r.three.domElement;
    el.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.vel = { mx: 0, mz: 0 }; this.introGoal = 0; this.tween = null;
      if (this.ptrs.size === 1) { this.down = { x: e.clientX, y: e.clientY, t: e.timeStamp }; this.moved = 0; this.multi = false; }
      else if (this.ptrs.size === 2) { this.multi = true; this.pinchInit(); }
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.active) return;
      const p = this.ptrs.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.ptrs.size === 1) {
        this.moved += Math.abs(dx) + Math.abs(dy);
        if (e.buttons === 2 || e.shiftKey) { this.az -= dx * 0.006; this.elPref = clamp(this.elPref + dy * 0.005, 0.12, 1.45); } else this.dragPan(dx, dy);
      } else if (this.ptrs.size === 2) this.pinchMove();
    });
    const up = (e: PointerEvent, cancel: boolean) => {
      if (!this.active) return;
      this.ptrs.delete(e.pointerId);
      if (this.ptrs.size === 0) {
        const dd = this.down; this.down = null;
        if (!cancel && dd && !this.multi && this.moved < 14 && e.timeStamp - dd.t < 600) this.tap(e.clientX, e.clientY);
        this.multi = false;
      } else if (this.ptrs.size === 1) this.pinchInit();
    };
    el.addEventListener("pointerup", (e) => up(e, false));
    el.addEventListener("pointercancel", (e) => up(e, true));
    el.addEventListener("wheel", (e) => { if (!this.active) return; e.preventDefault(); this.tween = null; this.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }

  /** Le doigt « tient » le sol : déplacement proportionnel à la distance, avec inertie. */
  private dragPan(dx: number, dy: number): void {
    const h = this.r.three.domElement.clientHeight || 800;
    const wpp = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.d) / h;
    const fx = -Math.cos(this.az), fz = -Math.sin(this.az), rx = Math.sin(this.az), rz = -Math.cos(this.az);
    const mx = (-dx * rx + dy * fx) * wpp, mz = (-dx * rz + dy * fz) * wpp;
    this.panBy(mx, mz);
    this.vel = { mx: mx * 50, mz: mz * 50 };
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
    const dd = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) || 1;
    const ang = Math.atan2(pts[1].y - pts[0].y, pts[1].x - pts[0].x), cy = (pts[0].y + pts[1].y) / 2;
    this.zoomBy(this.pinch0 / dd);
    let da = ang - this.twist0; da = Math.atan2(Math.sin(da), Math.cos(da));
    this.az -= da;
    if (this.d < 1.2) this.elPref = clamp(this.elPref + (cy - this.cy0) * 0.004, 0.12, 1.45);
    this.pinch0 = dd; this.twist0 = ang; this.cy0 = cy;
  }

  /** Le zoom est le moyen de navigation : de la planète au sol, en continu ; au contact du sol, on entre dans le village. */
  zoomBy(f: number): void {
    const nd = this.d * f;
    this.d = clamp(nd, D_LOCAL * 0.8, this.dMax);
    if (nd < D_LOCAL * 0.9 && f < 1 && this.lock <= 0) this.enterHere();
  }

  private pickDir(cx: number, cy: number): Vec3 | null {
    if (!this.terrain) return null;
    const el = this.r.three.domElement, rect = el.getBoundingClientRect();
    this.ray.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), this.camera);
    const o = this.ray.ray.origin, dv = this.ray.ray.direction;
    let rad = 1.0, dir: Vec3 | null = null;
    for (let it = 0; it < 4; it++) {
      const b = o.dot(dv), c = o.lengthSq() - rad * rad, disc = b * b - c;
      if (disc < 0) return dir;
      const t = -b - Math.sqrt(disc);
      if (t < 0) return dir;
      const p = o.clone().addScaledVector(dv, t).normalize();
      dir = [p.x, p.y, p.z];
      rad = this.terrain.radiusAt(dir);
    }
    return dir;
  }

  /** Village le plus proche du doigt (zone de toucher de 44 px), tous niveaux d'échelle confondus. */
  private settlementNear(cx: number, cy: number): { layer: Layer; id: number; x: number; y: number } | null {
    const el = this.r.three.domElement, rect = el.getBoundingClientRect(), v = new THREE.Vector3();
    let best: { layer: Layer; id: number; x: number; y: number; d: number } | null = null;
    for (const l of this.layers.values()) for (const s of this.planet.settlements(l.sim, l.region)) {
      const d = this.planet.localToDir(l.region, s.x, s.y), rad = this.surfaceRad(l, s.x, s.y, this.exag) + 0.002;
      v.set(d[0] * rad, d[1] * rad, d[2] * rad).project(this.camera);
      if (v.z > 1 || Math.abs(v.x) > 1.2) continue;
      const cam = this.camera.position, facing = (cam.x * d[0] + cam.y * d[1] + cam.z * d[2]) > 1.0 / Math.max(1.0001, cam.length());
      if (!facing) continue;
      const px = rect.left + (v.x * 0.5 + 0.5) * rect.width, py = rect.top + (-v.y * 0.5 + 0.5) * rect.height;
      const dd = Math.hypot(px - cx, py - cy);
      if (dd < 44 && (!best || dd < best.d)) best = { layer: l, id: s.id, x: s.x, y: s.y, d: dd };
    }
    return best;
  }

  private tap(cx: number, cy: number): void {
    const near = this.settlementNear(cx, cy);
    if (near) { this.selectVillage(near.layer, near.id, near.x, near.y); return; }
    const dir = this.pickDir(cx, cy);
    if (!dir) { this.hooks.card(null); this.ring.visible = false; this.sel = null; return; }
    this.selectLand(dir);
  }

  private selectVillage(l: Layer, id: number, x: number, y: number): void {
    const sim = l.sim, city = sim.cityById.get(id);
    if (!city) return;
    const civ = sim.civById.get(city.civ), nb = sim.buildings.filter((b) => b.city === city.id && b.progress >= 1 && b.civ >= 0).length;
    const dir = this.planet.localToDir(l.region, x, y);
    this.placeRing(dir);
    this.sel = { kind: "settlement", dir, region: l.region.id, x, y, id };
    this.hooks.card({ kind: "settlement", title: city.name, lines: [`${civ?.name ?? "?"}${civ?.capital === city.id ? " · capitale" : ""}`, `${city.pop} habitants · ${nb} bâtiments · époque ${civ ? civ.era + 1 : "?"}`, `${this.planet.continentAt(dir)?.name ?? "Terres"} · An ${sim.year}`], actions: [{ id: "enter", label: "Entrer dans le village" }] });
  }

  private selectLand(dir: Vec3): void {
    const pl = this.planet;
    this.geo.sample(dir, 0.003, this.smp);
    const cont = pl.continentAt(dir);
    this.placeRing(dir);
    if (this.smp.h <= 0.02) {
      this.sel = { kind: "ocean", dir, region: -1, x: 0, y: 0, id: -1 };
      this.hooks.card({ kind: "ocean", title: this.smp.h < -1 ? "Fosse océanique" : "Océan", lines: ["Eaux ouvertes. Aucune terre à proximité immédiate."], actions: [] });
      return;
    }
    this.sel = { kind: "land", dir, region: -1, x: 0, y: 0, id: -1 };
    const bio = BIOME_NAME[this.smp.bio] ?? "Terres";
    const lines = [`${cont ? (cont.kind === "continent" ? "Continent" : "Île") + ` · ${cont.areaPct.toFixed(1)} % de la planète` : "Terres émergées"}`, `Ici : ${bio}${this.smp.riv > 0.3 ? " (vallée fluviale)" : ""}`];
    const at = pl.regionAt(dir, 0);
    const eng = at ? this.ps.engineOf(at.id) : undefined;
    lines.push(eng && this.ps.isInhabited(eng) ? "Un peuple vit ici." : "Terres libres : aucune civilisation connue ici.");
    this.hooks.card({ kind: "land", title: cont?.name ?? "Terres émergées", lines, actions: [this.d > 0.45 ? { id: "zoom", label: "Zoomer ici" } : { id: "enter", label: "Descendre ici" }] });
  }

  /** Action d'un bouton de la fiche. */
  action(id: string): void {
    const s = this.sel;
    if (id === "zoom" && s) { this.hooks.card(null); this.flyTo({ P: s.dir, d: this.d > 1.2 ? this.dContinent : this.dRegion }, 1.2); }
    else if (id === "enter") this.enterHere(s?.dir);
  }

  /** Descend dans la scène locale au point visé (ou au point donné) : la carte locale de ce lieu est créée si nécessaire. */
  enterHere(dir?: Vec3): void {
    const P = dir ?? this.P;
    const sel = this.sel;
    let region: Region | null | undefined;
    if (sel && sel.kind === "settlement" && sel.region >= 0) region = this.planet.regionById(sel.region);
    if (!region) region = this.planet.ensureRegionAt(P);
    if (!region) { this.hooks.card(null); return; } // l'océan n'a pas de carte locale
    this.ps.ensure(region.id);
    this.syncLayers();
    const target = sel && sel.kind === "settlement" ? this.planet.localToDir(region, sel.x, sel.y) : P;
    const l = this.planet.dirToLocal(region, target), N = region.size;
    this.hooks.enterLocal({ region: region.id, x: clamp(l?.x ?? N / 2, 2, N - 2), y: clamp(l?.y ?? N / 2, 2, N - 2), dist: Math.max(8, this.d / TILE_RAD * 0.6), el: this.elEff() > 1.2 ? 0.8 : this.elEff(), az: this.az });
  }

  /** Reprise de la vue continue à partir d'une pose locale (retour depuis la scène détaillée) : même lieu, même orientation, vue un peu reculée. */
  enterRegionFromLocal(p: LocalPose): void {
    const region = this.planet.regionById(p.region);
    if (!region) return;
    this.syncLayers();
    this.P = this.planet.localToDir(region, p.x, p.y);
    this.d = clamp(Math.max(p.dist * TILE_RAD * 1.2, 0.05), D_LOCAL * 1.5, 0.4);
    this.elPref = clamp(p.el, 0.12, 1.45); this.az = p.az;
    this.tween = null; this.ring.visible = false; this.sel = null; this.hooks.card(null);
    this.lock = 1.0;
    this.poseCamera();
  }

  /** Pose locale équivalente à la vue (1 case = 1 unité). */
  localPose(): LocalPose {
    const region = this.planet.ensureRegionAt(this.P) ?? this.planet.regions[0], N = region.size;
    const l = this.planet.dirToLocal(region, this.P);
    return { region: region.id, x: clamp(l?.x ?? N / 2, 2, N - 2), y: clamp(l?.y ?? N / 2, 2, N - 2), dist: Math.max(8, this.d / TILE_RAD * 0.6), el: this.elEff() > 1.2 ? 0.8 : this.elEff(), az: this.az };
  }

  /** Recentre le globe sur un continent (sélecteur) : zoom animé et fiche. */
  focusContinent(id: number): void {
    const c = this.planet.continents()[id];
    if (!c) return;
    const d = dirOf(c.lat, c.lon);
    let best: Vec3 = d;
    const f = frameAt(d);
    for (let k = 0; k < 60 && this.planet.height(best) < 0.03; k++) { const a = k * 2.4, rr = 0.03 * (1 + k * 0.22); best = norm3([d[0] + (f.e[0] * Math.cos(a) + f.s[0] * Math.sin(a)) * rr, d[1] + (f.e[1] * Math.cos(a) + f.s[1] * Math.sin(a)) * rr, d[2] + (f.e[2] * Math.cos(a) + f.s[2] * Math.sin(a)) * rr]); }
    this.flyTo({ P: best, d: Math.min(this.d, this.portrait ? 3.2 : 1.9), az: -Math.PI / 2 }, 1.1);
    this.selectLand(best);
  }
  /** Recentre sur la carte d'origine et revient à l'échelle planète. */
  recenter(): void {
    const home = this.planet.regionById(this.ps.activeId) ?? this.planet.regions[0];
    this.flyTo({ P: this.planet.regionCenter(home), d: this.dPlanet, az: -Math.PI / 2 }, 1.2);
  }
  continentChoices(): { id: number; name: string }[] {
    return this.planet.continents().filter((c) => c.areaPct > 2.5).slice(0, 7).map((c) => ({ id: c.id, name: c.name }));
  }

  private placeRing(d: Vec3): void {
    const rad = this.groundRadius(d) + 0.0004;
    this.ring.position.set(d[0] * rad, d[1] * rad, d[2] * rad);
    this.ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(d));
    const size = clamp(this.d * 0.035, 0.0004, 0.07);
    this.ring.scale.setScalar(size); this.ring.userData.base = size; this.ring.visible = true;
  }

  /** Placement direct (tests, scripts). */
  setView(v: { P?: Vec3; d?: number; el?: number; az?: number; region?: number; mode?: PlanetMode }): void {
    this.tween = null;
    if (v.region !== undefined) { const r = this.planet.regionById(v.region); if (r) this.P = this.planet.regionCenter(r); }
    if (v.P) this.P = v.P;
    if (v.d !== undefined) this.d = v.d;
    else if (v.mode === "region") this.d = this.dRegion;
    else if (v.mode === "planet") this.d = this.dPlanet;
    if (v.el !== undefined) this.elPref = v.el;
    if (v.az !== undefined) this.az = v.az;
    this.poseCamera();
  }
  get state() { return { mode: this.lastMode, level: this.level, d: this.d, el: this.elEff(), az: this.az, P: this.P.slice() as Vec3, tween: !!this.tween, exag: this.exag }; }
  get layerIds(): number[] { return [...this.layers.keys()]; }
  get terrainStats() { return this.terrain?.stats; }

  // ------------------------------------------------------------------ étiquettes

  private label(key: string, text: string, cls: string): HTMLElement {
    let e = this.labels.get(key);
    if (!e) { e = document.createElement("div"); e.className = "plbl " + cls; this.labelsEl.appendChild(e); this.labels.set(key, e); }
    if (e.textContent !== text) e.textContent = text;
    return e;
  }
  private updateLabels(): void {
    const el = this.r.three.domElement, w = el.clientWidth, h = el.clientHeight, pad = 8;
    const v = new THREE.Vector3(), cam = this.camera.position;
    const live = new Set<string>();
    const placed: { x: number; y: number; w: number }[] = [];
    const place = (key: string, text: string, cls: string, d: Vec3, rad: number, lift = 0) => {
      const e = this.label(key, text, cls);
      live.add(key);
      v.set(d[0] * rad, d[1] * rad, d[2] * rad);
      const facing = (cam.x * d[0] + cam.y * d[1] + cam.z * d[2]) > 1.0 / Math.max(1.0001, cam.length()) + 0.02;
      v.project(this.camera);
      const lw = e.offsetWidth || text.length * 7;
      // le texte reste entièrement à l'écran ; deux étiquettes ne se superposent jamais (la plus importante, placée d'abord, gagne)
      const px = clamp((v.x * 0.5 + 0.5) * w, pad + lw / 2, w - pad - lw / 2), py = (-v.y * 0.5 + 0.5) * h - lift;
      const clash = placed.some((p) => Math.abs(p.x - px) < (p.w + lw) / 2 + 6 && Math.abs(p.y - py) < 18);
      const onScreen = v.z < 1 && Math.abs(v.x) < 1.15 && Math.abs(v.y) < 1.1 && py > 96 && py < h - 8;
      const vis = facing && onScreen && !clash;
      e.style.display = vis ? "block" : "none";
      if (vis) { e.style.transform = `translate(-50%,-100%) translate(${px}px,${py}px)`; placed.push({ x: px, y: py, w: lw }); }
    };
    // villages : nom et population quand on est assez près, sinon repère seul
    if (this.d < 1.6) {
      for (const l of this.layers.values()) for (const s of this.planet.settlements(l.sim, l.region)) {
        const d = this.planet.localToDir(l.region, s.x, s.y), rad = this.surfaceRad(l, s.x, s.y, this.exag) + 0.003 + 0.004 * sstep(0.2, 1.6, this.d);
        place("s" + l.region.id + ":" + s.id, `${s.capital ? "★ " : ""}${s.name}${this.d < 0.5 ? ` · ${s.pop}` : ""}`, "city", d, rad, 10);
      }
    }
    // continents : noms espacés, seulement à l'échelle globe/continent
    if (this.d > 0.9) for (const c of this.planet.continents().slice(0, 7)) if (c.areaPct > 2.5) place("c" + c.id, c.name, "cont", dirOf(c.lat, c.lon), 1.03 + 0.03 * sstep(1, 3, this.d));
    for (const [k, e] of this.labels) if (!live.has(k)) { e.remove(); this.labels.delete(k); }
  }
}

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
