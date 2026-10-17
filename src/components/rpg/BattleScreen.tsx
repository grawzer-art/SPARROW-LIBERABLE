"use client";

/**
 * RPG — écran de combat façon RPG portable (canvas + cadres DOM lisibles sur téléphone).
 *
 *  - transition animée (éclairs puis volet), entrée des combattants ;
 *  - Sparrow (ou l'équipier actif) de dos en bas à gauche, l'ennemi de face en haut à droite ;
 *  - cadres de PV animés, niveau, état ;
 *  - menu ATTAQUER / OBJETS / COMPAGNONS / FUITE, puis les 4 techniques (puissance, précision) ;
 *  - chaque événement du moteur (combat.ts) est animé : élan, effet, clignotement, chiffres.
 * Commandes : la croix et A/B de la console (via `pad`), ou le toucher.
 */

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import { CONSUMABLES, FORMS, MEMBERS, MOVES, nameOf, type Fx } from "@/lib/rpg/bestiary";
import { ally, bagAfter, foe, forced, forms, freshFight, hpAfter, mustSwap, playTurn, spoils, startBattle, type Action, type Battle, type BattleEvent, type Side, type Team } from "@/lib/rpg/combat";
import type { Chiptune } from "../game/audio";
import { battler } from "./battlers";
import { hash } from "./pixel";

export type PadDir = "up" | "down" | "left" | "right";
export interface PadHandler {
  a(): void;
  b(): void;
  dir(d: PadDir): void;
}

export interface BattleEnd {
  outcome: "win" | "lose" | "flee";
  /** Créature capturée (rencontre sauvage). */
  captured?: { species: string; level: number };
  /** Équipiers entrés au combat (eux seuls gagnent de l'expérience). */
  fought?: string[];
  /** PV restants de l'équipe (fraction), gardés jusqu'au prochain soin. */
  hp?: Record<string, number>;
  xp: number;
  fp: number;
  bag: Record<string, number>;
  notes: string[];
}

type Mode = "intro" | "events" | "menu" | "moves" | "items" | "party" | "lost" | "done";
/** Après une défaite : un boss se retente tout de suite ; sinon, retour à la dernière infirmerie. */
const lostOptions = (bt: Battle) => (freshFight(bt.def) ? ["RÉESSAYER", "SE RETIRER"] : ["À L'INFIRMERIE"]);

const W = 240;
const MAIN = ["ATTAQUER", "OBJETS", "COMPAGNONS", "FUITE"] as const;
const STAT_LABEL: Record<string, string> = { atk: "ATT", def: "DÉF", spd: "VIT", acc: "PRÉ" };

interface Disp {
  a: number;
  f: number;
  allyHp: number[];
  foeHp: number[];
  allyStatus: (string | null)[];
  foeStatus: (string | null)[];
  foeSprite: string[];
  allySprite: string[];
  showAlly: boolean;
  showFoe: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  c: string;
  s: number;
  kind?: "z" | "up" | "down" | "ring";
}

interface Anim {
  t: number;
  /** Élan d'attaque (0 → 1 → 0). */
  lunge: { side: Side; t: number } | null;
  /** Clignotement d'un combattant touché. */
  blink: { side: Side; t: number } | null;
  shake: number;
  flash: number;
  flashColor: string;
  /** Entrée / K.O. (glissement). */
  slide: Record<Side, number>;
  faint: Record<Side, number>;
  charge: Record<Side, boolean>;
  parts: Particle[];
  pops: { side: Side; text: string; c: string; t: number }[];
  /** Transition d'entrée (0 → 1). */
  intro: number;
  /** Capsule d'Écho : lancer (0 → 0,5 s), absorption, secousses, puis résultat. */
  capsule: { t: number; shakes: number; ok: boolean } | null;
}

/** Durée de l'animation de capsule (s). */
const capsuleTime = (shakes: number) => 0.9 + shakes * 0.55 + 0.7;

/** Capsule d'Écho en pixel art (10 × 10) : violet en haut, crème en bas, bouton doré. */
function drawCapsule(ctx: CanvasRenderingContext2D, cx: number, cy: number, k: number, open = 0) {
  const f = (c: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(cx + x * k), Math.round(cy + y * k), Math.ceil(w * k), Math.ceil(h * k));
  };
  const lift = -open * 4;
  f("#1b1626", -5, -5 + lift, 10, 5);
  f("#a66cff", -4, -4 + lift, 8, 4);
  f("#c8a0ff", -3, -4 + lift, 2, 1);
  f("#1b1626", -5, 0, 10, 5);
  f("#f1efe8", -4, 0, 8, 4);
  f("#c8c2b4", 1, 2, 3, 2);
  f("#1b1626", -5, -1, 10, 2);
  f("#1b1626", -2, -2, 4, 4);
  f("#e8b830", -1, -1, 2, 2);
}

/** Objets utilisables dans ce combat (les capsules seulement face à une créature sauvage, en tête de liste). */
const usable = (b: Battle) =>
  Object.entries(b.bag)
    .filter(([k, n]) => n > 0 && CONSUMABLES[k] && (!CONSUMABLES[k].capture || b.def.wild))
    .sort(([a], [c]) => Number(!!CONSUMABLES[c].capture) - Number(!!CONSUMABLES[a].capture));

const freshDisp = (b: Battle): Disp => ({
  a: b.a,
  f: b.f,
  allyHp: b.allies.map((x) => x.hp),
  foeHp: b.foes.map((x) => x.hp),
  allyStatus: b.allies.map((x) => x.status?.id ?? null),
  foeStatus: b.foes.map((x) => x.status?.id ?? null),
  foeSprite: b.foes.map((x) => x.sprite),
  allySprite: b.allies.map((x) => x.sprite),
  showAlly: true,
  showFoe: true,
});

// ─── Décors de combat ───

const bgCache = new Map<string, HTMLCanvasElement>();

