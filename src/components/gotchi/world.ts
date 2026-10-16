/**
 * SPARROWGOTCHI 3.0 — l'appartement de Sparrow (rendu canvas pixel art).
 *
 * Quatre pièces côte à côte (Chambre, Coin gaming, Salon, Cuisine) ; la caméra suit
 * Sparrow. Le joueur le dirige au joystick (collisions avec les meubles) ou touche un
 * objet / un endroit pour qu'il y aille. Sans contrôle pendant un moment, il reprend
 * sa vie autonome. Chaque action reste une séquence : il marche jusqu'au meuble, puis l'anime.
 */

import { bake } from "../game/sprites";
import type { Anim, Mood, Scene } from "@/lib/gotchi/engine";
import {
  BACK,
  R,
  ROOM_W,
  START,
  WALL,
  WORLD_W,
  move,
  nearby,
  nearestStandable,
  objectAt,
  objectById,
  path,
  roomOf,
  type Interactable,
  type ObjectId,
  type Pos,
} from "@/lib/gotchi/room";
import { CAPE, FURNITURE, HATS, PROPS, sparrow, type Body, type Eyes, type Legs, type Look, type Mouth } from "./sprites";

export { ROOM_W, WORLD_W };
export const VIEW_W = 112;
export const VIEW_H = 64;
export const ROOMS = [
  { id: "chambre", label: "Chambre" },
  { id: "gaming", label: "Coin gaming" },
  { id: "salon", label: "Salon" },
  { id: "cuisine", label: "Cuisine" },
] as const;
const BASE = BACK; // ligne de base des meubles collés au mur
const WALK = 46; // vitesse au joystick (px/s)

/** Ce que fait Sparrow en ce moment (action du joueur, événement ou vie autonome). */
export type Activity = Anim | "use" | "danse" | "rire" | "panne" | "legendaire";

interface Seq {
  act: Activity;
  of?: string;
  spot: ObjectId | null;
  phase: "go" | "act";
  t: number;
  dur: number;
  auto: boolean;
  route: Pos[];
  /** Réplique à afficher : appelée à l'arrivée, ou tout de suite si la séquence est interrompue. */
  onAct?: () => void;
  /** Appelée seulement s'il arrive vraiment (ex. ouvrir le mini-jeu au PC). */
  onArrive?: () => void;
}

export interface Frame {
  mood: Mood;
  look: Look;
  deco: string[];
  pcBroken: boolean;
  cache: { x: number; y: number } | null;
  reduced: boolean;
}

export type Hit =
  | { kind: "cache" }
  | { kind: "sparrow" }
  | { kind: "object"; obj: Interactable }
  | { kind: "floor"; pos: Pos };

const SCENE_SPOT: Partial<Record<Scene, ObjectId>> = {
  frigo: "frigo",
  pc: "pc",
  canape: "canape",
  douche: "douche",
  panne: "pc",
  fenetre: "fenetre",
  lit: "lit",
};
const SCENE_ACT: Partial<Record<Scene, Activity>> = {
  danse: "danse",
  rire: "rire",
  rage: "rage",
  boude: "boude",
  panne: "panne",
  legendaire: "legendaire",
  douche: "douche",
  canape: "sieste",
  lit: "sieste",
  pc: "dofus",
  frigo: "frites",
};

function spotFor(act: Activity, of?: string): ObjectId | null {
  switch (act) {
    case "frites":
    case "gras":
    case "rabe":
      return "friteuse";
    case "salade":
    case "grimace":
    case "miracle":
      return "table";
    case "refus":
      return of === "salade" ? "table" : of === "dofus" ? "pc" : of === "sieste" ? "canape" : null;
    case "dofus":
    case "rage":
    case "drop":
    case "victoire":
      return "pc";
    case "sieste":
      return "canape";
    case "douche":
      return "douche";
    default:
      return null;
  }
}

const cache = new Map<string, HTMLCanvasElement>();
function img(key: string, rows: () => string[], flip = false) {
  const k = `${key}:${flip ? 1 : 0}`;
  let c = cache.get(k);
  if (!c) {
    c = bake(rows(), flip);
    cache.set(k, c);
  }
  return c;
}
const fur = (k: string) => img(`f:${k}`, () => FURNITURE[k]);
const prop = (k: string) => img(`p:${k}`, () => PROPS[k]);

