/**
 * SPARROWGOTCHI — dessin des pièces et des meubles (pixel art procédural, vue de dessus rétro).
 * Le mur du fond est vu de face, le sol de dessus. Chaque meuble posé au sol a une « base »
 * pour le tri de profondeur avec Sparrow (cf. map.ts).
 */

import { ROOMS, SCREEN_H, SCREEN_W, T, WALL_H, type Door, type RoomId } from "@/lib/gotchi/map";

export interface DecorState {
  t: number;
  hour: number;
  deco: Set<string>;
  tiers: { pc: number; lit: number; sport: number; canape: number };
  pcBroken: boolean;
  /** Sparrow utilise ce meuble en ce moment (effets : eau, écran, vapeur…). */
  using: string | null;
}

type Ctx = CanvasRenderingContext2D;

const C = {
  K: "#090909",
  dark: "#111111",
  wood: "#a8692e",
  woodD: "#6b3d22",
  woodL: "#d9a066",
  red: "#e53935",
  redD: "#9e1f1c",
  gold: "#f2c14e",
  goldD: "#b5851c",
  white: "#f1efe8",
  grey: "#c9c5b8",
  steel: "#777777",
  steelD: "#3b3b3b",
  glass: "#9fb4c8",
  green: "#6fae4b",
  screen: "#5a5a6e",
};

const px = (ctx: Ctx, c: string, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};
const frame = (ctx: Ctx, c: string, x: number, y: number, w: number, h: number) => {
  px(ctx, c, x, y, w, 1);
  px(ctx, c, x, y + h - 1, w, 1);
  px(ctx, c, x, y, 1, h);
  px(ctx, c, x + w - 1, y, 1, h);
};

const STYLE: Record<RoomId, { wall: string; wallD: string; floor: string; floorD: string; tiles?: boolean }> = {
  chambre: { wall: "#2c2633", wallD: "#221d28", floor: "#3a2c22", floorD: "#2e231b" },
  salon: { wall: "#33272a", wallD: "#281f21", floor: "#3d2e23", floorD: "#30241b" },
  cuisine: { wall: "#26303a", wallD: "#1d252d", floor: "#2b2b33", floorD: "#22222a", tiles: true },
  gaming: { wall: "#1c1c2b", wallD: "#151522", floor: "#24242c", floorD: "#1c1c23" },
  muscu: { wall: "#2b2b2b", wallD: "#202020", floor: "#1f1f24", floorD: "#18181c", tiles: true },
};

/** Fond : murs, sol, portes et décorations murales. */
export function drawRoom(ctx: Ctx, id: RoomId, d: DecorState) {
  const st = STYLE[id];
  // Sol
  px(ctx, st.floor, 0, WALL_H, SCREEN_W, SCREEN_H - WALL_H);
  if (st.tiles) {
    for (let y = WALL_H; y < SCREEN_H; y += T) for (let x = (y / T) % 2 ? 0 : T; x < SCREEN_W; x += 2 * T) px(ctx, st.floorD, x, y, T, T);
  } else {
    for (let y = WALL_H + 5; y < SCREEN_H; y += 6) px(ctx, st.floorD, 0, y, SCREEN_W, 1);
    for (let y = WALL_H; y < SCREEN_H; y += 6) for (let x = ((y / 6) % 3) * 13; x < SCREEN_W; x += 40) px(ctx, st.floorD, x, y, 1, 6);
  }
  // Mur du fond (vu de face) + plinthe rouge
  px(ctx, st.wall, 0, 0, SCREEN_W, WALL_H);
  px(ctx, st.wallD, 0, 0, SCREEN_W, 3);
  for (let x = 6; x < SCREEN_W; x += 10) px(ctx, "rgba(255,255,255,0.025)", x, 3, 4, WALL_H - 5);
  px(ctx, C.redD, 0, WALL_H - 2, SCREEN_W, 2);
  // Murs latéraux et bas (cadre sombre)
  px(ctx, C.dark, 0, 0, T, SCREEN_H);
  px(ctx, C.dark, SCREEN_W - T, 0, T, SCREEN_H);
  px(ctx, C.dark, 0, SCREEN_H - T, SCREEN_W, T);
  px(ctx, "#1d1d1d", T, SCREEN_H - T, SCREEN_W - 2 * T, 1);
  // Portes
  for (const door of Object.keys(ROOMS[id].doors) as Door[]) drawDoor(ctx, door, st.floor);
  if (ROOMS[id].exit) drawFrontDoor(ctx, st.floor);

  WALL_DECOR[id]?.(ctx, d);
}

