import * as THREE from "three";
import { hash2 } from "../sim/rng";
import type { SimulationEngine } from "../sim/SimulationEngine";
import { ball, box, cone, cyl, merge } from "./geo";
import { GrowMesh } from "./grow";

type G = THREE.BufferGeometry;
const WOOD = 0x8a6a47, DW = 0x5e4630, STONE = 0xb3ada0, HAY = 0xdcbc5c;

const geos = (): Record<string, G> => ({
  fence: merge([box(0.03, 0.15, 0.03, -0.17, 0, 0, DW), box(0.03, 0.15, 0.03, 0.17, 0, 0, DW), box(0.38, 0.025, 0.02, 0, 0.05, 0, WOOD), box(0.38, 0.025, 0.02, 0, 0.11, 0, WOOD)]),
  fenceMetal: merge([cyl(0.01, 0.01, 0.16, 4, -0.17, 0, 0, 0x8d949c), cyl(0.01, 0.01, 0.16, 4, 0.17, 0, 0, 0x8d949c), box(0.38, 0.012, 0.012, 0, 0.13, 0, 0x8d949c), box(0.38, 0.012, 0.012, 0, 0.06, 0, 0x8d949c)]),
  well: merge([cyl(0.1, 0.11, 0.1, 8, 0, 0, 0, STONE), cyl(0.07, 0.07, 0.015, 8, 0, 0.1, 0, 0x2e5a73), box(0.02, 0.2, 0.02, -0.1, 0.1, 0, DW), box(0.02, 0.2, 0.02, 0.1, 0.1, 0, DW), box(0.26, 0.02, 0.18, 0, 0.3, 0, WOOD), cone(0.17, 0.08, 4, 0, 0.32, 0, 0xb5543a, Math.PI / 4)]),
  fountain: merge([cyl(0.2, 0.22, 0.06, 10, 0, 0, 0, 0xcfcfcf), cyl(0.17, 0.17, 0.02, 10, 0, 0.06, 0, 0x4f9ac0), cyl(0.04, 0.05, 0.16, 6, 0, 0.06, 0, 0xcfcfcf), ball(0.045, 0, 0.26, 0, 0x9fd8f0, 6, 5)]),
  cart: merge([box(0.26, 0.05, 0.15, 0, 0.09, 0, WOOD), box(0.26, 0.07, 0.015, 0, 0.14, 0.075, DW), box(0.26, 0.07, 0.015, 0, 0.14, -0.075, DW), cyl(0.065, 0.065, 0.02, 8, -0.06, 0.065, 0.09, DW).rotateX(Math.PI / 2), cyl(0.065, 0.065, 0.02, 8, -0.06, 0.065, -0.09, DW).rotateX(Math.PI / 2), box(0.22, 0.012, 0.02, 0.22, 0.1, 0, DW), box(0.18, 0.08, 0.1, -0.02, 0.14, 0, HAY)]),
  barrel: merge([cyl(0.045, 0.045, 0.1, 7, 0, 0, 0, 0x7a5a3a), cyl(0.047, 0.047, 0.012, 7, 0, 0.03, 0, 0x4a3a2a), cyl(0.047, 0.047, 0.012, 7, 0, 0.07, 0, 0x4a3a2a), cyl(0.045, 0.045, 0.1, 7, 0.1, 0, 0.03, 0x8a6a45), box(0.09, 0.08, 0.09, -0.07, 0, 0.1, 0xa07a4a)]),
  hay: merge([cone(0.1, 0.2, 7, 0, 0, 0, HAY), cone(0.075, 0.15, 6, 0.17, 0, 0.05, 0xd2b050)]),
  scarecrow: merge([cyl(0.01, 0.01, 0.3, 4, 0, 0, 0, DW), box(0.2, 0.014, 0.014, 0, 0.2, 0, DW), ball(0.035, 0, 0.32, 0, 0xcdb27a, 5, 4), cone(0.05, 0.05, 5, 0, 0.35, 0, 0x6b4a2e), box(0.1, 0.1, 0.012, 0, 0.12, 0, 0x7a6a8a)]),
  bench: merge([box(0.2, 0.025, 0.06, 0, 0.07, 0, WOOD), box(0.02, 0.07, 0.05, -0.08, 0, 0, 0x3a3a3a), box(0.02, 0.07, 0.05, 0.08, 0, 0, 0x3a3a3a), box(0.2, 0.05, 0.015, 0, 0.1, -0.03, WOOD)]),
  planter: merge([box(0.14, 0.06, 0.14, 0, 0, 0, 0xcfcfcf), ball(0.07, 0, 0.12, 0, 0x4c8a3a, 6, 5)]),
  crates: merge([box(0.09, 0.09, 0.09, 0, 0, 0, 0xa07a4a), box(0.08, 0.08, 0.08, 0.1, 0, 0.02, 0x93703f), box(0.08, 0.08, 0.08, 0.04, 0.09, 0.0, 0xa07a4a)]),
  logs: merge([cyl(0.04, 0.04, 0.3, 6, 0, 0.04, 0, 0x7b5a3a).rotateZ(Math.PI / 2), cyl(0.04, 0.04, 0.3, 6, 0, 0.04, 0.08, 0x8f6c47).rotateZ(Math.PI / 2), cyl(0.04, 0.04, 0.3, 6, 0, 0.11, 0.04, 0x7b5a3a).rotateZ(Math.PI / 2)]),
  cartEra: merge([box(0.16, 0.05, 0.075, 0, 0.03, 0, 0xffffff), box(0.08, 0.04, 0.07, -0.005, 0.08, 0, 0x7fb6d6)]),
});

interface P { k: string; x: number; y: number; z: number; r: number; s: number; c: number }

