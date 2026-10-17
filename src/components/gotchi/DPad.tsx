"use client";

import { useRef, useState } from "react";

export type Dir = "up" | "down" | "left" | "right";

interface Props {
  /** Direction continue (8 directions, -1..1) ; (0, 0) au relâchement. */
  onMove: (x: number, y: number) => void;
  /** Appui « pas à pas » (menus) : au premier appui puis en répétition. */
  onStep?: (d: Dir) => void;
}

const DEAD = 12;

/** Croix directionnelle façon console : on pose le pouce et on glisse (8 directions). */
export function DPad({ onMove, onStep }: Props) {
  const zone = useRef<HTMLDivElement>(null);
  const active = useRef<number | null>(null);
  const repeat = useRef<ReturnType<typeof setInterval>>(undefined);
  const lastDir = useRef<Dir | null>(null);
  const [lit, setLit] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const set = (cx: number, cy: number) => {
    const r = zone.current!.getBoundingClientRect();
    const dx = cx - (r.left + r.width / 2);
    const dy = cy - (r.top + r.height / 2);
    let x = 0;
    let y = 0;
    if (Math.hypot(dx, dy) > DEAD) {
      const a = Math.atan2(dy, dx);
      const oct = Math.round(a / (Math.PI / 4));
      x = Math.round(Math.cos(oct * (Math.PI / 4)));
      y = Math.round(Math.sin(oct * (Math.PI / 4)));
    }
    setLit((p) => (p.x === x && p.y === y ? p : { x, y }));
    const n = Math.hypot(x, y) || 1;
    onMove(x / n, y / n);
    const d: Dir | null = Math.abs(dx) > Math.abs(dy) ? (dx > DEAD ? "right" : dx < -DEAD ? "left" : null) : dy > DEAD ? "down" : dy < -DEAD ? "up" : null;
    if (d !== lastDir.current) {
      lastDir.current = d;
      clearInterval(repeat.current);
      if (d && onStep) {
        onStep(d);
        repeat.current = setInterval(() => onStep(d), 190);
      }
    }
  };

  const end = (e: React.PointerEvent) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    lastDir.current = null;
    clearInterval(repeat.current);
    setLit({ x: 0, y: 0 });
    onMove(0, 0);
  };

  return (
    <div
      ref={zone}
      className="gb-dpad"
      onPointerDown={(e) => {
        if (active.current !== null) return;
        active.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => active.current === e.pointerId && set(e.clientX, e.clientY)}
      onPointerUp={end}
      onPointerCancel={end}
      role="application"
      aria-label="Croix directionnelle : glisse le pouce pour déplacer Sparrow"
    >
      <span className="gb-dpad__v" aria-hidden="true" />
      <span className="gb-dpad__h" aria-hidden="true" />
      <i className={`gb-dpad__arm gb-dpad__arm--up${lit.y < 0 ? " on" : ""}`} aria-hidden="true" />
      <i className={`gb-dpad__arm gb-dpad__arm--down${lit.y > 0 ? " on" : ""}`} aria-hidden="true" />
      <i className={`gb-dpad__arm gb-dpad__arm--left${lit.x < 0 ? " on" : ""}`} aria-hidden="true" />
      <i className={`gb-dpad__arm gb-dpad__arm--right${lit.x > 0 ? " on" : ""}`} aria-hidden="true" />
      <span className="gb-dpad__hub" aria-hidden="true" />
    </div>
  );
}
