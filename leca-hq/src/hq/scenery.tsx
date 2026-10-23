import type { ReactNode } from 'react';
import { Box, Cyl, QuadX, QuadY, QuadZ, Shadow, iso, polyPoints } from './iso';

/** Taille et hauteur d'une plateforme de poste (unités monde). */
export const PLATFORM = 3.4;
const PZ = 0.18; // dessus de plateforme

export function Platform({ bx, by }: { bx: number; by: number }) {
  return (
    <g>
      <Box x={bx - 0.12} y={by - 0.12} w={PLATFORM + 0.24} d={PLATFORM + 0.24} h={PZ} tone="chrome" />
      <Box x={bx} y={by} z={PZ - 0.02} w={PLATFORM} d={PLATFORM} h={0.04} tone="pearl" />
      <polygon className="st__glow" points={polyPoints([iso(bx, by, PZ + 0.03), iso(bx + PLATFORM, by, PZ + 0.03), iso(bx + PLATFORM, by + PLATFORM, PZ + 0.03), iso(bx, by + PLATFORM, PZ + 0.03)])} fill="url(#gGlow)" />
    </g>
  );
}

/* ───────────── 01 · CREATIVE — studio de direction artistique ───────────── */
export function CreativeScene({ bx, by }: { bx: number; by: number }) {
  const z = PZ;
  return (
    <g>
      <Platform bx={bx} by={by} />
      {/* mur de moodboard */}
      <Box x={bx + 0.2} y={by + 0.2} z={z} w={3.0} d={0.14} h={2.5} tone="ink" />
      {[
        [0.45, 1.6, 0.8, 0.62, '#FFFFFF'],
        [1.4, 1.75, 0.6, 0.75, '#C0C0C0'],
        [2.1, 1.55, 0.85, 0.55, '#F6F6F4'],
        [0.5, 0.75, 0.55, 0.62, '#9D9D9D'],
        [1.2, 0.7, 0.9, 0.7, '#FFFFFF'],
        [2.25, 0.85, 0.5, 0.52, '#E8E8E8'],
      ].map(([ox, oz, w, h, fill], i) => (
        <QuadY key={i} x={bx + 0.2 + (ox as number)} y={by + 0.34} z={z + (oz as number)} w={w as number} h={h as number} fill={fill as string} className={i === 1 ? 'shimmer' : undefined} />
      ))}
      {/* table de travail */}
      <Shadow x={bx + 1.6} y={by + 2.2} rx={1.5} />
      <Box x={bx + 0.5} y={by + 1.6} z={z + 0.62} w={2.2} d={1.1} h={0.1} tone="chrome" />
      <Box x={bx + 0.6} y={by + 1.7} z={z} w={0.1} d={0.1} h={0.62} tone="chrome" />
      <Box x={bx + 2.5} y={by + 1.7} z={z} w={0.1} d={0.1} h={0.62} tone="chrome" />
      <Box x={bx + 0.6} y={by + 2.5} z={z} w={0.1} d={0.1} h={0.62} tone="chrome" />
      <Box x={bx + 2.5} y={by + 2.5} z={z} w={0.1} d={0.1} h={0.62} tone="chrome" />
      {/* planches de références */}
      <Box x={bx + 0.8} y={by + 1.85} z={z + 0.72} w={0.7} d={0.5} h={0.03} tone="pearl" />
      <Box x={bx + 0.95} y={by + 1.95} z={z + 0.75} w={0.7} d={0.5} h={0.03} tone="shade" />
      <Box x={bx + 1.9} y={by + 2.0} z={z + 0.72} w={0.5} d={0.4} h={0.18} tone="ink" />
      {/* trépied + ring light */}
      <Shadow x={bx + 3.0} y={by + 2.7} rx={0.5} />
      <Cyl x={bx + 3.0} y={by + 2.7} z={z} r={0.05} h={1.9} tone="chrome" />
      <g className="ringlight">
        <circle cx={iso(bx + 3.0, by + 2.7, z + 2.15)[0]} cy={iso(bx + 3.0, by + 2.7, z + 2.15)[1]} r={30} fill="none" stroke="url(#gRing)" strokeWidth={6} />
        <circle cx={iso(bx + 3.0, by + 2.7, z + 2.15)[0]} cy={iso(bx + 3.0, by + 2.7, z + 2.15)[1]} r={46} fill="url(#gGlow)" opacity={0.55} />
      </g>
      {/* flottant : cartes de teintes */}
      <g className="float">
        <Box x={bx + 1.1} y={by + 2.1} z={z + 1.35} w={0.3} d={0.45} h={0.04} tone="pearl" />
        <Box x={bx + 1.25} y={by + 2.15} z={z + 1.5} w={0.3} d={0.45} h={0.04} tone="chrome" />
        <Box x={bx + 1.4} y={by + 2.2} z={z + 1.65} w={0.3} d={0.45} h={0.04} tone="ink" />
      </g>
    </g>
  );
}

