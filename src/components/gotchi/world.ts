/**
 * SPARROWGOTCHI — le monde façon console portable (rendu canvas 160 × 144).
 *
 * Une pièce = un écran ; on change d'écran en passant une porte. Le joueur dirige Sparrow
 * à la croix (8 directions, B pour courir) ou touche un objet / un endroit pour qu'il y
 * aille (chemin calculé, même à travers plusieurs pièces). Sans contrôle, il reprend sa vie
 * autonome. Chaque action reste une séquence : il marche jusqu'au meuble, puis l'anime.
 */

import { bake } from "../game/sprites";
import type { Anim, Mood, Scene } from "@/lib/gotchi/engine";
import {
  ROOMS,
  SCREEN_H,
  SCREEN_W,
  START,
  doorAt,
  doorCrossed,
  doorExit,
  move,
  nearbySpot,
  nearestStandable,
  pathInRoom,
  roomRoute,
  spotAt,
  spotById,
  type Door,
  type Facing,
  type Place,
  type Pos,
  type RoomId,
  type Spot,
  type SpotId,
} from "@/lib/gotchi/map";
import { drawRoom, floorItems, type DecorState } from "./decor";
import { CAPE, HATS, PROPS, sparrow, sparrowBack, type Body, type Eyes, type Legs, type Look, type Mouth } from "./sprites";

export const VIEW_W = SCREEN_W;
export const VIEW_H = SCREEN_H;
const WALK = 44; // px/s à la croix
const RUN = 1.7;

/** Ce que fait Sparrow (action du joueur, événement ou vie autonome). */
export type Activity = Anim | "use" | "danse" | "rire" | "panne" | "legendaire" | "muscu";

interface Seq {
  act: Activity;
  of?: string;
  spot: SpotId | null;
  goal: Place;
  pts: Pos[];
  phase: "go" | "act";
  t: number;
  dur: number;
  auto: boolean;
  /** Réplique : à l'arrivée, ou tout de suite si la séquence est interrompue. */
  onAct?: () => void;
  /** Seulement s'il arrive vraiment (ex. ouvrir un mini-jeu). */
  onArrive?: () => void;
}

export interface Frame {
  mood: Mood;
  look: Look;
  deco: string[];
  tiers: DecorState["tiers"];
  pcBroken: boolean;
  hour: number;
  cache: Place | null;
  reduced: boolean;
}

export type Hit =
  | { kind: "cache" }
  | { kind: "sparrow" }
  | { kind: "spot"; spot: Spot }
  | { kind: "door"; door: Door }
  | { kind: "floor"; pos: Pos };

const SCENE_SPOT: Partial<Record<Scene, SpotId>> = {
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
  canape: "use",
  lit: "sieste",
  pc: "dofus",
  frigo: "frites",
};

