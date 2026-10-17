/**
 * RPG — données de combat : techniques, membres de l'équipe, ennemis, combats, objets et équipements.
 * Pur et sans dépendance : utilisé par le moteur (combat.ts), l'interface et les tests d'équilibrage.
 */

export type Stat = "atk" | "def" | "spd" | "acc";
export type StatusId = "etourdi" | "brule";
/** Effet visuel joué par l'écran de combat. */
export type Fx = "titan" | "dague" | "coup" | "feu" | "soin" | "bonus" | "malus" | "ombre" | "lame" | "sel" | "huile" | "frites" | "feuille" | "sieste" | "charge" | "vinaigre" | "bouclier" | "terre";

export type MoveEffect =
  | { kind: "stage"; stat: Stat; n: number; who: "self" | "target"; chance?: number }
  | { kind: "status"; status: StatusId; chance: number }
  | { kind: "heal"; pct: number }
  | { kind: "guard" }
  | { kind: "cleanse" }
  | { kind: "recoil"; pct: number }
  /** Vole un objet à l'ennemi (une fois par combat). */
  | { kind: "steal" }
  /** Dégâts multipliés si la cible est sous ce ratio de PV. */
  | { kind: "execute"; below: number; mult: number };

export interface Move {
  id: string;
  name: string;
  desc: string;
  /** 0 = technique sans dégâts. */
  power: number;
  /** Précision en % (100 = ne rate jamais sauf malus). */
  acc: number;
  /** Cible : l'adversaire, soi-même, ou l'allié le plus blessé (soins d'équipe). */
  target: "foe" | "self" | "ally";
  effects?: MoveEffect[];
  /** Tours de préparation (attaque annoncée, lancée au tour suivant). */
  charge?: number;
  /** Nombre de coups [min, max]. */
  hits?: [number, number];
  priority?: number;
  fx: Fx;
}

