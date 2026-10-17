/**
 * RPG — moteur d'exploration du Quartier 404 (canvas, vue de dessus, cases de 16 px).
 *
 * Déplacement case par case dans 4 directions (comme les RPG portables), animation de marche,
 * collisions avec le décor et les PNJ, caméra qui suit Sparrow, calques (Sparrow passe derrière
 * les arbres), PNJ avec petits trajets, éclairage de nuit, particules et scène finale.
 * Aucune logique de quête ici : le moteur signale portes, zones et interactions à l'interface.
 */

import {
  DOORS,
  MAP_H,
  MAP_W,
  NPCS,
  PROPS,
  SPAWN,
  TILE,
  doorAt,
  isSolid,
  step,
  thingAt,
  zoneAt,
  type Door,
  type Facing,
  type NpcDef,
  type NpcId,
  type Thing,
  type Tile,
  type Zone,
} from "@/lib/rpg/quartier";
import { charSprite, type CharId, type Dir, type Frame } from "./actors";
import { lightSprite } from "./pixel";
import { LIGHTS, buildLayers, drawBarrier, drawClockFace, drawCore, drawFountainWater, drawGate, drawWater, propOf } from "./tiles";

export const OW_W = 240;
export const OW_H = 176;
const WALK = 0.2; // s par case
const RUN = 0.12;

export interface OwFrame {
  /** Drapeaux de quête utiles au rendu. */
  gateOpen: boolean;
  questDone: boolean;
  inconnuGone: boolean;
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
}

export type Interaction = { kind: "npc"; id: NpcId } | { kind: "thing"; thing: Thing } | { kind: "door"; door: Door } | null;

const toDir = (f: Facing): { d: Dir; flip: boolean } => (f === "left" ? { d: "side", flip: true } : f === "right" ? { d: "side", flip: false } : { d: f, flip: false });
const opposite: Record<Facing, Facing> = { up: "down", down: "up", left: "right", right: "left" };

export class Overworld {
  x: number;
  y: number;
  dir: Facing;
  input = { x: 0, y: 0 };
  run = false;
  /** Bloqué pendant un dialogue ou une scène. */
  frozen = false;
  /** Événements lus par l'interface. */
  onDoor: ((d: Door) => void) | null = null;
  onZone: ((z: Zone) => void) | null = null;
  bumps = 0;
  private from: Tile | null = null;
  private mt = 0;
  private leg = 0;
  private t = 0;
  private camX = 0;
  private camY = 0;
  private layers: { base: HTMLCanvasElement; top: HTMLCanvasElement } | null = null;
  private dark: HTMLCanvasElement | null = null;
  private npcs: Npc[];
  private zone: string | null = null;
  private shake = 0;
  private flash = 0;
  private flashColor = "255,255,255";
  private motes: { x: number; y: number; v: number; c: string; life: number }[] = [];
  private lastBlocked = false;
  /** Après un passage de porte, il faut relâcher la croix avant d'en reprendre une. */
  private doorArmed = true;

  constructor(start: Tile & { dir: Facing } = SPAWN) {
    this.x = start.x;
    this.y = start.y;
    this.dir = start.dir;
    this.npcs = NPCS.map((def) => ({ def, x: def.start.x, y: def.start.y, dir: def.dir, from: null, t: 0, leg: 0, wait: (def.pause ?? 1) * Math.random(), target: 1, talking: false }));
    this.centerCam();
    this.zone = zoneAt(this.tile)?.id ?? null;
  }

  get tile(): Tile {
    return { x: this.x, y: this.y };
  }

  get moving() {
    return !!this.from;
  }

  private centerCam() {
    const px = this.x * TILE + 8;
    const py = this.y * TILE + 8;
    this.camX = Math.max(0, Math.min(MAP_W * TILE - OW_W, px - OW_W / 2));
    this.camY = Math.max(0, Math.min(MAP_H * TILE - OW_H, py - OW_H / 2));
  }

  /** Place Sparrow (sortie de l'immeuble, chargement). */
  place(t: Tile & { dir: Facing }) {
    this.x = t.x;
    this.y = t.y;
    this.dir = t.dir;
    this.from = null;
    this.doorArmed = false;
    this.centerCam();
  }

  private npcAt(t: Tile, hideInconnu: boolean): Npc | null {
    return (
      this.npcs.find((n) => {
        if (hideInconnu && n.def.id === "inconnu") return false;
        return (n.x === t.x && n.y === t.y) || (n.from && n.from.x === t.x && n.from.y === t.y);
      }) ?? null
    );
  }

  private blocked(t: Tile, f: OwFrame): boolean {
    return isSolid(t, { gateOpen: f.gateOpen }) || !!this.npcAt(t, f.inconnuGone);
  }

