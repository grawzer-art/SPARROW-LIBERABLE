/**
 * Sprites pixel art, décrits en texte : un caractère = un pixel.
 * « . » = transparent. Les couleurs sont dans PALETTE.
 */

export const PALETTE: Record<string, string> = {
  K: "#090909", // contour / noir
  h: "#8a4b22", // cheveux
  s: "#e9b18a", // peau
  S: "#c98b66", // peau ombrée
  g: "#101010", // verres
  w: "#9fb4c8", // reflet des lunettes
  b: "#c4521f", // barbe rousse
  B: "#93370f", // barbe ombrée
  t: "#3b3b3b", // t-shirt
  T: "#2a2a2a", // t-shirt ombré
  p: "#1c1c22", // pantalon
  k: "#f1efe8", // baskets
  m: "#2a2a33", // masque (latex)
  M: "#5a5a6e", // reflet du masque
  e: "#f1efe8", // blanc des yeux
  r: "#e53935", // rouge
  R: "#9e1f1c", // rouge sombre
  P: "#f1efe8", // papier
  q: "#c9c5b8", // papier ombré
  y: "#f2c14e", // or
  Y: "#b5851c", // or sombre
  c: "#d9a066", // pain
  C: "#a8692e", // pain cuit
  v: "#6fae4b", // salade
  W: "#ffffff",
  H: "#4a2a17", // carré brun (Lili)
  G: "#6b3d22", // reflet des cheveux
  l: "#e8a0b0", // rose (haut de Lili)
  L: "#c46f86", // rose ombré
  o: "#777777", // acier
};

// ─── Sparrow, version lunettes (14 × 20) ───
const HEAD_GLASSES = [
  "....hhhhh.....",
  "...hhhhhhhh...",
  "..hhhhhhhhh...",
  "..hhssssssh...",
  "..hssssssss...",
  "..sgggsgggss..",
  "..sgwgsgwgs...",
  "..ssggsSggs...",
  "..sssssssSs...",
  "..bbsssssbb...",
  "..bbbbrrbbb...",
  "...bbbbbbB....",
  "....bbbbB.....",
];

// ─── Sparrow, version masque de chauve-souris (barbe rousse qui dépasse) ───
const HEAD_MASK = [
  "..m......m....",
  "..mm....mm....",
  "..mmmmmmmmm...",
  "..mmMMmmmmm...",
  "..mMmmmmmmm...",
  "..mmeemmeemm..",
  "..mmeemmeem...",
  "..mmmmmmmmm...",
  "..mmmsssmmm...",
  "..bbbsssbbb...",
  "..bbbbrrbbb...",
  "...bbbbbbB....",
  "....bbbbB.....",
];

const BODY_RUN_A = [
  "...tttttt.....",
  "..ttttttts....",
  "..tTttttTs....",
  "..ttttttt.....",
  "...pppppp.....",
  "..ppp..ppp....",
  ".kkk....kkk...",
];

const BODY_RUN_B = [
  "...tttttt.....",
  "..sttttttt....",
  "..stTtttTt....",
  "...ttttttt....",
  "...pppppp.....",
  "....pppp......",
  "....kkkk......",
];

const BODY_JUMP = [
  "..ttttttts....",
  ".sttttttt.....",
  "..tTttttT.....",
  "..ttttttt.....",
  "..pppppppp....",
  ".pp......pp...",
  "kk........kk..",
];

const BODY_HURT = [
  ".sttttttts....",
  "..ttttttt.....",
  "..tTttttT.....",
  "..ttttttt.....",
  "...pppppp.....",
  "...pp..pp.....",
  "..kk....kk....",
];

// ─── Lili : carré brun avec frange (14 × 20) ───
const HEAD_LILI = [
  "...HHHHHH.....",
  "..HHGHHHHHH...",
  ".HHHHHHHHHHH..",
  ".HHHHHHHHHHH..",
  ".HHssssssHHH..",
  ".HHsKssKssHH..",
  ".HHsKssKssHH..",
  ".HHssssssSHH..",
  ".HHsssrrsSHH..",
  ".HHHssssSHHH..",
  ".HHH.ssss.HH..",
  "......ss......",
];

const LILI_RUN_A = [
  "...llllll.....",
  "..llllllls....",
  "..lLllllLs....",
  "..lllllll.....",
  "..LLLLLLL.....",
  "...pppppp.....",
  "..ppp..ppp....",
  ".kkk....kkk...",
];

const LILI_RUN_B = [
  "...llllll.....",
  "..slllllll....",
  "..slLlllLl....",
  "...lllllll....",
  "...LLLLLLL....",
  "...pppppp.....",
  "....pppp......",
  "....kkkk......",
];