export const MOVES: Record<string, Move> = {
  // Sparrow
  "coup-manette": { id: "coup-manette", name: "Coup de manette", desc: "Un coup sec avec la manette. Fiable.", power: 40, acc: 100, target: "foe", fx: "coup" },
  "frite-enflammee": { id: "frite-enflammee", name: "Frite enflammée", desc: "Une frite brûlante lancée avec conviction. Peut brûler.", power: 50, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 30 }], fx: "feu" },
  "micro-sieste": { id: "micro-sieste", name: "Micro-sieste", desc: "Trois secondes de sommeil. Rend 40 % des PV et soigne les états.", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 40 }, { kind: "cleanse" }], fx: "sieste" },
  "rage-lag": { id: "rage-lag", name: "Rage de lag", desc: "Sparrow accumule 400 ms de frustration… puis tout explose. Se prépare un tour.", power: 110, acc: 90, target: "foe", charge: 1, fx: "charge" },
  "pluie-frites": { id: "pluie-frites", name: "Pluie de frites", desc: "Une averse de frites dorées : 2 à 4 coups.", power: 20, acc: 95, target: "foe", hits: [2, 4], fx: "frites" },
  // Chevalier Noir
  "lame-ombre": { id: "lame-ombre", name: "Lame d'ombre", desc: "Une entaille sortie de nulle part. Frappe en premier.", power: 40, acc: 100, target: "foe", priority: 1, fx: "ombre" },
  fumigene: { id: "fumigene", name: "Fumigène", desc: "Un nuage noir très dramatique. Baisse la précision de l'ennemi.", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }], fx: "ombre" },
  "garde-silencieuse": { id: "garde-silencieuse", name: "Garde silencieuse", desc: "Se met en garde : le prochain coup subi est divisé par deux. Défense +1.", power: 0, acc: 100, target: "self", priority: 2, effects: [{ kind: "guard" }, { kind: "stage", stat: "def", n: 1, who: "self" }], fx: "bouclier" },
  eclipse: { id: "eclipse", name: "Éclipse", desc: "Le Chevalier masque la lumière, puis frappe. Peut étourdir. Se prépare un tour.", power: 90, acc: 95, target: "foe", charge: 1, effects: [{ kind: "status", status: "etourdi", chance: 35 }], fx: "lame" },
  // Gérard la Frite
  "sel-mer": { id: "sel-mer", name: "Sel de mer", desc: "Du gros sel dans les yeux. Peut baisser la défense.", power: 30, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "def", n: -1, who: "target", chance: 35 }], fx: "sel" },
  "cornet-soin": { id: "cornet-soin", name: "Cornet de soin", desc: "Un cornet tout chaud : Gérard récupère 45 % de ses PV, les équipiers en réserve 20 %.", power: 0, acc: 100, target: "ally", effects: [{ kind: "heal", pct: 45 }, { kind: "cleanse" }], fx: "soin" },
  "huile-bouillante": { id: "huile-bouillante", name: "Huile bouillante", desc: "Une giclée d'huile à 180 °C. Brûle souvent.", power: 45, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 50 }], fx: "huile" },
  "frite-geante": { id: "frite-geante", name: "Frite géante", desc: "Gérard brandit une frite de deux mètres. Se prépare un tour.", power: 105, acc: 90, target: "foe", charge: 1, fx: "frites" },
  // Lili
  "dague-eclair": { id: "dague-eclair", name: "Dague éclair", desc: "Lili frappe avant tout le monde.", power: 35, acc: 100, target: "foe", priority: 1, fx: "dague" },
  "vol-tire": { id: "vol-tire", name: "Vol à la tire", desc: "Un coup… et un objet en moins dans la poche de l'ennemi (une fois par combat).", power: 30, acc: 95, target: "foe", effects: [{ kind: "steal" }], fx: "dague" },
  "poudre-violette": { id: "poudre-violette", name: "Poudre violette", desc: "Un nuage violet : précision et attaque de l'ennemi baissent.", power: 0, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }, { kind: "stage", stat: "atk", n: -1, who: "target" }], fx: "ombre" },
  "coup-grace": { id: "coup-grace", name: "Coup de grâce", desc: "Faible d'habitude, dévastateur sur un ennemi affaibli (sous 40 % de PV).", power: 40, acc: 95, target: "foe", effects: [{ kind: "execute", below: 0.4, mult: 2.5 }], fx: "lame" },
  // SPARROW TITAN (transformation)
  "developpe-cosmique": { id: "developpe-cosmique", name: "Développé cosmique", desc: "Sparrow soulève l'univers et le laisse tomber sur l'ennemi.", power: 85, acc: 95, target: "foe", fx: "titan" },
  "biceps-sismique": { id: "biceps-sismique", name: "Biceps sismique", desc: "Le sol tremble. L'ennemi aussi. Peut étourdir.", power: 60, acc: 100, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "terre" },
  "cri-titan": { id: "cri-titan", name: "Cri du Titan", desc: "Un cri à décoiffer un brocoli : Attaque +1, Défense de l'ennemi −1.", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "def", n: -1, who: "target" }], fx: "bonus" },
  "sieste-titan": { id: "sieste-titan", name: "Sieste du Titan", desc: "Même un Titan a besoin de repos : rend 45 % des PV.", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 45 }, { kind: "cleanse" }], fx: "sieste" },
  // Ennemis du chapitre 3
  "roule-boule": { id: "roule-boule", name: "Roulé-boulé", desc: "", power: 45, acc: 95, target: "foe", fx: "terre" },
  "poids-mort": { id: "poids-mort", name: "Poids mort", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 2, who: "self" }], fx: "bouclier" },
  "chute-libre": { id: "chute-libre", name: "Chute libre", desc: "", power: 105, acc: 90, target: "foe", charge: 1, fx: "terre" },
  "shake-explosif": { id: "shake-explosif", name: "Shake explosif", desc: "", power: 50, acc: 90, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 20 }], fx: "huile" },
  "gorgee-whey": { id: "gorgee-whey", name: "Gorgée de whey", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 30 }], fx: "soin" },
  "mousse-aveuglante": { id: "mousse-aveuglante", name: "Mousse aveuglante", desc: "", power: 20, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }], fx: "sel" },
  "pompes-infinies": { id: "pompes-infinies", name: "Pompes infinies", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "spd", n: 1, who: "self" }], fx: "bonus" },
  "coup-serviette": { id: "coup-serviette", name: "Coup de serviette", desc: "", power: 45, acc: 100, target: "foe", fx: "coup" },
  planche: { id: "planche", name: "Planche", desc: "", power: 0, acc: 100, target: "self", priority: 2, effects: [{ kind: "guard" }], fx: "bouclier" },
  "biceps-canon": { id: "biceps-canon", name: "Biceps-canon", desc: "", power: 55, acc: 95, target: "foe", fx: "coup" },
  "protocole-gain": { id: "protocole-gain", name: "Protocole du Gain", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 2, who: "self" }], fx: "bonus" },
  "shaker-celeste": { id: "shaker-celeste", name: "Shaker céleste", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 22 }], fx: "soin" },
  "squat-sismique": { id: "squat-sismique", name: "Squat sismique", desc: "", power: 110, acc: 90, target: "foe", charge: 1, effects: [{ kind: "status", status: "etourdi", chance: 25 }], fx: "terre" },
  "haltere-apocalypse": { id: "haltere-apocalypse", name: "Haltère de l'Apocalypse", desc: "", power: 130, acc: 90, target: "foe", charge: 1, fx: "titan" },
  "rage-fonte": { id: "rage-fonte", name: "Rage de la fonte", desc: "", power: 60, acc: 90, target: "foe", effects: [{ kind: "recoil", pct: 10 }], fx: "coup" },
  "pose-culturiste": { id: "pose-culturiste", name: "Pose de culturiste", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 2, who: "self" }], fx: "bouclier" },
  "uppercut-proteine": { id: "uppercut-proteine", name: "Uppercut protéiné", desc: "", power: 50, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 25 }], fx: "coup" },
  // Ennemis
  "coup-feuille": { id: "coup-feuille", name: "Coup de feuille", desc: "", power: 35, acc: 95, target: "foe", fx: "feuille" },
  "garde-a-vous": { id: "garde-a-vous", name: "Garde-à-vous", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 1, who: "self" }], fx: "bonus" },
  "jet-vapeur": { id: "jet-vapeur", name: "Jet de vapeur", desc: "", power: 45, acc: 85, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target", chance: 30 }], fx: "vinaigre" },
  "roulade-terreuse": { id: "roulade-terreuse", name: "Roulade terreuse", desc: "", power: 45, acc: 90, target: "foe", effects: [{ kind: "recoil", pct: 10 }], fx: "terre" },
  germination: { id: "germination", name: "Germination", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 25 }], fx: "soin" },
  "oeil-patate": { id: "oeil-patate", name: "Œil de patate", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "def", n: -1, who: "target" }], fx: "malus" },
  "bouclier-laitue": { id: "bouclier-laitue", name: "Bouclier laitue", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "guard" }, { kind: "stage", stat: "def", n: 1, who: "self" }], fx: "bouclier" },
  "gifle-croquante": { id: "gifle-croquante", name: "Gifle croquante", desc: "", power: 40, acc: 100, target: "foe", fx: "feuille" },
  "salve-pepins": { id: "salve-pepins", name: "Salve de pépins", desc: "", power: 15, acc: 90, target: "foe", hits: [2, 3], fx: "sel" },
  // Roi de la Salade
  "sceptre-celeri": { id: "sceptre-celeri", name: "Sceptre-céleri", desc: "", power: 45, acc: 95, target: "foe", fx: "lame" },
  "decret-royal": { id: "decret-royal", name: "Décret royal", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "atk", n: -1, who: "target" }], fx: "malus" },
  "pluie-vinaigrette": { id: "pluie-vinaigrette", name: "Pluie de vinaigrette", desc: "", power: 40, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 30 }], fx: "vinaigre" },
  "regime-strict": { id: "regime-strict", name: "Régime strict", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 20 }, { kind: "stage", stat: "def", n: 1, who: "self" }], fx: "soin" },
  "tornade-croutons": { id: "tornade-croutons", name: "Tornade de croûtons", desc: "", power: 115, acc: 90, target: "foe", charge: 1, fx: "terre" },
  "colere-verte": { id: "colere-verte", name: "Colère verte", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 2, who: "self" }], fx: "bonus" },
  "fouet-poireau": { id: "fouet-poireau", name: "Fouet-poireau", desc: "", power: 55, acc: 90, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 20 }], fx: "feuille" },
};

