/**
 * RPG — données de combat : techniques, membres de l'équipe, ennemis, combats, objets et équipements.
 * Pur et sans dépendance : utilisé par le moteur (combat.ts), l'interface et les tests d'équilibrage.
 */

export type Stat = "atk" | "def" | "spd" | "acc";
export type StatusId = "etourdi" | "brule" | "endormi";
/** Effet visuel joué par l'écran de combat. */
export type Fx = "capsule" | "temps" | "sabre" | "son" | "titan" | "dague" | "coup" | "feu" | "soin" | "bonus" | "malus" | "ombre" | "lame" | "sel" | "huile" | "frites" | "feuille" | "sieste" | "charge" | "vinaigre" | "bouclier" | "terre";

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
  // ─── AFTER DARK : tournoi clandestin du Dernier Verre ───
  "gifles-tornade": { id: "gifles-tornade", name: "Gifles tornade", desc: "", power: 14, acc: 95, target: "foe", hits: [2, 4], fx: "coup" },
  "danse-keke": { id: "danse-keke", name: "Danse du kéké", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "spd", n: 1, who: "self" }], fx: "bonus" },
  "pas-chasse": { id: "pas-chasse", name: "Pas chassé", desc: "", power: 0, acc: 100, target: "self", priority: 2, effects: [{ kind: "guard" }], fx: "bouclier" },
  "ventre-bouclier": { id: "ventre-bouclier", name: "Ventre-bouclier", desc: "", power: 0, acc: 100, target: "self", priority: 2, effects: [{ kind: "guard" }, { kind: "stage", stat: "def", n: 1, who: "self" }], fx: "bouclier" },
  ecrasement: { id: "ecrasement", name: "Écrasement de 140 kg", desc: "", power: 95, acc: 90, target: "foe", charge: 1, effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "terre" },
  "rot-sonique": { id: "rot-sonique", name: "Rot sonique", desc: "", power: 0, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }, { kind: "stage", stat: "def", n: -1, who: "target", chance: 40 }], fx: "malus" },
  "claque-grasse": { id: "claque-grasse", name: "Claque grasse", desc: "", power: 45, acc: 95, target: "foe", fx: "coup" },
  "coup-chapelet": { id: "coup-chapelet", name: "Coup de chapelet", desc: "", power: 40, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "coup" },
  "gnole-enflammee": { id: "gnole-enflammee", name: "Gnôle enflammée", desc: "", power: 35, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 50 }], fx: "feu" },
  "priere-louche": { id: "priere-louche", name: "Prière louche", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 30 }], fx: "soin" },
  tesson: { id: "tesson", name: "Tesson de bouteille", desc: "", power: 58, acc: 85, target: "foe", fx: "lame" },
  plaquage: { id: "plaquage", name: "Plaquage de videur", desc: "", power: 50, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 20 }], fx: "terre" },
  "cou-taureau": { id: "cou-taureau", name: "Cou de taureau", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 2, who: "self" }], fx: "bonus" },
  "cle-bras": { id: "cle-bras", name: "Clé de bras", desc: "", power: 40, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "atk", n: -1, who: "target" }], fx: "coup" },
  "prise-matelas": { id: "prise-matelas", name: "Prise du matelas", desc: "", power: 55, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 25 }], fx: "terre" },
  "clope-oeil": { id: "clope-oeil", name: "Clope dans l'œil", desc: "", power: 30, acc: 95, target: "foe", effects: [{ kind: "status", status: "brule", chance: 40 }, { kind: "stage", stat: "acc", n: -1, who: "target", chance: 50 }], fx: "feu" },
  "big-splash": { id: "big-splash", name: "BIG SPLASH", desc: "", power: 120, acc: 90, target: "foe", charge: 1, fx: "terre" },
  "regard-daronne": { id: "regard-daronne", name: "Regard de daronne", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "def", n: -2, who: "target" }], fx: "malus" },
  "coup-boule": { id: "coup-boule", name: "Coup de boule maternel", desc: "", power: 72, acc: 90, target: "foe", effects: [{ kind: "recoil", pct: 12 }], fx: "coup" },
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
  // SPARROW SAMOURAÏ (transformation)
  "iai-eclair": { id: "iai-eclair", name: "Iaï éclair", desc: "Un seul geste, plus rapide que la minute. Frappe en premier.", power: 70, acc: 100, target: "foe", priority: 2, fx: "sabre" },
  "lame-temps": { id: "lame-temps", name: "Lame du temps", desc: "Sparrow tranche une seconde en deux. Se prépare un tour, frappe très fort.", power: 125, acc: 95, target: "foe", charge: 1, fx: "sabre" },
  "garde-sabre": { id: "garde-sabre", name: "Garde du sabre", desc: "Se met en garde, lame levée : le prochain coup est divisé par deux. Attaque +1.", power: 0, acc: 100, target: "self", priority: 2, effects: [{ kind: "guard" }, { kind: "stage", stat: "atk", n: 1, who: "self" }], fx: "bouclier" },
  meditation: { id: "meditation", name: "Méditation", desc: "Un instant de calme : rend 35 % des PV, soigne les états, Précision +1.", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 35 }, { kind: "cleanse" }, { kind: "stage", stat: "acc", n: 1, who: "self" }], fx: "sieste" },
  // Pokeyz
  "drop-basse": { id: "drop-basse", name: "Drop de basse", desc: "Les basses tombent : 2 à 3 coups qui font vibrer les côtes.", power: 24, acc: 95, target: "foe", hits: [2, 3], fx: "son" },
  scratch: { id: "scratch", name: "Scratch", desc: "Wikka-wikka ! Un scratch qui fait perdre le fil. Peut étourdir.", power: 40, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "son" },
  "boucle-infinie": { id: "boucle-infinie", name: "Boucle infinie", desc: "Pokeyz lance une boucle hypnotique : vitesse et précision de l'ennemi baissent.", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "spd", n: -1, who: "target" }, { kind: "stage", stat: "acc", n: -1, who: "target" }], fx: "son" },
  remix: { id: "remix", name: "Remix", desc: "Un remix qui remet d'aplomb : Pokeyz récupère 35 % de ses PV, l'équipe en réserve 20 %.", power: 0, acc: 100, target: "ally", effects: [{ kind: "heal", pct: 35 }, { kind: "cleanse" }], fx: "soin" },
  // Ennemis du chapitre 4
  "pas-cadence": { id: "pas-cadence", name: "Pas cadencé", desc: "", power: 50, acc: 95, target: "foe", fx: "coup" },
  "tempo-force": { id: "tempo-force", name: "Tempo forcé", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "spd", n: 2, who: "self" }], fx: "bonus" },
  "shuriken-noire": { id: "shuriken-noire", name: "Croche-shuriken", desc: "", power: 18, acc: 95, target: "foe", hits: [2, 3], fx: "dague" },
  "roulement": { id: "roulement", name: "Roulement de tambour", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "def", n: 1, who: "self" }], fx: "son" },
  "coup-baguette": { id: "coup-baguette", name: "Coup de baguette", desc: "", power: 55, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 15 }], fx: "coup" },
  "flamme-papier": { id: "flamme-papier", name: "Flamme de papier", desc: "", power: 50, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 40 }], fx: "feu" },
  "lueur-folle": { id: "lueur-folle", name: "Lueur folle", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }], fx: "malus" },
  "tic-tac": { id: "tic-tac", name: "Tic-tac", desc: "", power: 55, acc: 100, target: "foe", fx: "coup" },
  "mesure-136": { id: "mesure-136", name: "Mesure à 136 BPM", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "spd", n: 1, who: "self" }, { kind: "stage", stat: "atk", n: 1, who: "self" }], fx: "son" },
  "boucle-volee": { id: "boucle-volee", name: "Boucle volée", desc: "", power: 40, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "spd", n: -1, who: "target" }], fx: "son" },
  "drop-fatal": { id: "drop-fatal", name: "Drop fatal", desc: "", power: 120, acc: 90, target: "foe", charge: 1, fx: "son" },
  "kata-vent": { id: "kata-vent", name: "Kata du vent", desc: "", power: 60, acc: 100, target: "foe", priority: 1, fx: "sabre" },
  "posture-montagne": { id: "posture-montagne", name: "Posture de la montagne", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "guard" }, { kind: "stage", stat: "def", n: 2, who: "self" }], fx: "bouclier" },
  "the-ceremonie": { id: "the-ceremonie", name: "Thé de cérémonie", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 20 }, { kind: "cleanse" }], fx: "soin" },
  "coupe-seconde": { id: "coupe-seconde", name: "Coupe-seconde", desc: "", power: 130, acc: 90, target: "foe", charge: 1, effects: [{ kind: "status", status: "etourdi", chance: 25 }], fx: "sabre" },
  "minute-ultime": { id: "minute-ultime", name: "Minute ultime", desc: "", power: 75, acc: 95, target: "foe", priority: 1, fx: "sabre" },
  "regard-futur": { id: "regard-futur", name: "Regard du futur", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "def", n: -2, who: "target" }], fx: "malus" },
  // Techniques apprises en montant de niveau (elles remplacent une technique plus faible)
  "frite-volcan": { id: "frite-volcan", name: "Frite volcan", desc: "Une frite en fusion. Brûle souvent.", power: 70, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 40 }], fx: "feu" },
  "rage-ultime": { id: "rage-ultime", name: "Rage ultime", desc: "Toute la frustration d'une connexion qui lâche en finale. Se prépare un tour.", power: 145, acc: 90, target: "foe", charge: 1, fx: "charge" },
  "lame-nuit": { id: "lame-nuit", name: "Lame de minuit", desc: "Une entaille plus noire que la nuit. Frappe en premier.", power: 55, acc: 100, target: "foe", priority: 1, fx: "ombre" },
  "eclipse-totale": { id: "eclipse-totale", name: "Éclipse totale", desc: "La lumière disparaît, puis tout s'abat. Peut étourdir. Se prépare un tour.", power: 120, acc: 95, target: "foe", charge: 1, effects: [{ kind: "status", status: "etourdi", chance: 40 }], fx: "lame" },
  "sel-guerande": { id: "sel-guerande", name: "Fleur de sel", desc: "Le sel des grands jours. Baisse souvent la défense.", power: 45, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "def", n: -1, who: "target", chance: 60 }], fx: "sel" },
  "frite-colossale": { id: "frite-colossale", name: "Frite colossale", desc: "Une frite de cinq mètres. Personne ne sait d'où elle sort. Se prépare un tour.", power: 135, acc: 90, target: "foe", charge: 1, fx: "frites" },
  "dague-fantome": { id: "dague-fantome", name: "Dague fantôme", desc: "Lili frappe avant tout le monde, et on ne la voit même pas.", power: 52, acc: 100, target: "foe", priority: 1, fx: "dague" },
  "coup-maitre": { id: "coup-maitre", name: "Coup de maître", desc: "Correct d'habitude, terrible sur un ennemi affaibli (sous 45 % de PV).", power: 50, acc: 95, target: "foe", effects: [{ kind: "execute", below: 0.45, mult: 2.6 }], fx: "lame" },
  "drop-sismique": { id: "drop-sismique", name: "Drop sismique", desc: "Les basses fissurent le sol : 2 à 3 coups énormes.", power: 32, acc: 95, target: "foe", hits: [2, 3], fx: "son" },
  "scratch-supreme": { id: "scratch-supreme", name: "Scratch suprême", desc: "Le scratch des finales. Étourdit souvent.", power: 60, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 35 }], fx: "son" },
  "fouet-epineux": { id: "fouet-epineux", name: "Fouet épineux", desc: "Une tige couverte d'épines.", power: 60, acc: 100, target: "foe", fx: "feuille" },
  "tempete-florets": { id: "tempete-florets", name: "Tempête de florets", desc: "Une rafale de florets : 2 à 4 coups.", power: 26, acc: 95, target: "foe", hits: [2, 4], fx: "feuille" },
  // Brokito (créature sauvage, capturable)
  "fouet-tige": { id: "fouet-tige", name: "Fouet-tige", desc: "Un coup de tige souple et vif.", power: 45, acc: 100, target: "foe", fx: "feuille" },
  "pluie-florets": { id: "pluie-florets", name: "Pluie de florets", desc: "Brokito secoue sa tête : 2 à 3 florets bien durs.", power: 20, acc: 95, target: "foe", hits: [2, 3], fx: "feuille" },
  racines: { id: "racines", name: "Racines", desc: "Brokito plonge ses racines dans le sol : rend 20 % des PV.", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 20 }], fx: "soin" },
  "graine-surprise": { id: "graine-surprise", name: "Graine surprise", desc: "Une graine qui éclate au nez de l'ennemi. Peut étourdir.", power: 35, acc: 95, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "terre" },
  // Ennemis du chapitre 5
  "pique-aiguille": { id: "pique-aiguille", name: "Pique-aiguille", desc: "", power: 55, acc: 95, target: "foe", fx: "lame" },
  "tic-rapide": { id: "tic-rapide", name: "Tic rapide", desc: "", power: 22, acc: 95, target: "foe", hits: [2, 3], priority: 1, fx: "dague" },
  remontage: { id: "remontage", name: "Remontage", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "spd", n: 1, who: "self" }], fx: "bonus" },
  "bec-ressort": { id: "bec-ressort", name: "Bec à ressort", desc: "", power: 55, acc: 95, target: "foe", fx: "coup" },
  "coucou-strident": { id: "coucou-strident", name: "COUCOU !", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "atk", n: -1, who: "target" }, { kind: "stage", stat: "acc", n: -1, who: "target", chance: 50 }], fx: "malus" },
  "heure-pile": { id: "heure-pile", name: "Heure pile", desc: "", power: 50, acc: 90, target: "foe", effects: [{ kind: "status", status: "brule", chance: 30 }], fx: "feu" },
  "sable-temps": { id: "sable-temps", name: "Sable du temps", desc: "", power: 50, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target", chance: 50 }], fx: "terre" },
  ensablement: { id: "ensablement", name: "Ensablement", desc: "", power: 0, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "spd", n: -2, who: "target" }], fx: "malus" },
  retournement: { id: "retournement", name: "Retournement", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 22 }], fx: "soin" },
  "tempete-sable": { id: "tempete-sable", name: "Tempête de sable", desc: "", power: 115, acc: 90, target: "foe", charge: 1, fx: "terre" },
  "canne-onyx": { id: "canne-onyx", name: "Canne d'onyx", desc: "", power: 55, acc: 95, target: "foe", fx: "lame" },
  "minute-volee": { id: "minute-volee", name: "Minute volée", desc: "", power: 45, acc: 95, target: "foe", effects: [{ kind: "stage", stat: "spd", n: -1, who: "target" }], fx: "temps" },
  "costume-impeccable": { id: "costume-impeccable", name: "Costume impeccable", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 1, who: "self" }, { kind: "stage", stat: "atk", n: 1, who: "self" }], fx: "bouclier" },
  "seconde-figee": { id: "seconde-figee", name: "Seconde figée", desc: "", power: 0, acc: 85, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 30 }], fx: "temps" },
  "aiguilles-jumelles": { id: "aiguilles-jumelles", name: "Aiguilles jumelles", desc: "", power: 28, acc: 95, target: "foe", hits: [2, 3], fx: "lame" },
  "sablier-noir": { id: "sablier-noir", name: "Sablier noir", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 10 }], fx: "temps" },
  "protocole-minuit": { id: "protocole-minuit", name: "PROTOCOLE MINUIT", desc: "", power: 130, acc: 90, target: "foe", charge: 1, fx: "temps" },
  eternite: { id: "eternite", name: "Éternité", desc: "", power: 70, acc: 95, target: "foe", fx: "ombre" },
  // Ennemis du chapitre 3
  "roule-boule": { id: "roule-boule", name: "Roulé-boulé", desc: "", power: 45, acc: 95, target: "foe", fx: "terre" },
  "poids-mort": { id: "poids-mort", name: "Poids mort", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "def", n: 2, who: "self" }], fx: "bouclier" },
  "chute-libre": { id: "chute-libre", name: "Chute libre", desc: "", power: 105, acc: 90, target: "foe", charge: 1, fx: "terre" },
  "shake-explosif": { id: "shake-explosif", name: "Shake explosif", desc: "", power: 50, acc: 90, target: "foe", effects: [{ kind: "status", status: "etourdi", chance: 20 }], fx: "huile" },
  "gorgee-whey": { id: "gorgee-whey", name: "Gorgée de whey", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "heal", pct: 30 }], fx: "soin" },
  "mousse-aveuglante": { id: "mousse-aveuglante", name: "Mousse aveuglante", desc: "", power: 20, acc: 100, target: "foe", effects: [{ kind: "stage", stat: "acc", n: -1, who: "target" }], fx: "sel" },
  "pompes-infinies": { id: "pompes-infinies", name: "Pompes infinies", desc: "", power: 0, acc: 100, target: "self", effects: [{ kind: "stage", stat: "atk", n: 1, who: "self" }, { kind: "stage", stat: "spd", n: 1, who: "self" }], fx: "bonus" },
  "coup-serviette": { id: "coup-serviette", name: "Coup de serviette", desc: "", power: 45, acc: 100, target: "foe", fx: "coup" },
  "mantra-sommeil": { id: "mantra-sommeil", name: "Mantra du sommeil", desc: "Un « ommm » interminable. Peut endormir.", power: 0, acc: 85, target: "foe", effects: [{ kind: "status", status: "endormi", chance: 70 }], fx: "malus" },
  "lueur-hypnose": { id: "lueur-hypnose", name: "Lueur hypnotique", desc: "Une lumière qui tourne, qui tourne… Peut endormir.", power: 0, acc: 85, target: "foe", effects: [{ kind: "status", status: "endormi", chance: 65 }], fx: "malus" },
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
  /** Techniques apprises au fil des niveaux : au niveau `lv`, `move` remplace `replaces`. */
  learn?: { lv: number; replaces: string; move: string }[];
  /** Évolution : au niveau `lv`, nouveau nom, nouveaux sprites et statistiques +12 %. */
  evo?: { lv: number; name: string; sprite: string; front: string };
  /** Sprite de combat (components/rpg/battlers.ts). */
  sprite: string;
  /** Statistiques au niveau 1 et gain par niveau. */
  grow: Growth;
  moves: [string, string, string, string];
  desc: string;
}

