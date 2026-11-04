import * as THREE from "three";
import { hash2 } from "../sim/rng";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { T } from "../sim/World";
import { blob, cone, cyl, merge } from "./geo";
import { GrowMesh } from "./grow";
import type { Sky } from "./Sky";

type G = THREE.BufferGeometry;
interface Item { sp: number; x: number; y: number; z: number; rot: number; s: number; sy: number; tx: number; tz: number; c: number; }

const SPECIES: { name: string; near: number; shadow: boolean; far?: number }[] = [
  { name: "pineTall", near: 120, shadow: true, far: 8 },
  { name: "pineShort", near: 110, shadow: true, far: 8 },
  { name: "oak", near: 110, shadow: true, far: 9 },
  { name: "birch", near: 100, shadow: true, far: 9 },
  { name: "bush", near: 55, shadow: false },
  { name: "rock", near: 75, shadow: false },
  { name: "tuft", near: 34, shadow: false },
  { name: "flowers", near: 30, shadow: false },
  { name: "fern", near: 30, shadow: false },
  { name: "stump", near: 36, shadow: false },
];

function geometries(): G[] {
  const g = (c: number) => c;
  void g;
  const pineTall = merge([cyl(0.028, 0.04, 0.14, 5, 0, 0, 0, 0x5a4330), cone(0.2, 0.3, 6, 0, 0.1, 0, 0x2f5f3a), cone(0.155, 0.28, 6, 0, 0.27, 0, 0x376b40), cone(0.105, 0.24, 6, 0, 0.45, 0, 0x417849), cone(0.05, 0.14, 5, 0, 0.62, 0, 0x4a8352)]);
  const pineShort = merge([cyl(0.03, 0.04, 0.1, 5, 0, 0, 0, 0x5a4330), cone(0.22, 0.26, 6, 0, 0.08, 0, 0x33663c), cone(0.15, 0.24, 6, 0, 0.26, 0, 0x3f7647)]);
  const oak = merge([cyl(0.03, 0.05, 0.2, 5, 0, 0, 0, 0x5d4632), blob(0.19, 0, 0.32, 0, 0x4f8a3c), blob(0.14, 0.12, 0.38, 0.05, 0x5a9744), blob(0.13, -0.1, 0.34, -0.07, 0x468236), blob(0.1, 0.02, 0.5, -0.02, 0x62a04b)]);
  const birch = merge([cyl(0.016, 0.024, 0.4, 5, 0, 0, 0, 0xe3dfd2), blob(0.12, 0, 0.42, 0, 0x7fb04a), blob(0.09, 0.07, 0.52, 0.03, 0x93bf55), blob(0.08, -0.06, 0.34, -0.03, 0x6fa244)]);
  const bush = merge([blob(0.1, 0, 0.07, 0, 0x3f7a35), blob(0.075, 0.09, 0.05, 0.03, 0x4a8a3c), blob(0.07, -0.07, 0.05, -0.05, 0x39702f)]);
  const rock = merge([blob(0.13, 0, 0.06, 0, 0x8b8780), blob(0.08, 0.1, 0.03, 0.04, 0x7a766f)]);
  const tuft = merge([cone(0.014, 0.12, 3, -0.03, 0, 0, 0x6ea04a), cone(0.014, 0.15, 3, 0.02, 0, 0.01, 0x7bb04f), cone(0.014, 0.1, 3, 0.0, 0, -0.03, 0x628f42), cone(0.012, 0.09, 3, 0.04, 0, -0.02, 0x86b855)]);
  const flowers = merge([cyl(0.006, 0.006, 0.1, 3, -0.04, 0, 0, 0x5f9a3e), blob(0.022, -0.04, 0.11, 0, 0xf2d24a), cyl(0.006, 0.006, 0.13, 3, 0.03, 0, 0.02, 0x5f9a3e), blob(0.024, 0.03, 0.14, 0.02, 0xf4f0e6), cyl(0.006, 0.006, 0.09, 3, 0.0, 0, -0.04, 0x5f9a3e), blob(0.02, 0.0, 0.1, -0.04, 0xe0707a), cone(0.03, 0.05, 4, 0.06, 0, -0.03, 0x6ea04a)]);
  const fern = merge([cone(0.02, 0.16, 3, -0.04, 0, 0, 0x4e8a3a).rotateZ(0.0), cone(0.02, 0.18, 3, 0.03, 0, 0.02, 0x5a9744), cone(0.018, 0.14, 3, 0.0, 0, -0.04, 0x437a33), cone(0.018, 0.12, 3, 0.05, 0, -0.03, 0x5d9a46)]);
  const stump = merge([cyl(0.045, 0.06, 0.07, 6, 0, 0, 0, 0x6b4e34), cyl(0.04, 0.04, 0.008, 6, 0, 0.07, 0, 0xc8a56c), cyl(0.012, 0.014, 0.1, 4, 0.08, 0, 0.03, 0x7a5a3a).rotateZ(1.3)]);
  return [pineTall, pineShort, oak, birch, bush, rock, tuft, flowers, fern, stump];
}
function farGeometries(): { cone: G; blob: G } {
  return { cone: merge([cone(0.27, 0.78, 5, 0, 0.04, 0, 0x30603a)]), blob: merge([cyl(0.035, 0.045, 0.22, 4, 0, 0, 0, 0x5d4632), blob(0.26, 0, 0.4, 0, 0x4f8a3c)]) };
}

