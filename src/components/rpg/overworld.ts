/**
 * RPG — moteur d'exploration (canvas, vue de dessus, cases de 16 px), commun à toutes les cartes.
 *
 * Déplacement case par case dans 4 directions (comme les RPG portables), animation de marche,
 * collisions avec le décor et les PNJ, caméra qui suit Sparrow, calques (Sparrow passe derrière
 * les arbres), PNJ avec petits trajets, ennemis qui repèrent Sparrow, éclairage selon la région.
 * Aucune logique de quête ici : le moteur signale portes, zones, ennemis et interactions.
 */

import {
  TILE,
  animated,
  isOpen,
  shown,
  npcsOf,
  solidAt,
  step,
  thingAt,
  warpAt,
  zoneAt,
  type Facing,
  type MapDef,
  type NpcDef,
  type Thing,
  type Tile,
  type Warp,
  type Zone,
} from "@/lib/rpg/mapdef";
import type { Rpg } from "@/lib/rpg/state";
import { charSprite, type Dir, type Frame } from "./actors";
import { lightSprite, pixelText } from "./pixel";
import { LIVE_KINDS, drawLive, drawMuck } from "./tiles2";
import { buildLayers, drawBarrier, drawClockFace, drawCore, drawFountainWater, drawGate, drawWater, propOf, type Layers, type Light } from "./tiles";

export const OW_W = 240;
/** Hauteur par défaut ; l'interface l'agrandit pour remplir l'écran du téléphone. */
export const OW_H = 176;
const WALK = 0.2; // s par case
const RUN = 0.12;

export interface OwFrame {
  rpg: Rpg;
  tenue?: string;
  reduced: boolean;
}

interface Npc {
  def: NpcDef;
  x: number;
  y: number;
  dir: Facing;
  from: Tile | null;
  t: number;
  leg: number;
  wait: number;
  target: number;
  talking: boolean;
  /** « ! » au-dessus de la tête (ennemi qui repère Sparrow). */
  alert: number;
  /** Marche vers Sparrow, puis rappel. */
  approach: (() => void) | null;
}

export type Interaction = { kind: "npc"; id: string } | { kind: "thing"; thing: Thing } | { kind: "door"; door: Warp } | null;

const toDir = (f: Facing): { d: Dir; flip: boolean } => (f === "left" ? { d: "side", flip: true } : f === "right" ? { d: "side", flip: false } : { d: f, flip: false });
const opposite: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };
const facingTo = (from: Tile, to: Tile): Facing => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
};

/** Voile d'ambiance selon la région (la nuit est la plus sombre). */
const AMBIANCE: Record<MapDef["region"], { veil: string; me: number } | null> = {
  nuit: { veil: "rgba(10,10,34,0.62)", me: 26 },
  crepuscule: { veil: "rgba(46,22,58,0.34)", me: 30 },
  egout: { veil: "rgba(4,8,10,0.70)", me: 34 },
  palais: { veil: "rgba(24,12,40,0.22)", me: 30 },
  interieur: null,
  aube: { veil: "rgba(70,40,90,0.22)", me: 30 },
};

export class Overworld {
  readonly map: MapDef;
  x: number;
  y: number;
  dir: Facing;
  input = { x: 0, y: 0 };
  run = false;
  /** Bloqué pendant un dialogue, une scène ou un combat. */
  frozen = false;
  /** Événements lus par l'interface. */
  onDoor: ((d: Warp) => void) | null = null;
  onZone: ((z: Zone) => void) | null = null;
  /** Un ennemi a repéré Sparrow (il s'approche, puis l'interface lance le combat). */
  onSpot: ((id: string) => void) | null = null;
  bumps = 0;
  /** Taille de la vue (pixels de jeu). */
  vw = OW_W;
  vh = OW_H;
  private rpg: Rpg;
  private from: Tile | null = null;
  private mt = 0;
  private leg = 0;
  private t = 0;
  private camX = 0;
  private camY = 0;
  private layers: Layers | null = null;
  private dark: HTMLCanvasElement | null = null;
  private npcs: Npc[] = [];
  private zone: string | null = null;
  private shake = 0;
  private flash = 0;
  private flashColor = "255,255,255";
  private motes: { x: number; y: number; v: number; c: string; life: number }[] = [];
  private lastBlocked = false;
  /** Après un passage de porte, il faut relâcher la croix avant d'en reprendre une. */
  private doorArmed = true;
  /** Un ennemi a déjà repéré Sparrow : on attend le combat. */
  private spotted = false;
  /** Après une fuite ou une retraite : pas de nouveau repérage tant que Sparrow reste en vue. */
  private calm = false;