function background(kind: Battle["def"]["bg"], h: number): HTMLCanvasElement {
  const k = `${kind}:${h}`;
  const hit = bgCache.get(k);
  if (hit) return hit;
  const c = Object.assign(document.createElement("canvas"), { width: W, height: h });
  const x = c.getContext("2d")!;
  const band = (y0: number, y1: number, cols: string[]) => {
    const n = cols.length;
    for (let i = 0; i < n; i++) {
      x.fillStyle = cols[i];
      x.fillRect(0, Math.round(y0 + ((y1 - y0) * i) / n), W, Math.ceil((y1 - y0) / n) + 1);
    }
  };
  const horizon = Math.round(h * 0.5);
  if (kind === "rue" || kind === "cite") {
    const night = kind === "rue";
    band(0, horizon, night ? ["#0c0b1e", "#13122b", "#1b1a3a", "#252347"] : ["#3b1d4a", "#6a2f5a", "#a8475a", "#e07a4f", "#f2b05a"]);
    // Étoiles ou soleil couchant
    if (night) for (let i = 0; i < 40; i++) x.fillRect(Math.floor(hash(i, 1, 3) * W), Math.floor(hash(i, 2, 3) * horizon * 0.8), 1, 1);
    else {
      x.fillStyle = "#ffd98a";
      for (let y = -10; y <= 10; y++) {
        const half = Math.round(Math.sqrt(100 - y * y) * 1.6);
        if (horizon - 6 + y < horizon) x.fillRect(150 - half, horizon - 6 + y, half * 2, 1);
      }
    }
    // Silhouettes d'immeubles
    let bx = 0;
    let i = 0;
    while (bx < W) {
      const bw = 16 + Math.floor(hash(i, 5, kind === "rue" ? 1 : 2) * 22);
      const bh = 18 + Math.floor(hash(i, 6, 3) * (horizon * 0.45));
      x.fillStyle = night ? "#0a0918" : "#2a1630";
      x.fillRect(bx, horizon - bh, bw, bh);
      if (!night && hash(i, 9, 1) < 0.5) x.fillRect(bx + bw / 2 - 1, horizon - bh - 6, 2, 6);
      x.fillStyle = night ? "#f2c14e" : "#f8c070";
      for (let wy = horizon - bh + 4; wy < horizon - 4; wy += 6)
        for (let wx = bx + 3; wx < bx + bw - 3; wx += 5) if (hash(wx, wy, 7) < (night ? 0.25 : 0.18)) x.fillRect(wx, wy, 2, 2);
      bx += bw + 1;
      i++;
    }
    band(horizon, h, night ? ["#2a2933", "#24232c", "#1f1e27"] : ["#8a6a5a", "#7a5c4e", "#6a4f44"]);
    x.fillStyle = night ? "#3a3946" : "#9c7c6a";
    for (let gy = horizon + 6; gy < h; gy += 10) for (let gx = (gy / 10) % 2 ? 0 : 8; gx < W; gx += 16) x.fillRect(gx, gy, 10, 1);
  } else if (kind === "egout") {
    band(0, horizon + 10, ["#0f1a17", "#13221d", "#172a24"]);
    x.fillStyle = "#0b1411";
    for (let y = 4; y < horizon + 10; y += 8) for (let bx = (y / 8) % 2 ? 0 : 7; bx < W; bx += 14) x.fillRect(bx, y, 1, 7);
    for (let y = 4; y < horizon + 10; y += 8) x.fillRect(0, y, W, 1);
    // Tuyaux
    x.fillStyle = "#3a4a44";
    x.fillRect(0, 18, W, 5);
    x.fillStyle = "#56685f";
    x.fillRect(0, 18, W, 1);
    band(horizon + 10, h, ["#1d3a2a", "#244a33", "#1a3626"]);
    x.fillStyle = "#3f7a4a";
    for (let i = 0; i < 30; i++) x.fillRect(Math.floor(hash(i, 3, 9) * W), horizon + 12 + Math.floor(hash(i, 4, 9) * (h - horizon - 14)), 4, 1);
  } else if (kind === "montagne") {
    band(0, horizon, ["#3a2a5a", "#6a3a6a", "#b0566a", "#e88a5a", "#f8c070"]);
    // Montagnes lointaines
    for (let layer = 0; layer < 2; layer++) {
      x.fillStyle = layer ? "#5a3a5a" : "#7a4a6a";
      for (let px = 0; px < W; px++) {
        const hgt = Math.round((Math.sin(px / (18 + layer * 9) + layer * 2) * 0.5 + 0.5) * horizon * (0.35 + layer * 0.2) + hash(px, layer, 4) * 3);
        x.fillRect(px, horizon - hgt, 1, hgt);
      }
    }
    x.fillStyle = "#f8f4e8";
    for (let px = 40; px < 70; px++) x.fillRect(px, horizon - 38 + Math.abs(px - 55), 1, 3);
    band(horizon, h, ["#5a6a4a", "#4a5a3e", "#3e4a34"]);
    x.fillStyle = "#6a7a5a";
    for (let i = 0; i < 40; i++) x.fillRect(Math.floor(hash(i, 8, 2) * W), horizon + 4 + Math.floor(hash(i, 9, 2) * (h - horizon - 6)), 3, 1);
  } else if (kind === "cerisiers" || kind === "festival") {
    const fest = kind === "festival";
    band(0, horizon, fest ? ["#0c0a22", "#16123a", "#221a4a"] : ["#4a2a5a", "#8a4a7a", "#d87a8a", "#f2b0a0"]);
    if (fest) {
      for (let i = 0; i < 30; i++) x.fillRect(Math.floor(hash(i, 1, 6) * W), Math.floor(hash(i, 2, 6) * horizon * 0.6), 1, 1);
      // Guirlandes de lanternes
      for (let gx = 0; gx < W; gx += 4) {
        const gy = 18 + Math.round(Math.sin(gx / 30) * 6);
        x.fillStyle = "#3a2a1a";
        x.fillRect(gx, gy, 4, 1);
        if (gx % 20 === 0) {
          x.fillStyle = gx % 40 ? "#e8b830" : "#d23a3a";
          x.fillRect(gx - 2, gy + 1, 5, 6);
        }
      }
      // Scène du DJ
      x.fillStyle = "#1a1430";
      x.fillRect(150, horizon - 26, 80, 26);
      x.fillStyle = "#a66cff";
      x.fillRect(150, horizon - 26, 80, 2);
    } else {
      // Cerisiers en fleurs
      for (const [cx, r] of [
        [30, 22],
        [95, 16],
        [190, 26],
        [235, 14],
      ]) {
        x.fillStyle = "#4a2a2a";
        x.fillRect(cx - 2, horizon - r, 4, r);
        for (let i = 0; i < 60; i++) {
          const a = hash(i, cx, 1) * Math.PI * 2;
          const d = hash(i, cx, 2) * r;
          x.fillStyle = i % 3 ? "#f8b8c8" : "#e88aa8";
          x.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(horizon - r + Math.sin(a) * d * 0.6), 2, 2);
        }
      }
    }
    band(horizon, h, fest ? ["#3a2a2a", "#2e2222"] : ["#6a8a5a", "#5a7a4a", "#4a6a3e"]);
    x.fillStyle = fest ? "#4a3434" : "#f8b8c8";
    for (let i = 0; i < 30; i++) x.fillRect(Math.floor(hash(i, 5, 7) * W), horizon + 4 + Math.floor(hash(i, 6, 7) * (h - horizon - 6)), 2, 1);
  } else if (kind === "tour") {
    // Intérieur de la Tour : murs violets, engrenages en ombre chinoise
    band(0, horizon, ["#2a1e3a", "#33264a", "#3d2e56"]);
    const gear = (cx: number, cy: number, r: number, c: string) => {
      x.fillStyle = c;
      for (let yy = -r - 3; yy <= r + 3; yy++)
        for (let xx = -r - 3; xx <= r + 3; xx++) {
          const d = Math.hypot(xx, yy);
          const ang = Math.atan2(yy, xx);
          const tooth = Math.cos(ang * 8) > 0.4 ? 3 : 0;
          if (d <= r + tooth && d > r * 0.35) x.fillRect(cx + xx, cy + yy, 1, 1);
        }
    };
    gear(40, Math.round(horizon * 0.45), 22, "#241a33");
    gear(205, Math.round(horizon * 0.35), 30, "#241a33");
    gear(120, Math.round(horizon * 0.2), 14, "#2c2040");
    x.fillStyle = "#e8b830";
    for (const cx of [70, 170]) x.fillRect(cx, 0, 2, horizon);
    band(horizon, h, ["#4a3e5a", "#3e3450", "#352c46"]);
    x.fillStyle = "#2a2238";
    for (let gx = 0; gx < W; gx += 20) for (let gy = horizon; gy < h; gy += 10) if (((gx / 20) + Math.floor((gy - horizon) / 10)) % 2 === 0) x.fillRect(gx, gy, 20, 10);
  } else if (kind === "sommet") {
    // Sommet : ciel étoilé et le grand cadran de la Tour
    band(0, horizon, ["#0a0818", "#120e26", "#1c1634"]);
    for (let i = 0; i < 60; i++) {
      x.fillStyle = hash(i, 7, 9) > 0.8 ? "#f8f4e8" : "#6a6090";
      x.fillRect(Math.floor(hash(i, 1, 9) * W), Math.floor(hash(i, 2, 9) * horizon), 1, 1);
    }
    const cx = 120;
    const cy = Math.round(horizon * 0.55);
    const R = Math.min(52, Math.round(horizon * 0.5));
    for (let yy = -R; yy <= R; yy++)
      for (let xx = -R; xx <= R; xx++) {
        const d = Math.hypot(xx, yy);
        if (d > R) continue;
        x.fillStyle = d > R - 3 ? "#e8b830" : d > R - 5 ? "#8a6a20" : "#e8e0c8";
        x.fillRect(cx + xx, cy + yy, 1, 1);
      }
    x.fillStyle = "#1b1626";
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * Math.PI * 2;
      const len = k % 3 === 0 ? 7 : 4;
      for (let t = 0; t < len; t++) x.fillRect(Math.round(cx + Math.cos(ang) * (R - 7 - t)), Math.round(cy + Math.sin(ang) * (R - 7 - t)), 2, 2);
    }
    // Aiguilles sur 23:59
    for (let t = 0; t < R - 14; t++) x.fillRect(Math.round(cx + Math.cos(-Math.PI / 2 - 0.1) * t), Math.round(cy + Math.sin(-Math.PI / 2 - 0.1) * t), 2, 2);
    for (let t = 0; t < R - 24; t++) x.fillRect(Math.round(cx + Math.cos(-Math.PI / 2 - 0.05) * t), Math.round(cy + Math.sin(-Math.PI / 2 - 0.05) * t), 3, 3);
    band(horizon, h, ["#2a2236", "#221c2e", "#1a1524"]);
    x.fillStyle = "#a66cff";
    x.fillRect(0, horizon, W, 1);
  } else if (kind === "dojo") {
    band(0, horizon, ["#6a4a2e", "#7a5a38", "#5a3a22"]);
    // Shoji et lune
    x.fillStyle = "#e8e0c8";
    x.fillRect(70, 10, 100, horizon - 20);
    x.fillStyle = "#5a3a22";
    for (let gx = 70; gx <= 170; gx += 20) x.fillRect(gx, 10, 2, horizon - 20);
    for (let gy = 10; gy <= horizon - 10; gy += 16) x.fillRect(70, gy, 100, 2);
    x.fillStyle = "#f8f4e8";
    x.fillRect(132, 18, 14, 14);
    x.fillStyle = "#c62828";
    x.fillRect(20, 14, 18, 30);
    x.fillRect(202, 14, 18, 30);
    band(horizon, h, ["#c8b878", "#b8a868", "#a89858"]);
    x.fillStyle = "#8a7a48";
    for (let gy = horizon + 8; gy < h; gy += 14) x.fillRect(0, gy, W, 1);
  } else if (kind === "temple" || kind === "sanctuaire") {
    const sanct = kind === "sanctuaire";
    band(0, horizon, sanct ? ["#2a1a2a", "#3a2234", "#4a2a3a"] : ["#8a5a3a", "#9a6a46", "#7a4a2e"]);
    // Poutres et lanternes en papier
    x.fillStyle = sanct ? "#1a0e18" : "#5a3a22";
    for (const cx of [10, 80, 160, 230]) x.fillRect(cx - 4, 0, 8, horizon);
    x.fillRect(0, 10, W, 5);
    for (const cx of [45, 120, 195]) {
      x.fillStyle = "#c62828";
      x.fillRect(cx - 5, 20, 10, 14);
      x.fillStyle = "#e8b830";
      x.fillRect(cx - 5, 26, 10, 1);
    }
    if (sanct) {
      // Haltère d'or géant au fond
      x.fillStyle = "#e8b830";
      x.fillRect(100, horizon - 30, 40, 4);
      x.fillRect(92, horizon - 40, 8, 24);
      x.fillRect(140, horizon - 40, 8, 24);
    }
    band(horizon, h, sanct ? ["#4a2d2d", "#3d2525"] : ["#c8b878", "#b8a868", "#a89858"]);
    x.fillStyle = sanct ? "#331f1f" : "#8a7a48";
    for (let gy = horizon + 8; gy < h; gy += 14) x.fillRect(0, gy, W, 1);
    for (let gx = 0; gx < W; gx += 28) x.fillRect(gx, horizon, 1, h - horizon);
  } else {
    const throne = kind === "trone";
    band(0, horizon, throne ? ["#2a1a3a", "#341f48", "#3e2556"] : ["#d8d0c0", "#cfc6b4", "#c4baa6"]);
    // Colonnes
    for (const cx of [14, 70, 170, 226]) {
      x.fillStyle = throne ? "#5a4670" : "#ece6d8";
      x.fillRect(cx - 6, 6, 12, horizon - 6);
      x.fillStyle = throne ? "#3c2e4c" : "#b8ae98";
      x.fillRect(cx + 3, 6, 3, horizon - 6);
      x.fillRect(cx - 8, 4, 16, 3);
    }
    // Bannières vertes
    for (const cx of [42, 198]) {
      x.fillStyle = "#2f7d3a";
      x.fillRect(cx - 7, 10, 14, horizon * 0.55);
      x.fillStyle = "#e8b830";
      x.fillRect(cx - 2, 18, 4, 4);
    }
    band(horizon, h, throne ? ["#4a2d2d", "#3d2525", "#331f1f"] : ["#a89c88", "#9c907c", "#908470"]);
    // Tapis rouge
    x.fillStyle = "#8e1b1b";
    x.beginPath();
    x.moveTo(108, horizon);
    x.lineTo(132, horizon);
    x.lineTo(170, h);
    x.lineTo(70, h);
    x.fill();
    x.fillStyle = "#e8b830";
    x.fillRect(70, h - 2, 100, 1);
  }
  bgCache.set(k, c);
  return c;
}

