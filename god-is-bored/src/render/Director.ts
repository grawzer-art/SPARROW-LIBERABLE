import type { SimulationEngine } from "../sim/SimulationEngine";
import type { Renderer } from "./Renderer";
import type { Talk } from "../sim/Talk";

/**
 * Réalisateur discret : cadre l'action sans interface. Vue générale du village, rapprochement sur la conversation qui compte
 * (de profil), suivi du groupe qui part, regard sur le chantier, puis retour à la vue générale. Il ne lit que l'état réel de la
 * simulation (conversations, projets, chantiers) et s'efface dès que le joueur touche la caméra.
 */
export class Director {
  private phase: "overview" | "talk" | "follow" | "build" = "overview";
  private t = 0;
  private az = 0.9;
  private paused = 0;
  private key = "";
  private lastTalk = new Set<string>();
  private follower = -1;
  private scanT = 0;
  enabled = true;
  log: string[] = [];

  constructor(private sim: () => SimulationEngine, private r: Renderer, private home: () => { x: number; y: number }, private cast: () => number[], private site: () => number) {}

  /** Le joueur a pris la main : le réalisateur se met en retrait quelques secondes. */
  yield(seconds = 14): void { this.paused = seconds; }

  private note(s: string): void { this.log.push(`${this.sim().tick}: ${s}`); if (this.log.length > 40) this.log.shift(); }

  update(dt: number): void {
    if (!this.enabled) return;
    if (this.paused > 0) { this.paused -= dt; return; }
    const sim = this.sim(), r = this.r;
    this.t += dt; this.scanT += dt;
    const k = Math.min(1, dt * 1.8);
    const cast = this.cast();
    // quelle conversation mérite l'attention ? une conversation du casting, nouvelle, en cours
    const pick = (): Talk | undefined => {
      let best: Talk | undefined, bs = -1;
      for (const t of sim.talk.talks.values()) {
        if (t.over) continue;
        const k2 = `${t.a}:${t.b}:${t.start}`;
        const castBoost = (cast.includes(t.a) ? 1 : 0) + (cast.includes(t.b) ? 1 : 0);
        const s = castBoost * 2 + (t.topic === 3 || t.topic === 2 ? 1.5 : 0) + (this.lastTalk.has(k2) ? -3 : 0) + t.lines.length * 0.1;
        if (s > bs) { bs = s; best = t; }
      }
      return bs >= 1 ? best : undefined;
    };
    if (this.phase === "overview") {
      const h = this.home();
      this.az += dt * 0.07;
      r.glide(h.x, h.y + 1, 15.5, 0.74, this.az, k * 0.7);
      if (this.t > 5.5 && this.scanT > 0.4) {
        this.scanT = 0;
        const t = pick();
        if (t) { this.phase = "talk"; this.t = 0; this.key = `${t.a}:${t.b}:${t.start}`; this.lastTalk.add(this.key); this.note(`cadre la conversation ${t.a}/${t.b}`); return; }
        if (this.t > 13) {
          const b = sim.buildingById.get(this.site());
          if (b && b.progress < 1) { this.phase = "build"; this.t = 0; this.note("regarde le chantier"); }
        }
      }
      return;
    }
    if (this.phase === "talk") {
      const t = [...sim.talk.talks.values()].find((x) => `${x.a}:${x.b}:${x.start}` === this.key);
      const A = t && sim.citizenById.get(t.a), B = t && sim.citizenById.get(t.b);
      if (!t || !A || !B || (t.over && this.t > 2) || this.t > 40) {
        // après l'échange : si quelqu'un part, on le suit ; sinon retour à la vue générale
        const leader = cast.map((id) => sim.citizenById.get(id)).find((c) => c && !c.dead && c.mind?.goal === 1 && c.mind.go !== undefined && c.mind.go > sim.tick - 400);
        if (leader) { this.phase = "follow"; this.follower = leader.id; this.t = 0; this.note(`suit ${leader.name} qui part`); } else { this.phase = "overview"; this.t = 0; }
        return;
      }
      const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2, ax = Math.atan2(B.y - A.y, B.x - A.x), cur = r.getPose();
      const opts = [ax + Math.PI / 2, ax - Math.PI / 2];
      const diff = (u: number) => Math.abs(Math.atan2(Math.sin(u - cur.az), Math.cos(u - cur.az)));
      r.glide(mx, my, 5.6, 0.46, diff(opts[0]) < diff(opts[1]) ? opts[0] : opts[1], k);
      return;
    }
    if (this.phase === "follow") {
      const c = sim.citizenById.get(this.follower);
      if (!c || c.dead || this.t > 38 || (c.mind?.goal !== 1 && this.t > 4)) { this.phase = "overview"; this.t = 0; this.note("retour à la vue générale"); return; }
      const cur = r.getPose();
      r.glide(c.x, c.y, 8.5, 0.52, cur.az + dt * 0.05, k);
      return;
    }
    if (this.phase === "build") {
      const b = sim.buildingById.get(this.site());
      if (!b || this.t > 9) { this.phase = "overview"; this.t = 0; return; }
      r.glide(b.x + 0.5, b.y + 0.5, 11, 0.5, this.az + 0.6, k);
    }
  }
}