export const MEMBERS: Record<string, Member> = {
  brokito: {
    id: "brokito",
    name: "Brokito",
    sprite: "brokito-dos",
    grow: { hp: [40, 5.4], atk: [11, 1.5], def: [11, 1.4], spd: [12, 1.5] },
    moves: ["fouet-tige", "pluie-florets", "racines", "graine-surprise"],
    learn: [
      { lv: 8, replaces: "fouet-tige", move: "fouet-epineux" },
      { lv: 14, replaces: "pluie-florets", move: "tempete-florets" },
    ],
    // Évolution officielle : niveau 16
    evo: { lv: 16, name: "Brokolosse", sprite: "brokolosse-dos", front: "brokolosse" },
    desc: "Créature végétale des potagers. Têtu, joueur, il pousse plus vite quand on le complimente.",
  },
  sparrow: {
    id: "sparrow",
    name: "Sparrow",
    sprite: "sparrow",
    grow: { hp: [46, 6], atk: [12, 1.6], def: [10, 1.3], spd: [11, 1.4] },
    moves: ["coup-manette", "frite-enflammee", "micro-sieste", "rage-lag"],
    learn: [
      { lv: 12, replaces: "frite-enflammee", move: "frite-volcan" },
      { lv: 20, replaces: "rage-lag", move: "rage-ultime" },
    ],
    desc: "Gamer de l'extrême, expert en sieste, Élu de la Minute malgré lui.",
  },
  chevalier: {
    id: "chevalier",
    name: "Chevalier Noir",
    sprite: "chevalier",
    grow: { hp: [50, 6], atk: [12, 1.5], def: [12, 1.6], spd: [9, 1.2] },
    moves: ["lame-ombre", "fumigene", "garde-silencieuse", "eclipse"],
    learn: [
      { lv: 10, replaces: "lame-ombre", move: "lame-nuit" },
      { lv: 18, replaces: "eclipse", move: "eclipse-totale" },
    ],
    desc: "Gardien de la route du Centre-ville. Solennel, dramatique, étonnamment gentil.",
  },
  pokeyz: {
    id: "pokeyz",
    name: "Pokeyz",
    sprite: "pokeyz",
    grow: { hp: [44, 5.5], atk: [12, 1.5], def: [10, 1.3], spd: [13, 1.6] },
    moves: ["drop-basse", "scratch", "boucle-infinie", "remix"],
    learn: [
      { lv: 18, replaces: "drop-basse", move: "drop-sismique" },
      { lv: 22, replaces: "scratch", move: "scratch-supreme" },
    ],
    desc: "DJ, pote de Sparrow depuis toujours. Il transforme n'importe quel silence en soirée.",
  },
  lili: {
    id: "lili",
    name: "Lili",
    sprite: "lili",
    grow: { hp: [40, 5], atk: [12, 1.6], def: [8, 1.1], spd: [14, 1.8] },
    moves: ["dague-eclair", "vol-tire", "poudre-violette", "coup-grace"],
    learn: [
      { lv: 12, replaces: "dague-eclair", move: "dague-fantome" },
      { lv: 18, replaces: "coup-grace", move: "coup-maitre" },
    ],
    desc: "Voleuse professionnelle, acrobate amateur. Elle a une dent contre le Cadran.",
  },
  gerard: {
    id: "gerard",
    name: "Gérard la Frite",
    sprite: "gerard",
    grow: { hp: [44, 5.5], atk: [11, 1.5], def: [9, 1.2], spd: [12, 1.5] },
    moves: ["sel-mer", "cornet-soin", "huile-bouillante", "frite-geante"],
    learn: [
      { lv: 10, replaces: "sel-mer", move: "sel-guerande" },
      { lv: 18, replaces: "frite-geante", move: "frite-colossale" },
    ],
    desc: "Dernier friturier libre de la Cité. Croustillant dehors, tendre dedans.",
  },
};