// ─── Équipe ───

export interface Growth {
  hp: [number, number];
  atk: [number, number];
  def: [number, number];
  spd: [number, number];
}

export interface Member {
  id: string;
  name: string;
  /** Sprite de combat (components/rpg/battlers.ts). */
  sprite: string;
  /** Statistiques au niveau 1 et gain par niveau. */
  grow: Growth;
  moves: [string, string, string, string];
  desc: string;
}

export const MEMBERS: Record<string, Member> = {
  sparrow: {
    id: "sparrow",
    name: "Sparrow",
    sprite: "sparrow",
    grow: { hp: [46, 6], atk: [12, 1.6], def: [10, 1.3], spd: [11, 1.4] },
    moves: ["coup-manette", "frite-enflammee", "micro-sieste", "rage-lag"],
    desc: "Gamer de l'extrême, expert en sieste, Élu de la Minute malgré lui.",
  },
  chevalier: {
    id: "chevalier",
    name: "Chevalier Noir",
    sprite: "chevalier",
    grow: { hp: [50, 6], atk: [12, 1.5], def: [12, 1.6], spd: [9, 1.2] },
    moves: ["lame-ombre", "fumigene", "garde-silencieuse", "eclipse"],
    desc: "Gardien de la route du Centre-ville. Solennel, dramatique, étonnamment gentil.",
  },
  lili: {
    id: "lili",
    name: "Lili",
    sprite: "lili",
    grow: { hp: [40, 5], atk: [12, 1.6], def: [8, 1.1], spd: [14, 1.8] },
    moves: ["dague-eclair", "vol-tire", "poudre-violette", "coup-grace"],
    desc: "Voleuse professionnelle, acrobate amateur. Elle a une dent contre le Cadran.",
  },
  gerard: {
    id: "gerard",
    name: "Gérard la Frite",
    sprite: "gerard",
    grow: { hp: [44, 5.5], atk: [11, 1.5], def: [9, 1.2], spd: [12, 1.5] },
    moves: ["sel-mer", "cornet-soin", "huile-bouillante", "frite-geante"],
    desc: "Dernier friturier libre de la Cité. Croustillant dehors, tendre dedans.",
  },
};