  /** Ce qu'il y a devant Sparrow (bouton A). */
  facing(f: OwFrame): Interaction {
    const front = step(this.tile, this.dir);
    const npc = this.npcAt(front, f.inconnuGone);
    if (npc) return { kind: "npc", id: npc.def.id };
    const door = doorAt(front);
    if (door) return { kind: "door", door };
    // Le portail ouvert n'est plus un obstacle : on le traverse simplement.
    if (f.gateOpen && front.y === 15 && (front.x === 29 || front.x === 30)) return null;
    const th = thingAt(front);
    return th ? { kind: "thing", thing: th } : null;
  }

  /** Vue d'ensemble de la carte (documentation / tests). */
  overview(): string {
    this.layers ??= buildLayers();
    const c = document.createElement("canvas");
    c.width = MAP_W * TILE;
    c.height = MAP_H * TILE;
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
  talkTo(id: NpcId, on: boolean) {
    const n = this.npcs.find((x) => x.def.id === id);
    if (!n) return;
    n.talking = on;
    if (on) n.dir = opposite[this.dir];
  }

  /** Effets de la scène finale. */
  quake(reduced: boolean) {
    if (!reduced) this.shake = 1.4;
    this.flash = 1;
    this.flashColor = "166,108,255";
    const inc = this.npcs.find((n) => n.def.id === "inconnu");
    if (inc) {
      // Il apparaît à côté de Sparrow, d'un coup.
      for (const d of ["left", "right", "down", "up"] as Facing[]) {
        const t = step(this.tile, d);
        if (!isSolid(t, { gateOpen: true })) {
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

  flashWhite() {
    this.flash = 1;
    this.flashColor = "255,255,255";
  }

  private update(dt: number, f: OwFrame) {
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
        const door = doorAt(this.tile);
        if (door) this.onDoor?.(door);
        const z = zoneAt(this.tile);
        if ((z?.id ?? null) !== this.zone) {
          this.zone = z?.id ?? null;
          if (z) this.onZone?.(z);
        }
      }
    }
    if (!this.from && !this.frozen) {
      const { x: ix, y: iy } = this.input;
      if (Math.abs(ix) > 0.3 || Math.abs(iy) > 0.3) {
        const d: Facing = Math.abs(ix) > Math.abs(iy) ? (ix > 0 ? "right" : "left") : iy > 0 ? "down" : "up";
        this.dir = d;
        const target = step(this.tile, d);
        const door = doorAt(target);
        if (door) {
          if (d === "up" && this.doorArmed) this.onDoor?.(door);
          this.lastBlocked = true;
        } else if (!this.blocked(target, f)) {
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
    // PNJ
    for (const n of this.npcs) {
      if (n.from) {
        n.t += dt / 0.32;
        if (n.t >= 1) {
          n.from = null;
          n.t = 0;
          n.leg++;
        }
        continue;
      }
      if (n.def.id === "inconnu" && !n.talking) {
        // Il surveille Sparrow : il le regarde toujours.
        const dx = this.x - n.x;
        const dy = this.y - n.y;
        n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
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
      const occupied = (nt.x === this.x && nt.y === this.y) || (this.from && this.from.x === nt.x && this.from.y === nt.y) || isSolid(nt, { gateOpen: f.gateOpen });
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
    const tx = Math.max(0, Math.min(MAP_W * TILE - OW_W, p.x + 8 - OW_W / 2));
    const ty = Math.max(0, Math.min(MAP_H * TILE - OW_H, p.y + 8 - OW_H / 2));
    const k = f.reduced ? 1 : Math.min(1, dt * 10);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    // Particules temporelles (près de la station) et lucioles (parc)
    if (!f.reduced && this.motes.length < 40 && Math.random() < dt * 14) {
      const near = Math.random() < 0.5;
      this.motes.push({
        x: near ? 26 * TILE + Math.random() * 8 * TILE : Math.random() * 11 * TILE,
        y: near ? 16 * TILE + Math.random() * 10 * TILE : 14 * TILE + Math.random() * 13 * TILE,
        v: 4 + Math.random() * 6,
        c: near ? (f.questDone ? "#9fe8ff" : "#c9a0ff") : "#f6e27a",
        life: 2 + Math.random() * 3,
      });
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
    this.layers ??= buildLayers();
    ctx.imageSmoothingEnabled = false;
    const sx = this.shake > 0 ? Math.round(Math.sin(this.t * 60) * 2) : 0;
    const ox = Math.round(this.camX) - sx;
    const oy = Math.round(this.camY);
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, OW_W, OW_H);
    ctx.drawImage(this.layers.base, -ox, -oy);

    // Éléments animés au sol
    drawWater(ctx, this.t, ox, oy);
    for (const p of propOf("fontaine")) drawFountainWater(ctx, p, this.t, ox, oy, !f.questDone);
    for (const p of propOf("portail")) drawGate(ctx, p, f.gateOpen, ox, oy);
    for (const p of propOf("barriere")) drawBarrier(ctx, p, f.questDone && p.text !== "TRAVAUX", this.t, ox, oy);
    for (const p of propOf("transfo")) drawCore(ctx, p, this.t, ox, oy, f.questDone);

    // Personnages triés par profondeur
    const actors: { y: number; draw: () => void }[] = [];
    const me = this.pixelPos();
    const walking = !!this.from;
    const frame: Frame = walking ? ((this.leg % 2) + 1) as Frame : 0;
    const { d, flip } = toDir(this.dir);
    actors.push({
      y: me.y,
      draw: () => this.drawChar(ctx, "sparrow", d, frame, flip, me.x - ox, me.y - oy, walking, f.tenue),
    });
    for (const n of this.npcs) {
      if (n.def.id === "inconnu" && f.inconnuGone) continue;
      const k = n.from ? Math.min(1, n.t) : 1;
      const nx = n.from ? (n.from.x + (n.x - n.from.x) * k) * TILE : n.x * TILE;
      const ny = n.from ? (n.from.y + (n.y - n.from.y) * k) * TILE : n.y * TILE;
      const nf: Frame = n.from ? (((n.leg % 2) + 1) as Frame) : 0;
      const nd = toDir(n.dir);
      actors.push({ y: ny, draw: () => this.drawChar(ctx, n.def.id, nd.d, nf, nd.flip, nx - ox, ny - oy, !!n.from) });
    }
    actors.sort((a, b) => a.y - b.y);
    for (const a of actors) a.draw();

    // Calque haut (feuillages, lampadaires, horloge)
    ctx.drawImage(this.layers.top, -ox, -oy);
    for (const p of propOf("horloge")) drawClockFace(ctx, p, f.questDone ? "00:00" : "23:59", this.t, ox, oy, !f.questDone);

    // Nuit + lumières
    this.drawNight(ctx, f, ox, oy, me);

    // Particules (lucioles, éclats temporels) par-dessus la nuit : elles brillent
    for (const m of this.motes) {
      if (Math.floor((this.t + m.x) * 3) % 4 === 0) continue;
      ctx.fillStyle = m.c;
      ctx.fillRect(Math.round(m.x - ox), Math.round(m.y - oy), 1, 1);
    }
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(${this.flashColor},${Math.min(0.85, this.flash)})`;
      ctx.fillRect(0, 0, OW_W, OW_H);
    }
  }

  private drawChar(ctx: CanvasRenderingContext2D, id: CharId, d: Dir, frame: Frame, flip: boolean, x: number, y: number, walking: boolean, tenue?: string) {
    const bob = !walking && Math.floor(this.t * 1.6 + x * 0.1) % 2 === 0 ? 1 : 0;
    // Ombre
    ctx.fillStyle = "rgba(8,6,20,0.45)";
    ctx.fillRect(x + 3, y + 14, 10, 2);
    ctx.fillRect(x + 4, y + 13, 8, 1);
    const spr = charSprite(id, d, frame, flip, tenue);
    // Clignement des yeux (de face, au repos)
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
  }

  private drawNight(ctx: CanvasRenderingContext2D, f: OwFrame, ox: number, oy: number, me: { x: number; y: number }) {
    this.dark ??= Object.assign(document.createElement("canvas"), { width: OW_W, height: OW_H });
    const dk = this.dark.getContext("2d")!;
    dk.globalCompositeOperation = "source-over";
    dk.clearRect(0, 0, OW_W, OW_H);
    dk.fillStyle = "rgba(10,10,34,0.62)";
    dk.fillRect(0, 0, OW_W, OW_H);
    dk.globalCompositeOperation = "destination-out";
    const all = [...LIGHTS];
    // Lueur de la station et petite lumière autour de Sparrow
    for (const p of propOf("transfo")) all.push({ x: p.x * TILE + 46, y: p.y * TILE + 28, r: f.questDone ? 34 : 40 + Math.round(Math.sin(this.t * 5) * 6), color: "#a66cff", tint: true });
    all.push({ x: me.x + 8, y: me.y + 6, r: 26, color: "#ffffff" });
    for (const L of all) {
      const lx = L.x - ox;
      const ly = L.y - oy;
      if (lx < -L.r || ly < -L.r || lx > OW_W + L.r || ly > OW_H + L.r) continue;
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
      if (lx < -L.r || ly < -L.r || lx > OW_W + L.r || ly > OW_H + L.r) continue;
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

export const DOOR_LIST = DOORS;
export const PROP_LIST = PROPS;