function spotFor(act: Activity, of?: string): SpotId | null {
  switch (act) {
    case "frites":
    case "gras":
    case "rabe":
      return "friteuse";
    case "salade":
    case "grimace":
    case "miracle":
      return "frigo";
    case "refus":
      return of === "salade" ? "frigo" : of === "dofus" ? "pc" : of === "sieste" ? "lit" : of === "douche" ? "douche" : null;
    case "dofus":
    case "rage":
    case "drop":
    case "victoire":
      return of === "muscu" ? "banc" : "pc";
    case "sieste":
      return "lit";
    case "douche":
      return of === "lavabo" ? "lavabo" : "douche";
    case "muscu":
      return "banc";
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
const prop = (k: string) => img(`p:${k}`, () => PROPS[k]);

function z(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.fillStyle = "#f1efe8";
  ctx.fillRect(x, y, s, 1);
  for (let i = 1; i < s - 1; i++) ctx.fillRect(x + s - 1 - i, y + i, 1, 1);
  ctx.fillRect(x, y + s - 1, s, 1);
}

/** Où il arrive quand il passe la porte `d` de la pièce actuelle. */
function doorEntry(d: Door): Pos {
  const opposite: Record<Door, Door> = { N: "S", S: "N", E: "W", W: "E" };
  return doorExit(opposite[d]).approach;
}

export class World {
  room: RoomId;
  x: number;
  y: number;
  facing: Facing = "down";
  /** Direction de la croix (-1..1) et bouton B (courir). */
  input = { x: 0, y: 0 };
  run = false;
  /** Compteurs lus par l'interface (répliques contextuelles, bandeau de pièce). */
  bumps = 0;
  walked = 0;
  roomChanges = 0;
  private seq: Seq | null = null;
  private idleUntil = 2;
  private manualUntil = 0;
  private moving = false;
  private wasBlocked = false;
  private t = 0;
  private flash = 0;
  private fade = 0;
  private walkPhase = 0;

  constructor(p: Place = START) {
    this.room = p.room;
    this.x = p.x;
    this.y = p.y;
  }

  get busy() {
    return !!this.seq && !this.seq.auto;
  }

  /** Le joueur l'a dirigé récemment : pas de vie autonome ni d'événement imposé. */
  get manual() {
    return this.t < this.manualUntil;
  }

  get place(): Place {
    return { room: this.room, x: Math.round(this.x), y: Math.round(this.y) };
  }

  /** Objet utilisable juste devant lui (bouton A). */
  near(): Spot | null {
    if (this.seq && !this.seq.auto) return null;
    return nearbySpot(this.room, { x: this.x, y: this.y });
  }

  nearCache(c: Place | null) {
    return !!c && c.room === this.room && Math.hypot(c.x - this.x, c.y - this.y) < 12;
  }

  /** Lance une séquence (action du joueur ou événement). */
  play(act: Activity, opts: { of?: string; scene?: Scene; onAct?: () => void; onArrive?: () => void; reduced?: boolean } = {}) {
    this.cancel();
    let a = act;
    let spot = spotFor(act, opts.of);
    if (opts.scene) {
      spot = SCENE_SPOT[opts.scene] ?? null;
      a = SCENE_ACT[opts.scene] ?? (act === "event" ? "parler" : act);
    }
    if (a === "legendaire") this.flash = 2.2;
    const target = spot ? spotById(spot) : null;
    const goal: Place = target ? { room: target.room, ...target.stand } : this.place;
    this.seq = {
      act: a,
      of: opts.of,
      spot,
      goal,
      pts: [],
      phase: target ? "go" : "act",
      t: 0,
      dur: a === "legendaire" ? 3.2 : 2.6,
      auto: false,
      onAct: opts.onAct,
      onArrive: opts.onArrive,
    };
    if (target && opts.reduced) this.teleport(goal);
    if (!target || opts.reduced) this.startAct();
  }

  /** Va jusqu'à un objet (puis onArrive) ou un endroit, même dans une autre pièce. */
  goTo(target: SpotId | Place, onArrive?: () => void, reduced = false) {
    this.cancel();
    const spot = typeof target === "string" ? spotById(target) : null;
    const p = target as Place;
    const goal: Place = spot ? { room: spot.room, ...spot.stand } : { room: p.room, ...nearestStandable(p.room, p) };
    this.seq = { act: "use", spot: spot?.id ?? null, goal, pts: [], phase: "go", t: 0, dur: spot ? 1.6 : 0.05, auto: false, onArrive };
    if (reduced) {
      this.teleport(goal);
      this.startAct();
    }
  }

  /** Passe une porte (toucher une porte à l'écran). */
  goDoor(d: Door, reduced = false) {
    const next = ROOMS[this.room].doors[d];
    if (next) this.goTo({ room: next, ...doorEntry(d) }, undefined, reduced);
  }

  /** Bouton B : on arrête ce qu'il fait (sans perdre sa réplique). */
  cancel() {
    const s = this.seq;
    this.seq = null;
    s?.onAct?.();
  }

  private teleport(p: Place) {
    if (p.room !== this.room) this.enterRoom(p.room);
    this.x = p.x;
    this.y = p.y;
  }

  private enterRoom(r: RoomId) {
    this.room = r;
    this.roomChanges += 1;
    this.fade = 0.25;
  }

  private startAct() {
    const s = this.seq!;
    s.phase = "act";
    s.t = 0;
    if (s.spot) this.facing = spotById(s.spot).face;
    const a = s.onAct;
    const b = s.onArrive;
    s.onAct = undefined;
    s.onArrive = undefined;
    a?.();
    b?.();
  }

  /** Qu'y a-t-il sous ce point de l'écran ? */
  hit(px: number, py: number, cachePlace: Place | null): Hit {
    if (cachePlace && cachePlace.room === this.room && Math.abs(px - cachePlace.x) < 8 && Math.abs(py - cachePlace.y) < 8) return { kind: "cache" };
    if (Math.abs(px - this.x) < 8 && py > this.y - 21 && py <= this.y + 2) return { kind: "sparrow" };
    const spot = spotAt(this.room, px, py);
    if (spot) return { kind: "spot", spot };
    const door = doorAt(this.room, px, py);
    if (door) return { kind: "door", door };
    return { kind: "floor", pos: { x: px, y: py } };
  }

  /** Vie autonome : il va voir ses meubles selon son état (parfois dans une autre pièce). */
  private brain(mood: Mood) {
    const r = Math.random();
    let spot: SpotId | null = null;
    if (mood === "dofus" || mood === "focus" || mood === "rage") spot = "pc";
    else if (mood === "gras" || mood === "creve") spot = r < 0.5 ? "canape" : "lit";
    else if (mood === "affame" || mood === "crise") spot = r < 0.6 ? "friteuse" : "frigo";
    else if (mood === "boude") spot = "fenetre";
    else {
      const all: SpotId[] = ["lit", "fenetre", "lavabo", "canape", "frigo", "friteuse", "pc", "banc", "miroir"];
      const here = all.filter((id) => spotById(id).room === this.room);
      const fav: SpotId[] = ["pc", "canape", "friteuse", "banc", "fenetre"];
      if (r < 0.15) spot = fav[Math.floor(Math.random() * fav.length)];
      else if (r < 0.55 && here.length) spot = here[Math.floor(Math.random() * here.length)];
    }
    const goal: Place = spot
      ? { room: spotById(spot).room, ...spotById(spot).stand }
      : { room: this.room, ...nearestStandable(this.room, { x: 24 + Math.random() * 112, y: 50 + Math.random() * 76 }) };
    this.seq = { act: "use", spot, goal, pts: [], phase: "go", t: 0, dur: spot ? 3 + Math.random() * 4 : 0.05, auto: true };
  }

  /** Calcule le prochain tronçon (jusqu'à la porte suivante, ou jusqu'au but). */
  private plan(s: Seq): boolean {
    const here = { x: this.x, y: this.y };
    if (s.goal.room !== this.room) {
      const hop = roomRoute(this.room, s.goal.room)[0];
      if (!hop) return false;
      const { approach, exit } = doorExit(hop.door);
      const p = pathInRoom(this.room, here, approach);
      if (!p) return false;
      s.pts = [...p, exit];
      return true;
    }
    const p = pathInRoom(this.room, here, s.goal);
    if (!p) return false;
    s.pts = p;
    return true;
  }

  private update(dt: number, f: Frame) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    this.fade = Math.max(0, this.fade - dt);
    this.moving = false;
    if (this.fade > 0.12) return; // petite pause pendant le changement d'écran
    const lazy = f.mood === "gras" || f.mood === "creve";
    const { x: ix, y: iy } = this.input;
    const mag = Math.hypot(ix, iy);

    if (mag > 0.15) {
      if (this.seq) this.cancel();
      this.manualUntil = this.t + 14;
      const sp = WALK * (this.run ? RUN : 1) * (lazy ? 0.7 : 1) * Math.min(1, mag);
      const r = move(this.room, { x: this.x, y: this.y }, (ix / mag) * sp * dt, (iy / mag) * sp * dt);
      const moved = Math.hypot(r.pos.x - this.x, r.pos.y - this.y);
      if (r.blocked && moved < 0.05 && !this.wasBlocked) this.bumps += 1;
      this.wasBlocked = r.blocked && moved < 0.05;
      this.walked += moved;
      this.x = r.pos.x;
      this.y = r.pos.y;
      this.facing = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? "right" : "left") : iy > 0 ? "down" : "up";
      if (moved > 0) {
        this.moving = true;
        this.walkPhase += dt * (this.run ? 13 : 9);
      }
      this.checkDoor();
      return;
    }
    this.wasBlocked = false;
    const s = this.seq;
    if (!s) {
      if (this.t > this.idleUntil && !this.manual) this.brain(f.mood);
      return;
    }
    if (s.phase === "act") {
      s.t += dt;
      if (s.t >= s.dur) this.endSeq();
      return;
    }
    if (!s.pts.length) {
      if (s.goal.room === this.room && Math.hypot(s.goal.x - this.x, s.goal.y - this.y) < 1) {
        if (s.spot || !s.auto) this.startAct();
        else this.endSeq();
        return;
      }
      if (!this.plan(s)) {
        this.endSeq();
        return;
      }
    }
    const next = s.pts[0];
    const dx = next.x - this.x;
    const dy = next.y - this.y;
    const dist = Math.hypot(dx, dy);
    const far = s.goal.room !== this.room;
    const speed = (s.auto ? 26 : far ? 80 : 56) * (lazy ? 0.65 : 1);
    if (dist < 1) {
      this.x = next.x;
      this.y = next.y;
      s.pts.shift();
    } else {
      const k = Math.min(dist, speed * dt) / dist;
      this.x += dx * k;
      this.y += dy * k;
      this.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      this.moving = true;
      this.walkPhase += dt * (speed > 50 ? 12 : 7);
    }
    if (this.checkDoor()) s.pts = [];
  }

  private checkDoor(): boolean {
    const to = doorCrossed(this.room, { x: this.x, y: this.y });
    if (!to) return false;
    this.enterRoom(to.room);
    this.x = to.x;
    this.y = to.y;
    return true;
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
    const using = this.seq?.phase === "act" && this.seq.spot ? this.seq.spot : null;
    const d: DecorState = { t: this.t, hour: f.hour, deco: new Set(f.deco), tiers: f.tiers, pcBroken: f.pcBroken, using };
    drawRoom(ctx, this.room, d);
    const sit = this.sitPos();
    const sy = sit ? sit.y : this.y;
    const items = floorItems(this.room, d).sort((a, b) => a.base - b.base);
    let drawn = false;
    for (const it of items) {
      if (!drawn && it.base > sy) {
        this.drawSparrow(ctx, f, sit);
        drawn = true;
      }
      it.draw(ctx);
    }
    if (!drawn) this.drawSparrow(ctx, f, sit);

    if (f.cache && f.cache.room === this.room && Math.floor(this.t * 3) % 3 !== 0) ctx.drawImage(prop("eclat"), f.cache.x - 2, f.cache.y - 4);
    // Repère de l'objet à portée
    const n = this.near();
    if (n && !this.seq && Math.floor(this.t * 2) % 2 === 0) {
      ctx.fillStyle = "#f2c14e";
      const cx = Math.round((n.tap.x1 + n.tap.x2) / 2);
      const ty = Math.max(2, n.tap.y1 - 5);
      ctx.fillRect(cx - 2, ty, 5, 1);
      ctx.fillRect(cx - 1, ty + 1, 3, 1);
      ctx.fillRect(cx, ty + 2, 1, 1);
    }
    if (this.flash > 0 && !f.reduced) {
      ctx.fillStyle = `rgba(242,193,78,${Math.min(0.55, this.flash / 4)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      for (let i = 0; i < 6; i++) {
        const a = this.t * 2 + i;
        ctx.drawImage(prop("etoile"), Math.round(VIEW_W / 2 + Math.cos(a) * 50 - 3), Math.round(70 + Math.sin(a * 1.3) * 40));
      }
    }
    if (this.fade > 0 && !f.reduced) {
      ctx.fillStyle = `rgba(0,0,0,${Math.min(1, this.fade * 4)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  /** S'il est installé sur un meuble (lit, canapé, chaise, banc). */
  private sitPos(): (Pos & { face: Facing }) | null {
    const s = this.seq;
    if (!s || s.phase !== "act" || !s.spot || s.act === "refus") return null;
    const sp = spotById(s.spot);
    if (!sp.sit) return null;
    return { ...sp.sit, face: sp.sitFace ?? sp.face };
  }

  private drawSparrow(ctx: CanvasRenderingContext2D, f: Frame, sit: (Pos & { face: Facing }) | null) {
    const s = this.seq;
    const t = this.t;
    const fast = Math.floor(t * 8) % 2;
    const frame = Math.floor(t * 3) % 2;
    const acting = s?.phase === "act" ? s : null;
    const act = acting?.act;
    const walking = this.moving;
    const facing = sit ? sit.face : this.facing;

    let eyes: Eyes = "lunettes";
    let mouth: Mouth = "neutre";
    let body: Body = "normal";
    let legs: Legs = walking ? (Math.floor(this.walkPhase) % 2 ? "walkA" : "walkB") : "stand";
    let shake = 0;
    let bob = walking || f.reduced ? 0 : frame;
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
        break;
      case "crise":
        eyes = "triste";
        mouth = "ouverte";
        shake = 1;
        break;
    }
    if (!act && !walking && eyes === "lunettes" && t % 4 < 0.12) eyes = "fermes";
    if (sit) legs = "assis";
    if (acting?.spot === "pc" && sit && !f.pcBroken) body = "manette";

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
          else fx.push(["coeur", 15, -4 - (Math.floor(at * 3) % 3)]);
          break;
        case "refus":
          eyes = "grands";
          mouth = "triste";
          shake = 1;
          if (acting!.of === "salade") fx.push(["salade", 14 + Math.round(at * 30), 10 - Math.round(at * 12)]);
          break;
        case "boude":
          mouth = "triste";
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
          mouth = fast ? "ouverte" : "neutre";
          break;
        case "rire":
          eyes = "fermes";
          mouth = "ouverte";
          bob = fast;
          break;
        case "danse":
          mouth = "sourire";
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
        case "muscu":
          arms = fast === 1;
          mouth = "ouverte";
          break;
      }
    }
    if (f.reduced) shake = 0;

    const fx0 = sit ? sit.x : this.x;
    const fy0 = sit ? sit.y : this.y;
    const sx = Math.round(fx0 - 8 + (shake ? (fast ? shake : -shake) : 0));
    const sy = Math.round(fy0) - 20 - bob + (legs === "assis" ? 2 : 0);
    const back = facing === "up";
    const flip = facing === "left";
    const look = f.look;

    // Ombre au sol
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(Math.round(fx0) - 6, Math.round(fy0) - 1, 12, 2);
    // Aura du TITAN
    if ((look.muscle ?? 0) >= 4 && !f.reduced) {
      ctx.fillStyle = `rgba(242,193,78,${0.18 + Math.sin(t * 4) * 0.08})`;
      ctx.fillRect(sx - 2, sy - 2, 20, 24);
    }
    if (look.tenue === "ten-cape" && !back) ctx.drawImage(img("cape", () => CAPE, flip), sx, sy + 15);
    const key = `h:${back ? "dos" : `${eyes}:${mouth}`}:${body}:${legs}:${look.lunettes}:${look.tenue}:${look.barbe ? 1 : 0}:${look.muscle ?? 0}`;
    ctx.drawImage(img(key, () => (back ? sparrowBack(body, legs, look) : sparrow(eyes, mouth, body, legs, look)), flip), sx, sy);
    if (look.tenue === "ten-cape" && back) ctx.drawImage(img("cape", () => CAPE), sx, sy + 13);
    const hat = look.tete ? HATS[look.tete] : undefined;
    if (hat) ctx.drawImage(img(`hat:${look.tete}`, () => hat.rows, flip), sx, sy + hat.dy);
    if (arms) {
      ctx.fillStyle = "#e9b18a";
      ctx.fillRect(sx + 1, sy + 10, 2, 5);
      ctx.fillRect(sx + 13, sy + 10, 2, 5);
    }
    if (back) return; // de dos : pas d'expressions
    for (const [k, ox, oy] of fx) ctx.drawImage(prop(k), sx + ox, sy + oy);

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