/** Techniques apprises qui remplacent une technique de base. */
export const SKILLS: Record<string, { member: string; replaces: string; move: string; name: string }> = {
  "pluie-frites": { member: "sparrow", replaces: "coup-manette", move: "pluie-frites", name: "Pluie de frites" },
  // Transformation (ne remplace aucune technique : elle ajoute « SPARROW TITAN » au menu des techniques)
  titan: { member: "sparrow", replaces: "", move: "", name: "SPARROW TITAN" },
};

/** Techniques de Sparrow sous sa forme de Titan. */
export const TITAN_MOVES = ["developpe-cosmique", "biceps-sismique", "cri-titan", "sieste-titan"];

// ─── Ennemis ───

export interface Phase {
  /** Passe à cette phase sous ce ratio de PV. */
  below: number;
  moves: string[];
  /** Réplique de transition. */
  line: string;
  /** Soin au changement de phase (% des PV max). */
  heal?: number;
  /** Bonus d'attaque/défense (crans). */
  stages?: Partial<Record<Stat, number>>;
  /** Nouveau sprite (transformation). */
  sprite?: string;
}

export interface Foe {
  id: string;
  name: string;
  sprite: string;
  /** Niveau minimal / maximal (il suit celui de Sparrow entre les deux). */
  lv: [number, number];
  /** Statistiques au niveau minimal ; +7 % par niveau au-delà. */
  hp: number;
  atk: number;
  def: number;
  spd: number;
  moves: string[];
  phases?: Phase[];
  boss?: boolean;
}

