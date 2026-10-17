"use client";

/**
 * RPG — mini-jeu « Frites parfaites » (chapitre 2, défi de Gérard).
 * Cinq fournées cuisent de plus en plus vite : on sort le panier avec A quand les frites sont
 * bien dorées. Il faut 6 points sur 10 (parfait = 2, doré = 1). On peut réessayer sans limite.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { CUISSON, FOURNEES, OBJECTIF, POINTS, cookScore, cookSpeed, rate, type Cuisson } from "@/lib/rpg/shop";
import type { Chiptune } from "../game/audio";
import type { PadHandler } from "./BattleScreen";

const W = 240;
const LABEL: Record<Cuisson, string> = { parfait: "PARFAIT !", bien: "BIEN DORÉES", pale: "TROP PÂLES", brule: "BRÛLÉES !" };

/** Couleur des frites selon la cuisson (crues → dorées → carbonisées). */
function friteColor(k: number): [string, string] {
  if (k < 0.35) return ["#f4ecc8", "#ddd2a4"];
  if (k < 0.56) return ["#f5dc8a", "#dcbc5e"];
  if (k < 0.65) return ["#f2c14e", "#c9952e"];
  if (k < 0.73) return ["#e8a838", "#b87a1e"];
  if (k < 0.82) return ["#d08a2a", "#9a5e16"];
  if (k < 0.92) return ["#8a5a22", "#5a3a12"];
  return ["#3a2a1a", "#1a120a"];
}

