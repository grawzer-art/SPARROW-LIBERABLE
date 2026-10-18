"use client";

import { useEffect, useRef, useState } from "react";
import { load } from "@/lib/storage";
import { bake } from "./game/sprites";
import { SpritePreview } from "./game/SpritePreview";
import { sparrow } from "./gotchi/sprites";

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

  useEffect(() => {
    setBest(load<number>("sp.game.best", 0));
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

        <a href="/jeu/sparrowgotchi" className="hub-card hub-card--gotchi hub-card--cover" aria-labelledby="hub-rpg-title">
          <span className="hub-card__new mono">NOUVEAU</span>
          <span className="hub-card__age mono" aria-label="Déconseillé aux moins de 18 ans : contenu mature">18+</span>
          {/* Jaquette officielle : le titre est déjà dessiné dessus (titre HTML accessible juste en dessous) */}
          <picture className="hub-cover">
            <source type="image/webp" srcSet="/jeu/sparrow-2359-724.webp 724w, /jeu/sparrow-2359-1086.webp 1086w" sizes="(max-width: 520px) 92vw, 460px" />
            <img src="/jeu/sparrow-2359.jpg" width={1086} height={1448} alt="Jaquette de SPARROW : 23:59 — Sparrow, barbe rousse, devant la grande horloge figée à minuit, sous un ciel rouge." decoding="async" />
          </picture>
          <div className="hub-card__txt">
            <span className="mono hub-card__tag">JEU 01 · RPG RÉTRO</span>
            <h2 id="hub-rpg-title" className="sr-only">
              SPARROW : 23:59
            </h2>
            <p className="hub-card__hook">Tout est figé à 23:59. Sauf l&apos;aventure.</p>
            <p className="mono hub-card__desc">Explore la ville, recrute des compagnons, affronte des monstres et perce le mystère de minuit.</p>
          </div>
          <span className="btn btn--primary hub-card__cta">▶ Jouer</span>
        </a>

        <a href="/jeu/evasion" className="hub-card hub-card--evasion">
          <div className="hub-card__art" aria-hidden="true">
            <SpritePreview skin="lunettes" scale={4} />
            <SpritePreview skin="lili" scale={4} />
          </div>
          <div className="hub-card__txt">
            <span className="mono hub-card__tag">JEU 02 · COURSE RÉTRO</span>
            <h2 className="hub-card__title">L&apos;Évasion de Sparrow</h2>
            <p className="mono hub-card__desc">Saute les calendriers, esquive les lundis, Lili à tes trousses. Classement des potes.</p>
            <span className="mono hub-card__meta">{best > 0 ? `TON RECORD : ${best.toLocaleString("fr-FR")} JOURS` : "AUCUN RECORD POUR L'INSTANT"}</span>
          </div>
          <span className="btn btn--primary hub-card__cta">▶ Jouer</span>
        </a>

        <a href="/jeu/online" className="hub-card hub-card--gotchi">
          <span className="hub-card__new mono">BÊTA</span>
          <div className="hub-card__art hub-card__art--egg" aria-hidden="true">
            <GotchiFace />
          </div>
          <div className="hub-card__txt">
            <span className="mono hub-card__tag">JEU 03 · MULTIJOUEUR · SUR INVITATION</span>
            <h2 className="hub-card__title">SPARROW ONLINE</h2>
            <p className="mono hub-card__desc">Crée ton héros en pixel art et retrouve les autres joueurs au Quartier 404 : déplacements en temps réel, chat, et Sparrow en personne.</p>
          </div>
          <span className="btn btn--primary hub-card__cta">▶ Entrer</span>
        </a>
      </main>
    </div>
  );
}
