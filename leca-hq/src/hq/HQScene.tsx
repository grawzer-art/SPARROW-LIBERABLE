import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { STATIONS, type Station, type StationId } from '../stations';
import { Box, Defs, QuadX, QuadY, SCENE, hull, iso, polyPoints } from './iso';
import { BookingScene, CoreOrb, CreativeScene, FinanceScene, PLATFORM, Plaque, ShopScene, SocialScene } from './scenery';

const FLOOR_W = 15;
const FLOOR_D = 11;
const MAX_ZOOM = 3.6;

interface Slot {
  id: StationId;
  x: number;
  y: number;
  Scene: typeof CreativeScene;
}
const SLOTS: Slot[] = [
  { id: 'creative', x: 0.8, y: 0.8, Scene: CreativeScene },
  { id: 'social', x: 5.8, y: 0.8, Scene: SocialScene },
  { id: 'finance', x: 10.8, y: 0.8, Scene: FinanceScene },
  { id: 'shop', x: 2.8, y: 6.8, Scene: ShopScene },
  { id: 'booking', x: 8.3, y: 6.8, Scene: BookingScene },
];
const CORE_POS = { x: 7.25, y: 5.6 };
// Ordre de dessin (du fond vers l'avant), le noyau s'intercale entre les rangées.
const DRAW_ORDER: Array<StationId | 'core'> = ['creative', 'social', 'finance', 'core', 'shop', 'booking'];

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface View {
  s: number;
  x: number;
  y: number;
}

