/**
 * RPG — les six types officiels et leur matrice (faiblesses et résistances).
 *
 * Matrice équilibrée : chaque type est super efficace contre 2 types, peu efficace contre 2 types
 * (ceux qui le battent), et neutre contre lui-même et un dernier type. Personne ne domine.
 *
 *   Feu    > Nature, Tech     Nature > Force, Temps     Force > Tech, Ombre
 *   Tech   > Temps, Ombre     Ombre  > Feu, Nature      Temps > Feu, Force
 *   Neutres : Feu–Force, Nature–Tech, Ombre–Temps (et chaque type contre lui-même).
 */

export type ElemType = "tech" | "ombre" | "nature" | "feu" | "force" | "temps";
export const ELEM_TYPES: ElemType[] = ["tech", "ombre", "nature", "feu", "force", "temps"];
export const TYPE_LABEL: Record<ElemType, string> = { tech: "Tech", ombre: "Ombre", nature: "Nature", feu: "Feu", force: "Force", temps: "Temps" };

export const STRONG: Record<ElemType, ElemType[]> = {
  feu: ["nature", "tech"],
  nature: ["force", "temps"],
  force: ["tech", "ombre"],
  tech: ["temps", "ombre"],
  ombre: ["feu", "nature"],
  temps: ["feu", "force"],
};

export const SUPER = 1.3;
export const WEAK = 0.77;
/** Bonus quand l'attaquant utilise une technique de son propre type. */
export const SAME = 1.1;

/** Multiplicateur d'une technique de type `att` sur une cible de type `def`. */
export function typeMult(att: ElemType | undefined, def: ElemType | undefined): number {
  if (!att || !def) return 1;
  if (STRONG[att].includes(def)) return SUPER;
  if (STRONG[def].includes(att)) return WEAK;
  return 1;
}

/** Type de chaque technique offensive (absent = neutre : coups sans élément). */
export const MOVE_TYPE: Record<string, ElemType> = {
  // Tech
  "coup-manette": "tech", "rage-lag": "tech", "rage-ultime": "tech", "drop-basse": "tech", scratch: "tech", "drop-sismique": "tech", "scratch-supreme": "tech", "boucle-volee": "tech", "drop-fatal": "tech", "bec-ressort": "tech",
  // Feu
  "frite-enflammee": "feu", "pluie-frites": "feu", "huile-bouillante": "feu", "frite-geante": "feu", "flamme-papier": "feu", "frite-volcan": "feu", "frite-colossale": "feu", "heure-pile": "feu", "jet-vapeur": "feu",
  // Ombre
  "lame-ombre": "ombre", eclipse: "ombre", "lame-nuit": "ombre", "eclipse-totale": "ombre", "dague-eclair": "ombre", "vol-tire": "ombre", "coup-grace": "ombre", "dague-fantome": "ombre", "coup-maitre": "ombre", "shuriken-noire": "ombre", "canne-onyx": "ombre", eternite: "ombre",
  // Nature
  "fouet-tige": "nature", "pluie-florets": "nature", "fouet-epineux": "nature", "tempete-florets": "nature", "graine-surprise": "nature", "coup-feuille": "nature", "gifle-croquante": "nature", "salve-pepins": "nature", "sceptre-celeri": "nature", "fouet-poireau": "nature", "roulade-terreuse": "nature", "tornade-croutons": "nature", "pluie-vinaigrette": "nature", "sel-mer": "nature", "sel-guerande": "nature",
  // Force
  "developpe-cosmique": "force", "biceps-sismique": "force", "roule-boule": "force", "chute-libre": "force", "shake-explosif": "force", "coup-serviette": "force", "squat-sismique": "force", "pas-cadence": "force", "coup-baguette": "force", "mousse-aveuglante": "force", "kata-vent": "force",
  // Temps
  "iai-eclair": "temps", "lame-temps": "temps", "tic-tac": "temps", "coupe-seconde": "temps", "minute-ultime": "temps", "pique-aiguille": "temps", "tic-rapide": "temps", "sable-temps": "temps", "tempete-sable": "temps", "minute-volee": "temps", "aiguilles-jumelles": "temps", "protocole-minuit": "temps",
  // AFTER DARK
  "gnole-enflammee": "feu", "clope-oeil": "feu",
};

/** Type des membres de l'équipe et des ennemis (les formes de Sparrow changent son type). */
export const FIGHTER_TYPE: Record<string, ElemType> = {
  sparrow: "tech", chevalier: "ombre", gerard: "feu", lili: "ombre", pokeyz: "tech", brokito: "nature",
  titan: "force", samourai: "temps",
  "soldat-brocoli": "nature", "patate-renegate": "nature", "garde-laitue": "nature", "roi-salade": "nature",
  "haltere-sauvage": "force", proteinator: "force", "moine-gain": "force", gonflax: "force",
  "sbire-metronome": "temps", tambour: "force", "lanterne-folle": "feu", metronome: "temps", katsu: "force",
  trotteuse: "temps", coucou: "tech", "grand-sablier": "temps", minuit: "temps",
  kevin: "force", bertrand: "force", ginette: "ombre", bulldozer: "force", kiki: "feu",
};

/** Texte affiché après un coup (null = neutre). */
export const effLine = (mult: number) => (mult > 1.01 ? "C'est super efficace !" : mult < 0.99 ? "Ce n'est pas très efficace…" : null);
