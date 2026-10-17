/**
 * RPG — personnages (sprites originaux 16 × 20, contour sombre, 4 directions).
 *
 * Chaque personnage = une tête (par direction) + un buste + des jambes animées (repos, pas A,
 * pas B), recolorés avec sa palette. Les lettres sont des « rôles » de couleur :
 *   K contour · H/h cheveux · S/s peau · E yeux · W blanc · C/c vêtement · A accent
 *   P/p bas · F chaussures · X/x couvre-chef · G lunettes · B/b barbe · M moustache · L lueur
 */

import { bakeRows, type Palette } from "./pixel";

/** Même pose pour les 3 images (personnage qui sautille au lieu de marcher). */
const same = (rows: string[]): Record<"down" | "up" | "side", string[][]> => ({ down: [rows, rows, rows], up: [rows, rows, rows], side: [rows, rows, rows] });

export type Dir = "down" | "up" | "side";
export type Frame = 0 | 1 | 2; // repos, pas A, pas B
/** Identifiant de sprite (voir DEFS). */
export type CharId = string;

interface Def {
  pal: Palette;
  head: Record<Dir, string[]>; // 10 lignes
  torso: Record<Dir, string[]>; // 5 lignes
  legs?: Record<Dir, string[][]>; // 3 × 5 lignes (sinon jambes standard)
}

const LEGS: Record<Dir, string[][]> = {
  down: [
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KppK..KppK...", "...KFFK..KFFK...", "....KK....KK...."],
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KFFK..KppK...", "....KK...KFFK...", "..........KK...."],
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KppK..KFFK...", "...KFFK...KK....", "....KK.........."],
  ],
  up: [
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KppK..KppK...", "...KFFK..KFFK...", "....KK....KK...."],
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KppK..KFFK...", "...KFFK...KK....", "....KK.........."],
    ["...KPPPKKPPPK...", "...KPPK..KPPK...", "...KFFK..KppK...", "....KK...KFFK...", "..........KK...."],
  ],
  side: [
    ["....KPPPPPK.....", "....KPPKPPK.....", "....KppKppK.....", "....KFFKFFFK....", ".....KK.KKK....."],
    ["...KPPPKPPPK....", "..KPPK...KPPK...", "..KppK...KppK...", "..KFFK...KFFFK..", "...KK.....KKK..."],
    ["....KPPPPPK.....", "....KPPPPK......", "....KppppK......", "....KFFFFFK.....", ".....KKKKK......"],
  ],
};

