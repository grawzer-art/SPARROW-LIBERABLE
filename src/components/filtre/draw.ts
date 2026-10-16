/**
 * FILTRE SPARROW — dessin du masque sur les points du visage (MediaPipe Face Mesh, 478 points).
 * Coordonnées normalisées [0, 1] → pixels du canevas. `mirror` = selfie (affichage en miroir).
 *
 * Repère du visage : u ∈ [-1, 1] de la joue gauche à la joue droite (à l'écran),
 * v = 0 en haut du front, v = 1 au menton. Les demi-largeurs gauche et droite sont
 * mesurées séparément, ce qui suit correctement une tête tournée de trois quarts.
 */

export type Style = "chevalier" | "incognito" | "barbe";

export interface P {
  x: number;
  y: number;
}

export type Landmarks = { x: number; y: number; z?: number }[];

const TOP = 10;
const CHIN = 152;
const LEFT = 234;
const RIGHT = 454;
const NOSE_BOTTOM = 2;
const LIP_TOP = 0;
const EYE_A = [33, 133, 159, 145];
const EYE_B = [362, 263, 386, 374];
const JAW = [234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152, 377, 400, 378, 379, 365, 397, 288, 361, 323, 454];
const LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];

const SHADES = ["#6e2709", "#8f3510", "#a8431a", "#c4521f", "#d8692c", "#e8843f", "#f09a55"];

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

/** Poils de barbe : positions fixes dans le repère du visage (pas de scintillement). */
const BEARD_HAIRS = (() => {
  const r = rng(7);
  return Array.from({ length: 1500 }, () => ({
    u: r() * 2.5 - 1.25,
    v: 0.4 + r() * 0.85,
    len: 0.025 + r() * 0.045,
    ang: (r() - 0.5) * 0.7,
    bend: (r() - 0.5) * 0.6,
    c: Math.floor(r() * SHADES.length),
  }));
})();

const MUSTACHE_HAIRS = (() => {
  const r = rng(99);
  return Array.from({ length: 260 }, () => ({ u: r() * 1.3 - 0.65, t: r(), len: 0.02 + r() * 0.03, c: Math.floor(r() * SHADES.length) }));
})();

interface Frame {
  pt: (i: number) => P;
  map: (u: number, v: number) => P;
  vOf: (p: P) => number;
  faceW: number;
  faceH: number;
  roll: number;
  ux: P;
  uy: P;
}

function frame(lm: Landmarks, W: number, H: number, mirror: boolean): Frame {
  const pt = (i: number): P => ({ x: (mirror ? 1 - lm[i].x : lm[i].x) * W, y: lm[i].y * H });
  const top = pt(TOP);
  const chin = pt(CHIN);
  let l = pt(LEFT);
  let r = pt(RIGHT);
  if (l.x > r.x) [l, r] = [r, l];
  const span = Math.hypot(r.x - l.x, r.y - l.y);
  const faceH = Math.hypot(chin.x - top.x, chin.y - top.y);
  const ux = { x: (r.x - l.x) / span, y: (r.y - l.y) / span };
  const uy = { x: (chin.x - top.x) / faceH, y: (chin.y - top.y) / faceH };
  const proj = (p: P) => (p.x - top.x) * ux.x + (p.y - top.y) * ux.y;
  const wl = Math.max(span * 0.2, -proj(l));
  const wr = Math.max(span * 0.2, proj(r));
  const map = (u: number, v: number): P => {
    const k = u < 0 ? u * wl : u * wr;
    return { x: top.x + uy.x * v * faceH + ux.x * k, y: top.y + uy.y * v * faceH + ux.y * k };
  };
  const vOf = (p: P) => ((p.x - top.x) * uy.x + (p.y - top.y) * uy.y) / faceH;
  return { pt, map, vOf, faceW: span, faceH, roll: Math.atan2(ux.y, ux.x), ux, uy };
}

const avg = (ps: P[]): P => ({ x: ps.reduce((a, p) => a + p.x, 0) / ps.length, y: ps.reduce((a, p) => a + p.y, 0) / ps.length });