export function CookGame({ height, audio, reduced, pad, onEnd }: { height: number; audio: Chiptune; reduced: boolean; pad: MutableRefObject<PadHandler | null>; onEnd: (ok: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<"intro" | "cook" | "result" | "end">("intro");
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [results, setResults] = useState<Cuisson[]>([]);
  const resRef = useRef<Cuisson[]>([]);
  const level = useRef(0);
  const last = useRef<Cuisson | null>(null);
  const t0 = useRef(0);

  const nextBatch = useCallback(() => {
    level.current = 0;
    last.current = null;
    setPhase("cook");
    audio.select();
  }, [audio]);

  const pull = useCallback(() => {
    const r = rate(level.current);
    last.current = r;
    resRef.current = [...resRef.current, r];
    setResults(resRef.current);
    setPhase("result");
    if (r === "parfait") audio.win();
    else if (r === "bien") audio.coin();
    else audio.hit();
    navigator.vibrate?.(r === "parfait" ? [20, 30, 20] : 15);
    t0.current = performance.now();
  }, [audio]);

  const press = useCallback(() => {
    const p = phaseRef.current;
    if (p === "intro") nextBatch();
    else if (p === "cook") pull();
    else if (p === "result") {
      if (resRef.current.length >= FOURNEES) setPhase("end");
      else nextBatch();
    } else onEnd(cookScore(resRef.current) >= OBJECTIF);
  }, [nextBatch, onEnd, pull]);

  useEffect(() => {
    pad.current = { a: press, b: () => phaseRef.current === "end" && onEnd(cookScore(resRef.current) >= OBJECTIF), dir: () => {} };
    return () => {
      pad.current = null;
    };
  }, [onEnd, pad, press]);

  // Cuisson + rendu
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let prev = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000);
      prev = now;
      const t = now / 1000;
      if (phaseRef.current === "cook") {
        level.current += dt * cookSpeed(resRef.current.length);
        if (canvas.current) canvas.current.dataset.level = level.current.toFixed(3);
        if (level.current >= 1) {
          level.current = 1;
          pull();
        }
      }
      const H = height;
      const f = (c: string, x: number, y: number, w = 1, h = 1) => {
        ctx.fillStyle = c;
        ctx.fillRect(Math.round(x), Math.round(y), w, h);
      };
      ctx.imageSmoothingEnabled = false;
      // Cuisine : carrelage
      for (let y = 0; y < H; y += 8) for (let x = 0; x < W; x += 8) f((x / 8 + y / 8) % 2 ? "#e8e2d4" : "#c9c1ae", x, y, 8, 8);
      f("#5a3a26", 0, H - 40, W, 40);
      f("#7a5236", 0, H - 40, W, 2);
      // Friteuse
      const cx = W / 2;
      const fy = Math.round(H * 0.42);
      f("#1b1626", cx - 62, fy - 2, 124, 64);
      f("#7d8590", cx - 60, fy, 120, 60);
      f("#a3abb5", cx - 60, fy, 120, 4);
      f("#4a505a", cx - 60, fy + 56, 120, 4);
      // Huile qui bouillonne
      f("#c9952e", cx - 52, fy + 10, 104, 18);
      f("#e0b040", cx - 52, fy + 10, 104, 3);
      if (!reduced)
        for (let i = 0; i < 14; i++) {
          const bx = cx - 50 + ((i * 37 + Math.floor(t * 40 * (1 + (i % 3)))) % 100);
          const by = fy + 12 + ((i * 7 + Math.floor(t * 9)) % 12);
          f("#f8dc8c", bx, by, 2, 2);
        }
      // Panier et frites
      const up = phaseRef.current === "cook" ? 0 : 18;
      const k = phaseRef.current === "intro" ? 0 : level.current;
      const [c1, c2] = friteColor(k);
      f("#4a505a", cx - 34, fy + 2 - up, 68, 2);
      for (let x = cx - 34; x < cx + 34; x += 4) f("#4a505a", x, fy + 2 - up, 1, 22);
      for (let i = 0; i < 16; i++) {
        const x = cx - 30 + i * 4 - (i % 2);
        const h = 12 + ((i * 5) % 7);
        f(c2, x, fy + 20 - up - h, 3, h);
        f(c1, x, fy + 20 - up - h, 2, h - 1);
      }
      f("#4a505a", cx + 33, fy - 8 - up, 2, 11); // manche
      f("#4a505a", cx + 33, fy - 8 - up, 26, 3);
      f("#1b1626", cx + 52, fy - 9 - up, 8, 5);
      // Jauge de cuisson
      const gy = fy + 72;
      const gx = 20;
      const gw = W - 40;
      f("#1b1626", gx - 2, gy - 2, gw + 4, 12);
      for (let x = 0; x < gw; x++) f(friteColor(x / gw)[0], gx + x, gy, 1, 8);
      f("rgba(255,255,255,0.35)", gx + gw * CUISSON.bien[0], gy, gw * (CUISSON.bien[1] - CUISSON.bien[0]), 8);
      f("rgba(60,207,106,0.7)", gx + gw * CUISSON.parfait[0], gy, gw * (CUISSON.parfait[1] - CUISSON.parfait[0]), 8);
      f("#3ccf6a", gx + gw * CUISSON.parfait[0], gy - 4, gw * (CUISSON.parfait[1] - CUISSON.parfait[0]), 2);
      if (phaseRef.current !== "intro") {
        const mx = gx + gw * Math.min(1, level.current);
        f("#1b1626", mx - 2, gy - 6, 5, 20);
        f("#ffffff", mx - 1, gy - 5, 3, 18);
      }
      // Sel sur une fournée parfaite
      if (phaseRef.current === "result" && last.current === "parfait" && !reduced) {
        const e = (now - t0.current) / 1000;
        for (let i = 0; i < 20; i++) f("#ffffff", cx - 30 + ((i * 13) % 60), fy - 30 + ((e * 60 + i * 7) % 30), 1, 1);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [height, pull, reduced]);

  const score = cookScore(results);
  const ok = score >= OBJECTIF;
  return (
    <div className="cook mono" role="dialog" aria-label="Mini-jeu : frites parfaites">
      <canvas ref={canvas} width={W} height={height} className="bt-canvas" aria-hidden="true" onPointerDown={press} />
      <header className="cook__top">
        <span>FRITES PARFAITES</span>
        <b>
          {Math.min(results.length + (phase === "cook" ? 1 : 0), FOURNEES)}/{FOURNEES} · {score} pts
        </b>
      </header>
      <p className="cook__dots" aria-label={`Fournées : ${results.map((r) => LABEL[r]).join(", ")}`}>
        {Array.from({ length: FOURNEES }, (_, i) => (
          <i key={i} className={results[i] ? `is-${results[i]}` : ""} />
        ))}
      </p>
      <button type="button" className="cook__panel" onClick={press}>
        {phase === "intro" && (
          <>
            <b>Défi de Gérard</b> Sors chaque fournée quand la jauge est dans le vert (PARFAIT, 2 pts) ou le blanc (DORÉ, 1 pt). Il faut {OBJECTIF} points en {FOURNEES} fournées. A pour commencer.
          </>
        )}
        {phase === "cook" && (
          <>
            <b>Ça frit…</b> Appuie sur A pour sortir le panier !
          </>
        )}
        {phase === "result" && last.current && (
          <>
            <b className={`is-${last.current}`}>
              {LABEL[last.current]} +{POINTS[last.current]}
            </b>{" "}
            {results.length >= FOURNEES ? "A : voir le résultat" : "A : fournée suivante"}
          </>
        )}
        {phase === "end" && (
          <>
            <b className={ok ? "is-parfait" : "is-brule"}>{ok ? "DÉFI RÉUSSI !" : "RATÉ…"}</b> {score} points sur {FOURNEES * 2}. {ok ? "Gérard n'en croit pas ses yeux." : "Gérard secoue la tête. On peut réessayer en lui reparlant."} A : continuer
          </>
        )}
      </button>
    </div>
  );
}