  /** Éléments redessinés à chaque image (coffres, vannes, courants, grilles). */
  private readonly live: MapDef["props"];

  constructor(map: MapDef, start: Tile & { dir: Facing }, rpg: Rpg) {
    this.map = map;
    this.live = map.props.filter((p) => (LIVE_KINDS.has(p.kind) || animated(p)) && p.kind !== "portail" && p.kind !== "barriere");
    this.rpg = rpg;
    this.x = start.x;
    this.y = start.y;
    this.dir = start.dir;
    this.syncNpcs();
    this.centerCam();
    this.zone = zoneAt(map, this.tile)?.id ?? null;
  }

  get tile(): Tile {
    return { x: this.x, y: this.y };
  }

  get moving() {
    return !!this.from;
  }

  private get W() {
    return this.map.w * TILE;
  }

  private get H() {
    return this.map.h * TILE;
  }

  /** Les PNJ présents suivent l'avancement (un compagnon recruté quitte la carte…). */
  private syncNpcs() {
    const want = npcsOf(this.map, this.rpg);
    this.npcs = this.npcs.filter((n) => want.includes(n.def));
    for (const def of want) {
      if (this.npcs.some((n) => n.def === def)) continue;
      this.npcs.push({ def, x: def.start.x, y: def.start.y, dir: def.dir, from: null, t: 0, leg: 0, wait: (def.pause ?? 1) * Math.random(), target: 1, talking: false, alert: 0, approach: null });
    }
  }

  private camFor(px: number, py: number) {
    // Petite carte (intérieur) : centrée dans la vue
    const cx = this.W <= this.vw ? (this.W - this.vw) / 2 : Math.max(0, Math.min(this.W - this.vw, px + 8 - this.vw / 2));
    const cy = this.H <= this.vh ? (this.H - this.vh) / 2 : Math.max(0, Math.min(this.H - this.vh, py + 8 - this.vh / 2));
    return { cx, cy };
  }

  private centerCam() {
    const { cx, cy } = this.camFor(this.x * TILE, this.y * TILE);
    this.camX = cx;
    this.camY = cy;
  }

  /** Adapte la vue à l'écran (la caméra reste centrée sur Sparrow). */
  setView(w: number, h: number) {
    if (w === this.vw && h === this.vh) return;
    this.vw = w;
    this.vh = h;
    this.centerCam();
  }

  /** Place Sparrow (arrivée sur la carte, chargement). */
  place(t: Tile & { dir: Facing }) {
    this.x = t.x;
    this.y = t.y;
    this.dir = t.dir;
    this.from = null;
    this.doorArmed = false;
    this.centerCam();
  }

  private npcAt(t: Tile): Npc | null {
    return this.npcs.find((n) => (n.x === t.x && n.y === t.y) || (n.from && n.from.x === t.x && n.from.y === t.y)) ?? null;
  }

  private blocked(t: Tile): boolean {
    return solidAt(this.map, t, this.rpg) || !!this.npcAt(t);
  }

