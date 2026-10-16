/**
 * CITATION KAAMELOTT DU JOUR — une par jour (minuit, heure de Paris), puis la liste recommence.
 * Uniquement des répliques vérifiées sur des recueils de citations (Wikiquote, sites de fans).
 * Pour en ajouter : copier un bloc, en respectant le texte exact de la série.
 */
export interface KQuote {
  text: string;
  who: string;
  ref?: string;
  note: string;
}

export const KAAMELOTT: KQuote[] = [
  {
    text: "C'est pas faux.",
    who: "Perceval",
    note: "Réaction officielle du sujet à toute explication sur la durée du dossier.",
  },
  {
    text: "Le gras, c'est la vie.",
    who: "Karadoc",
    ref: "Livre II, « Corpore sano »",
    note: "Régime recommandé pour tenir jusqu'en 2031. Avis médical non sollicité.",
  },
  {
    text: "Faut arrêter ces conneries de nord et de sud ! Une fois pour toutes, le nord, suivant comment on est tourné, ça change tout !",
    who: "Perceval",
    ref: "Livre I, « Ambidextrie »",
    note: "La date cible, elle, ne change pas suivant comment on est tourné.",
  },
  {
    text: "Elle est où la poulette ?",
    who: "Kadoc",
    note: "Question transmise au service des objets trouvés. Toujours sans réponse.",
  },
  {
    text: "C'est pas moi qui explique mal, c'est les autres qui sont cons !",
    who: "Perceval",
    ref: "Livre IV",
    note: "Pour la dernière fois : le 12 octobre 2031. Pas avant.",
  },
  {
    text: "On en a gros !",
    who: "Perceval",
    note: "Le Ministère confirme : le sujet en a gros. Le compteur, lui, s'en fiche.",
  },
  {
    text: "Vous êtes marié, comme moi ; vous savez que la monstruosité peut prendre des formes très diverses.",
    who: "Léodagan",
    note: "Exemple de monstruosité : un compte à rebours de 1 826 jours.",
  },
  {
    text: "Qu'est-ce que c'est que ce style de bouffer des petits machins tout secs et trois gallons de flotte par jour ?",
    who: "Karadoc",
    ref: "Livre II, « Corpore sano »",
    note: "Le sujet est invité à ne pas suivre ce régime pendant la durée du dossier.",
  },
];
