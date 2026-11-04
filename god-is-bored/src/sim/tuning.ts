/**
 * Réglages centraux de la simulation (démographie et vie intérieure). Modifiables à chaud : `applyTuning({ birthRate: 0.5 })`.
 * Ils agissent sur le NOMBRE de ticks simulés, jamais sur le temps réel : ×1, ×3 et ×10 donnent donc la même histoire (seulement plus vite).
 * Ils ne ralentissent ni déplacements, ni animations, ni délibération.
 */
export interface Tuning {
  /** multiplicateur de la probabilité de naissance (0,30 = −70 % par rapport à la V2) */
  birthRate: number;
  /** vitesse de croissance/maturation des enfants (0,30 = l'enfance dure 3,3 fois plus longtemps) */
  childGrowth: number;
  /** âge minimal des parents (ans) et âges maximaux */
  minParentAge: number; maxMotherAge: number; maxFatherAge: number;
  /** délai minimal entre deux naissances d'une même mère (ans) */
  birthIntervalYears: number;
  /** ressources exigées : nourriture de la civilisation par habitant, stabilité, santé de la mère */
  foodPerCapita: number; minStability: number; minHealth: number;
  /** exige un logement : population de la ville sous sa capacité ET un toit pour la mère ou le foyer */
  requireHousing: boolean;
  /** exige un couple établi (relation de partenaires) pour concevoir */
  requirePartner: boolean;
  /** le tirage de naissance a lieu à la conception (un échec ne bloque la mère qu'un an) ; V2 : tirage à la naissance */
  rollAtConception: boolean;
  /** régulation naturelle : la natalité remonte quand la civilisation est loin de la capacité de ses villages (0 = désactivé) */
  densityBoost: number;
  /** seuils de population (époques, technologies, bâtiments avancés, expansion) : une démographie plus lente n'enferme pas les civilisations à l'âge de pierre */
  popThresholdScale: number;
  /** plafond doux de population de la région */
  popSoftCap: number;
  /** vie intérieure : fréquence de délibération (ans entre deux révisions de projet) et activation du système */
  mind: boolean;
  deliberateYears: number;
}

export const DEFAULT_TUNING: Tuning = {
  birthRate: 0.30, childGrowth: 0.30,
  minParentAge: 17, maxMotherAge: 40, maxFatherAge: 60,
  birthIntervalYears: 2.5,
  foodPerCapita: 0.35, minStability: 30, minHealth: 60,
  requireHousing: true, requirePartner: true,
  rollAtConception: true, popThresholdScale: 0.5, densityBoost: 6,
  popSoftCap: 2500,
  mind: true, deliberateYears: 1,
};

/** Réglages de la V2 (avant le ralentissement) : sert aux mesures avant/après. */
export const LEGACY_TUNING: Tuning = {
  birthRate: 1, childGrowth: 1,
  minParentAge: 16, maxMotherAge: 42, maxFatherAge: 60,
  birthIntervalYears: 0,
  foodPerCapita: 0, minStability: 0, minHealth: 50,
  requireHousing: false, requirePartner: false,
  rollAtConception: false, popThresholdScale: 1, densityBoost: 0,
  popSoftCap: 2500,
  mind: false, deliberateYears: 1,
};

export const TUNING: Tuning = { ...DEFAULT_TUNING };
export function applyTuning(p: Partial<Tuning>): void { Object.assign(TUNING, p); }
export function resetTuning(): void { Object.assign(TUNING, DEFAULT_TUNING); }

/** Seuil de population ajusté au réglage central. */
export const popT = (n: number): number => n * TUNING.popThresholdScale;
