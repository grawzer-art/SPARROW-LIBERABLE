import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { hash2 } from "../sim/rng";
import { findPath } from "../sim/path";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { T } from "../sim/World";
import { Vegetation } from "./Vegetation";
import { BuildingLayer } from "./BuildingLayer";
import { CitizenLayer } from "./CitizenLayer";
import { Infra } from "./Infra";
import { Terrain } from "./Terrain";
import { Water } from "./Water";
import { Sky } from "./Sky";
import { Props } from "./Props";
import { Glow } from "./Glow";
import { Fx } from "./Fx";

const SOIL = new THREE.Color(0x6b5440), SOIL_DARK = new THREE.Color(0x3d2f25);

/** Rendu 3D : ne lit que l'état de la simulation, ne contient jamais de logique de jeu. */
export class Renderer {
  readonly three: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(32, 1, 0.5, 400);
  readonly controls: OrbitControls;
  sim!: SimulationEngine;
  N = 64;
  private el: HTMLElement;
  private labelsEl: HTMLElement;
  private raycaster = new THREE.Raycaster();
  private dummy = new THREE.Object3D();
  private tmpColor = new THREE.Color();
  private time = 0;
  fx: Fx;

  private terr!: Terrain;
  private waterObj!: Water;
  private skirt!: THREE.Mesh;
  sky!: Sky;
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private heightVer = -1;
  private vegClock = -10;
  private vegHeight = -1;
  private pathVer = -1;
  private veg!: Vegetation;
  private bld!: BuildingLayer;
  private cit!: CitizenLayer;
  private infra!: Infra;
  private props!: Props;
  private glow!: Glow;
  private borders!: THREE.Mesh;
  private ringTarget: THREE.Mesh;
  private ringTargetFill: THREE.Mesh;
  private ringSelect: THREE.Mesh;
  private cursorOn = false;
  private labels = new Map<number, HTMLDivElement>();
  private lastVer = { terrain: -1, owner: -1, fire: -1, tree: -1 };
  private lastSlow = 0;
  private keys = new Set<string>();
  private shakeAmp = 0;
  private lastShake = new THREE.Vector3();
  /** Glissement fluide vers une cible (ciblage d'un village ou d'un habitant). */
  private tween: { t: THREE.Vector3; d: number } | null = null;
  private sph = new THREE.Spherical();
  private off = new THREE.Vector3();
  private flameTiles: number[] = [];
  private urbanVer = -1;
  private urban = new Uint8Array(0);
  selection: { kind: "none" | "civ" | "citizen" | "city" | "building"; id: number } = { kind: "none", id: -1 };

  readonly mobile: boolean;
  private quality = 0;
  private basePR = 1;
  private qEma = 16;
  private qClock = 0;
  private qGood = 0;
  private frameNo = 0;
  private shadowClock = 0;
  private inset = 0;
  private insetTarget = 0;
  private sun!: THREE.DirectionalLight;