  /** Ce qu'il y a devant Sparrow (bouton A). */
  facing(f: OwFrame): Interaction {
    this.rpg = f.rpg;
    const front = step(this.tile, this.dir);
    const npc = this.npcAt(front);
    if (npc) return { kind: "npc", id: npc.def.id };
    // Comme dans les boutiques des RPG portables : on parle au marchand par-dessus le comptoir.
    const counter = thingAt(this.map, front, this.rpg);
    if (counter?.prop.kind === "comptoir") {
      const keeper = this.npcAt(step(front, this.dir));
      if (keeper) return { kind: "npc", id: keeper.def.id };
    }
    const door = warpAt(this.map, front);
    if (door) return { kind: "door", door };
    const th = thingAt(this.map, front, this.rpg);
    // Un passage ouvert (portail, barrière levée) n'est plus un obstacle : on le traverse.
    if (th && isOpen(th.prop, this.rpg) && (th.key === "portail" || th.key === "barriere")) return null;
    return th ? { kind: "thing", thing: th } : null;
  }

  /** Vue d'ensemble de la carte (documentation / tests). */
  overview(): string {
    this.layers ??= buildLayers(this.map);
    const c = document.createElement("canvas");
    c.width = this.W;
    c.height = this.H;
    const x = c.getContext("2d")!;
    x.drawImage(this.layers.base, 0, 0);
    x.drawImage(this.layers.top, 0, 0);
    return c.toDataURL("image/png");
  }

  /** Positions des PNJ (tests automatisés). */
  npcTiles() {
    return this.npcs.map((n) => ({ id: n.def.id, x: n.x, y: n.y, moving: !!n.from }));
  }

