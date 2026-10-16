/**
 * L'ÉVASION DE SPARROW — moteur de jeu (logique pure, sans DOM, testable).
 * Unités : pixels « logiques » (pixel art) et secondes.
 */

export const START_DAYS = 1826;
/** Distance à parcourir pour « gagner » un jour. */
export const PX_PER_DAY = 34;
export const KEBAB_DAYS = 5;
export const MAX_MASKS = 3;
export const MILESTONES = [1500, 1000, 500, 100, 30, 7];

export const HERO_W = 14;
export const HERO_H = 20;
const GRAVITY = 1050;
const JUMP_V = 320;
const DOUBLE_JUMP_V = 270;

export type Kind = "calendar" | "clock" | "monday" | "kebab" | "mask" | "hourglass";

export interface Entity {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Altitude de base (lundis volants). */
  baseY: number;
  t: number;
  dead?: boolean;
}

export type GameEvent =
  | { type: "jump"; double: boolean }
  | { type: "land" }
  | { type: "hit"; masks: number }
  | { type: "collect"; kind: Kind; x: number; y: number }
  | { type: "milestone"; days: number }
  | { type: "over" }
  | { type: "won" };

export type Status = "ready" | "running" | "over" | "won";

const SIZES: Record<Kind, [number, number]> = {
  calendar: [12, 13],
  clock: [12, 14],
  monday: [14, 7],
  kebab: [10, 9],
  mask: [10, 7],
  hourglass: [8, 9],
};

export const isObstacle = (k: Kind) => k === "calendar" || k === "clock" || k === "monday";

export class Engine {
  W: number;
  H: number;
  groundY: number;
  heroX: number;

  status: Status = "ready";
  time = 0;
  /** Distance visuelle (défilement du décor). */
  distance = 0;
  /** Progression normalisée (indépendante de la largeur d'écran) : sert au compteur. */
  run = 0;
  /** Facteur d'échelle horizontal : la vitesse s'adapte à la largeur de l'écran. */
  k = 1;
  kebabs = 0;
  masks = MAX_MASKS;
  speed = 0;
  slowT = 0;

  hero = { y: 0, vy: 0, onGround: true, jumps: 0, hurtT: 0, invT: 0 };
  entities: Entity[] = [];
  events: GameEvent[] = [];
  private nextSpawn = 0;
  private nextId = 1;
  private passed = new Set<number>();
  private rand: () => number;

  constructor(W: number, H: number, rand: () => number = Math.random) {
    this.W = W;
    this.H = H;
    this.groundY = H - Math.max(22, Math.round(H * 0.16));
    this.heroX = Math.round(Math.min(56, W * 0.22));
    this.k = Engine.scaleFor(W);
    this.rand = rand;
    this.reset();
  }

  resize(W: number, H: number) {
    const dy = H - Math.max(22, Math.round(H * 0.16)) - this.groundY;
    this.W = W;
    this.H = H;
    this.groundY += dy;
    this.heroX = Math.round(Math.min(56, W * 0.22));
    this.k = Engine.scaleFor(W);
    this.hero.y += dy;
    for (const e of this.entities) {
      e.y += dy;
      e.baseY += dy;
    }
  }

  static scaleFor(W: number) {
    return Math.min(1.4, Math.max(0.6, W / 200));
  }

  reset() {
    this.status = "ready";
    this.time = 0;
    this.distance = 0;
    this.run = 0;
    this.kebabs = 0;
    this.masks = MAX_MASKS;
    this.slowT = 0;
    this.entities = [];
    this.events = [];
    this.passed.clear();
    this.hero = { y: this.groundY - HERO_H, vy: 0, onGround: true, jumps: 0, hurtT: 0, invT: 0 };
    // Temps de chauffe : premier obstacle après ~1,5 s.
    this.nextSpawn = this.W + this.baseSpeedRaw() * this.k * 1.2;
    this.speed = this.baseSpeed();
  }

  /** Jours restants : la course fait tomber le compteur, les kebabs aussi. */
  get daysLeft(): number {
    return Math.max(0, START_DAYS - Math.floor(this.run / PX_PER_DAY) - this.kebabs * KEBAB_DAYS);
  }

  get daysDone(): number {
    return START_DAYS - this.daysLeft;
  }

  /** Vitesse « de référence » (écran de 200 px de large). */
  baseSpeedRaw(): number {
    const done = this.run / PX_PER_DAY + this.kebabs * KEBAB_DAYS;
    return Math.min(265, 115 + done * 0.075);
  }

  /** Vitesse réelle à l'écran. */
  baseSpeed(): number {
    return this.baseSpeedRaw() * this.k;
  }

  start() {
    if (this.status === "running") return;
    if (this.status !== "ready") this.reset();
    this.status = "running";
  }