function z(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#f1efe8";
  ctx.fillRect(x, y, s, 1);
  for (let i = 1; i < s - 1; i++) ctx.fillRect(x + s - 1 - i, y + i, 1, 1);
  ctx.fillRect(x, y + s - 1, s, 1);
}

export class World {
  x: number;
  y: number;
  dir: 1 | -1 = 1;
  cam: number;
  /** Direction du joystick (-1..1). */
  input = { x: 0, y: 0 };
  /** Statistiques de déplacement lues par l'interface (répliques contextuelles). */
  bumps = 0;
  walked = 0;
  private seq: Seq | null = null;
  private idleUntil = 2;
  private manualUntil = 0;
  private moving = false;
  private wasBlocked = false;
  private t = 0;
  private flash = 0;
  private walkPhase = 0;

  constructor(pos: Pos = START) {
    this.x = pos.x;
    this.y = pos.y;
    this.cam = Math.max(0, Math.min(WORLD_W - VIEW_W, pos.x - VIEW_W / 2));
  }

  get busy() {
    return !!this.seq && !this.seq.auto;
  }

  /** Le joueur l'a dirigé récemment : pas de vie autonome ni d'événement imposé. */
  get manual() {
    return this.t < this.manualUntil;
  }

  get room() {
    return roomOf(this.x);
  }

  get pos(): Pos {
    return { x: Math.round(this.x), y: Math.round(this.y) };
  }

  /** Objet utilisable juste à côté de lui (pour le bouton d'action). */
  near(): Interactable | null {
    if (this.seq && !this.seq.auto) return null;
    return nearby({ x: this.x, y: this.y });
  }

  nearCache(c: { x: number; y: number } | null) {
    return !!c && Math.hypot(c.x - this.x, (c.y - this.y) * 1.5) < 13;
  }

  private route(to: Pos) {
    return path({ x: this.x, y: this.y }, to);
  }

  /** Lance une séquence (action du joueur ou événement). onAct : quand il arrive au meuble. */
  play(act: Activity, opts: { of?: string; scene?: Scene; onAct?: () => void; reduced?: boolean } = {}) {
    this.cancel();
    let a = act;
    let spot = spotFor(act, opts.of);
    if (opts.scene) {
      spot = SCENE_SPOT[opts.scene] ?? null;
      a = SCENE_ACT[opts.scene] ?? (act === "event" ? "parler" : act);
    }
    if (a === "legendaire") this.flash = 2.2;
    const goal = spot ? objectById(spot).stand : null;
    if (goal && opts.reduced) {
      this.x = goal.x;
      this.y = goal.y;
    }
    this.seq = {
      act: a,
      of: opts.of,
      spot,
      phase: goal ? "go" : "act",
      t: 0,
      dur: a === "legendaire" ? 3.2 : 2.6,
      auto: false,
      route: goal ? this.route(goal) : [],
      onAct: opts.onAct,
    };
    if (!goal || opts.reduced) this.startAct();
  }

  /** Va jusqu'à un objet (puis onArrive) ou jusqu'à un point du sol. */
  goTo(target: ObjectId | Pos, onArrive?: () => void, reduced = false) {
    this.cancel();
    const obj = typeof target === "string" ? objectById(target) : null;
    const goal = obj ? obj.stand : nearestStandable(target as Pos);
    if (reduced) {
      this.x = goal.x;
      this.y = goal.y;
    }
    this.seq = { act: "use", spot: obj?.id ?? null, phase: "go", t: 0, dur: obj ? 1.4 : 0.1, auto: false, route: this.route(goal), onArrive };
    if (reduced) this.startAct();
  }

  /** Le joueur touche une pièce : Sparrow y va. */
  goRoom(i: number, reduced = false) {
    this.goTo({ x: R(i, 60), y: 58 }, undefined, reduced);
  }

  /** Interrompt la séquence en cours sans jamais perdre sa réplique. */
  private cancel() {
    const s = this.seq;
    this.seq = null;
    s?.onAct?.();
  }

  private startAct() {
    const s = this.seq!;
    s.phase = "act";
    s.t = 0;
    if (s.spot) this.dir = objectById(s.spot).face;
    const act = s.onAct;
    const arrive = s.onArrive;
    s.onAct = undefined;
    s.onArrive = undefined;
    act?.();
    arrive?.();
  }

