"use client";

import { useCallback, useRef } from "react";
import type { Remaining } from "@/lib/time";
import { pad } from "@/lib/time";
import { Digit } from "./Digit";

interface Props {
  r: Remaining | null;
  onTap: () => void;
}

function Group({ value, len, label, dimLeading = false }: { value: number | null; len: number; label: string; dimLeading?: boolean }) {
  const str = value == null ? "–".repeat(len) : pad(value, len);
  const firstSignificant = str.search(/[1-9]/);
  return (
    <div className="cd__group">
      <div className="cd__digits">
        {str.split("").map((ch, i) => (
          <Digit key={i} value={ch} dim={dimLeading && value != null && (firstSignificant === -1 ? i < len - 1 : i < firstSignificant)} />
        ))}
      </div>
      <div className="cd__label">{label}</div>
    </div>
  );
}

const Sep = () => (
  <div className="cd__sep" aria-hidden="true">
    :
  </div>
);

export function Countdown({ r, onTap }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  const handle = useCallback(() => {
    ref.current?.classList.remove("cd--shake");
    void ref.current?.offsetWidth;
    ref.current?.classList.add("cd--shake");
    onTap();
  }, [onTap]);

  const sr = r
    ? `Temps restant : ${r.days} jours, ${r.hours} heures, ${r.minutes} minutes et ${r.seconds} secondes`
    : "Calcul du temps restant";

  return (
    <button ref={ref} type="button" className="cd" onClick={handle} aria-label={sr}>
      <div className="cd__row">
        <Group value={r?.days ?? null} len={4} label="Jours" dimLeading />
        <Sep />
        <Group value={r?.hours ?? null} len={2} label="Heures" />
        <Sep />
        <Group value={r?.minutes ?? null} len={2} label="Minutes" />
        <Sep />
        <Group value={r?.seconds ?? null} len={2} label="Secondes" />
      </div>
    </button>
  );
}
