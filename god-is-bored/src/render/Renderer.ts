import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { hash2 } from "../sim/rng";
import { findPath } from "../sim/path";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { T } from "../sim/World";
import { treeGeometry } from "./geo";
import { BuildingLayer } from "./BuildingLayer";
import { CitizenLayer } from "./CitizenLayer";
import { Infra } from "./Infra";
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

  private terrain!: THREE.Mesh;
  private skirt!: THREE.Mesh;
  private water!: THREE.Mesh;
  private trees!: THREE.InstancedMesh;
  private flames!: THREE.InstancedMesh;
  private bld!: BuildingLayer;
  private cit!: CitizenLayer;
  private infra!: Infra;
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
    this.controls.dampingFactor = 0.09;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 7;
    this.controls.maxDistance = 150;
    this.controls.maxPolarAngle = Math.PI * 0.46;
    this.controls.minPolarAngle = 0.15;
    this.controls.target.set(0, 0.5, 0);
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    // tactile : 1 doigt = déplacer, 2 doigts = zoom (+ pivoter) ; bureau : 1 doigt = pivoter
    this.controls.touches = this.mobile ? { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE } : { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
    this.controls.panSpeed = 1.15;
    this.controls.rotateSpeed = 0.7;
    this.controls.zoomSpeed = 0.9;
    this.controls.update();

    // lumières douces
    this.scene.add(new THREE.HemisphereLight(0xdbeaff, 0x7a6650, 1.35));
    const sun = new THREE.DirectionalLight(0xfff0d6, 2.3);
    sun.position.set(-28, 52, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.mobile ? 1024 : 2048, this.mobile ? 1024 : 2048);
    this.sun = sun;
    const sc = sun.shadow.camera;
    sc.left = -48; sc.right = 48; sc.top = 48; sc.bottom = -48; sc.near = 10; sc.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.15));

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
    this.applyInset(true);
  }

  // ------------------------------------------------------------------ construction de la scène

  setSim(sim: SimulationEngine): void {
    this.sim = sim;
    this.N = sim.world.size;
    for (const c of [this.terrain, this.skirt, this.water, this.trees, this.flames, this.borders]) {
      if (c) { this.scene.remove(c); c.geometry.dispose(); }
    }
    this.bld?.clear(); this.cit?.clear(); this.infra?.clear();
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
    // terrain
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * N * 18), 3));
    tg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * N * 18), 3));
    this.terrain = new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = true;
    this.scene.add(this.terrain);
    // jupe de la maquette
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(N * 4 * 18), 3));
    sg.setAttribute("color", new THREE.BufferAttribute(new Float32Array(N * 4 * 18), 3));
    this.skirt = new THREE.Mesh(sg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
    this.scene.add(this.skirt);
    // eau
    const wg = new THREE.PlaneGeometry(N, N, this.mobile ? 12 : 28, this.mobile ? 12 : 28);
    wg.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color: 0x4fa9cc, transparent: true, opacity: 0.74, flatShading: true, roughness: 0.25, metalness: 0.05 }));
    this.water.position.y = -0.03;
    this.water.receiveShadow = true;
    this.scene.add(this.water);
    // arbres
    this.trees = new THREE.InstancedMesh(treeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 9000);
    this.trees.castShadow = true; this.trees.receiveShadow = true; this.trees.frustumCulled = false;
    this.scene.add(this.trees);
    // flammes
    const fg = new THREE.ConeGeometry(0.16, 0.5, 5);
    fg.translate(0, 0.25, 0);
    this.flames = new THREE.InstancedMesh(fg, new THREE.MeshBasicMaterial({ color: 0xff8a2a }), 900);
    this.flames.frustumCulled = false; this.flames.count = 0;
    this.scene.add(this.flames);
    // bâtiments, habitants, infrastructures : couches modulaires (géométries réutilisées, instanciation)
    this.bld = new BuildingLayer(this.scene);
    this.cit = new CitizenLayer(this.scene, this.mobile);
    this.infra = new Infra(this.scene, this.mobile);
    // frontières & routes
    this.borders = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false }));
    this.borders.renderOrder = 5; this.borders.frustumCulled = false;
    this.scene.add(this.borders);
  }

  // ------------------------------------------------------------------ terrain

  private tileColor(i: number, out: THREE.Color): void {
    const w = this.sim.world;
    const t = w.type[i], h = w.height[i];
    const x = i % this.N, y = (i / this.N) | 0;
    const n = (hash2(x, y, 9) - 0.5) * 0.06;
    switch (t) {
      case T.WATER: out.setHex(0x4fa6b8).lerp(this.tmpColor.setHex(0x1d4a66), Math.min(1, -h / 1.1)); break;
      case T.SAND: out.setHex(0xdccb94); break;
      case T.GRASS: out.setHex(0x95c76b).lerp(this.tmpColor.setHex(0x6ea155), Math.min(1, h / 1.8)).lerp(this.tmpColor.setHex(0xb8b36b), Math.max(0, 0.45 - w.fertility[i]) * 1.1); break;
      case T.HILL: out.setHex(0xaba96e).lerp(this.tmpColor.setHex(0x938d64), Math.min(1, (h - w.hillH) / 1.2)); break;
      case T.MOUNTAIN: out.setHex(0x938f8b).lerp(this.tmpColor.setHex(0xf2f2f4), Math.max(0, Math.min(1, (h - 2.9) / 0.6))); break;
      default: out.setHex(0x66b3da);
    }
    if (t !== T.WATER && this.urban[i] > 0) {
      // le sol se transforme autour des bâtiments : terre battue, pierre, pavés, suie, bitume, dalles lumineuses
      const e = (this.urban[i] & 7) - 1, strong = (this.urban[i] & 8) !== 0;
      out.lerp(this.tmpColor.setHex([0x8d7650, 0xc8bd9c, 0x9a948a, 0x5c5a58, 0x6e7176, 0xc3d9e6][e]), strong ? 0.6 : 0.3);
    }
    if (t !== T.WATER) {
      if (w.scorch[i] > 0) out.lerp(this.tmpColor.setHex(0x3a332d), Math.min(0.9, w.scorch[i] * 0.9));
      if (w.fire[i] > 0) out.lerp(this.tmpColor.setHex(0x6a2d10), 0.55);
      const o = w.owner[i];
      if (o >= 0) {
        const civ = this.sim.civById.get(o);
        if (civ) out.lerp(this.tmpColor.setHex(civ.color), 0.26);
      }
    }
    out.r = Math.max(0, out.r + n); out.g = Math.max(0, out.g + n); out.b = Math.max(0, out.b + n);
  }

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
    const w = this.sim.world, N = this.N, m = N + 1;
    const pos = this.terrain.geometry.attributes.position as THREE.BufferAttribute;
    const col = this.terrain.geometry.attributes.color as THREE.BufferAttribute;
    const P = pos.array as Float32Array, C = col.array as Float32Array;
    const c = new THREE.Color();
    let k = 0;
    for (let ty = 0; ty < N; ty++)
      for (let tx = 0; tx < N; tx++) {
        const i = ty * N + tx;
        this.tileColor(i, c);
        const h00 = w.corner[ty * m + tx], h10 = w.corner[ty * m + tx + 1], h01 = w.corner[(ty + 1) * m + tx], h11 = w.corner[(ty + 1) * m + tx + 1];
        const x0 = tx - N / 2, x1 = x0 + 1, z0 = ty - N / 2, z1 = z0 + 1;
        const v = (x: number, y: number, z: number) => { P[k] = x; P[k + 1] = y; P[k + 2] = z; C[k] = c.r; C[k + 1] = c.g; C[k + 2] = c.b; k += 3; };
        if ((tx + ty) & 1) {
          v(x0, h00, z0); v(x0, h01, z1); v(x1, h11, z1);
          v(x0, h00, z0); v(x1, h11, z1); v(x1, h10, z0);
        } else {
          v(x0, h00, z0); v(x0, h01, z1); v(x1, h10, z0);
          v(x1, h10, z0); v(x0, h01, z1); v(x1, h11, z1);
        }
      }
    pos.needsUpdate = true; col.needsUpdate = true;
    this.terrain.geometry.computeVertexNormals();
    this.terrain.geometry.computeBoundingSphere();
    this.terrain.geometry.computeBoundingBox();
  }

  private rebuildSkirt(): void {
    const w = this.sim.world, N = this.N, m = N + 1;
    const g = this.skirt.geometry;
    const P = (g.attributes.position as THREE.BufferAttribute).array as Float32Array;
    const C = (g.attributes.color as THREE.BufferAttribute).array as Float32Array;
    let k = 0;
    const bottom = -2.2;
    const quad = (ax: number, az: number, ah: number, bx: number, bz: number, bh: number, flip: boolean) => {
      const water = (ah + bh) / 2 < 0;
      const top = (h: number) => (water ? Math.min(0, h < 0 ? 0 : h) : h);
      const ta = top(ah), tb = top(bh);
      const cTop = water ? new THREE.Color(0x4a8fae) : SOIL, cBot = water ? new THREE.Color(0x22506b) : SOIL_DARK;
      const verts: [number, number, number, THREE.Color][] = flip
        ? [[ax, ta, az, cTop], [bx, bottom, bz, cBot], [bx, tb, bz, cTop], [ax, ta, az, cTop], [ax, bottom, az, cBot], [bx, bottom, bz, cBot]]
        : [[ax, ta, az, cTop], [bx, tb, bz, cTop], [bx, bottom, bz, cBot], [ax, ta, az, cTop], [bx, bottom, bz, cBot], [ax, bottom, az, cBot]];
      for (const [x, y, z, c] of verts) { P[k] = x; P[k + 1] = y; P[k + 2] = z; C[k] = c.r; C[k + 1] = c.g; C[k + 2] = c.b; k += 3; }
    };
    const h = N / 2;
    for (let i = 0; i < N; i++) {
      quad(i - h, -h, w.corner[i], i + 1 - h, -h, w.corner[i + 1], true);
      quad(i - h, h, w.corner[N * m + i], i + 1 - h, h, w.corner[N * m + i + 1], false);
      quad(-h, i - h, w.corner[i * m], -h, i + 1 - h, w.corner[(i + 1) * m], false);
      quad(h, i - h, w.corner[i * m + N], h, i + 1 - h, w.corner[(i + 1) * m + N], true);
    }
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    g.setDrawRange(0, k / 3);
    g.computeVertexNormals();
  }

  private rebuildTrees(): void {
    const w = this.sim.world, N = this.N;
    let n = 0;
    const cap = this.trees.instanceMatrix.count;
    for (let ty = 0; ty < N && n < cap; ty++)
      for (let tx = 0; tx < N && n < cap; tx++) {
        const i = ty * N + tx, cnt = w.trees[i];
        if (!cnt || w.type[i] === T.WATER) continue;
        const burning = w.fire[i] > 0;
        for (let k = 0; k < Math.min(cnt, 4) && n < cap; k++) {
          const ox = (hash2(tx, ty, k * 3 + 1) - 0.5) * 0.78, oz = (hash2(tx, ty, k * 3 + 2) - 0.5) * 0.78;
          const px = tx + 0.5 + ox, pz = ty + 0.5 + oz;
          const s = 0.75 + hash2(tx, ty, k * 3 + 3) * 0.6 + cnt * 0.05;
          this.dummy.position.set(px - N / 2, w.heightAt(px, pz) - 0.01, pz - N / 2);
          this.dummy.rotation.set(0, hash2(tx, ty, k) * 6.28, 0);
          this.dummy.scale.set(s, s * (0.9 + hash2(tx, ty, k + 7) * 0.5), s);
          this.dummy.updateMatrix();
          this.trees.setMatrixAt(n, this.dummy.matrix);
          const v = 0.8 + hash2(tx, ty, k + 11) * 0.4;
          this.tmpColor.setRGB(burning ? 0.35 : v * 0.95, burning ? 0.2 : v, burning ? 0.15 : v * 0.9);
          this.trees.setColorAt(n, this.tmpColor);
          n++;
        }
      }
    this.trees.count = n;
    this.trees.instanceMatrix.needsUpdate = true;
    if (this.trees.instanceColor) this.trees.instanceColor.needsUpdate = true;
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
          addQuad(ax, ay, w.corner[ay * m + ax], bx, by, w.corner[by * m + bx], ix, iz, rival ? 0.16 : 0.08, rival ? civ.color : this.tmpColor.setHex(civ.color).lerp(new THREE.Color(0xffffff), 0.35).getHex());
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

  private updateFlames(): void {
    const w = this.sim.world, N = this.N;
    if (this.sim.tick % 4 === 0 || this.lastSlow === 0) {
      this.flameTiles.length = 0;
      for (let i = 0; i < w.fire.length && this.flameTiles.length < 400; i++) if (w.fire[i] > 0) this.flameTiles.push(i);
    }
    let n = 0;
    for (const i of this.flameTiles) {
      const x = i % N, y = (i / N) | 0;
      for (let k = 0; k < 2; k++) {
        const px = x + 0.3 + k * 0.4, pz = y + 0.35 + k * 0.3;
        const f = 0.7 + 0.5 * Math.abs(Math.sin(this.time * 9 + i * 1.7 + k * 3));
        this.dummy.position.set(px - N / 2, w.heightAt(px, pz), pz - N / 2);
        this.dummy.rotation.set(0, i + k, 0);
        this.dummy.scale.set(f, f * 1.3, f);
        this.dummy.updateMatrix();
        this.flames.setMatrixAt(n++, this.dummy.matrix);
      }
      if (Math.random() < 0.04) this.fx.smoke(x + 0.5 - N / 2, w.heightAt(x + 0.5, y + 0.5) + 0.3, y + 0.5 - N / 2);
    }
    // feux de camp de la préhistoire (halls, temples et camps d'époque 0)
    for (let k = 0; k < this.bld.fires.length && n < 890; k++) {
      const [fx, fy, fz] = this.bld.fires[k];
      const f = 0.45 + 0.3 * Math.abs(Math.sin(this.time * 10 + k * 2.1));
      this.dummy.position.set(fx, fy, fz); this.dummy.rotation.set(0, k, 0); this.dummy.scale.set(f, f * 1.4, f); this.dummy.updateMatrix();
      this.flames.setMatrixAt(n++, this.dummy.matrix);
      if (Math.random() < 0.05) this.fx.smoke(fx, fy + 0.3, fz);
    }
    this.flames.count = n;
    this.flames.instanceMatrix.needsUpdate = true;
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
  resetCamera(): void {
    let tx = 0, tz = 0;
    if (this.sim && this.sim.cities.length) {
      for (const c of this.sim.cities) { tx += c.x + 0.5 - this.N / 2; tz += c.y + 0.5 - this.N / 2; }
      tx /= this.sim.cities.length; tz /= this.sim.cities.length;
    }
    const portrait = this.camera.aspect < 1;
    this.controls.target.set(tx * 0.8, 0.5, tz * 0.8);
    const dir = new THREE.Vector3(1, 1.08, 1).normalize();
    this.camera.position.copy(this.controls.target).addScaledVector(dir, portrait ? 78 : 94);
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
    this.trees.castShadow = q < 2;
  }
  get qualityLevel(): number { return this.quality; }
  /** Intervalle minimal entre deux rendus (ms). */
  get frameInterval(): number {
    return this.mobile ? (this.quality >= 3 ? 33 : 15) : 0;
  }
  focusOn(x: number, y: number, dist = 26): void {
    const t = new THREE.Vector3(x - this.N / 2, this.sim.world.heightAt(x, y), y - this.N / 2);
    const off = this.camera.position.clone().sub(this.controls.target).setLength(dist);
    this.controls.target.copy(t);
    this.camera.position.copy(t).add(off);
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
    this.controls.update();
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
    if (lv.terrain !== w.terrainV || lv.owner !== w.ownerV || lv.fire !== w.fireV || (uv !== this.urbanVer && this.time - this.lastSlow > 1.2) || (this.time - this.lastSlow > (this.mobile ? 1.4 : 0.6) && (sim.tick % 6 === 0))) {
      this.rebuildTerrain();
      this.urbanVer = uv;
      if (lv.terrain !== w.terrainV || lv.owner !== w.ownerV) this.rebuildBorders();
      lv.terrain = w.terrainV; lv.owner = w.ownerV; lv.fire = w.fireV;
      this.lastSlow = this.time;
    }
    if (lv.tree !== w.treeV || (this.time - this.lastSlow > 0.5 && sim.tick % 8 === 0)) {
      this.rebuildTrees();
      lv.tree = w.treeV;
    }
    this.bld.update(sim);
    const zs = Math.min(2.4, Math.max(1.25, this.camera.position.distanceTo(this.controls.target) / 38));
    const far = this.camera.position.distanceTo(this.controls.target) > (this.mobile ? 55 : 80);
    this.cit.update(sim, alpha, this.time, zs, this.fx, !far);
    this.infra.update(sim, this.time, this.bld.lamps.map(([x, y, z]) => [x, y, z] as [number, number, number]));
    this.updateFlames();
    this.emitSmoke(dt);
    if (!this.mobile || this.frameNo % 3 === 0) this.updateLabels();
    this.syncWeather();

    // eau animée
    if (!this.mobile || this.frameNo % 2 === 0) {
      const wp = this.water.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < wp.count; i++) {
        const x = wp.getX(i), z = wp.getZ(i);
        wp.setY(i, Math.sin(this.time * 1.2 + x * 0.6) * 0.025 + Math.cos(this.time * 0.9 + z * 0.5) * 0.02);
      }
      wp.needsUpdate = true;
    }
    if (this.mobile && this.time - this.shadowClock > 0.5) { this.shadowClock = this.time; this.three.shadowMap.needsUpdate = true; }

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
    const hit = this.raycaster.intersectObject(this.terrain, false)[0];
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
