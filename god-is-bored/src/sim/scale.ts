/** Échelles de la géographie (rayon de la planète = 1). Voir Geo.ts. */
export const LOCAL_SPAN_DEG = 1.7;
export const LOCAL_SPAN_RAD = (LOCAL_SPAN_DEG * Math.PI) / 180;
export const TILE_RAD = LOCAL_SPAN_RAD / 64; // une case de la carte locale, en radians d'arc
export const REGION_CELLS = 8; // une région = 8 × 8 cartes locales
