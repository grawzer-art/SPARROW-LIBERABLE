/**
 * SPARROWGOTCHI — catalogue des objets (tout se gagne en jouant, aucun achat réel).
 * Monnaie : les « Frit'pièces » (FP), gagnées en jouant, en missions et en montant de niveau.
 * `rare: true` = introuvable en boutique, uniquement en drop (mini-jeu, événements).
 */

export type Slot = "lunettes" | "tenue" | "tete" | "deco";

export interface Item {
  id: string;
  slot: Slot;
  name: string;
  desc: string;
  price: number;
  level: number;
  rare?: boolean;
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
];

export const DEFAULT_EQUIP = { lunettes: "lun-classiques", tenue: "ten-tshirt", tete: "tet-rien" } as const;
export const DEFAULT_OWNED = ["lun-classiques", "ten-tshirt", "tet-rien"];

export const itemById = (id: string) => ITEMS.find((i) => i.id === id);
export const RARES = ITEMS.filter((i) => i.rare).map((i) => i.id);

/** Expérience nécessaire pour passer du niveau `l` au suivant (progression douce). */
export const xpToNext = (l: number) => 40 + l * 30;

/** Récompense en Frit'pièces à chaque niveau atteint. */
export const levelReward = (l: number) => 20 + l * 10;

export const TITLES: [number, string][] = [
  [1, "Stagiaire du canapé"],
  [3, "Apprenti farmeur"],
  [5, "Chevalier de la friteuse"],
  [8, "Seigneur du donjon"],
  [12, "Légende de la guilde"],
  [16, "Empereur de la frite"],
  [20, "Sparrow Doré"],
];

export const titleFor = (l: number) => TITLES.reduce((t, [lv, name]) => (l >= lv ? name : t), TITLES[0][1]);