/**
 * Accessoires qui donnent vie aux bâtiments : clôtures, puits, fontaines, charrettes, tonneaux, bottes de foin, épouvantails,
 * bancs, jardinières, voitures garées. Instanciés, placés de façon déterministe selon l'époque et l'orientation du bâtiment.
 */
export class Props {
  private m = new Map<string, GrowMesh>();
  private mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.92 });
  private list: P[] = [];
  private sig = "";
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  stats = { props: 0, drawn: 0 };
  constructor(private scene: THREE.Scene) {
    const g = geos();
    for (const k of Object.keys(g)) this.m.set(k, new GrowMesh(scene, g[k], this.mat, 64, k === "well" || k === "fountain"));
  }
  clear(): void { this.sig = ""; this.list = []; }

  private rebuild(sim: SimulationEngine): void {
    const w = sim.world, N = w.size, out: P[] = [];
    const add = (k: string, bx: number, by: number, ox: number, oy: number, rot: number, s = 1, c = 0) => {
      // décalage exprimé dans le repère du bâtiment
      const cs = Math.cos(rot), sn = Math.sin(rot);
      const wx = bx + 0.5 + ox * sn + oy * cs, wy = by + 0.5 + ox * cs - oy * sn;
      out.push({ k, x: wx - N / 2, y: w.heightAt(wx, wy), z: wy - N / 2, r: rot, s, c });
    };
    for (const b of sim.buildings) {
      if (b.hp < 0 || b.civ < 0 || b.progress < 1) continue;
      const h = hash2(b.id, 5, 5), rot = b.rot;
      switch (b.type) {
        case "farm": {
          if (b.era >= 1 && b.era <= 4) for (const [ox, oy, r] of [[0, 0.46, 0], [0, -0.46, 0], [0.46, 0, Math.PI / 2], [-0.46, 0, Math.PI / 2]] as [number, number, number][]) if (h > 0.18 || r === 0) add(b.era >= 4 ? "fenceMetal" : "fence", b.x, b.y, ox, oy, rot + r, 1.08);
          if (b.era <= 2) add("scarecrow", b.x, b.y, 0.1, 0.05, rot + h * 6, 1);
          if (b.era >= 1 && b.era <= 3) { add("hay", b.x, b.y, 0.36, -0.36, rot, 0.9 + h * 0.3); if (h > 0.5) add("cart", b.x, b.y, -0.52, 0.5, rot + 0.5, 1); }
          break;
        }
        case "hall":
          if (b.era <= 3) add("well", b.x, b.y, 0.78, 0.72, rot, 1); else add("fountain", b.x, b.y, 0.78, 0.72, rot, 1.2);
          if (b.era >= 4) { add("bench", b.x, b.y, -0.7, 0.8, rot, 1); add("planter", b.x, b.y, -0.7, -0.7, rot, 1); }
          break;
        case "market":
          add("barrel", b.x, b.y, 0.5, 0.35, rot, 1); add("crates", b.x, b.y, -0.5, 0.4, rot + 0.3, 1);
          if (b.era >= 1 && b.era <= 3) add("cart", b.x, b.y, 0.1, -0.6, rot, 1);
          if (b.era >= 4) add("planter", b.x, b.y, 0.55, -0.4, rot, 1);
          break;
        case "forge": case "quarry": add("barrel", b.x, b.y, 0.5, 0.4, rot, 1); add("crates", b.x, b.y, -0.5, 0.45, rot, 1); break;
        case "lumber": add("logs", b.x, b.y, 0.4, 0.5, rot + 0.4, 1); if (b.era <= 3) add("cart", b.x, b.y, -0.5, 0.5, rot, 1); break;
        case "house":
          if (b.era >= 4 && h < 0.4) add("cartEra", b.x, b.y, 0.55, 0.62, rot + Math.PI / 2, 1.2, b.id);
          else if (b.era >= 1 && b.era <= 3 && h < 0.3) add("barrel", b.x, b.y, 0.5, 0.45, rot, 0.9);
          else if (b.era <= 2 && h > 0.85) add("crates", b.x, b.y, -0.5, 0.45, rot, 0.8);
          break;
        case "temple": if (b.era >= 2) add("planter", b.x, b.y, 0.55, 0.55, rot, 1); break;
        default: break;
      }
    }
    this.list = out;
    this.stats.props = out.length;
  }

  update(sim: SimulationEngine, frustum: THREE.Frustum, camPos: THREE.Vector3, maxDist: number): void {
    const sig = `${sim.stats.buildingsBuilt}:${sim.stats.upgrades}:${sim.stats.buildingsLost}:${sim.buildings.length}:${sim.world.terrainV}`;
    if (sig !== this.sig) { this.sig = sig; this.rebuild(sim); }
    for (const m of this.m.values()) m.begin();
    const d = this.d, v = new THREE.Vector3();
    let n = 0;
    for (const p of this.list) {
      const dx = p.x - camPos.x, dy = p.y - camPos.y, dz = p.z - camPos.z;
      if (dx * dx + dy * dy + dz * dz > maxDist * maxDist) continue;
      v.set(p.x, p.y + 0.1, p.z);
      if (!frustum.containsPoint(v)) continue;
      d.position.set(p.x, p.y, p.z); d.rotation.set(0, p.r, 0); d.scale.set(p.s, p.s, p.s); d.updateMatrix();
      if (p.k === "cartEra") this.col.setHSL(((p.c * 37) % 100) / 100, 0.5, 0.55); else this.col.setScalar(1);
      this.m.get(p.k)!.push(d.matrix, this.col);
      n++;
    }
    for (const m of this.m.values()) m.end();
    this.stats.drawn = n;
  }
}
