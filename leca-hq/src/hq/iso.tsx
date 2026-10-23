import type { ReactNode } from 'react';

/** Projection isométrique (30°) : unités monde → pixels de la scène SVG. */
export const U = 44;
export const ORIGIN = { x: 470, y: 270 };
export const SCENE = { w: 1080, h: 860 };
const COS = 0.8660254;

export const iso = (x: number, y: number, z = 0): [number, number] => [
  (x - y) * COS * U + ORIGIN.x,
  (x + y) * 0.5 * U - z * U + ORIGIN.y,
];
const pts = (list: [number, number][]) => list.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ');
const P = (x: number, y: number, z: number) => iso(x, y, z);

export type Tone = 'pearl' | 'shade' | 'chrome' | 'ink' | 'glass' | 'screen';
const TONES: Record<Tone, { top: string; left: string; right: string; stroke: string }> = {
  pearl: { top: '#FFFFFF', left: '#E7E7E4', right: '#D3D3D0', stroke: 'rgba(16,16,16,.14)' },
  shade: { top: '#F0F0EE', left: '#DADAD7', right: '#C4C4C1', stroke: 'rgba(16,16,16,.16)' },
  chrome: { top: 'url(#gChromeTop)', left: 'url(#gChromeL)', right: 'url(#gChromeR)', stroke: 'rgba(255,255,255,.7)' },
  ink: { top: '#3C3C3C', left: '#202020', right: '#101010', stroke: 'rgba(255,255,255,.14)' },
  glass: { top: 'rgba(255,255,255,.55)', left: 'rgba(255,255,255,.28)', right: 'rgba(200,205,208,.34)', stroke: 'rgba(255,255,255,.9)' },
  screen: { top: '#1d1d1d', left: '#0d0d0d', right: '#0d0d0d', stroke: 'rgba(255,255,255,.25)' },
};

interface BoxProps {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h: number;
  tone?: Tone;
  className?: string;
}

/** Pavé isométrique : (x, y) = coin arrière, w le long de x, d le long de y, h en hauteur. */
export function Box({ x, y, z = 0, w, d, h, tone = 'pearl', className }: BoxProps) {
  const c = TONES[tone];
  const t = z + h;
  return (
    <g className={className} strokeLinejoin="round" strokeWidth={0.7} stroke={c.stroke}>
      <polygon points={pts([P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x, y + d, t)])} fill={c.left} />
      <polygon points={pts([P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, t), P(x + w, y, t)])} fill={c.right} />
      <polygon points={pts([P(x, y, t), P(x + w, y, t), P(x + w, y + d, t), P(x, y + d, t)])} fill={c.top} />
    </g>
  );
}

/** Quadrilatère vertical sur un plan y = const (face visible côté gauche). */
export function QuadY({ x, y, z, w, h, fill, className, opacity }: { x: number; y: number; z: number; w: number; h: number; fill: string; className?: string; opacity?: number }) {
  return <polygon className={className} opacity={opacity} fill={fill} points={pts([P(x, y, z), P(x + w, y, z), P(x + w, y, z + h), P(x, y, z + h)])} />;
}
/** Quadrilatère vertical sur un plan x = const (face visible côté droit). */
export function QuadX({ x, y, z, d, h, fill, className, opacity }: { x: number; y: number; z: number; d: number; h: number; fill: string; className?: string; opacity?: number }) {
  return <polygon className={className} opacity={opacity} fill={fill} points={pts([P(x, y, z), P(x, y + d, z), P(x, y + d, z + h), P(x, y, z + h)])} />;
}
/** Quadrilatère horizontal (plan z = const). */
export function QuadZ({ x, y, z, w, d, fill, className, opacity, stroke }: { x: number; y: number; z: number; w: number; d: number; fill: string; className?: string; opacity?: number; stroke?: string }) {
  return <polygon className={className} opacity={opacity} fill={fill} stroke={stroke} points={pts([P(x, y, z), P(x + w, y, z), P(x + w, y + d, z), P(x, y + d, z)])} />;
}

const CYL = {
  chrome: { grad: 'url(#gCylChrome)', top: '#F7F7F7' },
  pearl: { grad: 'url(#gCylPearl)', top: '#FFFFFF' },
  ink: { grad: 'url(#gCylInk)', top: '#444' },
  glass: { grad: 'url(#gCylGlass)', top: 'rgba(255,255,255,.7)' },
} as const;

