"use client";

/**
 * RPG — mini-jeu « Le Mix de Pokeyz » (chapitre 4). Des notes descendent : A quand elles
 * touchent la ligne. Pokeyz casse la boucle du Métronome avec des contretemps et un drop.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { BEAT, CHART, DURATION, OBJECTIF_RYTHME, hit, hitRatio, newRythme, stepRythme, type Judge, type Rythme } from "@/lib/rpg/rythme";
import type { Chiptune } from "../game/audio";
import type { PadHandler } from "./BattleScreen";

const W = 240;
const SPEED = 0.09; // px de jeu par ms
const LABEL: Record<Judge, string> = { parfait: "PARFAIT !", bien: "BIEN", rate: "RATÉ" };

export function RythmeGame({ height, audio, reduced, pad, onEnd }: { height: number; audio: Chiptune; reduced: boolean; pad: MutableRefObject<PadHandler | null>; onEnd: (ok: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const g = useRef<Rythme>(newRythme());
  const [phase, setPhase] = useState<"intro" | "play" | "end">("intro");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [hud, setHud] = useState({ combo: 0, ratio: 0, last: null as Judge | null });
  const beatNo = useRef(-1);

  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === "intro") {
      g.current = newRythme();
      setPhase("play");
      return;
    }
    if (p === "end") return onEnd(hitRatio(g.current.results) >= OBJECTIF_RYTHME);
    const r = hit(g.current);
    g.current = r.g;
    if (r.judge === "parfait") audio.coin();
    else if (r.judge === "bien") audio.select();
    else if (r.judge === "rate") audio.miss();
    if (r.judge && r.judge !== "rate") navigator.vibrate?.(10);
  }, [audio, onEnd]);

  useEffect(() => {
    pad.current = { a: press, b: () => phaseRef.current === "end" && onEnd(hitRatio(g.current.results) >= OBJECTIF_RYTHME), dir: () => {} };
    return () => {
      pad.current = null;
    };
  }, [onEnd, pad, press]);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(50, now - prev);
      prev = now;
      if (phaseRef.current === "play") {
        g.current = stepRythme(g.current, dt);
        // Métronome de fond : un petit tic à chaque temps
        const b = Math.floor((g.current.t - 2000) / BEAT);
        if (b !== beatNo.current && b >= 0) {
          beatNo.current = b;
          audio.charge();
        }
        if (g.current.over) setPhase("end");
        setHud((h) => {
          const n = { combo: g.current.combo, ratio: hitRatio(g.current.results), last: g.current.last?.judge ?? null };
          return h.combo === n.combo && h.ratio === n.ratio && h.last === n.last ? h : n;
        });
        if (canvas.current) canvas.current.dataset.next = String(CHART[g.current.next] - g.current.t);
      }
      const H = height;
      const lineY = H - 120;
      const cx = W / 2;
      const t = g.current.t;
      const f = (c: string, x: number, y: number, w = 1, h = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
      };
      ctx.imageSmoothingEnabled = false;
      // Fond : scène du festival, la nuit
      f("#0c0a22", 0, 0, W, H);
      for (let i = 0; i < 40; i++) f("#2a2050", (i * 53) % W, (i * 97) % (H - 140), 1, 1);
      const pulse = reduced ? 0 : Math.max(0, 1 - (((t - 2000) % BEAT) + BEAT) % BEAT / 200);
      f(`rgba(166,108,255,${0.15 + pulse * 0.25})`, 0, lineY - 6, W, 12);
      // Couloir
      f("#1a1430", cx - 28, 0, 56, H);
      f("#3a2a6a", cx - 29, 0, 1, H);
      f("#3a2a6a", cx + 28, 0, 1, H);
      // Ligne de frappe
      f("#f8f4e8", cx - 30, lineY, 60, 2);
      // Notes (vinyles)
      for (let i = g.current.next; i < CHART.length; i++) {
        const y = lineY - (CHART[i] - t) * SPEED;
        if (y < -12) break;
        f("#1b1626", cx - 11, y - 11, 22, 22);
        f("#2a2a32", cx - 10, y - 10, 20, 20);
        f(i % 4 === 3 ? "#ff6fae" : "#a66cff", cx - 4, y - 4, 8, 8);
        f("#f8f4e8", cx - 1, y - 1, 2, 2);
      }
      // Platines de Pokeyz
      f("#2a2a32", 20, H - 70, 70, 40);
      f("#2a2a32", 150, H - 70, 70, 40);
      for (const dx of [55, 185]) {
        const a = t / 200;
        f("#1b1626", dx - 14, H - 64, 28, 28);
        f("#a66cff", dx - 3 + Math.round(Math.cos(a) * 8), H - 53 + Math.round(Math.sin(a) * 8), 3, 3);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [audio, height, reduced]);

  const ratio = Math.round(hud.ratio * 100);
  const ok = hud.ratio >= OBJECTIF_RYTHME;
  return (
    <div className="cook mono" role="dialog" aria-label="Mini-jeu : le mix de Pokeyz">
      <canvas ref={canvas} width={W} height={height} className="bt-canvas" aria-hidden="true" onPointerDown={press} />
      <header className="cook__top">
        <span>LE MIX DE POKEYZ</span>
        <b>
          {ratio} % · ×{hud.combo}
        </b>
      </header>
      {phase === "play" && hud.last && (
        <p key={`${hud.last}-${g.current.results.length}`} className={`rythme__pop is-${hud.last}`}>
          {LABEL[hud.last]}
        </p>
      )}
      <button type="button" className="cook__panel" onClick={press}>
        {phase === "intro" && (
          <>
            <b>Pokeyz : « On casse leur boucle ! »</b> Appuie sur A quand chaque vinyle touche la ligne blanche. Il faut en toucher au moins {Math.round(OBJECTIF_RYTHME * 100)} %. A pour lancer le son.
          </>
        )}
        {phase === "play" && (
          <>
            <b>Suis le son…</b> A sur la ligne ! {Math.max(0, Math.ceil((DURATION - g.current.t) / 1000))} s
          </>
        )}
        {phase === "end" && (
          <>
            <b className={ok ? "is-parfait" : "is-brule"}>{ok ? "LA BOUCLE EST CASSÉE !" : "LA BOUCLE TIENT ENCORE…"}</b> {ratio} % des notes. {ok ? "Le festival respire." : "Pokeyz : « On remet ça quand tu veux. »"} A : continuer
          </>
        )}
      </button>
    </div>
  );
}