export function HQScene() {
  const navigate = useNavigate();
  const wrap = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ s: 1, x: 0, y: 0 });
  const [animating, setAnimating] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);

  const viewRef = useRef(view);
  viewRef.current = view;
  const baseRef = useRef(1);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number } | null>(null);
  const panStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  /* ── Mise à l'échelle initiale ── */
  const fit = useCallback((w: number, h: number): View => {
    const portrait = w / h < 0.9;
    const base = portrait ? (h * 0.86) / SCENE.h : Math.min(w / SCENE.w, h / SCENE.h) * 0.98;
    baseRef.current = base;
    return { s: base, x: (w - SCENE.w * base) / 2, y: (h - SCENE.h * base) / 2 + (portrait ? 0 : 6) };
  }, []);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      setSize({ w, h });
      setView(fit(w, h));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit]);

  const clamp = useCallback(
    (v: View): View => {
      const s = Math.min(Math.max(v.s, baseRef.current), baseRef.current * MAX_ZOOM);
      const sw = SCENE.w * s;
      const sh = SCENE.h * s;
      const slack = 40;
      const x = sw <= size.w ? (size.w - sw) / 2 : Math.min(slack, Math.max(size.w - sw - slack, v.x));
      const y = sh <= size.h ? (size.h - sh) / 2 : Math.min(slack, Math.max(size.h - sh - slack, v.y));
      return { s, x, y };
    },
    [size],
  );

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = viewRef.current;
      const s = Math.min(Math.max(v.s * factor, baseRef.current), baseRef.current * MAX_ZOOM);
      const k = s / v.s;
      setView(clamp({ s, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }));
    },
    [clamp],
  );

  /* Molette (écouteur natif non passif pour bloquer le zoom de la page). */
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0016), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  /* ── Gestes tactiles / souris ── */
  const local = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (leaving) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 1) {
      moved.current = false;
      panStart.current = p;
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y) };
      moved.current = true;
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      if (pinch.current.dist > 0) zoomAt(dist / pinch.current.dist, (a!.x + b!.x) / 2, (a!.y + b!.y) / 2);
      pinch.current.dist = dist;
      return;
    }
    if (pointers.current.size === 1 && panStart.current) {
      if (!moved.current && Math.hypot(p.x - panStart.current.x, p.y - panStart.current.y) < 6) return;
      moved.current = true;
      const v = viewRef.current;
      setView(clamp({ ...v, x: v.x + (p.x - prev.x), y: v.y + (p.y - prev.y) }));
    }
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 0) panStart.current = null;
  };

  /* ── Entrée dans un poste : zoom puis navigation ── */
  const enter = useCallback(
    (path: string, target: [number, number]) => {
      if (moved.current || leaving) return;
      if (prefersReducedMotion()) return navigate(path);
      const s = baseRef.current * Math.min(2.4, MAX_ZOOM);
      setAnimating(true);
      setLeaving(true);
      setView(clamp({ s, x: size.w / 2 - target[0] * s, y: size.h / 2 - target[1] * s }));
      window.setTimeout(() => navigate(path), 520);
    },
    [clamp, leaving, navigate, size],
  );

  const stationById = useMemo(() => new Map<string, Station>(STATIONS.map((s) => [s.id, s])), []);

  const reset = () => {
    setAnimating(true);
    setView(fit(size.w, size.h));
    window.setTimeout(() => setAnimating(false), 450);
  };
  const zoomBtn = (f: number) => {
    setAnimating(true);
    zoomAt(f, size.w / 2, size.h / 2);
    window.setTimeout(() => setAnimating(false), 450);
  };

  const zoomed = view.s > baseRef.current * 1.02;

  return (
    <div
      ref={wrap}
      className={`scene${leaving ? ' scene--leaving' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      data-zoomed={zoomed}
    >
      <div
        className={`stage${animating ? ' stage--anim' : ''}`}
        style={{ width: SCENE.w, height: SCENE.h, transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})` }}
      >
        <svg viewBox={`0 0 ${SCENE.w} ${SCENE.h}`} width={SCENE.w} height={SCENE.h} role="group" aria-label="Le QG de LECA : cinq postes de travail et le noyau LECA CORE" className="hq">
          <Defs />
          <Room />
          {DRAW_ORDER.map((key) => {
            if (key === 'core') {
              const c = iso(CORE_POS.x, CORE_POS.y, 1.3);
              return (
                <g
                  key="core"
                  className={`st st--core${hovered === 'core' ? ' is-hover' : ''}`}
                  tabIndex={0}
                  role="link"
                  aria-label="LECA CORE — assistant central"
                  onPointerEnter={() => setHovered('core')}
                  onPointerLeave={() => setHovered(null)}
                  onClick={() => enter('/core', c)}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), navigate('/core'))}
                >
                  <g className="st__body">
                    <CoreOrb x={CORE_POS.x} y={CORE_POS.y} />
                  </g>
                  <circle cx={c[0]} cy={c[1] - 30} r={78} fill="transparent" />
                  <circle className="st__ring" cx={c[0]} cy={c[1] - 30} r={80} fill="none" />
                </g>
              );
            }
            const slot = SLOTS.find((s) => s.id === key)!;
            const st = stationById.get(slot.id)!;
            const corners = [0, PLATFORM].flatMap((dx) => [0, PLATFORM].flatMap((dy) => [iso(slot.x + dx, slot.y + dy, 0), iso(slot.x + dx, slot.y + dy, 2.7)])) as [number, number][];
            const outline = hull(corners);
            const center = iso(slot.x + PLATFORM / 2, slot.y + PLATFORM / 2, 1);
            const Scene = slot.Scene;
            return (
              <g
                key={slot.id}
                className={`st${hovered === slot.id ? ' is-hover' : ''}`}
                tabIndex={0}
                role="link"
                aria-label={`${st.number} ${st.name} — ${st.tagline}`}
                onPointerEnter={() => setHovered(slot.id)}
                onPointerLeave={() => setHovered(null)}
                onClick={() => enter(st.path, center)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), navigate(st.path))}
              >
                <g className="st__body">
                  <Scene bx={slot.x} by={slot.y} />
                </g>
                <polygon points={polyPoints(outline)} fill="transparent" />
                <polygon className="st__ring" points={polyPoints(outline)} fill="none" />
              </g>
            );
          })}
          <g pointerEvents="none">
            {SLOTS.map((slot) => {
              const st = stationById.get(slot.id)!;
              const c = iso(slot.x + PLATFORM / 2, slot.y + PLATFORM / 2, 0);
              const top = iso(slot.x, slot.y, 2.7)[1];
              // rangée du fond : étiquette au-dessus ; rangée avant : devant la plateforme
              const front = slot.y > 5;
              const py = front ? iso(slot.x + PLATFORM / 2, slot.y + PLATFORM + 0.55, 0)[1] : Math.min(top, c[1] - 110) - 4;
              return (
                <g key={slot.id} className={`plaque-lift${hovered === slot.id ? ' is-hover' : ''}`}>
                  <Plaque x={front ? iso(slot.x + PLATFORM / 2, slot.y + PLATFORM + 0.55, 0)[0] : c[0]} y={py} n={st.number.slice(1)} label={st.name.replace('LECA ', '')} />
                </g>
              );
            })}
            <g className={`plaque-lift${hovered === 'core' ? ' is-hover' : ''}`}>
              <Plaque x={iso(CORE_POS.x, CORE_POS.y, 1.3)[0]} y={iso(CORE_POS.x, CORE_POS.y, 1.3)[1] - 72} n="C" label="CORE" />
            </g>
          </g>
          <Sparkles />
        </svg>
      </div>

      <div className="scene__veil" aria-hidden />
      <div className="zoomctl" role="group" aria-label="Zoom de la scène">
        <button className="iconbtn iconbtn--glass" aria-label="Zoomer" onClick={() => zoomBtn(1.5)}>
          +
        </button>
        <button className="iconbtn iconbtn--glass" aria-label="Dézoomer" onClick={() => zoomBtn(1 / 1.5)} disabled={!zoomed}>
          −
        </button>
        <button className="iconbtn iconbtn--glass" aria-label="Recentrer la vue" onClick={reset} disabled={!zoomed}>
          ⌖
        </button>
      </div>
    </div>
  );
}