function drawDoor(ctx: Ctx, door: Door, floor: string) {
  if (door === "W" || door === "E") {
    const x = door === "W" ? 0 : SCREEN_W - T;
    px(ctx, floor, x, 64, T, 24);
    px(ctx, C.woodD, door === "W" ? T - 1 : SCREEN_W - T, 60, 1, 28);
    px(ctx, C.woodD, x, 60, T, 2);
    px(ctx, C.redD, door === "W" ? 1 : SCREEN_W - 3, 70, 2, 12);
  } else if (door === "N") {
    px(ctx, "#0a0a0a", 72, 6, 16, WALL_H - 6);
    frame(ctx, C.woodD, 70, 4, 20, WALL_H - 3);
    px(ctx, floor, 72, WALL_H - 2, 16, 2);
  } else {
    px(ctx, floor, 72, SCREEN_H - T, 16, T);
    px(ctx, C.redD, 74, SCREEN_H - 6, 12, 3);
  }
}

/** Porte d'entrée de l'appartement (vers la rue) : porte pleine avec paillasson. */
function drawFrontDoor(ctx: Ctx, floor: string) {
  px(ctx, C.woodD, 70, 4, 20, WALL_H - 3);
  px(ctx, C.wood, 72, 6, 16, WALL_H - 6);
  px(ctx, C.woodL, 74, 8, 12, 8);
  px(ctx, C.woodL, 74, 18, 12, 8);
  px(ctx, C.gold, 85, 18, 2, 2);
  px(ctx, floor, 72, WALL_H - 2, 16, 2);
  px(ctx, C.redD, 72, WALL_H, 16, 4);
  px(ctx, C.gold, 76, WALL_H + 1, 8, 1);
}

const sky = (h: number) => (h >= 21 || h < 6 ? ["#141a33", "#f1efe8"] : h < 8 || h >= 19 ? ["#d9784a", "#f2c14e"] : ["#9fc3e0", "#ffffff"]);

