/**
 * SPARROWGOTCHI — catalogue des objets (tout se gagne en jouant, aucun achat réel).
 * Monnaie : les « Frit'pièces » (FP), gagnées en jouant, en missions et en montant de niveau.
 * `rare: true` = introuvable en boutique, uniquement en drop (mini-jeu, événements).
 */

export type Slot = "lunettes" | "tenue" | "tete" | "deco" | "meuble";
/** Meubles améliorables : posséder un niveau supérieur l'installe dans l'appartement. */
export type Group = "pc" | "lit" | "sport" | "canape";

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  desc: string;
  price: number;
  level: number;
  rare?: boolean;
  group?: Group;
  tier?: number;
}

export const ITEMS: Item[] = [
  // Lunettes
  { id: "lun-classiques", slot: "lunettes", name: "Les ovales", desc: "Les lunettes d'origine. Iconiques. Rayées.", price: 0, level: 1 },
  { id: "lun-aviateur", slot: "lunettes", name: "Aviateur doré", desc: "Pour regarder le calendrier de haut.", price: 60, level: 2 },
  { id: "lun-3d", slot: "lunettes", name: "Lunettes 3D", desc: "La vie en relief. Surtout les frites.", price: 90, level: 3 },
  { id: "lun-rondes", slot: "lunettes", name: "Rondes de sorcier", desc: "+10 en sagesse. Effet non garanti.", price: 120, level: 4 },
  { id: "lun-ski", slot: "lunettes", name: "Masque de ski", desc: "Pour les descentes de frites.", price: 160, level: 6 },
  { id: "lun-laser", slot: "lunettes", name: "Visière laser", desc: "Trouvée en farmant. Voit à travers les salades.", price: 0, level: 1, rare: true },

  // Tenues
  { id: "ten-tshirt", slot: "tenue", name: "T-shirt noir", desc: "Le classique. Il a vécu des choses.", price: 0, level: 1 },
  { id: "ten-survet", slot: "tenue", name: "Survêt rouge", desc: "Tenue de sport, portée exclusivement assis.", price: 70, level: 2 },
  { id: "ten-peignoir", slot: "tenue", name: "Peignoir", desc: "Le dress code du télétravail.", price: 80, level: 3 },
  { id: "ten-cape", slot: "tenue", name: "Cape du Chevalier Noir", desc: "Gotham n'a rien demandé.", price: 170, level: 5 },
  { id: "ten-frite", slot: "tenue", name: "Maillot Frite d'Or", desc: "Sponsor officiel : l'huile de tournesol.", price: 220, level: 7 },
  { id: "ten-armure", slot: "tenue", name: "Armure du Farmeur", desc: "Drop légendaire. Ne protège de rien, mais brille.", price: 0, level: 1, rare: true },

  // Tête
  { id: "tet-rien", slot: "tete", name: "Rien", desc: "La coiffure naturelle. Ébouriffée par la vie.", price: 0, level: 1 },
  { id: "tet-casquette", slot: "tete", name: "Casquette", desc: "Visière vers l'arrière, comme sa motivation.", price: 40, level: 1 },
  { id: "tet-bob", slot: "tete", name: "Bob de plage", desc: "Pour une plage qu'il ne verra jamais.", price: 60, level: 2 },
  { id: "tet-casque", slot: "tete", name: "Casque gamer", desc: "Bloque 98 % des « viens manger ».", price: 100, level: 3 },
  { id: "tet-masque", slot: "tete", name: "Masque de chauve-souris", desc: "Le vrai. Enfin, presque.", price: 150, level: 4 },
  { id: "tet-couronne", slot: "tete", name: "Couronne de frites", desc: "Objet rare. Sent bon. Attire les pigeons.", price: 0, level: 1, rare: true },

  // Déco (plusieurs à la fois)
  { id: "dec-poster", slot: "deco", name: "Poster de héros", desc: "Un héros masqué. Aucun lien. Aucun.", price: 50, level: 1 },
  { id: "dec-plante", slot: "deco", name: "Plante en plastique", desc: "La seule plante qu'il ne peut pas tuer.", price: 40, level: 2 },
  { id: "dec-tapis", slot: "deco", name: "Tapis rouge", desc: "Pour marcher jusqu'au frigo comme une star.", price: 60, level: 2 },
  { id: "dec-neons", slot: "deco", name: "Néons gaming", desc: "+30 % de skill (scientifiquement faux).", price: 120, level: 3 },
  { id: "dec-friteuse", slot: "deco", name: "Friteuse en or", desc: "L'autel de la maison.", price: 260, level: 6 },
  { id: "dec-dofrite", slot: "deco", name: "Œuf Dofrite", desc: "Un œuf légendaire en frites. On ne sait pas ce qui va éclore.", price: 0, level: 1, rare: true },

  // Meubles (améliorations visibles, avec un petit bonus)
  { id: "pc-2", slot: "meuble", group: "pc", tier: 2, name: "PC Gamer", desc: "Deux écrans. +15 % de FP en farm.", price: 120, level: 2 },
  { id: "pc-3", slot: "meuble", group: "pc", tier: 3, name: "Station RGB", desc: "Ça clignote donc c'est rapide. +30 % de FP en farm.", price: 300, level: 6 },
  { id: "lit-2", slot: "meuble", group: "lit", tier: 2, name: "Matelas mémoire de frite", desc: "Micro-siestes plus efficaces.", price: 90, level: 2 },
  { id: "lit-3", slot: "meuble", group: "lit", tier: 3, name: "Lit king size", desc: "Il n'y dort toujours pas, mais en grand.", price: 250, level: 5 },
  { id: "canape-2", slot: "meuble", group: "canape", tier: 2, name: "Canapé d'angle", desc: "Plus de place pour s'affaler.", price: 140, level: 4 },
  { id: "sport-2", slot: "meuble", group: "sport", tier: 2, name: "Banc de muscu pro", desc: "+25 % de muscle par séance.", price: 150, level: 3 },
  { id: "sport-3", slot: "meuble", group: "sport", tier: 3, name: "Rack du Titan", desc: "+50 % de muscle par séance. Le sol tremble.", price: 300, level: 7 },
];

