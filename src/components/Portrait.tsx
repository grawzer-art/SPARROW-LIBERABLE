"use client";

import { useRef } from "react";
import { MAIN_PHOTO } from "@/data/photos";
import { CASE_NUMBER } from "@/config";
import { PhotoImg } from "./PhotoImg";
import { Stamp } from "./Stamp";

const RULER = [200, 190, 180, 170, 160, 150];

export function Portrait({ onHarass }: { onHarass: (count: number) => void }) {
  const taps = useRef<number[]>([]);
  const total = useRef(0);

  const tap = () => {
    const t = performance.now();
    taps.current = [...taps.current.filter((x) => t - x < 1800), t];
    if (taps.current.length >= 4) {
      taps.current = [];
      total.current += 1;
      onHarass(total.current);
    }
  };

  return (
    <figure className="portrait reveal" style={{ ["--d" as string]: "0.35s" }}>
      <div className="portrait__clip" aria-hidden="true">
        <svg viewBox="0 0 24 64" width="24" height="64">
          <path d="M6 60V12a6 6 0 0 1 12 0v40a3 3 0 0 1-6 0V16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
      <div className="portrait__sheet">
        <div className="portrait__head mono">
          <span>PIÈCE {MAIN_PHOTO.id}</span>
          <span>DOSSIER {CASE_NUMBER}</span>
        </div>
        <div className="portrait__body">
          <ol className="portrait__ruler mono" aria-hidden="true">
            {RULER.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ol>
          <button type="button" className="portrait__frame" onClick={tap} aria-label="Photo de Sparrow (ne pas toucher)">
            <PhotoImg photo={MAIN_PHOTO} priority className="portrait__img" />
            <span className="portrait__tint" aria-hidden="true" />
            <span className="portrait__scan" aria-hidden="true" />
            <span className="crop crop--tl" aria-hidden="true" />
            <span className="crop crop--tr" aria-hidden="true" />
            <span className="crop crop--bl" aria-hidden="true" />
            <span className="crop crop--br" aria-hidden="true" />
            <span className="portrait__rec mono" aria-hidden="true">
              <i /> SURV. CAM 04
            </span>
          </button>
        </div>
        <div className="portrait__plate mono" aria-hidden="true">
          <span>SUJET : SPARROW</span>
          <span>CLASSÉ</span>
        </div>
        <Stamp className="portrait__stamp">CONFIDENTIEL</Stamp>
      </div>
      <figcaption className="portrait__caption mono">« {MAIN_PHOTO.caption} »</figcaption>
    </figure>
  );
}