export const FOES: Record<string, Foe> = {
  "haltere-sauvage": { id: "haltere-sauvage", name: "Haltère Sauvage", sprite: "haltere", lv: [6, 14], hp: 60, atk: 17, def: 18, spd: 8, moves: ["roule-boule", "poids-mort", "chute-libre"] },
  proteinator: { id: "proteinator", name: "Protéinator", sprite: "proteinator", lv: [6, 14], hp: 96, atk: 17, def: 15, spd: 12, boss: true, moves: ["shake-explosif", "gorgee-whey", "mousse-aveuglante"] },
  "moine-gain": { id: "moine-gain", name: "Moine du Gain", sprite: "moine", lv: [7, 15], hp: 80, atk: 19, def: 16, spd: 14, moves: ["coup-serviette", "pompes-infinies", "planche"] },
  gonflax: {
    id: "gonflax",
    name: "Coach Gonflax",
    sprite: "gonflax",
    lv: [8, 16],
    hp: 190,
    atk: 19,
    def: 17,
    spd: 13,
    boss: true,
    moves: ["biceps-canon", "protocole-gain", "shaker-celeste", "squat-sismique"],
    phases: [
      {
        below: 0.5,
        moves: ["haltere-apocalypse", "rage-fonte", "pose-culturiste", "uppercut-proteine"],
        line: "« ON NE S'ARRÊTE JAMAIS ! » Gonflax avale trois shakers d'un coup… et GONFLE AU MAX !",
        heal: 15,
        stages: { atk: 1, def: 1 },
        sprite: "gonflax-max",
      },
    ],
  },
  "soldat-brocoli": { id: "soldat-brocoli", name: "Soldat Brocoli", sprite: "brocoli", lv: [1, 8], hp: 30, atk: 11, def: 9, spd: 8, moves: ["coup-feuille", "garde-a-vous", "jet-vapeur"] },
  "patate-renegate": { id: "patate-renegate", name: "Patate Renégate", sprite: "patate", lv: [3, 10], hp: 44, atk: 14, def: 11, spd: 7, moves: ["roulade-terreuse", "germination", "oeil-patate"] },
  "garde-laitue": { id: "garde-laitue", name: "Garde Laitue", sprite: "laitue", lv: [4, 11], hp: 46, atk: 14, def: 13, spd: 11, moves: ["gifle-croquante", "bouclier-laitue", "salve-pepins"] },
  "roi-salade": {
    id: "roi-salade",
    name: "Roi de la Salade",
    sprite: "roi",
    lv: [5, 12],
    hp: 112,
    atk: 14,
    def: 13,
    spd: 10,
    boss: true,
    moves: ["sceptre-celeri", "decret-royal", "pluie-vinaigrette", "regime-strict"],
    phases: [
      {
        below: 0.5,
        moves: ["fouet-poireau", "pluie-vinaigrette", "tornade-croutons", "colere-verte"],
        line: "« ASSEZ ! » Le Roi arrache sa cape : MODE VINAIGRETTE ! Ses feuilles se hérissent.",
        heal: 15,
        stages: { atk: 1 },
        sprite: "roi-colere",
      },
    ],
  },
};

export interface BattleDef {
  id: string;
  foes: string[];
  /** Phrase d'entrée. */
  intro: string;
  canFlee: boolean;
  xp: number;
  fp: number;
  /** Consommables gagnés à la victoire. */
  drops?: Record<string, number>;
  /** Fond de l'écran de combat. */
  bg: "rue" | "cite" | "egout" | "palais" | "trone" | "montagne" | "temple" | "sanctuaire";
  /** Conseils affichés au premier combat (tutoriel). */
  tutorial?: boolean;
  music?: "combat" | "boss";
}

