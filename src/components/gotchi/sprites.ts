/**
 * SPARROWGOTCHI — sprites pixel art (même convention que le jeu : 1 caractère = 1 pixel,
 * couleurs dans PALETTE du jeu existant). Sparrow version « chibi » 16 × 20.
 */

export type Eyes = "lunettes" | "fermes" | "rage" | "focus" | "triste" | "grands";
export type Mouth = "sourire" | "neutre" | "triste" | "ouverte" | "mache";
export type Body = "normal" | "gras" | "manette";
export type Legs = "stand" | "walkA" | "walkB" | "assis";

const HAIR = ["......hhhhh.....", "...hhhhhhhhhh...", "..hhhhhhhhhhhh..", "..hssssssssssh..", "..ssssssssssss.."];

const EYES: Record<Eyes, string[]> = {
  lunettes: ["..sggggssggggs..", "..sgwggssgwggs..", "..ssggssssggss.."],
  grands: ["..sKKKKssKKKKs..", "..sKWWKssKWWKs..", "..sKKKKssKKKKs.."],
  fermes: ["..ssssssssssss..", "..sKKKssssKKKs..", "..ssssssssssss.."],
  rage: ["..srrrrssrrrrs..", "..srRrrssrRrrs..", "..ssrrssssrrss.."],
  focus: ["..syyyyssyyyys..", "..syWyyssyWyys..", "..ssyyssssyyss.."],
  triste: ["..sggggssggggs..", "..sgwggssgwggs..", "..swggssssggws.."],
};

