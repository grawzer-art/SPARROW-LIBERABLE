/**
 * SPARROWGOTCHI 2.0 — l'appartement de Sparrow (rendu canvas pixel art).
 *
 * Quatre pièces côte à côte (Chambre, Coin gaming, Salon, Cuisine) ; la caméra suit
 * Sparrow. Il se déplace seul, va voir ses meubles selon ses besoins, et chaque action
 * du joueur devient une petite séquence : il marche jusqu'au bon meuble, puis l'anime.
 */

import { bake } from "../game/sprites";
import type { Anim, Mood, Scene } from "@/lib/gotchi/engine";
import { CAPE, FURNITURE, HATS, PROPS, sparrow, type Body, type Eyes, type Legs, type Look, type Mouth } from "./sprites";

export const VIEW_W = 112;
export const VIEW_H = 64;
export const ROOM_W = 112;
export const ROOMS = [
  { id: "chambre", label: "Chambre" },
  { id: "gaming", label: "Coin gaming" },
  { id: "salon", label: "Salon" },
  { id: "cuisine", label: "Cuisine" },
] as const;
export const WORLD_W = ROOM_W * ROOMS.length;
const FLOOR = 58; // y des pieds
const WALL = 42; // limite mur / sol

type SpotId = "lit" | "douche" | "fenetre" | "pc" | "canape" | "tele" | "frigo" | "friteuse" | "table";
interface Spot {
  x: number;
  face: 1 | -1;
  pose: "stand" | "assis";
}
const R = (i: number, x: number) => i * ROOM_W + x;
export const SPOTS: Record<SpotId, Spot> = {
  lit: { x: R(0, 20), face: 1, pose: "assis" },
  fenetre: { x: R(0, 58), face: 1, pose: "stand" },
  douche: { x: R(0, 94), face: -1, pose: "stand" },
  pc: { x: R(1, 42), face: 1, pose: "assis" },
  tele: { x: R(2, 80), face: 1, pose: "stand" },
  canape: { x: R(2, 38), face: 1, pose: "assis" },
  frigo: { x: R(3, 28), face: -1, pose: "stand" },
  friteuse: { x: R(3, 56), face: 1, pose: "stand" },
  table: { x: R(3, 88), face: -1, pose: "stand" },
};

/** Ce que fait Sparrow en ce moment (action du joueur, événement ou vie autonome). */
export type Activity = Anim | "use" | "danse" | "rire" | "panne" | "legendaire";

interface Seq {
  act: Activity;
  of?: string;
  spot: SpotId | null;
  phase: "go" | "act";
  t: number;
  dur: number;
  auto: boolean;
  onAct?: () => void;
}