export const BATTLES: Record<string, BattleDef> = {
  "haltere-1": { id: "haltere-1", foes: ["haltere-sauvage"], intro: "Un Haltère Sauvage dévale la pente !", canFlee: true, xp: 70, fp: 40, drops: { "barre-proteinee": 1 }, bg: "montagne" },
  "halteres-2": { id: "halteres-2", foes: ["haltere-sauvage", "haltere-sauvage"], intro: "Deux Haltères Sauvages ! Ils roulent en paire.", canFlee: true, xp: 110, fp: 60, drops: { soupe: 1 }, bg: "montagne" },
  proteinator: { id: "proteinator", foes: ["proteinator"], intro: "Le PROTÉINATOR bloque le pont ! Il secoue sa mousse menaçante.", canFlee: false, xp: 150, fp: 90, drops: { "mega-cornet": 1 }, bg: "montagne", music: "boss" },
  "moine-1": { id: "moine-1", foes: ["moine-gain"], intro: "Un Moine du Gain vous barre le chemin !", canFlee: true, xp: 80, fp: 45, drops: { "barre-proteinee": 1 }, bg: "temple" },
  "moine-reserve": { id: "moine-reserve", foes: ["moine-gain", "moine-gain"], intro: "Les gardiens de la réserve ! « Personne ne touche aux oreillers confisqués ! »", canFlee: true, xp: 120, fp: 70, bg: "temple" },
  arene: { id: "arene", foes: ["moine-gain", "haltere-sauvage", "moine-gain"], intro: "ÉPREUVE DE L'ENDURANCE : trois adversaires, sans pause !", canFlee: false, xp: 220, fp: 120, drops: { ketchup: 1 }, bg: "temple" },
  gonflax: { id: "gonflax", foes: ["gonflax"], intro: "Coach Gonflax descend de son podium en faisant craquer ses doigts !", canFlee: false, xp: 380, fp: 250, bg: "sanctuaire", music: "boss" },
  eclaireur: { id: "eclaireur", foes: ["soldat-brocoli"], intro: "Un Soldat Brocoli barre la route !", canFlee: false, xp: 45, fp: 30, drops: { frites: 2 }, bg: "rue", tutorial: true },
  "brocoli-cite": { id: "brocoli-cite", foes: ["soldat-brocoli"], intro: "Un Soldat Brocoli en patrouille !", canFlee: true, xp: 40, fp: 25, drops: { frites: 1 }, bg: "cite" },
  "brocolis-porte": { id: "brocolis-porte", foes: ["soldat-brocoli", "soldat-brocoli"], intro: "Deux Soldats Brocoli gardent la porte du marché !", canFlee: true, xp: 70, fp: 40, drops: { "sauce-piquante": 1 }, bg: "cite" },
  "patate-1": { id: "patate-1", foes: ["patate-renegate"], intro: "Une Patate Renégate surgit des eaux !", canFlee: true, xp: 55, fp: 30, drops: { frites: 1 }, bg: "egout" },
  "patate-2": { id: "patate-2", foes: ["patate-renegate", "patate-renegate"], intro: "Une bande de Patates Renégates !", canFlee: true, xp: 90, fp: 45, drops: { "part-pizza": 1 }, bg: "egout" },
  "laitue-1": { id: "laitue-1", foes: ["garde-laitue"], intro: "Un Garde Laitue donne l'alerte !", canFlee: true, xp: 65, fp: 35, drops: { "mega-cornet": 1 }, bg: "palais" },
  "laitue-2": { id: "laitue-2", foes: ["garde-laitue", "soldat-brocoli"], intro: "La garde royale bloque le couloir !", canFlee: false, xp: 95, fp: 50, drops: { ketchup: 1 }, bg: "palais" },
  "roi-salade": { id: "roi-salade", foes: ["roi-salade"], intro: "Le Roi de la Salade se lève de son trône !", canFlee: false, xp: 220, fp: 150, bg: "trone", music: "boss" },
};

// ─── Objets ───

export interface Consumable {
  id: string;
  name: string;
  desc: string;
  price: number;
  use: { heal?: number; healPct?: number; cleanse?: boolean; stage?: { stat: Stat; n: number }; revive?: number };
  /** Utilisable sur un équipier K.O. uniquement. */
  ko?: boolean;
}

export const CONSUMABLES: Record<string, Consumable> = {
  frites: { id: "frites", name: "Cornet de frites", desc: "Rend 35 PV. Le carburant officiel.", price: 20, use: { heal: 35 } },
  "mega-cornet": { id: "mega-cornet", name: "Méga-cornet", desc: "Rend 90 PV. Format familial.", price: 60, use: { heal: 90 } },
  "part-pizza": { id: "part-pizza", name: "Part de pizza", desc: "Rend 50 % des PV et soigne les états.", price: 45, use: { healPct: 50, cleanse: true } },
  "sauce-piquante": { id: "sauce-piquante", name: "Sauce piquante", desc: "Attaque +2 jusqu'à la fin du combat.", price: 40, use: { stage: { stat: "atk", n: 2 } } },
  ketchup: { id: "ketchup", name: "Ketchup de rappel", desc: "Relève un équipier K.O. avec 50 % de ses PV.", price: 80, use: { revive: 50 }, ko: true },
  tisane: { id: "tisane", name: "Tisane de persil", desc: "Rend 20 PV et soigne les états. Goût : jardin.", price: 15, use: { heal: 20, cleanse: true } },
  "barre-proteinee": { id: "barre-proteinee", name: "Barre protéinée", desc: "Rend 25 PV et Attaque +1. Goût : carton sucré.", price: 30, use: { heal: 25, stage: { stat: "atk", n: 1 } } },
  soupe: { id: "soupe", name: "Soupe du jour", desc: "Rend 60 PV. Le jour en question n'est pas précisé.", price: 35, use: { heal: 60 } },
};

export interface Equipment {
  id: string;
  name: string;
  slot: "arme" | "armure" | "accessoire";
  desc: string;
  price: number;
  bonus: Partial<Record<"hp" | "atk" | "def" | "spd", number>>;
}

