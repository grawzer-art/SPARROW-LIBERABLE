import * as THREE from "three";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { Army, Citizen, Civ } from "../sim/types";
import { CharSet, characterGeometry, characterMaterial, farPersonGeometry, gearGeometry, toolGeometry } from "./Characters";
import type { Fx } from "./Fx";
import { GrowMesh } from "./grow";
import type { Sky } from "./Sky";
import { ERA_CLOTH, armyProp } from "./units";

/** Vue visuelle d'un habitant : l'époque de sa civilisation, avec un léger décalage individuel d'adoption des modes. */
export function visualEra(c: Pick<Citizen, "id">, civ: Pick<Civ, "era" | "eraSince">, year: number): number {
  if (civ.era <= 0) return 0;
  const since = year - civ.eraSince;
  return since < (c.id % 6) ? civ.era - 1 : civ.era;
}

const SKIN = [0xf2c9a8, 0xe3ab82, 0xc98f66, 0x9d6c49, 0x72492f].map((h) => new THREE.Color(h));
const HAIR = [0x2a1d14, 0x4a3020, 0x7b5636, 0xb08a4a, 0x8a3a22, 0x15110e].map((h) => new THREE.Color(h));
const GRAY = new THREE.Color(0xc9c3b8), SICK = new THREE.Color(0x9bd16b), LOWSUN = new THREE.Color(0x000000);
void LOWSUN;

export class CitizenLayer {
  private sets = new Map<string, CharSet>();
  private mat: THREE.MeshStandardMaterial;
  private far: GrowMesh;
  private blobs: GrowMesh;
  private props = new Map<number, GrowMesh>();
  private poles: THREE.InstancedMesh;
  private flags: THREE.InstancedMesh;
  private propMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  private tmp = new THREE.Color();
  private skinTmp = new THREE.Color();
  private accTmp = new THREE.Color();
  private variants = new Map<string, THREE.Color[]>();
  private lastPos = new Map<number, { x: number; y: number; h: number }>();
  private v3 = new THREE.Vector3();
  stats = { citizens: 0, soldiers: 0, props: 0, drawn: 0, far: 0 };