const WALL_DECOR: Partial<Record<RoomId, (ctx: Ctx, d: DecorState) => void>> = {
  chambre(ctx, d) {
    // Fenêtre (le ciel suit l'heure de Paris)
    const [s, star] = sky(d.hour);
    px(ctx, C.K, 62, 5, 30, 22);
    px(ctx, s, 64, 7, 26, 18);
    px(ctx, star, 70, 10, 1, 1);
    px(ctx, star, 84, 13, 1, 1);
    px(ctx, C.K, 76, 7, 2, 18);
    px(ctx, C.K, 64, 15, 26, 1);
    px(ctx, C.red, 60, 4, 4, 23);
    px(ctx, C.red, 90, 4, 4, 23);
    // Calendrier 2031 (le compte à rebours veille)
    px(ctx, C.white, 48, 9, 9, 11);
    px(ctx, C.red, 48, 9, 9, 3);
    px(ctx, C.K, 50, 14, 5, 1);
    px(ctx, C.K, 50, 16, 3, 1);
    // Miroir du lavabo
    px(ctx, C.steel, 107, 5, 14, 16);
    px(ctx, C.glass, 108, 6, 12, 14);
    px(ctx, "#ffffff", 110, 8, 2, 4);
  },
  salon(ctx) {
    // Cadre « bat-frite »
    px(ctx, C.K, 108, 7, 20, 15);
    px(ctx, "#1b1b29", 109, 8, 18, 13);
    px(ctx, C.gold, 115, 12, 6, 4);
  },
  cuisine(ctx) {
    // Faïence + hotte + étagère à bocaux
    for (let y = 12; y < WALL_H - 2; y += 4) px(ctx, "rgba(255,255,255,0.05)", 36, y, 64, 1);
    for (let x = 36; x < 100; x += 6) px(ctx, "rgba(255,255,255,0.05)", x, 12, 1, WALL_H - 14);
    px(ctx, C.steel, 58, 3, 22, 6);
    px(ctx, C.steelD, 62, 9, 14, 3);
    px(ctx, C.steelD, 106, 14, 34, 2);
    px(ctx, C.red, 108, 8, 5, 6);
    px(ctx, C.gold, 116, 9, 5, 5);
    px(ctx, C.green, 124, 8, 5, 6);
    px(ctx, C.white, 132, 9, 5, 5);
  },
  gaming(ctx, d) {
    if (d.deco.has("dec-neons")) {
      const on = Math.floor(d.t * 2) % 2 === 0;
      px(ctx, on ? C.red : C.redD, T, 4, SCREEN_W - 2 * T, 1);
      px(ctx, on ? C.redD : C.red, T, WALL_H - 4, SCREEN_W - 2 * T, 1);
    }
    if (d.deco.has("dec-poster")) {
      px(ctx, C.K, 40, 6, 16, 20);
      px(ctx, C.redD, 41, 7, 14, 18);
      px(ctx, C.gold, 44, 10, 8, 6);
      px(ctx, C.gold, 46, 16, 4, 6);
    }
    // Étagère à figurines
    px(ctx, C.steelD, 10, 20, 24, 2);
    px(ctx, C.red, 12, 15, 4, 5);
    px(ctx, C.gold, 19, 14, 4, 6);
    px(ctx, C.green, 26, 16, 4, 4);
    if (d.deco.has("dec-dofrite")) {
      const bob = Math.floor(d.t * 2) % 2;
      px(ctx, C.gold, 14, 26 - bob, 6, 8);
      px(ctx, C.goldD, 15, 28 - bob, 2, 2);
      if (Math.floor(d.t * 3) % 4 === 0) px(ctx, "#ffffff", 21, 25, 1, 1);
    }
  },
  muscu(ctx, d) {
    // Miroir (pleine largeur, reflet)
    px(ctx, C.steel, 94, 4, 34, 25);
    px(ctx, C.glass, 96, 6, 30, 21);
    px(ctx, "#ffffff", 99, 8, 2, 8);
    px(ctx, "#ffffff", 103, 8, 1, 4);
    // Affiche « poing »
    px(ctx, C.K, 60, 6, 22, 20);
    px(ctx, C.red, 61, 7, 20, 18);
    px(ctx, "#e9b18a", 66, 11, 10, 8);
    px(ctx, "#c98b66", 66, 15, 10, 1);
    px(ctx, C.white, 63, 21, 16, 2);
    if (d.tiers.sport >= 3) {
      const g = 0.25 + Math.sin(d.t * 3) * 0.1;
      px(ctx, `rgba(242,193,78,${g})`, T, 0, SCREEN_W - 2 * T, 2);
    }
  },
};

export interface FloorItem {
  base: number;
  draw: (ctx: Ctx) => void;
}