export const DEFAULT_EQUIP = { lunettes: "lun-classiques", tenue: "ten-tshirt", tete: "tet-rien" } as const;
export const DEFAULT_OWNED = ["lun-classiques", "ten-tshirt", "tet-rien"];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const RARES = ITEMS.filter((i) => i.rare).map((i) => i.id);

/** Expérience nécessaire pour passer du niveau `l` au suivant (progression douce). */
export const xpToNext = (l: number) => 40 + l * 30;

/** Récompense en Frit'pièces à chaque niveau atteint. */
export const levelReward = (l: number) => 20 + l * 10;

/** Rangs humoristiques (débloqués par niveau). */
export const TITLES: [number, string][] = [
  [1, "Stagiaire du canapé"],
  [3, "Rôdeur du salon"],
  [5, "Farmeur de Dofus"],
  [8, "Athlète du dimanche"],
  [12, "Prince de la frite"],
  [16, "Samouraï du sujet"],
  [20, "Sparrow Doré"],
];

/** Niveau installé d'un meuble (1 = d'origine). */
export const tierOf = (owned: string[], g: Group) =>
  ITEMS.filter((i) => i.group === g && owned.includes(i.id)).reduce((m, i) => Math.max(m, i.tier ?? 1), 1);

/** Évolution musculaire. */
export const MUSCLE_STAGES: [number, string][] = [
  [0, "Normal"],
  [30, "Sec"],
  [90, "Costaud"],
  [200, "Bodybuildé"],
  [400, "SPARROW TITAN"],
];
export const muscleStage = (m: number) => MUSCLE_STAGES.reduce((st, [min], i) => (m >= min ? i : st), 0);

export const titleFor = (l: number) => TITLES.reduce((t, [lv, name]) => (l >= lv ? name : t), TITLES[0][1]);