  constructor(private scene: THREE.Scene, private mobile: boolean, sky: Sky) {
    this.mat = characterMaterial(sky);
    this.far = new GrowMesh(scene, farPersonGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 256);
    const disc = new THREE.CircleGeometry(0.11, 10); disc.rotateX(-Math.PI / 2);
    this.blobs = new GrowMesh(scene, disc, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }), 256, false, false);
    const pg = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4); pg.translate(0, 0.45, 0);
    this.poles = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x6b4a2e }), 64);
    const flg = new THREE.BoxGeometry(0.4, 0.24, 0.02); flg.translate(0.2, 0.78, 0);
    this.flags = new THREE.InstancedMesh(flg, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 64);
    for (const m of [this.poles, this.flags]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  }

  clear(): void {
    for (const s of this.sets.values()) s.dispose();
    this.sets.clear();
    for (const p of this.props.values()) p.dispose();
    this.props.clear();
    this.lastPos.clear();
  }

  private set(key: string, make: () => THREE.BufferGeometry): CharSet {
    let s = this.sets.get(key);
    if (!s) { s = new CharSet(this.scene, make(), this.mat, 96); this.sets.set(key, s); }
    return s;
  }

  /** Teinte des vêtements : étoffe de l'époque mêlée à la couleur de la civilisation, 8 variantes par habitant. */
  private cloth(civ: Civ, era: number, id: number, soldier: boolean): THREE.Color {
    const key = `${civ.id}:${era}`;
    let v = this.variants.get(key);
    if (!v) {
      v = [];
      for (let k = 0; k < 8; k++) {
        const c = new THREE.Color(ERA_CLOTH[era]).lerp(this.tmp.setHex(civ.color), 0.5 + (k % 3) * 0.1);
        c.offsetHSL(((k * 37) % 11 - 5) * 0.004, ((k * 17) % 7 - 3) * 0.03, ((k * 13) % 9 - 4) * 0.018);
        v.push(c);
      }
      this.variants.set(key, v);
    }
    const base = v[id & 7];
    return soldier ? this.col.copy(base).multiplyScalar(0.8) : this.col.copy(base);
  }

  update(sim: SimulationEngine, alpha: number, time: number, zoomScale: number, fx: Fx, detail: boolean, frustum: THREE.Frustum, camPos: THREE.Vector3, night: number): void {
    const w = sim.world, N = w.size, d = this.d;
    for (const s of this.sets.values()) s.begin();
    this.far.begin(); this.blobs.begin();
    let n = 0, ns = 0, drawn = 0, nfar = 0;
    const cap = this.mobile ? 2600 : 3500;
    const maxD = this.mobile ? 95 : 150;
    const spBoost = sim.speed >= 3 ? 1.35 : 1;
    const v3 = this.v3;
    for (const c of sim.citizens) {
      if (c.dead) continue;
      if (n >= cap) break;
      const civ = sim.civById.get(c.civ);
      if (!civ) continue;
      n++;
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      const hy = w.heightAt(x, y);
      v3.set(x - N / 2, hy + 0.2, y - N / 2);
      const dx = v3.x - camPos.x, dz = v3.z - camPos.z, dy = v3.y - camPos.y;
      if (dx * dx + dy * dy + dz * dz > maxD * maxD || !frustum.containsPoint(v3)) continue;
      drawn++;
      const era = visualEra(c, civ, sim.year);
      const soldier = c.job === "soldier";
      const moved = Math.abs(c.x - c.px) + Math.abs(c.y - c.py);
      const moving = moved > 0.004;
      const yaw = moving ? Math.atan2(-(c.y - c.py), c.x - c.px) : c.id * 0.7;
      const adult = c.job !== "child";
      const sc = (adult ? 0.95 + (c.id % 9) * 0.014 : 0.6 + Math.min(0.22, c.age * 0.016)) * zoomScale * (c.female && adult ? 0.96 : 1);
      d.position.set(x - N / 2, hy - (c.hp < 100 && c.sick > 0 ? 0 : 0), y - N / 2);
      d.rotation.set(0, yaw, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      const cl = this.cloth(civ, era, c.id, soldier);
      if (!detail) {
        this.far.push(d.matrix, cl);
        nfar++;
        continue;
      }
      // comportement -> animation (réelle : l'état vient de la simulation)
      let mode = 0, sp = 1;
      switch (c.state) {
        case "work": case "build": case "forage": mode = moving ? 1 : 2; break;
        case "fight": mode = 3; sp = 1.1; break;
        case "flee": mode = 1; sp = 1.8; break;
        case "march": mode = 1; sp = 1.15; break;
        default: mode = moving ? 1 : (c.sick > 0 || (night > 0.65 && c.state === "idle" && adult) ? 4 : 0);
      }
      sp *= spBoost;
      const phase = (c.id % 97) * 0.9;
      const skin = c.sick > 0 ? this.skinTmp.copy(SKIN[c.id % 5]).lerp(SICK, 0.6) : SKIN[c.id % 5];
      const hair = c.age > 55 ? GRAY : HAIR[(c.id * 7) % 6];
      const acc = this.accTmp.setHex(civ.color);
      const S = this.set(`c${era}${c.female ? "f" : "m"}`, () => characterGeometry(era, c.female));
      S.push(d.matrix, mode, phase, sp, cl, skin, hair, acc);
      if (soldier) { this.set(`g${era}`, () => gearGeometry(era)).push(d.matrix, mode, phase, sp, cl, skin, hair, acc); ns++; }
      else if (mode === 2 && adult) this.set(`t${era}`, () => toolGeometry(era)).push(d.matrix, mode, phase, sp, cl, skin, hair, acc);
      // ombre portée simplifiée : disque sombre au sol
      d.position.y = hy + 0.012; d.scale.set(sc, 1, sc); d.rotation.set(0, 0, 0); d.updateMatrix();
      this.blobs.push(d.matrix);
    }
    for (const s of this.sets.values()) s.end();
    this.far.end(); this.blobs.end();
    this.stats.citizens = n; this.stats.soldiers = ns; this.stats.drawn = drawn; this.stats.far = nfar;

    // armées : étendards + équipement lourd propre à l'époque
    for (const p of this.props.values()) p.begin();
    let a = 0, props = 0;
    for (const army of sim.armies) {
      if (a >= 64 || army.soldiers.length === 0) continue;
      const civ = sim.civById.get(army.civ);
      const h = w.heightAt(army.x, army.y);
      d.position.set(army.x - N / 2, h, army.y - N / 2);
      d.rotation.set(0, Math.sin(time * 2 + army.id) * 0.25, 0);
      d.scale.set(1, 1, 1);
      d.updateMatrix();
      this.poles.setMatrixAt(a, d.matrix);
      this.flags.setMatrixAt(a, d.matrix);
      this.flags.setColorAt(a, this.col.setHex(civ ? civ.color : 0x999999));
      this.poles.setColorAt(a, this.col.setRGB(1, 1, 1));
      a++;
      if (civ) props += this.armyProps(army, civ, N, time, w.heightAt.bind(w));
      if (army.combat && Math.random() < 0.25) fx.dust(army.x - N / 2, h + 0.1, army.y - N / 2);
    }
    for (const p of this.props.values()) p.end();
    this.poles.count = a; this.flags.count = a;
    this.poles.instanceMatrix.needsUpdate = true; this.flags.instanceMatrix.needsUpdate = true;
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
    if (this.poles.instanceColor) this.poles.instanceColor.needsUpdate = true;
    this.stats.props = props;
  }

  private armyProps(army: Army, civ: Civ, N: number, time: number, hAt: (x: number, y: number) => number): number {
    const d = this.d;
    let pm = this.props.get(civ.era);
    if (!pm) { pm = new GrowMesh(this.scene, armyProp(civ.era), this.propMat, 16, true); pm.begin(); this.props.set(civ.era, pm); }
    const last = this.lastPos.get(army.id);
    let heading = last ? last.h : 0;
    if (last && Math.hypot(army.x - last.x, army.y - last.y) > 0.01) heading = Math.atan2(-(army.y - last.y), army.x - last.x);
    this.lastPos.set(army.id, { x: army.x, y: army.y, h: heading });
    const count = Math.min(4, 1 + Math.floor(army.soldiers.length / 6));
    for (let i = 0; i < count; i++) {
      const a = (i / Math.max(1, count)) * 2.4 + 3.3, r = 0.55 + i * 0.12;
      const px = army.x + Math.cos(a) * r, py = army.y + Math.sin(a) * r;
      const fly = civ.era >= 5 ? 0.18 + Math.sin(time * 3 + i) * 0.04 : 0;
      d.position.set(px - N / 2, hAt(px, py) + fly, py - N / 2);
      d.rotation.set(0, heading, 0);
      d.scale.set(1.35, 1.35, 1.35);
      d.updateMatrix();
      pm.push(d.matrix, this.col.setScalar(1));
    }
    return count;
  }
}
