"use client";
/** Écrans du mode paysage : intro GRAW STUDIO et invitation à tourner l'iPhone. */

import { useEffect, useRef } from "react";

/** Logo GRAW STUDIO : une petite main insolente, dessinée pixel par pixel (aucun emoji). */
const HAND = [
  "......KKK.....",
  ".....KSSSK....",
  ".....KSSsK....",
  ".....KSSsK....",
  ".....KSSsK....",
  ".....KSSsK....",
  "..KKKKSSsKKKK.",
  ".KSSsKSSsKSSsK",
  ".KSSSSSSSSSSSK",
  "KKSsSSsSSsSSsK",
  "KSSsSSSSSSSSSK",
  "KSSSsSSSSSSSsK",
  ".KSSSSSSSSSSK.",
  "..KSSSSSSSssK.",
  "..KRRRRRRRRRK.",
  "..KRrRRrRRrRK.",
  "..KKKKKKKKKKK.",
];
const PAL: Record<string, string> = { K: "#1a1014", S: "#f0c9a8", s: "#d39a76", R: "#e53935", r: "#9e2420" };

export function PixelHand({ px = 6, className }: { px?: number; className?: string }) {
  const w = HAND[0].length;
  const h = HAND.length;
  return (
    <svg className={className} width={w * px} height={h * px} viewBox={`0 0 ${w} ${h}`} shapeRendering="crispEdges" aria-hidden="true">
      {HAND.flatMap((row, y) => [...row].map((c, x) => (PAL[c] ? <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={PAL[c]} /> : null)))}
    </svg>
  );
}

/** Intro de studio (≈ 1,7 s) : passe d'un tap ou avec A. */
export function GrawIntro({ sound, onDone }: { sound: boolean; onDone: () => void }) {
  const done = useRef(false);
  const finish = useRef(onDone);
  finish.current = onDone;
  useEffect(() => {
    const end = () => {
      if (done.current) return;
      done.current = true;
      finish.current();
    };
    const t = setTimeout(end, 1750);
    // Petit bruitage rétro à 0,7 s (silencieux si le son est coupé ou si iOS bloque l'audio)
    const b = setTimeout(() => {
      if (!sound) return;
      try {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ac = new Ctx();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(330, ac.currentTime);
        o.frequency.setValueAtTime(660, ac.currentTime + 0.07);
        g.gain.setValueAtTime(0.05, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
        o.connect(g).connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + 0.24);
        setTimeout(() => void ac.close(), 400);
      } catch {
        /* pas d'audio : tant pis */
      }
    }, 700);
    const key = (e: KeyboardEvent) => {
      if (["Enter", " ", "z", "Z", "a", "A", "Escape"].includes(e.key)) {
        e.preventDefault();
        end();
      }
    };
    addEventListener("keydown", key);
    return () => {
      clearTimeout(t);
      clearTimeout(b);
      removeEventListener("keydown", key);
    };
  }, [sound]);
  return (
    <button
      type="button"
      className="gw-intro"
      onPointerDown={() => {
        if (done.current) return;
        done.current = true;
        onDone();
      }}
      aria-label="GRAW STUDIO. Toucher pour passer."
    >
      <PixelHand className="gw-intro__hand" px={7} />
      <span className="gw-intro__name">
        GRAW <b>STUDIO</b>
      </span>
    </button>
  );
}

/** Petit téléphone pixel art qui pivote de portrait vers paysage. */
function PixelPhone() {
  return (
    <svg className="gw-phone" width="72" height="72" viewBox="0 0 24 24" shapeRendering="crispEdges" aria-hidden="true">
      <rect x="7" y="2" width="10" height="20" fill="#f1efe8" />
      <rect x="8" y="4" width="8" height="15" fill="#14121c" />
      <rect x="9" y="5" width="3" height="2" fill="#e53935" />
      <rect x="11" y="20" width="2" height="1" fill="#14121c" />
    </svg>
  );
}

export function RotateScreen({ onTry, onPortrait }: { onTry: () => void; onPortrait: () => void }) {
  return (
    <div className="gw-rotate mono" role="dialog" aria-label="Tourne ton iPhone pour commencer l'aventure" onPointerDown={onTry}>
      <PixelPhone />
      <p className="gw-rotate__msg">
        TOURNE TON IPHONE
        <br />
        POUR COMMENCER L&apos;AVENTURE
      </p>
      <p className="gw-rotate__help">Rien ne se passe ? Désactive le verrouillage de rotation dans le Centre de contrôle.</p>
      <div className="gw-rotate__row">
        <button type="button" className="gw-rotate__btn" onClick={onPortrait}>
          JOUER EN PORTRAIT
        </button>
        <a className="gw-rotate__btn gw-rotate__btn--ghost" href="/jeu">
          RETOUR
        </a>
      </div>
    </div>
  );
}