/** Tracé lissé ; les sommets marqués « sharp » restent pointus (oreilles). */
function curve(path: Path2D, pts: { p: P; sharp?: boolean }[]) {
  const n = pts.length;
  const mid = (a: P, b: P) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
  const s = mid(pts[n - 1].p, pts[0].p);
  path.moveTo(s.x, s.y);
  for (let i = 0; i < n; i++) {
    const { p, sharp } = pts[i];
    const m = mid(p, pts[(i + 1) % n].p);
    if (sharp) {
      path.lineTo(p.x, p.y);
      path.lineTo(m.x, m.y);
    } else path.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  path.closePath();
}

function scaled(pts: P[], k: number, dy = 0): P[] {
  const c = avg(pts);
  return pts.map((p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k + dy }));
}

function mouth(f: Frame, grow: number): Path2D {
  const path = new Path2D();
  curve(path, scaled(LIPS.map(f.pt), grow).map((p) => ({ p })));
  return path;
}

function eyes(f: Frame) {
  return [EYE_A, EYE_B].map((ids) => {
    const [a, b, t, bt] = ids.map(f.pt);
    return { c: avg([a, b, t, bt]), w: Math.hypot(b.x - a.x, b.y - a.y), a, b };
  });
}

function strokeHairs(
  ctx: CanvasRenderingContext2D,
  f: Frame,
  hairs: { p: P; a: number; L: number; bend: number; c: number }[],
  width: number,
) {
  const byShade: Path2D[] = SHADES.map(() => new Path2D());
  for (const h of hairs) {
    const path = byShade[h.c];
    const ex = h.p.x + Math.cos(h.a) * h.L;
    const ey = h.p.y + Math.sin(h.a) * h.L;
    const cx = (h.p.x + ex) / 2 + Math.cos(h.a + Math.PI / 2) * h.L * h.bend;
    const cy = (h.p.y + ey) / 2 + Math.sin(h.a + Math.PI / 2) * h.L * h.bend;
    path.moveTo(h.p.x, h.p.y);
    path.quadraticCurveTo(cx, cy, ex, ey);
  }
  ctx.lineCap = "round";
  ctx.lineWidth = width;
  SHADES.forEach((col, i) => {
    ctx.strokeStyle = col;
    ctx.stroke(byShade[i]);
  });
}