/* ───────────── 02 · SOCIAL — centre de contenu ───────────── */
export function SocialScene({ bx, by }: { bx: number; by: number }) {
  const z = PZ;
  return (
    <g>
      <Platform bx={bx} by={by} />
      {/* mur calendrier */}
      <Box x={bx + 0.2} y={by + 0.2} z={z} w={3.0} d={0.12} h={2.0} tone="pearl" />
      {Array.from({ length: 12 }, (_, i) => {
        const c = i % 4;
        const r = Math.floor(i / 4);
        const on = [1, 4, 6, 9, 10].includes(i);
        return <QuadY key={i} x={bx + 0.4 + c * 0.68} y={by + 0.32} z={z + 0.4 + r * 0.55} w={0.55} h={0.42} fill={on ? '#101010' : '#E8E8E8'} className={i === 6 ? 'blink' : undefined} />;
      })}
      {/* téléphones sur pieds */}
      {[0, 1, 2].map((i) => {
        const x = bx + 0.55 + i * 0.95;
        const h = 1.1 + (i === 1 ? 0.35 : 0);
        return (
          <g key={i}>
            <Shadow x={x + 0.25} y={by + 2.5} rx={0.45} />
            <Cyl x={x + 0.25} y={by + 2.5} z={z} r={0.07} h={h - 0.4} tone="chrome" />
            <Box x={x} y={by + 2.4} z={z + h - 0.4} w={0.5} d={0.1} h={0.85} tone="ink" />
            <QuadY x={x + 0.05} y={by + 2.5} z={z + h - 0.35} w={0.4} h={0.75} fill="#fff" opacity={0.9} className={i === 0 ? 'scr' : i === 1 ? 'blink' : 'scr scr--late'} />
            <QuadY x={x + 0.1} y={by + 2.5} z={z + h + 0.1} w={0.3} h={0.1} fill="#101010" opacity={0.75} />
          </g>
        );
      })}
      {/* disque de lecture flottant */}
      <g className="float float--slow">
        <Cyl x={bx + 2.7} y={by + 1.4} z={z + 1.2} r={0.4} h={0.06} tone="glass" />
        <polygon points={polyPoints([iso(bx + 2.62, by + 1.3, z + 1.3), iso(bx + 2.62, by + 1.5, z + 1.3), iso(bx + 2.82, by + 1.4, z + 1.3)])} fill="#101010" />
      </g>
    </g>
  );
}

/* ───────────── 03 · FINANCE — pilotage ───────────── */
export function FinanceScene({ bx, by }: { bx: number; by: number }) {
  const z = PZ;
  const bars = [0.5, 0.85, 0.65, 1.2, 1.55];
  return (
    <g>
      <Platform bx={bx} by={by} />
      {/* écran mural */}
      <Box x={bx + 0.25} y={by + 0.25} z={z + 0.9} w={2.5} d={0.1} h={1.4} tone="ink" />
      <QuadY x={bx + 0.35} y={by + 0.37} z={z + 1.0} w={2.3} h={1.2} fill="#161617" />
      <polyline className="spark" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" points={polyPoints([iso(bx + 0.5, by + 0.37, z + 1.15), iso(bx + 0.9, by + 0.37, z + 1.3), iso(bx + 1.3, by + 0.37, z + 1.22), iso(bx + 1.7, by + 0.37, z + 1.45), iso(bx + 2.1, by + 0.37, z + 1.38), iso(bx + 2.5, by + 0.37, z + 1.52)])} />
      <QuadY x={bx + 0.5} y={by + 0.37} z={z + 1.05} w={2.0} h={0.02} fill="#fff" opacity={0.3} />
      <Cyl x={bx + 1.5} y={by + 0.3} z={z} r={0.07} h={0.9} tone="chrome" />
      {/* colonnes chromées */}
      <Shadow x={bx + 1.7} y={by + 2.0} rx={1.7} />
      {bars.map((h, i) => (
        <g key={i} className="bar" style={{ animationDelay: `${i * 0.5}s` }}>
          <Box x={bx + 0.45 + i * 0.5} y={by + 1.6} z={z} w={0.34} d={0.34} h={h} tone={i === 4 ? 'ink' : 'chrome'} />
        </g>
      ))}
      {/* pile de pièces */}
      {[0, 1, 2, 3].map((i) => (
        <Cyl key={i} x={bx + 2.85} y={by + 2.5} z={z + i * 0.09} r={0.22} h={0.08} tone="chrome" />
      ))}
      {[0, 1].map((i) => (
        <Cyl key={i} x={bx + 2.45} y={by + 2.85} z={z + i * 0.09} r={0.22} h={0.08} tone="pearl" />
      ))}
    </g>
  );
}

