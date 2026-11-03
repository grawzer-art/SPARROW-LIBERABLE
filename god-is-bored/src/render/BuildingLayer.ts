import * as THREE from "three";
import { hash2 } from "../sim/rng";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { GrowMesh } from "./grow";
import { buildingModel, modelKey, scaffoldModel, variantCount, type ModelInfo } from "./models";
import type { Sky } from "./Sky";

/** Couleur neutre des toitures par époque (chaume, tuiles, ardoise...) mêlée à la couleur de la civilisation. */
const ROOF = [0xa08a52, 0xa4533c, 0x8a4a3a, 0x4f535a, 0x5f666d, 0xcfd9e2];

interface Entry { body: GrowMesh; accent: GrowMesh | null; info: ModelInfo; }

/**
 * Couche de rendu des bâtiments : un InstancedMesh par (type, époque, style), créé à la demande.
 * Chaque bâtiment est dessiné selon SON époque de construction : une ville mélange donc naturellement des
 * bâtiments de plusieurs époques, et une modernisation ne remplace que le bâtiment concerné.
 */
export class BuildingLayer {
  private entries = new Map<string, Entry>();
  private scaffold: GrowMesh;
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.93 });
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  private tint = new THREE.Color();
  private tmpRoof = new THREE.Color();
  /** Sorties de cheminées (monde) et feux de camp collectés pendant la mise à jour. */
  smoke: [number, number, number][] = [];
  fires: [number, number, number][] = [];
  lamps: [number, number, number][] = [];
  /** Sources de lumière nocturne : [x, y, z, époque, intensité]. */
  lights: [number, number, number, number, number][] = [];
  stats = { keys: 0, instances: 0 };

  constructor(private scene: THREE.Scene, sky: Sky) {
    // fenêtres et bandes lumineuses allumées la nuit (couleurs « lumière » des modèles : jaune chaud, cyan)
    this.bodyMat.onBeforeCompile = (sh) => {
      sh.uniforms.uNight = sky.uniforms.uNight;
      // grain de matière (bois, pierre, enduit) : bruit fin en espace monde, estompé avec la distance (pas de moiré au loin)
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vWP;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
#ifdef USE_INSTANCING
vWP = (instanceMatrix * vec4(transformed, 1.0)).xyz;
#else
vWP = transformed;
#endif`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nuniform float uNight;\nvarying vec3 vWP;")
        .replace("#include <color_fragment>", `#include <color_fragment>
{
  float gr = fract(sin(dot(floor(vWP * vec3(30.0, 60.0, 30.0)), vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float st = fract(vWP.y * 11.0);
  float fd = smoothstep(26.0, 7.0, length(vViewPosition));
  diffuseColor.rgb *= 1.0 + fd * ((gr - 0.5) * 0.16 - 0.035 * smoothstep(0.85, 1.0, st));
}`)
        .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
#ifdef USE_COLOR
float gy = step(0.82, vColor.r) * step(0.6, vColor.g) * step(vColor.b, 0.5);
float gc = step(0.8, vColor.b) * step(0.6, vColor.g) * step(vColor.r, 0.36);
totalEmissiveRadiance += vColor * (gy + gc) * uNight * 1.7;
#endif`);
    };
    this.scaffold = new GrowMesh(scene, scaffoldModel(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 32, true);
  }

  clear(): void {
    for (const e of this.entries.values()) { e.body.dispose(); e.accent?.dispose(); }
    this.entries.clear();
    this.scaffold.dispose();
    this.scaffold = new GrowMesh(this.scene, scaffoldModel(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }), 32, true);
  }

  private entry(type: Parameters<typeof buildingModel>[0], era: number, style: number, variant: number): Entry {
    const key = modelKey(type, era, style, variant);
    let e = this.entries.get(key);
    if (!e) {
      const info = buildingModel(type, era, style, variant);
      e = {
        info,
        body: new GrowMesh(this.scene, info.body, this.bodyMat, 48, true),
        accent: info.accent ? new GrowMesh(this.scene, info.accent, this.bodyMat, 48, true) : null,
      };
      this.entries.set(key, e);
    }
    return e;
  }

  update(sim: SimulationEngine, frustum: THREE.Frustum, camPos: THREE.Vector3, maxDist: number): void {
    const w = sim.world, N = w.size;
    for (const e of this.entries.values()) { e.body.begin(); e.accent?.begin(); }
    this.scaffold.begin();
    this.smoke.length = 0; this.fires.length = 0; this.lamps.length = 0; this.lights.length = 0;
    const v3 = new THREE.Vector3();
    let n = 0;
    const d = this.d;
    for (const b of sim.buildings) {
      if (b.hp < 0) continue;
      const civ = sim.civById.get(b.civ);
      const ruin = b.civ < 0;
      const style = civ ? civ.style : 0;
      const variant = Math.floor(hash2(b.id, 7, 1) * variantCount(b.type));
      const jit = b.type === "hall" || b.type === "castle" || b.type === "walls" || b.type === "farm" ? 0 : 0.09;
      const px = b.x + 0.5 + (hash2(b.id, 3, 5) - 0.5) * jit * 2, pz = b.y + 0.5 + (hash2(b.id, 4, 5) - 0.5) * jit * 2;
      // culling : hors champ ou trop loin -> pas d'instance (les données de fumée/lumière restent collectées plus bas)
      v3.set(px - N / 2, w.heightAt(px, pz) + 0.3, pz - N / 2);
      const ddx = v3.x - camPos.x, ddz = v3.z - camPos.z, ddy = v3.y - camPos.y;
      const visible = ddx * ddx + ddy * ddy + ddz * ddz < maxDist * maxDist && frustum.containsPoint(v3);
      const ent = this.entry(b.type, b.era, style, variant);
      const hy = Math.min(w.heightAt(px, pz), w.heightAt(px - 0.3, pz - 0.3), w.heightAt(px + 0.3, pz + 0.3)) - 0.02;
      const built = b.progress >= 1;
      const sy = ruin ? 0.4 : built ? 1 : Math.max(0.12, b.progress);
      const yaw = b.rot !== 0 ? b.rot : (b.type === "hall" || b.type === "castle" || b.type === "walls" ? 0 : Math.floor(hash2(b.x, b.y, 3) * 4) * (Math.PI / 2));
      const sj = 0.94 + hash2(b.id, 9, 2) * 0.14, sjy = 0.94 + hash2(b.id, 10, 2) * 0.12;
      d.position.set(px - N / 2, hy, pz - N / 2);
      d.rotation.set(ruin ? (hash2(b.x, b.y, 4) - 0.5) * 0.3 : 0, yaw, ruin ? (hash2(b.x, b.y, 5) - 0.5) * 0.3 : 0);
      d.scale.set(sj, sy * sjy, sj);
      d.updateMatrix();
      const shade = ruin ? 0.45 : built ? (b.hp < b.maxHp * 0.5 ? 0.78 : 1) : 0.72;
      // teinte des murs : identité de la civilisation, à niveau égal
      if (civ && !ruin) this.tint.setRGB(1, 1, 1).lerp(this.col.setHex(civ.color), 0.08).multiplyScalar(shade);
      else this.tint.setRGB(shade, shade, shade);
      if (visible) ent.body.push(d.matrix, this.tint);
      if (ent.accent && visible) {
        if (!built && b.progress < 0.55) d.scale.set(0.001, 0.001, 0.001); else d.scale.set(sj, (sy < 1 ? 1 : sy) * sjy, sj);
        d.updateMatrix();
        ent.accent.push(d.matrix, ruin || !civ ? this.col.setRGB(0.4, 0.4, 0.4) : this.col.setHex(civ.color).lerp(this.tmpRoof.setHex(ROOF[Math.min(5, b.era)]), 0.42).multiplyScalar(0.92));
      }
      n++;
      // échafaudage : chantier ou modernisation en cours
      if (visible && !ruin && (b.up >= 0 || (!built && b.progress > 0.15))) {
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
        // lumière nocturne selon la technologie : foyers (préhistoire), chandelles/lanternes, gaz, électricité, LED
        const lit = b.type === "house" ? hash2(b.id, 12, 3) < 0.55 : b.type !== "farm" && b.type !== "quarry" && b.type !== "walls";
        if (lit && visible) this.lights.push([px - N / 2, hy + 0.2 + (b.type === "house" ? 0 : 0.1), pz - N / 2, b.era, b.type === "house" ? 0.7 : 1.1]);
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