/** Techniques apprises qui remplacent une technique de base. */
export const SKILLS: Record<string, { member: string; replaces: string; move: string; name: string }> = {
  "pluie-frites": { member: "sparrow", replaces: "coup-manette", move: "pluie-frites", name: "Pluie de frites" },
  // Transformation (ne remplace aucune technique : elle ajoute « SPARROW TITAN » au menu des techniques)
  titan: { member: "sparrow", replaces: "", move: "", name: "SPARROW TITAN" },
  samourai: { member: "sparrow", replaces: "", move: "", name: "SPARROW SAMOURAÏ" },
};

/** Techniques de Sparrow sous sa forme de Titan. */
export const TITAN_MOVES = ["developpe-cosmique", "biceps-sismique", "cri-titan", "sieste-titan"];

export type FormId = "titan" | "samourai";

/** Transformations de Sparrow (une seule par combat). */
export const FORMS: Record<FormId, { name: string; sprite: string; atk: number; def: number; spd: number; hp: number; acc?: number; moves: string[]; intro: string; gain: string; desc: string }> = {
  titan: {
    name: "SPARROW TITAN",
    sprite: "sparrow-titan",
    atk: 1.5,
    def: 1.4,
    spd: 1.15,
    hp: 0.3,
    moves: TITAN_MOVES,
    intro: "Sparrow serre les poings… Ses muscles se souviennent de chaque répétition !",
    gain: "Attaque et défense en hausse",
    desc: "Attaque ×1,5, Défense ×1,4, PV +30 % et 4 techniques de Titan",
  },
  samourai: {
    name: "SPARROW SAMOURAÏ",
    sprite: "sparrow-samourai",
    atk: 1.3,
    def: 1.1,
    spd: 1.6,
    hp: 0.15,
    acc: 1,
    moves: ["iai-eclair", "lame-temps", "garde-sabre", "meditation"],
    intro: "Sparrow ferme les yeux. Le temps ralentit autour de lui… Il dégaine.",
    gain: "Vitesse et précision en hausse",
    desc: "Vitesse ×1,6, Attaque ×1,3, Précision +1, PV +15 % et 4 techniques de samouraï",
  },
};

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
  // ─── AFTER DARK : la cave du Dernier Verre ───
  kevin: { id: "kevin", name: "Kevin « La Tornade »", sprite: "kevin", lv: [7, 7], hp: 72, atk: 17, def: 11, spd: 21, moves: ["gifles-tornade", "danse-keke", "pas-chasse"] },
  bertrand: { id: "bertrand", name: "Le Gros Bertrand", sprite: "bertrand", lv: [8, 8], hp: 128, atk: 18, def: 22, spd: 6, moves: ["ventre-bouclier", "ecrasement", "rot-sonique", "claque-grasse"] },
  ginette: { id: "ginette", name: "Sœur Ginette", sprite: "ginette", lv: [9, 9], hp: 88, atk: 19, def: 15, spd: 15, moves: ["coup-chapelet", "gnole-enflammee", "priere-louche", "tesson"] },
  bulldozer: { id: "bulldozer", name: "Bulldozer, le videur", sprite: "bulldozer", lv: [9, 9], hp: 112, atk: 21, def: 18, spd: 9, moves: ["plaquage", "cou-taureau", "cle-bras"] },
  kiki: {
    id: "kiki",
    name: "BIG MAMA KIKI",
    sprite: "kiki",
    lv: [10, 10],
    hp: 168,
    atk: 21,
    def: 17,
    spd: 12,
    boss: true,
    moves: ["prise-matelas", "clope-oeil", "regard-daronne", "big-splash"],
    phases: [
      {
        below: 0.5,
        moves: ["coup-boule", "big-splash", "clope-oeil", "prise-matelas"],
        line: "BIG MAMA KIKI arrache sa perruque et la jette dans la foule. Dessous : un crâne tatoué « MAMAN » et une cicatrice qui a vu des choses. La cave hurle.",
        stages: { atk: 1 },
        sprite: "kiki-chauve",
      },
    ],
  },
  "sbire-metronome": { id: "sbire-metronome", name: "Sbire du Métronome", sprite: "sbire", lv: [9, 17], hp: 110, atk: 25, def: 19, spd: 19, moves: ["pas-cadence", "tempo-force", "shuriken-noire"] },
  tambour: { id: "tambour", name: "Tambour possédé", sprite: "tambour", lv: [9, 17], hp: 135, atk: 24, def: 24, spd: 11, moves: ["coup-baguette", "roulement", "pas-cadence"] },
  "lanterne-folle": { id: "lanterne-folle", name: "Lanterne Folle", sprite: "lanterne", lv: [9, 17], hp: 105, atk: 26, def: 18, spd: 17, moves: ["flamme-papier", "lueur-folle", "pas-cadence", "lueur-hypnose"] },
  metronome: {
    id: "metronome",
    name: "Le Métronome",
    sprite: "metronome",
    lv: [10, 18],
    hp: 290,
    atk: 26,
    def: 24,
    spd: 18,
    boss: true,
    moves: ["tic-tac", "mesure-136", "boucle-volee", "drop-fatal"],
  },
  katsu: {
    id: "katsu",
    name: "Maître Katsu",
    sprite: "katsu",
    lv: [11, 19],
    hp: 230,
    atk: 23,
    def: 21,
    spd: 20,
    boss: true,
    moves: ["kata-vent", "posture-montagne", "the-ceremonie", "coupe-seconde"],
    phases: [
      {
        below: 0.5,
        moves: ["minute-ultime", "coupe-seconde", "regard-futur", "the-ceremonie"],
        line: "Katsu retire son chapeau de paille. Sous la barbe grise… des lunettes. « Bien. Maintenant, je me bats pour de vrai. »",
        heal: 12,
        stages: { spd: 1, acc: 1 },
        sprite: "katsu-vrai",
      },
    ],
  },
  brokito: { id: "brokito", name: "Brokito sauvage", sprite: "brokito", lv: [4, 16], hp: 62, atk: 13, def: 12, spd: 13, moves: ["fouet-tige", "pluie-florets", "racines", "graine-surprise"] },
  trotteuse: { id: "trotteuse", name: "Trotteuse", sprite: "trotteuse", lv: [14, 22], hp: 125, atk: 28, def: 22, spd: 22, moves: ["pique-aiguille", "tic-rapide", "remontage"] },
  coucou: { id: "coucou", name: "Coucou mécanique", sprite: "coucou", lv: [14, 22], hp: 115, atk: 29, def: 20, spd: 18, moves: ["bec-ressort", "coucou-strident", "heure-pile"] },
  "grand-sablier": {
    id: "grand-sablier",
    name: "Le Grand Sablier",
    sprite: "sablier",
    lv: [15, 23],
    hp: 330,
    atk: 30,
    def: 26,
    spd: 14,
    boss: true,
    moves: ["sable-temps", "ensablement", "tempete-sable", "retournement"],
    phases: [
      {
        below: 0.4,
        moves: ["tempete-sable", "sable-temps", "ensablement", "sable-temps"],
        line: "Le Grand Sablier se retourne d'un coup ! Le sable remonte… et il repart pour un tour.",
        heal: 15,
        stages: { atk: 1 },
        sprite: "sablier-retourne",
      },
    ],
  },
  minuit: {
    id: "minuit",
    name: "Monsieur Minuit",
    sprite: "minuit",
    lv: [17, 25],
    hp: 470,
    atk: 32,
    def: 26,
    spd: 22,
    boss: true,
    moves: ["canne-onyx", "minute-volee", "costume-impeccable", "seconde-figee"],
    phases: [
      {
        below: 0.66,
        moves: ["aiguilles-jumelles", "minute-volee", "seconde-figee", "sablier-noir"],
        line: "Monsieur Minuit ouvre sa veste. À la place du cœur, un cadran géant tourne à l'envers. « Vous m'avez fait perdre une seconde. Je vais vous prendre toutes les vôtres. »",
        heal: 6,
        stages: { spd: 1 },
        sprite: "minuit-cadran",
      },
      {
        below: 0.33,
        moves: ["protocole-minuit", "eternite", "aiguilles-jumelles", "sablier-noir"],
        line: "« 23:59. POUR TOUJOURS. » Les murs de la Tour se fissurent. Monsieur Minuit grandit, fait de milliers d'aiguilles qui tournent dans tous les sens.",
        heal: 6,
        stages: { atk: 1 },
        sprite: "minuit-eternel",
      },
    ],
  },
  "haltere-sauvage": { id: "haltere-sauvage", name: "Haltère Sauvage", sprite: "haltere", lv: [6, 14], hp: 60, atk: 17, def: 18, spd: 8, moves: ["roule-boule", "poids-mort", "chute-libre"] },
  proteinator: { id: "proteinator", name: "Protéinator", sprite: "proteinator", lv: [6, 14], hp: 96, atk: 17, def: 15, spd: 12, boss: true, moves: ["shake-explosif", "gorgee-whey", "mousse-aveuglante"] },
  "moine-gain": { id: "moine-gain", name: "Moine du Gain", sprite: "moine", lv: [7, 15], hp: 80, atk: 19, def: 16, spd: 14, moves: ["coup-serviette", "pompes-infinies", "planche", "mantra-sommeil"] },
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
  bg: "rue" | "cite" | "egout" | "palais" | "trone" | "montagne" | "temple" | "sanctuaire" | "cerisiers" | "festival" | "dojo" | "tour" | "sommet" | "club";
  /** Conseils affichés au premier combat (tutoriel). */
  tutorial?: boolean;
  music?: "combat" | "boss";
  /** Rencontre sauvage : l'espèce peut être capturée avec une capsule. */
  wild?: string;
  /** Combat clandestin (AFTER DARK) : impacts plus violents, projections stylisées. */
  brutal?: boolean;
}