/** Barbe rousse fournie, bords duveteux, moustache, bouche dégagée. */
function drawBeard(ctx: CanvasRenderingContext2D, f: Frame) {
  const vNose = f.vOf(f.pt(NOSE_BOTTOM));
  const vLip = f.vOf(f.pt(LIP_TOP));
  const jaw = JAW.map(f.pt);
  const jawLR = jaw[0].x <= jaw[jaw.length - 1].x ? jaw : [...jaw].reverse();
  const upper = [f.map(1.0, vLip - 0.07), f.map(0.75, vLip - 0.02), f.map(0.5, vLip - 0.01), f.map(-0.5, vLip - 0.01), f.map(-0.75, vLip - 0.02), f.map(-1.0, vLip - 0.07)];
  const outline = (k: number) => {
    const p = new Path2D();
    curve(p, [...scaled(jawLR, k, f.faceH * 0.025 * k), ...upper].map((q) => ({ p: q })));
    return p;
  };
  const down = Math.atan2(f.uy.y, f.uy.x);
  const mouthHole = mouth(f, 1.18);

  // 1. Base (ombre intérieure), 2. poils débordant légèrement, 3. moustache
  ctx.save();
  const base = outline(1.04);
  const clipBase = new Path2D(base);
  clipBase.addPath(mouthHole);
  ctx.clip(clipBase, "evenodd");
  const c = f.map(0, 0.85);
  const g = ctx.createRadialGradient(c.x, c.y, f.faceW * 0.05, c.x, c.y, f.faceW * 0.75);
  g.addColorStop(0, "#c25a25");
  g.addColorStop(1, "#7a2d0c");
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.95;
  ctx.fill(base);
  ctx.restore();

  ctx.save();
  const furClip = outline(1.12);
  furClip.addPath(mouth(f, 1.08));
  ctx.clip(furClip, "evenodd");
  ctx.globalAlpha = 0.85;
  const hairs = BEARD_HAIRS.filter((h) => h.v > vLip - 0.1).map((h) => ({
    p: f.map(h.u, h.v),
    a: down + h.ang + h.u * 0.25,
    L: h.len * f.faceH,
    bend: h.bend,
    c: h.c,
  }));
  strokeHairs(ctx, f, hairs, Math.max(1, f.faceW * 0.0065));
  ctx.restore();

  // Moustache : deux mèches qui partent du nez vers les coins de la bouche
  ctx.save();
  const mL = f.pt(61);
  const mR = f.pt(291);
  const [ml, mr] = mL.x < mR.x ? [mL, mR] : [mR, mL];
  const must = new Path2D();
  const n1 = f.map(0, vNose + 0.01);
  must.moveTo(n1.x, n1.y);
  for (const [s, corner] of [
    [-1, ml],
    [1, mr],
  ] as const) {
    const a = f.map(s * 0.35, vNose + 0.005);
    const b = { x: corner.x + s * f.faceW * 0.05, y: corner.y + f.faceH * 0.03 };
    const lipTop = f.map(s * 0.2, vLip + 0.01);
    must.moveTo(n1.x, n1.y);
    must.quadraticCurveTo(a.x, a.y, b.x, b.y);
    must.quadraticCurveTo(lipTop.x, lipTop.y, f.map(0, vLip + 0.005).x, f.map(0, vLip + 0.005).y);
    must.closePath();
  }
  ctx.globalAlpha = 0.95;
  ctx.fillStyle = "#9c3c14";
  ctx.fill(must);
  ctx.clip(must);
  const mh = MUSTACHE_HAIRS.map((h) => {
    const v = vNose + 0.01 + h.t * (vLip - vNose);
    return { p: f.map(h.u, v), a: down + h.u * 1.1, L: h.len * f.faceH, bend: 0.2, c: h.c };
  });
  strokeHairs(ctx, f, mh, Math.max(1, f.faceW * 0.006));
  ctx.restore();
}

