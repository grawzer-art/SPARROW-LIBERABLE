/**
 * L'ÉVASION DE SPARROW — moteur de jeu (logique pure, sans DOM, testable).
 * Unités : pixels « logiques » (pixel art) et secondes.
 */

export const START_DAYS = 1826;
/** Distance à parcourir pour « gagner » un jour. */
export const PX_PER_DAY = 34;
export const FRITES_DAYS = 5;
export const MAX_MASKS = 3;
export const MILESTONES = [1500, 1000, 500, 100, 30, 7];

export const HERO_W = 14;
export const HERO_H = 20;
const GRAVITY = 1100;
const JUMP_V = 330;
const DOUBLE_JUMP_V = 280;

export type Kind = "calendar" | "clock" | "monday" | "hole" | "frites" | "mask" | "hourglass";

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
  /** Amplitude / vitesse d'oscillation des lundis. */
  amp?: number;
  dead?: boolean;
}

export type GameEvent =
  | { type: "jump"; double: boolean }
  | { type: "land" }
  | { type: "hit"; masks: number; fall: boolean }
  | { type: "collect"; kind: Kind; x: number; y: number }
  | { type: "milestone"; days: number }
  | { type: "over" }
  | { type: "won" };

export type Status = "ready" | "running" | "over" | "won";

const SIZES: Record<Kind, [number, number]> = {
  calendar: [12, 13],
  clock: [12, 14],
  monday: [14, 7],
  hole: [22, 30],
  frites: [10, 9],
  mask: [10, 7],
  hourglass: [8, 9],
};