  constructor(container: HTMLElement, labelsEl: HTMLElement, opts: { mobile?: boolean } = {}) {
    this.mobile = !!opts.mobile;
    this.el = container;
    this.labelsEl = labelsEl;
    const dpr = window.devicePixelRatio || 1;
    this.three = new THREE.WebGLRenderer({ antialias: !this.mobile || dpr < 2, alpha: true, powerPreference: this.mobile ? "default" : "high-performance" });
    this.basePR = Math.min(dpr, this.mobile ? 2 : 2);
    this.three.setPixelRatio(this.basePR);
    this.three.shadowMap.enabled = true;
    if (this.mobile) this.three.shadowMap.autoUpdate = false;
    this.three.shadowMap.type = THREE.PCFSoftShadowMap;
    this.three.setClearColor(0x000000, 0);
    container.appendChild(this.three.domElement);
    this.three.domElement.style.touchAction = "none";

    this.camera.position.set(52, 58, 52);
    this.controls = new OrbitControls(this.camera, this.three.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 135;
    this.controls.maxPolarAngle = Math.PI * 0.43;
    this.controls.minPolarAngle = 0.2;
    this.controls.addEventListener("start", () => { this.tween = null; });
    this.controls.target.set(0, 0.5, 0);
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    // tactile : 1 doigt = déplacer, 2 doigts = zoom (+ pivoter) ; bureau : 1 doigt = pivoter
    this.controls.touches = this.mobile ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.panSpeed = 1.15;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.update();

    // lumières douces
    const hemi = new THREE.HemisphereLight(0xdbeaff, 0x7a6650, 1.35);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
    sun.position.set(-28, 52, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    this.sun = sun;
    const sc = sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 10; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun, sun.target);
    const amb = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(amb);
    this.sky = new Sky(this.scene, sun, hemi, amb, this.three, this.mobile);

    // anneaux de ciblage
    const ringGeo = new THREE.RingGeometry(0.94, 1, 64);
    ringGeo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false });
    this.ringTarget = new THREE.Mesh(ringGeo, mat);
    this.ringTarget.renderOrder = 20; this.ringTarget.visible = false;
    const fillGeo = new THREE.CircleGeometry(1, 48);
    fillGeo.rotateX(-Math.PI / 2);
    this.ringTargetFill = new THREE.Mesh(fillGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, depthTest: false }));
    this.ringTargetFill.renderOrder = 19; this.ringTargetFill.visible = false;
    this.ringSelect = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false }));
    this.ringSelect.renderOrder = 21; this.ringSelect.visible = false;
    this.scene.add(this.ringTarget, this.ringTargetFill, this.ringSelect);

    this.fx = new Fx(this.scene, this.mobile ? 1400 : 3200);
    window.addEventListener("resize", () => this.resize());
    window.addEventListener("orientationchange", () => setTimeout(() => this.resize(), 250));
    this.three.domElement.addEventListener("webglcontextlost", (e) => e.preventDefault());
    this.three.domElement.addEventListener("webglcontextrestored", () => { if (this.sim) this.setSim(this.sim); });
    window.addEventListener("keydown", (e) => { if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) this.keys.add(e.key.toLowerCase()); });
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener("blur", () => this.keys.clear());
    this.resize();
  }

  resize(): void {
    const w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    this.three.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 46 : 32;
    this.camera.updateProjectionMatrix();
    this.fx?.setScale(h * this.three.getPixelRatio(), this.camera.fov);
    this.glow?.setScale(h * this.three.getPixelRatio(), this.camera.fov);
    this.applyInset(true);
  }

  // ------------------------------------------------------------------ construction de la scène

  setSim(sim: SimulationEngine): void {
    this.sim = sim;
    this.N = sim.world.size;
    for (const c of [this.skirt, this.borders]) {
      if (c) { this.scene.remove(c); c.geometry.dispose(); }
    }
    this.terr?.dispose(this.scene); this.waterObj?.dispose(this.scene);
    this.heightVer = -1; this.pathVer = -1; this.vegHeight = -1;
    this.bld?.clear(); this.cit?.clear(); this.infra?.clear(); this.props?.clear();
    for (const el of this.labels.values()) el.remove();
    this.labels.clear();
    this.fx.clear();
    this.weatherObjs.clear();
    this.buildStatic();
    this.lastVer = { terrain: -1, owner: -1, fire: -1, tree: -1 };
    this.selection = { kind: "none", id: -1 };
    this.ringSelect.visible = false;
  }

  private buildStatic(): void {
    const N = this.N;
    // terrain doux, eau, jupe de la maquette
    this.terr = new Terrain(this.scene, N, this.mobile);
    const sg = new THREE.BufferGeometry();
    this.skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    this.skirt.frustumCulled = false;
    this.scene.add(this.skirt);
    this.waterObj = new Water(this.scene, N, this.sky, this.mobile);
    // arbres
    this.veg?.clear();
    this.veg = this.veg ?? new Vegetation(this.scene, this.mobile, this.sky);
    // bâtiments, habitants, infrastructures : couches modulaires (géométries réutilisées, instanciation)
    this.bld = new BuildingLayer(this.scene, this.sky);
    this.cit = new CitizenLayer(this.scene, this.mobile, this.sky);
    this.infra = new Infra(this.scene, this.mobile);
    this.props = new Props(this.scene);
    this.glow = this.glow ?? new Glow(this.scene, this.sky, this.mobile ? 500 : 900);
    // frontières & routes
    this.borders = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.borders.renderOrder = 5; this.borders.frustumCulled = false;
    this.scene.add(this.borders);
  }

  // ------------------------------------------------------------------ terrain

  private computeUrban(): void {
    const w = this.sim.world, N = this.N;
    if (this.urban.length !== N * N) this.urban = new Uint8Array(N * N);
    this.urban.fill(0);
    for (const b of this.sim.buildings) {
      if (b.hp < 0 || b.progress < 1 || b.civ < 0 || b.type === "farm") continue;
      const code = b.era + 1;
      for (const [dx, dy, strong] of [[0, 0, 8], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]] as [number, number, number][]) {
        const x = b.x + dx, y = b.y + dy;
        if (!w.inb(x, y)) continue;
        const i = y * N + x, cur = this.urban[i];
        if (cur === 0 || (cur & 7) < code || (strong && (cur & 8) === 0 && (cur & 7) <= code)) this.urban[i] = code | strong;
      }
    }
  }

  private rebuildTerrain(): void {
    this.computeUrban();
    const w = this.sim.world;
    if (this.heightVer !== w.terrainV) { this.terr.rebuildHeights(w); this.rebuildSkirt(); this.heightVer = w.terrainV; }
    const civ = this.sim.civById;
    this.terr.rebuildColors(w, (i) => { const o = w.owner[i]; const c = o >= 0 ? civ.get(o) : undefined; return c ? c.color : -1; }, this.urban, this.infra.paths);
    this.pathVer = this.infra.pathVer;
  }

  /** Jupe de la maquette : coupe de terrain suivant exactement la surface lisse. */
  private rebuildSkirt(): void {
    const w = this.sim.world, N = this.N;
    const SEG = 4;
    const pos: number[] = [], col: number[] = [];
    const bottom = -2.2;
    const soil = SOIL, soilDark = SOIL_DARK, wTop = new THREE.Color(0x4a8fae), wBot = new THREE.Color(0x22506b);
    const push = (x: number, y: number, z: number, c: THREE.Color) => { pos.push(x, y, z); col.push(c.r, c.g, c.b); };
    const hN = N / 2;
    const edge = (fx: (t: number) => [number, number], flip: boolean) => {
      for (let i = 0; i < N * SEG; i++) {
        const [ax, ay] = fx(i / SEG), [bx, by] = fx((i + 1) / SEG);
        const ha = w.heightAt(ax, ay), hb = w.heightAt(bx, by);
        const water = (ha + hb) / 2 < -0.02;
        const ta = water ? 0 : ha, tb = water ? 0 : hb;
        const cT = water ? wTop : soil, cB = water ? wBot : soilDark;
        const A = [ax - hN, ta, ay - hN], B = [bx - hN, tb, by - hN];
        const verts: [number[], THREE.Color][] = flip
          ? [[A, cT], [[bx - hN, bottom, by - hN], cB], [B, cT], [A, cT], [[ax - hN, bottom, ay - hN], cB], [[bx - hN, bottom, by - hN], cB]]
          : [[A, cT], [B, cT], [[bx - hN, bottom, by - hN], cB], [A, cT], [[bx - hN, bottom, by - hN], cB], [[ax - hN, bottom, ay - hN], cB]];
        for (const [p, c] of verts) push(p[0], p[1], p[2], c);
      }
    };
    edge((t) => [t, 0], true); edge((t) => [t, N], false); edge((t) => [0, t], false); edge((t) => [N, t], true);
    const g = this.skirt.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
  }

  private rebuildBorders(): void {
    const w = this.sim.world, N = this.N, m = N + 1;
    const pos: number[] = [], col: number[] = [];
    const c = new THREE.Color();
    const addQuad = (ax: number, az: number, ah: number, bx: number, bz: number, bh: number, ix: number, iz: number, width: number, color: number) => {
      c.setHex(color);
      const a2x = ax + ix * width, a2z = az + iz * width, b2x = bx + ix * width, b2z = bz + iz * width;
      const y = 0.045;
      const vs = [[ax, ah + y, az], [bx, bh + y, bz], [b2x, bh + y, b2z], [ax, ah + y, az], [b2x, bh + y, b2z], [a2x, ah + y, a2z]];
      for (const v of vs) { pos.push(v[0] - N / 2, v[1], v[2] - N / 2); col.push(c.r, c.g, c.b); }
    };
    for (let ty = 0; ty < N; ty++)
      for (let tx = 0; tx < N; tx++) {
        const i = ty * N + tx, o = w.owner[i];
        if (o < 0) continue;
        const civ = this.sim.civById.get(o);
        if (!civ) continue;
        // [voisin dx, dy, coin A (cx,cy), coin B, normale vers l'intérieur]
        const edges: [number, number, number, number, number, number, number, number][] = [
          [0, -1, tx, ty, tx + 1, ty, 0, 1],
          [0, 1, tx, ty + 1, tx + 1, ty + 1, 0, -1],
          [-1, 0, tx, ty, tx, ty + 1, 1, 0],
          [1, 0, tx + 1, ty, tx + 1, ty + 1, -1, 0],
        ];
        for (const [dx, dy, ax, ay, bx, by, ix, iz] of edges) {
          const nx = tx + dx, ny = ty + dy;
          let no = -2;
          if (w.inb(nx, ny)) no = w.owner[ny * N + nx]; else continue;
          if (no === o) continue;
          if (w.type[ny * N + nx] === T.WATER) continue;
          const rival = no >= 0;
          addQuad(ax, ay, w.heightAt(ax, ay), bx, by, w.heightAt(bx, by), ix, iz, rival ? 0.16 : 0.08, rival ? civ.color : this.tmpColor.setHex(civ.color).lerp(new THREE.Color(0xffffff), 0.35).getHex());
        }
      }
    const g = this.borders.geometry;
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
    g.computeBoundingSphere();
  }

  // ------------------------------------------------------------------ mise à jour par frame

  /** Fumée des cheminées (forges, usines, maisons de brique) : seulement quand la caméra est assez proche. */
  private emitSmoke(dt: number): void {
    const src = this.bld.smoke;
    if (!src.length) return;
    const dist = this.camera.position.distanceTo(this.controls.target);
    if (dist > (this.mobile ? 50 : 70)) return;
    const rate = (this.mobile ? 5 : 10) * dt;
    for (const [x, y, z] of src) if (Math.random() < rate * 0.1) this.fx.smoke(x, y, z);
  }

  /** Incendies et feux de camp : sprites de flammes, braises et fumée (la propagation vient du monde simulé). */
  private updateFlames(dt: number): void {
    const w = this.sim.world, N = this.N;
    if (this.sim.tick % 4 === 0 || this.lastSlow === 0) {
      this.flameTiles.length = 0;
      for (let i = 0; i < w.fire.length && this.flameTiles.length < 400; i++) if (w.fire[i] > 0) this.flameTiles.push(i);
    }
    const near = this.camera.position.distanceTo(this.controls.target) < (this.mobile ? 85 : 120);
    if (!near) return;
    let budget = this.mobile ? 40 : 90;
    const rate = dt * (this.mobile ? 9 : 14);
    for (const i of this.flameTiles) {
      if (budget <= 0) break;
      const x = i % N, y = (i / N) | 0;
      const intensity = w.trees[i] > 0 || w.bld[i] >= 0 ? 1 : 0.6;
      for (let k = 0; k < 2; k++) {
        if (Math.random() < rate) {
          const px = x + 0.25 + Math.random() * 0.5, pz = y + 0.25 + Math.random() * 0.5;
          this.fx.flame(px - N / 2, w.heightAt(px, pz) + 0.05, pz - N / 2, intensity);
          budget--;
        }
      }
      if (Math.random() < dt * 3) this.fx.smoke(x + 0.5 - N / 2, w.heightAt(x + 0.5, y + 0.5) + 0.35, y + 0.5 - N / 2);
    }
    for (const [fx, fy, fz] of this.bld.fires) {
      if (Math.random() < rate * 2) this.fx.flame(fx, fy, fz, 0.8);
      if (Math.random() < dt * 1.2) this.fx.smoke(fx, fy + 0.25, fz);
    }
  }

  private updateLabels(): void {
    const sim = this.sim;
    const v = new THREE.Vector3();
    const w = this.el.clientWidth, h = this.el.clientHeight;
    const live = new Set<number>();
    for (const city of sim.cities) {
      live.add(city.id);
      let el = this.labels.get(city.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "citylabel";
        this.labelsEl.appendChild(el);
        this.labels.set(city.id, el);
      }
      const civ = sim.civById.get(city.civ);
      v.set(city.x + 0.5 - this.N / 2, sim.world.heightAt(city.x + 0.5, city.y + 0.5) + 1.3, city.y + 0.5 - this.N / 2).project(this.camera);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
      el.style.display = visible ? "block" : "none";
      if (!visible) continue;
      el.style.transform = `translate(-50%,-100%) translate(${(v.x * 0.5 + 0.5) * w}px,${(-v.y * 0.5 + 0.5) * h}px)`;
      const cap = civ && civ.capital === city.id ? "★ " : "";
      const siege = city.siege > 0 ? " ⚔" : "";
      const key = `${cap}${city.name}|${city.pop}|${city.civ}|${siege}`;
      if (el.dataset.k !== key) {
        el.dataset.k = key;
        el.innerHTML = `<i style="background:#${(civ?.color ?? 0x888888).toString(16).padStart(6, "0")}"></i>${cap}${city.name}<b>${city.pop}</b>${siege}`;
      }
      el.classList.toggle("sel", this.selection.kind === "city" && this.selection.id === city.id);
    }
    for (const [id, el] of this.labels) if (!live.has(id)) { el.remove(); this.labels.delete(id); }
  }

  private keyboardPan(dt: number): void {
    if (this.keys.size === 0) return;
    const k = this.keys;
    let fx = 0, fz = 0, rot = 0;
    if (k.has("w") || k.has("arrowup")) fz -= 1;
    if (k.has("s") || k.has("arrowdown")) fz += 1;
    if (k.has("a") || k.has("arrowleft")) fx -= 1;
    if (k.has("d") || k.has("arrowright")) fx += 1;
    if (k.has("q")) rot -= 1;
    if (k.has("e")) rot += 1;
    if (k.has("+") || k.has("=")) this.zoom(0.97);
    if (k.has("-")) this.zoom(1.03);
    if (fx || fz) {
      const dist = this.camera.position.distanceTo(this.controls.target);
      const sp = dist * 0.9 * dt;
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      dir.y = 0; dir.normalize();
      const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0));
      const mv = dir.multiplyScalar(-fz * sp).add(right.multiplyScalar(fx * sp));
      this.controls.target.add(mv);
      this.camera.position.add(mv);
    }
    if (rot) {
      const off = this.camera.position.clone().sub(this.controls.target);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), rot * dt * 1.6);
      this.camera.position.copy(this.controls.target).add(off);
    }
  }

  private shHalf = 48;
  /**
   * Ombres nettes de près : la caméra d'ombre du soleil suit la cible et sa taille suit le zoom (résolution ~3x meilleure en vue rapprochée) ;
   * la position est calée sur la grille de texels pour éviter le scintillement.
   */
  private followShadow(): void {
    const tg = this.controls.target, dist = this.camera.position.distanceTo(tg);
    const half = Math.max(14, Math.min(52, dist * 0.8));
    const sc = this.sun.shadow.camera;
    if (Math.abs(half - this.shHalf) > this.shHalf * 0.06) {
      this.shHalf = half;
      sc.left = -half; sc.right = half; sc.top = half; sc.bottom = -half; sc.near = 5; sc.far = 190;
      sc.updateProjectionMatrix();
    }
    const texel = (2 * this.shHalf) / this.sun.shadow.mapSize.x;
    const sx = Math.round(tg.x / texel) * texel, sz = Math.round(tg.z / texel) * texel;
    this.sun.target.position.set(sx, tg.y, sz);
    this.sun.position.set(sx + this.sky.sunOffset.x, tg.y + this.sky.sunOffset.y, sz + this.sky.sunOffset.z);
    this.sun.target.updateMatrixWorld();
  }

  zoom(f: number): void {
    const off = this.camera.position.clone().sub(this.controls.target);
    const d = Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, off.length() * f));
    off.setLength(d);
    this.camera.position.copy(this.controls.target).add(off);
  }
  rotate(a: number): void {
    const off = this.camera.position.clone().sub(this.controls.target);
    off.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
    this.camera.position.copy(this.controls.target).add(off);
  }
  /** Cadre l'ensemble des villes : centre de leur emprise, distance déduite de l'étendue et du format de l'écran, ~50° d'élévation. */
  resetCamera(): void {
    const portrait = this.camera.aspect < 1;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    if (this.sim) for (const c of this.sim.cities) {
      const x = c.x + 0.5 - this.N / 2, z = c.y + 0.5 - this.N / 2;
      minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    }
    let tx = 0, tz = 0, d = portrait ? 80 : 88;
    if (isFinite(minX)) {
      tx = (minX + maxX) / 2; tz = (minZ + maxZ) / 2;
      const extent = Math.max(maxX - minX, maxZ - minZ, 12) + 16;
      const half = Math.tan((this.camera.fov * Math.PI) / 360) * Math.min(this.camera.aspect, 1.6);
      d = Math.max(30, Math.min(100, (extent * 0.62) / half));
    }
    const ty = this.sim ? Math.max(0, this.sim.world.heightAt(tx + this.N / 2, tz + this.N / 2)) : 0;
    this.tween = null;
    this.controls.target.set(tx, ty, tz);
    const el = (50 * Math.PI) / 180;
    this.camera.position.set(tx + d * Math.cos(el) * 0.7071, ty + d * Math.sin(el), tz + d * Math.cos(el) * 0.7071);
  }

  /** Décale la scène vers le haut quand un bottom sheet masque le bas de l'écran. */
  setBottomInset(px: number): void {
    this.insetTarget = Math.max(0, px);
  }
  private applyInset(force = false): void {
    const w = this.el.clientWidth || window.innerWidth, h = this.el.clientHeight || window.innerHeight;
    if (this.inset > 0.5) this.camera.setViewOffset(w, h, 0, this.inset / 2, w, h);
    else if (force || this.camera.view?.enabled) this.camera.clearViewOffset();
  }

  /** Qualité adaptative : on dégrade la résolution puis les ombres si l'appareil peine. */
  private adaptQuality(dtMs: number): void {
    if (!this.mobile) return;
    this.qEma += (Math.min(dtMs, 100) - this.qEma) * 0.05;
    this.qClock += dtMs;
    if (this.qClock < 2500) return;
    this.qClock = 0;
    if (this.qEma > 24 && this.quality < 3) { this.setQuality(this.quality + 1); this.qGood = 0; }
    else if (this.qEma < 15.5 && this.quality > 0 && ++this.qGood >= 6) { this.setQuality(this.quality - 1); this.qGood = 0; }
    else if (this.qEma >= 15.5) this.qGood = 0;
  }
  setQuality(q: number): void {
    this.quality = q;
    const pr = [this.basePR, Math.min(this.basePR, 1.5), Math.min(this.basePR, 1.2), 1][q];
    this.three.setPixelRatio(pr);
    this.three.setSize(this.el.clientWidth || window.innerWidth, this.el.clientHeight || window.innerHeight);
    this.sun.castShadow = q < 3;
    this.veg.setShadows(q < 2);
    this.fx.setScale(this.el.clientHeight * this.three.getPixelRatio(), this.camera.fov);
    this.glow.setScale(this.el.clientHeight * this.three.getPixelRatio(), this.camera.fov);
  }
  get qualityLevel(): number { return this.quality; }
  /** Intervalle minimal entre deux rendus (ms). */
  get frameInterval(): number {
    return this.mobile ? (this.quality >= 3 ? 33 : 15) : 0;
  }
  /** Se rapproche en douceur d'un point : l'inclinaison est ramenée dans une plage lisible (jamais rasante, jamais verticale). */
  focusOn(x: number, y: number, dist = 26, instant = false): void {
    const t = new THREE.Vector3(x - this.N / 2, Math.max(0, this.sim.world.heightAt(x, y)) + 0.2, y - this.N / 2);
    this.tween = { t, d: Math.max(this.controls.minDistance, Math.min(this.controls.maxDistance, dist)) };
    if (instant) { this.stepTween(1); this.tween = null; }
  }
  private stepTween(k: number): void {
    const tw = this.tween;
    if (!tw) return;
    this.off.copy(this.camera.position).sub(this.controls.target);
    this.sph.setFromVector3(this.off);
    this.controls.target.lerp(tw.t, k);
    this.sph.radius += (tw.d - this.sph.radius) * k;
    const phiGoal = Math.max(0.55, Math.min(1.0, this.sph.phi));
    this.sph.phi += (phiGoal - this.sph.phi) * k;
    this.off.setFromSpherical(this.sph);
    this.camera.position.copy(this.controls.target).add(this.off);
    if (this.controls.target.distanceToSquared(tw.t) < 0.0004 && Math.abs(this.sph.radius - tw.d) < 0.02) this.tween = null;
  }

  /** Fixe l'heure (0 minuit, 0.5 midi) et suspend le cycle automatique ; `null` le relance. */
  setTimeOfDay(t: number | null): void {
    if (t === null) { this.sky.auto = true; return; }
    this.sky.auto = false;
    this.sky.setTime(t);
  }

  shake(a: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, a);
  }

  // ------------------------------------------------------------------ frame

  frame(dt: number, alpha: number): void {
    this.time += dt;
    this.frameNo++;
    this.adaptQuality(dt * 1000);
    const sim = this.sim;
    if (!sim) return;
    if (Math.abs(this.insetTarget - this.inset) > 0.3) { this.inset += (this.insetTarget - this.inset) * Math.min(1, dt * 9); this.applyInset(); }
    const w = sim.world;
    this.keyboardPan(dt);
    // limites de la caméra
    const lim = this.N * 0.55;
    this.controls.target.x = Math.max(-lim, Math.min(lim, this.controls.target.x));
    this.controls.target.z = Math.max(-lim, Math.min(lim, this.controls.target.z));
    this.camera.position.sub(this.lastShake);
    if (this.tween) this.stepTween(Math.min(1, dt * 5));
    // la cible suit le relief : on survole les collines sans que la vue plonge dans le sol
    {
      const tg = this.controls.target;
      const th = Math.max(0, w.heightAt(tg.x + this.N / 2, tg.z + this.N / 2)) + 0.2;
      if (!this.tween) { const dy = (th - tg.y) * Math.min(1, dt * 4); tg.y += dy; this.camera.position.y += dy; }
      // inclinaison maximale selon le zoom : de près on peut raser le sol, de loin on garde la vue d'ensemble (peu de ciel)
      const dd = this.camera.position.distanceTo(tg);
      const k = Math.max(0, Math.min(1, (dd - 6) / 40));
      this.controls.maxPolarAngle = Math.PI * (0.43 - 0.1 * k * k * (3 - 2 * k));
    }
    this.controls.update();
    if (!this.mobile) this.followShadow();
    {
      // jamais sous le terrain
      const cp = this.camera.position;
      const gh = Math.max(0, w.heightAt(cp.x + this.N / 2, cp.z + this.N / 2)) + 0.45;
      if (cp.y < gh) cp.y = gh;
    }
    this.lastShake.set(0, 0, 0);
    if (this.shakeAmp > 0.003) {
      this.lastShake.set((Math.random() - 0.5) * this.shakeAmp, (Math.random() - 0.5) * this.shakeAmp, (Math.random() - 0.5) * this.shakeAmp);
      this.camera.position.add(this.lastShake);
      this.shakeAmp *= 0.9;
    }

    // données changeantes
    const lv = this.lastVer;
    if (lv.terrain !== w.terrainV) { this.rebuildSkirt(); }
    const uv = sim.stats.buildingsBuilt * 7 + sim.stats.upgrades * 13 + sim.stats.buildingsLost;
    const pathDirty = this.infra.pathVer !== this.pathVer;
    if (lv.terrain !== w.terrainV || lv.owner !== w.ownerV || lv.fire !== w.fireV || pathDirty || (uv !== this.urbanVer && this.time - this.lastSlow > 1.2) || (this.time - this.lastSlow > (this.mobile ? 1.4 : 0.6) && (sim.tick % 6 === 0))) {
      this.rebuildTerrain();
      this.urbanVer = uv;
      if (lv.terrain !== w.terrainV || lv.owner !== w.ownerV) this.rebuildBorders();
      lv.terrain = w.terrainV; lv.owner = w.ownerV; lv.fire = w.fireV;
      this.lastSlow = this.time;
    }
    if ((lv.tree !== w.treeV && this.time - this.vegClock > (this.mobile ? 2.5 : 1.5)) || this.vegHeight !== w.terrainV) {
      this.veg.rebuild(sim);
      lv.tree = w.treeV; this.vegHeight = w.terrainV; this.vegClock = this.time;
    }
    const dist = this.camera.position.distanceTo(this.controls.target);
    this.camera.updateMatrixWorld();
    this.pv.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    this.veg.update(this.camera, false);
    this.bld.update(sim, this.frustum, this.camera.position, this.mobile ? 150 : 230);
    const zs = Math.min(1.9, Math.max(1.0, dist / 55));
    const far = dist > (this.mobile ? 55 : 85);
    this.props.update(sim, this.frustum, this.camera.position, this.mobile ? 55 : 85);
    this.cit.update(sim, alpha, this.time, zs, this.fx, !far, this.frustum, this.camera.position, this.sky.night);
    this.infra.update(sim, this.time, this.bld.lamps.map(([x, y, z]) => [x, y, z] as [number, number, number]));
    this.updateFlames(dt);
    this.glow.update(this.bld.lights, this.bld.fires, this.bld.lamps, this.time);
    this.emitSmoke(dt);
    if (!this.mobile || this.frameNo % 3 === 0) this.updateLabels();
    this.syncWeather();

    // eau animée
    this.sky.update(dt);
    if (this.mobile && this.time - this.shadowClock > 0.5) { this.shadowClock = this.time; this.followShadow(); this.three.shadowMap.needsUpdate = true; }

    // effets
    while (sim.fx.length) this.fx.handle(sim.fx.shift()!, sim, this);
    this.fx.update(dt, this.time);
    // anneau de sélection
    if (this.ringSelect.visible) {
      const p = this.ringSelect.userData as { x: number; y: number; r: number };
      this.ringSelect.position.set(p.x - this.N / 2, w.heightAt(p.x, p.y) + 0.08, p.y - this.N / 2);
      const pulse = 1 + Math.sin(this.time * 4) * 0.06;
      this.ringSelect.scale.set(p.r * pulse, 1, p.r * pulse);
    }
    this.three.render(this.scene, this.camera);
  }

  private weatherObjs = new Map<string, THREE.Object3D>();
  private syncWeather(): void {
    const sim = this.sim;
    if (Math.floor(this.time * 2) === Math.floor((this.time - 0.016) * 2) && this.weatherObjs.size === sim.weather.length) {
      this.fx.animateWeather(this.time);
      return;
    }
    const keys = new Set<string>();
    for (const z of sim.weather) {
      const key = `${z.kind}:${z.x.toFixed(1)},${z.y.toFixed(1)}`;
      keys.add(key);
      if (!this.weatherObjs.has(key)) {
        const o = this.fx.weatherZone(z, this.N, this.sim.world);
        this.scene.add(o);
        this.weatherObjs.set(key, o);
      }
    }
    for (const [k, o] of this.weatherObjs) if (!keys.has(k)) { this.scene.remove(o); this.fx.disposeWeather(o); this.weatherObjs.delete(k); }
    this.fx.animateWeather(this.time);
  }

  // ------------------------------------------------------------------ interaction

  pickGround(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.three.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.terr.mesh, false)[0];
    if (!hit) {
      // plan de l'eau
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const p = new THREE.Vector3();
      if (this.raycaster.ray.intersectPlane(plane, p)) {
        const x = p.x + this.N / 2, y = p.z + this.N / 2;
        if (x >= 0 && y >= 0 && x < this.N && y < this.N) return { x, y };
      }
      return null;
    }
    return { x: hit.point.x + this.N / 2, y: hit.point.z + this.N / 2 };
  }

  setCursor(x: number, y: number, radius: number, color: number | null): void {
    if (color === null) { this.ringTarget.visible = false; this.ringTargetFill.visible = false; this.cursorOn = false; return; }
    const h = this.sim.world.heightAt(x, y) + 0.1;
    const r = Math.max(0.35, radius);
    for (const m of [this.ringTarget, this.ringTargetFill]) {
      m.visible = true;
      m.position.set(x - this.N / 2, h, y - this.N / 2);
      m.scale.set(r, 1, r);
      ((m.material as THREE.MeshBasicMaterial)).color.setHex(color);
    }
    this.cursorOn = true;
  }

  setSelectionRing(x: number, y: number, r: number, color: number): void {
    this.ringSelect.visible = true;
    this.ringSelect.userData = { x, y, r };
    (this.ringSelect.material as THREE.MeshBasicMaterial).color.setHex(color);
  }
  clearSelection(): void {
    this.ringSelect.visible = false;
    this.selection = { kind: "none", id: -1 };
  }
  get cursorActive(): boolean { return this.cursorOn; }

  /** Mesures de rendu (tests de performance) : appels de dessin, triangles, instances par couche. */
  get renderStats() {
    const i = this.three.info.render;
    return { calls: i.calls, triangles: i.triangles, buildingModels: this.bld.stats.keys, buildings: this.bld.stats.instances, citizens: this.cit.stats.citizens, soldiers: this.cit.stats.soldiers, armyProps: this.cit.stats.props, ...this.infra.stats, quality: this.quality };
  }

  projectLabelUnused(): void { /* réservé */ }
}