/** Variantes de lunettes (appliquées sur les yeux « lunettes » et « triste »). */
const GLASSES: Record<string, string[]> = {
  "lun-aviateur": ["..YggggYYggggY..", "..YgwggYYgwggY..", "..sYggYssYggYs.."],
  "lun-3d": ["..KrrrrKKwwwwK..", "..KrWrrKKwWwwK..", "..sKKKKssKKKKs.."],
  "lun-rondes": ["..soooossoooos..", "..sowgossowgos..", "..ssoossssooss.."],
  "lun-ski": ["..KKKKKKKKKKKK..", "..KwwwwwwWwwwK..", "..KKKKKKKKKKKK.."],
  "lun-laser": ["..ssssssssssss..", "..rrrrrrrrrrrr..", "..sRRRRRRRRRRs.."],
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
/** La barbe pousse avec les niveaux. */
const BEARD_LONG = ["..bbbbbbbbbbbB..", "...bbbbbbbbbB...", "....bbbbbbbB...."];

const TORSO: Record<Body, string[]> = {
  normal: ["....tttttttt....", "...sttttttttts..", "...tttTTTTttt..."],
  gras: ["..tttttttttttt..", ".sttttttttttttts", ".ttttTTTTTTtttt."],
  manette: ["....tttttttt....", "...sKKKKKKKKs...", "...tKrKKKKyKt..."],
};

const LEGS: Record<Legs, [string, string]> = {
  stand: ["....pppppppp....", "....kkk..kkk...."],
  walkA: ["....pppppppp....", "...kkk....kkk..."],
  walkB: ["....pppppppp....", ".....kkkkkk....."],
  assis: ["...pppppppppp...", "...kk......kk..."],
};
const LEGS_GRAS: [string, string] = ["..pppppppppppp..", "...kkk....kkk..."];

/** Tenues : recoloration du t-shirt. */
const OUTFIT: Record<string, [string, string]> = {
  "ten-survet": ["r", "R"],
  "ten-peignoir": ["P", "q"],
  "ten-cape": ["K", "t"],
  "ten-frite": ["y", "Y"],
  "ten-armure": ["o", "M"],
};

export interface Look {
  lunettes?: string;
  tenue?: string;
  tete?: string;
  barbe?: boolean;
}

export function sparrow(eyes: Eyes, mouth: Mouth, body: Body, legs: Legs = "stand", look: Look = {}): string[] {
  let e = EYES[eyes];
  if ((eyes === "lunettes" || eyes === "triste") && look.lunettes && GLASSES[look.lunettes]) e = GLASSES[look.lunettes];
  let torso = TORSO[body];
  const o = look.tenue && OUTFIT[look.tenue];
  if (o) torso = torso.map((r) => r.replace(/t/g, o[0]).replace(/T/g, o[1]));
  const l = body === "gras" && legs !== "assis" ? LEGS_GRAS : LEGS[legs];
  return [...HAIR, ...e, ...NOSE, ...MOUTH[mouth], ...(look.barbe ? BEARD_LONG : BEARD), ...torso, ...l];
}

/** Couvre-chefs, dessinés par-dessus la tête (décalage y négatif possible). */
export const HATS: Record<string, { rows: string[]; dy: number }> = {
  "tet-casquette": { rows: ["....rrrrrrr.....", "...rrrrrrrrr....", "...RRRRRRRRRRRR."], dy: -1 },
  "tet-bob": { rows: ["....qqqqqqqq....", "...qPPPPPPPPq...", ".qqqqqqqqqqqqqq."], dy: -1 },
  "tet-casque": { rows: ["....KKKKKKKK....", "...K........K...", "..K..........K..", "..K..........K..", ".rr..........rr.", ".rr..........rr."], dy: -1 },
  "tet-masque": { rows: ["..m.........m...", "..mm.......mm...", "..mmmmmmmmmmmm..", "..mmMMmmmmmmmm..", "..mmmmmmmmmmmm.."], dy: -1 },
  "tet-couronne": { rows: ["...y..y..y..y...", "...yy.yy.yy.yy..", "...yyyyyyyyyyy..", "...YyrYYYYyrYY.."], dy: -3 },
};

export const CAPE = ["..RRRRRRRRRRRR..", ".RRRRRRRRRRRRRR.", ".RRRRRRRRRRRRRR.", "RRRRRRRRRRRRRRRR", "RRRRRRRRRRRRRRRR"];

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
  piece: [".yyy.", "yYyyy", "yYyyy", "yYyyy", ".yyy."],
  eclat: ["..W..", ".WyW.", "WyyyW", ".WyW.", "..W.."],
  question: [".KKK.", "K...K", "...K.", "..K..", ".....", "..K.."],
  exclam: ["..r..", "..r..", "..r..", "..r..", ".....", "..r.."],
};