const TORSO: Record<Dir, string[]> = {
  down: ["...KCCCCCCCCK...", "..KSCCCCCCCCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
  up: ["...KCCCCCCCCK...", "..KSCCCCCCCCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
  side: [".....KCCCCCK....", "....KCCCCCCSK...", "....KCcCCCCSK...", "....KCCCCCCKK...", "....KPPPPPPK...."],
};

const DEFS: Record<string, Def> = {
  sparrow: {
    pal: { K: "#1b1626", H: "#8a4b22", h: "#6b3a1a", S: "#e9b18a", s: "#c98b66", G: "#101010", W: "#9fb4c8", B: "#c4521f", b: "#93370f", r: "#6e2410", C: "#3b3b3b", c: "#2a2a2a", P: "#1c1c22", p: "#141418", F: "#f1efe8" },
    head: {
      down: [
        "....KKKKKKKK....",
        "...KHHHHHHHHK...",
        "..KHHhHHHHhHHK..",
        "..KHHHHHHHHHHK..",
        "..KHSSSSSSSSHK..",
        "..KSGGGSSGGGSK..",
        "..KSGWGGGGWGSK..",
        "..KBSSSssSSSBK..",
        "...KBBBrBBBBK...",
        "....KBBBBBBK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KHHHHHHHHK...",
        "..KHHHHhhHHHHK..",
        "..KHHhHHHHhHHK..",
        "..KHHHHHHHHHHK..",
        "..KHHHHHHHHHHK..",
        "..KSHHHHHHHHSK..",
        "..KBHHHHHHHHBK..",
        "...KBSSSSSSBK...",
        "....KKSSSSKK....",
      ],
      side: [
        ".....KKKKKKK....",
        "....KHHHHHHHK...",
        "...KHHhHHHHHHK..",
        "...KHHHHHHHHHK..",
        "...KHHHHSSSSSK..",
        "...KHHHSGGGGGK..",
        "...KHHSSGWGGSK..",
        "...KhBSSSSSsSSK.",
        "....KBBBBBrBKK..",
        ".....KBBBBBK....",
      ],
    },
    torso: TORSO,
  },
  nico: {
    pal: { K: "#1b1626", X: "#c62828", x: "#8e1b1b", W: "#f1efe8", H: "#1d1a22", S: "#b9794f", s: "#9a5f3b", E: "#1b1626", C: "#f2b632", c: "#c98e1c", A: "#c62828", P: "#2b3a5c", p: "#1f2a44", F: "#e9e4d8", L: "#9fd4ff" },
    head: {
      down: [
        "....KKKKKKKK....",
        "...KXXXWWXXXK...",
        "..KXXXXXXXXXXK..",
        "..KxxxxxxxxxxK..",
        ".KxxxxxxxxxxxxK.",
        "..KHSSSSSSSSHK..",
        "..KSSESSSSESSK..",
        "..KSSSSSSSSSSK..",
        "...KSSSssSSSK...",
        "....KKSSSSKK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXXXXXXXK..",
        "..KXXXXXXXXXXK..",
        "..KxxxxxxxxxxK..",
        "..KHHHHHHHHHHK..",
        "..KHHHHHHHHHHK..",
        "..KSHHHHHHHHSK..",
        "...KSSSSSSSSK...",
        "....KKSSSSKK....",
      ],
      side: [
        ".....KKKKKKK....",
        "....KXXXXXWXK...",
        "...KXXXXXXXXXK..",
        "...KxxxxxxxxxxxK",
        "...KHHxxxxxxxK..",
        "...KHHSSSSSESK..",
        "...KHSSSSSSSSK..",
        "...KHSSSSSSSSSK.",
        "....KSSSSsssK...",
        ".....KKSSSSK....",
      ],
    },
    torso: {
      down: ["...KCCCAACCCK...", "..KSCCCAACCCSK..", "..KSCcCAACcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
      up: ["...KCCCCCCCCK...", "..KSCCAAAACCSK..", "..KSCcAAAAcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
      side: [".....KCCAACK....", "....KCCCAACSK...", "....KCcCAACSK...", "....KCCCCCCKK...", "....KPPPPPPK...."],
    },
  },
  bouchon: {
    pal: { K: "#1b1626", H: "#cfc9da", h: "#a9a2b8", S: "#f0c9a8", s: "#d8a684", E: "#1b1626", G: "#6a5a8a", W: "#ffffff", C: "#7b4f9e", c: "#5e3a7c", A: "#e8c3d8", P: "#4a3a5e", p: "#3a2c4c", F: "#2a2230", r: "#e88a8a" },
    head: {
      down: [
        "......KKKK......",
        ".....KHHHHK.....",
        "...KKKHHHHKKK...",
        "..KHHHHhHHHHHK..",
        "..KHSSSSSSSSHK..",
        "..KSGGGSSGGGSK..",
        "..KSGEGSSGEGSK..",
        "..KSrSSSSSSrSK..",
        "...KSSSssSSSK...",
        "....KKSSSSKK....",
      ],
      up: [
        "......KKKK......",
        ".....KHhhHK.....",
        "...KKKHHHHKKK...",
        "..KHHHHHHHHHHK..",
        "..KHHhHHHHhHHK..",
        "..KHHHHHHHHHHK..",
        "..KHHHHHHHHHHK..",
        "..KSHHHHHHHHSK..",
        "...KSSSSSSSSK...",
        "....KKSSSSKK....",
      ],
      side: [
        "...KKKK.........",
        "..KHHHHK........",
        "..KHHHHKKKKK....",
        "...KHHHHHHHHK...",
        "...KHHHHSSSSSK..",
        "...KHHHSGGGSSK..",
        "...KHHSSGEGSSK..",
        "...KHSSSSSSrSSK.",
        "....KSSSSsssK...",
        ".....KKSSSSK....",
      ],
    },
    torso: {
      down: ["...KCCCAACCCK...", "..KSCCCAACCCSK..", "..KSCcCAACcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
      up: ["...KCCCCCCCCK...", "..KSCCCCCCCCSK..", "..KSCcCCCCcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
      side: [".....KCCAACK....", "....KCCCAACSK...", "....KCcCAACSK...", "....KCCCCCCKK...", "....KPPPPPPK...."],
    },
    // Jupe longue : les pas se voient à peine
    legs: {
      down: [
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKFFKKFFKK...", "....KK....KK...."],
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKFFKKKKKK...", "....KK.........."],
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKKKKKFFKK...", "..........KK...."],
      ],
      up: [
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKFFKKFFKK...", "....KK....KK...."],
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKFFKKKKKK...", "....KK.........."],
        ["..KPPPPPPPPPPK..", "..KPPpPPPPpPPK..", "..KPPPPPPPPPPK..", "...KKKKKKFFKK...", "..........KK...."],
      ],
      side: [
        ["...KPPPPPPPK....", "...KPPpPPPPK....", "...KPPPPPPPPK...", "....KFFKFFFK....", ".....KK.KKK....."],
        ["...KPPPPPPPK....", "...KPPpPPPPK....", "...KPPPPPPPPK...", "...KFFK.KFFFK...", "....KK...KKK...."],
        ["...KPPPPPPPK....", "...KPPpPPPPK....", "...KPPPPPPPPK...", ".....KFFFFK.....", "......KKKK......"],
      ],
    },
  },
  raymond: {
    pal: { K: "#1b1626", H: "#3a2a20", S: "#e2a982", s: "#c48a62", E: "#1b1626", M: "#3a2a20", W: "#efece4", w: "#cfcabd", C: "#efece4", c: "#cfcabd", A: "#2e7d4f", a: "#1f5a37", P: "#3a3a46", p: "#2a2a34", F: "#2a2026" },
    head: {
      down: [
        "....KKKKKKKK....",
        "...KSSSSSSSSK...",
        "..KSSSSsSSSSSK..",
        "..KHSSSSSSSSHK..",
        "..KHSSSSSSSSHK..",
        "..KSSESSSSESSK..",
        "..KSSSSSSSSSSK..",
        "..KSMMMMMMMMSK..",
        "...KSMSSSSMSK...",
        "....KKSSSSKK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KSSSSSSSSK...",
        "..KSSSSsSSSSSK..",
        "..KSSSSSSSSSSK..",
        "..KHSSSSSSSSHK..",
        "..KHHHHHHHHHHK..",
        "..KHHHHHHHHHHK..",
        "..KSHHHHHHHHSK..",
        "...KSSSSSSSSK...",
        "....KKSSSSKK....",
      ],
      side: [
        ".....KKKKKKK....",
        "....KSSSSSSSK...",
        "...KSSSSSsSSSK..",
        "...KHSSSSSSSSK..",
        "...KHHSSSSSSSK..",
        "...KHHSSSSSESK..",
        "...KHSSSSSSSSK..",
        "...KHSSSSMMMMSK.",
        "....KSSSSSMMKK..",
        ".....KKSSSSK....",
      ],
    },
    torso: {
      down: ["...KCAAAAAACK...", "..KSCAAAAAACSK..", "..KSCAaAAaACSK..", "..KKCAAAAAACKK..", "...KPAAAAAAPK..."],
      up: ["...KCCCAACCCK...", "..KSCCCAACCCSK..", "..KSCcCAACcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."],
      side: [".....KCAAAAK....", "....KCCAAAASK...", "....KCcAaAASK...", "....KCCAAAAKK...", "....KPPAAAPK...."],
    },
  },
  inconnu: {
    pal: { K: "#0c0a12", X: "#2a2238", x: "#1c1626", D: "#0a0810", E: "#6ff0ff", C: "#2a2238", c: "#1c1626", A: "#463a5c", P: "#1c1626", p: "#120e1a", F: "#0c0a12", S: "#2a2238" },
    head: {
      down: [
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXXXXXXXK..",
        "..KXXxDDDDxXXK..",
        "..KXxDDDDDDxXK..",
        "..KXDDEDDEDDXK..",
        "..KXDDDDDDDDXK..",
        "..KXxDDDDDDxXK..",
        "...KXXxxxxXXK...",
        "....KXXXXXXK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXxXXXXXK..",
        "..KXXXXXXXXXXK..",
        "..KXXxXXXXxXXK..",
        "..KXXXXXXXXXXK..",
        "..KXXXXXXXXXXK..",
        "..KXXXXXXXXXXK..",
        "...KXXXXXXXXK...",
        "....KXXXXXXK....",
      ],
      side: [
        ".....KKKKKKK....",
        "....KXXXXXXXK...",
        "...KXXXXXXXXXK..",
        "...KXXXXxDDDDK..",
        "...KXXXxDDDDDK..",
        "...KXXXDDDDEDK..",
        "...KXXXxDDDDDK..",
        "...KXXXXxDDDDK..",
        "....KXXXXXXKK...",
        ".....KXXXXK.....",
      ],
    },
    torso: {
      down: ["...KCCCAACCCK...", "..KCCCCAACCCCK..", "..KCcCCAACCcCK..", "..KCCCCAACCCCK..", "..KCCCCAACCCCK.."],
      up: ["...KCCCCCCCCK...", "..KCCCCCCCCCCK..", "..KCcCCCCCCcCK..", "..KCCCCCCCCCCK..", "..KCCCCCCCCCCK.."],
      side: [".....KCCCCCK....", "....KCCCCCCCK...", "....KCcCCCCCK...", "....KCCCCCCCK...", "....KCCCCCCCK..."],
    },
    // Long manteau : on ne voit presque pas les pieds
    legs: {
      down: [
        ["..KCCCCAACCCCK..", "..KCcCCAACCcCK..", "..KCCCCAACCCCK..", "...KKFFKKFFKK...", "................"],
        ["..KCCCCAACCCCK..", "..KCcCCAACCcCK..", "..KCCCCAACCCCK..", "...KKFFKKKKKK...", "................"],
        ["..KCCCCAACCCCK..", "..KCcCCAACCcCK..", "..KCCCCAACCCCK..", "...KKKKKKFFKK...", "................"],
      ],
      up: [
        ["..KCCCCCCCCCCK..", "..KCcCCCCCCcCK..", "..KCCCCCCCCCCK..", "...KKFFKKFFKK...", "................"],
        ["..KCCCCCCCCCCK..", "..KCcCCCCCCcCK..", "..KCCCCCCCCCCK..", "...KKFFKKKKKK...", "................"],
        ["..KCCCCCCCCCCK..", "..KCcCCCCCCcCK..", "..KCCCCCCCCCCK..", "...KKKKKKFFKK...", "................"],
      ],
      side: [
        ["....KCCCCCCCK...", "....KCcCCCCCK...", "....KCCCCCCCCK..", "....KKFFKFFKK...", "................"],
        ["....KCCCCCCCK...", "....KCcCCCCCK...", "....KCCCCCCCCK..", "...KFFKKKFFK....", "................"],
        ["....KCCCCCCCK...", "....KCcCCCCCK...", "....KCCCCCCCCK..", ".....KFFFFK.....", "................"],
      ],
    },
  },
  chevalier: {
    pal: { K: "#0c0a12", X: "#55506e", x: "#38334a", L: "#8a84a4", R: "#d83a3a", r: "#9e1f1f", D: "#0a0810", C: "#55506e", c: "#38334a", A: "#2a2438", S: "#8a84a4", P: "#3a3550", p: "#28243a", F: "#0c0a12" },
    head: {
      down: [
        "......RR........",
        ".....RRr........",
        "....KKKKKKKK....",
        "...KLXXXXXXXK...",
        "..KLXXXXXXXXxK..",
        "..KXXXXXXXXXxK..",
        "..KXDDDDDDDDxK..",
        "..KXXXXXXXXXxK..",
        "...KxXXXXXXxK...",
        "....KKKKKKKK....",
      ],
      up: [
        "......RR........",
        ".....RRr........",
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXRRXXXxK..",
        "..KXXXXRrXXXxK..",
        "..KXXXXXXXXXxK..",
        "..KXXXXXXXXXxK..",
        "...KxXXXXXXxK...",
        "....KKKKKKKK....",
      ],
      side: [
        ".....RR.........",
        "....RRr.........",
        ".....KKKKKKK....",
        "....KLXXXXXXK...",
        "...KLXXXXXXXXK..",
        "...KXXXXXXXXXK..",
        "...KXXXXXDDDDK..",
        "...KXXXXXXXXXK..",
        "....KxXXXXXXK...",
        ".....KKKKKKK....",
      ],
    },
    torso: {
      down: ["..KACCCCCCCCAK..", "..KXCCCLLCCCXK..", "..KSCcCLLCcCSK..", "..KACCCCCCCCAK..", "..KAPPPPPPPPAK.."],
      up: ["..KAAAAAAAAAAK..", "..KXAAAAAAAAXK..", "..KSAAAAAAAASK..", "..KAAAAAAAAAAK..", "..KAAAAAAAAAAK.."],
      side: ["....KACCCCCK....", "...KAXCCCCCSK...", "...KACcCCCCSK...", "...KACCCCCCKK...", "...KAAPPPPPK...."],
    },
  },
  brocoli: {
    pal: { K: "#14220f", X: "#8a929c", x: "#5b626c", G: "#2f7d3a", g: "#1f5a2a", L: "#5fae5f", S: "#8cc265", s: "#6a9e4b", E: "#1b1626", W: "#f8f4e8", P: "#3f7a35", p: "#2c5a26", F: "#2c5a26", C: "#8cc265", c: "#6a9e4b", A: "#7a5230" },
    head: {
      down: [
        "......KXXK......",
        ".....KXXXXK.....",
        "...KKGxxxxGKK...",
        "..KGLGGLGGLGGK..",
        ".KGGGgGGGgGGGGK.",
        ".KGLGGGLGGGLGgK.",
        "..KgGGgGGgGGgK..",
        "...KKgKKKKgKK...",
        "....KSSSSSSK....",
        "....KWESSWEK....",
      ],
      up: [
        "......KXXK......",
        ".....KXXXXK.....",
        "...KKGxxxxGKK...",
        "..KGLGGLGGLGGK..",
        ".KGGGgGGGgGGGGK.",
        ".KGLGGGLGGGLGgK.",
        "..KgGGgGGgGGgK..",
        "...KKgKKKKgKK...",
        "....KSSSSSSK....",
        "....KSSssSSK....",
      ],
      side: [
        ".......KXXK.....",
        "......KXXXXK....",
        "....KKGxxxxGK...",
        "...KGLGGLGGLGK..",
        "..KGGGgGGGgGGGK.",
        "..KGLGGGLGGGLGK.",
        "...KgGGgGGgGGK..",
        "....KKgKKKKgK...",
        ".....KSSSSSSK...",
        ".....KSSSSWEK...",
      ],
    },
    torso: {
      down: ["...KSSSSSSSSK...", "..KSSsSSSSsSSK..", "..KSSSSSSSSSSK..", "...KSSSSSSSSK...", "...KPPPPPPPPK..."],
      up: ["...KSSSSSSSSK...", "..KSSsSSSSsSSK..", "..KSSSSSSSSSSK..", "...KSSSSSSSSK...", "...KPPPPPPPPK..."],
      side: [".....KSSSSSK....", "....KSSSSSSSK...", "....KSsSSSSSK...", "....KSSSSSSKK...", "....KPPPPPPK...."],
    },
  },
};

// ─── Chapitre 2 : la Cité des Frites Perdues ───

/** Variante d'un personnage existant (même silhouette, autre palette). */
const variant = (base: string, pal: Palette): Def => ({ ...DEFS[base], pal: { ...DEFS[base].pal, ...pal } });

Object.assign(DEFS, {
  "gerard": {
    pal: {"K": "#1b1626", "W": "#f8f4e8", "w": "#d8d4cc", "Y": "#f2c14e", "y": "#c9952e", "L": "#f8dc8c", "E": "#1b1626", "M": "#8e1b1b", "R": "#d23a3a", "P": "#f4eee0", "F": "#1b1626"},
    head: {
      down: [
        "....KKKKKKKK....",
        "...KWWWWWWWWK...",
        "...KWWWWWWwwK...",
        "....KKKKKKKK....",
        ".....KLYYYyK....",
        ".....KLEYEyK....",
        ".....KLYYYyK....",
        ".....KLMMYyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KWWWWWWWWK...",
        "...KWWWWWWwwK...",
        "....KKKKKKKK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
      ],
      side: [
        "....KKKKKKKK....",
        "...KWWWWWWWWK...",
        "...KWWWWWWwwK...",
        "....KKKKKKKK....",
        ".....KLYYYyK....",
        ".....KLYYEyK....",
        ".....KLYYYyK....",
        ".....KLYYMyK....",
        ".....KLYYYyK....",
        ".....KLYYYyK....",
      ],
    },
    torso: { down: ["..KK.KLYYYyK.KK.", "..KYKKLYYYyKKYK.", "...KYKLYYYyKYK..", "....KKLYYYyKK...", "....KRPRPRPRK..."], up: ["..KK.KLYYYyK.KK.", "..KYKKLYYYyKKYK.", "...KYKLYYYyKYK..", "....KKLYYYyKK...", "....KRPRPRPRK..."], side: ["......KLYYyK....", ".....KYLYYyK....", "....KYKLYYyK....", ".....KKLYYyK....", "....KRPRPRPRK..."] },
    legs: same(["....KPRPRPRPK...", "....KRPRPRPRK...", ".....KPRPRPK....", ".....KRPRPRK....", "......KKKKK....."]),
  },
  "roi": {
    pal: {"K": "#1b1626", "G": "#7fbf5a", "g": "#5c9a3e", "L": "#a8db7c", "Y": "#e8b830", "y": "#a87a18", "R": "#c62828", "B": "#2e7dd2", "E": "#1b1626", "W": "#f8f4e8", "C": "#5b2b86", "c": "#3f1d60", "A": "#e8b830", "P": "#5b2b86", "p": "#3f1d60", "F": "#1b1626", "S": "#7fbf5a"},
    head: {
      down: [
        "....KYKYYKYK....",
        "....KYYRBRYK....",
        "...KKyyyyyyKK...",
        "..KGLGGGGGGgGK..",
        "..KGGWEGGWEGgK..",
        "..KLGGGGGGGGgK..",
        "..KGGGKKKKGGgK..",
        "..KgGGGGGGGGgK..",
        "...KggGGGGggK...",
        "....KKKKKKKK....",
      ],
      up: [
        "....KYKYYKYK....",
        "....KYYYYYYK....",
        "...KKyyyyyyKK...",
        "..KGLGGGGGGgGK..",
        "..KGGGGLGGGGgK..",
        "..KLGGGGGGGGgK..",
        "..KGGGGGGGGGgK..",
        "..KgGGGGGGGGgK..",
        "...KggGGGGggK...",
        "....KKKKKKKK....",
      ],
      side: [
        ".....KYKYYKYK...",
        ".....KYYRYYYK...",
        "....KKyyyyyyKK..",
        "...KGLGGGGGGGK..",
        "...KGGGGGGWEGK..",
        "...KLGGGGGGGGK..",
        "...KGGGGGKKKGK..",
        "...KgGGGGGGGGK..",
        "....KggGGGGgK...",
        ".....KKKKKKK....",
      ],
    },
    torso: { down: ["..KCCAGGGGACCK..", "..KCcAGGGGAcCK..", ".KCCcCGGGGCcCCK.", ".KCCCCCCCCCCCCK.", "..KCCCCCCCCCCK.."], up: ["..KCCCCCCCCCCK..", "..KCCCCCCCCCCK..", ".KCCcCCCCCCcCCK.", ".KCCCCCCCCCCCCK.", "..KCCCCCCCCCCK.."], side: ["....KCCAGGGK....", "...KCCcAGGGK....", "...KCCCCGGGK....", "...KCCCCCCCK....", "...KCCCCCCCK...."] },
    legs: DEFS.bouchon.legs,
  },
  "laitue": {
    pal: {"K": "#14220f", "G": "#7fbf5a", "g": "#5c9a3e", "L": "#a8db7c", "W": "#f8f4e8", "E": "#1b1626", "C": "#5c9a3e", "c": "#3f7a35", "S": "#7fbf5a", "P": "#3f7a35", "p": "#2c5a26", "F": "#2c5a26", "A": "#b6d98a"},
    head: {
      down: [
        "......KGGK......",
        "....KKGLLGKK....",
        "...KGLGGGGLGK...",
        "..KGLGGGGGGLGK..",
        "..KGGWEGGEWGGK..",
        "..KLGGGGGGGGgK..",
        "..KGGGKKKKGGgK..",
        "..KgLGGGGGGLgK..",
        "...KgGGGGGGgK...",
        "....KKKKKKKK....",
      ],
      up: [
        "......KGGK......",
        "....KKGLLGKK....",
        "...KGLGGGGLGK...",
        "..KGLGGgGGGLGK..",
        "..KGGGgGGgGGGK..",
        "..KLGGGgGGGGgK..",
        "..KGGgGGgGGGgK..",
        "..KgLGGGGGGLgK..",
        "...KgGGGGGGgK...",
        "....KKKKKKKK....",
      ],
      side: [
        ".......KGGK.....",
        ".....KKGLLGK....",
        "....KGLGGGGLK...",
        "...KGLGGGGGGLK..",
        "...KGGGGGWEGGK..",
        "...KLGGGGGGGGK..",
        "...KGGGGGKKKGK..",
        "...KgLGGGGGGLK..",
        "....KgGGGGGgK...",
        ".....KKKKKKK....",
      ],
    },
    torso: { down: ["...KCCCCCCCCK.A.", "..KGCCcCCcCCGKA.", "..KGCCCCCCCCGKA.", "..KKCCCCCCCCKKA.", "...KPPPPPPPPK.A."], up: [".A.KCCCCCCCCK...", ".AKGCCCCCCCCGK..", ".AKGCCcCCcCCGK..", ".AKKCCCCCCCCKK..", ".A.KPPPPPPPPK..."], side: [".....KCCCCCK..A.", "....KCCCCCCGK.A.", "....KCcCCCCGK.A.", "....KCCCCCCKK.A.", "....KPPPPPPK..A."] },
  },
  "patate": {
    pal: {"K": "#2a1a0e", "R": "#c62828", "r": "#8e1b1b", "B": "#b98a52", "b": "#8f663a", "W": "#f8f4e8", "E": "#1b1626", "P": "#6b4a2b", "p": "#4c331d", "F": "#4c331d"},
    head: {
      down: [
        "....KKKKKKKK....",
        "...KRRRRRRRRK...",
        "..KRRRRRRRRRrK..",
        "..KBBBBBBBBBBK..",
        "..KBWEBBBBEWBK..",
        "..KBBBBbBBBBBK..",
        "..KBBBKKKKBBBK..",
        "..KBbBBBBBBbBK..",
        "..KBBBBBBBBBBK..",
        "..KBBBBbBBBBBK..",
      ],
      up: [
        "....KKKKKKKK....",
        "...KRRRRRRRRK...",
        "..KRRRRRRRRRrK..",
        "..KBBBBRrBBBBK..",
        "..KBBBBBBBBBBK..",
        "..KBBbBBBBBBBK..",
        "..KBBBBBBBbBBK..",
        "..KBbBBBBBBbBK..",
        "..KBBBBBBBBBBK..",
        "..KBBBBbBBBBBK..",
      ],
      side: [
        "....KKKKKKKK....",
        "...KRRRRRRRRK...",
        "..KrRRRRRRRRRK..",
        "..KBBBBBBBBBBK..",
        "..KBBBBBBBWEBK..",
        "..KBBbBBBBBBBK..",
        "..KBBBBBBKKKBK..",
        "..KBbBBBBBBbBK..",
        "..KBBBBBBBBBBK..",
        "..KBBBBbBBBBBK..",
      ],
    },
    torso: { down: ["..KBBBBBBBBBBK..", "..KBbBBBBBBbBK..", "...KBBBBBBBBK...", "....KKKKKKKK....", "...KPP....PPK..."], up: ["..KBBBBBBBBBBK..", "..KBbBBBBBBbBK..", "...KBBBBBBBBK...", "....KKKKKKKK....", "...KPP....PPK..."], side: ["..KBBBBBBBBBBK..", "..KBbBBBBBBbBK..", "...KBBBBBBBBK...", "....KKKKKKKK....", ".....KPPPPK....."] },
  },
  "lili": {
    pal: {"K": "#120e18", "X": "#6a3a9a", "x": "#4a2670", "H": "#2a1a20", "S": "#f0c9a8", "s": "#d8a684", "E": "#1b1626", "r": "#d86a7a", "A": "#1d1826", "C": "#2a2438", "c": "#1a1626", "P": "#2a2438", "p": "#1a1626", "F": "#120e18"},
    head: {
      down: [
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXXXXXXXK..",
        "..KXxHHHHHHxXK..",
        "..KXHSSSSSSHXK..",
        "..KXSESSSSESXK..",
        "..KXSSSSSSSSXK..",
        "..KXSSSrrSSSXK..",
        "...KAAAAAAAAK...",
        "....KAAAAAAK....",
      ],
      up: [
        "....KKKKKKKK....",
        "...KXXXXXXXXK...",
        "..KXXXXXXXXXXK..",
        "..KXXXXxxXXXXK..",
        "..KXXXXXXXXXXK..",
        "..KXXXXXXXXXXK..",
        "..KxXXXXXXXXxK..",
        "..KXxXXXXXXxXK..",
        "...KAAAAAAAAK...",
        "....KAAAAAAK....",
      ],
      side: [
        ".....KKKKKKK....",
        "....KXXXXXXXK...",
        "...KXXXXXXXXXK..",
        "...KXXXxHHHHSK..",
        "...KXXXHSSSSSK..",
        "...KXXXSSSSESK..",
        "...KXXXSSSSSSK..",
        "...KXXXSSSSrSK..",
        "....KAAAAAAAK...",
        ".....KAAAAAK....",
      ],
    },
    torso: { down: ["..KXCCCCCCCCXK..", "..KSCCCAACCCSK..", "..KSCcCAACcCSK..", "..KKCCCCCCCCKK..", "...KPPPPPPPPK..."], up: ["..KXXXXXXXXXXK..", "..KSXXXXXXXXSK..", "..KSXxXXXXxXSK..", "..KKXXXXXXXXKK..", "...KPPPPPPPPK..."], side: [".....KXCCCCK....", "....KXCCCCCSK...", "....KXCcCCCSK...", "....KXCCCCCKK...", "....KPPPPPPK...."] },
  },
});

// Habitants : silhouettes déjà dessinées, avec d'autres couleurs
Object.assign(DEFS, {
  carotte: variant("sparrow", { H: "#d8742a", h: "#b05a1e", S: "#e9b18a", G: "#e9b18a", W: "#1b1626", B: "#e9b18a", b: "#c98b66", r: "#8e3a2a", C: "#e07a2a", c: "#b85e1a", P: "#3a4a6a", p: "#2a364e", F: "#2a2026" }),
  poireau: variant("sparrow", { H: "#e8e4d0", h: "#c8c4b0", G: "#1b1626", W: "#f8f4e8", B: "#e9b18a", b: "#c98b66", r: "#8e3a2a", C: "#5a8a4a", c: "#3f6a35", P: "#2a3a2a", p: "#1f2a1f", F: "#1b1626" }),
  chou: variant("bouchon", { H: "#6a4a3a", h: "#4a3226", S: "#e8b894", s: "#c8946a", G: "#e8b894", W: "#e8b894", C: "#5f9e4a", c: "#457a35", A: "#f1efe8", P: "#3f6a3a", p: "#2c4a28", r: "#e07a7a" }),
  tubercule: variant("bouchon", { H: "#ece8f2", h: "#c8c2d4", G: "#8a6a4a", C: "#8a5a3a", c: "#6a4228", A: "#c9a06a", P: "#5a3a28", p: "#46301e" }),
  panais: variant("raymond", { H: "#e8e4ee", M: "#e8e4ee", S: "#ead2b0", s: "#cab08a", C: "#c8b48a", c: "#a8946a", A: "#8a6a3a", a: "#6a4a28", P: "#4a3a2a", p: "#3a2c1e" }),
  navet: variant("raymond", { H: "#2a1a14", M: "#2a1a14", S: "#d8946a", s: "#b8764e", C: "#f1e6f4", c: "#cfc0d8", A: "#8a3a9a", a: "#6a2678" }),
  persil: variant("lili", { X: "#3f8a3a", x: "#2c6a28", H: "#7a4a2a", A: "#f1efe8", C: "#e8e0c8", c: "#c8bfa4", P: "#5a4a3a", p: "#46382a", S: "#f0c9a8" }),
  frida: variant("nico", { X: "#f4eee0", x: "#d8d0c0", W: "#d23a3a", H: "#c86a2a", S: "#e2a982", C: "#d23a3a", c: "#a82a2a", A: "#f4eee0", P: "#3a3a46", p: "#2a2a34" }),
  pois: variant("nico", { X: "#5aa83a", x: "#3f7a28", W: "#a8db7c", H: "#4a3a2a", S: "#f0c9a8", s: "#d8a684", C: "#7cc75a", c: "#5aa83a", A: "#f2c14e", P: "#3a5a8a", p: "#2a4466" }),
});

/** Recoloration de la tenue de Sparrow selon l'objet équipé (même logique que l'appartement). */
const OUTFIT: Record<string, [string, string]> = {
  "ten-survet": ["#e53935", "#9e1f1c"],
  "ten-peignoir": ["#f1efe8", "#c9c5b8"],
  "ten-cape": ["#090909", "#3b3b3b"],
  "ten-frite": ["#f2c14e", "#b5851c"],
  "ten-armure": ["#777777", "#5a5a6e"],
};

export function charRows(id: CharId, dir: Dir, frame: Frame): string[] {
  const d = DEFS[id] ?? DEFS.inconnu;
  const legs = (d.legs ?? LEGS)[dir][frame];
  return [...d.head[dir], ...d.torso[dir], ...legs];
}

/** Sprite prêt à dessiner (mis en cache). `side` regarde à droite ; flip = gauche. */
export function charSprite(id: string, dir: Dir, frame: Frame, flip: boolean, tenue?: string): HTMLCanvasElement {
  const known = (id in DEFS ? id : "inconnu") as CharId;
  const base = DEFS[known].pal;
  const o = id === "sparrow" && tenue ? OUTFIT[tenue] : undefined;
  const pal = o ? { ...base, C: o[0], c: o[1] } : base;
  return bakeRows(`ch:${known}:${dir}:${frame}:${tenue ?? ""}`, charRows(known, dir, frame), pal, flip);
}

export const CHAR_IDS = Object.keys(DEFS) as CharId[];
export const charPalette = (id: CharId) => DEFS[id].pal;
