"use client";

import { useEffect, useRef } from "react";

/** Confettis rouges et blancs sur canvas, ~6 s puis arrêt complet (aucun coût ensuite). */
export function Confetti({ run }: { run: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!run) return;
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      c.width = innerWidth * dpr;
      c.height = innerHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);
    const colors = ["#E53935", "#F1EFE8", "#E53935", "#F1EFE8", "#777777"];
    const N = innerWidth < 500 ? 140 : 220;
    const parts = Array.from({ length: N }, (_, i) => ({
      x: (Math.random() * innerWidth) * dpr,
      y: (-Math.random() * innerHeight * 1.2 - 20) * dpr,
      w: (4 + Math.random() * 7) * dpr,
      h: (8 + Math.random() * 14) * dpr,
      vy: (2 + Math.random() * 3.5) * dpr,
      vx: (Math.random() - 0.5) * 1.6 * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      sway: Math.random() * 6.28,
      color: colors[i % colors.length],
    }));
    const start = performance.now();
    let raf = 0;
    const frame = (t: number) => {
      const el = t - start;
      ctx.clearRect(0, 0, c.width, c.height);
      let alive = 0;
      for (const p of parts) {
        p.y += p.vy;
        p.x += p.vx + Math.sin(el / 400 + p.sway) * 0.8 * dpr;
        p.rot += p.vr;
        if (p.y > c.height + 40) {
          if (el < 4500) p.y = -20 * dpr;
          else continue;
        }
        alive++;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(1, Math.cos(el / 180 + p.sway));
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive > 0) raf = requestAnimationFrame(frame);
      else ctx.clearRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [run]);
  return <canvas ref={ref} className="confetti" aria-hidden="true" />;
}