export const EQUIPMENT: Record<string, Equipment> = {
  "manette-pro": { id: "manette-pro", name: "Manette pro", slot: "arme", desc: "Gâchettes sensibles. Attaque +3.", price: 90, bonus: { atk: 3 } },
  spatule: { id: "spatule", name: "Spatule de combat", slot: "arme", desc: "Retourne les crêpes et les situations. Attaque +5.", price: 160, bonus: { atk: 5 } },
  "fourchette-sacree": { id: "fourchette-sacree", name: "Fourchette sacrée", slot: "arme", desc: "Arme du dernier friturier royal. Attaque +8, Vitesse +1.", price: 0, bonus: { atk: 8, spd: 1 } },
  "sweat-epais": { id: "sweat-epais", name: "Sweat épais", slot: "armure", desc: "Molletonné. Défense +2, PV +8.", price: 80, bonus: { def: 2, hp: 8 } },
  tablier: { id: "tablier", name: "Tablier blindé", slot: "armure", desc: "Résiste aux éclaboussures et aux coups. Défense +4, PV +14.", price: 150, bonus: { def: 4, hp: 14 } },
  "bracelet-sel": { id: "bracelet-sel", name: "Bracelet de sel", slot: "accessoire", desc: "Porte-bonheur salé. Vitesse +3.", price: 100, bonus: { spd: 3 } },
  "gants-fonte": { id: "gants-fonte", name: "Gants de fonte", slot: "arme", desc: "Lourds, mais efficaces. Attaque +8.", price: 240, bonus: { atk: 8 } },
  "survet-pro": { id: "survet-pro", name: "Survêt' pro", slot: "armure", desc: "Le survêtement des champions. Défense +6, PV +20.", price: 260, bonus: { def: 6, hp: 20 } },
  "ceinture-titan": { id: "ceinture-titan", name: "Ceinture du Titan", slot: "accessoire", desc: "La ceinture du Premier Titan. Attaque +4, Défense +4.", price: 0, bonus: { atk: 4, def: 4 } },
  "masque-nuit": { id: "masque-nuit", name: "Masque de nuit", slot: "accessoire", desc: "Offert par Frère Flemme. PV +25, Vitesse +1.", price: 0, bonus: { hp: 25, spd: 1 } },
  "pin-patate": { id: "pin-patate", name: "Pin's patate", slot: "accessoire", desc: "Offert par une patate repentie. PV +12.", price: 0, bonus: { hp: 12 } },
};

/** Boutiques : ce qu'elles vendent (consommables puis équipements). */
export const SHOPS: Record<string, { name: string; keeper: string; items: string[]; hello: string; bye: string }> = {
  herboristerie: {
    name: "Herboristerie Persil",
    keeper: "Madame Persil",
    items: ["tisane", "soupe", "sauce-piquante", "ketchup", "bracelet-sel"],
    hello: "Bienvenue ! Tout est vert, bio et légal. Surtout légal.",
    bye: "Revenez quand vous voulez. Et mangez vos légumes. On ne sait jamais qui écoute.",
  },
  armurerie: {
    name: "Armurerie du Navet",
    keeper: "Maître Navet",
    items: ["manette-pro", "sweat-epais", "spatule", "tablier"],
    hello: "Des armes ? Des armures ? Tout est garanti sans friture.",
    bye: "Bonne chance. Évite de te battre contre le Roi. Ou alors gagne.",
  },
  refuge: {
    name: "Refuge du Mont Biscotto",
    keeper: "Brenda",
    items: ["soupe", "mega-cornet", "barre-proteinee", "ketchup", "gants-fonte", "survet-pro"],
    hello: "Bienvenue au refuge ! Soupe chaude, matériel solide, et zéro pompe obligatoire.",
    bye: "Couvre-toi, ça souffle là-haut. Et méfie-toi de ceux qui ne dorment jamais.",
  },
  "marche-cache": {
    name: "Marché caché",
    keeper: "Frida la Friteuse",
    items: ["frites", "mega-cornet", "part-pizza", "ketchup"],
    hello: "Chut… Ici on vend ce qui croustille. Paiement en FP, discrétion comprise.",
    bye: "Tu ne m'as jamais vue. Moi non plus.",
  },
};

export const isEquipment = (id: string) => id in EQUIPMENT;
export const priceOf = (id: string) => CONSUMABLES[id]?.price ?? EQUIPMENT[id]?.price ?? 0;
export const nameOf = (id: string) => CONSUMABLES[id]?.name ?? EQUIPMENT[id]?.name ?? MEMBERS[id]?.name ?? id;