/** Plateforme ovale sous un combattant. */
function platform(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, base: string, edge: string) {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry)));
    ctx.fillStyle = y > ry * 0.3 ? edge : base;
    ctx.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2, 1);
  }
}

const PLAT: Record<Battle["def"]["bg"], [string, string]> = {
  rue: ["#3a3946", "#26252f"],
  cite: ["#a8846a", "#7a5c4e"],
  egout: ["#2f5a3a", "#1d3a26"],
  palais: ["#cfc6b4", "#a89c88"],
  trone: ["#6a3a3a", "#4a2525"],
  montagne: ["#6a7a5a", "#4a5a3e"],
  temple: ["#a89858", "#8a7a48"],
  sanctuaire: ["#5a3434", "#3d2525"],
  cerisiers: ["#7a9a6a", "#5a7a4a"],
  festival: ["#5a4040", "#3a2a2a"],
  dojo: ["#a89858", "#8a7a48"],
  tour: ["#4a3a5a", "#2e2440"],
  sommet: ["#3a3046", "#221a2e"],
};

const FX_COLORS: Record<Fx, string[]> = {
  coup: ["#ffffff", "#f8dc8c"],
  feu: ["#ff7a2a", "#ffd04a", "#e03a1a"],
  soin: ["#7cf08a", "#c8ffd0"],
  bonus: ["#ff8a5a", "#ffd04a"],
  malus: ["#6aa8ff", "#a6c8ff"],
  ombre: ["#5a3a8a", "#2a1a40", "#a66cff"],
  lame: ["#ffffff", "#c8d0ff"],
  capsule: ["#a66cff", "#ffd04a", "#f8f4e8"],
  temps: ["#a66cff", "#e8b830", "#f8f4e8"],
  sel: ["#ffffff", "#e8e8f0"],
  huile: ["#f2c14e", "#ffe88a"],
  frites: ["#f2c14e", "#f8dc8c", "#c9952e"],
  feuille: ["#5fbf4a", "#a8db7c"],
  sieste: ["#c8d0ff", "#ffffff"],
  charge: ["#ffd04a", "#ffffff"],
  vinaigre: ["#e8c33a", "#a66cff"],
  titan: ["#ffd04a", "#ffffff", "#ff8a3a"],
  dague: ["#c8d0ff", "#a66cff"],
  sabre: ["#ffffff", "#c8f0ff", "#a6d8ff"],
  son: ["#a66cff", "#6ad0ff", "#ff6fae"],
  bouclier: ["#6ad0ff", "#c8f0ff"],
  terre: ["#8a6a4a", "#5a4430"],
};

