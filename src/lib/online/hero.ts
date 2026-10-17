/**
 * SPARROW ONLINE — héros personnalisables (logique pure, testable).
 *
 * L'apparence est un petit objet d'entiers (une option par catégorie). Les mêmes bornes sont
 * vérifiées côté serveur (fonction SQL `valid_look`) : le client ne peut pas inventer d'option.
 * Le sprite est composé en couches (visage → cheveux → visage spécial → accessoire), dans le
 * même gabarit 16 × 20 que Sparrow et les PNJ.
 */

import type { CharDef, Dir } from "@/components/rpg/actors";

export interface Look {
  hair: number;
  hairColor: number;
  skin: number;
  face: number;
  top: number;
  topColor: number;
  pants: number;
  acc: number;
}

export const OPTIONS = {
  hair: ["Court", "Mèche", "Longs", "Crête"],
  hairColor: ["Châtain", "Noir", "Blond", "Roux", "Violet", "Blanc"],
  skin: ["Clair", "Doré", "Mat", "Foncé"],
  face: ["Neutre", "Lunettes", "Barbe"],
  top: ["Sweat", "Veste", "T-shirt"],
  topColor: ["Rouge", "Bleu", "Vert", "Jaune", "Violet", "Noir", "Blanc", "Orange"],
  pants: ["Jean", "Noir", "Kaki", "Gris"],
  acc: ["Aucun", "Casquette", "Casque audio", "Bandeau"],
} as const satisfies Record<keyof Look, readonly string[]>;

export const LOOK_KEYS = Object.keys(OPTIONS) as (keyof Look)[];
export const DEFAULT_LOOK: Look = { hair: 0, hairColor: 0, skin: 0, face: 0, top: 0, topColor: 1, pants: 0, acc: 0 };

/** Même règle que le serveur : exactement ces clés, des entiers dans les bornes. */
export function validLook(l: unknown): l is Look {
  if (!l || typeof l !== "object" || Array.isArray(l)) return false;
  const o = l as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  if (keys.join() !== [...LOOK_KEYS].sort().join()) return false;
  return LOOK_KEYS.every((k) => Number.isInteger(o[k]) && (o[k] as number) >= 0 && (o[k] as number) < OPTIONS[k].length);
}

export const randomLook = (r: () => number = Math.random): Look =>
  Object.fromEntries(LOOK_KEYS.map((k) => [k, Math.floor(r() * OPTIONS[k].length)])) as unknown as Look;

/** Pseudo : mêmes règles que le serveur. */
export const PSEUDO_RE = /^[A-Za-z0-9_-]{3,16}$/;

/** Identifiant de sprite (une entrée par apparence, pour le cache des sprites). */
export const lookId = (l: Look) => `hero:${LOOK_KEYS.map((k) => l[k]).join("")}`;

// ─── Couleurs ───

const HAIR: [string, string][] = [
  ["#8a4b22", "#6b3a1a"],
  ["#2a2026", "#161016"],
  ["#e8c060", "#c09838"],
  ["#c4521f", "#93370f"],
  ["#8a5ad0", "#6a3aa8"],
  ["#e8e4dc", "#b8b2a8"],
];
const SKIN: [string, string][] = [
  ["#f0c9a8", "#d8a684"],
  ["#e9b18a", "#c98b66"],
  ["#c48a62", "#a46a42"],
  ["#8a5a3a", "#6a4228"],
];
const TOP: [string, string][] = [
  ["#d23a3a", "#9e1f1c"],
  ["#2e7dd2", "#1f5a9e"],
  ["#4a9a4a", "#2e6e2e"],
  ["#e8b830", "#b5851c"],
  ["#8a4ad0", "#5e2ea0"],
  ["#2a2a32", "#1a1a22"],
  ["#e8e4dc", "#b8b2a8"],
  ["#e8792a", "#b5561a"],
];
const PANTS: [string, string][] = [
  ["#3a4a6a", "#2a364e"],
  ["#1c1c22", "#141418"],
  ["#6a6a3a", "#4e4e2a"],
  ["#6a6a74", "#4e4e56"],
];

// ─── Gabarits (16 colonnes × 10 lignes de tête) ───

type Rows = Record<Dir, string[]>;
const keep = "________________";