/** Mobilier de l'appartement. */
export const FURNITURE: Record<string, string[]> = {
  lit: [
    "KK......................",
    "KPPPP...................",
    "KPPPPrrrrrrrrrrrrrrrrrrK",
    "KRRRRRRRRRRRRRRRRRRRRRRK",
    "KTTTTTTTTTTTTTTTTTTTTTTK",
    "K......................K",
  ],
  douche: [
    "oooooooo....",
    "o......o....",
    "o.ooooooo...",
    "o..o.o.o....",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "o...........",
    "oqqqqqqqqqqq",
    "qqqqqqqqqqqq",
  ],
  bureau: [
    "......KKKKKKKKKKKK....",
    "......KyyvvyyyyyyK....",
    "......KyvvvvyyyrrK....",
    "......KyyvyyyyrrrK....",
    "......KyyyyyyyyyyK....",
    "......KKKKKKKKKKKK....",
    "..........KKKK........",
    "......KKKKKKKKKKKK....",
    "CCCCCCCCCCCCCCCCCCCCCC",
    "CccccccccccccccccccccC",
    "C....................C",
    "C....................C",
    "C....................C",
    "C....................C",
  ],
  ecranNoir: [
    "KKKKKKKKKKKK",
    "KKKKKKKKKKKK",
    "KKKKKKKKKKKK",
    "KKKKKKKKKKKK",
    "KKKKKKKKKKKK",
    "KKKKKKKKKKKK",
  ],
  chaise: ["KKKK..", "KRRK..", "KRRK..", "KRRK..", "KRRRRK", "K....K", "K....K"],
  tele: [
    "KKKKKKKKKKKKKKKK",
    "KooooooooooooooK",
    "KoMMMMMMMMMMMMoK",
    "KoMMMMMMMMMMMMoK",
    "KoMMMMMMMMMMMMoK",
    "KoMMMMMMMMMMMMoK",
    "KooooooooooooooK",
    "KKKKKKKKKKKKKKKK",
    "......KKKK......",
    "...CCCCCCCCCC...",
    "...C........C...",
  ],
  frigo: [
    "PPPPPPPPPPPP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqoP",
    "PqqqqqqqqqoP",
    "PqqqqqqqqqqP",
    "PPPPPPPPPPPP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqoP",
    "PqqqqqqqqqoP",
    "PqqqqqqqqqoP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PqqqqqqqqqqP",
    "PPPPPPPPPPPP",
    "K..........K",
  ],
  friteuse: ["..oooooo..", ".oyyyyyyo.", "oooooooooo", "oKKKKKKKKo", "oKrKKKKKKo", "oooooooooo"],
  plan: [
    "CCCCCCCCCCCCCCCCCC",
    "CccccccccccccccccC",
    "C................C",
    "C................C",
    "C................C",
    "C................C",
  ],
  fenetre: [
    "KKKKKKKKKKKK",
    "KwwwwwKwwwwK",
    "KwWwwwKwwwwK",
    "KwwwwwKwwwwK",
    "KKKKKKKKKKKK",
    "KwwwwwKwwwwK",
    "KwwwwwKwwWwK",
    "KKKKKKKKKKKK",
  ],
  // Décorations achetables
  poster: ["KKKKKKKKKK", "KRRRRRRRRK", "KRyyyyyyRK", "KRRyyyyRRK", "KRRRyyRRRK", "KRRRRRRRRK", "KKKKKKKKKK"],
  plante: ["..v.v...", ".vvvvv..", "vvvvvvv.", ".vvvvv..", "...v....", "..CCCC..", "..CccC..", "...CC..."],
  tapis: ["rRrRrRrRrRrRrRrRrRrRrR", "RrRrRrRrRrRrRrRrRrRrRr"],
  neons: ["rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr"],
  friteuseOr: ["..YYYYYY..", ".YyyyyyyY.", "YYYYYYYYYY", "YyyyyyyyyY", "YyryyyyyyY", "YYYYYYYYYY"],
  oeuf: ["..yyy...", ".yYyyy..", "yyyyYyy.", "yYyyyyy.", "yyyyyYy.", ".yyyyy..", "..yyy..."],
};

// ─── Mini-jeu de farm : ressources et petits monstres (inventés) ───
export const FARM_SPRITES: Record<string, string[]> = {
  epi: ["...y...", "..yYy..", "..yyy..", "..yYy..", "..yyy..", "...v...", "..vv...", "...v..."],
  minerai: ["..ooo...", ".owooo..", "oooMooo.", "ooyoooo.", ".oooMo..", "..ooo..."],
  bois: ["..CCCC..", ".CccccC.", "CcCccCcC", "CccccccC", ".CccccC.", "..CCCC.."],
  bouboule: ["...rrrr...", "..rrrrrr..", ".rrWKrWKr.", ".rrrrrrrr.", ".rrRRRRrr.", "..rrrrrr..", "..r....r.."],
  croquinou: [".C......C.", ".CCCCCCCC.", "CCyKCCyKCC", "CCCCCCCCCC", "CCWCWCWCCC", ".CCCCCCCC.", ".kk....kk."],
  larvouille: [".......vv.", "......vKvv", "..vvvvvvvv", ".vvKvvKvv.", "vvvvvvvv..", ".v.v.v.v.."],
  oeuf: FURNITURE.oeuf,
  coeur: PROPS.coeur,
};
