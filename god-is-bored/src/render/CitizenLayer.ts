import * as THREE from "three";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { Army, Citizen, Civ } from "../sim/types";
import { CharSet, TOOL, characterGeometry, loadGeometry, characterMaterial, farPersonGeometry, gearGeometry, toolGeometry } from "./Characters";
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

/**
 * Animation d'un habitant déduite de son état et de son métier RÉELS dans la simulation :
 * bûcheron → hache, mineur → pioche, cultivateur → houe (panier à la cueillette), bâtisseur → marteau, érudit → tablette.
 * Modes : 0 repos, 1 marche, 2 frappe, 3 combat, 4 assis, 5 bêche/cueillette, 6 lecture.
 */
/** Teinte des vêtements par métier (lisibilité) : paille, flanelle rouge, ardoise, ocre, bleu savant. */
const JOB_TINT: Record<string, number> = { farmer: 0xd2b04c, lumberjack: 0xb23a2a, miner: 0x6c7380, builder: 0xe08a34, scholar: 0x3f5fb8, child: 0xf0d8a0 };

export function animFor(c: Pick<Citizen, "state" | "job" | "sick">, moving: boolean, night: number): { mode: number; tool: number; speed: number } {
  const adult = c.job !== "child";
  switch (c.state) {
    case "work": case "build": case "forage": {
      if (moving) return { mode: 1, tool: -1, speed: 1 };
      if (!adult) return { mode: 0, tool: -1, speed: 1 };
      if (c.job === "farmer") return { mode: 5, tool: c.state === "forage" ? TOOL.basket : TOOL.hoe, speed: 1 };
      if (c.job === "lumberjack") return { mode: 2, tool: TOOL.axe, speed: 1 };
      if (c.job === "miner") return { mode: 2, tool: TOOL.pick, speed: 1 };
      if (c.job === "builder") return { mode: 2, tool: TOOL.hammer, speed: 1 };
      if (c.job === "scholar") return { mode: 6, tool: TOOL.tablet, speed: 1 };
      return { mode: c.state === "forage" ? 5 : 0, tool: -1, speed: 1 };
    }
    case "fight": return { mode: 3, tool: -1, speed: 1.1 };
    case "flee": return { mode: 1, tool: -1, speed: 1.8 };
    case "rest": return { mode: 4, tool: -1, speed: 1 };
    case "march": return { mode: 1, tool: -1, speed: 1.15 };
    default: return { mode: moving ? 1 : (c.sick > 0 || (night > 0.65 && c.state === "idle" && adult) ? 4 : 0), tool: -1, speed: 1 };
  }
}

/**
 * Animation d'un habitant déduite de son état RÉEL : activité, métier, conversation (qui parle, sur quel ton), charge portée.
 * Fonction pure (testée) : aucune animation ne contredit l'action simulée. Modes : 0 repos, 1 marche, 2 frappe, 3 combat, 4 assis,
 * 5 bêche/cueillette, 6 lecture, 7 parle, 8 écoute, 9 dispute, 10 porte une charge.
 */