  /** Qu'y a-t-il sous ce point (coordonnées canvas) ? */
  hit(px: number, py: number, f: Pick<Frame, "cache">): Hit {
    const wx = px + this.cam;
    if (f.cache && Math.abs(wx - f.cache.x) < 7 && Math.abs(py - f.cache.y) < 7) return { kind: "cache" };
    if (Math.abs(wx - this.x) < 8 && py > this.y - 22 && py <= this.y + 2) return { kind: "sparrow" };
    const obj = objectAt(wx, py);
    if (obj) return { kind: "object", obj };
    return { kind: "floor", pos: { x: wx, y: Math.max(py, WALL + 6) } };
  }

  /** Vie autonome : il va voir ses meubles selon son état. */
  private brain(mood: Mood) {
    const r = Math.random();
    let spot: ObjectId | null = null;
    if (mood === "dofus" || mood === "focus" || mood === "rage") spot = "pc";
    else if (mood === "gras" || mood === "creve") spot = "canape";
    else if (mood === "affame" || mood === "crise") spot = r < 0.6 ? "frigo" : null;
    else if (mood === "boude") spot = "fenetre";
    else if (r < 0.22) spot = "pc";
    else if (r < 0.36) spot = "frigo";
    else if (r < 0.5) spot = "canape";
    else if (r < 0.6) spot = "fenetre";
    else if (r < 0.67) spot = "tele";
    else if (r < 0.72) spot = "lit";
    const goal = spot
      ? objectById(spot).stand
      : nearestStandable({ x: this.x + (Math.random() - 0.5) * 90, y: 50 + Math.random() * 12 });
    this.seq = { act: "use", spot, phase: "go", t: 0, dur: spot ? 3 + Math.random() * 4 : 0.1, auto: true, route: this.route(goal) };
  }

  private update(dt: number, f: Frame) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.moving = false;
    const lazy = f.mood === "gras" || f.mood === "creve";
    const ix = this.input.x;
    const iy = this.input.y;
    const mag = Math.hypot(ix, iy);