export const BATTLES: Record<string, BattleDef> = {
  // ─── AFTER DARK : « Dernier verre avant minuit » ───
  "ad-kevin": { id: "ad-kevin", foes: ["kevin"], intro: "Kevin « La Tornade » entre sur le ring en faisant des moulinets. Personne ne lui a demandé.", canFlee: true, xp: 90, fp: 40, drops: { "biere-tiede": 1 }, bg: "club", brutal: true },
  "ad-bertrand": { id: "ad-bertrand", foes: ["bertrand"], intro: "Le Gros Bertrand monte sur le ring. Le ring proteste.", canFlee: true, xp: 110, fp: 50, bg: "club", brutal: true },
  "ad-ginette": { id: "ad-ginette", foes: ["ginette"], intro: "Sœur Ginette fait un signe de croix, puis casse une bouteille sur le poteau. « Que Dieu te pardonne. Moi, non. »", canFlee: true, xp: 130, fp: 60, drops: { "gnole-maison": 1 }, bg: "club", brutal: true },
  "ad-bulldozer": { id: "ad-bulldozer", foes: ["bulldozer"], intro: "Bulldozer fait craquer sa nuque. Puis la tienne, mentalement.", canFlee: true, xp: 120, fp: 30, bg: "club", brutal: true },
  "ad-kiki": { id: "ad-kiki", foes: ["kiki"], intro: "Les néons s'éteignent. Un projecteur. BIG MAMA KIKI, 112 combats, 112 victoires, descend sur le ring en peignoir léopard.", canFlee: false, xp: 260, fp: 120, bg: "club", music: "boss", brutal: true },
  "sbire-1": { id: "sbire-1", foes: ["sbire-metronome"], intro: "Un Sbire du Métronome surgit en rythme !", canFlee: true, xp: 110, fp: 60, drops: { "the-vert": 1 }, bg: "cerisiers" },
  "sbires-2": { id: "sbires-2", foes: ["sbire-metronome", "sbire-metronome"], intro: "Deux Sbires dansent en parfaite synchronisation. C'est presque beau.", canFlee: true, xp: 170, fp: 90, drops: { onigiri: 1 }, bg: "festival" },
  "tambour-1": { id: "tambour-1", foes: ["tambour"], intro: "Un Tambour possédé roule vers vous : BOUM, BOUM, BOUM !", canFlee: true, xp: 130, fp: 70, drops: { "the-vert": 1 }, bg: "festival" },
  "lanterne-1": { id: "lanterne-1", foes: ["lanterne-folle"], intro: "Une Lanterne Folle s'enflamme de colère !", canFlee: true, xp: 120, fp: 65, drops: { onigiri: 1 }, bg: "cerisiers" },
  metronome: { id: "metronome", foes: ["metronome"], intro: "LE MÉTRONOME descend de la scène : « Tic. Tac. Vous êtes en retard d'un temps. »", canFlee: false, xp: 300, fp: 180, drops: { "mega-cornet": 2 }, bg: "festival", music: "boss" },
  katsu: { id: "katsu", foes: ["katsu"], intro: "Maître Katsu salue, puis pose la main sur son sabre de bois.", canFlee: false, xp: 520, fp: 320, bg: "dojo", music: "boss" },
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
  "brokito-sauvage": { id: "brokito-sauvage", foes: ["brokito"], intro: "Un Brokito sauvage jaillit du potager !", canFlee: true, xp: 45, fp: 15, bg: "cite", wild: "brokito" },
  trotteuse: { id: "trotteuse", foes: ["trotteuse"], intro: "Une Trotteuse fait le tour du cadran… et fonce sur toi !", canFlee: true, xp: 140, fp: 75, drops: { onigiri: 1 }, bg: "tour" },
  trotteuses: { id: "trotteuses", foes: ["trotteuse", "trotteuse"], intro: "Deux Trotteuses montent la garde. Elles tournent dans le même sens. Toujours.", canFlee: true, xp: 220, fp: 120, drops: { "mega-cornet": 1 }, bg: "tour" },
  coucou: { id: "coucou", foes: ["coucou"], intro: "COUCOU ! Un Coucou mécanique jaillit de sa petite maison !", canFlee: true, xp: 140, fp: 75, drops: { "the-vert": 1 }, bg: "tour" },
  "coucous": { id: "coucous", foes: ["coucou", "trotteuse"], intro: "Un Coucou et une Trotteuse gardent l'escalier. Il est l'heure. De se battre.", canFlee: true, xp: 230, fp: 125, drops: { "cafe-minuit": 1 }, bg: "tour" },
  sablier: { id: "sablier", foes: ["grand-sablier"], intro: "LE GRAND SABLIER se dresse. Chaque grain qui tombe est une seconde volée à quelqu'un.", canFlee: false, xp: 420, fp: 260, drops: { "cafe-minuit": 2 }, bg: "tour", music: "boss" },
  minuit: { id: "minuit", foes: ["minuit"], intro: "Monsieur Minuit ajuste son nœud papillon. « Vous êtes en retard, Sparrow. Comme toujours. »", canFlee: false, xp: 800, fp: 600, bg: "sommet", music: "boss" },
  "minuit-revanche": { id: "minuit-revanche", foes: ["minuit"], intro: "L'Écho de Monsieur Minuit ressurgit du cadran : « Une revanche ? J'ai tout le temps du monde. »", canFlee: true, xp: 300, fp: 250, drops: { "cafe-minuit": 1 }, bg: "sommet", music: "boss" },
  "roi-salade": { id: "roi-salade", foes: ["roi-salade"], intro: "Le Roi de la Salade se lève de son trône !", canFlee: false, xp: 220, fp: 150, bg: "trone", music: "boss" },
};

