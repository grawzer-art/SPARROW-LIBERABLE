"use client";

import { useEffect, useRef, useState } from "react";
import { load } from "@/lib/storage";
import { mood, restore, tick, type Mood } from "@/lib/gotchi/engine";
import { bake } from "./game/sprites";
import { SpritePreview } from "./game/SpritePreview";
import { sparrow } from "./gotchi/sprites";

const STATUS: Partial<Record<Mood, string>> = {
  affame: "Sparrow réclame des frites !",
  creve: "Sparrow est épuisé (il nie)",
  deprime: "Sparrow déprime. Viens le voir.",
  crise: "Sparrow fait une crise dramatique",
  gras: "Sparrow est devenu une frite",
  dofus: "Sparrow est en session Dofus",
  content: "Sparrow est au top",
};

function GotchiFace() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    const frames = [bake(sparrow("lunettes", "sourire", "normal")), bake(sparrow("fermes", "sourire", "normal"))];
    let i = 0;
    const draw = () => {
      c.clearRect(0, 0, 16, 21);
      c.drawImage(frames[i % 9 === 0 ? 1 : 0], 0, i % 2);
      i++;
    };
    draw();
    const id = setInterval(draw, 350);
    return () => clearInterval(id);
  }, []);
  return <canvas ref={ref} width={16} height={21} className="sprite-preview" style={{ width: 64, height: 84 }} aria-hidden="true" />;
}

/** Onglet JEU : choix entre les deux jeux. */
export function GameHub() {
  const [best, setBest] = useState(0);
  const [gotchi, setGotchi] = useState<string | null>(null);

  useEffect(() => {
    setBest(load<number>("sp.game.best", 0));
    const raw = load<unknown>("sp.gotchi.v1", null);
    if (raw) {
      const t = Date.now();
      const s = tick(restore(raw, t), t);
      setGotchi(STATUS[mood(s, t)] ?? "Sparrow t'attend. Il fait semblant que non.");
    } else setGotchi("Un Sparrow attend d'être adopté.");
  }, []);

  return (
    <div className="hub">
      <main className="page hub__page">
        <header className="hub__head">
          <p className="mono hub__kicker">ANNEXE G · SALLE DE JEUX</p>
          <h1 className="hub__title">
            <span>CHOISIS</span>
            <span className="red">TON JEU</span>
          </h1>
          <p className="mono hub__lead">Deux façons de tuer le temps jusqu&apos;en 2031. Aucune ne le fera passer plus vite.</p>
        </header>

        <a href="/jeu/evasion" className="hub-card hub-card--evasion">
          <div className="hub-card__art" aria-hidden="true">
            <SpritePreview skin="lunettes" scale={4} />
            <SpritePreview skin="lili" scale={4} />
          </div>
          <div className="hub-card__txt">
            <span className="mono hub-card__tag">JEU 01 · COURSE RÉTRO</span>
            <h2 className="hub-card__title">L&apos;Évasion de Sparrow</h2>
            <p className="mono hub-card__desc">Saute les calendriers, esquive les lundis, Lili à tes trousses. Classement des potes.</p>
            <span className="mono hub-card__meta">{best > 0 ? `TON RECORD : ${best.toLocaleString("fr-FR")} JOURS` : "AUCUN RECORD POUR L'INSTANT"}</span>
          </div>
          <span className="btn btn--primary hub-card__cta">▶ Jouer</span>
        </a>

        <a href="/jeu/sparrowgotchi" className="hub-card hub-card--gotchi">
          <span className="hub-card__new mono">NOUVEAU</span>
          <div className="hub-card__art hub-card__art--egg" aria-hidden="true">
            <GotchiFace />
          </div>
          <div className="hub-card__txt">
            <span className="mono hub-card__tag">JEU 02 · RPG + ANIMAL VIRTUEL</span>
            <h2 className="hub-card__title">SPARROW : 23:59</h2>
            <p className="mono hub-card__subtitle">L&apos;Élu de la Minute</p>
            <p className="mono hub-card__desc">Une aventure RPG rétro : combats au tour par tour, compagnons, boss, et le temps figé à 23:59. Et toujours son appart, ses frites et ses sessions de farm.</p>
            <span className="mono hub-card__meta hub-card__meta--live">{gotchi ?? "…"}</span>
          </div>
          <span className="btn btn--primary hub-card__cta">▶ Jouer</span>
        </a>
      </main>
    </div>
  );
}