/** Meubles posés au sol, triés ensuite avec Sparrow. */
export function floorItems(id: RoomId, d: DecorState): FloorItem[] {
  const t = d.t;
  const blink = Math.floor(t * 2) % 2 === 0;
  switch (id) {
    case "chambre":
      return [
        {
          base: 66,
          draw: (ctx) => {
            const lt = d.tiers.lit;
            const blanket = lt >= 3 ? C.gold : lt === 2 ? C.red : C.redD;
            const fold = lt >= 3 ? C.goldD : C.redD;
            px(ctx, C.woodD, 14, 24, 28, 8); // tête de lit
            px(ctx, C.wood, 15, 25, 26, 6);
            px(ctx, C.woodD, 14, 32, 28, 34);
            px(ctx, C.white, 16, 32, 24, 32);
            px(ctx, C.grey, 18, 34, 20, 6); // oreiller
            px(ctx, C.white, 19, 34, 18, 5);
            px(ctx, blanket, 16, 42, 24, 22);
            px(ctx, fold, 16, 42, 24, 2);
            if (lt >= 2) for (let y = 46; y < 62; y += 4) px(ctx, fold, 18, y, 20, 1);
            px(ctx, "rgba(0,0,0,0.3)", 14, 66, 28, 2);
          },
        },
        {
          base: 44,
          draw: (ctx) => {
            px(ctx, C.woodD, 44, 32, 10, 12);
            px(ctx, C.wood, 45, 33, 8, 4);
            px(ctx, C.steelD, 48, 26, 2, 6); // lampe
            px(ctx, C.gold, 45, 22, 8, 4);
          },
        },
        {
          base: 42,
          draw: (ctx) => {
            px(ctx, C.white, 106, 30, 16, 12);
            px(ctx, C.grey, 108, 32, 12, 5);
            px(ctx, C.steel, 113, 28, 2, 4);
            if (d.using === "lavabo" && blink) px(ctx, C.glass, 113, 32, 1, 4);
          },
        },
        {
          base: 46,
          draw: (ctx) => {
            px(ctx, C.grey, 128, 6, 22, 40);
            for (let y = 8; y < 44; y += 5) px(ctx, "#b5b1a4", 128, y, 22, 1);
            for (let x = 132; x < 150; x += 6) px(ctx, "#b5b1a4", x, 6, 1, 40);
            px(ctx, C.steel, 136, 8, 6, 2); // pommeau
            px(ctx, C.steel, 138, 6, 2, 2);
            px(ctx, C.white, 128, 42, 22, 4); // receveur
            px(ctx, "rgba(159,180,200,0.35)", 128, 6, 2, 40); // vitre
            if (d.using === "douche")
              for (let i = 0; i < 6; i++) px(ctx, C.glass, 134 + i * 2, Math.round(((t * 40 + i * 9) % 30) + 10), 1, 3);
          },
        },
        {
          base: 34,
          draw: (ctx) => {
            // Petit tapis au sol (sous le reste)
            px(ctx, C.redD, 58, 86, 40, 24);
            frame(ctx, C.red, 58, 86, 40, 24);
          },
        },
      ];
    case "salon":
      return [
        {
          base: 33,
          draw: (ctx) => {
            if (d.deco.has("dec-tapis")) {
              px(ctx, C.redD, 42, 78, 76, 40);
              frame(ctx, C.gold, 42, 78, 76, 40);
            }
          },
        },
        {
          base: 42,
          draw: (ctx) => {
            px(ctx, C.woodD, 22, 30, 42, 12);
            px(ctx, C.wood, 23, 31, 40, 3);
            px(ctx, C.K, 26, 8, 34, 22);
            px(ctx, d.using === "canape" && blink ? "#7a7a96" : C.screen, 28, 10, 30, 17);
            px(ctx, "#ffffff", 30, 12, 4, 1);
            if (Math.floor(t * 5) % 3 === 0) px(ctx, C.glass, 34, 20, 16, 1);
            px(ctx, C.K, 41, 30, 4, 2);
          },
        },
        {
          base: 102,
          draw: (ctx) => {
            // Canapé vu de dos (on regarde la télé)
            const ct = d.tiers.canape;
            const seat = ct >= 2 ? C.gold : C.red;
            px(ctx, C.redD, 50, 86, 60, 8); // coussins d'assise (au fond)
            px(ctx, seat, 52, 87, 26, 6);
            px(ctx, seat, 82, 87, 26, 6);
            px(ctx, C.K, 48, 92, 64, 12); // dossier
            px(ctx, C.redD, 49, 93, 62, 10);
            px(ctx, C.red, 49, 93, 62, 2);
            px(ctx, C.redD, 46, 86, 4, 18); // accoudoirs
            px(ctx, C.redD, 110, 86, 4, 18);
            if (ct >= 2) {
              px(ctx, C.gold, 56, 89, 6, 4);
              px(ctx, C.gold, 98, 89, 6, 4);
            }
            px(ctx, "rgba(0,0,0,0.3)", 48, 104, 64, 2);
          },
        },
        {
          base: 46,
          draw: (ctx) => {
            px(ctx, C.steelD, 16, 10, 2, 36);
            px(ctx, C.gold, 12, 6, 10, 6);
            px(ctx, C.K, 13, 44, 8, 2);
          },
        },
        {
          base: 48,
          draw: (ctx) => {
            // Bibliothèque
            px(ctx, C.woodD, 134, 8, 14, 40);
            for (let y = 14; y < 46; y += 10) px(ctx, C.wood, 135, y, 12, 1);
            px(ctx, C.red, 136, 9, 2, 5);
            px(ctx, C.gold, 139, 10, 2, 4);
            px(ctx, C.green, 137, 19, 3, 5);
            px(ctx, C.white, 142, 29, 3, 5);
          },
        },
        ...(d.deco.has("dec-plante")
          ? [
              {
                base: 120,
                draw: (ctx: Ctx) => {
                  px(ctx, C.green, 18, 104, 10, 10);
                  px(ctx, "#4e8a33", 20, 106, 6, 6);
                  px(ctx, C.woodD, 19, 114, 8, 6);
                },
              },
            ]
          : []),
      ];
    case "cuisine":
      return [
        {
          base: 46,
          draw: (ctx) => {
            px(ctx, C.white, 10, 4, 20, 42);
            px(ctx, C.grey, 10, 18, 20, 1);
            px(ctx, C.steel, 26, 8, 2, 7);
            px(ctx, C.steel, 26, 22, 2, 10);
            px(ctx, C.red, 14, 8, 3, 3); // magnets
            px(ctx, C.gold, 18, 26, 3, 3);
            if (d.using === "frigo") px(ctx, C.gold, 11, 19, 14, 2);
          },
        },
        {
          base: 44,
          draw: (ctx) => {
            px(ctx, C.steel, 38, 28, 60, 4); // plan de travail
            px(ctx, C.steelD, 38, 32, 60, 12);
            for (let x = 46; x < 98; x += 14) px(ctx, C.K, x, 33, 1, 10);
            const gold = d.deco.has("dec-friteuse");
            px(ctx, gold ? C.goldD : C.steel, 60, 20, 16, 10); // friteuse
            px(ctx, gold ? C.gold : "#5a5a5a", 61, 21, 14, 3);
            px(ctx, C.gold, 62, 22, 12, 1);
            px(ctx, C.red, 72, 26, 2, 2);
            if (blink || d.using === "friteuse") {
              px(ctx, "#bbbbbb", 64, 14 - (Math.floor(t * 4) % 3), 1, 3);
              px(ctx, "#bbbbbb", 70, 13 - (Math.floor(t * 5) % 3), 1, 3);
            }
            px(ctx, C.K, 84, 26, 10, 2); // plaques
            px(ctx, C.redD, 86, 26, 2, 1);
          },
        },
        {
          base: 84,
          draw: (ctx) => {
            px(ctx, C.redD, 110, 78, 8, 8); // chaises du fond
            px(ctx, C.redD, 126, 78, 8, 8);
          },
        },
        {
          base: 102,
          draw: (ctx) => {
            px(ctx, C.woodD, 104, 86, 36, 16);
            px(ctx, C.wood, 105, 87, 34, 12);
            px(ctx, C.white, 112, 90, 8, 5); // assiette
            px(ctx, C.green, 114, 91, 4, 3); // salade (abandonnée)
            px(ctx, "rgba(0,0,0,0.3)", 104, 102, 36, 2);
          },
        },
      ];
    case "gaming":
      return [
        {
          base: 46,
          draw: (ctx) => {
            const pc = d.tiers.pc;
            px(ctx, C.K, 94, 30, 48, 16); // bureau
            px(ctx, "#2a2a33", 95, 31, 46, 4);
            const screen = (x: number) => {
              px(ctx, C.K, x, 10, 22, 16);
              if (d.pcBroken) px(ctx, "#050505", x + 1, 11, 20, 13);
              else {
                px(ctx, "#1f2a1c", x + 1, 11, 20, 13);
                px(ctx, C.gold, x + 4 + (Math.floor(t * 3) % 6), 15, 2, 2);
                px(ctx, C.red, x + 14, 19 - (Math.floor(t * 2) % 2), 3, 3);
                px(ctx, C.green, x + 3, 21, 14, 1);
              }
              px(ctx, C.K, x + 9, 26, 4, 4);
            };
            screen(106);
            if (pc >= 2) screen(122);
            if (pc >= 3) {
              const cols = [C.red, C.gold, C.green, C.glass];
              for (let i = 0; i < 6; i++) px(ctx, cols[(i + Math.floor(t * 4)) % 4], 96 + i * 7, 44, 6, 1);
            }
            px(ctx, C.steelD, 98, 31, 6, 2); // clavier / souris
            if (d.pcBroken && blink) {
              px(ctx, "#bbbbbb", 114, 6, 1, 3);
              px(ctx, "#bbbbbb", 118, 4, 1, 3);
            }
          },
        },
        {
          base: 58,
          draw: (ctx) => {
            // Chaise gamer, vue de dos
            px(ctx, C.K, 111, 46, 14, 12);
            px(ctx, C.redD, 112, 47, 12, 10);
            px(ctx, C.red, 112, 47, 12, 2);
            px(ctx, C.K, 117, 58, 2, 3);
          },
        },
        {
          base: 40,
          draw: (ctx) => {
            px(ctx, C.woodD, 10, 30, 24, 10);
            px(ctx, C.wood, 11, 31, 22, 2);
          },
        },
        {
          base: 112,
          draw: (ctx) => {
            px(ctx, C.redD, 122, 100, 18, 12);
            px(ctx, C.red, 124, 101, 14, 6);
            px(ctx, "rgba(0,0,0,0.3)", 122, 112, 18, 2);
          },
        },
      ];
    case "muscu":
      return [
        {
          base: 44,
          draw: (ctx) => {
            const sp = d.tiers.sport;
            px(ctx, C.steelD, 12, 14, 38, 3); // rack à haltères
            px(ctx, C.steelD, 12, 28, 38, 3);
            px(ctx, C.steelD, 13, 14, 2, 30);
            px(ctx, C.steelD, 47, 14, 2, 30);
            for (let i = 0; i < 4; i++) {
              const c = sp >= 3 ? C.red : sp === 2 ? C.goldD : C.steel;
              px(ctx, c, 17 + i * 8, 10, 3, 4);
              px(ctx, C.K, 20 + i * 8, 11, 2, 2);
              px(ctx, c, 22 + i * 8, 10, 3, 4);
              px(ctx, c, 17 + i * 8, 24, 3, 4);
              px(ctx, c, 22 + i * 8, 24, 3, 4);
            }
          },
        },
        {
          base: 96,
          draw: (ctx) => {
            const sp = d.tiers.sport;
            if (sp >= 3) {
              px(ctx, C.steelD, 58, 66, 3, 30); // montants du rack
              px(ctx, C.steelD, 99, 66, 3, 30);
            }
            px(ctx, C.K, 64, 84, 32, 10); // banc
            px(ctx, sp >= 2 ? C.red : C.redD, 65, 85, 30, 6);
            px(ctx, C.steelD, 70, 94, 2, 4);
            px(ctx, C.steelD, 88, 94, 2, 4);
            // Barre posée sur ses supports
            if (d.using !== "banc") {
              px(ctx, C.steel, 56, 76, 48, 2);
              const plate = sp >= 2 ? C.gold : C.steelD;
              px(ctx, plate, 56, 72, 4, 10);
              px(ctx, plate, 100, 72, 4, 10);
            }
          },
        },
        {
          base: 50,
          draw: (ctx) => {
            // Sac de frappe
            px(ctx, C.steelD, 137, 2, 2, 10);
            px(ctx, C.K, 132, 10, 12, 38);
            px(ctx, C.red, 133, 11, 10, 36);
            px(ctx, C.redD, 133, 26, 10, 3);
          },
        },
        {
          base: 33,
          draw: (ctx) => {
            px(ctx, "#2a2a33", 108, 92, 34, 22); // tapis de sol
            frame(ctx, C.redD, 108, 92, 34, 22);
          },
        },
      ];
  }
}