export const isObstacle = (k: Kind) => k === "calendar" || k === "clock" || k === "monday" || k === "hole";

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
  frites = 0;
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
    this.heroX = Math.round(Math.min(56, W * 0.26));
    this.k = Engine.scaleFor(W);
    this.rand = rand;
    this.reset();
  }

  static scaleFor(W: number) {
    return Math.min(1.4, Math.max(0.6, W / 200));
  }

  resize(W: number, H: number) {
    const dy = H - Math.max(22, Math.round(H * 0.16)) - this.groundY;
    this.W = W;
    this.H = H;
    this.groundY += dy;
    this.heroX = Math.round(Math.min(56, W * 0.26));
    this.k = Engine.scaleFor(W);
    this.hero.y += dy;
    for (const e of this.entities) {
      e.y += dy;
      e.baseY += dy;
    }
  }

  reset() {
    this.status = "ready";
    this.time = 0;
    this.distance = 0;
    this.run = 0;
    this.frites = 0;
    this.masks = MAX_MASKS;
    this.slowT = 0;
    this.entities = [];
    this.events = [];
    this.passed.clear();
    this.hero = { y: this.groundY - HERO_H, vy: 0, onGround: true, jumps: 0, hurtT: 0, invT: 0 };
    // Temps de chauffe : premier obstacle après ~1,2 s.
    this.nextSpawn = this.W + this.baseSpeedRaw() * this.k * 1.0;
    this.speed = this.baseSpeed();
  }

  /** Jours restants : la course fait tomber le compteur, les frites aussi. */
  get daysLeft(): number {
    return Math.max(0, START_DAYS - Math.floor(this.run / PX_PER_DAY) - this.frites * FRITES_DAYS);
  }

  get daysDone(): number {
    return START_DAYS - this.daysLeft;
  }

  /** Niveau de difficulté de 0 (début) à 1 (dernier jour). */
  get level(): number {
    return Math.min(1, this.daysDone / START_DAYS);
  }

  /** Vitesse « de référence » (écran de 200 px de large). */
  baseSpeedRaw(): number {
    const done = this.run / PX_PER_DAY + this.frites * FRITES_DAYS;
    return Math.min(310, 135 + done * 0.11);
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

  private overHole(): boolean {
    const cx = this.heroX + HERO_W / 2;
    return this.entities.some((e) => e.kind === "hole" && cx > e.x + 3 && cx < e.x + e.w - 3);
  }

  update(dtRaw: number) {
    if (this.status !== "running") return;
    const dt = Math.min(dtRaw, 1 / 30);
    this.time += dt;

    this.slowT = Math.max(0, this.slowT - dt);
    const target = this.baseSpeed() * (this.slowT > 0 ? 0.6 : 1);
    this.speed += (target - this.speed) * Math.min(1, dt * 3);
    const dx = this.speed * dt;

    const before = this.daysLeft;
    this.distance += dx;
    this.run += dx / this.k;

    // Héros
    const h = this.hero;
    h.hurtT = Math.max(0, h.hurtT - dt);
    h.invT = Math.max(0, h.invT - dt);
    if (h.onGround && this.overHole()) h.onGround = false; // il tombe dans le vide
    if (!h.onGround) {
      h.vy += GRAVITY * dt;
      h.y += h.vy * dt;
      const floor = this.groundY - HERO_H;
      if (h.y >= floor && !this.overHole()) {
        if (h.y - h.vy * dt <= floor + 2) {
          h.y = floor;
          h.vy = 0;
          h.onGround = true;
          h.jumps = 0;
          this.events.push({ type: "land" });
        }
      }
    }

    // Entités
    for (const e of this.entities) {
      e.x -= dx;
      e.t += dt;
      if (e.kind === "monday") e.y = e.baseY + Math.sin(e.t * (3 + this.level * 2.5)) * (e.amp ?? 9);
    }
    this.entities = this.entities.filter((e) => !e.dead && e.x + e.w > -30);

    // Apparitions
    while (this.distance + this.W >= this.nextSpawn) this.spawn();

    this.collide();
    if (this.status !== "running") return;

    // Paliers
    const after = this.daysLeft;
    for (const m of MILESTONES) if (before > m && after <= m) this.events.push({ type: "milestone", days: m });
    if (after === 0) {
      this.status = "won";
      this.events.push({ type: "won" });
    }
  }

  private add(kind: Kind, x: number, y: number, amp?: number) {
    const [w, h] = SIZES[kind];
    this.entities.push({ id: this.nextId++, kind, x, y, w, h, baseY: y, t: this.rand() * 6, amp });
  }

  /** Génère le prochain motif d'obstacles (de plus en plus vicieux), et un éventuel bonus. */
  private spawn() {
    const x = this.nextSpawn - this.distance;
    const g = this.groundY;
    const lvl = this.level;
    const r = this.rand();
    const calY = g - SIZES.calendar[1];
    const clkY = g - SIZES.clock[1];
    let width = 14;

    // Les motifs difficiles se débloquent au fil des jours.
    if (r < 0.24) this.add("calendar", x, calY);
    else if (r < 0.42) this.add("clock", x, clkY);
    else if (r < 0.58) this.add("monday", x, g - 30, 9 + lvl * 6);
    else if (r < 0.72) {
      this.add("hole", x, g);
      width = 22;
    } else if (r < 0.84 || lvl < 0.1) {
      // Double calendrier : saut long.
      this.add("calendar", x, calY);
      this.add("calendar", x + 12, calY);
      width = 24;
    } else if (r < 0.93 || lvl < 0.35) {
      // Horloge + lundi juste derrière : sauter puis rester bas.
      // Le lundi arrive juste après la réception : il faut alors rester au sol.
      const after = this.baseSpeed() * 0.62 + 18 * this.k;
      this.add("clock", x, clkY);
      this.add("monday", x + after, g - 36, 5);
      width = after + 14;
    } else {
      // Trou suivi d'un calendrier : double saut obligatoire.
      this.add("hole", x, g);
      this.add("calendar", x + 22 + 8, calY);
      width = 42;
    }

    const s = this.baseSpeed();
    const tight = 0.95 - lvl * 0.35; // les intervalles se resserrent
    const gap = width + s * (tight + this.rand() * 0.7) + 24 * this.k;

    // Bonus au milieu de l'intervalle.
    const br = this.rand();
    const bx = x + width + (gap - width) / 2 - 5;
    if (br < 0.04) this.add("hourglass", bx, g - 46);
    else if (br < 0.09 && this.masks < MAX_MASKS) this.add("mask", bx, g - 44);
    else if (br < 0.5) this.add("frites", bx, this.rand() < 0.45 ? g - 12 : g - 50);

    this.nextSpawn += gap;
  }

  private collide() {
    const h = this.hero;

    // Chute dans un trou : on perd un masque et on rebondit hors du vide.
    if (h.y > this.groundY - HERO_H + 14) {
      if (h.invT <= 0) this.damage(true);
      h.y = this.groundY - HERO_H + 14;
      h.vy = -JUMP_V * 1.05;
      h.jumps = 1;
      if (this.status !== "running") return;
    }

    // Boîte du héros légèrement réduite : on pardonne les frôlements.
    const hx = this.heroX + 3;
    const hy = h.y + 3;
    const hw = HERO_W - 6;
    const hh = HERO_H - 4;
    for (const e of this.entities) {
      if (e.dead || e.kind === "hole") continue;
      const pad = isObstacle(e.kind) ? 2 : -2;
      const hit = hx < e.x + e.w - pad && hx + hw > e.x + pad && hy < e.y + e.h - pad && hy + hh > e.y + pad;
      if (!hit) continue;
      if (isObstacle(e.kind)) {
        if (h.invT > 0 || this.passed.has(e.id)) continue;
        this.passed.add(e.id);
        this.damage(false);
        if (this.status !== "running") return;
      } else {
        e.dead = true;
        if (e.kind === "frites") this.frites += 1;
        if (e.kind === "mask") this.masks = Math.min(MAX_MASKS, this.masks + 1);
        if (e.kind === "hourglass") this.slowT = 4;
        this.events.push({ type: "collect", kind: e.kind, x: e.x, y: e.y });
      }
    }
  }

  private damage(fall: boolean) {
    this.masks -= 1;
    this.hero.hurtT = 0.35;
    this.hero.invT = 1.0;
    this.events.push({ type: "hit", masks: this.masks, fall });
    if (this.masks <= 0) {
      this.status = "over";
      this.events.push({ type: "over" });
    }
  }

  drain(): GameEvent[] {
    const ev = this.events;
    this.events = [];
    return ev;
  }
}