/* ───────────── 04 · SHOP — boutique ───────────── */
export function ShopScene({ bx, by }: { bx: number; by: number }) {
  const z = PZ;
  return (
    <g>
      <Platform bx={bx} by={by} />
      {/* étagère */}
      <Box x={bx + 0.2} y={by + 0.2} z={z} w={0.1} d={0.5} h={2.3} tone="chrome" />
      <Box x={bx + 2.9} y={by + 0.2} z={z} w={0.1} d={0.5} h={2.3} tone="chrome" />
      <QuadY x={bx + 0.3} y={by + 0.7} z={z} w={2.6} h={2.3} fill="#101010" opacity={0.06} />
      {[0.55, 1.2, 1.85].map((sz, r) => (
        <g key={r}>
          <Box x={bx + 0.3} y={by + 0.2} z={z + sz} w={2.6} d={0.5} h={0.06} tone="pearl" />
          {Array.from({ length: 6 }, (_, i) => {
            const x = bx + 0.55 + i * 0.4;
            const tone = (i + r) % 3 === 0 ? 'ink' : (i + r) % 3 === 1 ? 'chrome' : 'pearl';
            return i % 3 === 2 ? <Box key={i} x={x - 0.12} y={by + 0.32} z={z + sz + 0.06} w={0.3} d={0.28} h={0.26} tone="shade" /> : <Cyl key={i} x={x} y={by + 0.45} z={z + sz + 0.06} r={0.1} h={0.2 + ((i + r) % 3) * 0.1} tone={tone} />;
          })}
        </g>
      ))}
      {/* présentoir sous cloche */}
      <Shadow x={bx + 1.2} y={by + 2.2} rx={0.9} />
      <Cyl x={bx + 1.2} y={by + 2.2} z={z} r={0.55} h={0.55} tone="pearl" />
      <Cyl x={bx + 1.2} y={by + 2.2} z={z + 0.55} r={0.12} h={0.4} tone="chrome" />
      <g className="float float--slow">
        <Cyl x={bx + 1.2} y={by + 2.2} z={z + 1.0} r={0.4} h={0.5} tone="glass" />
      </g>
      {/* caisse d'expédition */}
      <Box x={bx + 2.1} y={by + 2.0} z={z} w={0.9} d={0.8} h={0.55} tone="shade" />
      <Box x={bx + 2.5} y={by + 2.0} z={z} w={0.12} d={0.8} h={0.56} tone="chrome" />
      <Box x={bx + 2.3} y={by + 2.25} z={z + 0.55} w={0.5} d={0.4} h={0.3} tone="pearl" />
    </g>
  );
}

