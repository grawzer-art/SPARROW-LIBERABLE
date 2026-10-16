"use client";

import { useEffect, useRef, useState } from "react";
import type { CapsuleSfx } from "./sfx";

const HOLD_MS = 1700;

const DENIED = [
  "EMPREINTE NON RECONNUE · TRACES DE GRAS DE FRITES DÉTECTÉES.",
  "EMPREINTE DE SPARROW RECONNUE. ACCÈS REFUSÉ QUAND MÊME.",
  "SCAN TERMINÉ · NIVEAU D'IMPATIENCE DU SUJET : 98 %.",
  "IDENTITÉ CONFIRMÉE : POTE. ACCRÉDITATION INSUFFISANTE AVANT 2031.",
  "DOIGT VALIDE. DATE INVALIDE. REVENEZ LE 12.10.2031.",
  "ANALYSE ADN : 40 % CHEVALIER NOIR, 60 % KEBAB. ACCÈS REFUSÉ.",
  "LE SCANNER A RECONNU UN LUNDI. IL PRÉFÈRE NE PAS OUVRIR.",
];

const EARLY = "SCAN INTERROMPU. RESTEZ IMMOBILE, COMME LE CALENDRIER.";

/** Faux scanner biométrique : maintenir le doigt ~2 s. */
export function Scanner({ open, sfx, onResult }: { open: boolean; sfx: CapsuleSfx; onResult: (ok: boolean) => void }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<"idle" | "scanning" | "done" | "aborted">("idle");
  const [msg, setMsg] = useState("POSER LE DOIGT ET MAINTENIR");
  const start = useRef(0);
  const raf = useRef(0);
  const last = useRef(-1);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const loop = () => {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setProgress(p);
    const step = Math.floor(p * 8);
    if (step !== last.current) {
      last.current = step;
      sfx.beep();
    }
    if (p >= 1) {
      sfx.humStop();
      setPhase("done");
      if (open) {
        sfx.grant();
        setMsg("IDENTITÉ CONFIRMÉE. LE COFFRE VOUS ATTEND.");
      } else {
        sfx.deny();
        setMsg(DENIED[Math.floor(Math.random() * DENIED.length)]);
      }
      navigator.vibrate?.(open ? [30, 40, 30] : [120]);
      onResult(open);
      return;
    }
    raf.current = requestAnimationFrame(loop);
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    start.current = performance.now();
    last.current = -1;
    setPhase("scanning");
    setMsg("ANALYSE BIOMÉTRIQUE EN COURS…");
    sfx.humStart();
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(loop);
  };

  const up = () => {
    if (phase !== "scanning") return;
    cancelAnimationFrame(raf.current);
    sfx.humStop();
    if (performance.now() - start.current < HOLD_MS) {
      setPhase("aborted");
      setProgress(0);
      setMsg(EARLY);
    }
  };

  const C = 2 * Math.PI * 54;

  return (
    <div className={`scan scan--${phase}${phase === "done" ? (open ? " scan--ok" : " scan--ko") : ""}`}>
      <button
        type="button"
        className="scan__pad"
        onPointerDown={down}
        onPointerUp={up}
        onPointerCancel={up}
        onPointerLeave={up}
        onContextMenu={(e) => e.preventDefault()}
        aria-label="Scanner biométrique : maintenir appuyé"
      >
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="54" className="scan__track" />
          <circle
            cx="60"
            cy="60"
            r="54"
            className="scan__ring"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            transform="rotate(-90 60 60)"
          />
          <g className="scan__print">
            <path d="M60 30c-16 0-28 12-28 28" />
            <path d="M60 36c-12 0-22 10-22 22v8" />
            <path d="M60 42c-9 0-16 7-16 16v14" />
            <path d="M60 48c-5 0-10 4-10 10v20" />
            <path d="M60 54c-2 0-4 2-4 4v24" />
            <path d="M60 30c16 0 28 12 28 28v4" />
            <path d="M60 36c12 0 22 10 22 22v14" />
            <path d="M60 42c9 0 16 7 16 16v22" />
            <path d="M60 48c5 0 10 4 10 10v26" />
            <path d="M64 58v28" />
          </g>
        </svg>
        <span className="scan__beam" />
      </button>
      <p className="scan__msg mono" aria-live="polite">
        {msg}
      </p>
    </div>
  );
}