const LILI_JUMP = [
  "..llllllls....",
  ".slllllll.....",
  "..lLllllL.....",
  "..lllllll.....",
  "..LLLLLLL.....",
  "..pppppppp....",
  ".pp......pp...",
  "kk........kk..",
];

const LILI_HURT = [
  ".sllllllls....",
  "..lllllll.....",
  "..lLllllL.....",
  "..lllllll.....",
  "..LLLLLLL.....",
  "...pppppp.....",
  "...pp..pp.....",
  "..kk....kk....",
];

export type Skin = "lunettes" | "masque" | "lili";

export const SKIN_NAMES: Record<Skin, string> = {
  lunettes: "SPARROW",
  masque: "CHEVALIER NOIR",
  lili: "LILI",
};

export function heroFrames(skin: Skin) {
  if (skin === "lili") {
    return {
      runA: [...HEAD_LILI, ...LILI_RUN_A],
      runB: [...HEAD_LILI, ...LILI_RUN_B],
      jump: [...HEAD_LILI, ...LILI_JUMP],
      hurt: [...HEAD_LILI, ...LILI_HURT],
    };
  }
  const head = skin === "masque" ? HEAD_MASK : HEAD_GLASSES;
  return {
    runA: [...head, ...BODY_RUN_A],
    runB: [...head, ...BODY_RUN_B],
    jump: [...head, ...BODY_JUMP],
    hurt: [...head, ...BODY_HURT],
  };
}

/** Qui court après qui : Lili poursuit Sparrow, et inversement. */
export const chaserOf = (skin: Skin): Skin => (skin === "lili" ? "lunettes" : "lili");

// ─── Obstacles ───
export const CALENDAR = [
  ".K.K.K.K.K..",
  "rrrrrrrrrrrr",
  "rRRRRRRRRRRr",
  "PPPPPPPPPPPP",
  "PKqPKqPKqPKq",
  "PPPPPPPPPPPP",
  "PKqPKqPrrPKq",
  "PPPPPPPrrPPP",
  "PKqPKqPKqPKq",
  "PPPPPPPPPPPP",
  "PKqPKqPKqPPP",
  "PPPPPPPPPPPP",
  "qqqqqqqqqqqq",
];

export const CLOCK = [
  "....KKKK....",
  "..KKPPPPKK..",
  ".KPPPPKPPPK.",
  ".KPPPPKPPPK.",
  "KPPPPPKPPPPK",
  "KPPPPPKKKPPK",
  "KPPPPPPPPPPK",
  ".KPPPPPPPPK.",
  ".KPPPPPPPPK.",
  "..KKPPPPKK..",
  "....KKKK....",
  ".....oo.....",
  ".....oo.....",
  "...oooooo...",
];

/** « Lundi volant » : une page de calendrier furieuse, avec des ailes. */
export const MONDAY_A = [
  "KK..........KK",
  "KKK.rrrrrr.KKK",
  ".KKKrPPPPrKKK.",
  "..KKrPKKPrKK..",
  "....rPPPPr....",
  "....rKPPKr....",
  "....rrrrrr....",
];

export const MONDAY_B = [
  "..............",
  "....rrrrrr....",
  "KKKKrPPPPrKKKK",
  "KKKKrPKKPrKKKK",
  ".KK.rPPPPr.KK.",
  "....rKPPKr....",
  "....rrrrrr....",
];

// ─── Bonus ───
export const FRITES = [
  "..y.y.y...",
  ".yy.yyyy..",
  ".yyyyyyy..",
  ".yYyyYyy..",
  "rrrrrrrrr.",
  "rRPPPPPRr.",
  ".rRPPPRr..",
  ".rrrrrrr..",
  "..rrrrr...",
];

export const MASK_ITEM = [
  ".m......m.",
  ".mm....mm.",
  ".mmmmmmmm.",
  "mmeemmeemm",
  "mmmmmmmmmm",
  ".mmmmmmmm.",
  "..mm..mm..",
];

export const HOURGLASS = [
  "YYYYYYYY",
  ".yWWWWy.",
  ".yyyyyy.",
  "..yyyy..",
  "...yy...",
  "..y..y..",
  ".y....y.",
  ".yyyyyy.",
  "YYYYYYYY",
];

/** Rendu d'un sprite texte dans un canvas hors écran (1 caractère = 1 pixel). */
export function bake(rows: string[], flip = false): HTMLCanvasElement {
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = PALETTE[ch];
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(flip ? w - 1 - x : x, y, 1, 1);
    });
  });
  return c;
}

export const spriteSize = (rows: string[]) => ({ w: Math.max(...rows.map((r) => r.length)), h: rows.length });