/* ───────────── 05 · BOOKING — accueil et agenda ───────────── */
export function BookingScene({ bx, by }: { bx: number; by: number }) {
  const z = PZ;
  const [cx, cy] = iso(bx + 1.6, by + 0.35, z + 2.2);
  return (
    <g>
      <Platform bx={bx} by={by} />
      {/* panneau agenda */}
      <Box x={bx + 0.35} y={by + 0.25} z={z + 0.8} w={2.2} d={0.1} h={1.5} tone="pearl" />
      {Array.from({ length: 5 }, (_, c) => (
        <QuadY key={c} x={bx + 0.5 + c * 0.4} y={by + 0.37} z={z + 0.95} w={0.32} h={0.14} fill="#101010" opacity={0.85} />
      ))}
      {Array.from({ length: 15 }, (_, i) => {
        const c = i % 5;
        const r = Math.floor(i / 5);
        const on = [1, 3, 5, 8, 12, 13].includes(i);
        return <QuadY key={i} x={bx + 0.5 + c * 0.4} y={by + 0.37} z={z + 1.2 + r * 0.17 + (r > 0 ? 0 : 0)} w={0.32} h={0.12} fill={on ? '#C0C0C0' : '#ECECEA'} className={i === 8 ? 'blink' : undefined} />;
      })}
      {/* horloge murale */}
      <g>
        <circle cx={cx + 90} cy={cy - 18} r={24} fill="#fff" stroke="url(#gRing)" strokeWidth={4} />
        <line className="hand hand--m" x1={cx + 90} y1={cy - 18} x2={cx + 90} y2={cy - 36} stroke="#101010" strokeWidth={2} strokeLinecap="round" style={{ transformOrigin: `${cx + 90}px ${cy - 18}px` }} />
        <line className="hand hand--h" x1={cx + 90} y1={cy - 18} x2={cx + 90} y2={cy - 30} stroke="#101010" strokeWidth={3} strokeLinecap="round" style={{ transformOrigin: `${cx + 90}px ${cy - 18}px` }} />
      </g>
      {/* bureau d'accueil */}
      <Shadow x={bx + 1.6} y={by + 2.2} rx={1.4} />
      <Box x={bx + 0.6} y={by + 1.7} z={z} w={2.0} d={0.9} h={0.7} tone="shade" />
      <Box x={bx + 0.55} y={by + 1.65} z={z + 0.7} w={2.1} d={1.0} h={0.07} tone="chrome" />
      <Box x={bx + 1.0} y={by + 1.95} z={z + 0.77} w={0.7} d={0.45} h={0.04} tone="ink" />
      <Box x={bx + 1.9} y={by + 1.85} z={z + 0.77} w={0.5} d={0.38} h={0.05} tone="pearl" />
      {/* lampe */}
      <Cyl x={bx + 0.8} y={by + 1.9} z={z + 0.77} r={0.12} h={0.04} tone="chrome" />
      <Cyl x={bx + 0.8} y={by + 1.9} z={z + 0.8} r={0.025} h={0.6} tone="chrome" />
      <circle className="lamp" cx={iso(bx + 0.8, by + 1.9, z + 1.45)[0]} cy={iso(bx + 0.8, by + 1.9, z + 1.45)[1]} r={26} fill="url(#gGlow)" />
      <Cyl x={bx + 0.8} y={by + 1.9} z={z + 1.35} r={0.17} h={0.12} tone="pearl" />
      {/* fauteuil */}
      <Cyl x={bx + 2.9} y={by + 2.9} z={z} r={0.3} h={0.1} tone="chrome" />
      <Cyl x={bx + 2.9} y={by + 2.9} z={z + 0.1} r={0.05} h={0.35} tone="chrome" />
      <Cyl x={bx + 2.9} y={by + 2.9} z={z + 0.45} r={0.34} h={0.12} tone="ink" />
      <Box x={bx + 2.62} y={by + 2.95} z={z + 0.55} w={0.56} d={0.1} h={0.6} tone="ink" />
    </g>
  );
}

/* ───────────── Éléments communs ───────────── */

/** Noyau LECA CORE — orbe chromé flottant au centre du QG. */
export function CoreOrb({ x, y }: { x: number; y: number }) {
  const [cx, cy] = iso(x, y, 0.2);
  return (
    <g>
      <Shadow x={x} y={y} z={0} rx={1.1} />
      <Cyl x={x} y={y} z={0} r={0.7} h={0.14} tone="chrome" />
      <Cyl x={x} y={y} z={0.14} r={0.55} h={0.05} tone="ink" />
      <g className="orb">
        <ellipse className="orb__ring" cx={cx} cy={cy - 74} rx={64} ry={20} fill="none" stroke="url(#gRing)" strokeWidth={2.5} />
        <circle cx={cx} cy={cy - 74} r={34} fill="url(#gOrb)" stroke="rgba(16,16,16,.25)" strokeWidth={0.8} />
        <ellipse cx={cx - 11} cy={cy - 87} rx={9} ry={5.5} fill="#fff" opacity={0.85} transform={`rotate(-28 ${cx - 11} ${cy - 87})`} />
        <ellipse className="orb__ring orb__ring--b" cx={cx} cy={cy - 74} rx={58} ry={17} fill="none" stroke="#101010" strokeOpacity={0.55} strokeWidth={1.4} />
      </g>
    </g>
  );
}

/** Étiquette flottante en verre — un seul sens de lecture, toujours lisible. */
export function Plaque({ x, y, n, label }: { x: number; y: number; n: string; label: ReactNode }) {
  const width = 38 + String(label).length * 9.2;
  return (
    <g className="plaque" transform={`translate(${x},${y})`}>
      <rect x={-width / 2} y={-17} width={width} height={34} rx={17} fill="rgba(255,255,255,.82)" stroke="rgba(16,16,16,.14)" />
      <circle cx={-width / 2 + 18} cy={0} r={11} fill="#101010" />
      <text x={-width / 2 + 18} y={4} textAnchor="middle" fontSize={11} fontWeight={500} fill="#fff" letterSpacing={0.4}>
        {n}
      </text>
      <text x={-width / 2 + 36} y={4.5} fontSize={12.5} fontWeight={500} fill="#101010" letterSpacing={1.5}>
        {label}
      </text>
    </g>
  );
}

export { QuadX, QuadZ };
