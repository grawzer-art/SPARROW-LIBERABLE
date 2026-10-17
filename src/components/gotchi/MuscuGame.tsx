"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MuscuResult } from "@/lib/gotchi/engine";
import { MAX_FAILS, MUSCU_DUR, newMuscu, press, stepMuscu, type Muscu } from "@/lib/gotchi/muscu";
import { bake } from "../game/sprites";
import type { Chiptune } from "../game/audio";
import { drawRoom } from "./decor";
import { sparrow, type Look } from "./sprites";

export interface MuscuSummary {
  coins: number;
  xp: number;
  gained: number;
  stageUp: string | null;
  record: boolean;
  notes: string[];
}

interface Props {
  audio: Chiptune;
  best: number;
  look: Look;
  tier: number;
  reduced: boolean;
  onFinish: (r: MuscuResult) => MuscuSummary;
  onClose: () => void;
  /** Texte du bouton de sortie (le mini-jeu sert aussi d'épreuve dans le RPG). */
  exitLabel?: string;
}

const W = 160;
const H = 144;
const BAR = { x: 16, y: 122, w: 128, h: 10 };

/** Séance de muscu : appuyer quand le curseur est dans la zone (combo → zone plus étroite). */
export function MuscuGame({ audio, best, look, tier, reduced, onFinish, onClose, exitLabel = "Retour à l'appart" }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const game = useRef<Muscu>(newMuscu());
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const [hud, setHud] = useState({ t: MUSCU_DUR, reps: 0, combo: 0, fails: 0 });
  const [pop, setPop] = useState<{ txt: string; k: number } | null>(null);
  const [summary, setSummary] = useState<{ r: MuscuResult; s: MuscuSummary } | null>(null);
  const finish = useRef(onFinish);
  useEffect(() => {
    finish.current = onFinish;
  }, [onFinish]);

  const sprites = useRef<Record<string, HTMLCanvasElement>>({});
  const spr = (k: string, rows: () => string[]) => (sprites.current[k] ??= bake(rows()));

  useEffect(() => {
    if (phase !== "play") return;
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    let hudT = 0;
    const loop = (n: number) => {
      const el = Math.min(1000, n - last);
      last = n;
      let g = game.current;
      for (let dt = el; dt > 0 && !g.over; dt -= 33) g = stepMuscu(g, Math.min(33, dt));
      game.current = g;
      draw(ctx, g, n / 1000);
      hudT += el;
      if (hudT > 100) {
        hudT = 0;
        setHud({ t: Math.max(0, MUSCU_DUR - g.t), reps: g.reps, combo: g.combo, fails: g.fails });
      }
      if (g.over) {
        const r: MuscuResult = { reps: g.reps, perfects: g.perfects, bestCombo: g.bestCombo, crampe: g.fails >= MAX_FAILS };
        setSummary({ r, s: finish.current(r) });
        setPhase("end");
        if (r.crampe) audio.over();
        else audio.win();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, audio, reduced]);

  function draw(ctx: CanvasRenderingContext2D, g: Muscu, t: number) {
    ctx.imageSmoothingEnabled = false;
    // Position du curseur exposée pour les tests automatisés
    ctx.canvas.dataset.cur = g.cur.toFixed(3);
    ctx.canvas.dataset.zone = `${g.zone.toFixed(3)}:${g.half.toFixed(3)}`;
    drawRoom(ctx, "muscu", { t, hour: 12, deco: new Set(), tiers: { pc: 1, lit: 1, sport: tier, canape: 1 }, pcBroken: false, using: "banc" });
    // Sparrow de face, barre au-dessus de la tête
    const strain = g.lift > 0.5 ? "ouverte" : "neutre";
    const eyes = g.last?.kind === "rate" && g.t - g.last.at < 500 ? "grands" : g.lift > 0.5 ? "focus" : "lunettes";
    const key = `m:${eyes}:${strain}:${look.lunettes}:${look.tenue}:${look.muscle}`;
    const body = spr(key, () => sparrow(eyes, strain, "normal", "stand", look));
    const sx = 72;
    const sy = 72;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(sx + 2, sy + 19, 12, 2);
    ctx.drawImage(body, sx, sy);
    // Barre au niveau des épaules au repos, au-dessus de la tête quand il pousse.
    const by = sy + 13 - Math.round(g.lift * 18);
    ctx.fillStyle = "#e9b18a"; // bras
    ctx.fillRect(sx, Math.min(by + 2, sy + 12), 2, Math.abs(sy + 13 - by) + 1);
    ctx.fillRect(sx + 14, Math.min(by + 2, sy + 12), 2, Math.abs(sy + 13 - by) + 1);
    ctx.fillStyle = "#777777";
    ctx.fillRect(sx - 14, by, 44, 2);
    const plate = tier >= 2 ? "#f2c14e" : "#3b3b3b";
    ctx.fillStyle = plate;
    ctx.fillRect(sx - 16, by - 4, 4, 10);
    ctx.fillRect(sx + 28, by - 4, 4, 10);
    if (g.last && g.t - g.last.at < 300 && g.last.kind !== "rate" && !reduced) {
      ctx.fillStyle = "rgba(242,193,78,0.6)";
      ctx.fillRect(sx - 4, by - 8, 24, 2);
    }
    // Jauge de force
    ctx.fillStyle = "#090909";
    ctx.fillRect(BAR.x - 2, BAR.y - 2, BAR.w + 4, BAR.h + 4);
    ctx.fillStyle = "#262626";
    ctx.fillRect(BAR.x, BAR.y, BAR.w, BAR.h);
    const zx = BAR.x + (g.zone - g.half) * BAR.w;
    ctx.fillStyle = "#4e8a33";
    ctx.fillRect(Math.round(zx), BAR.y, Math.round(g.half * 2 * BAR.w), BAR.h);
    ctx.fillStyle = "#6fae4b";
    ctx.fillRect(Math.round(BAR.x + (g.zone - g.half * 0.3) * BAR.w), BAR.y, Math.max(2, Math.round(g.half * 0.6 * BAR.w)), BAR.h);
    ctx.fillStyle = "#f1efe8";
    ctx.fillRect(Math.round(BAR.x + g.cur * BAR.w) - 1, BAR.y - 3, 3, BAR.h + 6);
    // Temps restant
    ctx.fillStyle = "#e53935";
    ctx.fillRect(BAR.x, BAR.y + BAR.h + 4, Math.round((BAR.w * Math.max(0, MUSCU_DUR - g.t)) / MUSCU_DUR), 2);
  }

  const push = useCallback(() => {
    if (phase !== "play") return;
    const r = press(game.current);
    game.current = r.m;
    setPop({ txt: r.kind === "parfait" ? "PARFAIT !" : r.kind === "ok" ? "REP !" : "RATÉ", k: performance.now() });
    if (r.kind === "parfait") audio.power();
    else if (r.kind === "ok") audio.coin();
    else audio.hit();
    navigator.vibrate?.(r.kind === "rate" ? [40, 30, 40] : 15);
  }, [phase, audio]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        push();
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [push]);

  const start = () => {
    game.current = newMuscu();
    setHud({ t: MUSCU_DUR, reps: 0, combo: 0, fails: 0 });
    setPop(null);
    setPhase("play");
  };

  return (
    <div className="gt-farm gt-muscu" role="dialog" aria-modal="true" aria-label="Séance de muscu">
      <div className="gt-farm__hud mono">
        <span>⏱ {Math.ceil(hud.t / 1000)} s</span>
        <span>{hud.reps} reps</span>
        <span className={hud.combo > 2 ? "is-hot" : ""}>×{hud.combo}</span>
        <span aria-label={`${MAX_FAILS - hud.fails} essais restants`}>{"●".repeat(MAX_FAILS - hud.fails)}{"○".repeat(hud.fails)}</span>
      </div>
      <div className="gt-muscu__stage">
        <canvas ref={canvas} width={W} height={H} className="gt-farm__canvas" onPointerDown={push} aria-label="Banc de muscu : appuie au bon moment" />
        {pop && phase === "play" && (
          <span key={pop.k} className={`gt-muscu__pop mono${pop.txt === "RATÉ" ? " is-miss" : ""}`}>
            {pop.txt}
          </span>
        )}
      </div>
      {phase === "play" && (
        <button type="button" className="gt-muscu__push mono" onPointerDown={(e) => (e.preventDefault(), push())}>
          POUSSER !
        </button>
      )}
      {phase === "intro" && (
        <div className="gt-farm__panel">
          <p className="gt-farm__title">SÉANCE DE MUSCU</p>
          <ul className="mono">
            <li>Appuie quand le curseur blanc est dans la zone verte : une répétition.</li>
            <li>Au centre : PARFAIT. Le combo monte, la zone rétrécit.</li>
            <li>3 ratés = crampe. Chaque rep fait grossir les muscles de Sparrow.</li>
          </ul>
          <p className="mono gt-farm__best">Record : {best} pts · 25 s</p>
          <button type="button" className="btn btn--sm" onClick={start}>
            C&apos;est parti
          </button>
          <button type="button" className="gt-farm__quit mono" onClick={onClose}>
            {exitLabel}
          </button>
        </div>
      )}
      {phase === "end" && summary && (
        <div className="gt-farm__panel">
          <p className="gt-farm__title">{summary.r.crampe ? "CRAMPE !" : summary.s.record ? "NOUVEAU RECORD !" : "SÉANCE TERMINÉE"}</p>
          <p className="gt-farm__score">{summary.r.reps} reps</p>
          <p className="mono">
            {summary.r.perfects} parfaits · combo max ×{summary.r.bestCombo}
          </p>
          <p className="mono gt-farm__gain">
            +{summary.s.gained} muscle · +{summary.s.coins} FP · +{summary.s.xp} XP
          </p>
          {summary.s.stageUp && <p className="gt-farm__drop mono">ÉVOLUTION : {summary.s.stageUp}</p>}
          {summary.s.notes.map((n) => (
            <p key={n} className="mono gt-farm__note">
              {n}
            </p>
          ))}
          <button type="button" className="btn btn--sm" onClick={onClose}>
            {exitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