/* ───────── Architecture de la pièce ───────── */
function Room() {
  const W = FLOOR_W;
  const D = FLOOR_D;
  const H = 5.2;
  const mullionsX = [0, 3, 6, 9, 12, 15];
  const mullionsY = [0, 2.75, 5.5, 8.25, 11];
  return (
    <g>
      <ellipse cx={iso(W / 2, D / 2, -0.6)[0]} cy={iso(W / 2, D / 2, -0.6)[1] + 40} rx={560} ry={290} fill="url(#gShadow)" opacity={0.55} />
      {/* parois de verre au fond */}
      <QuadY x={0} y={0} z={0} w={W} h={H} fill="url(#gWall)" />
      <QuadX x={0} y={0} z={0} d={D} h={H} fill="url(#gWallR)" />
      <g className="beams" aria-hidden>
        <polygon points={polyPoints([iso(1.5, 0, 0.2), iso(3.2, 0, 0.2), iso(5.2, 0, 4.8), iso(3.5, 0, 4.8)])} fill="url(#gSheenBeam)" opacity={0.55} />
        <polygon points={polyPoints([iso(8.4, 0, 0.2), iso(9.4, 0, 0.2), iso(10.9, 0, 4.8), iso(9.9, 0, 4.8)])} fill="url(#gSheenBeam)" opacity={0.4} className="beam--b" />
        <polygon points={polyPoints([iso(0, 1.5, 0.2), iso(0, 2.6, 0.2), iso(0, 4.6, 4.8), iso(0, 3.5, 4.8)])} fill="url(#gSheenBeam)" opacity={0.45} className="beam--c" />
      </g>
      {mullionsX.map((x) => (
        <Box key={`mx${x}`} x={x - 0.05} y={-0.05} w={0.1} d={0.1} h={H} tone="chrome" />
      ))}
      {mullionsY.slice(1).map((y) => (
        <Box key={`my${y}`} x={-0.05} y={y - 0.05} w={0.1} d={0.1} h={H} tone="chrome" />
      ))}
      <Box x={-0.05} y={-0.05} z={H} w={W + 0.1} d={0.1} h={0.1} tone="chrome" />
      <Box x={-0.05} y={-0.05} z={H} w={0.1} d={D + 0.1} h={0.1} tone="chrome" />
      {/* dalle de sol */}
      <Box x={0} y={0} z={-0.55} w={W} d={D} h={0.55} tone="pearl" />
      <Box x={-0.08} y={-0.08} z={-0.12} w={W + 0.16} d={D + 0.16} h={0.12} tone="chrome" />
      <polygon points={polyPoints([iso(0, 0, 0), iso(W, 0, 0), iso(W, D, 0), iso(0, D, 0)])} fill="url(#gFloor)" />
      <g stroke="rgba(16,16,16,.06)" strokeWidth={1} fill="none">
        {Array.from({ length: W + 1 }, (_, i) => (
          <polyline key={`gx${i}`} points={polyPoints([iso(i, 0, 0), iso(i, D, 0)])} />
        ))}
        {Array.from({ length: D + 1 }, (_, i) => (
          <polyline key={`gy${i}`} points={polyPoints([iso(0, i, 0), iso(W, i, 0)])} />
        ))}
      </g>
      {/* incrustation circulaire autour du noyau */}
      <ellipse cx={iso(CORE_POS.x, CORE_POS.y, 0)[0]} cy={iso(CORE_POS.x, CORE_POS.y, 0)[1]} rx={150} ry={86} fill="none" stroke="url(#gRing)" strokeWidth={3} opacity={0.8} />
      <ellipse cx={iso(CORE_POS.x, CORE_POS.y, 0)[0]} cy={iso(CORE_POS.x, CORE_POS.y, 0)[1]} rx={196} ry={113} fill="none" stroke="rgba(16,16,16,.12)" strokeDasharray="3 7" />
    </g>
  );
}

/** Particules lumineuses très discrètes. */
function Sparkles() {
  const spots: [number, number, number][] = [
    [140, 330, 0],
    [330, 200, 1.2],
    [520, 150, 0.6],
    [760, 190, 1.8],
    [930, 300, 0.3],
    [700, 560, 2.2],
    [260, 560, 1.5],
    [560, 700, 0.9],
  ];
  return (
    <g aria-hidden pointerEvents="none">
      {spots.map(([x, y, d], i) => (
        <g key={i} className="twinkle" style={{ animationDelay: `${d}s` }}>
          <path d={`M${x},${y - 7} L${x + 1.6},${y - 1.6} L${x + 7},${y} L${x + 1.6},${y + 1.6} L${x},${y + 7} L${x - 1.6},${y + 1.6} L${x - 7},${y} L${x - 1.6},${y - 1.6} Z`} fill="#fff" stroke="rgba(16,16,16,.15)" strokeWidth={0.5} />
        </g>
      ))}
    </g>
  );
}