export interface Frame {
  mood: Mood;
  look: Look;
  deco: string[];
  pcBroken: boolean;
  cache: { x: number; y: number } | null;
  reduced: boolean;
}

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
  canape: "sieste",
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
  x = SPOTS.canape.x;
  dir: 1 | -1 = 1;
  cam = SPOTS.canape.x - VIEW_W / 2;
  private seq: Seq | null = null;
  private idleUntil = 2;
  private t = 0;
  private flash = 0;
  private walkPhase = 0;

  get busy() {
    return !!this.seq && !this.seq.auto;
  }

  get room() {
    return Math.max(0, Math.min(ROOMS.length - 1, Math.floor(this.x / ROOM_W)));
  }

  /** Lance une séquence (action du joueur ou événement). onAct : quand il arrive au meuble. */
  play(act: Activity, opts: { of?: string; scene?: Scene; onAct?: () => void; reduced?: boolean } = {}) {
    this.seq?.onAct?.(); // la réplique précédente ne doit jamais être perdue
    this.target = null;
    let a = act;
    let spot = spotFor(act, opts.of);
    if (opts.scene) {
      spot = SCENE_SPOT[opts.scene] ?? null;
      a = SCENE_ACT[opts.scene] ?? (act === "event" ? "parler" : act);
    }
    if (a === "legendaire") this.flash = 2.2;
    this.seq = { act: a, of: opts.of, spot, phase: spot ? "go" : "act", t: 0, dur: a === "legendaire" ? 3.2 : 2.6, auto: false, onAct: opts.onAct };
    if (spot && opts.reduced) this.x = SPOTS[spot].x;
    if (!spot) this.startAct();
  }

  /** Le joueur touche une pièce : Sparrow y va. */
  goRoom(i: number) {
    if (this.busy) return;
    this.seq = { act: "use", spot: null, phase: "go", t: 0, dur: 0.6, auto: true };
    this.target = R(i, ROOM_W / 2);
  }

  private target: number | null = null;

  private startAct() {
    const s = this.seq!;
    s.phase = "act";
    s.t = 0;
    if (s.spot) this.dir = SPOTS[s.spot].face;
    s.onAct?.();
    s.onAct = undefined;
  }

  /** Qu'y a-t-il sous ce point (coordonnées canvas) ? */
  hit(px: number, py: number, f: Pick<Frame, "cache">): "sparrow" | "pc" | "cache" | "frigo" | "canape" | null {
    const wx = px + this.cam;
    if (f.cache && Math.abs(wx - f.cache.x) < 7 && Math.abs(py - f.cache.y) < 7) return "cache";
    if (Math.abs(wx - this.x) < 9 && py > FLOOR - 24 && py <= FLOOR + 2) return "sparrow";
    if (wx > R(1, 46) && wx < R(1, 70) && py > 20 && py < FLOOR) return "pc";
    if (wx > R(3, 8) && wx < R(3, 22) && py > 30) return "frigo";
    if (wx > R(2, 26) && wx < R(2, 50) && py > 44) return "canape";
    return null;
  }

  /** Vie autonome : il va voir ses meubles selon son état. */
  private brain(mood: Mood) {
    const r = Math.random();
    let spot: SpotId | null = null;
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
    if (spot) {
      this.seq = { act: "use", spot, phase: "go", t: 0, dur: 3 + Math.random() * 4, auto: true };
    } else {
      this.target = Math.max(8, Math.min(WORLD_W - 8, this.x + (Math.random() - 0.5) * 90));
      this.seq = { act: "use", spot: null, phase: "go", t: 0, dur: 1, auto: true };
    }
  }

  private update(dt: number, f: Frame) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt);
    const s = this.seq;
    const lazy = f.mood === "gras" || f.mood === "creve";
    if (!s) {
      if (this.t > this.idleUntil) this.brain(f.mood);
    } else if (s.phase === "go") {
      const tx = s.spot ? SPOTS[s.spot].x : (this.target ?? this.x);
      const dist = tx - this.x;
      const speed = (s.auto ? 22 : Math.abs(dist) > 120 ? 110 : 55) * (lazy ? 0.6 : 1);
      if (Math.abs(dist) < 1.2) {
        this.x = tx;
        this.target = null;
        if (s.spot || !s.auto) this.startAct();
        else this.endSeq();
      } else {
        this.dir = dist > 0 ? 1 : -1;
        this.x += Math.sign(dist) * Math.min(Math.abs(dist), speed * dt);
        this.walkPhase += dt * (speed > 50 ? 12 : 7);
      }
    } else {
      s.t += dt;
      if (s.t >= s.dur) this.endSeq();
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
    this.drawSparrow(ctx, f);
    if (f.cache && Math.floor(this.t * 3) % 3 !== 0) ctx.drawImage(prop("eclat"), f.cache.x - 2, f.cache.y - 2);
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
    px("#a8692e", R(0, 32), FLOOR - 7, 7, 7);
    px("#f2c14e", R(0, 33), FLOOR - 12, 5, 3);
    px("#3b3b3b", R(0, 35), FLOOR - 9, 1, 2);
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
    px("#3b3b3b", R(2, 16), FLOOR - 26, 1, 26);
    px("#f2c14e", R(2, 13), FLOOR - 30, 7, 4);
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
    ctx.drawImage(fur("lit"), R(0, 6), FLOOR - 6);
    ctx.drawImage(fur("fenetre"), R(0, 52), 12);
    ctx.drawImage(fur("douche"), R(0, 88), FLOOR - 20);
    if (this.seq?.act === "douche" && this.seq.phase === "act") {
      for (let i = 0; i < 6; i++) {
        const dy = ((t * 34 + i * 7) % 18) + 38;
        ctx.fillStyle = "#9fb4c8";
        ctx.fillRect(R(0, 89) + i * 2, Math.round(dy), 1, 2);
      }
    }
    // ── Coin gaming
    if (deco.has("dec-neons")) {
      ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.2;
      ctx.drawImage(fur("neons"), R(1, 40), 4);
      ctx.globalAlpha = 1;
    }
    if (deco.has("dec-poster")) ctx.drawImage(fur("poster"), R(1, 14), 12);
    ctx.drawImage(fur("bureau"), R(1, 46), FLOOR - 14);
    if (f.pcBroken) {
      ctx.drawImage(fur("ecranNoir"), R(1, 52) + 1, FLOOR - 13);
      ctx.drawImage(prop("vapeur"), R(1, 56), FLOOR - 22 - (Math.floor(t * 4) % 2));
    } else if (Math.floor(t * 2) % 2) {
      ctx.fillStyle = "#e53935";
      ctx.fillRect(R(1, 60), FLOOR - 11, 2, 1);
    }
    if (deco.has("dec-dofrite")) {
      ctx.drawImage(fur("oeuf"), R(1, 86), FLOOR - 16 - (Math.floor(t * 2) % 2));
      if (Math.floor(t * 3) % 4 === 0) ctx.drawImage(prop("eclat"), R(1, 92), FLOOR - 20);
    }
    // ── Salon
    if (deco.has("dec-tapis")) ctx.drawImage(fur("tapis"), R(2, 26), FLOOR + 1);
    ctx.drawImage(prop("canape"), R(2, 28), FLOOR - 5);
    ctx.drawImage(fur("tele"), R(2, 78), FLOOR - 11);
    if (Math.floor(t * 5) % 3 === 0) {
      ctx.fillStyle = "#9fb4c8";
      ctx.fillRect(R(2, 81), FLOOR - 8, 8, 1);
    }
    if (deco.has("dec-plante")) ctx.drawImage(fur("plante"), R(2, 98), FLOOR - 8);
    // ── Cuisine
    ctx.drawImage(fur("frigo"), R(3, 8), FLOOR - 20);
    if (this.seq?.spot === "frigo" && this.seq.phase === "act") {
      ctx.fillStyle = "#f2c14e";
      ctx.fillRect(R(3, 9), FLOOR - 19, 10, 4);
    }
    ctx.drawImage(fur("plan"), R(3, 44), FLOOR - 6);
    ctx.drawImage(fur(deco.has("dec-friteuse") ? "friteuseOr" : "friteuse"), R(3, 48), FLOOR - 12);
    if (Math.floor(t * 2) % 2) ctx.drawImage(prop("vapeur"), R(3, 50), FLOOR - 19);
    ctx.drawImage(fur("plan"), R(3, 80), FLOOR - 6);
  }

  private drawSparrow(ctx: CanvasRenderingContext2D, f: Frame) {
    const s = this.seq;
    const t = this.t;
    const fast = Math.floor(t * 8) % 2;
    const frame = Math.floor(t * 3) % 2;
    const acting = s?.phase === "act" ? s : null;
    const walking = s?.phase === "go";
    const act = acting?.act;
    const atSpot = acting?.spot ? SPOTS[acting.spot] : null;

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
    const sy = FLOOR - 20 - bob + (seated ? 2 : 0);

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
    if (atPc && seated) ctx.drawImage(img("chaise", () => FURNITURE.chaise, true), sx + 8, FLOOR - 7);

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
