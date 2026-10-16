"use client";

import { useEffect, useRef } from "react";
import { bake, heroFrames, spriteSize, type Skin } from "./sprites";

/** Aperçu animé du héros en pixel art (course sur place). */
export function SpritePreview({ skin, scale = 4 }: { skin: Skin; scale?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const f = heroFrames(skin);
  const { w, h } = spriteSize(f.runA);

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const frames = [bake(f.runA), bake(f.runB)];
    let i = 0;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(frames[i % 2], 0, 0);
      i++;
    };
    draw();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const t = setInterval(draw, 160);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skin]);

  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className="sprite-preview"
      style={{ width: w * scale, height: h * scale }}
      aria-hidden="true"
    />
  );
}
