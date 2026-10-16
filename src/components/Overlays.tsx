"use client";

import { useEffect, useState } from "react";
import type { Milestone } from "@/data/milestones";
import { CASE_NUMBER } from "@/config";

const BOOT = [
  "CONNEXION AU SERVEUR DU MINISTÈRE DU CALENDRIER…",
  "VÉRIFICATION DES EMPREINTES… OK",
  "DÉCHIFFREMENT DU DOSSIER " + CASE_NUMBER + "… OK",
  "SYNCHRONISATION FUSEAU EUROPE/PARIS… OK",
  "ACCÈS AUTORISÉ.",
];

/** Séquence d'ouverture façon terminal (une fois par session, passable au toucher). */
export function Intro({ onDone }: { onDone: () => void }) {
  const [n, setN] = useState(0);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (n < BOOT.length) {
      const t = setTimeout(() => setN(n + 1), n === 0 ? 250 : 290);
      return () => clearTimeout(t);
    }
    const t1 = setTimeout(() => setLeaving(true), 380);
    const t2 = setTimeout(onDone, 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [n, onDone]);
  return (
    <div className={`intro${leaving ? " intro--out" : ""}`} onClick={onDone} role="presentation">
      <div className="intro__box mono">
        {BOOT.slice(0, n).map((l, i) => (
          <p key={i} className={i === BOOT.length - 1 ? "red" : ""}>
            &gt; {l}
          </p>
        ))}
        <span className="feed__cursor" />
      </div>
      <span className="intro__skip mono">TOUCHER POUR PASSER</span>
    </div>
  );
}

/** Fausse alerte rouge plein écran. */
export function Alert({ text, onClose }: { text: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3400);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div className="alert" role="alertdialog" aria-live="assertive" aria-label="Alerte" onClick={onClose}>
      <div className="alert__bars" aria-hidden="true" />
      <div className="alert__box">
        <span className="alert__code mono">ALERTE NIVEAU 5 · {CASE_NUMBER}</span>
        <p className="alert__text">{text}</p>
        <span className="alert__foot mono">Incident consigné au dossier. Merci de lâcher la photo.</span>
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string | null }) {
  return (
    <div className={`toast mono${text ? " toast--on" : ""}`} role="status" aria-live="polite">
      {text && (
        <>
          <span className="toast__dot" aria-hidden="true" />
          {text}
        </>
      )}
    </div>
  );
}

export function MilestoneModal({ m, onClose }: { m: Milestone; onClose: () => void }) {
  return (
    <div className="ms" role="dialog" aria-modal="true" aria-labelledby="ms-title">
      <div className="ms__flash" aria-hidden="true" />
      <div className="ms__box">
        <span className="mono ms__code">COMMUNIQUÉ OFFICIEL · {m.code}</span>
        <p className="mono ms__pre">CAP SYMBOLIQUE FRANCHI</p>
        <h2 id="ms-title" className="ms__title">
          {m.title}
        </h2>
        <p className="ms__text mono">{m.text}</p>
        <button type="button" className="btn btn--primary" onClick={onClose} autoFocus>
          Bien reçu
        </button>
      </div>
    </div>
  );
}