// ─── Objets ───

export interface Consumable {
  id: string;
  name: string;
  desc: string;
  price: number;
  use: { heal?: number; healPct?: number; cleanse?: boolean; stage?: { stat: Stat; n: number }; revive?: number };
  /** Capsule de capture : chance de base (créatures sauvages seulement). */
  capture?: number;
  /** Utilisable sur un équipier K.O. uniquement. */
  ko?: boolean;
}

export const CONSUMABLES: Record<string, Consumable> = {
  "biere-tiede": { id: "biere-tiede", name: "Bière tiède", desc: "Rend 30 PV. Plate, tiède, et pourtant ça remonte. Comme un ex.", price: 12, use: { heal: 30 } },
  "gnole-maison": { id: "gnole-maison", name: "Gnôle maison", desc: "Rend 70 PV. Arrache aussi un peu l'œsophage, mais c'est offert.", price: 40, use: { heal: 70 } },
  frites: { id: "frites", name: "Cornet de frites", desc: "Rend 35 PV. Le carburant officiel.", price: 20, use: { heal: 35 } },
  "mega-cornet": { id: "mega-cornet", name: "Méga-cornet", desc: "Rend 90 PV. Format familial.", price: 60, use: { heal: 90 } },
  "part-pizza": { id: "part-pizza", name: "Part de pizza", desc: "Rend 50 % des PV et soigne les états.", price: 45, use: { healPct: 50, cleanse: true } },
  "sauce-piquante": { id: "sauce-piquante", name: "Sauce piquante", desc: "Attaque +2 jusqu'à la fin du combat.", price: 40, use: { stage: { stat: "atk", n: 2 } } },
  ketchup: { id: "ketchup", name: "Ketchup de rappel", desc: "Relève un équipier K.O. avec 50 % de ses PV.", price: 80, use: { revive: 50 }, ko: true },
  tisane: { id: "tisane", name: "Tisane de persil", desc: "Rend 20 PV et soigne les états. Goût : jardin.", price: 15, use: { heal: 20, cleanse: true } },
  "the-vert": { id: "the-vert", name: "Thé vert", desc: "Rend 45 PV et soigne les états. Il fume encore.", price: 30, use: { heal: 45, cleanse: true } },
  onigiri: { id: "onigiri", name: "Boulette de riz", desc: "Rend 80 PV. Avec une frite cachée au milieu : la recette de Pokeyz.", price: 55, use: { heal: 80 } },
  "barre-proteinee": { id: "barre-proteinee", name: "Barre protéinée", desc: "Rend 25 PV et Attaque +1. Goût : carton sucré.", price: 30, use: { heal: 25, stage: { stat: "atk", n: 1 } } },
  "capsule-echo": { id: "capsule-echo", name: "Capsule d'Écho", desc: "Capture une créature sauvage affaiblie. Plus elle a peu de PV, plus ça marche.", price: 40, use: {}, capture: 0.5 },
  "cafe-minuit": { id: "cafe-minuit", name: "Café de minuit", desc: "Rend tous les PV et soigne les états. Serré. Très serré.", price: 120, use: { healPct: 100, cleanse: true } },
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
  "ceinture-ring": { id: "ceinture-ring", name: "Ceinture du Dernier Verre", slot: "armure", desc: "Ceinture de champion du tournoi clandestin. Défense +3, PV +12. Sent la bière.", price: 0, bonus: { def: 3, hp: 12 } },
  "montre-maudite": { id: "montre-maudite", name: "Montre sans aiguilles", slot: "accessoire", desc: "Artefact maudit. Elle chuchote « 23:60 ». Attaque +6, Vitesse +3, mais Défense −4 et PV −10.", price: 0, bonus: { atk: 6, spd: 3, def: -4, hp: -10 } },
  "poing-americain": { id: "poing-americain", name: "Poing américain en caoutchouc", slot: "arme", desc: "Marché noir. Rassurant, illégal, en caoutchouc. Attaque +6, Vitesse −1.", price: 260, bonus: { atk: 6, spd: -1 } },
  "manette-pro": { id: "manette-pro", name: "Manette pro", slot: "arme", desc: "Gâchettes sensibles. Attaque +3.", price: 90, bonus: { atk: 3 } },
  spatule: { id: "spatule", name: "Spatule de combat", slot: "arme", desc: "Retourne les crêpes et les situations. Attaque +5.", price: 160, bonus: { atk: 5 } },
  "fourchette-sacree": { id: "fourchette-sacree", name: "Fourchette sacrée", slot: "arme", desc: "Arme du dernier friturier royal. Attaque +8, Vitesse +1.", price: 0, bonus: { atk: 8, spd: 1 } },
  "sweat-epais": { id: "sweat-epais", name: "Sweat épais", slot: "armure", desc: "Molletonné. Défense +2, PV +8.", price: 80, bonus: { def: 2, hp: 8 } },
  tablier: { id: "tablier", name: "Tablier blindé", slot: "armure", desc: "Résiste aux éclaboussures et aux coups. Défense +4, PV +14.", price: 150, bonus: { def: 4, hp: 14 } },
  "bracelet-sel": { id: "bracelet-sel", name: "Bracelet de sel", slot: "accessoire", desc: "Porte-bonheur salé. Vitesse +3.", price: 100, bonus: { spd: 3 } },
  "katana-bois": { id: "katana-bois", name: "Sabre de bois", slot: "arme", desc: "Léger, équilibré, il siffle quand on le manie. Attaque +11.", price: 340, bonus: { atk: 11 } },
  hakama: { id: "hakama", name: "Hakama renforcé", slot: "armure", desc: "Ample et résistant. Défense +8, PV +26, Vitesse +1.", price: 360, bonus: { def: 8, hp: 26, spd: 1 } },
  "casque-audio": { id: "casque-audio", name: "Casque de Pokeyz", slot: "accessoire", desc: "Le casque de secours de Pokeyz. Vitesse +3, Attaque +3.", price: 0, bonus: { spd: 3, atk: 3 } },
  "ruban-katsu": { id: "ruban-katsu", name: "Ruban de Katsu", slot: "accessoire", desc: "Le ruban de l'ancien maître. Vitesse +5, Attaque +5, Défense +2.", price: 0, bonus: { spd: 5, atk: 5, def: 2 } },
  "aiguille-or": { id: "aiguille-or", name: "Aiguille d'or", slot: "arme", desc: "Une aiguille d'horloge affûtée. Attaque +14, Vitesse +1.", price: 560, bonus: { atk: 14, spd: 1 } },
  "armure-rouages": { id: "armure-rouages", name: "Armure de rouages", slot: "armure", desc: "Des engrenages qui tournent tout seuls. Défense +10, PV +32.", price: 540, bonus: { def: 10, hp: 32 } },
  "montre-seconde": { id: "montre-seconde", name: "Montre de Seconde", slot: "accessoire", desc: "La montre de l'apprenti horloger. Elle avance d'une minute, exprès. Vitesse +6, Attaque +4, PV +10.", price: 0, bonus: { spd: 6, atk: 4, hp: 10 } },
  "gants-fonte": { id: "gants-fonte", name: "Gants de fonte", slot: "arme", desc: "Lourds, mais efficaces. Attaque +8.", price: 240, bonus: { atk: 8 } },
  "survet-pro": { id: "survet-pro", name: "Survêt' pro", slot: "armure", desc: "Le survêtement des champions. Défense +6, PV +20.", price: 260, bonus: { def: 6, hp: 20 } },
  "ceinture-titan": { id: "ceinture-titan", name: "Ceinture du Titan", slot: "accessoire", desc: "La ceinture du Premier Titan. Attaque +4, Défense +4.", price: 0, bonus: { atk: 4, def: 4 } },
  "masque-nuit": { id: "masque-nuit", name: "Masque de nuit", slot: "accessoire", desc: "Offert par Frère Flemme. PV +25, Vitesse +1.", price: 0, bonus: { hp: 25, spd: 1 } },
  "pin-patate": { id: "pin-patate", name: "Pin's patate", slot: "accessoire", desc: "Offert par une patate repentie. PV +12.", price: 0, bonus: { hp: 12 } },
};

