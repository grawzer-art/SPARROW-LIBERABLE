import type { BuildingType, Civ } from "./types";

export interface TechDef {
  id: string; name: string; era: number; effect: string; unlocks: BuildingType[];
}

/** Arbre technologique linéaire : le niveau `civ.tech` = index de la dernière technologie découverte. */
export const TECHS: TechDef[] = [
  { id: "stone", name: "Âge du caillou", era: 0, effect: "Aucun avantage notable.", unlocks: ["hall", "house", "farm", "lumber", "quarry"] },
  { id: "agriculture", name: "Agriculture", era: 0, effect: "Rendement agricole +20 %. Temples débloqués.", unlocks: ["temple"] },
  { id: "masonry", name: "La Roue & Maçonnerie", era: 1, effect: "Constructions en pierre, marchés et remparts. Bois +20 %.", unlocks: ["market", "walls"] },
  { id: "bronze", name: "Métallurgie", era: 1, effect: "Soldats +25 %. Casernes débloquées.", unlocks: ["barracks"] },
  { id: "writing", name: "Écriture & Paperasse", era: 1, effect: "Or et stabilité en hausse. Les rancunes sont désormais archivées.", unlocks: [] },
  { id: "iron", name: "Fer & Chevalerie", era: 2, effect: "Soldats +25 %. Châteaux et forges débloqués.", unlocks: ["castle", "forge"] },
  { id: "medicine", name: "Médecine douteuse", era: 2, effect: "Peste moins meurtrière. Moulins débloqués.", unlocks: ["mill"] },
  { id: "gunpowder", name: "Poudre noire", era: 2, effect: "Soldats +40 %. Canons à l'horizon.", unlocks: [] },
  { id: "steam", name: "Vapeur & Charbon", era: 3, effect: "Usines et gares débloquées : le ciel se couvre.", unlocks: ["factory", "station"] },
  { id: "electricity", name: "Électricité", era: 3, effect: "Éclairage public, nuits moins honnêtes.", unlocks: [] },
  { id: "engine", name: "Moteur & Béton", era: 4, effect: "Immeubles, véhicules, centrales et réseau électrique.", unlocks: ["power"] },
  { id: "ai", name: "Intelligence artificielle", era: 5, effect: "Laboratoires, drones et robots. Les humains deviennent optionnels.", unlocks: ["lab"] },
];
export const MAX_TECH_LEVEL = TECHS.length - 1;

export const ERA_NAMES = ["Préhistoire", "Antiquité", "Moyen Âge", "Ère industrielle", "Ère moderne", "Ère futuriste"];
export const ERA_MIN_TECH = [0, 2, 5, 8, 10, 11];
/** Conditions (en plus de la technologie) pour entrer dans chaque époque. */
export const ERA_POP = [0, 22, 45, 90, 150, 220];
export const ERA_STAB = [0, 25, 30, 35, 35, 40];
export const ERA_GOLD = [0, 15, 50, 140, 300, 600];

export function techAt(level: number): TechDef {
  return TECHS[Math.max(0, Math.min(MAX_TECH_LEVEL, level))];
}
export function eraOfTech(level: number): number {
  return techAt(level).era;
}
export function techIds(level: number): string[] {
  return TECHS.slice(0, Math.max(0, Math.min(MAX_TECH_LEVEL, level)) + 1).map((t) => t.id);
}
export function techThreshold(level: number): number {
  return 18 * Math.pow(level + 1, 1.5);
}
export function techGold(level: number): number {
  return 3 * (level + 1) * (level + 1);
}
export function techPop(level: number): number {
  return 6 * (level + 1);
}

/** Bâtiments disponibles = ceux débloqués par les technologies réellement découvertes. */
export function isUnlocked(civ: Pick<Civ, "techs">, type: BuildingType): boolean {
  for (const id of civ.techs) {
    const def = TECHS.find((t) => t.id === id);
    if (def && def.unlocks.includes(type)) return true;
  }
  return false;
}
export function unlockedTypes(civ: Pick<Civ, "techs">): BuildingType[] {
  const out = new Set<BuildingType>();
  for (const id of civ.techs) TECHS.find((t) => t.id === id)?.unlocks.forEach((u) => out.add(u));
  return [...out];
}
/** Fixe le niveau technologique et la liste des technologies connue de façon cohérente. */
export function setTech(civ: Civ, level: number): void {
  civ.tech = Math.max(0, Math.min(MAX_TECH_LEVEL, level));
  civ.techs = techIds(civ.tech);
}
