"use client";

import { useEffect, useRef, useState } from "react";
import { FARM_DUR, FARM_H, FARM_PV, FARM_W, newFarm, step, tap, type Farm } from "@/lib/gotchi/farm";
import type { FarmResult } from "@/lib/gotchi/engine";
import { bake } from "../game/sprites";
import type { Chiptune } from "../game/audio";
import { FARM_SPRITES } from "./sprites";

const cache = new Map<string, HTMLCanvasElement>();
const spr = (k: string) => {
  let c = cache.get(k);
  if (!c) {
    c = bake(FARM_SPRITES[k]);
    cache.set(k, c);
  }
  return c;
};

export interface FarmSummary {
  coins: number;
  xp: number;
  drop: string | null;
  record: boolean;
  notes: string[];
}

interface Props {
  audio: Chiptune;
  best: number;
  reduced: boolean;
  /** Appelé à la fin de la session ; renvoie les récompenses à afficher. */
  onFinish: (r: FarmResult) => FarmSummary;
  onClose: () => void;
}

/** Session de farm (20 à 40 s) jouée au doigt, ouverte depuis le PC de Sparrow. */
export function FarmGame({ audio, best, reduced, onFinish, onClose }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const farm = useRef<Farm>(newFarm());
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [hud, setHud] = useState({ t: FARM_DUR, score: 0, combo: 1, pv: FARM_PV });
  const [summary, setSummary] = useState<{ r: FarmResult; s: FarmSummary } | null>(null);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (phase !== "play") return;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!cv || !ctx) return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    const loop = (n: number) => {
      // Pas fixes de 50 ms max : le chrono suit le temps réel même si l'écran rame.
      const elapsed = Math.min(1000, n - last);
      let dt = elapsed;
      last = n;
      const before = farm.current;
      let f = before;
      while (dt > 0 && !f.over) {
        f = step(f, Math.min(50, dt));
        dt -= 50;
      }
      if (f.pv < before.pv) {
        audio.hit();
        navigator.vibrate?.(60);
      }
      farm.current = f;
      draw(ctx, f, n / 1000, reduced);
      hudT += elapsed;
      if (hudT > 100) {
        hudT = 0;
        setHud({ t: Math.max(0, FARM_DUR - f.t), score: f.score, combo: f.combo, pv: f.pv });
      }
      if (f.over) {
        const r = { score: f.score, monsters: f.monsters, resources: f.resources, egg: f.egg };
        const s = finish.current(r);
        setSummary({ r, s });
        setPhase("end");
        if (s.drop) audio.win();
        else audio.over();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, audio, reduced]);

  const onPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (phase !== "play") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * FARM_W;
    const y = ((e.clientY - rect.top) / rect.height) * FARM_H;
    const r = tap(farm.current, x, y);
    farm.current = r.farm;
    if (r.hit === "oeuf") audio.win();
    else if (r.killed) audio.coin();
    else if (r.hit) audio.jump(false);
    if (r.hit) navigator.vibrate?.(r.killed ? 18 : 8);
  };

  const start = () => {
    farm.current = newFarm();
    setHud({ t: FARM_DUR, score: 0, combo: 1, pv: FARM_PV });
    setSummary(null);
    setPhase("play");
  };

  return (
    <div className="gt-farm" role="dialog" aria-modal="true" aria-label="Session de farm">
      <div className="gt-farm__hud mono">
        <span>⏱ {Math.ceil(hud.t / 1000)} s</span>
        <span>{hud.score} pts</span>
        <span className={hud.combo > 1 ? "is-hot" : ""}>×{hud.combo}</span>
        <span aria-label={`${hud.pv} points de vie`}>{"♥".repeat(Math.max(0, hud.pv))}{"♡".repeat(FARM_PV - Math.max(0, hud.pv))}</span>
      </div>
      <canvas
        ref={canvas}
        width={FARM_W}
        height={FARM_H}
        className="gt-farm__canvas"
        onPointerDown={onPointer}
        aria-label="Terrain de farm : touche les ressources et les monstres"
      />
      {phase === "intro" && (
        <div className="gt-farm__panel">
          <p className="gt-farm__title">SESSION DE FARM</p>
          <ul className="mono">
            <li>Touche les ressources (épi, minerai, bûche) avant qu&apos;elles disparaissent.</li>
            <li>Touche plusieurs fois les monstres avant qu&apos;ils n&apos;attaquent (−1 ♥).</li>
            <li>Enchaîne pour le combo ×5. Un œuf doré très rare peut apparaître…</li>
          </ul>
          <p className="mono gt-farm__best">Record : {best} pts · 30 s</p>
          <button type="button" className="btn btn--sm" onClick={start}>
            Lancer la session
          </button>
          <button type="button" className="gt-farm__quit mono" onClick={onClose}>
            Retour à l&apos;appart
          </button>
        </div>
      )}
      {phase === "end" && summary && (
        <div className="gt-farm__panel">
          <p className="gt-farm__title">{summary.s.record ? "NOUVEAU RECORD !" : "FIN DE SESSION"}</p>
          <p className="gt-farm__score">{summary.r.score} pts</p>
          <p className="mono">
            {summary.r.monsters} monstres · {summary.r.resources} ressources
          </p>
          <p className="mono gt-farm__gain">
            +{summary.s.coins} FP · +{summary.s.xp} XP
          </p>
          {summary.s.drop && <p className="gt-farm__drop mono">DROP RARE : {summary.s.drop}</p>}
          {summary.s.notes.map((n) => (
            <p key={n} className="mono gt-farm__note">
              {n}
            </p>
          ))}
          <button type="button" className="btn btn--sm" onClick={onClose}>
            Retour à l&apos;appart
          </button>
        </div>
      )}
    </div>
  );
}

