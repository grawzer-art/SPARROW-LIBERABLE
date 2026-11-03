import * as THREE from "three";
import { findPath } from "../sim/path";
import { streetCount, streetInfo, streetPolyline } from "../sim/Layout";
import { hash2 } from "../sim/rng";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { City } from "../sim/types";
import { T } from "../sim/World";
import { box, cyl, merge } from "./geo";
import { GrowMesh } from "./grow";
import type { PathSeg } from "./Terrain";
import { carModel, droneModel, lampModel, pylonModel, trainCar } from "./units";

interface Edge { a: City; b: City; era: number; pts: [number, number][]; cum: number[]; len: number; trains: boolean; civ: number; seed: number; }

/** Infrastructures : routes (terre, pavés, voie ferrée, bitume, ruban énergétique), trafic, pylônes, lampadaires, remparts. */
export class Infra {
  private roads = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  private glow = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  private wires = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x20262c }));
  private pylons: GrowMesh;
  private lamps: GrowMesh;
  private locos: GrowMesh;
  private wagons: GrowMesh;
  private cars: GrowMesh;
  private drones: GrowMesh;
  private wallSeg: GrowMesh[] = [];
  private wallTower: GrowMesh[] = [];
  private edges: Edge[] = [];
  private pathCache = new Map<string, number[] | null>();
  private sig = "";
  private d = new THREE.Object3D();
  private col = new THREE.Color();
  private N = 64;
  /** Chemins peints dans le sol (terre battue, pavés, ballast) : transitions naturelles avec le terrain. */
  paths: PathSeg[] = [];
  pathVer = 0;
  stats = { edges: 0, vehicles: 0, pylons: 0, wallPieces: 0 };

  constructor(private scene: THREE.Scene, private mobile: boolean) {
    const std = () => new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    this.roads.receiveShadow = true; this.roads.frustumCulled = false; this.glow.frustumCulled = false; this.wires.frustumCulled = false;
    this.roads.renderOrder = 1; this.glow.renderOrder = 2;
    scene.add(this.roads, this.glow, this.wires);
    this.pylons = new GrowMesh(scene, pylonModel(), std(), 32);
    this.lamps = new GrowMesh(scene, lampModel(), new THREE.MeshBasicMaterial({ vertexColors: true }), 64);
    this.locos = new GrowMesh(scene, trainCar(true), std(), 8);
    this.wagons = new GrowMesh(scene, trainCar(false), std(), 16);
    this.cars = new GrowMesh(scene, carModel(), std(), 32);
    this.drones = new GrowMesh(scene, droneModel(), std(), 32);
    // remparts par époque : 1 pierre, 2 pierre haute crénelée, 3 brique, 4 béton, 5 barrière énergétique
    const wallCol = [0, 0xd8cdaa, 0xb3ada0, 0xa5543d, 0xbfc2c5, 0x62e4ff];
    for (let e = 1; e <= 5; e++) {
      const h = [0, 0.26, 0.5, 0.34, 0.3, 0.45][e];
      const parts = [box(0.76, h, e === 5 ? 0.03 : 0.12, 0, 0, 0, wallCol[e])];
      if (e === 2) for (let i = -3; i <= 3; i += 2) parts.push(box(0.08, 0.08, 0.12, i * 0.1, h, 0, wallCol[e]));
      if (e === 4) parts.push(box(0.76, 0.1, 0.02, 0, h, 0, 0x7a8086));
      this.wallSeg[e] = new GrowMesh(scene, merge(parts), e === 5 ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6 }) : std(), 32, true);
      const th = [0, 0.4, 0.74, 0.5, 0.5, 0.7][e];
      const tw = merge([cyl(0.1, 0.12, th, 6, 0, 0, 0, e === 5 ? 0x2f3d4d : wallCol[e]), cyl(0.12, 0.12, 0.04, 6, 0, th, 0, e === 5 ? 0x62e4ff : 0x6b6f76)]);
      this.wallTower[e] = new GrowMesh(scene, tw, std(), 16, true);
    }
  }

  clear(): void {
    this.sig = ""; this.edges = []; this.pathCache.clear();
    for (const g of [this.roads, this.glow, this.wires]) g.geometry.setDrawRange(0, 0);
  }

  private cityEra(sim: SimulationEngine, c: City): number {
    let e = -1;
    for (const b of sim.buildings) if (b.city === c.id && b.progress >= 1 && b.civ >= 0 && b.type !== "house" && b.type !== "farm" && b.hp > 0) e = Math.max(e, b.era);
    return Math.max(0, e);
  }
  private hasStation(sim: SimulationEngine, c: City): boolean {
    return sim.buildings.some((b) => b.city === c.id && b.type === "station" && b.progress >= 1 && b.civ >= 0 && b.hp > 0);
  }

  /** Les routes suivent l'état réel : époque = min(civilisation, infrastructures des deux villes reliées). */
  private rebuild(sim: SimulationEngine): void {
    const w = sim.world, N = w.size;
    this.N = N;
    const byCiv = new Map<number, City[]>();
    for (const c of sim.cities) { const l = byCiv.get(c.civ); if (l) l.push(c); else byCiv.set(c.civ, [c]); }
    const edges: Edge[] = [];
    for (const [civId, list] of byCiv) {
      const civ = sim.civById.get(civId);
      if (!civ) continue;
      for (let i = 1; i < list.length; i++) {
        let best = list[0], bd = Infinity;
        for (let j = 0; j < i; j++) { const dd = Math.hypot(list[j].x - list[i].x, list[j].y - list[i].y); if (dd < bd) { bd = dd; best = list[j]; } }
        const key = `${list[i].id}-${best.id}`;
        let p = this.pathCache.get(key);
        if (p === undefined) { p = findPath(w, list[i].x + 0.5, list[i].y + 0.5, best.x + 0.5, best.y + 0.5); this.pathCache.set(key, p); }
        if (!p) continue;
        const raw: [number, number][] = [[list[i].x + 0.5, list[i].y + 0.5]];
        for (let k = 0; k < p.length; k += 2) raw.push([p[k], p[k + 1]]);
        // sous-échantillonnage à 0.5 case pour suivre le relief
        const pts: [number, number][] = [raw[0]];
        for (let k = 1; k < raw.length; k++) {
          const [ax, ay] = raw[k - 1], [bx, by] = raw[k];
          const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 0.5));
          for (let s = 1; s <= steps; s++) pts.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
        }
        const cum = [0];
        for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        const era = Math.min(civ.era, this.cityEra(sim, list[i]), this.cityEra(sim, best));
        edges.push({ a: list[i], b: best, era, pts, cum, len: cum[cum.length - 1], trains: era >= 3 && this.hasStation(sim, list[i]) && this.hasStation(sim, best), civ: civId, seed: list[i].id });
      }
    }
    this.edges = edges;
    // géométrie des routes
    const pos: number[] = [], col: number[] = [], gpos: number[] = [], gcol: number[] = [], wire: number[] = [];
    const c = new THREE.Color();
    const quad = (A: number[], B: number[], C2: number[], D: number[], color: number, arrP: number[], arrC: number[]) => {
      c.setHex(color);
      for (const v of [A, B, C2, B, D, C2]) { arrP.push(v[0] - N / 2, v[1], v[2] - N / 2); arrC.push(c.r, c.g, c.b); }
    };
    const pylonPts: [number, number, number, number][] = [];
    const paths: PathSeg[] = [];
    // rues rayonnantes et place centrale de chaque ville (peintes dans le sol : transitions naturelles)
    for (const c of sim.cities) {
      if (!c.hasHall && c.pop < 6) continue;
      const era = this.cityEra(sim, c);
      let reach = 2.4;
      for (const b of sim.buildings) if (b.city === c.id && b.civ >= 0 && b.hp > 0 && b.type !== "farm") reach = Math.max(reach, Math.hypot(b.x - c.x, b.y - c.y));
      const len = Math.min(10, reach + 0.6);
      const bed = [[0.26, 0x8a6f4a], [0.3, 0xb3a47c], [0.3, 0x8c867b], [0.3, 0x6f695f], [0.32, 0x55575a], [0.32, 0x3d444c]][era];
      for (let i = 0; i < streetCount(c); i++) {
        const pts = streetPolyline(c, i, len);
        for (let k = 0; k + 1 < pts.length; k++) paths.push({ ax: pts[k][0], ay: pts[k][1], bx: pts[k + 1][0], by: pts[k + 1][1], w: bed[0] as number, col: bed[1] as number });
      }
      const cx = c.x + 0.5, cy = c.y + 0.5;
      for (let k = 0; k < 10; k++) {
        const a0 = (k / 10) * Math.PI * 2, a1 = ((k + 1) / 10) * Math.PI * 2;
        paths.push({ ax: cx + Math.cos(a0) * 0.85, ay: cy + Math.sin(a0) * 0.85, bx: cx + Math.cos(a1) * 0.85, by: cy + Math.sin(a1) * 0.85, w: 0.5, col: [0x9a7f58, 0xc4b88e, 0xa39c8e, 0x7a736a, 0x6a6e73, 0xbcd0dc][era] });
      }
    }
    // sentiers : chaque bâtiment réel est relié à la rue ou au foyer (lignes de désir, légèrement sinueuses)
    {
      const trailCol = [0x9a7f58, 0xb3a47c, 0x8c867b, 0x6f695f];
      let nTrail = 0;
      for (const b of sim.buildings) {
        if (b.civ < 0 || b.progress < 1 || b.hp <= 0 || b.type === "walls" || b.era > 3) continue;
        const city = sim.cityById.get(b.city);
        if (!city) continue;
        const bx = b.x + 0.5, by = b.y + 0.5;
        let tx = city.x + 0.5, ty = city.y + 0.5;
        if (b.type === "house" || b.type === "temple" || b.type === "market") { const info = streetInfo(city, bx, by); tx = info.px; ty = info.py; }
        const L = Math.hypot(tx - bx, ty - by);
        // terre battue sous chaque habitation des premières ères : l'empreinte du camp se lit tout de suite
        if (b.era <= 1 && (b.type === "house" || b.type === "hall")) paths.push({ ax: bx, ay: by, bx: bx + 0.01, by: by + 0.01, w: b.type === "hall" ? 0.85 : 0.6, col: 0x6f5636 });
        if (L < 0.45) continue;
        const nx = -(ty - by) / L, ny = (tx - bx) / L, off = (hash2(b.id, 3, 3) - 0.5) * 0.55 * Math.min(1, L / 3);
        const mx = (bx + tx) / 2 + nx * off, my = (by + ty) / 2 + ny * off;
        const col = trailCol[b.era] ?? trailCol[3];
        paths.push({ ax: bx, ay: by, bx: mx, by: my, w: 0.1, col }, { ax: mx, ay: my, bx: tx, by: ty, w: 0.1, col });
        if (++nTrail > 260) break;
      }
    }
    for (const e of edges) {
      const style = [[0.05, 0x9a7c52], [0.085, 0xd2c6a4], [0.085, 0x8e8a80], [0.11, 0x7a736a], [0.11, 0x3c4046], [0.11, 0x1f2a36]][e.era];
      const hw = style[0] as number, color = style[1] as number;
      let nextDash = 0, nextTie = 0, nextPylon = 1.5;
      for (let k = 0; k + 1 < e.pts.length; k++) {
        const [ax, ay] = e.pts[k], [bx, by] = e.pts[k + 1];
        const dx = bx - ax, dz = by - ay, L = Math.hypot(dx, dz) || 1;
        const nx = (-dz / L), nz = dx / L;
        const ha = w.heightAt(ax, ay) + 0.04, hb = w.heightAt(bx, by) + 0.04;
        const P = (x: number, z: number, h: number, off: number) => [x + nx * off, h, z + nz * off];
        const bed = [[0.3, 0x8a6f4a], [0.34, 0xb3a47c], [0.34, 0x8c867b], [0.34, 0x6f695f], [0.36, 0x55575a], [0.36, 0x3d444c]][e.era];
        paths.push({ ax, ay, bx, by, w: bed[0] as number, col: bed[1] as number });
        if (e.era >= 3) quad(P(ax, ay, ha, hw), P(ax, ay, ha, -hw), P(bx, by, hb, hw), P(bx, by, hb, -hw), color, pos, col);
        if (e.era === 3) { // voie ferrée : deux rails et des traverses
          for (const off of [-0.035, 0.035]) quad(P(ax, ay, ha + 0.012, off + 0.011), P(ax, ay, ha + 0.012, off - 0.011), P(bx, by, hb + 0.012, off + 0.011), P(bx, by, hb + 0.012, off - 0.011), 0x2a2d31, pos, col);
          if (e.cum[k] >= nextTie) { nextTie = e.cum[k] + 0.22; const mx = (ax + bx) / 2, mz = (ay + by) / 2, mh = (ha + hb) / 2 + 0.008; quad(P(mx - dx / L * 0.02, mz - dz / L * 0.02, mh, 0.075), P(mx - dx / L * 0.02, mz - dz / L * 0.02, mh, -0.075), P(mx + dx / L * 0.02, mz + dz / L * 0.02, mh, 0.075), P(mx + dx / L * 0.02, mz + dz / L * 0.02, mh, -0.075), 0x5e4630, pos, col); }
        }
        if (e.era === 4 && e.cum[k] >= nextDash) { nextDash = e.cum[k] + 0.5; quad(P(ax, ay, ha + 0.012, 0.008), P(ax, ay, ha + 0.012, -0.008), P(bx, by, hb + 0.012, 0.008), P(bx, by, hb + 0.012, -0.008), 0xf2f2f2, pos, col); }
        if (e.era === 5) for (const off of [-hw + 0.012, hw - 0.012]) quad(P(ax, ay, ha + 0.012, off + 0.01), P(ax, ay, ha + 0.012, off - 0.01), P(bx, by, hb + 0.012, off + 0.01), P(bx, by, hb + 0.012, off - 0.01), 0x62e4ff, gpos, gcol);
        if (e.era >= 4 && e.cum[k] >= nextPylon && e.len - e.cum[k] > 1.2 && e.cum[k] > 1.2) { nextPylon = e.cum[k] + 3.2; pylonPts.push([ax + nx * 0.32, ay + nz * 0.32, w.heightAt(ax, ay), Math.atan2(dz, dx)]); }
      }
    }
    // pylônes + câbles
    this.pylons.begin();
    for (let i = 0; i < pylonPts.length && i < 160; i++) {
      const [x, y, h, ang] = pylonPts[i];
      this.d.position.set(x - N / 2, h, y - N / 2); this.d.rotation.set(0, -ang, 0); this.d.scale.set(1, 1, 1); this.d.updateMatrix();
      this.pylons.push(this.d.matrix, this.col.setScalar(1));
      const nxt = pylonPts[i + 1];
      if (nxt && Math.hypot(nxt[0] - x, nxt[1] - y) < 4.2) for (const hh of [0.44, 0.34]) wire.push(x - N / 2, h + hh, y - N / 2, nxt[0] - N / 2, nxt[2] + hh - 0.05, nxt[1] - N / 2);
    }
    this.pylons.end();
    this.stats.pylons = Math.min(160, pylonPts.length);
    const set = (g: THREE.BufferGeometry, p: number[], cc?: number[]) => {
      g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
      if (cc) g.setAttribute("color", new THREE.Float32BufferAttribute(cc, 3));
      g.computeBoundingSphere();
      if (cc) g.computeVertexNormals();
      g.setDrawRange(0, Infinity);
    };
    set(this.roads.geometry, pos, col);
    set(this.glow.geometry, gpos, gcol);
    set(this.wires.geometry, wire);
    this.paths = paths;
    this.pathVer++;
    this.stats.edges = edges.length;
  }

  private along(e: Edge, t: number): { x: number; y: number; ang: number } {
    const target = Math.max(0, Math.min(e.len, t));
    let k = 1;
    while (k < e.cum.length - 1 && e.cum[k] < target) k++;
    const k0 = k - 1, span = e.cum[k] - e.cum[k0] || 1, f = (target - e.cum[k0]) / span;
    const [ax, ay] = e.pts[k0], [bx, by] = e.pts[k];
    return { x: ax + (bx - ax) * f, y: ay + (by - ay) * f, ang: Math.atan2(-(by - ay), bx - ax) };
  }

  update(sim: SimulationEngine, time: number, lamps: [number, number, number][]): void {
    const w = sim.world, N = w.size, d = this.d;
    this.N = N;
    const sig = sim.cities.map((c) => `${c.id}:${c.civ}`).join(",") + "|" + sim.civs.map((c) => c.era).join("") + "|" + sim.stats.buildingsBuilt + ":" + sim.stats.upgrades + ":" + sim.stats.buildingsLost + "|" + w.terrainV;
    if (sig !== this.sig) { this.sig = sig; this.rebuild(sim); }

    // trafic lié aux routes réelles
    this.locos.begin(); this.wagons.begin(); this.cars.begin(); this.drones.begin();
    let veh = 0;
    const maxCars = this.mobile ? 14 : 36, maxDrones = this.mobile ? 14 : 32;
    let nc = 0, nd = 0;
    for (const e of this.edges) {
      if (e.len < 1) continue;
      if (e.trains) { // un train fait la navette entre deux gares
        const sp = 0.9, per = e.len * 2, t = (time * sp + e.seed * 1.7) % per, fwd = t < e.len, s = fwd ? t : per - t;
        for (let i = 0; i < 3; i++) {
          const p = this.along(e, fwd ? s - i * 0.34 : s + i * 0.34);
          d.position.set(p.x - N / 2, w.heightAt(p.x, p.y) + 0.05, p.y - N / 2); d.rotation.set(0, p.ang + (fwd ? 0 : Math.PI), 0); d.scale.set(1.3, 1.3, 1.3); d.updateMatrix();
          (i === 0 ? this.locos : this.wagons).push(d.matrix, this.col.setScalar(1));
          veh++;
        }
      }
      if (e.era >= 4 && nc < maxCars) {
        for (let i = 0; i < 2 && nc < maxCars; i++, nc++) {
          const dir = i % 2 === 0 ? 1 : -1, per = e.len, t = (time * 0.7 * (0.8 + i * 0.3) + e.seed * 0.9 + i * per * 0.5) % per, s = dir > 0 ? t : per - t;
          const p = this.along(e, s);
          const off = dir * 0.04;
          d.position.set(p.x - N / 2 + Math.sin(p.ang) * off, w.heightAt(p.x, p.y) + 0.05, p.y - N / 2 + Math.cos(p.ang) * off);
          d.rotation.set(0, p.ang + (dir > 0 ? 0 : Math.PI), 0); d.scale.set(1.3, 1.3, 1.3); d.updateMatrix();
          this.cars.push(d.matrix, this.col.setHSL(((e.seed * 37 + i * 91) % 100) / 100, 0.5, 0.55));
          veh++;
        }
      }
      if (e.era >= 5 && nd < maxDrones) {
        const per = e.len * 2, t = (time * 1.1 + e.seed) % per, s = t < e.len ? t : per - t, p = this.along(e, s);
        d.position.set(p.x - N / 2, w.heightAt(p.x, p.y) + 0.9 + Math.sin(time * 3 + e.seed) * 0.05, p.y - N / 2); d.rotation.set(0, time * 2, 0); d.scale.set(1.6, 1.6, 1.6); d.updateMatrix();
        this.drones.push(d.matrix, this.col.setScalar(1)); nd++; veh++;
      }
    }
    // drones de ville (ère futuriste)
    for (const c of sim.cities) {
      const civ = sim.civById.get(c.civ);
      if (!civ || civ.era < 5 || nd >= maxDrones) continue;
      if (!sim.buildings.some((b) => b.city === c.id && b.progress >= 1 && b.era >= 5 && (b.type === "lab" || b.type === "hall"))) continue;
      for (let i = 0; i < 2 && nd < maxDrones; i++, nd++) {
        const a = time * (0.6 + i * 0.25) + i * 3 + c.id;
        const x = c.x + 0.5 + Math.cos(a) * (1.4 + i * 0.7), y = c.y + 0.5 + Math.sin(a) * (1.4 + i * 0.7);
        d.position.set(x - N / 2, w.heightAt(x, y) + 1.1 + i * 0.35, y - N / 2); d.rotation.set(0, -a, 0); d.scale.set(1.6, 1.6, 1.6); d.updateMatrix();
        this.drones.push(d.matrix, this.col.setScalar(1)); veh++;
      }
    }
    this.locos.end(); this.wagons.end(); this.cars.end(); this.drones.end();
    this.stats.vehicles = veh;

    // lampadaires (éclairage public à partir de l'ère industrielle)
    this.lamps.begin();
    for (const [x, h, z] of lamps) { d.position.set(x, h, z); d.rotation.set(0, 0, 0); d.scale.set(1.2, 1.2, 1.2); d.updateMatrix(); this.lamps.push(d.matrix, this.col.setScalar(1)); }
    this.lamps.end();

    // remparts : anneau de murailles autour des villes équipées
    for (let e = 1; e <= 5; e++) { this.wallSeg[e].begin(); this.wallTower[e].begin(); }
    let pieces = 0;
    for (const c of sim.cities) {
      if (c.walls < 0) continue;
      const e = Math.max(1, Math.min(5, c.walls));
      // le rempart enserre les bâtiments de la ville (rayon adapté à son étendue)
      let reach = 2.6;
      for (const b of sim.buildings) if (b.city === c.id && b.civ >= 0 && b.hp > 0 && b.type !== "farm" && b.type !== "walls") reach = Math.max(reach, Math.hypot(b.x - c.x, b.y - c.y));
      const R = Math.min(8.5, Math.max(3.7, reach + 1.1)), SEG = Math.max(22, Math.round(R * 6)), cx = c.x + 0.5, cy = c.y + 0.5;
      for (let i = 0; i < SEG; i++) {
        const a0 = (i / SEG) * Math.PI * 2, a1 = ((i + 1) / SEG) * Math.PI * 2;
        const x0 = cx + Math.cos(a0) * R, y0 = cy + Math.sin(a0) * R, x1 = cx + Math.cos(a1) * R, y1 = cy + Math.sin(a1) * R;
        const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
        const ti = w.tileAt(mx, my), t = ti >= 0 ? w.type[ti] : T.WATER;
        if (t === T.WATER || t === T.MOUNTAIN || t === T.RIVER) continue;
        if (i === 0 || i === SEG / 2 || i === SEG / 4 || i === (SEG * 3) / 4) continue; // portes
        d.position.set(mx - N / 2, w.heightAt(mx, my) - 0.01, my - N / 2); d.rotation.set(0, -Math.atan2(y1 - y0, x1 - x0), 0);
        d.scale.set(Math.hypot(x1 - x0, y1 - y0) / 0.76, 1, 1); d.updateMatrix();
        this.wallSeg[e].push(d.matrix, this.col.setScalar(1)); pieces++;
        if (i % 3 === 1) { d.position.set(x0 - N / 2, w.heightAt(x0, y0) - 0.01, y0 - N / 2); d.rotation.set(0, 0, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.wallTower[e].push(d.matrix, this.col.setScalar(1)); pieces++; }
      }
    }
    for (let e = 1; e <= 5; e++) { this.wallSeg[e].end(); this.wallTower[e].end(); }
    this.stats.wallPieces = pieces;
  }
}
