import * as THREE from "three";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { Army, Citizen, Civ } from "../sim/types";
import { GrowMesh } from "./grow";
import { ERA_CLOTH, ERA_TOOL, armyProp, citizenBody, citizenHead, soldierGear, toolModel } from "./units";
import type { Fx } from "./Fx";

interface EraSet { body: GrowMesh; head: GrowMesh; gear: GrowMesh; prop: GrowMesh; }

/** Vue visuelle d'un habitant : l'époque de sa civilisation, avec un léger décalage individuel d'adoption des modes. */
export function visualEra(c: Pick<Citizen, "id">, civ: Pick<Civ, "era" | "eraSince">, year: number): number {
  if (civ.era <= 0) return 0;
  const since = year - civ.eraSince;
  return since < (c.id % 6) ? civ.era - 1 : civ.era;
}

export class CitizenLayer {
  private sets = new Map<number, EraSet>();
  private tools: GrowMesh;
  private poles: THREE.InstancedMesh;
  private flags: THREE.InstancedMesh;
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  private tmp = new THREE.Color();
  private lastPos = new Map<number, { x: number; y: number; h: number }>();
  stats = { citizens: 0, soldiers: 0, props: 0 };

  constructor(private scene: THREE.Scene, private mobile: boolean) {
    this.tools = new GrowMesh(scene, toolModel(), new THREE.MeshStandardMaterial({ roughness: 0.8 }), 128);
    const pg = new THREE.CylinderGeometry(0.015, 0.015, 0.9, 4); pg.translate(0, 0.45, 0);
    this.poles = new THREE.InstancedMesh(pg, new THREE.MeshStandardMaterial({ color: 0x6b4a2e }), 64);
    const flg = new THREE.BoxGeometry(0.4, 0.24, 0.02); flg.translate(0.2, 0.78, 0);
    this.flags = new THREE.InstancedMesh(flg, new THREE.MeshStandardMaterial({ roughness: 0.8 }), 64);
    for (const m of [this.poles, this.flags]) { m.frustumCulled = false; m.count = 0; scene.add(m); }
  }

  clear(): void {
    for (const s of this.sets.values()) { s.body.dispose(); s.head.dispose(); s.gear.dispose(); s.prop.dispose(); }
    this.sets.clear();
    this.lastPos.clear();
  }

  private set(era: number): EraSet {
    let s = this.sets.get(era);
    if (!s) {
      s = {
        body: new GrowMesh(this.scene, citizenBody(era), this.mat, 128),
        head: new GrowMesh(this.scene, citizenHead(era), this.mat, 128),
        gear: new GrowMesh(this.scene, soldierGear(era), this.mat, 64),
        prop: new GrowMesh(this.scene, armyProp(era), this.mat, 16),
      };
      this.sets.set(era, s);
    }
    return s;
  }

  update(sim: SimulationEngine, alpha: number, time: number, zoomScale: number, fx: Fx, detail = true): void {
    const w = sim.world, N = w.size, d = this.d;
    for (const s of this.sets.values()) { s.body.begin(); s.head.begin(); s.gear.begin(); s.prop.begin(); }
    this.tools.begin();
    let n = 0, ns = 0;
    const cap = this.mobile ? 2600 : 3500;
    for (const c of sim.citizens) {
      if (c.dead) continue;
      if (n >= cap) break;
      const civ = sim.civById.get(c.civ);
      if (!civ) continue;
      const era = visualEra(c, civ, sim.year);
      const S = this.set(era);
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      const moving = Math.abs(c.x - c.px) + Math.abs(c.y - c.py) > 0.004;
      const bob = moving ? Math.abs(Math.sin(time * 11 + c.id)) * 0.035 : c.state === "work" || c.state === "build" ? Math.abs(Math.sin(time * 6 + c.id)) * 0.02 : 0;
      const hy = w.heightAt(x, y) + bob + (c.state === "flee" ? Math.abs(Math.sin(time * 16 + c.id)) * 0.05 : 0);
      const sc = (c.job === "child" ? 0.62 + Math.min(0.2, c.age * 0.015) : 1) * zoomScale;
      const yaw = moving ? Math.atan2(-(c.y - c.py), c.x - c.px) : c.id * 0.7;
      d.position.set(x - N / 2, hy, y - N / 2);
      d.rotation.set(0, yaw, 0);
      d.scale.set(sc, sc, sc);
      d.updateMatrix();
      // vêtements : étoffe de l'époque mêlée à la couleur de la civilisation
      this.col.setHex(ERA_CLOTH[era]).lerp(this.tmp.setHex(civ.color), 0.62);
      if (c.job === "soldier") this.col.multiplyScalar(0.78);
      if (c.sick > 0) this.col.lerp(this.tmp.setHex(0x8fbf5a), 0.6);
      S.body.push(d.matrix, this.col);
      const hv = c.sick > 0 ? this.tmp.setRGB(0.6, 0.85, 0.4) : c.panic > 0 ? this.tmp.setRGB(1.1, 1.1, 1.1) : this.tmp.setScalar(0.88 + (c.id % 7) * 0.02);
      if (detail) S.head.push(d.matrix, hv);
      if (!detail) { /* LOD : de loin, silhouette seule (économie de sommets sur iPhone) */ }
      else if (c.job === "soldier") {
        if (c.state === "fight") d.rotation.set(Math.sin(time * 14 + c.id) * 0.5, yaw, 0.5 * Math.sin(time * 14 + c.id));
        d.updateMatrix();
        S.gear.push(d.matrix, this.col.setScalar(1));
        ns++;
      } else if ((c.state === "work" || c.state === "build") && c.job !== "child") {
        d.rotation.set(0, yaw, Math.sin(time * 8 + c.id) * 0.5 - 0.3);
        d.updateMatrix();
        this.tools.push(d.matrix, this.col.setHex(ERA_TOOL[era]));
      }
      n++;
    }
    for (const s of this.sets.values()) { s.body.end(); s.head.end(); s.gear.end(); }
    this.tools.end();
    this.stats.citizens = n; this.stats.soldiers = ns;

    // armées : étendards + équipement lourd propre à l'époque
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
      if (civ) props += this.armyProps(army, civ, N, h, time, w.heightAt.bind(w), S_of(this, civ.era));
      if (army.combat && Math.random() < 0.25) fx.dust(army.x - N / 2, h + 0.1, army.y - N / 2);
    }
    for (const s of this.sets.values()) s.prop.end();
    this.poles.count = a; this.flags.count = a;
    this.poles.instanceMatrix.needsUpdate = true; this.flags.instanceMatrix.needsUpdate = true;
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;
    if (this.poles.instanceColor) this.poles.instanceColor.needsUpdate = true;
    this.stats.props = props;
  }

  private armyProps(army: Army, civ: Civ, N: number, h: number, time: number, hAt: (x: number, y: number) => number, S: EraSet): number {
    const d = this.d;
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
      S.prop.push(d.matrix, this.col.setScalar(1));
    }
    void h;
    return count;
  }
}

function S_of(layer: CitizenLayer, era: number): EraSet {
  return (layer as unknown as { set(e: number): EraSet }).set(era);
}