function draw(ctx: CanvasRenderingContext2D, f: Farm, t: number, reduced: boolean) {
  ctx.imageSmoothingEnabled = false;
  // Prairie inventée
  ctx.fillStyle = "#1f2a1c";
  ctx.fillRect(0, 0, FARM_W, FARM_H);
  ctx.fillStyle = "#26331f";
  for (let y = 0; y < FARM_H; y += 8) for (let x = (y / 8) % 2 ? 0 : 4; x < FARM_W; x += 8) ctx.fillRect(x, y, 2, 1);
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, FARM_W, 3);
  ctx.fillStyle = "#e53935";
  ctx.fillRect(0, 0, (FARM_W * Math.max(0, FARM_DUR - f.t)) / FARM_DUR, 3);
  for (const e of f.ents) {
    const c = spr(e.kind);
    const blink = e.hit < 120;
    const leaving = e.ttl - e.age < 700 && Math.floor(t * 10) % 2 === 0;
    if (leaving && !reduced) ctx.globalAlpha = 0.5;
    const jx = blink && !reduced ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
    ctx.drawImage(c, Math.round(e.x - c.width / 2 + jx), Math.round(e.y - c.height / 2));
    ctx.globalAlpha = 1;
    if (e.maxHp > 1) {
      ctx.fillStyle = "#090909";
      ctx.fillRect(Math.round(e.x - 5), Math.round(e.y - c.height / 2 - 3), 10, 2);
      ctx.fillStyle = "#e53935";
      ctx.fillRect(Math.round(e.x - 5), Math.round(e.y - c.height / 2 - 3), Math.round((10 * e.hp) / e.maxHp), 2);
    }
    if (e.kind === "oeuf" && Math.floor(t * 6) % 2) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(Math.round(e.x + 4), Math.round(e.y - 6), 1, 1);
    }
  }
  ctx.font = "6px monospace";
  ctx.textAlign = "center";
  for (const x of f.floats) {
    ctx.fillStyle = x.txt === "AÏE" ? "#e53935" : "#f2c14e";
    ctx.fillText(x.txt, Math.round(x.x), Math.round(x.y - x.age / 60));
  }
  ctx.textAlign = "left";
  if (f.hurt > 0 && !reduced) {
    ctx.fillStyle = `rgba(229,57,53,${f.hurt / 1500})`;
    ctx.fillRect(0, 0, FARM_W, FARM_H);
  }
}