    if (mag > 0.15) {
      // Contrôle manuel : il obéit (en traînant un peu des pieds s'il est Fritoman).
      if (this.seq) this.cancel();
      this.manualUntil = this.t + 14;
      const sp = WALK * Math.min(1, mag) * (lazy ? 0.7 : 1);
      const dx = (ix / mag) * sp * dt * Math.min(1, mag);
      const dy = (iy / mag) * sp * dt * Math.min(1, mag) * 0.75;
      const r = move({ x: this.x, y: this.y }, dx, dy);
      const moved = Math.hypot(r.pos.x - this.x, r.pos.y - this.y);
      if (r.blocked && moved < 0.05 && !this.wasBlocked) this.bumps += 1;
      this.wasBlocked = r.blocked && moved < 0.05;
      this.walked += moved;
      this.x = r.pos.x;
      this.y = r.pos.y;
      if (Math.abs(ix) > 0.2) this.dir = ix > 0 ? 1 : -1;
      if (moved > 0) {
        this.moving = true;
        this.walkPhase += dt * 9;
      }
    } else {
      this.wasBlocked = false;
      const s = this.seq;
      if (!s) {
        if (this.t > this.idleUntil && !this.manual) this.brain(f.mood);
      } else if (s.phase === "go") {
        const next = s.route[0];
        if (!next) {
          if (s.spot || !s.auto) this.startAct();
          else this.endSeq();
        } else {
          const dx = next.x - this.x;
          const dy = next.y - this.y;
          const dist = Math.hypot(dx, dy);
          const total = s.route.reduce((a, p, i) => a + Math.hypot(p.x - (i ? s.route[i - 1].x : this.x), p.y - (i ? s.route[i - 1].y : this.y)), 0);
          const speed = (s.auto ? 22 : total > 120 ? 110 : 55) * (lazy ? 0.6 : 1);
          if (dist < 1) {
            this.x = next.x;
            this.y = next.y;
            s.route.shift();
          } else {
            const k = Math.min(dist, speed * dt) / dist;
            this.x += dx * k;
            this.y += dy * k;
            if (Math.abs(dx) > 0.3) this.dir = dx > 0 ? 1 : -1;
            this.moving = true;
            this.walkPhase += dt * (speed > 50 ? 12 : 7);
          }
        }
      } else {
        s.t += dt;
        if (s.t >= s.dur) this.endSeq();
      }
    }
    const camTarget = Math.max(0, Math.min(WORLD_W - VIEW_W, this.x - VIEW_W / 2));
    this.cam = f.reduced ? camTarget : this.cam + (camTarget - this.cam) * Math.min(1, dt * 4);
  }

  private endSeq() {
    const auto = this.seq?.auto;
    this.seq = null;
    this.idleUntil = this.t + (auto ? 2 + Math.random() * 4 : 1.5);
  }

  draw(ctx: CanvasRenderingContext2D, f: Frame, dt: number) {
    this.update(Math.min(dt, 0.1), f);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(-Math.round(this.cam), 0);
    this.drawRooms(ctx, f);
    // Profondeur : le canapé et la table sont au milieu de la pièce.
    const front = this.y < 57;
    if (!front) this.drawFloorItems(ctx);
    this.drawSparrow(ctx, f);
    if (front) this.drawFloorItems(ctx);
    if (this.seq?.act === "douche" && this.seq.phase === "act") {
      ctx.fillStyle = "#9fb4c8";
      for (let i = 0; i < 6; i++) ctx.fillRect(R(0, 90) + i * 2, Math.round(((this.t * 34 + i * 7) % 18) + 33), 1, 2);
    }
    if (f.cache && Math.floor(this.t * 3) % 3 !== 0) ctx.drawImage(prop("eclat"), f.cache.x - 2, f.cache.y - 2);
    // Repère discret de l'objet à portée
    const n = this.near();
    if (n && !this.seq && Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = "#f2c14e";
      const cx = Math.round((n.tap.x1 + n.tap.x2) / 2);
      ctx.fillRect(cx - 1, n.tap.y1 - 4, 3, 1);
      ctx.fillRect(cx, n.tap.y1 - 3, 1, 1);
    }
    ctx.restore();
    if (this.flash > 0 && !f.reduced) {
      ctx.fillStyle = `rgba(242,193,78,${Math.min(0.55, this.flash / 4)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 6; i++) {
        const a = this.t * 2 + i;
        ctx.drawImage(prop("etoile"), Math.round(VIEW_W / 2 + Math.cos(a) * 40 - 3), Math.round(26 + Math.sin(a * 1.3) * 18));
      }
    }
  }

  private drawFloorItems(ctx: CanvasRenderingContext2D) {
    ctx.drawImage(prop("canape"), R(2, 28), 54);
    ctx.drawImage(fur("plan"), R(3, 80), 54);
  }

  private drawRooms(ctx: CanvasRenderingContext2D, f: Frame) {
    const t = this.t;
    const walls = ["#26212b", "#1b1b29", "#2b2224", "#20262b"];
    for (let i = 0; i < ROOMS.length; i++) {
      const x0 = i * ROOM_W;
      if (x0 + ROOM_W < this.cam - 2 || x0 > this.cam + VIEW_W + 2) continue;
      ctx.fillStyle = walls[i];
      ctx.fillRect(x0, 0, ROOM_W, WALL);
      // Sol en lattes
      ctx.fillStyle = "#3a2c22";
      ctx.fillRect(x0, WALL, ROOM_W, VIEW_H - WALL);
      ctx.fillStyle = "#2e231b";
      for (let y = WALL + 4; y < VIEW_H; y += 5) ctx.fillRect(x0, y, ROOM_W, 1);
      // Plinthe rouge (direction artistique)
      ctx.fillStyle = "#9e1f1c";
      ctx.fillRect(x0, WALL - 2, ROOM_W, 2);
      // Papier peint discret + plafonnier
      ctx.fillStyle = "rgba(255,255,255,0.025)";
      for (let x = x0 + 4; x < x0 + ROOM_W; x += 8) ctx.fillRect(x, 0, 3, WALL - 2);
      ctx.fillStyle = "#090909";
      ctx.fillRect(x0 + ROOM_W / 2, 0, 1, 4);
      ctx.fillStyle = "#3b3b3b";
      ctx.fillRect(x0 + ROOM_W / 2 - 3, 4, 7, 2);
      ctx.fillStyle = "rgba(242,193,78,0.07)";
      ctx.beginPath();
      ctx.moveTo(x0 + ROOM_W / 2 - 3, 6);
      ctx.lineTo(x0 + ROOM_W / 2 + 4, 6);
      ctx.lineTo(x0 + ROOM_W / 2 + 26, WALL);
      ctx.lineTo(x0 + ROOM_W / 2 - 25, WALL);
      ctx.fill();
      // Cloison
      ctx.fillStyle = "#090909";
      ctx.fillRect(x0, 0, 2, WALL);
    }
    const px = (c: string, x: number, y: number, w: number, h: number) => {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    };
    // Calendrier 2031 dans la chambre (le compte à rebours veille)
    px("#f1efe8", R(0, 74), 14, 9, 11);
    px("#e53935", R(0, 74), 14, 9, 3);
    px("#090909", R(0, 76), 19, 5, 1);
    px("#090909", R(0, 76), 21, 3, 1);
    // Table de nuit + lampe
    px("#a8692e", R(0, 32), BASE - 7, 7, 7);
    px("#f2c14e", R(0, 33), BASE - 12, 5, 3);
    px("#3b3b3b", R(0, 35), BASE - 9, 1, 2);
    // Coin gaming : étagère à figurines + bande LED
    px("#3b3b3b", R(1, 12), 28, 22, 2);
    px("#e53935", R(1, 14), 24, 3, 4);
    px("#f2c14e", R(1, 20), 23, 3, 5);
    px("#6fae4b", R(1, 27), 25, 3, 3);
    px(Math.floor(t * 2) % 2 ? "#9e1f1c" : "#e53935", R(1, 2), WALL - 4, ROOM_W - 2, 1);
    // Salon : cadre « bat-frite » + lampadaire
    px("#090909", R(2, 44), 12, 18, 12);
    px("#1b1b29", R(2, 45), 13, 16, 10);
    px("#f2c14e", R(2, 50), 16, 6, 4);
    px("#3b3b3b", R(2, 16), BASE - 26, 1, 26);
    px("#f2c14e", R(2, 13), BASE - 30, 7, 4);
    // Cuisine : faïence, étagère à bocaux, hotte
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let y = 24; y < WALL - 2; y += 4) ctx.fillRect(R(3, 24), y, 86, 1);
    for (let x = R(3, 24); x < R(3, 110); x += 6) ctx.fillRect(x, 24, 1, WALL - 26);
    px("#3b3b3b", R(3, 78), 16, 26, 2);
    px("#e53935", R(3, 80), 11, 4, 5);
    px("#f2c14e", R(3, 87), 12, 4, 4);
    px("#6fae4b", R(3, 94), 11, 4, 5);
    px("#777777", R(3, 46), 22, 14, 4);
    px("#5a5a6e", R(3, 50), 14, 6, 8);
    const deco = new Set(f.deco);
    // ── Chambre
    ctx.drawImage(fur("lit"), R(0, 6), BASE - 6);
    ctx.drawImage(fur("fenetre"), R(0, 52), 12);
    ctx.drawImage(fur("douche"), R(0, 88), BASE - 20);
    // ── Coin gaming
    if (deco.has("dec-neons")) {
      ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.2;
      ctx.drawImage(fur("neons"), R(1, 40), 4);
      ctx.globalAlpha = 1;
    }
    if (deco.has("dec-poster")) ctx.drawImage(fur("poster"), R(1, 14), 12);
    ctx.drawImage(fur("bureau"), R(1, 46), BASE - 14);
    if (f.pcBroken) {
      ctx.drawImage(fur("ecranNoir"), R(1, 52) + 1, BASE - 13);
      ctx.drawImage(prop("vapeur"), R(1, 56), BASE - 22 - (Math.floor(t * 4) % 2));
    } else if (Math.floor(t * 2) % 2) {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(R(1, 60), BASE - 11, 2, 1);
    }
    if (deco.has("dec-dofrite")) {
      ctx.drawImage(fur("oeuf"), R(1, 86), BASE - 16 - (Math.floor(t * 2) % 2));
      if (Math.floor(t * 3) % 4 === 0) ctx.drawImage(prop("eclat"), R(1, 92), BASE - 20);
    }
    // ── Salon
    if (deco.has("dec-tapis")) ctx.drawImage(fur("tapis"), R(2, 26), 60);
    ctx.drawImage(fur("tele"), R(2, 78), BASE - 11);
    if (Math.floor(t * 5) % 3 === 0) {
      ctx.fillStyle = "#9fb4c8";
      ctx.fillRect(R(2, 81), BASE - 8, 8, 1);
    }
    if (deco.has("dec-plante")) ctx.drawImage(fur("plante"), R(2, 98), BASE - 8);
    // ── Cuisine
    ctx.drawImage(fur("frigo"), R(3, 8), BASE - 20);
    if (this.seq?.spot === "frigo" && this.seq.phase === "act") {
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(R(3, 9), BASE - 19, 10, 4);
    }
    ctx.drawImage(fur("plan"), R(3, 44), BASE - 6);
    ctx.drawImage(fur(deco.has("dec-friteuse") ? "friteuseOr" : "friteuse"), R(3, 48), BASE - 12);
    if (Math.floor(t * 2) % 2) ctx.drawImage(prop("vapeur"), R(3, 50), BASE - 19);
  }

  private drawSparrow(ctx: CanvasRenderingContext2D, f: Frame) {
    const s = this.seq;
    const t = this.t;
    const fast = Math.floor(t * 8) % 2;
    const frame = Math.floor(t * 3) % 2;
    const acting = s?.phase === "act" ? s : null;
    const walking = this.moving;
    const act = acting?.act;
    const atSpot = acting?.spot ? objectById(acting.spot) : null;

    let eyes: Eyes = "lunettes";
    let mouth: Mouth = "neutre";
    let body: Body = "normal";
    let legs: Legs = walking ? (Math.floor(this.walkPhase) % 2 ? "walkA" : "walkB") : "stand";
    let shake = 0;
    let bob = walking || f.reduced ? 0 : frame;
    let flip = this.dir < 0;
    let arms = false;
    const fx: [string, number, number][] = [];

    switch (f.mood) {
      case "content":
        mouth = "sourire";
        break;
      case "affame":
        mouth = frame ? "ouverte" : "triste";
        break;
      case "creve":
        eyes = Math.floor(t * 1.5) % 3 === 0 ? "fermes" : "lunettes";
        bob = 0;
        break;
      case "deprime":
        eyes = "triste";
        mouth = "triste";
        bob = 0;
        break;
      case "gras":
        body = "gras";
        mouth = "mache";
        break;
      case "focus":
        eyes = "focus";
        break;
      case "rage":
        eyes = "rage";
        mouth = "ouverte";
        shake = 1;
        break;
      case "dofus":
        mouth = "sourire";
        break;
      case "boude":
        mouth = "triste";
        if (!walking && !act) flip = !flip;
        break;
      case "crise":
        eyes = "triste";
        mouth = "ouverte";
        shake = 1;
        break;
    }
    if (!act && !walking && eyes === "lunettes" && t % 4 < 0.12) eyes = "fermes";

    // Posture « assise » au meuble (PC, canapé, lit) — aussi en vie autonome
    if (atSpot?.pose === "assis") legs = "assis";
    const atPc = acting?.spot === "pc";
    if (atPc && !f.pcBroken) body = "manette";

    if (act) {
      const at = acting!.t;
      switch (act) {
        case "frites":
        case "rabe":
        case "gras":
          mouth = fast ? "ouverte" : "mache";
          if (act === "gras") {
            body = "gras";
            eyes = "grands";
          }
          if (act === "rabe" && at > 1.2) {
            eyes = "grands";
            mouth = "ouverte";
            fx.push(["bulle", 13, -7], ["frites", 22, -12]);
          } else if (at < 1.8) fx.push(["frites", 12, 9]);
          break;
        case "salade":
        case "grimace":
          mouth = fast ? "mache" : "triste";
          eyes = at > 1 ? "fermes" : "lunettes";
          shake = at > 1 && at < 1.6 ? 1 : 0;
          if (at < 1.4) fx.push(["salade", 13, 11]);
          break;
        case "miracle":
          eyes = at > 0.8 ? "grands" : "lunettes";
          mouth = at > 0.8 ? "sourire" : "mache";
          if (at < 0.9) fx.push(["salade", 13, 11]);
          else fx.push(["coeur", 15, -4 - Math.floor(at * 3) % 3]);
          break;
        case "refus":
          eyes = "grands";
          mouth = "triste";
          shake = 1;
          if (acting!.of === "salade") fx.push(["salade", 14 + Math.round(at * 30), 10 - Math.round(at * 12)]);
          break;
        case "boude":
          mouth = "triste";
          flip = !flip;
          fx.push(["bulle", 13, -6]);
          break;
        case "dofus":
          eyes = fast ? "focus" : "lunettes";
          mouth = "sourire";
          break;
        case "rage":
          eyes = "rage";
          mouth = "ouverte";
          shake = 2;
          fx.push(["vapeur", -4, -4 - fast], ["vapeur", 14, -5 + fast]);
          break;
        case "drop":
        case "victoire":
          eyes = act === "drop" ? "grands" : "focus";
          mouth = "sourire";
          arms = at > 0.6;
          if (arms) legs = "stand";
          bob = fast;
          for (let i = 0; i < 4; i++) {
            const a = t * 3 + (i * Math.PI) / 2;
            fx.push(["etoile", Math.round(5 + Math.cos(a) * 14), Math.round(6 + Math.sin(a) * 9)]);
          }
          break;
        case "sieste":
          eyes = "fermes";
          bob = 0;
          break;
        case "douche":
          eyes = "fermes";
          mouth = fast ? "ouverte" : "sourire";
          break;
        case "parler":
        case "event":
        case "use":
          if (act !== "use") mouth = fast ? "ouverte" : "neutre";
          break;
        case "rire":
          eyes = "fermes";
          mouth = "ouverte";
          bob = fast;
          break;
        case "danse":
          mouth = "sourire";
          flip = Math.floor(t * 4) % 2 === 0;
          legs = fast ? "walkA" : "walkB";
          arms = Math.floor(t * 2) % 2 === 0;
          bob = fast;
          break;
        case "panne":
          eyes = "grands";
          mouth = "ouverte";
          shake = 1;
          break;
        case "legendaire":
          eyes = "grands";
          mouth = "ouverte";
          arms = true;
          bob = fast;
          break;
        case "crise":
          eyes = "triste";
          mouth = "ouverte";
          shake = 2;
          break;
      }
    }
    if (f.reduced) shake = 0;

    const sx = Math.round(this.x - 8 + (shake ? (fast ? shake : -shake) : 0));
    const seated = legs === "assis";
    const sy = Math.round(this.y) - 20 - bob + (seated ? 2 : 0);

    if (f.look.tenue === "ten-cape") ctx.drawImage(img("cape", () => CAPE, flip), sx, sy + 15);
    const key = `h:${eyes}:${mouth}:${body}:${legs}:${f.look.lunettes}:${f.look.tenue}:${f.look.barbe ? 1 : 0}`;
    ctx.drawImage(img(key, () => sparrow(eyes, mouth, body, legs, f.look), flip), sx, sy);
    const hat = f.look.tete ? HATS[f.look.tete] : undefined;
    if (hat) ctx.drawImage(img(`hat:${f.look.tete}`, () => hat.rows, flip), sx, sy + hat.dy);
    if (arms) {
      ctx.fillStyle = "#e9b18a";
      ctx.fillRect(sx + 1, sy + 11, 2, 4);
      ctx.fillRect(sx + 13, sy + 11, 2, 4);
    }
    // Chaise de bureau devant ses jambes
    if (atPc && seated) ctx.drawImage(img("chaise", () => FURNITURE.chaise, true), sx + 8, Math.round(this.y) - 7);

    for (const [k, px, py] of fx) ctx.drawImage(prop(k), sx + px, sy + py);

    // Effets d'état
    if ((act === "sieste" || f.mood === "creve") && !walking) {
      const k = (t * 1.2) % 1;
      z(ctx, sx + 16, Math.round(sy + 1 - k * 6), 4);
      z(ctx, sx + 21, Math.round(sy - 6 - k * 6), 5);
    }
    if (!act && (f.mood === "deprime" || f.mood === "crise")) ctx.drawImage(prop("goutte"), sx + 3, Math.round(sy + 8 + ((t * 8) % 6)));
    if (!act && f.mood === "rage") ctx.drawImage(prop("vapeur"), sx - 4, sy - 4 - fast);
    if (!act && f.mood === "content" && Math.floor(t / 3) % 3 === 0) ctx.drawImage(prop("coeur"), sx + 16, Math.round(sy - 2 - ((t * 4) % 4)));
    if (!act && f.mood === "affame" && !walking) {
      ctx.drawImage(prop("bulle"), sx + 14, sy - 6);
      ctx.drawImage(prop("frites"), sx + 23, sy - 12);
    }
    if (act === "panne") ctx.drawImage(prop("exclam"), sx + 6, sy - 9);
    if (body === "gras") {
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(sx + 1, Math.round(sy + 14 + ((t * 6) % 5)), 1, 2);
      ctx.fillRect(sx + 15, Math.round(sy + 15 + ((t * 5) % 5)), 1, 2);
    }
  }
}
