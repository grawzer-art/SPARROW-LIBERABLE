import { Engine, HERO_H, type Entity } from "./engine";
import {
  CALENDAR,
  CLOCK,
  FRITES,
  HOURGLASS,
  MASK_ITEM,
  MONDAY_A,
  MONDAY_B,
  bake,
  chaserOf,
  heroFrames,
  type Skin,
} from "./sprites";

type Baked = HTMLCanvasElement;
type Frames = Record<"runA" | "runB" | "jump" | "hurt", Baked>;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

interface Float {
  x: number;
  y: number;
  text: string;
  life: number;
  color: string;
}

// Mini police bitmap 3×5 (chiffres, quelques lettres).
const GLYPHS: Record<string, string[]> = {
  "0": ["111", "101", "101", "101", "111"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["111", "001", "111", "100", "111"],
  "3": ["111", "001", "011", "001", "111"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "111", "001", "111"],
  "6": ["111", "100", "111", "101", "111"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["111", "101", "111", "101", "111"],
  "9": ["111", "101", "111", "001", "111"],
  "+": ["000", "010", "111", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
  A: ["010", "101", "111", "101", "101"],
  E: ["111", "100", "110", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  I: ["111", "010", "010", "010", "111"],
  J: ["001", "001", "001", "101", "111"],
  L: ["100", "100", "100", "100", "111"],
  N: ["101", "111", "111", "101", "101"],
  O: ["111", "101", "101", "101", "111"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "111"],
  V: ["101", "101", "101", "101", "010"],
  X: ["101", "101", "010", "101", "101"],
  " ": ["000", "000", "000", "000", "000"],
};

function pixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, step = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of text) {
    const g = GLYPHS[ch] ?? GLYPHS[" "];
    g.forEach((row, yy) =>
      [...row].forEach((v, xx) => v === "1" && ctx.fillRect(cx + xx * step, y + yy * step, 1, 1)),
    );
    cx += 4 * step;
  }
}

const textWidth = (t: string, step = 1) => t.length * 4 * step - step;

/** Générateur pseudo-aléatoire déterministe (le décor ne « saute » pas d'une image à l'autre). */
function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

const framesFor = (skin: Skin): Frames => {
  const f = heroFrames(skin);
  return { runA: bake(f.runA), runB: bake(f.runB), jump: bake(f.jump), hurt: bake(f.hurt) };
};

const SECRET = "LILI REVIENS";
const URSSAF_SIGNS = ["URSSAF", "URSSAF", "URSSAF TE VOIT"];

export class Renderer {
  private hero!: Frames;
  private chaser!: Frames;
  private sprites: Record<string, Baked>;
  private particles: Particle[] = [];
  private floats: Float[] = [];
  private shake = 0;
  private flash = 0;
  private stars: { x: number; y: number; b: number }[] = [];

  constructor(skin: Skin) {
    this.setSkin(skin);
    this.sprites = {
      calendar: bake(CALENDAR),
      clock: bake(CLOCK),
      mondayA: bake(MONDAY_A),
      mondayB: bake(MONDAY_B),
      frites: bake(FRITES),
      mask: bake(MASK_ITEM),
      hourglass: bake(HOURGLASS),
    };
    for (let i = 0; i < 60; i++) this.stars.push({ x: hash(i) * 1000, y: hash(i + 99) * 0.55, b: hash(i + 7) });
  }

  setSkin(skin: Skin) {
    this.hero = framesFor(skin);
    this.chaser = framesFor(chaserOf(skin));
  }

  burst(x: number, y: number, color: string, n = 10) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 30 + Math.random() * 60;
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 30, life: 0.5 + Math.random() * 0.3, color });
    }
  }

  float(x: number, y: number, text: string, color: string) {
    this.floats.push({ x, y, text, life: 0.9, color });
  }

  hit() {
    this.shake = 0.3;
    this.flash = 0.12;
  }

  draw(ctx: CanvasRenderingContext2D, e: Engine, dt: number) {
    const { W, H, groundY } = e;
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      ctx.translate(Math.round((Math.random() - 0.5) * 4), Math.round((Math.random() - 0.5) * 3));
    }

    // Ciel étoilé
    ctx.fillStyle = "#090909";
    ctx.fillRect(-4, -4, W + 8, H + 8);
    const d = e.distance;
    for (const s of this.stars) {
      const x = Math.floor((((s.x - d * 0.02) % W) + W) % W);
      ctx.fillStyle = s.b > 0.8 ? "#f1efe8" : "#4a4a4a";
      ctx.fillRect(x, Math.floor(s.y * groundY), 1, 1);
    }

    // Message caché dans les étoiles, très discret, qui passe lentement.
    {
      const step = 2;
      const tw = textWidth(SECRET, step);
      const period = tw + W * 2.2;
      const sx = Math.round(W - ((d * 0.05) % period));
      if (sx < W && sx > -tw) {
        const twinkle = 0.22 + 0.1 * Math.sin(e.time * 2);
        pixelText(ctx, SECRET, sx, Math.round(groundY * 0.12), `rgba(241,239,232,${twinkle})`, step);
      }
    }

    // Lune
    const mx = Math.round(W * 0.78);
    const my = Math.round(Math.max(64, groundY * 0.3));
    ctx.fillStyle = "#d8d4c6";
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#090909";
    ctx.beginPath();
    ctx.arc(mx + 4, my - 3, 8, 0, Math.PI * 2);
    ctx.fill();

    // Bat-signal
    const sx = W * 0.42 + Math.sin(e.time * 0.4) * 10;
    const sy = Math.round(Math.max(44, groundY * 0.18));
    ctx.fillStyle = "rgba(241,239,232,0.05)";
    ctx.beginPath();
    ctx.moveTo(W * 0.62, groundY);
    ctx.lineTo(sx - 18, sy);
    ctx.lineTo(sx + 18, sy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(241,239,232,0.85)";
    ctx.beginPath();
    ctx.ellipse(sx, sy, 17, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#090909";
    const bat = ["k.......k", "kk.k.k.kk", "kkkkkkkkk", ".kkkkkkk.", "..k.k.k.."];
    bat.forEach((row, yy) =>
      [...row].forEach((c, xx) => c === "k" && ctx.fillRect(Math.round(sx - 4 + xx), sy - 2 + yy, 1, 1)),
    );

    // Gratte-ciel lointains, puis immeubles avec fenêtres et panneaux URSSAF
    this.skyline(ctx, W, groundY, d * 0.15, 0, "#121212", 24, 0.55);
    this.skyline(ctx, W, groundY, d * 0.4, 500, "#1b1b1b", 30, 0.38, true);

    // Toit (sol), avec les trous découpés
    const holes = e.entities.filter((en) => en.kind === "hole");
    const groundSpan = (x0: number, x1: number) => {
      ctx.fillStyle = "#202020";
      ctx.fillRect(x0, groundY, x1 - x0, H - groundY + 4);
      ctx.fillStyle = "#3d3d3d";
      ctx.fillRect(x0, groundY, x1 - x0, 1);
    };
    let cursor = -4;
    for (const hl of holes.sort((a, b) => a.x - b.x)) {
      const hx = Math.round(hl.x);
      if (hx > cursor) groundSpan(cursor, hx);
      // bords du vide
      ctx.fillStyle = "#e53935";
      ctx.fillRect(hx - 1, groundY, 1, 3);
      ctx.fillRect(hx + hl.w, groundY, 1, 3);
      cursor = Math.max(cursor, hx + hl.w);
    }
    if (cursor < W + 4) groundSpan(cursor, W + 4);
    ctx.fillStyle = "#2b2b2b";
    const off = Math.floor(d) % 24;
    for (let x = -off; x < W; x += 24) {
      if (!holes.some((hl) => x + 12 > hl.x && x < hl.x + hl.w)) ctx.fillRect(x, groundY + 4, 12, 1);
    }

    // Entités
    for (const en of e.entities) if (en.kind !== "hole") this.entity(ctx, en, e.time);

    // Poursuivant(e) : se rapproche à chaque choc
    const gap = e.status === "over" ? e.heroX - 12 : [-30, 18, 4, -30][e.masks] ?? -30;
    if (gap > -20) {
      const img = Math.floor(e.time * 9) % 2 ? this.chaser.runA : this.chaser.runB;
      ctx.drawImage(img, Math.round(gap), groundY - HERO_H);
    }

    // Héros
    const h = e.hero;
    const blink = h.invT > 0 && Math.floor(h.invT * 16) % 2 === 0;
    if (!blink) {
      let img = this.hero.runA;
      if (h.hurtT > 0 || e.status === "over") img = this.hero.hurt;
      else if (!h.onGround) img = this.hero.jump;
      else if (e.status === "running")
        img = Math.floor(e.time * (6 + e.speed / 30)) % 2 ? this.hero.runA : this.hero.runB;
      ctx.drawImage(img, e.heroX, Math.round(h.y));
    }
    if (h.y <= groundY - HERO_H + 1) {
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      const air = Math.max(0, groundY - HERO_H - h.y);
      ctx.fillRect(e.heroX + 3 + Math.min(3, air / 15), groundY, Math.max(4, 9 - air / 10), 1);
    }

    // Particules et textes flottants
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += 160 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    for (const f of this.floats) {
      f.life -= dt;
      f.y -= 22 * dt;
      pixelText(ctx, f.text, Math.round(f.x), Math.round(f.y), f.color);
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    if (e.slowT > 0) {
      ctx.fillStyle = `rgba(242,193,78,${0.06 + 0.03 * Math.sin(e.time * 10)})`;
      ctx.fillRect(-4, -4, W + 8, H + 8);
    }

    ctx.restore();

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      ctx.fillStyle = "rgba(229,57,53,0.45)";
      ctx.fillRect(0, 0, W, H);
    }
    // Lignes de balayage (CRT)
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
  }

  private entity(ctx: CanvasRenderingContext2D, en: Entity, t: number) {
    const x = Math.round(en.x);
    const y = Math.round(en.y);
    switch (en.kind) {
      case "calendar":
        ctx.drawImage(this.sprites.calendar, x, y);
        break;
      case "clock": {
        ctx.drawImage(this.sprites.clock, x, y);
        const a = t * 4;
        ctx.fillStyle = "#e53935";
        ctx.fillRect(Math.round(x + 6 + Math.cos(a) * 3), Math.round(y + 5 + Math.sin(a) * 3), 1, 1);
        break;
      }
      case "monday":
        ctx.drawImage(Math.floor(en.t * 8) % 2 ? this.sprites.mondayA : this.sprites.mondayB, x, y);
        break;
      default: {
        const bob = Math.round(Math.sin(en.t * 5) * 1.5);
        ctx.drawImage(this.sprites[en.kind], x, y + bob);
        if (Math.floor(en.t * 6) % 3 === 0) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(x - 1, y + bob - 1, 1, 1);
        }
      }
    }
  }

  private skyline(
    ctx: CanvasRenderingContext2D,
    W: number,
    groundY: number,
    scroll: number,
    seed: number,
    color: string,
    unit: number,
    maxRatio: number,
    detailed = false,
  ) {
    const first = Math.floor(scroll / unit) - 1;
    const last = Math.floor((scroll + W) / unit) + 1;
    for (let i = first; i <= last; i++) {
      const bw = unit - 2 - Math.floor(hash(i + seed) * 6);
      const bh = Math.floor(groundY * (0.18 + hash(i * 3 + seed) * maxRatio));
      const x = Math.round(i * unit - scroll);
      const top = groundY - bh;
      ctx.fillStyle = color;
      ctx.fillRect(x, top, bw, bh);
      if (hash(i + seed + 11) > 0.7) ctx.fillRect(x + Math.floor(bw / 2), top - 6, 1, 6); // antenne
      if (!detailed) continue;
      for (let wy = top + 4; wy < groundY - 4; wy += 5) {
        for (let wx = x + 3; wx < x + bw - 3; wx += 4) {
          const v = hash((wx - x) * 7 + (wy - top) * 13 + i * 31);
          if (v > 0.86) {
            ctx.fillStyle = v > 0.985 ? "#7a2422" : "#4a4434";
            ctx.fillRect(wx, wy, 2, 2);
          }
        }
      }
      // Panneau publicitaire URSSAF sur certains toits
      if (hash(i * 5 + 77) > 0.8) {
        const label = URSSAF_SIGNS[Math.floor(hash(i + 3) * URSSAF_SIGNS.length)];
        const tw = textWidth(label);
        const pw = tw + 6;
        const px = x + Math.round((bw - pw) / 2);
        const py = top - 14;
        ctx.fillStyle = "#2a2a2a";
        ctx.fillRect(px + 3, py + 9, 1, 5);
        ctx.fillRect(px + pw - 4, py + 9, 1, 5);
        ctx.fillStyle = "#1d3f8f";
        ctx.fillRect(px, py, pw, 9);
        ctx.fillStyle = "#3d64c4";
        ctx.fillRect(px, py, pw, 1);
        pixelText(ctx, label, px + 3, py + 2, "#e8e6df");
      }
    }
  }
}