const FACE: Rows = {
  down: ["....KKKKKKKK....", "...KSSSSSSSSK...", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSESSSSESSK..", "..KSSSSSSSSSsK..", "..KSSSSMMSSSsK..", "...KSSSSSSSsK...", "....KKSSSSKK...."],
  up: ["....KKKKKKKK....", "...KSSSSSSSSK...", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSSSSSSSSSK..", "..KSSSSSSSSSsK..", "...KSSSSSSSsK...", "....KKSSSSKK...."],
  side: [".....KKKKKKK....", "....KSSSSSSSK...", "...KSSSSSSSSSK..", "...KSSSSSSSSSK..", "...KSSSSSSSSSK..", "...KSSSSSSSESK..", "...KSSSSSSSSSSK.", "...KSSSSSSSMSK..", "....KSSSSSSSK...", ".....KKSSSSK...."],
};

const pad = (rows: string[]) => [...rows, ...Array(10 - rows.length).fill(keep)];

const HAIRS: Rows[] = [
  // Court
  {
    down: pad(["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHHhHHHHhHHK..", "..KHHHHHHHHHHK..", "..KH________HK.."]),
    up: pad(["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHHHHhhHHHHK..", "..KHHhHHHHhHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KhHHHHHHHHhK.."]),
    side: pad([".....KKKKKKK....", "....KHHHHHHHK...", "...KHHhHHHHHHK..", "...KHHHHHHHHHK..", "...KHHHH_____K.."]),
  },
  // Mèche
  {
    down: pad(["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHhHHHHHHHHK..", "..KHHHHHHHHhHK..", "..KHHHHHHH__HK..", "..KH____________"]),
    up: pad(["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHHHHhhHHHHK..", "..KHHhHHHHhHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KhHHHHHHHHhK.."]),
    side: pad([".....KKKKKKK....", "....KHHHHHHHK...", "...KHHhHHHHHHK..", "...KHHHHHHHHHHK.", "...KHHHHHHHH_K.."]),
  },
  // Longs
  {
    down: ["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHHhHHHHhHHK..", "..KHHHHHHHHHHK..", "..KH________HK..", "..KH________HK..", "..KH________HK..", "..KH________HK..", "..KHK______KHK..", "..KHK______KHK.."],
    up: ["....KKKKKKKK....", "...KHHHHHHHHK...", "..KHHHHhhHHHHK..", "..KHHhHHHHhHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KHHHHHHHHHHK..", "..KhHHHHHHHHhK..", "...KKKKKKKKKK..."],
    side: [".....KKKKKKK....", "....KHHHHHHHK...", "...KHHhHHHHHHK..", "...KHHHHHHHHHK..", "...KHHHH_____K..", "...KHHH______K..", "...KHHH_______K.", "...KHHH______K..", "...KHHK_____K...", "...KKK_________."],
  },
  // Crête
  {
    down: pad(["......KKKK......", "...KKKHHHHKKK...", "..KSSKHhHHKSSK..", "..KSSSKHHKSSSK.."]),
    up: pad(["......KKKK......", "...KKKHHHHKKK...", "..KSSKHhHHKSSK..", "..KSSSKHHKSSSK..", "..KSSSKHHKSSSK..", "..KSSSSKKSSSSK.."]),
    side: pad([".......KKKK.....", ".....KKHHHHK....", "...KKHHhHHHKK...", "...KSKKHHHKKSK.."]),
  },
];

const FACES: (Rows | null)[] = [
  null,
  // Lunettes
  {
    down: [keep, keep, keep, keep, keep, "..KSGWGSSGWGSK..", keep, keep, keep, keep],
    up: Array(10).fill(keep),
    side: [keep, keep, keep, keep, keep, "...KSSSSSSGWGK..", keep, keep, keep, keep],
  },
  // Barbe
  {
    down: [keep, keep, keep, keep, keep, keep, "..KBSSSSSSSSBK..", "..KBBSSMMSSBBK..", "...KBBBBBBBBK...", "....KKBBBBKK...."],
    up: [keep, keep, keep, keep, keep, keep, keep, "..KBSSSSSSSSBK..", "...KBSSSSSSBK...", "....KKBBBBKK...."],
    side: [keep, keep, keep, keep, keep, keep, "...KSSSSSSBSSSK.", "...KSSSSSBBMBK..", "....KBBBBBBBK...", ".....KKBBBBK...."],
  },
];

const ACCS: (Rows | null)[] = [
  null,
  // Casquette
  {
    down: pad(["....KKKKKKKK....", "...KAAAAAAAAK...", "..KAAAaAAAAAAK..", "..KaaaaaaaaaaK.."]),
    up: pad(["....KKKKKKKK....", "...KAAAAAAAAK...", "..KAAAaAAAAAAK..", "..KAAAAAAAAAAK.."]),
    side: pad([".....KKKKKKK....", "....KAAAAAAAK...", "...KAAAaAAAAAK..", "...KAAAAaaaaaaaK"]),
  },
  // Casque audio
  {
    down: pad(["....KKKKKKKK....", "...KLLLLLLLLK...", keep, keep, ".KL__________LK.", ".KL__________LK.", ".KK__________KK."]),
    up: pad(["....KKKKKKKK....", "...KLLLLLLLLK...", keep, keep, ".KL__________LK.", ".KL__________LK.", ".KK__________KK."]),
    side: pad([".....KKKKKKK....", "....KLLLLLLLK...", keep, "______KLK_______", "_____KLLLK______", "_____KLLLK______", "______KKK_______"]),
  },
  // Bandeau
  {
    down: pad([keep, keep, keep, "..KAAAAAAAAAAK.."]),
    up: pad([keep, keep, keep, "..KAAAAAAAAAAK..", "____________A___", "_____________A__"]),
    side: pad([keep, keep, keep, "...KAAAAAAAAAK.."]),
  },
];

const TOPS: Rows[] = [
  // Sweat (cordons)
  {
    down: ["...KCWCCCCWCK...", "..KSCWCCCCWCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
    up: ["...KCCCCCCCCK...", "..KSCCCCCCCCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
    side: [".....KCCCCCK....", "....KCCCCCCSK...", "....KCcCCCCSK...", "....KCCCCCCKK...", "....KPPPPPPK...."],
  },
  // Veste ouverte sur un t-shirt blanc
  {
    down: ["...KCCWWWWCCK...", "..KSCCWWWWCCSK..", "..KSCcWWWWcCSK..", "..KKCCWWWWCCKK..", "...KPPPPPPPPK..."],
    up: ["...KCCCCCCCCK...", "..KSCCCCCCCCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
    side: [".....KCCWCCK....", "....KCCCWCCSK...", "....KCcCWCCSK...", "....KCCCWCCKK...", "....KPPPPPPK...."],
  },
  // T-shirt (bras nus)
  {
    down: ["...KCCCCCCCCK...", "..KSSCCCCCCSSK..", "..KSSCCCCCCSSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
    up: ["...KCCCCCCCCK...", "..KSSCCCCCCSSK..", "..KSSCCCCCCSSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
    side: [".....KCCCCCK....", "....KCCCCCSSK...", "....KCcCCCSSK...", "....KCCCCCCKK...", "....KPPPPPPK...."],
  },
];

/** Superpose une couche : « _ » garde le pixel du dessous, tout le reste le remplace (« . » efface). */
function layer(base: string[], over: string[] | undefined): string[] {
  if (!over) return base;
  return base.map((row, y) => {
    const o = over[y] ?? keep;
    let out = "";
    for (let x = 0; x < 16; x++) out += o[x] === "_" || o[x] === undefined ? row[x] : o[x];
    return out;
  });
}

/** Sprite du héros (même gabarit que les personnages du jeu solo). */
export function heroDef(l: Look): CharDef {
  const [H, h] = HAIR[l.hairColor];
  const [S, s] = SKIN[l.skin];
  const [C, c] = TOP[l.topColor];
  const [P, p] = PANTS[l.pants];
  const head = {} as Record<Dir, string[]>;
  for (const d of ["down", "up", "side"] as Dir[]) {
    let rows = FACE[d];
    rows = layer(rows, HAIRS[l.hair][d]);
    rows = layer(rows, FACES[l.face]?.[d]);
    rows = layer(rows, ACCS[l.acc]?.[d]);
    head[d] = rows;
  }
  return {
    pal: { K: "#1b1626", H, h, B: h, S, s, E: "#1b1626", M: "#8e3a2a", G: "#101010", W: "#f1efe8", L: "#6ad0ff", A: C, a: c, C, c, P, p, F: "#f1efe8" },
    head,
    torso: TOPS[l.top],
  };
}