  /** Un PNJ se tourne vers Sparrow pendant la discussion. */
  talkTo(id: string, on: boolean) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n) return;
    n.talking = on;
    if (on) n.dir = opposite[this.dir];
  }

  /** Après un combat (victoire, fuite, retraite) : on peut de nouveau être repéré. */
  resume(rpg: Rpg) {
    this.rpg = rpg;
    this.spotted = false;
    this.calm = true;
    this.syncNpcs();
    for (const n of this.npcs) {
      n.alert = 0;
      n.approach = null;
    }
  }

  /** Effets de la scène finale du chapitre 1. */
  quake(reduced: boolean) {
    if (!reduced) this.shake = 1.4;
    this.flash = 1;
    this.flashColor = "166,108,255";
    const inc = this.npcs.find((n) => n.def.id === "inconnu");
    if (inc) {
      // Il apparaît à côté de Sparrow, d'un coup.
      for (const d of ["left", "right", "down", "up"] as Facing[]) {
        const t = step(this.tile, d);
        if (!solidAt(this.map, t, this.rpg) && !this.npcAt(t)) {
          inc.x = t.x;
          inc.y = t.y;
          inc.from = null;
          inc.dir = opposite[d];
          this.dir = d;
          break;
        }
      }
    }
  }

  /** Secousse + éclair (coups de théâtre). */
  shock(color = "255,255,255", reduced = false) {
    if (!reduced) this.shake = 0.8;
    this.flash = 1;
    this.flashColor = color;
  }

  flashWhite() {
    this.flash = 1;
    this.flashColor = "255,255,255";
  }

  /** Un ennemi voit-il Sparrow (en ligne droite, sans obstacle, dans sa portée) ? */
  private sees(n: Npc): boolean {
    const e = n.def.enemy;
    if (!e || e.sight <= 0) return false;
    const dx = this.x - n.x;
    const dy = this.y - n.y;
    if (dx !== 0 && dy !== 0) return false;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist === 0 || dist > e.sight) return false;
    if (!n.def.watch && facingTo(n, this.tile) !== n.dir) return false;
    const d = facingTo(n, this.tile);
    let c: Tile = { x: n.x, y: n.y };
    for (let i = 1; i < dist; i++) {
      c = step(c, d);
      if (solidAt(this.map, c, this.rpg) || this.npcs.some((o) => o !== n && o.x === c.x && o.y === c.y)) return false;
    }
    return true;
  }

  private arrive() {
    const door = warpAt(this.map, this.tile);
    if (door) this.onDoor?.(door);
    const z = zoneAt(this.map, this.tile);
    if ((z?.id ?? null) !== this.zone) {
      this.zone = z?.id ?? null;
      if (z) this.onZone?.(z);
    }
  }

  private update(dt: number, f: OwFrame) {
    if (f.rpg !== this.rpg) {
      this.rpg = f.rpg;
      this.syncNpcs();
    }
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    this.flash = Math.max(0, this.flash - dt * 1.4);
    // Sparrow
    if (this.from) {
      this.mt += dt / (this.run ? RUN : WALK);
      if (this.mt >= 1) {
        this.from = null;
        this.mt = 0;
        this.leg++;
        this.arrive();
      }
    }
    if (!this.from && !this.frozen && !this.spotted) {
      const { x: ix, y: iy } = this.input;
      if (Math.abs(ix) > 0.3 || Math.abs(iy) > 0.3) {
        const d: Facing = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? "right" : "left") : iy > 0 ? "down" : "up";
        this.dir = d;
        const target = step(this.tile, d);
        const door = warpAt(this.map, target);
        if (door && !this.npcAt(target)) {
          if (d === (door.dir ?? "up") && this.doorArmed) {
            // Passage ouvert au sol (route, escalier) : on y marche ; porte : elle s'ouvre devant.
            if (door.to && door.to !== "appart" && (!door.needs || door.needs(this.rpg)) && !solidAt(this.map, target, this.rpg)) {
              this.from = this.tile;
              this.x = target.x;
              this.y = target.y;
              this.mt = 0;
            } else this.onDoor?.(door);
          }
          this.lastBlocked = true;
        } else if (!this.blocked(target)) {
          this.from = this.tile;
          this.x = target.x;
          this.y = target.y;
          this.mt = 0;
          this.lastBlocked = false;
        } else {
          if (!this.lastBlocked) this.bumps++;
          this.lastBlocked = true;
        }
      } else {
        this.lastBlocked = false;
        this.doorArmed = true;
      }
    }
    if (this.calm && !this.npcs.some((n) => this.sees(n))) this.calm = false;
    // PNJ
    for (const n of this.npcs) {
      n.alert = Math.max(0, n.alert - dt);
      if (n.from) {
        n.t += dt / 0.32;
        if (n.t >= 1) {
          n.from = null;
          n.t = 0;
          n.leg++;
        }
        continue;
      }
      if (n.approach) {
        if (n.alert > 0) continue;
        const adj = Math.abs(n.x - this.x) + Math.abs(n.y - this.y) <= 1;
        if (adj) {
          n.dir = facingTo(n, this.tile);
          this.dir = opposite[n.dir];
          const done = n.approach;
          n.approach = null;
          done();
          continue;
        }
        const d = facingTo(n, this.tile);
        const nt = step({ x: n.x, y: n.y }, d);
        n.dir = d;
        if (solidAt(this.map, nt, this.rpg)) {
          // Rien ne doit bloquer : le combat commence de loin.
          const done = n.approach;
          n.approach = null;
          done();
          continue;
        }
        n.from = { x: n.x, y: n.y };
        n.x = nt.x;
        n.y = nt.y;
        n.t = 0;
        continue;
      }
      // Ennemi : repère Sparrow, s'exclame, s'approche
      if (n.def.enemy && !this.spotted && !this.calm && !this.frozen && !this.from && this.sees(n)) {
        this.spotted = true;
        n.dir = facingTo(n, this.tile);
        n.alert = 0.7;
        this.onSpot?.(n.def.id);
        continue;
      }
      if (n.def.watch && !n.talking) {
        // Il surveille Sparrow : il le regarde toujours.
        n.dir = facingTo(n, this.tile);
        continue;
      }
      const path = n.def.path;
      if (!path || n.talking || this.frozen) continue;
      // Comme dans les RPG portables : un PNJ s'arrête quand Sparrow est juste à côté.
      if (Math.abs(n.x - this.x) + Math.abs(n.y - this.y) <= 1) continue;
      n.wait -= dt;
      if (n.wait > 0) continue;
      const goal = path[n.target];
      if (n.x === goal.x && n.y === goal.y) {
        n.target = (n.target + 1) % path.length;
        n.wait = n.def.pause ?? 1;
        continue;
      }
      const d: Facing = goal.x > n.x ? "right" : goal.x < n.x ? "left" : goal.y > n.y ? "down" : "up";
      n.dir = d;
      const nt = step({ x: n.x, y: n.y }, d);
      const occupied =
        (nt.x === this.x && nt.y === this.y) || (this.from && this.from.x === nt.x && this.from.y === nt.y) || solidAt(this.map, nt, this.rpg) || this.npcs.some((o) => o !== n && o.x === nt.x && o.y === nt.y);
      if (occupied) {
        n.wait = 0.6;
        continue;
      }
      n.from = { x: n.x, y: n.y };
      n.x = nt.x;
      n.y = nt.y;
      n.t = 0;
    }
    // Caméra
    const p = this.pixelPos();
    const { cx, cy } = this.camFor(p.x, p.y);
    const k = f.reduced ? 1 : Math.min(1, dt * 10);
    this.camX += (cx - this.camX) * k;
    this.camY += (cy - this.camY) * k;
    this.updateMotes(dt, f);
  }

  /** L'ennemi qui a repéré Sparrow s'avance jusqu'à lui (puis `done`). */
  approach(id: string, done: () => void) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n) return done();
    n.approach = done;
    if (n.alert <= 0) n.alert = 0.5;
  }

  /** Particules : éclats temporels et lucioles (Quartier 404), poussière dorée ailleurs. */
  private updateMotes(dt: number, f: OwFrame) {
    const calm = f.rpg.quests["ville-figee"] === "terminee";
    if (!f.reduced && this.map.region !== "interieur" && this.motes.length < 40 && Math.random() < dt * 14) {
      if (this.map.id === "quartier") {
        const near = Math.random() < 0.5;
        this.motes.push({
          x: near ? 26 * TILE + Math.random() * 8 * TILE : Math.random() * 11 * TILE,
          y: near ? 16 * TILE + Math.random() * 10 * TILE : 14 * TILE + Math.random() * 13 * TILE,
          v: 4 + Math.random() * 6,
          c: near ? (calm ? "#9fe8ff" : "#c9a0ff") : "#f6e27a",
          life: 2 + Math.random() * 3,
        });
      } else {
        this.motes.push({
          x: this.camX + Math.random() * this.vw,
          y: this.camY + Math.random() * this.vh,
          v: 2 + Math.random() * 4,
          c: this.map.region === "egout" ? "#9fdc7a" : "#ffd98a",
          life: 1.5 + Math.random() * 2.5,
        });
      }
    }
    for (const m of this.motes) {
      m.y -= m.v * dt;
      m.x += Math.sin(this.t * 2 + m.y) * dt * 3;
      m.life -= dt;
    }
    this.motes = this.motes.filter((m) => m.life > 0);
  }

  private pixelPos(): { x: number; y: number } {
    if (!this.from) return { x: this.x * TILE, y: this.y * TILE };
    const k = Math.min(1, this.mt);
    return { x: (this.from.x + (this.x - this.from.x) * k) * TILE, y: (this.from.y + (this.y - this.from.y) * k) * TILE };
  }

  draw(ctx: CanvasRenderingContext2D, f: OwFrame, dt: number) {
    this.update(Math.min(dt, 0.1), f);
    this.layers ??= buildLayers(this.map);
    const r = f.rpg;
    const calm = r.quests["ville-figee"] === "terminee";
    ctx.imageSmoothingEnabled = false;
    const sx = this.shake > 0 ? Math.round(Math.sin(this.t * 60) * 2) : 0;
    const ox = Math.round(this.camX) - sx;
    const oy = Math.round(this.camY);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.vw, this.vh);
    ctx.drawImage(this.layers.base, -ox, -oy);

    // Éléments animés au sol
    drawWater(ctx, this.map, this.t, ox, oy);
    for (const p of propOf(this.map, "fontaine")) drawFountainWater(ctx, p, this.t, ox, oy, this.map.id === "quartier" && !calm);
    for (const p of propOf(this.map, "portail")) drawGate(ctx, p, isOpen(p, r), ox, oy);
    for (const p of propOf(this.map, "barriere")) drawBarrier(ctx, p, isOpen(p, r), this.t, ox, oy);
    for (const p of propOf(this.map, "transfo")) drawCore(ctx, p, this.t, ox, oy, calm);
    if (this.map.region === "egout") drawMuck(ctx, this.map, this.t, ox, oy);
    for (const p of this.live) if (shown(p, r)) drawLive(ctx, p, isOpen(p, r) || !!p.on?.(r), this.t, ox, oy);

    // Personnages triés par profondeur
    const actors: { y: number; draw: () => void }[] = [];
    const me = this.pixelPos();
    const walking = !!this.from;
    const frame: Frame = walking ? (((this.leg % 2) + 1) as Frame) : 0;
    const { d, flip } = toDir(this.dir);
    actors.push({
      y: me.y,
      draw: () => this.drawChar(ctx, "sparrow", d, frame, flip, me.x - ox, me.y - oy, walking, f.tenue),
    });
    for (const n of this.npcs) {
      const k = n.from ? Math.min(1, n.t) : 1;
      const nx = n.from ? (n.from.x + (n.x - n.from.x) * k) * TILE : n.x * TILE;
      const ny = n.from ? (n.from.y + (n.y - n.from.y) * k) * TILE : n.y * TILE;
      const nf: Frame = n.from ? (((n.leg % 2) + 1) as Frame) : 0;
      const nd = toDir(n.dir);
      actors.push({
        y: ny,
        draw: () => {
          this.drawChar(ctx, n.def.char, nd.d, nf, nd.flip, nx - ox, ny - oy, !!n.from);
          if (n.alert > 0) this.drawAlert(ctx, nx - ox, ny - oy);
        },
      });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    // Calque haut (feuillages, lampadaires, horloge)
    ctx.drawImage(this.layers.top, -ox, -oy);
    for (const p of propOf(this.map, "horloge")) {
      const frozen = this.map.id === "quartier" && !calm;
      drawClockFace(ctx, p, p.text ?? (frozen ? "23:59" : "00:00"), this.t, ox, oy, frozen);
    }

    // Ambiance + lumières
    this.drawLight(ctx, f, ox, oy, me);

    // Particules par-dessus le voile : elles brillent
    for (const m of this.motes) {
      if (Math.floor((this.t + m.x) * 3) % 4 === 0) continue;
      ctx.fillStyle = m.c;
      ctx.fillRect(Math.round(m.x - ox), Math.round(m.y - oy), 1, 1);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.85, this.flash)})`;
      ctx.fillRect(0, 0, this.vw, this.vh);
    }
  }

  /** Bulle « ! » au-dessus d'un ennemi qui repère Sparrow. */
  private drawAlert(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const X = Math.round(x + 4);
    const Y = Math.round(y - 16);
    ctx.fillStyle = "#1b1626";
    ctx.fillRect(X - 1, Y - 1, 9, 11);
    ctx.fillStyle = "#f8f4e8";
    ctx.fillRect(X, Y, 7, 9);
    ctx.fillStyle = "#1b1626";
    ctx.fillRect(X + 2, Y + 10, 3, 1);
    pixelText(ctx, "!", X + 2, Y + 2, "#d23a3a");
  }

  private drawChar(ctx: CanvasRenderingContext2D, id: string, d: Dir, frame: Frame, flip: boolean, x: number, y: number, walking: boolean, tenue?: string) {
    const bob = !walking && Math.floor(this.t * 1.6 + x * 0.1) % 2 === 0 ? 1 : 0;
    // Ombre
    ctx.fillStyle = "rgba(8,6,20,0.45)";
    ctx.fillRect(x + 3, y + 14, 10, 2);
    ctx.fillRect(x + 4, y + 13, 8, 1);
    const spr = charSprite(id, d, frame, flip, tenue);
    ctx.drawImage(spr, Math.round(x), Math.round(y - 5 + bob));
    if (id === "bouchon" && d !== "up") {
      // Canne
      ctx.fillStyle = "#6b4a2e";
      const cx = flip || d === "down" ? x + 1 : x + 13;
      ctx.fillRect(Math.round(cx), Math.round(y + 5 + bob), 1, 10);
    }
    if (id === "nico" && Math.floor(this.t * 2) % 3 === 0) {
      // Goutte de stress
      ctx.fillStyle = "#9fd4ff";
      ctx.fillRect(Math.round(x + 14), Math.round(y - 4), 1, 2);
    }
    if (id === "inconnu") {
      // Yeux qui luisent
      ctx.fillStyle = `rgba(111,240,255,${0.5 + Math.sin(this.t * 3) * 0.3})`;
      if (d === "down") {
        ctx.fillRect(Math.round(x + 5), Math.round(y + 0 + bob), 1, 1);
        ctx.fillRect(Math.round(x + 10), Math.round(y + 0 + bob), 1, 1);
      }
    }
    if (id === "chevalier" && d !== "up") {
      // Fente lumineuse du heaume
      ctx.fillStyle = `rgba(255,90,90,${0.55 + Math.sin(this.t * 2.5) * 0.25})`;
      ctx.fillRect(Math.round(x + (d === "side" ? (flip ? 4 : 9) : 5)), Math.round(y + 1 + bob), d === "side" ? 3 : 6, 1);
    }
  }

  private drawLight(ctx: CanvasRenderingContext2D, f: OwFrame, ox: number, oy: number, me: { x: number; y: number }) {
    const amb = AMBIANCE[this.map.region];
    if (!amb) return;
    if (!this.dark || this.dark.width !== this.vw || this.dark.height !== this.vh) this.dark = Object.assign(document.createElement("canvas"), { width: this.vw, height: this.vh });
    const dk = this.dark.getContext("2d")!;
    dk.globalCompositeOperation = "source-over";
    dk.clearRect(0, 0, this.vw, this.vh);
    dk.fillStyle = amb.veil;
    dk.fillRect(0, 0, this.vw, this.vh);
    dk.globalCompositeOperation = "destination-out";
    const all: Light[] = [...(this.layers?.lights ?? [])];
    const calm = f.rpg.quests["ville-figee"] === "terminee";
    // Lueur de la station et petite lumière autour de Sparrow
    for (const p of propOf(this.map, "transfo")) all.push({ x: p.x * TILE + 46, y: p.y * TILE + 28, r: calm ? 34 : 40 + Math.round(Math.sin(this.t * 5) * 6), color: "#a66cff", tint: true });
    all.push({ x: me.x + 8, y: me.y + 6, r: amb.me, color: "#ffffff" });
    for (const L of all) {
      const lx = L.x - ox;
      const ly = L.y - oy;
      if (lx < -L.r || ly < -L.r || lx > this.vw + L.r || ly > this.vh + L.r) continue;
      if (L.flicker && Math.floor(this.t * 7 + L.x) % 9 === 0) continue;
      dk.drawImage(lightSprite(L.r), Math.round(lx - L.r), Math.round(ly - L.r));
    }
    ctx.drawImage(this.dark, 0, 0);
    // Teinte chaude / violette des lumières
    ctx.globalCompositeOperation = "lighter";
    for (const L of all) {
      if (!L.tint) continue;
      const lx = L.x - ox;
      const ly = L.y - oy;
      if (lx < -L.r || ly < -L.r || lx > this.vw + L.r || ly > this.vh + L.r) continue;
      ctx.globalAlpha = L.color === "#a66cff" ? 0.22 : 0.1;
      ctx.fillStyle = L.color;
      const r = Math.round(L.r * 0.55);
      for (let y = -r; y <= r; y++) {
        const half = Math.round(Math.sqrt(r * r - y * y));
        ctx.fillRect(Math.round(lx - half), Math.round(ly + y), half * 2, 1);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }
}