/** Cagoule du Chevalier Noir : oreilles pointues, yeux en amande, reflets du latex. */
function drawCowl(ctx: CanvasRenderingContext2D, f: Frame) {
  const vNose = f.vOf(f.pt(NOSE_BOTTOM));
  const vLip = f.vOf(f.pt(LIP_TOP));
  const m = (u: number, v: number, sharp = false) => ({ p: f.map(u, v), sharp });
  const shape = [
    m(-1.02, vLip + 0.05),
    m(-1.16, 0.46),
    m(-1.2, 0.18),
    m(-1.1, -0.04),
    m(-0.98, -0.14, true),
    m(-0.84, -0.78, true), // oreille gauche
    m(-0.6, -0.22, true),
    m(-0.32, -0.3),
    m(0, -0.32),
    m(0.32, -0.3),
    m(0.6, -0.22, true),
    m(0.84, -0.78, true), // oreille droite
    m(0.98, -0.14, true),
    m(1.1, -0.04),
    m(1.2, 0.18),
    m(1.16, 0.46),
    m(1.02, vLip + 0.05, true),
    m(0.74, vLip - 0.03),
    m(0.42, vNose + 0.035),
    m(0.17, vNose + 0.005),
    m(0, vNose - 0.005),
    m(-0.17, vNose + 0.005),
    m(-0.42, vNose + 0.035),
    m(-0.74, vLip - 0.03),
  ];
  const body = new Path2D();
  curve(body, shape);

  // Yeux en amande, coin extérieur relevé (air sévère)
  const holes = new Path2D();
  for (const e of eyes(f)) {
    const [inner, outer] = Math.abs(e.a.x - f.map(0, 0).x) < Math.abs(e.b.x - f.map(0, 0).x) ? [e.a, e.b] : [e.b, e.a];
    const dx = outer.x - inner.x;
    const dy = outer.y - inner.y;
    const ext = 0.32;
    const i2 = { x: inner.x - dx * ext * 0.6, y: inner.y - dy * ext * 0.6 };
    const o2 = { x: outer.x + dx * ext, y: outer.y + dy * ext - e.w * 0.18 };
    const nx = -dy / e.w;
    const ny = dx / e.w;
    const up = { x: (i2.x + o2.x) / 2 - nx * e.w * 0.7 * Math.sign(ny || 1), y: (i2.y + o2.y) / 2 - Math.abs(ny) * e.w * 0.62 };
    const lo = { x: (i2.x + o2.x) / 2, y: (i2.y + o2.y) / 2 + e.w * 0.62 };
    holes.moveTo(i2.x, i2.y);
    holes.quadraticCurveTo(up.x, up.y, o2.x, o2.y);
    holes.quadraticCurveTo(lo.x, lo.y, i2.x, i2.y);
    holes.closePath();
  }
  const full = new Path2D(body);
  full.addPath(holes);

  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = f.faceW * 0.06;
  ctx.shadowOffsetY = f.faceH * 0.015;
  ctx.fillStyle = "#101014";
  ctx.fill(full, "evenodd");
  ctx.restore();

  // Modelé : clip sur la cagoule, puis lumières et ombres
  ctx.save();
  ctx.clip(full, "evenodd");
  const hl = f.map(-0.35, 0.05);
  let g = ctx.createRadialGradient(hl.x, hl.y, 0, hl.x, hl.y, f.faceW * 0.9);
  g.addColorStop(0, "rgba(120,120,140,0.55)");
  g.addColorStop(0.35, "rgba(60,60,72,0.25)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fill(body);
  const bot = f.map(0, vLip);
  g = ctx.createLinearGradient(f.map(0, 0.2).x, f.map(0, 0.2).y, bot.x, bot.y);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g;
  ctx.fill(body);

  ctx.lineCap = "round";
  // Sourcils froncés (reliefs)
  for (const s of [-1, 1]) {
    const a = f.map(s * 0.78, 0.2);
    const cp = f.map(s * 0.42, 0.13);
    const b = f.map(s * 0.08, 0.3);
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = Math.max(2, f.faceW * 0.05);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(cp.x, cp.y, b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = "rgba(200,200,220,0.28)";
    ctx.lineWidth = Math.max(1, f.faceW * 0.012);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - f.faceH * 0.02);
    ctx.quadraticCurveTo(cp.x, cp.y - f.faceH * 0.02, b.x, b.y - f.faceH * 0.02);
    ctx.stroke();
  }
  // Arête du nez
  const n1 = f.map(0.02, 0.33);
  const n2 = f.map(0.04, vNose - 0.05);
  ctx.strokeStyle = "rgba(200,200,220,0.22)";
  ctx.lineWidth = Math.max(1, f.faceW * 0.02);
  ctx.beginPath();
  ctx.moveTo(n1.x, n1.y);
  ctx.lineTo(n2.x, n2.y);
  ctx.stroke();
  // Reflets brillants sur le front et les oreilles
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = Math.max(1.5, f.faceW * 0.022);
  const r1 = f.map(-0.55, -0.12);
  const r2 = f.map(-0.1, -0.2);
  const rc = f.map(-0.35, -0.22);
  ctx.beginPath();
  ctx.moveTo(r1.x, r1.y);
  ctx.quadraticCurveTo(rc.x, rc.y, r2.x, r2.y);
  ctx.stroke();
  for (const s of [-1, 1]) {
    const a = f.map(s * 0.82, -0.66);
    const b = f.map(s * 0.72, -0.3);
    ctx.lineWidth = Math.max(1, f.faceW * 0.012);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  // Bord intérieur des yeux
  ctx.strokeStyle = "rgba(0,0,0,0.85)";
  ctx.lineWidth = Math.max(2, f.faceW * 0.03);
  ctx.stroke(holes);
  ctx.restore();

  // Liseré du bord
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = Math.max(1, f.faceW * 0.006);
  ctx.stroke(body);
  ctx.restore();
}

/** Petites lunettes ovales noires (version Incognito). */
function drawGlasses(ctx: CanvasRenderingContext2D, f: Frame) {
  const [ea, eb] = eyes(f);
  const [l, r] = ea.c.x < eb.c.x ? [ea, eb] : [eb, ea];
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#24160d";
  ctx.lineWidth = Math.max(2, f.faceW * 0.02);
  const tl = f.map(-1.02, f.vOf(l.c) - 0.01);
  const tr = f.map(1.02, f.vOf(r.c) - 0.01);
  ctx.beginPath();
  ctx.moveTo(l.c.x - l.w * 0.95, l.c.y);
  ctx.lineTo(tl.x, tl.y);
  ctx.moveTo(r.c.x + r.w * 0.95, r.c.y);
  ctx.lineTo(tr.x, tr.y);
  ctx.moveTo(l.c.x + l.w * 0.9, l.c.y - l.w * 0.1);
  ctx.quadraticCurveTo((l.c.x + r.c.x) / 2, (l.c.y + r.c.y) / 2 - l.w * 0.35, r.c.x - r.w * 0.9, r.c.y - r.w * 0.1);
  ctx.stroke();
  for (const e of [l, r]) {
    ctx.beginPath();
    ctx.ellipse(e.c.x, e.c.y, e.w * 1.0, e.w * 0.6, f.roll, 0, Math.PI * 2);
    const g = ctx.createLinearGradient(e.c.x, e.c.y - e.w * 0.6, e.c.x, e.c.y + e.w * 0.6);
    g.addColorStop(0, "rgba(40,40,48,0.95)");
    g.addColorStop(1, "rgba(5,5,7,0.95)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "#4a2a15";
    ctx.lineWidth = Math.max(2, f.faceW * 0.022);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(e.c.x - e.w * 0.38, e.c.y - e.w * 0.18, e.w * 0.3, e.w * 0.1, f.roll - 0.5, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(190,215,240,0.4)";
    ctx.fill();
  }
  ctx.restore();
}

/** Cadre de reconnaissance faciale autour du visage (HUD). */
function drawTarget(ctx: CanvasRenderingContext2D, f: Frame, lm: Landmarks, W: number, H: number, mirror: boolean) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const p of lm) {
    const x = (mirror ? 1 - p.x : p.x) * W;
    const y = p.y * H;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y < y0) y0 = y;
    if (y > y1) y1 = y;
  }
  const pad = f.faceW * 0.18;
  x0 -= pad;
  x1 += pad;
  y0 -= pad * 2.6;
  y1 += pad;
  const L = f.faceW * 0.16;
  ctx.save();
  ctx.strokeStyle = "#e53935";
  ctx.lineWidth = Math.max(2, f.faceW * 0.012);
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [x0, y0, 1, 1],
    [x1, y0, -1, 1],
    [x0, y1, 1, -1],
    [x1, y1, -1, -1],
  ]) {
    ctx.moveTo(x, y + dy * L);
    ctx.lineTo(x, y);
    ctx.lineTo(x + dx * L, y);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawFilter(
  ctx: CanvasRenderingContext2D,
  faces: Landmarks[],
  W: number,
  H: number,
  opts: { style: Style; mirror: boolean; target: boolean },
) {
  for (const lm of faces) {
    if (!lm || lm.length < 468) continue;
    const f = frame(lm, W, H, opts.mirror);
    if (opts.target) drawTarget(ctx, f, lm, W, H, opts.mirror);
    drawBeard(ctx, f);
    if (opts.style === "chevalier") drawCowl(ctx, f);
    if (opts.style === "incognito") drawGlasses(ctx, f);
  }
}

