"use client";

import { useEffect, useState } from "react";
import { msUntilNextTick, now } from "./time";

/**
 * Horloge recalée à chaque seconde : on relit l'heure réelle à chaque tick
 * (pas d'accumulation d'intervalles → aucune dérive), et on recalcule
 * immédiatement au retour au premier plan.
 */
export function useNow(enabled = true): number | null {
  const [t, setT] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = () => {
      const n = now();
      setT(n);
      clearTimeout(timer);
      timer = setTimeout(tick, msUntilNextTick(n));
    };
    const onWake = () => {
      if (document.visibilityState === "visible") tick();
    };

    tick();
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    window.addEventListener("pageshow", onWake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("pageshow", onWake);
    };
  }, [enabled]);

  return t;
}