/**
 * Végétation variée : 4 essences d'arbres (formes, hauteurs, inclinaisons, teintes), buissons, rochers, herbes.
 * Instanciation + LOD (arbres lointains simplifiés) + culling par frustum et par distance, balancement au vent.
 */
export class Vegetation {
  private meshes: GrowMesh[] = [];
  private far: { cone: GrowMesh; blob: GrowMesh };
  private items: Item[] = [];
  private mat: THREE.MeshStandardMaterial;
  private frustum = new THREE.Frustum();
  private pv = new THREE.Matrix4();
  private lastCam = new THREE.Vector3(1e9, 0, 0);
  private lastDir = new THREE.Vector3();
  private dirty = true;
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  stats = { items: 0, drawn: 0 };

  constructor(private scene: THREE.Scene, private mobile: boolean, sky: Sky) {
    this.mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });
    this.mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = sky.uniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nuniform float uTime;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
float sw = sin(uTime*1.35 + instanceMatrix[3].x*0.9 + instanceMatrix[3].z*0.7);
transformed.x += sw*0.014*position.y;
transformed.z += cos(uTime*1.05 + instanceMatrix[3].z*1.1)*0.009*position.y;
#endif`);
    };
    const geos = geometries();
    SPECIES.forEach((sp, i) => this.meshes.push(new GrowMesh(scene, geos[i], this.mat, 256, sp.shadow, true)));
    const fg = farGeometries();
    this.far = { cone: new GrowMesh(scene, fg.cone, this.mat, 256, false), blob: new GrowMesh(scene, fg.blob, this.mat, 256, false) };
  }

  setShadows(on: boolean): void {
    this.meshes.forEach((m, i) => { m.mesh.castShadow = on && SPECIES[i].shadow; });
  }

  clear(): void {
    for (const m of this.meshes) m.dispose();
    this.far.cone.dispose(); this.far.blob.dispose();
    this.meshes = [];
    const geos = geometries();
    SPECIES.forEach((sp, i) => this.meshes.push(new GrowMesh(this.scene, geos[i], this.mat, 256, sp.shadow, true)));
    const fg = farGeometries();
    this.far = { cone: new GrowMesh(this.scene, fg.cone, this.mat, 256, false), blob: new GrowMesh(this.scene, fg.blob, this.mat, 256, false) };
    this.items = [];
    this.dirty = true;
  }

  /** Régénère la liste d'instances depuis l'état du monde (arbres vivants, couvert, sol). */
  rebuild(sim: SimulationEngine): void {
    const w = sim.world, N = w.size;
    const items: Item[] = [];
    const push = (sp: number, x: number, y: number, s: number, sy: number, seed: number, tilt = 0.08) => {
      items.push({ sp, x: x - N / 2, y: w.heightAt(x, y) - 0.012, z: y - N / 2, rot: hash2(seed, sp, 1) * 6.283, s, sy, tx: (hash2(seed, sp, 2) - 0.5) * tilt, tz: (hash2(seed, sp, 3) - 0.5) * tilt, c: hash2(seed, sp, 4) });
    };
    for (let ty = 0; ty < N; ty++)
      for (let tx = 0; tx < N; tx++) {
        const i = ty * N + tx, t = w.type[i], h = w.height[i];
        if (t === T.WATER || t === T.RIVER) continue;
        const cnt = w.trees[i];
        const urb = w.bld[i] >= 0;
        // forêts aérées (rendu seulement : la simulation garde ses arbres) : clairières, lisières claires, gros sujets plus rares
        let shown = cnt <= 1 ? cnt : Math.max(1, Math.round(cnt * 0.6));
        const glade = hash2((tx / 4) | 0, (ty / 4) | 0, 77);
        if (cnt <= 3 && glade < 0.2) shown = hash2(tx, ty, 78) < 0.3 ? 1 : 0;
        let nearBld = false;
        for (let dy = -2; dy <= 2 && !nearBld; dy++) for (let dx = -2; dx <= 2; dx++) if (w.inb(tx + dx, ty + dy) && w.bld[(ty + dy) * N + tx + dx] >= 0) { nearBld = true; break; }
        if (nearBld) shown = Math.min(shown, hash2(tx, ty, 79) < 0.45 ? 1 : 0);
        for (let k = 0; k < shown; k++) {
          const seed = tx * 73 + ty * 131 + k * 17;
          const px = tx + 0.12 + hash2(tx, ty, k * 5 + 1) * 0.76, py = ty + 0.12 + hash2(tx, ty, k * 5 + 2) * 0.76;
          const r = hash2(tx, ty, k * 5 + 3);
          let sp: number;
          if (h > 1.1 || t === T.HILL) sp = r < 0.55 ? 0 : r < 0.85 ? 1 : 3;
          else sp = r < 0.34 ? 2 : r < 0.56 ? 3 : r < 0.8 ? 0 : 1;
          const big = hash2(tx, ty, k + 90) > 0.95 ? 1.5 : hash2(tx, ty, k + 91) < 0.25 ? 0.72 : 1;
          push(sp, px, py, (0.78 + hash2(tx, ty, k * 5 + 4) * 0.8) * big * (1 + Math.min(cnt, 4) * 0.03), 0.72 + hash2(tx, ty, k + 40) * 0.7, seed);
        }
        if (urb || t === T.MOUNTAIN) {
          if (t === T.MOUNTAIN && hash2(tx, ty, 8) < 0.5) push(5, tx + 0.5, ty + 0.5, 1.4 + hash2(tx, ty, 9) * 1.6, 0.7 + hash2(tx, ty, 10) * 0.8, tx * 5 + ty, 0.3);
          continue;
        }
        // sous-bois : buissons, rochers, herbes
        if (hash2(tx, ty, 21) < (t === T.GRASS ? 0.1 : 0.05)) push(4, tx + 0.15 + hash2(tx, ty, 22) * 0.7, ty + 0.15 + hash2(tx, ty, 23) * 0.7, 0.8 + hash2(tx, ty, 24) * 0.7, 0.8 + hash2(tx, ty, 25) * 0.4, tx * 3 + ty * 7);
        const rockP = t === T.HILL ? 0.16 : t === T.SAND ? 0.04 : 0.012;
        if (hash2(tx, ty, 31) < rockP) push(5, tx + 0.2 + hash2(tx, ty, 32) * 0.6, ty + 0.2 + hash2(tx, ty, 33) * 0.6, 0.6 + hash2(tx, ty, 34) * 0.9, 0.6 + hash2(tx, ty, 35) * 0.8, tx * 9 + ty * 2, 0.4);
        // prairies fleuries (par plaques), fougères en lisière de forêt, souches là où l'on a abattu
        if (t === T.GRASS && cnt === 0) {
          const patch = hash2((tx / 3) | 0, (ty / 3) | 0, 99);
          if (patch > 0.6 && hash2(tx, ty, 101) < 0.8) { const nf = 1 + ((hash2(tx, ty, 102) * 2.5) | 0); for (let k = 0; k < nf; k++) push(7, tx + hash2(tx, ty, 103 + k), ty + hash2(tx, ty, 113 + k), 0.9 + hash2(tx, ty, 123 + k) * 0.7, 0.9 + hash2(tx, ty, 133 + k) * 0.5, tx * 13 + ty * 5 + k, 0.25); }
          let near = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (w.inb(tx + dx, ty + dy) && w.trees[(ty + dy) * N + tx + dx] > 1) near++;
          if (near > 0 && hash2(tx, ty, 141) < 0.4) push(8, tx + 0.2 + hash2(tx, ty, 142) * 0.6, ty + 0.2 + hash2(tx, ty, 143) * 0.6, 0.9 + hash2(tx, ty, 144) * 0.8, 0.9 + hash2(tx, ty, 145) * 0.4, tx * 17 + ty, 0.3);
          if (w.maxTrees[i] > 0 && hash2(tx, ty, 151) < 0.35) push(9, tx + 0.2 + hash2(tx, ty, 152) * 0.6, ty + 0.2 + hash2(tx, ty, 153) * 0.6, 1, 1, tx * 19 + ty * 3, 0.1);
        }
        if (t === T.GRASS && cnt === 0) {
          const nT = Math.floor(w.fertility[i] * 2.4 * hash2(tx, ty, 41) * (this.mobile ? 1.1 : 1.7));
          for (let k = 0; k < nT; k++) push(6, tx + hash2(tx, ty, 50 + k) , ty + hash2(tx, ty, 60 + k), 0.9 + hash2(tx, ty, 70 + k) * 0.8, 0.8 + hash2(tx, ty, 80 + k) * 0.7, tx * 11 + ty * 3 + k, 0.2);
        }
      }
    this.items = items;
    this.stats.items = items.length;
    this.dirty = true;
  }

  /** Culling + LOD : à appeler à chaque image ; ne réécrit les instances que si la caméra a bougé ou si le monde a changé. */
  update(camera: THREE.PerspectiveCamera, force = false): void {
    camera.updateMatrixWorld();
    const moved = camera.position.distanceToSquared(this.lastCam) > 0.12 || force;
    const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
    const turned = fwd.distanceToSquared(this.lastDir) > 0.0004;
    if (!this.dirty && !moved && !turned) return;
    this.dirty = false;
    this.lastCam.copy(camera.position); this.lastDir.copy(fwd);
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    for (const m of this.meshes) m.begin();
    this.far.cone.begin(); this.far.blob.begin();
    const d = this.d, cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    const sc = this.mobile ? 0.62 : 1;
    const v = new THREE.Vector3();
    let drawn = 0;
    for (const it of this.items) {
      const sp = SPECIES[it.sp];
      const dx = it.x - cx, dy = it.y - cy, dz = it.z - cz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const lim = sp.near * sc;
      if (d2 > lim * lim) continue;
      v.set(it.x, it.y + 0.3 * it.s, it.z);
      if (!this.frustum.containsPoint(v)) continue;
      d.position.set(it.x, it.y, it.z);
      d.rotation.set(it.tx, it.rot, it.tz);
      d.scale.set(it.s, it.s * it.sy, it.s);
      d.updateMatrix();
      this.col.setRGB(0.8 + it.c * 0.42, 0.86 + it.c * 0.3, 0.74 + it.c * 0.34);
      const farLimit = (this.mobile ? 34 : 56);
      if (sp.far !== undefined && d2 > farLimit * farLimit) { (it.sp <= 1 ? this.far.cone : this.far.blob).push(d.matrix, this.col); }
      else this.meshes[it.sp].push(d.matrix, this.col);
      drawn++;
    }
    for (const m of this.meshes) m.end();
    this.far.cone.end(); this.far.blob.end();
    this.stats.drawn = drawn;
  }

  markDirty(): void { this.dirty = true; }
}
