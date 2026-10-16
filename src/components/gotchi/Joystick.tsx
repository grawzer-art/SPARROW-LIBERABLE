"use client";

import { useRef, useState } from "react";

interface Props {
  /** Reçoit la direction (-1..1) ; (0, 0) au relâchement. */
  onMove: (x: number, y: number) => void;
}

const R = 42; // course du stick (px)

/** Joystick virtuel : on pose le pouce n'importe où dans la zone, puis on glisse. */
export function Joystick({ onMove }: Props) {
  const zone = useRef<HTMLDivElement>(null);
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0, on: false });

  const update = (cx: number, cy: number) => {
    const o = origin.current;
    if (!o) return;
    let dx = cx - o.x;
    let dy = cy - o.y;
    const d = Math.hypot(dx, dy);
    if (d > R) {
      dx = (dx / d) * R;
      dy = (dy / d) * R;
    }
    setKnob({ x: dx, y: dy, on: true });
    onMove(dx / R, dy / R);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (origin.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const r = zone.current!.getBoundingClientRect();
    // Le centre du stick est le centre de la zone : un appui décalé fait déjà avancer.
    origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId };
    update(e.clientX, e.clientY);
  };
  const moveP = (e: React.PointerEvent<HTMLDivElement>) => {
    if (origin.current?.id === e.pointerId) update(e.clientX, e.clientY);
  };
  const up = (e: React.PointerEvent<HTMLDivElement>) => {
    if (origin.current?.id !== e.pointerId) return;
    origin.current = null;
    setKnob({ x: 0, y: 0, on: false });
    onMove(0, 0);
  };

  return (
    <div
      ref={zone}
      className={`gt-joy${knob.on ? " is-on" : ""}`}
      onPointerDown={down}
      onPointerMove={moveP}
      onPointerUp={up}
      onPointerCancel={up}
      role="application"
      aria-label="Joystick : glisse le pouce pour déplacer Sparrow"
    >
      <span className="gt-joy__ring" aria-hidden="true" />
      <span className="gt-joy__knob" aria-hidden="true" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
    </div>
  );
}
