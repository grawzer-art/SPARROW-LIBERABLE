"use client";
/**
 * Aventure en plein écran paysage (iPhone) : détection de l'orientation, réglages de l'interface.
 *
 * iOS ne permet pas de forcer la rotation : Safari iPhone ne gère ni le plein écran d'une page
 * ni `screen.orientation.lock`. On essaie quand même (Android, tablettes), sans jamais en dépendre :
 * en portrait sur téléphone, un écran invite à tourner l'appareil, avec une sortie de secours
 * (« jouer en portrait ») si le verrouillage de rotation est activé.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type UiMode = "classic" | "immersive" | "rotate";

export interface UiPrefs {
  /** Opacité des commandes au repos (0,2 à 0,7). */
  padOpacity: number;
  /** Intro GRAW STUDIO au lancement. */
  intro: boolean;
}

const PREFS_KEY = "sp.gotchi.ui";
const PORTRAIT_KEY = "sp.gotchi.portrait";
export const DEFAULT_PREFS: UiPrefs = { padOpacity: 0.3, intro: true };

export function loadPrefs(): UiPrefs {
  try {
    const o = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<UiPrefs>;
    const op = typeof o.padOpacity === "number" ? Math.min(0.7, Math.max(0.2, o.padOpacity)) : DEFAULT_PREFS.padOpacity;
    return { padOpacity: Math.round(op * 20) / 20, intro: o.intro !== false };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(p: UiPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* stockage indisponible : réglage gardé pour cette session */
  }
}

/** Téléphone tactile (petite dimension < 600 px) : seul cas où l'on passe en paysage immersif. */
const isPhone = () => typeof window !== "undefined" && matchMedia("(pointer: coarse)").matches && Math.min(innerWidth, innerHeight) < 600;

export function modeFor(portraitOk: boolean): UiMode {
  if (!isPhone()) return "classic";
  if (innerWidth > innerHeight) return "immersive";
  return portraitOk ? "classic" : "rotate";
}

/** Essaie le plein écran + verrouillage paysage là où c'est permis (jamais sur iPhone). */
export async function tryLandscape() {
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement && el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
  } catch {
    /* refusé : pas grave */
  }
  try {
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    /* non pris en charge (iOS) : l'écran « tourne ton iPhone » prend le relais */
  }
}

export async function releaseLandscape() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* rien à faire */
  }
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
  } catch {
    /* rien à faire */
  }
}

export function useUiMode() {
  const [portraitOk, setPortraitOk] = useState(false);
  const [mode, setMode] = useState<UiMode>("classic");
  /** L'orientation a été mesurée (avant, `mode` vaut « classic » par défaut). */
  const [ready, setReady] = useState(false);
  const okRef = useRef(false);
  useEffect(() => {
    try {
      okRef.current = sessionStorage.getItem(PORTRAIT_KEY) === "1";
    } catch {
      /* rien */
    }
    setPortraitOk(okRef.current);
    const upd = () => setMode(modeFor(okRef.current));
    upd();
    setReady(true);
    // iOS met parfois à jour les dimensions juste après l'évènement : on relit un peu plus tard
    const later = () => {
      upd();
      setTimeout(upd, 250);
    };
    addEventListener("resize", later);
    addEventListener("orientationchange", later);
    return () => {
      removeEventListener("resize", later);
      removeEventListener("orientationchange", later);
    };
  }, []);
  const allowPortrait = useCallback((on: boolean) => {
    try {
      if (on) sessionStorage.setItem(PORTRAIT_KEY, "1");
      else sessionStorage.removeItem(PORTRAIT_KEY);
    } catch {
      /* rien */
    }
    okRef.current = on;
    setPortraitOk(on);
    setMode(modeFor(on));
  }, []);
  return { mode, ready, portraitOk, allowPortrait };
}