/** Cylindre vertical centré en (x, y). */
export function Cyl({ x, y, z = 0, r, h, tone = 'chrome', className }: { x: number; y: number; z?: number; r: number; h: number; tone?: keyof typeof CYL; className?: string }) {
  const [cx, cyBase] = P(x, y, z);
  const cyTop = cyBase - h * U;
  const rx = r * U * 1.22;
  const ry = rx * 0.577;
  const c = CYL[tone];
  return (
    <g className={className}>
      <path d={`M${cx - rx},${cyTop} L${cx - rx},${cyBase} A${rx},${ry} 0 0 0 ${cx + rx},${cyBase} L${cx + rx},${cyTop} Z`} fill={c.grad} stroke="rgba(16,16,16,.12)" strokeWidth={0.6} />
      <ellipse cx={cx} cy={cyTop} rx={rx} ry={ry} fill={c.top} stroke="rgba(16,16,16,.12)" strokeWidth={0.6} />
    </g>
  );
}

/** Ombre portée douce au sol. */
export function Shadow({ x, y, z = 0, rx = 1, ry }: { x: number; y: number; z?: number; rx?: number; ry?: number }) {
  const [cx, cy] = P(x, y, z);
  const w = rx * U * 1.22;
  return <ellipse cx={cx} cy={cy} rx={w} ry={ry ? ry * U : w * 0.577} fill="url(#gShadow)" />;
}

/** Enveloppe convexe 2D (chaîne monotone) — zone cliquable d'un poste. */
export function hull(points: [number, number][]): [number, number][] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: number[], a: number[], b: number[]) => (a[0]! - o[0]!) * (b[1]! - o[1]!) - (a[1]! - o[1]!) * (b[0]! - o[0]!);
  const lower: [number, number][] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: [number, number][] = [];
  for (const q of [...p].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, q) <= 0) upper.pop();
    upper.push(q);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

export const polyPoints = pts;

export function Defs(): ReactNode {
  return (
    <defs>
      <linearGradient id="gChromeTop" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset=".45" stopColor="#D9D9D9" />
        <stop offset=".7" stopColor="#F6F6F6" />
        <stop offset="1" stopColor="#BEBEBE" />
      </linearGradient>
      <linearGradient id="gChromeL" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#E9E9E9" />
        <stop offset=".5" stopColor="#B4B4B4" />
        <stop offset="1" stopColor="#DADADA" />
      </linearGradient>
      <linearGradient id="gChromeR" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#B9B9B9" />
        <stop offset=".5" stopColor="#8A8A8A" />
        <stop offset="1" stopColor="#B0B0B0" />
      </linearGradient>
      <linearGradient id="gCylChrome" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#8D8D8D" />
        <stop offset=".25" stopColor="#F8F8F8" />
        <stop offset=".55" stopColor="#BDBDBD" />
        <stop offset=".8" stopColor="#EDEDED" />
        <stop offset="1" stopColor="#7E7E7E" />
      </linearGradient>
      <linearGradient id="gCylPearl" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#D2D2CF" />
        <stop offset=".35" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#CBCBC8" />
      </linearGradient>
      <linearGradient id="gCylInk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#101010" />
        <stop offset=".3" stopColor="#4A4A4A" />
        <stop offset="1" stopColor="#0A0A0A" />
      </linearGradient>
      <linearGradient id="gCylGlass" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="rgba(190,196,200,.55)" />
        <stop offset=".3" stopColor="rgba(255,255,255,.8)" />
        <stop offset="1" stopColor="rgba(190,196,200,.5)" />
      </linearGradient>
      <radialGradient id="gShadow">
        <stop offset="0" stopColor="#101010" stopOpacity=".28" />
        <stop offset="1" stopColor="#101010" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="gFloor" cx=".5" cy=".5" r=".7">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#ECECE9" />
      </radialGradient>
      <linearGradient id="gWall" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".7" />
        <stop offset="1" stopColor="#D9DEE0" stopOpacity=".18" />
      </linearGradient>
      <linearGradient id="gWallR" x1="1" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".6" />
        <stop offset="1" stopColor="#D9DEE0" stopOpacity=".12" />
      </linearGradient>
      <linearGradient id="gSheenBeam" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#fff" stopOpacity="0" />
        <stop offset=".5" stopColor="#fff" stopOpacity=".75" />
        <stop offset="1" stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <radialGradient id="gOrb" cx=".35" cy=".3" r=".85">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset=".35" stopColor="#E3E3E3" />
        <stop offset=".62" stopColor="#8F8F8F" />
        <stop offset=".8" stopColor="#D8D8D8" />
        <stop offset="1" stopColor="#5E5E5E" />
      </radialGradient>
      <radialGradient id="gGlow">
        <stop offset="0" stopColor="#FFFFFF" stopOpacity=".95" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </radialGradient>
      <linearGradient id="gRing" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset=".5" stopColor="#9C9C9C" />
        <stop offset="1" stopColor="#F2F2F2" />
      </linearGradient>
    </defs>
  );
}
