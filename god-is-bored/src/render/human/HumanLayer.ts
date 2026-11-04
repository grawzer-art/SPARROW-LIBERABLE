import * as THREE from "three";
import type { SimulationEngine } from "../../sim/SimulationEngine";
import type { Citizen } from "../../sim/types";
import { actionMode } from "../CitizenLayer";
import { HumanActor, HumanLibrary } from "./HumanLibrary";

/**
 * Habitants en vrais humains 3D riggés (glTF) pour ceux qui sont près de la caméra ; les autres restent en silhouettes instanciées (LOD).
 * Budget : au plus `max` humains animés, choisis parmi les plus proches visibles ; chaque humain est recyclé (pool par corps).
 * Les animations découlent de l'état réel de la simulation (même `actionMode` que le rendu instancié) :
 * marche et course = clips de capture de mouvement dont la vitesse suit le déplacement réel ; conversation = geste d'acquiescement pour celui qui parle
 * (bouche animée) et attention pour l'écoute ; travail, repos et portage n'ont pas encore de clip de capture (voir docs/realism/AUDIT.md).
 */
const SKIN = [0xe7b99a, 0xcf9a74, 0xa9744f, 0x84583a, 0xf0c8aa];
/** Hauteur d'un humain en unités de monde (1 case ≈ 1 unité) : choisie pour rester lisible face aux bâtiments existants. */
const HUMAN_H = 0.62;

interface Slot { actor: HumanActor; id: number; body: string; yaw: number; last: number; vx: number; }

export class HumanLayer {
  lib: HumanLibrary | null = null;
  private pool = new Map<string, HumanActor[]>();
  private active = new Map<number, Slot>();
  private sorted: { c: Citizen; d: number }[] = [];
  stats = { humans: 0, ready: false };

  constructor(private scene: THREE.Scene, private max: number, private maxDist: number) {
    const q = new URLSearchParams(location.search);
    if (q.get("blocks") === "1") return; // retour à l'ancien rendu en blocs (diagnostic)
    HumanLibrary.load("").then((l) => { this.lib = l; this.stats.ready = true; }).catch((e) => console.warn("humains 3D indisponibles", e));
  }

  /** Choisit les habitants à rendre en humains 3D (les plus proches, visibles). Retourne leurs identifiants (le rendu en blocs les saute). */
  select(sim: SimulationEngine, cam: THREE.Vector3, frustum: THREE.Frustum): Set<number> {
    const out = new Set<number>();
    if (!this.lib) return out;
    const N = sim.world.size, v = new THREE.Vector3();
    this.sorted.length = 0;
    for (const c of sim.citizens) {
      if (c.dead) continue;
      v.set(c.x - N / 2, sim.world.heightAt(c.x, c.y) + 0.3, c.y - N / 2);
      const d = v.distanceTo(cam);
      if (d > this.maxDist || !frustum.containsPoint(v)) continue;
      this.sorted.push({ c, d });
    }
    this.sorted.sort((a, b) => a.d - b.d);
    for (let i = 0; i < Math.min(this.max, this.sorted.length); i++) out.add(this.sorted[i].c.id);
    // les choisis gardent leur place s'ils sont encore proches (évite les permutations d'un frame à l'autre)
    for (const id of this.active.keys()) if (!out.has(id)) { const c = sim.citizenById.get(id); if (!c || c.dead || !this.sorted.some((s) => s.c.id === id && s.d < this.maxDist * 0.9) || out.size >= this.max) this.release(id); else if (out.size < this.max) out.add(id); }
    return out;
  }

  private release(id: number): void {
    const s = this.active.get(id); if (!s) return;
    this.scene.remove(s.actor.group); s.actor.speak = 0;
    (this.pool.get(s.body) ?? this.pool.set(s.body, []).get(s.body)!).push(s.actor);
    this.active.delete(id);
  }

  update(sim: SimulationEngine, ids: Set<number>, alpha: number, dt: number, night: number): void {
    if (!this.lib) return;
    const N = sim.world.size, w = sim.world;
    for (const id of ids) {
      const c = sim.citizenById.get(id); if (!c || c.dead) continue;
      let s = this.active.get(id);
      if (!s) {
        const body = c.female ? "michelle" : "rpm_man";
        const actor = this.pool.get(body)?.pop() ?? this.lib.spawn(body);
        actor.look({ height: (c.job === "child" ? 0.62 : 0.94 + (c.id % 7) * 0.016) * HUMAN_H / 1.75, skin: SKIN[c.id % SKIN.length] });
        this.scene.add(actor.group);
        s = { actor, id, body, yaw: 0, last: -1, vx: 0 }; this.active.set(id, s);
      }
      const a = s.actor;
      const x = c.px + (c.x - c.px) * alpha, y = c.py + (c.y - c.py) * alpha;
      a.group.position.set(x - N / 2, w.heightAt(x, y), y - N / 2);
      const moved = Math.hypot(c.x - c.px, c.y - c.py);
      s.vx += (moved - s.vx) * Math.min(1, dt * 7);
      const moving = s.vx > 0.0035;
      // cap : sens du déplacement ; face à l'interlocuteur pendant une conversation (même logique que le rendu en blocs)
      let goal = NaN;
      if (moving && moved > 0.0005) goal = Math.atan2(-(c.y - c.py), c.x - c.px);
      else if (c.state === "talk") { const o = sim.citizenById.get(c.soul?.target ?? -1); if (o && Math.hypot(o.x - x, o.y - y) > 0.05) goal = Math.atan2(-(o.y - y), o.x - x); }
      else if (c.wx >= 0 && (c.state === "work" || c.state === "forage")) goal = Math.atan2(-(c.wy - y), c.wx - x);
      if (goal === goal) { let dy = goal - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += dy * Math.min(1, dt * (moving ? 9 : 6)); }
      a.group.rotation.y = s.yaw + Math.PI / 2; // le modèle regarde vers +Z, la simulation vers +X
      // animation déduite de l'état réel
      const tk = c.state === "talk" ? sim.talk.of(c) : undefined;
      const am = actionMode(c, moving, night, tk ? { speaking: tk.speaking, mood: tk.talk.mood } : undefined);
      let clip = "idle", speed = 1;
      if (c.state === "flee" || (moving && c.panic > 0)) { clip = "run"; speed = 1; }
      else if (moving) { clip = am.mode === 10 || c.state === "march" ? "walk" : "walk"; speed = Math.max(0.7, Math.min(3, (s.vx * 10 * (sim.speed || 1)) / (1.3 * HUMAN_H / 1.75 * 1.0))); }
      else if (am.mode === 7) { clip = "agree"; speed = 0.55; }
      else if (am.mode === 9) { clip = "headShake"; speed = 0.9; }
      else if (am.mode === 4 || c.sick > 0) { clip = "sad_pose"; speed = 1; }
      a.play(clip, 0.3, clip === "walk" ? speed : clip === "idle" ? 1 : speed);
      a.speak = am.mode === 7 ? 1 : 0;
      if (am.mode !== 7) a.face(c.soul && c.soul.com > 60 ? 0.2 : 0, 0);
      a.update(dt);
    }
    this.stats.humans = this.active.size;
  }

  clear(): void { for (const id of [...this.active.keys()]) this.release(id); }
}