/** Boutiques : ce qu'elles vendent (consommables puis équipements). */
export const SHOPS: Record<string, { name: string; keeper: string; items: string[]; hello: string; bye: string }> = {
  bar: {
    name: "Le Dernier Verre",
    keeper: "Momo",
    items: ["biere-tiede", "gnole-maison", "ketchup"],
    hello: "On sert des verres, pas des miracles. Les miracles, c'est la maison d'à côté, et elle est fermée.",
    bye: "Si tu vomis, c'est dehors. Si tu meurs, c'est dehors aussi.",
  },
  "marche-noir": {
    name: "Le coin de La Fouine",
    keeper: "La Fouine",
    items: ["capsule-echo", "cafe-minuit", "sauce-piquante", "poing-americain"],
    hello: "Rien n'est volé. Tout a juste changé de propriétaire un peu vite.",
    bye: "On ne s'est jamais vus. Toi non plus, d'ailleurs.",
  },
  herboristerie: {
    name: "Herboristerie Persil",
    keeper: "Madame Persil",
    items: ["tisane", "soupe", "capsule-echo", "sauce-piquante", "ketchup", "bracelet-sel"],
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
  tour: {
    name: "Distributeur de la Tour",
    keeper: "Distributeur automatique",
    items: ["cafe-minuit", "onigiri", "mega-cornet", "ketchup", "the-vert", "aiguille-or", "armure-rouages"],
    hello: "BIP. BONSOIR. IL EST 23:59. IL EST TOUJOURS 23:59. QUE DÉSIREZ-VOUS ?",
    bye: "BIP. MERCI. BONNE FIN DE MINUTE.",
  },
  auberge: {
    name: "Auberge du Thé Tiède",
    keeper: "Madame Sencha",
    items: ["the-vert", "onigiri", "mega-cornet", "ketchup", "katana-bois", "hakama"],
    hello: "Bienvenue à l'auberge ! Ici, on prend le temps. Enfin, on essayait, avant la boucle.",
    bye: "Reposez-vous bien. C'est un ordre de la maison.",
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
