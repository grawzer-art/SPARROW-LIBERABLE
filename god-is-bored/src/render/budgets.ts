/**
 * Budgets de rendu mesurables (cible : 30 FPS stables sur iPhone). Les tests et les scripts de démonstration les vérifient ;
 * ils servent aussi de garde-fou lorsqu'on ajoute des détails (aucun détail invisible).
 * Unités : sommets par modèle, appels de dessin et triangles par image, instances animées, casters d'ombre.
 */
export const BUDGETS = {
  /** géométrie d'un habitant de détail (LOD proche) : sommets */
  characterVertices: 1500,
  /** habitants en LOD lointain : silhouette sans animation */
  farCharacterVertices: 160,
  /** scène locale à l'écran (village rapproché) */
  localDrawCalls: 260,
  localTriangles: 420_000,
  /** habitants animés en même temps (au-delà : silhouettes fixes) ; distance de détail en cases */
  animatedCharacters: 600,
  detailDistance: 95,
  /** ombres : un seul soleil, carte 1024² sur mobile ; casters = arbres hauts + bâtiments */
  shadowMapMobile: 1024,
  /** particules d'ambiance, effets : un seul draw call chacun */
  ambientParticles: 140,
  fxParticles: 1400,
  /** coût de simulation par tick pour 600 habitants (ms, Node ; ×1 = 100 ms de budget) */
  simMsPerTick600: 8,
} as const;