export function BattleScreen({
  id,
  team,
  tenue,
  audio,
  reduced,
  height,
  pad,
  onEnd,
}: {
  id: string;
  team: Team;
  tenue?: string;
  audio: Chiptune;
  reduced: boolean;
  height: number;
  pad: MutableRefObject<PadHandler | null>;
  onEnd: (r: BattleEnd) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelPx = useRef(64);
  const startBag = useRef(team.bag);
  const bRef = useRef<Battle>(startBattle(id, team, (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const [b, setB] = useState<Battle>(bRef.current);
  const [disp, setDisp] = useState<Disp>(() => freshDisp(bRef.current));
  const dispRef = useRef(disp);
  const [mode, setMode] = useState<Mode>("intro");
  const modeRef = useRef<Mode>("intro");
  const [cur, setCur] = useState(0);
  const curRef = useRef(0);
  const [text, setText] = useState("");
  const [typed, setTyped] = useState(0);
  const queue = useRef<BattleEvent[]>([]);
  const waitT = useRef<ReturnType<typeof setTimeout>>(undefined);
  const after = useRef<(() => void) | null>(null);
  const tutoShown = useRef(false);
  const anim = useRef<Anim>({
    t: 0,
    lunge: null,
    blink: null,
    shake: 0,
    flash: 0,
    flashColor: "255,255,255",
    slide: { ally: 1, foe: 1 },
    faint: { ally: 0, foe: 0 },
    charge: { ally: false, foe: false },
    parts: [],
    pops: [],
    intro: 0,
    capsule: null,
  });
  const speed = reduced ? 0.6 : 1;

  const setModeBoth = (m: Mode) => {
    modeRef.current = m;
    setMode(m);
  };
  const setCurBoth = (n: number) => {
    curRef.current = n;
    setCur(n);
  };
  const patchDisp = (fn: (d: Disp) => Disp) => {
    dispRef.current = fn(dispRef.current);
    setDisp(dispRef.current);
  };

  // Le cadre du bas occupe une partie de l'écran : la scène se dessine au-dessus.
  useEffect(() => {
    const p = panel.current;
    const c = canvas.current;
    if (!p || !c) return;
    const fit = () => {
      const ch = c.getBoundingClientRect().height;
      const ph = p.getBoundingClientRect().height;
      if (ch > 0) panelPx.current = Math.round((ph / ch) * height);
      root.current?.style.setProperty("--bt-panel", `${Math.round(ph)}px`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(p);
    ro.observe(c);
    return () => ro.disconnect();
  }, [height]);

  // ─── Positions dans la scène ───

  const scene = useCallback(() => {
    const sh = Math.max(110, height - panelPx.current);
    // Grand écran : sprites doublés (pixels nets), comme les combats des consoles portables
    const k = sh >= 230 ? 2 : 1;
    return {
      sh,
      k,
      foe: { x: 176, y: Math.round(sh * 0.46) },
      ally: { x: 62, y: sh - 6 },
    };
  }, [height]);

  const spawn = useCallback((fx: Fx, side: Side, from: Side) => {
    const a = anim.current;
    if (reduced) return;
    const s = scene();
    const tgt = side === "foe" ? { x: s.foe.x, y: s.foe.y - 24 * s.k } : { x: s.ally.x, y: s.ally.y - 26 * s.k };
    const src = from === "foe" ? { x: s.foe.x, y: s.foe.y - 24 * s.k } : { x: s.ally.x + 10 * s.k, y: s.ally.y - 30 * s.k };
    const cols = FX_COLORS[fx];
    const rand = (k: number) => Math.random() * k;
    const push = (p: Partial<Particle> & { x: number; y: number }) =>
      a.parts.push({ vx: 0, vy: 0, life: 0.6, max: 0.6, c: cols[Math.floor(rand(cols.length))], s: 2, ...p });
    switch (fx) {
      case "feu":
      case "huile":
      case "vinaigre":
      case "sel":
      case "terre":
        for (let i = 0; i < 18; i++) {
          const k = 0.35 + rand(0.3);
          push({ x: src.x, y: src.y, vx: (tgt.x - src.x) / k + rand(30) - 15, vy: (tgt.y - src.y) / k + rand(30) - 15, life: k, max: k, s: fx === "sel" ? 1 : 2 });
        }
        break;
      case "frites":
        for (let i = 0; i < 16; i++) push({ x: tgt.x - 24 + rand(48), y: tgt.y - 40 - rand(30), vy: 120 + rand(60), life: 0.5, max: 0.5, s: 3 });
        break;
      case "feuille":
        for (let i = 0; i < 12; i++) push({ x: tgt.x + rand(30) - 15, y: tgt.y + rand(20) - 10, vx: rand(80) - 40, vy: rand(80) - 40, life: 0.5, max: 0.5, s: 2 });
        break;
      case "soin":
      case "bonus":
        for (let i = 0; i < 12; i++) push({ x: src.x + rand(30) - 15, y: src.y + 14 + rand(10), vy: -40 - rand(30), life: 0.8, max: 0.8, s: 2, kind: fx === "bonus" ? "up" : undefined });
        break;
      case "malus":
        for (let i = 0; i < 10; i++) push({ x: tgt.x + rand(30) - 15, y: tgt.y - 14 - rand(10), vy: 40 + rand(20), life: 0.7, max: 0.7, kind: "down" });
        break;
      case "sieste":
        for (let i = 0; i < 3; i++) push({ x: src.x + 10 + i * 6, y: src.y - 6 - i * 4, vx: 10, vy: -20, life: 1, max: 1, kind: "z" });
        break;
      case "bouclier":
      case "charge":
        push({ x: src.x, y: src.y + 4, life: 0.7, max: 0.7, kind: "ring", s: fx === "charge" ? 30 : 26 });
        break;
      case "temps":
        // Aiguilles qui tournent autour de la cible
        for (let i = 0; i < 20; i++) {
          const ang = (i / 20) * Math.PI * 2;
          push({ x: tgt.x + Math.cos(ang) * 8, y: tgt.y + Math.sin(ang) * 6, vx: Math.cos(ang + 1.2) * 70, vy: Math.sin(ang + 1.2) * 55, life: 0.55, max: 0.55, s: 2 });
        }
        break;
      case "ombre":
        for (let i = 0; i < 16; i++) {
          const ang = (i / 16) * Math.PI * 2;
          push({ x: tgt.x + Math.cos(ang) * 26, y: tgt.y + Math.sin(ang) * 20, vx: -Math.cos(ang) * 50, vy: -Math.sin(ang) * 40, life: 0.5, max: 0.5, s: 3 });
        }
        break;
      default:
        // coup, lame : éclats au point d'impact
        for (let i = 0; i < 10; i++) {
          const ang = rand(Math.PI * 2);
          push({ x: tgt.x, y: tgt.y, vx: Math.cos(ang) * 90, vy: Math.sin(ang) * 90, life: 0.3, max: 0.3, s: 2 });
        }
        if (fx === "lame" || fx === "sabre") for (let i = 0; i < 14; i++) push({ x: tgt.x - 18 + i * 2.6, y: tgt.y - 18 + i * 2.6, life: 0.3, max: 0.3, s: 2, c: "#ffffff" });
    }
  }, [reduced, scene]);

  // ─── Lecture des événements ───

  const say = useCallback((t: string) => {
    setText(t);
    setTyped(reduced ? t.length : 0);
  }, [reduced]);

  const playNext = useCallback(() => {
    clearTimeout(waitT.current);
    const e = queue.current.shift();
    if (!e) {
      const k = after.current;
      after.current = null;
      k?.();
      return;
    }
    const a = anim.current;
    let wait = 0;
    const later = (ms: number) => {
      wait = ms * speed;
    };
    const idx = (side: Side) => (side === "ally" ? dispRef.current.a : dispRef.current.f);
    switch (e.kind) {
      case "text":
        say(e.text);
        later(Math.max(900, e.text.length * 30));
        break;
      case "use": {
        a.charge[e.side] = false;
        a.lunge = { side: e.side, t: 0 };
        const m = MOVES[e.move];
        spawn(e.fx, m.target === "foe" ? (e.side === "ally" ? "foe" : "ally") : e.side, e.side);
        if (e.fx === "feu" || e.fx === "huile") audio.fire();
        else if (e.fx === "soin" || e.fx === "sieste") audio.heal();
        else if (e.fx === "bonus" || e.fx === "bouclier") audio.buff(true);
        else if (e.fx === "malus") audio.buff(false);
        else audio.select();
        later(380);
        break;
      }
      case "charge":
        a.charge[e.side] = true;
        audio.charge();
        spawn("charge", e.side, e.side);
        later(450);
        break;
      case "damage": {
        a.blink = { side: e.side, t: 0 };
        a.shake = e.crit ? 0.45 : 0.25;
        if (e.crit) {
          a.flash = 0.6;
          a.flashColor = "255,255,255";
        }
        a.pops.push({ side: e.side, text: `-${e.amount}`, c: e.crit ? "#ffd04a" : "#ffffff", t: 0 });
        audio.strike(e.crit);
        navigator.vibrate?.(e.crit ? [30, 20, 40] : 18);
        const i = idx(e.side);
        patchDisp((d) => (e.side === "ally" ? { ...d, allyHp: d.allyHp.map((h, j) => (j === i ? e.hp : h)) } : { ...d, foeHp: d.foeHp.map((h, j) => (j === i ? e.hp : h)) }));
        later(e.hit > 0 ? 260 : 480);
        break;
      }
      case "heal": {
        const i = idx(e.side);
        if (e.amount > 0) a.pops.push({ side: e.side, text: `+${e.amount}`, c: "#7cf08a", t: 0 });
        patchDisp((d) => (e.side === "ally" ? { ...d, allyHp: d.allyHp.map((h, j) => (j === i ? e.hp : h)) } : { ...d, foeHp: d.foeHp.map((h, j) => (j === i ? e.hp : h)) }));
        spawn("soin", e.side, e.side);
        later(420);
        break;
      }
      case "miss":
        a.pops.push({ side: e.side, text: "RATÉ", c: "#c8d0ff", t: 0 });
        audio.miss();
        later(300);
        break;
      case "status": {
        const i = idx(e.side);
        patchDisp((d) =>
          e.side === "ally" ? { ...d, allyStatus: d.allyStatus.map((s, j) => (j === i ? e.status : s)) } : { ...d, foeStatus: d.foeStatus.map((s, j) => (j === i ? e.status : s)) },
        );
        if (e.status === "brule") spawn("feu", e.side, e.side);
        later(200);
        break;
      }
      case "stage":
        spawn(e.n > 0 ? "bonus" : "malus", e.side, e.side);
        a.pops.push({ side: e.side, text: `${STAT_LABEL[e.stat]} ${e.n > 0 ? "▲" : "▼"}`, c: e.n > 0 ? "#ffb070" : "#8ab8ff", t: 0 });
        audio.buff(e.n > 0);
        later(380);
        break;
      case "faint":
        a.faint[e.side] = 0.001;
        a.charge[e.side] = false;
        audio.faint();
        later(650);
        break;
      case "enter": {
        a.faint[e.side] = 0;
        a.slide[e.side] = 0;
        if (e.side === "ally") patchDisp((d) => ({ ...d, a: e.index, showAlly: true }));
        else patchDisp((d) => ({ ...d, f: e.index, showFoe: true }));
        audio.jump(false);
        later(450);
        break;
      }
      case "phase": {
        a.flash = 1;
        a.flashColor = "198,40,40";
        a.shake = 0.8;
        audio.charge();
        navigator.vibrate?.([60, 40, 90]);
        const i = dispRef.current.f;
        if (e.sprite) patchDisp((d) => ({ ...d, foeSprite: d.foeSprite.map((s, j) => (j === i ? e.sprite! : s)) }));
        say(e.text);
        later(Math.max(1600, e.text.length * 32));
        break;
      }
      case "transform": {
        a.flash = 1;
        a.flashColor = e.on ? "255,208,74" : "255,255,255";
        a.shake = e.on ? 0.9 : 0.2;
        const i = dispRef.current.a;
        patchDisp((d) => ({ ...d, allySprite: d.allySprite.map((x, j) => (j === i ? e.sprite : x)) }));
        if (e.on) {
          spawn("titan", "ally", "ally");
          audio.milestone();
          navigator.vibrate?.([50, 30, 50, 30, 120]);
        }
        later(e.on ? 900 : 400);
        break;
      }
      case "capture": {
        a.capsule = { t: 0, shakes: e.shakes, ok: e.ok };
        audio.jump(true);
        const shakeAt = (i: number) => setTimeout(() => audio.select(), (0.9 + i * 0.55) * 1000 * speed);
        for (let i = 0; i < e.shakes; i++) shakeAt(i);
        setTimeout(() => {
          if (e.ok) audio.milestone();
          else audio.miss();
          navigator.vibrate?.(e.ok ? [40, 30, 90] : 30);
        }, (0.9 + e.shakes * 0.55) * 1000 * speed);
        later(capsuleTime(e.shakes) * 1000);
        break;
      }
      case "end":
        break;
    }
    waitT.current = setTimeout(playNext, wait);
  }, [audio, say, spawn, speed]);

  const play = useCallback((evs: BattleEvent[], then: () => void) => {
    queue.current = [...evs];
    after.current = then;
    setModeBoth("events");
    playNext();
  }, [playNext]);

  // ─── Fin de combat ───

  const finish = useCallback((bt: Battle) => {
    const sp = spoils(bt);
    if (bt.over === "win") {
      const lines: BattleEvent[] = [
        { kind: "text", text: bt.captured ? `${MEMBERS[bt.captured.species]?.name ?? "La créature"} rejoint le BESTIAIRE ! L'équipe gagne ${sp.xp} XP.` : `Victoire ! L'équipe gagne ${sp.xp} XP et ${sp.fp} FP.` },
      ];
      for (const [k, n] of Object.entries(sp.drops)) lines.push({ kind: "text", text: `Butin : ${nameOf(k)}${n > 1 ? ` ×${n}` : ""}.` });
      audio.music(null);
      audio.win();
      play(lines, () => {
        setModeBoth("done");
        onEnd({ outcome: "win", captured: bt.captured, fought: bt.fought, hp: hpAfter(bt), xp: sp.xp, fp: bt.captured ? 0 : sp.fp, bag: bagAfter(bt.bag, { ...sp, drops: { ...(bt.def.drops ?? {}) }, used: {} }), notes: [] });
      });
    } else if (bt.over === "lose") {
      audio.music(null);
      audio.over();
      play([{ kind: "text", text: "L'équipe est K.O. … Sparrow se relève, un peu sonné. Rien n'est perdu." }], () => {
        setCurBoth(0);
        setModeBoth("lost");
        say(freshFight(bt.def) ? "Réessayer le combat, ou se retirer pour se préparer ?" : "Direction l'infirmerie : l'équipe y sera soignée.");
      });
    } else {
      audio.music(null);
      setModeBoth("done");
      onEnd({ outcome: "flee", hp: hpAfter(bt), xp: 0, fp: 0, bag: bt.bag, notes: [] });
    }
  }, [audio, onEnd, play, say]);

  /** Après les animations d'un tour : menu, remplacement forcé, attaque préparée ou fin. */
  const settle = useCallback(() => {
    const bt = bRef.current;
    if (bt.over) return finish(bt);
    if (mustSwap(bt)) {
      setCurBoth(bt.allies.findIndex((x) => x.hp > 0));
      setModeBoth("party");
      say("Qui prend la relève ?");
      return;
    }
    const f = forced(bt);
    if (f) {
      // Passe par la file d'événements : A (qui saute l'attente) lance aussi le tour préparé.
      queue.current = [];
      after.current = () => doTurn.current(f);
      setModeBoth("events");
      waitT.current = setTimeout(playNext, 300 * speed);
      return;
    }
    setCurBoth(0);
    setModeBoth("menu");
    say(`Que doit faire ${ally(bt).name} ?`);
  }, [finish, playNext, say, speed]);

  const doTurn = useRef<(a: Action) => void>(() => {});
  useEffect(() => {
    doTurn.current = (act: Action) => {
      const r = playTurn(bRef.current, act);
      bRef.current = r.battle;
      setB(r.battle);
      play(r.events, settle);
    };
  });

  // ─── Entrée en combat ───

  const begin = useCallback(() => {
    const bt = bRef.current;
    audio.music(bt.def.music ?? "combat");
    const evs: BattleEvent[] = [{ kind: "text", text: bt.def.intro }];
    if (bt.allies.length > 1) evs.push({ kind: "text", text: `${ally(bt).name} s'avance, ${bt.allies.slice(1).map((x) => x.name).join(" et ")} en renfort.` });
    if (bt.def.tutorial && !tutoShown.current) {
      tutoShown.current = true;
      evs.push(
        { kind: "text", text: "Chevalier Noir : « Premier combat, Élu ? Choisis ATTAQUER, puis une technique. PUI = puissance, PRÉ = précision. »" },
        { kind: "text", text: "Chevalier Noir : « Une attaque préparée frappe fort au tour suivant… mais l'ennemi la voit venir. »" },
        { kind: "text", text: "Chevalier Noir : « Et si ça tourne mal, COMPAGNONS : je prendrai ta place. Changer d'équipier coûte un tour. »" },
      );
    }
    play(evs, settle);
  }, [audio, play, settle]);

  useEffect(() => {
    audio.encounter();
    const a = anim.current;
    a.intro = reduced ? 1 : 0;
    a.slide = { ally: reduced ? 1 : 0, foe: reduced ? 1 : 0 };
    const t = setTimeout(begin, reduced ? 100 : 1500);
    return () => {
      clearTimeout(t);
      clearTimeout(waitT.current);
      audio.music(null);
    };
    // Une seule fois à l'ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Rendu ───

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const a = anim.current;
      a.t += dt;
      a.shake = Math.max(0, a.shake - dt);
      a.flash = Math.max(0, a.flash - dt * 2);
      if (a.intro < 1) a.intro = Math.min(1, a.intro + dt / 1.4);
      const entering = a.intro > 0.62;
      for (const s of ["ally", "foe"] as Side[]) {
        if (entering && a.slide[s] < 1) a.slide[s] = Math.min(1, a.slide[s] + dt / 0.5);
        if (a.faint[s] > 0 && a.faint[s] < 1) a.faint[s] = Math.min(1, a.faint[s] + dt / 0.55);
      }
      if (a.lunge) {
        a.lunge.t += dt / 0.3;
        if (a.lunge.t >= 1) a.lunge = null;
      }
      if (a.blink) {
        a.blink.t += dt / 0.45;
        if (a.blink.t >= 1) a.blink = null;
      }
      for (const p of a.parts) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= dt;
      }
      a.parts = a.parts.filter((p) => p.life > 0);
      for (const p of a.pops) p.t += dt;
      if (a.capsule && (a.capsule.t < capsuleTime(a.capsule.shakes) || !a.capsule.ok)) {
        const before = a.capsule.t;
        a.capsule.t += dt / speed;
        const end = 0.9 + a.capsule.shakes * 0.55;
        const sc = scene();
        const at = { x: sc.foe.x, y: sc.foe.y - 10 * sc.k };
        const burst = (c: string[], n: number) => {
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2;
            a.parts.push({ x: at.x, y: at.y, vx: Math.cos(ang) * 80, vy: Math.sin(ang) * 70, life: 0.6, max: 0.6, c: c[i % c.length], s: 2 });
          }
        };
        if (before < 0.5 && a.capsule.t >= 0.5) {
          a.flash = 0.5;
          a.flashColor = "166,108,255";
          burst(["#a66cff", "#f8f4e8"], 14);
        }
        if (before < end && a.capsule.t >= end) {
          if (a.capsule.ok) burst(["#ffd04a", "#f8f4e8", "#a66cff"], 22);
          else {
            a.flash = 0.4;
            a.flashColor = "255,255,255";
            burst(["#f8f4e8", "#c8d0ff"], 16);
          }
        }
        if (!a.capsule.ok && a.capsule.t > capsuleTime(a.capsule.shakes)) a.capsule = null;
      }
      a.pops = a.pops.filter((p) => p.t < 0.9);

      const s = scene();
      const d = dispRef.current;
      const bt = bRef.current;
      const sx = a.shake > 0 && !reduced ? Math.round(Math.sin(a.t * 70) * 2) : 0;
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      ctx.translate(sx, 0);
      ctx.drawImage(background(bt.def.bg, height), 0, 0);
      const [pb, pe] = PLAT[bt.def.bg];
      platform(ctx, s.foe.x, s.foe.y, 40 * s.k, 8 * s.k, pb, pe);
      platform(ctx, s.ally.x, s.ally.y - 2, Math.min(58, 40 * s.k), 9 * s.k, pb, pe);

      // Ennemi
      const fo = bt.foes[d.f];
      if (fo && d.showFoe) {
        const spr = battler(d.foeSprite[d.f] ?? fo.sprite);
        const slide = 1 - a.slide.foe;
        let x = s.foe.x - (spr.width * s.k) / 2 - slide * 220;
        let y = s.foe.y - spr.height * s.k + 4 * s.k + (Math.floor(a.t * 2) % 2) * s.k;
        if (a.lunge?.side === "foe") {
          const k = Math.sin(a.lunge.t * Math.PI);
          x -= k * 10;
          y += k * 6;
        }
        const cap = a.capsule;
        const inside = !!cap && cap.t >= 0.5 && (cap.ok || cap.t < 0.9 + cap.shakes * 0.55);
        const hidden = inside || (a.blink?.side === "foe" && Math.floor(a.blink.t * 8) % 2 === 0);
        drawFighter(ctx, spr, x, y, s.k, a.faint.foe, hidden, a.charge.foe, a.t);
      }
      // Capsule d'Écho
      if (a.capsule) {
        const cap = a.capsule;
        const k = s.k;
        const end = 0.9 + cap.shakes * 0.55;
        const ground = { x: s.foe.x, y: s.foe.y - 4 * k };
        if (cap.t < 0.5) {
          // Lancer en cloche depuis Sparrow
          const u = cap.t / 0.5;
          const from = { x: s.ally.x + 10 * k, y: s.ally.y - 40 * k };
          drawCapsule(ctx, from.x + (ground.x - from.x) * u, from.y + (ground.y - 30 * k - from.y) * u - Math.sin(u * Math.PI) * 30 * k, k);
        } else if (cap.t < 0.9) {
          const u = (cap.t - 0.5) / 0.4;
          drawCapsule(ctx, ground.x, ground.y - 30 * k * (1 - u) - Math.abs(Math.sin(u * Math.PI * 2)) * 6 * k * (1 - u), k);
        } else if (cap.t < end) {
          // Secousses : la capsule bascule de gauche à droite
          const u = ((cap.t - 0.9) % 0.55) / 0.55;
          const dx = u < 0.5 ? Math.sin(u * Math.PI * 2) * 3 * k : 0;
          drawCapsule(ctx, ground.x + dx, ground.y, k);
        } else if (cap.ok) {
          drawCapsule(ctx, ground.x, ground.y, k);
          if (Math.floor(a.t * 4) % 2 === 0) {
            ctx.fillStyle = "#ffd04a";
            ctx.fillRect(Math.round(ground.x + 7 * k), Math.round(ground.y - 8 * k), 2 * k, 2 * k);
            ctx.fillRect(Math.round(ground.x - 9 * k), Math.round(ground.y - 5 * k), k, k);
          }
        } else drawCapsule(ctx, ground.x, ground.y, k, Math.min(1, (cap.t - end) / 0.2));
      }
      // Équipier actif (de dos)
      const al = bt.allies[d.a];
      if (al && d.showAlly) {
        const spr = battler(d.allySprite[d.a] ?? al.sprite, tenue);
        const slide = 1 - a.slide.ally;
        let x = s.ally.x - (spr.width * s.k) / 2 + slide * 220;
        let y = s.ally.y - spr.height * s.k + 2 + (Math.floor(a.t * 2 + 1) % 2) * s.k;
        if (a.lunge?.side === "ally") {
          const k = Math.sin(a.lunge.t * Math.PI);
          x += k * 12;
          y -= k * 6;
        }
        const hidden = a.blink?.side === "ally" && Math.floor(a.blink.t * 8) % 2 === 0;
        drawFighter(ctx, spr, x, y, s.k, a.faint.ally, hidden, a.charge.ally, a.t);
      }

      // Effets
      for (const p of a.parts) {
        const k = p.life / p.max;
        ctx.globalAlpha = Math.min(1, k * 1.6);
        ctx.fillStyle = p.c;
        if (p.kind === "ring") {
          const r = Math.round(p.s * (1 - k) + 4);
          for (let i = 0; i < 24; i++) {
            const ang = (i / 24) * Math.PI * 2;
            ctx.fillRect(Math.round(p.x + Math.cos(ang) * r), Math.round(p.y + Math.sin(ang) * r * 0.7), 2, 2);
          }
        } else if (p.kind === "z") {
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 4, 1);
          ctx.fillRect(Math.round(p.x + 2), Math.round(p.y + 1), 1, 1);
          ctx.fillRect(Math.round(p.x + 1), Math.round(p.y + 2), 1, 1);
          ctx.fillRect(Math.round(p.x), Math.round(p.y + 3), 4, 1);
        } else if (p.kind === "up" || p.kind === "down") {
          const dir = p.kind === "up" ? -1 : 1;
          ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 4);
          ctx.fillRect(Math.round(p.x - 1), Math.round(p.y + (dir < 0 ? 1 : 2)), 3, 1);
        } else ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
      }
      ctx.globalAlpha = 1;
      // Chiffres de dégâts
      ctx.font = "bold 9px ui-monospace, monospace";
      ctx.textAlign = "center";
      for (const p of a.pops) {
        const base = p.side === "foe" ? { x: s.foe.x, y: s.foe.y - 50 * s.k } : { x: s.ally.x + 24 * s.k, y: s.ally.y - 56 * s.k };
        const y = base.y - p.t * 18;
        ctx.globalAlpha = Math.min(1, (0.9 - p.t) * 4);
        ctx.fillStyle = "#1b1626";
        ctx.fillText(p.text, base.x + 1, y + 1);
        ctx.fillStyle = p.c;
        ctx.fillText(p.text, base.x, y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // Transition d'entrée : éclairs, puis volet en bandes qui se retire
      if (a.intro < 1) {
        const k = a.intro;
        if (k < 0.3) {
          if (Math.floor(k * 20) % 2 === 0) {
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, W, height);
          }
        } else {
          const open = Math.max(0, (k - 0.45) / 0.55);
          const close = Math.min(1, (k - 0.3) / 0.15);
          const bands = 12;
          const bh = Math.ceil(height / bands);
          ctx.fillStyle = "#000";
          for (let i = 0; i < bands; i++) {
            const w = Math.round(W * (open > 0 ? 1 - open : close));
            ctx.fillRect(i % 2 ? W - w : 0, i * bh, w, bh);
          }
        }
      }
      if (a.flash > 0) {
        ctx.fillStyle = `rgba(${a.flashColor},${Math.min(0.8, a.flash)})`;
        ctx.fillRect(0, 0, W, height);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [height, reduced, scene, tenue]);

  // Texte progressif
  useEffect(() => {
    if (typed >= text.length) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 18);
    return () => clearTimeout(t);
  }, [text, typed]);

  // ─── Choix du joueur ───

  const items = usable(b);
  const me = ally(b);

  const choose = useCallback((m: Mode, i: number) => {
    const bt = bRef.current;
    audio.select();
    if (m === "menu") {
      if (i === 0) {
        setCurBoth(0);
        setModeBoth("moves");
      } else if (i === 1) {
        if (!Object.values(bt.bag).some((n) => n > 0)) return say("Le sac est vide. Il reste des miettes de frites, mais ça ne compte pas.");
        setCurBoth(0);
        setModeBoth("items");
      } else if (i === 2) {
        if (bt.allies.length < 2) return say("Personne d'autre dans l'équipe… pour l'instant.");
        setCurBoth(bt.a);
        setModeBoth("party");
      } else doTurn.current({ kind: "flee" });
    } else if (m === "moves") {
      const fl = forms(bt);
      if (i >= 4 && fl[i - 4]) return doTurn.current({ kind: "transform", form: fl[i - 4] });
      const id = ally(bt).moves[i];
      if (id) doTurn.current({ kind: "move", move: id });
    } else if (m === "items") {
      const list = usable(bt);
      const it = list[i];
      if (!it) return;
      const c = CONSUMABLES[it[0]];
      let target = bt.a;
      if (c.ko) {
        target = bt.allies.findIndex((x) => x.hp <= 0);
        if (target < 0) return say("Personne n'est K.O. Garde-le pour plus tard.");
      }
      doTurn.current({ kind: "item", item: it[0], target });
    } else if (m === "party") {
      const x = bt.allies[i];
      if (!x) return;
      if (x.hp <= 0) return say(`${x.name} est K.O.`);
      if (i === bt.a && !mustSwap(bt)) return say(`${x.name} est déjà au combat !`);
      doTurn.current({ kind: "swap", to: i });
    } else if (m === "lost") {
      if (i === 0 && freshFight(bt.def)) {
        // Réessayer : même combat, équipe soignée, sac d'origine
        const nb = startBattle(id, { ...team, bag: startBag.current }, (Date.now() ^ 0x9e3779b9) >>> 0);
        bRef.current = nb;
        setB(nb);
        dispRef.current = freshDisp(nb);
        setDisp(dispRef.current);
        const a = anim.current;
        a.faint = { ally: 0, foe: 0 };
        a.slide = { ally: 0, foe: 0 };
        a.charge = { ally: false, foe: false };
        a.capsule = null;
        audio.music(nb.def.music ?? "combat");
        play([{ kind: "text", text: "On recommence. Cette fois, c'est la bonne." }], settle);
      } else {
        setModeBoth("done");
        onEnd({ outcome: "lose", xp: 0, fp: 0, bag: bagAfter(bt.bag, { xp: 0, fp: 0, drops: {}, used: {} }), notes: [] });
      }
    }
  }, [audio, id, onEnd, play, say, settle, team]);

  const back = useCallback(() => {
    const m = modeRef.current;
    if (m === "moves" || m === "items" || (m === "party" && !mustSwap(bRef.current))) {
      audio.jump(false);
      setCurBoth(m === "moves" ? 0 : m === "items" ? 1 : 2);
      setModeBoth("menu");
      say(`Que doit faire ${ally(bRef.current).name} ?`);
    }
  }, [audio, say]);

  // Commandes de la console
  useEffect(() => {
    pad.current = {
      a: () => {
        const m = modeRef.current;
        if (m === "events" || m === "intro") {
          // A accélère le texte en cours
          if (typed < text.length) setTyped(text.length);
          else if (m === "events" && queue.current.length >= 0 && waitT.current) {
            clearTimeout(waitT.current);
            playNext();
          }
          return;
        }
        if (m === "done") return;
        choose(m, curRef.current);
      },
      b: back,
      dir: (dd) => {
        const m = modeRef.current;
        const c = curRef.current;
        if (m === "menu" || m === "moves") {
          const n = m === "menu" ? 4 : bRef.current.allies[bRef.current.a].moves.length;
          // Transformations sous les 4 techniques (index 4 et 5)
          const nf = m === "moves" ? forms(bRef.current).length : 0;
          const last = 3 + nf;
          let x = c;
          if (c >= 4) x = dd === "up" ? (c === 4 ? 2 : c - 1) : dd === "down" ? (c < last ? c + 1 : 0) : c;
          else if (dd === "left" || dd === "right") x = c % 2 ? c - 1 : c + 1;
          else if (nf && ((dd === "down" && c >= 2) || (dd === "up" && c < 2))) x = dd === "down" ? 4 : last;
          else x = (c + 2) % 4;
          if (x < n || (x >= 4 && x <= last)) setCurBoth(x);
          audio.select();
        } else if (m === "items") {
          const n = usable(bRef.current).length;
          if (!n) return;
          setCurBoth(dd === "up" || dd === "left" ? (c - 1 + n) % n : (c + 1) % n);
          audio.select();
        } else if (m === "party" || m === "lost") {
          const n = m === "party" ? bRef.current.allies.length : lostOptions(bRef.current).length;
          if (!n) return;
          if (dd === "up" || dd === "left") setCurBoth((c - 1 + n) % n);
          else setCurBoth((c + 1) % n);
          audio.select();
        }
      },
    };
    return () => {
      pad.current = null;
    };
  }, [audio, back, choose, pad, playNext, text, typed]);

  // ─── Cadres ───

  const fo = b.foes[disp.f];
  const al = b.allies[disp.a];
  const hpPct = (hp: number, max: number) => Math.max(0, Math.min(100, (hp / max) * 100));
  const hpClass = (p: number) => (p > 50 ? "" : p > 20 ? " is-mid" : " is-low");
  const foeHp = disp.foeHp[disp.f] ?? 0;
  const allyHp = disp.allyHp[disp.a] ?? 0;
  const st = (s: string | null) => (s === "brule" ? <b className="bt-status bt-status--brule">BRÛ</b> : s === "etourdi" ? <b className="bt-status bt-status--etourdi">ÉTO</b> : s === "endormi" ? <b className="bt-status bt-status--endormi">SOM</b> : null);
  const showBoxes = mode !== "intro";
  const fl = forms(b);
  const sel =
    mode === "moves"
      ? cur >= 4 && fl[cur - 4]
        ? { power: 0, acc: 100, desc: `Transformation (une seule par combat) : ${FORMS[fl[cur - 4]].desc} pendant ${b.titan.turns} tours.`, hits: undefined, charge: undefined }
        : MOVES[me.moves[cur]]
      : null;

  return (
    <div ref={root} className="bt" role="dialog" aria-label="Combat">
      <canvas ref={canvas} width={W} height={height} className="bt-canvas" aria-hidden="true" />
      {showBoxes && fo && (
        <div className="bt-box bt-box--foe mono" aria-label={`${fo.name}, niveau ${fo.lv}, ${Math.round(hpPct(foeHp, fo.maxHp))} % de PV`}>
          <p className="bt-box__name">
            {fo.name}
            {st(disp.foeStatus[disp.f])}
            <span>Nv{fo.lv}</span>
          </p>
          <p className="bt-hp">
            <em>PV</em>
            <span className="bt-hp__bar">
              <i className={hpClass(hpPct(foeHp, fo.maxHp))} style={{ width: `${hpPct(foeHp, fo.maxHp)}%` }} />
            </span>
          </p>
          {b.foes.length > 1 && (
            <p className="bt-box__team" aria-hidden="true">
              {b.foes.map((x, i) => (
                <i key={i} className={(disp.foeHp[i] ?? x.hp) > 0 ? "" : "is-ko"} />
              ))}
            </p>
          )}
        </div>
      )}
      {showBoxes && al && (
        <div className="bt-box bt-box--ally mono" aria-label={`${al.name}, niveau ${al.lv}, ${allyHp} PV sur ${al.maxHp}`}>
          <p className="bt-box__name">
            {al.name}
            {st(disp.allyStatus[disp.a])}
            <span>Nv{al.lv}</span>
          </p>
          <p className="bt-hp">
            <em>PV</em>
            <span className="bt-hp__bar">
              <i className={hpClass(hpPct(allyHp, al.maxHp))} style={{ width: `${hpPct(allyHp, al.maxHp)}%` }} />
            </span>
          </p>
          <p className="bt-box__num">
            {allyHp}/{al.maxHp}
          </p>
        </div>
      )}

      <div ref={panel} className="bt-panel mono">
        {(mode === "menu" || mode === "intro" || mode === "events" || mode === "done" || mode === "lost") && (
          <p className="bt-text" aria-live="polite">
            {text.slice(0, typed)}
            <span className="sr-only">{text}</span>
          </p>
        )}
        {mode === "menu" && (
          <div className="bt-grid bt-grid--main">
            {MAIN.map((l, i) => (
              <button key={l} type="button" className={cur === i ? "is-on" : ""} onClick={() => choose("menu", i)}>
                <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
                {l}
              </button>
            ))}
          </div>
        )}
        {mode === "moves" && (
          <div className="bt-moves">
            <div className="bt-grid">
              {me.moves.map((mid, i) => (
                <button key={mid} type="button" className={cur === i ? "is-on" : ""} onClick={() => choose("moves", i)}>
                  <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
                  {MOVES[mid].name}
                </button>
              ))}
              {fl.map((f, k) => (
                <button key={f} type="button" className={`bt-titan bt-titan--${f}${cur === 4 + k ? " is-on" : ""}`} onClick={() => choose("moves", 4 + k)}>
                  <span className="gb-cursor">{cur === 4 + k ? "▶" : ""}</span>★ {FORMS[f].name}
                </button>
              ))}
            </div>
            {sel && (
              <p className="bt-info">
                <span>
                  PUI {sel.power ? (sel.hits ? `${sel.power}×${sel.hits[0]}-${sel.hits[1]}` : sel.power) : "—"} · PRÉ {sel.acc}
                  {sel.charge ? " · 1 tour" : ""}
                </span>
                {sel.desc}
              </p>
            )}
            <button type="button" className="bt-back" onClick={back}>
              B : retour
            </button>
          </div>
        )}
        {mode === "items" && (
          <div className="bt-moves">
            {items.length ? (
              <div className="bt-grid bt-grid--items">
                {items.map(([k, n], i) => (
                  <button key={k} type="button" className={`${cur === i ? "is-on" : ""}${CONSUMABLES[k].capture ? " is-capture" : ""}`} onClick={() => choose("items", i)} ref={cur === i ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}>
                    <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
                    <span className="bt-list__name">{CONSUMABLES[k].name}</span>
                    <b>×{n}</b>
                  </button>
                ))}
              </div>
            ) : (
              <p className="bt-info">Le sac est vide.</p>
            )}
            {items[cur] && <p className="bt-info">{CONSUMABLES[items[cur][0]].desc}</p>}
            <button type="button" className="bt-back" onClick={back}>
              B : retour
            </button>
          </div>
        )}
        {mode === "party" && (
          <div className="bt-list">
            {mustSwap(b) && <p className="bt-text">Qui prend la relève ?</p>}
            {b.allies.map((x, i) => (
              <button key={x.id} type="button" className={`${cur === i ? "is-on" : ""}${x.hp <= 0 ? " is-ko" : ""}`} onClick={() => choose("party", i)}>
                <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
                <span className="bt-list__name">
                  {x.name} <small>Nv{x.lv}</small>
                </span>
                <span className="bt-hp__bar bt-hp__bar--mini">
                  <i className={hpClass(hpPct(x.hp, x.maxHp))} style={{ width: `${hpPct(x.hp, x.maxHp)}%` }} />
                </span>
                <b>{x.hp <= 0 ? "K.O." : i === b.a ? "EN JEU" : `${x.hp}/${x.maxHp}`}</b>
              </button>
            ))}
            {!mustSwap(b) && (
              <button type="button" className="bt-back" onClick={back}>
                B : retour
              </button>
            )}
          </div>
        )}
        {mode === "lost" && (
          <div className="bt-grid bt-grid--main">
            {lostOptions(b).map((l, i) => (
              <button key={l} type="button" className={cur === i ? "is-on" : ""} onClick={() => choose("lost", i)}>
                <span className="gb-cursor">{cur === i ? "▶" : ""}</span>
                {l}
              </button>
            ))}
          </div>
        )}
        {(mode === "events" || mode === "intro") && typed >= text.length && text && (
          <i className="gb-dialog__next bt-next" aria-hidden="true">
            ▼
          </i>
        )}
      </div>
    </div>
  );
}

function drawFighter(ctx: CanvasRenderingContext2D, spr: HTMLCanvasElement, x: number, y: number, k: number, faint: number, hidden: boolean, charging: boolean, t: number) {
  if (faint >= 1 || hidden) return;
  const w = spr.width * k;
  const hh = spr.height * k;
  if (faint > 0) {
    // K.O. : il s'enfonce et disparaît
    const h = Math.round(spr.height * (1 - faint));
    if (h <= 0) return;
    ctx.globalAlpha = 1 - faint * 0.6;
    ctx.drawImage(spr, 0, 0, spr.width, h, Math.round(x), Math.round(y + hh - h * k), w, h * k);
    ctx.globalAlpha = 1;
    return;
  }
  // Ombre au sol
  ctx.fillStyle = "rgba(8,6,20,0.3)";
  ctx.fillRect(Math.round(x + w * 0.2), Math.round(y + hh - 2), Math.round(w * 0.6), 2);
  ctx.drawImage(spr, Math.round(x), Math.round(y), w, hh);
  if (charging) {
    const spr2 = { width: w, height: hh };
    // Aura de préparation
    ctx.globalAlpha = 0.35 + Math.sin(t * 10) * 0.15;
    ctx.fillStyle = "#ffd04a";
    for (let i = 0; i < 10; i++) {
      const ang = t * 3 + (i / 10) * Math.PI * 2;
      ctx.fillRect(Math.round(x + spr2.width / 2 + Math.cos(ang) * spr2.width * 0.5), Math.round(y + spr2.height / 2 + Math.sin(ang) * spr2.height * 0.45), 2, 2);
    }
    ctx.globalAlpha = 1;
  }
}
