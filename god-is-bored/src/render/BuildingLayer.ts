import * as THREE from "three";
import { hash2 } from "../sim/rng";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { GrowMesh } from "./grow";
import { buildingModel, modelKey, scaffoldModel, type ModelInfo } from "./models";

interface Entry { body: GrowMesh; accent: GrowMesh | null; info: ModelInfo; }

/**
 * Couche de rendu des bâtiments : un InstancedMesh par (type, époque, style), créé à la demande.
 * Chaque bâtiment est dessiné selon SON époque de construction : une ville mélange donc naturellement des
 * bâtiments de plusieurs époques, et une modernisation ne remplace que le bâtiment concerné.
 */
export class BuildingLayer {
  private entries = new Map<string, Entry>();
  private scaffold: GrowMesh;
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 });
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  private tint = new THREE.Color();
  /** Sorties de cheminées (monde) et feux de camp collectés pendant la mise à jour. */
  smoke: [number, number, number][] = [];
  fires: [number, number, number][] = [];
  lamps: [number, number, number][] = [];
  stats = { keys: 0, instances: 0 };

  constructor(private scene: THREE.Scene) {
    this.scaffold = new GrowMesh(scene, scaffoldModel(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 32, true);
  }

  clear(): void {
    for (const e of this.entries.values()) { e.body.dispose(); e.accent?.dispose(); }
    this.entries.clear();
    this.scaffold.dispose();
    this.scaffold = new GrowMesh(this.scene, scaffoldModel(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 32, true);
  }

  private entry(type: Parameters<typeof buildingModel>[0], era: number, style: number): Entry {
    const key = modelKey(type, era, style);
    let e = this.entries.get(key);
    if (!e) {
      const info = buildingModel(type, era, style);
      e = {
        info,
        body: new GrowMesh(this.scene, info.body, this.bodyMat, 48, true),
        accent: info.accent ? new GrowMesh(this.scene, info.accent, this.bodyMat, 48, true) : null,
      };
      this.entries.set(key, e);
    }
    return e;
  }

  update(sim: SimulationEngine): void {
    const w = sim.world, N = w.size;
    for (const e of this.entries.values()) { e.body.begin(); e.accent?.begin(); }
    this.scaffold.begin();
    this.smoke.length = 0; this.fires.length = 0; this.lamps.length = 0;
    let n = 0;
    const d = this.d;
    for (const b of sim.buildings) {
      if (b.hp < 0) continue;
      const civ = sim.civById.get(b.civ);
      const ruin = b.civ < 0;
      const style = civ ? civ.style : 0;
      const ent = this.entry(b.type, b.era, style);
      const px = b.x + 0.5, pz = b.y + 0.5;
      const hy = Math.min(w.heightAt(px, pz), w.heightAt(px - 0.3, pz - 0.3), w.heightAt(px + 0.3, pz + 0.3)) - 0.02;
      const built = b.progress >= 1;
      const sy = ruin ? 0.4 : built ? 1 : Math.max(0.12, b.progress);
      const yaw = b.type === "hall" || b.type === "castle" || b.type === "walls" ? 0 : Math.floor(hash2(b.x, b.y, 3) * 4) * (Math.PI / 2);
      d.position.set(px - N / 2, hy, pz - N / 2);
      d.rotation.set(ruin ? (hash2(b.x, b.y, 4) - 0.5) * 0.3 : 0, yaw, ruin ? (hash2(b.x, b.y, 5) - 0.5) * 0.3 : 0);
      d.scale.set(1, sy, 1);
      d.updateMatrix();
      const shade = ruin ? 0.45 : built ? (b.hp < b.maxHp * 0.5 ? 0.78 : 1) : 0.72;
      // teinte des murs : identité de la civilisation, à niveau égal
      if (civ && !ruin) this.tint.setRGB(1, 1, 1).lerp(this.col.setHex(civ.color), 0.2).multiplyScalar(shade);
      else this.tint.setRGB(shade, shade, shade);
      ent.body.push(d.matrix, this.tint);
      if (ent.accent) {
        if (!built && b.progress < 0.55) d.scale.set(0.001, 0.001, 0.001); else d.scale.set(1, sy < 1 ? 1 : sy, 1);
        d.updateMatrix();
        ent.accent.push(d.matrix, ruin || !civ ? this.col.setRGB(0.4, 0.4, 0.4) : this.col.setHex(civ.color));
      }
      n++;
      // échafaudage : chantier ou modernisation en cours
      if (!ruin && (b.up >= 0 || (!built && b.progress > 0.15))) {
        d.rotation.set(0, 0, 0);
        const k = Math.max(0.6, ent.info.height / 0.8 + 0.1);
        d.scale.set(1, k, 1);
        d.updateMatrix();
        this.scaffold.push(d.matrix, this.col.setRGB(1, 1, 1));
      }
      if (built && !ruin && b.hp > 0) {
        const c = Math.cos(yaw), s = Math.sin(yaw);
        for (const [sx, sY, sz] of ent.info.smoke) this.smoke.push([px - N / 2 + sx * c + sz * s, hy + sY, pz - N / 2 - sx * s + sz * c]);
        if (b.era === 0) {
          if (b.type === "hall") this.fires.push([px - N / 2 - 0.34, hy + 0.08, pz - N / 2 + 0.34]);
          else if (b.type === "temple") this.fires.push([px - N / 2, hy + 0.16, pz - N / 2]);
          else if (b.type === "barracks") this.fires.push([px - N / 2 + 0.05, hy + 0.04, pz - N / 2 - 0.1]);
        }
        if (b.era >= 3 && (b.type === "hall" || b.type === "market" || b.type === "station" || b.type === "factory")) {
          this.lamps.push([px - N / 2 + 0.52, hy, pz - N / 2 + 0.5], [px - N / 2 - 0.52, hy, pz - N / 2 + 0.5]);
          if (b.type === "hall") this.lamps.push([px - N / 2 + 0.5, hy, pz - N / 2 - 0.5], [px - N / 2 - 0.5, hy, pz - N / 2 - 0.5]);
        }
      }
    }
    for (const e of this.entries.values()) { e.body.end(); e.accent?.end(); }
    this.scaffold.end();
    this.stats.keys = this.entries.size;
    this.stats.instances = n;
  }
}
