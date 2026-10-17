/**
 * RPG — personnages (sprites originaux 16 × 20, contour sombre, 4 directions).
 *
 * Chaque personnage = une tête (par direction) + un buste + des jambes animées (repos, pas A,
 * pas B), recolorés avec sa palette. Les lettres sont des « rôles » de couleur :
 *   K contour · H/h cheveux · S/s peau · E yeux · W blanc · C/c vêtement · A accent
 *   P/p bas · F chaussures · X/x couvre-chef · G lunettes · B/b barbe · M moustache · L lueur
 */

import { bakeRows, type Palette } from "./pixel";

export type Dir = "down" | "up" | "side";
export type Frame = 0 | 1 | 2; // repos, pas A, pas B
export type CharId = "sparrow" | "nico" | "bouchon" | "raymond" | "inconnu";

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

const DEFS: Record<CharId, Def> = {
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
};

/** Recoloration de la tenue de Sparrow selon l'objet équipé (même logique que l'appartement). */
const OUTFIT: Record<string, [string, string]> = {
  "ten-survet": ["#e53935", "#9e1f1c"],
  "ten-peignoir": ["#f1efe8", "#c9c5b8"],
  "ten-cape": ["#090909", "#3b3b3b"],
  "ten-frite": ["#f2c14e", "#b5851c"],
  "ten-armure": ["#777777", "#5a5a6e"],
};

export function charRows(id: CharId, dir: Dir, frame: Frame): string[] {
  const d = DEFS[id];
  const legs = (d.legs ?? LEGS)[dir][frame];
  return [...d.head[dir], ...d.torso[dir], ...legs];
}

/** Sprite prêt à dessiner (mis en cache). `side` regarde à droite ; flip = gauche. */
export function charSprite(id: CharId, dir: Dir, frame: Frame, flip: boolean, tenue?: string): HTMLCanvasElement {
  const base = DEFS[id].pal;
  const o = id === "sparrow" && tenue ? OUTFIT[tenue] : undefined;
  const pal = o ? { ...base, C: o[0], c: o[1] } : base;
  return bakeRows(`ch:${id}:${dir}:${frame}:${tenue ?? ""}`, charRows(id, dir, frame), pal, flip);
}

export const CHAR_IDS = Object.keys(DEFS) as CharId[];
export const charPalette = (id: CharId) => DEFS[id].pal;