export function actionMode(c: Pick<Citizen, "state" | "job" | "sick" | "work" | "wx">, moving: boolean, night: number, talk?: { speaking: boolean; mood: number }): { mode: number; tool: number; carry: number; speed: number } {
  const an = animFor(c, moving, night), adult = c.job !== "child";
  if (c.state === "talk") return talk ? { mode: talk.mood === 1 ? 9 : talk.speaking ? 7 : 8, tool: -1, carry: -1, speed: 1 } : { mode: 0, tool: -1, carry: -1, speed: 1 };
  if (moving && adult && (c.state === "build" || c.state === "work") && c.job === "builder" && c.work >= 0) return { mode: 10, tool: -1, carry: 0, speed: 1 }; // planches vers le chantier
  if (moving && adult && c.state === "work" && c.job === "lumberjack" && c.wx < 0) return { mode: 10, tool: -1, carry: 1, speed: 1 }; // bois rapporté
  if (moving && adult && c.state === "forage") return { mode: an.mode, tool: TOOL.basket, carry: -1, speed: an.speed };
  return { mode: an.mode, tool: an.tool, carry: -1, speed: an.speed };
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
  /** État d'animation par habitant : cap lissé, mode courant/précédent (fondu), vitesse lissée. */
  private cs = new Map<number, { yaw: number; mode: number; prev: number; blend: number; v: number }>();
  private lastT = 0;
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
    this.cs.clear();
  }

  private set(key: string, make: () => THREE.BufferGeometry): CharSet {
    let s = this.sets.get(key);
    if (!s) { s = new CharSet(this.scene, make(), this.mat, 96); this.sets.set(key, s); }
    return s;
  }

  /** Teinte des vêtements : étoffe de l'époque mêlée à la couleur de la civilisation, 8 variantes par habitant. */
  private cloth(civ: Civ, era: number, id: number, soldier: boolean, job = ""): THREE.Color {
    const key = `${civ.id}:${era}`;
    let v = this.variants.get(key);
    if (!v) {
      v = [];
      for (let k = 0; k < 8; k++) {
        const c = new THREE.Color(ERA_CLOTH[era]).lerp(this.tmp.setHex(civ.color), 0.5 + (k % 3) * 0.1);
        c.offsetHSL(((k * 37) % 11 - 5) * 0.009, ((k * 17) % 7 - 3) * 0.04, ((k * 13) % 9 - 4) * 0.032);
        // lisibilité : aux ères du chaume et de la pierre, les vêtements restent plus sombres et plus saturés que les toits et le sol
        if (era <= 2) { const hsl = { h: 0, s: 0, l: 0 }; c.getHSL(hsl); c.setHSL(hsl.h, Math.max(0.38, Math.min(0.75, hsl.s + 0.1)), Math.max(0.2, Math.min(0.36, hsl.l * 0.62))); }
        v.push(c);
      }
      this.variants.set(key, v);
    }
    const base = v[id & 7];
    this.col.copy(base);
    const jc = JOB_TINT[job];
    if (jc !== undefined) this.col.lerp(this.tmp.setHex(jc), 0.42); // le métier se lit d'un coup d'œil
    return soldier ? this.col.multiplyScalar(0.8) : this.col;
  }

  update(sim: SimulationEngine, alpha: number, time: number, zoomScale: number, fx: Fx, detail: boolean, frustum: THREE.Frustum, camPos: THREE.Vector3, night: number): void {
    const w = sim.world, N = w.size, d = this.d;
    for (const s of this.sets.values()) s.begin();
    this.far.begin(); this.blobs.begin();
    let n = 0, ns = 0, drawn = 0, nfar = 0;
    const cap = this.mobile ? 2600 : 3500;
    const maxD = this.mobile ? 95 : 150;
    const spBoost = sim.speed >= 3 ? 1.35 : 1;
    const dtc = Math.min(0.1, Math.max(0.001, time - this.lastT)); this.lastT = time;
    if (this.cs.size > 9000) this.cs.clear();
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
      let st = this.cs.get(c.id);
      if (!st) { st = { yaw: ((c.id * 0.7) % 6.283), mode: 0, prev: 0, blend: 0, v: 0 }; this.cs.set(c.id, st); }
      st.v += (moved - st.v) * Math.min(1, dtc * 7);
      const moving = st.v > 0.0035;
      const working = c.state === "work" || c.state === "build" || c.state === "forage";
      // cap : dans le sens du déplacement, sinon face à la tâche réelle (arbre, roche, chantier, champ), sinon on garde l'orientation
      let goal = NaN;
      if (moving && moved > 0.0005) goal = Math.atan2(-(c.y - c.py), c.x - c.px);
      else if (c.state === "talk") {
        // face à face : on se tourne vers son interlocuteur réel (celui de la conversation simulée)
        const o = sim.citizenById.get(c.soul?.target ?? -1);
        if (o && Math.hypot(o.x - x, o.y - y) > 0.05) goal = Math.atan2(-(o.y - y), o.x - x);
      }
      else if (working || c.state === "fight") {
        let tx = -1, ty = -1;
        if (c.wx >= 0 && (c.job === "lumberjack" || c.job === "miner")) { tx = c.wx; ty = c.wy; }
        else if (c.work >= 0) { const b = sim.buildingById.get(c.work); if (b) { tx = b.x + 0.5; ty = b.y + 0.5; } }
        if (tx < 0 && c.wx >= 0) { tx = c.wx; ty = c.wy; }
        if (tx >= 0 && Math.hypot(tx - x, ty - y) > 0.05) goal = Math.atan2(-(ty - y), tx - x);
      }
      else if (c.state === "idle" || c.state === "wander") {
        // au repos près du foyer du village : on se tourne vers lui (petits groupes qui se regardent, pas des poses aléatoires)
        const city = sim.cityById.get(c.city);
        if (city) { const hx = city.x + 0.5, hz = city.y + 0.5; const dd = Math.hypot(hx - x, hz - y); if (dd < 3.2 && dd > 0.4) goal = Math.atan2(-(hz - y), hx - x); }
      }
      if (goal === goal) { let dy = goal - st.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); st.yaw += dy * Math.min(1, dtc * (moving ? 9 : 5)); }
      const yaw = st.yaw;
      const adult = c.job !== "child";
      const vr = (c.id >> 3) % 7;
      const sc = (adult ? 1.14 + (c.id % 9) * 0.016 : 0.74 + Math.min(0.24, c.age * 0.018)) * zoomScale * (c.female && adult ? 0.96 : 1);
      const sw = sc * (0.94 + vr * 0.02);
      d.position.set(x - N / 2, hy, y - N / 2);
      d.rotation.set(0, yaw, 0);
      d.scale.set(sw, sc, sw);
      d.updateMatrix();
      const cl = this.cloth(civ, era, c.id, soldier, c.job);
      if (!detail) {
        this.far.push(d.matrix, cl);
        nfar++;
        continue;
      }
      // comportement -> animation (réelle : l'état et le métier viennent de la simulation)
      const an = animFor(c, moving, night);
      const tkr = c.state === "talk" ? sim.talk.of(c) : undefined;
      const am = actionMode(c, moving, night, tkr ? { speaking: tkr.speaking, mood: tkr.talk.mood } : undefined);
      const want = am.mode, tool = am.tool, carry = am.carry;
      let sp = am.speed;
      sp *= spBoost;
      // fondu entre deux animations (~0.22 s) : plus de saccade à l'arrêt ou au départ
      if (want !== st.mode) { st.prev = st.mode; st.mode = want; st.blend = 1; }
      else if (st.blend > 0) st.blend = Math.max(0, st.blend - dtc / 0.22);
      const mode = st.mode, prevCode = st.prev + st.blend * 0.95;
      const phase = (c.id % 97) * 0.9;
      const skin = c.sick > 0 ? this.skinTmp.copy(SKIN[c.id % 5]).lerp(SICK, 0.6) : SKIN[c.id % 5];
      const hair = c.age > 55 ? GRAY : HAIR[(c.id * 7) % 6];
      const acc = this.accTmp.setHex(civ.color);
      const variant = (c.id * 7 + 3) % 5 < 2 ? 1 : 0;
      const S = this.set(`c${era}${c.female ? "f" : "m"}${variant}`, () => characterGeometry(era, c.female, variant));
      S.push(d.matrix, mode, phase, sp, prevCode, cl, skin, hair, acc);
      if (soldier) { this.set(`g${era}`, () => gearGeometry(era)).push(d.matrix, mode, phase, sp, prevCode, cl, skin, hair, acc); ns++; }
      else if (carry >= 0 && mode === 10) { const ck = carry; this.set(`l${ck}`, () => loadGeometry(ck)).push(d.matrix, mode, phase, sp, prevCode, cl, skin, hair, acc); }
      else if (tool >= 0 && (mode === 2 || mode === 5 || mode === 6 || (mode === 1 && tool === TOOL.basket)) && adult) { const tk = tool; this.set(`t${era}k${tk}`, () => toolGeometry(era, tk)).push(d.matrix, mode, phase, sp, prevCode, cl, skin, hair, acc); }
      // ombre portée simplifiée : disque sombre au sol
      d.position.y = hy + 0.012; d.scale.set(sw, 1, sw); d.rotation.set(0, 0, 0); d.updateMatrix();
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