  /** Saut (ou double saut en l'air). Démarre la partie si besoin. */
  jump() {
    if (this.status !== "running") {
      this.start();
      return;
    }
    const h = this.hero;
    if (h.onGround) {
      h.vy = -JUMP_V;
      h.onGround = false;
      h.jumps = 1;
      this.events.push({ type: "jump", double: false });
    } else if (h.jumps < 2) {
      h.vy = -DOUBLE_JUMP_V;
      h.jumps = 2;
      this.events.push({ type: "jump", double: true });
    }
  }

  update(dtRaw: number) {
    if (this.status !== "running") return;
    const dt = Math.min(dtRaw, 1 / 30);
    this.time += dt;

    this.slowT = Math.max(0, this.slowT - dt);
    const target = this.baseSpeed() * (this.slowT > 0 ? 0.55 : 1);
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    const dx = this.speed * dt;

    const before = this.daysLeft;
    this.distance += dx;
    this.run += dx / this.k;

    // Héros
    const h = this.hero;
    h.hurtT = Math.max(0, h.hurtT - dt);
    h.invT = Math.max(0, h.invT - dt);
    if (!h.onGround) {
      h.vy += GRAVITY * dt;
      h.y += h.vy * dt;
      if (h.y >= this.groundY - HERO_H) {
        h.y = this.groundY - HERO_H;
        h.vy = 0;
        h.onGround = true;
        h.jumps = 0;
        this.events.push({ type: "land" });
      }
    }

    // Entités
    for (const e of this.entities) {
      e.x -= dx;
      e.t += dt;
      if (e.kind === "monday") e.y = e.baseY + Math.sin(e.t * 3.2) * 9;
    }
    this.entities = this.entities.filter((e) => !e.dead && e.x + e.w > -20);

    // Apparitions
    while (this.distance + this.W >= this.nextSpawn) this.spawn();

    this.collide();

    // Paliers
    const after = this.daysLeft;
    for (const m of MILESTONES) if (before > m && after <= m) this.events.push({ type: "milestone", days: m });
    if (after === 0 && this.status === "running") {
      this.status = "won";
      this.events.push({ type: "won" });
    }
  }

  private add(kind: Kind, x: number, y: number) {
    const [w, h] = SIZES[kind];
    this.entities.push({ id: this.nextId++, kind, x, y, w, h, baseY: y, t: this.rand() * 6 });
  }

  /** Génère le prochain motif d'obstacles, et un éventuel bonus dans l'intervalle. */
  private spawn() {
    const x = this.nextSpawn - this.distance;
    const r = this.rand();
    const late = this.daysLeft < 1000;
    const g = this.groundY;

    if (r < 0.38) this.add("calendar", x, g - SIZES.calendar[1]);
    else if (r < 0.62) this.add("clock", x, g - SIZES.clock[1]);
    else if (r < 0.84) this.add("monday", x, g - 30);
    else if (late) {
      // Double calendrier : saut long obligatoire.
      this.add("calendar", x, g - SIZES.calendar[1]);
      this.add("calendar", x + 13, g - SIZES.calendar[1]);
    } else this.add("calendar", x, g - SIZES.calendar[1]);

    const s = this.baseSpeed();
    const gap = s * (0.85 + this.rand() * 0.9) + 40 * this.k;

    // Bonus au milieu de l'intervalle.
    const br = this.rand();
    const bx = x + gap / 2;
    if (br < 0.05) this.add("hourglass", bx, g - 44);
    else if (br < 0.13 && this.masks < MAX_MASKS) this.add("mask", bx, g - 40);
    else if (br < 0.6) this.add("kebab", bx, this.rand() < 0.5 ? g - 12 : g - 46);

    this.nextSpawn += gap;
  }

  private collide() {
    const h = this.hero;
    // Boîte du héros légèrement réduite : on pardonne les frôlements.
    const hx = this.heroX + 3;
    const hy = h.y + 3;
    const hw = HERO_W - 6;
    const hh = HERO_H - 4;
    for (const e of this.entities) {
      if (e.dead) continue;
      const pad = isObstacle(e.kind) ? 2 : -2;
      const hit =
        hx < e.x + e.w - pad && hx + hw > e.x + pad && hy < e.y + e.h - pad && hy + hh > e.y + pad;
      if (!hit) continue;
      if (isObstacle(e.kind)) {
        if (h.invT > 0 || this.passed.has(e.id)) continue;
        this.passed.add(e.id);
        this.masks -= 1;
        h.hurtT = 0.35;
        h.invT = 1.3;
        this.events.push({ type: "hit", masks: this.masks });
        if (this.masks <= 0) {
          this.status = "over";
          this.events.push({ type: "over" });
          return;
        }
      } else {
        e.dead = true;
        if (e.kind === "kebab") this.kebabs += 1;
        if (e.kind === "mask") this.masks = Math.min(MAX_MASKS, this.masks + 1);
        if (e.kind === "hourglass") this.slowT = 4.5;
        this.events.push({ type: "collect", kind: e.kind, x: e.x, y: e.y });
      }
    }
  }

  drain(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
