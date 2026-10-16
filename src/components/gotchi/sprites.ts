/**
 * SPARROWGOTCHI — sprites pixel art (même convention que le jeu : 1 caractère = 1 pixel,
 * couleurs dans PALETTE du jeu existant). Sparrow version « chibi » 16 × 20.
 */

export type Eyes = "lunettes" | "fermes" | "rage" | "focus" | "triste" | "grands";
export type Mouth = "sourire" | "neutre" | "triste" | "ouverte" | "mache";
export type Body = "normal" | "gras" | "manette";

const HAIR = ["......hhhhh.....", "...hhhhhhhhhh...", "..hhhhhhhhhhhh..", "..hssssssssssh..", "..ssssssssssss.."];

const EYES: Record<Eyes, string[]> = {
  lunettes: ["..sggggssggggs..", "..sgwggssgwggs..", "..ssggssssggss.."],
  grands: ["..sKKKKssKKKKs..", "..sKWWKssKWWKs..", "..sKKKKssKKKKs.."],
  fermes: ["..ssssssssssss..", "..sKKKssssKKKs..", "..ssssssssssss.."],
  rage: ["..srrrrssrrrrs..", "..srRrrssrRrrs..", "..ssrrssssrrss.."],
  focus: ["..syyyyssyyyys..", "..syWyyssyWyys..", "..ssyyssssyyss.."],
  triste: ["..sggggssggggs..", "..sgwggssgwggs..", "..swggssssggws.."],
};

const NOSE = ["..sssssSSsssss..", "..bsssssssssb..."];

const MOUTH: Record<Mouth, string[]> = {
  sourire: ["..bbbrbbbbrbbb..", "..bbbbrrrrbbbb.."],
  neutre: ["..bbbbbbbbbbbb..", "..bbbbrrrrbbbb.."],
  triste: ["..bbbbrrrrbbbb..", "..bbbrbbbbrbbb.."],
  ouverte: ["..bbbbKKKKbbbb..", "..bbbbKrrKbbbb.."],
  mache: ["..bbbbrrrrbbbb..", "..bbbbbbbbbbbb.."],
};

const BEARD = ["...bbbbbbbbbB...", "....bbbbbbbB....", ".....bbbbbB....."];

const BODY: Record<Body, string[]> = {
  normal: ["....tttttttt....", "...sttttttttts..", "...tttTTTTttt...", "....pppppppp....", "....kkk..kkk...."],
  gras: ["..tttttttttttt..", ".sttttttttttttts", ".ttttTTTTTTtttt.", "..pppppppppppp..", "...kkk....kkk..."],
  manette: ["....tttttttt....", "...sKKKKKKKKs...", "...tKrKKKKyKt...", "....pppppppp....", "....kkk..kkk...."],
};

export function sparrow(eyes: Eyes, mouth: Mouth, body: Body): string[] {
  return [...HAIR, ...EYES[eyes], ...NOSE, ...MOUTH[mouth], ...BEARD, ...BODY[body]];
}

export const PROPS: Record<string, string[]> = {
  frites: [
    "..y.y.y...",
    ".yy.yyyy..",
    ".yyyyyyy..",
    ".yYyyYyy..",
    "rrrrrrrrr.",
    "rRPPPPPRr.",
    ".rRPPPRr..",
    ".rrrrrrr..",
  ],
  salade: [
    "..v.vv.v..",
    ".vvvvvvvv.",
    "vvvvvvvvvv",
    "PPPPPPPPPP",
    ".PqqqqqqP.",
    "..PPPPPP..",
  ],
  ecran: [
    "KKKKKKKKKK",
    "KyyvvyyyyK",
    "KyvvvvyyrK",
    "KyyvyyyrrK",
    "KKKKKKKKKK",
    "....KK....",
    "..KKKKKK..",
  ],
  coeur: [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."],
  goutte: ["..W..", ".WWW.", "WWWWW", "WWWWW", ".WWW."],
  vapeur: ["..o...", ".o..o.", "..oo..", ".o..o.", "o....."],
  etoile: ["...y...", "...y...", "yyyyyyy", "..yyy..", ".y...y."],
  bulle: [".WWWWW.", "WWWWWWW", "WWWWWWW", ".WWWWW."],
  canape: [
    "RRRRRRRRRRRRRRRRRRRR",
    "RrrrrrrrrrrrrrrrrrrR",
    "RrrrrrrrrrrrrrrrrrrR",
    "RRRRRRRRRRRRRRRRRRRR",
    "K..................K",
  ],
};
