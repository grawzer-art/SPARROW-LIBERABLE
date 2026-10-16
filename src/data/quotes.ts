/**
 * CITATION DU JOUR — une par jour (minuit, heure de Paris), dans l'ordre ci-dessous,
 * puis la liste recommence. Traductions libres ; la réplique originale est affichée en petit.
 * Chaque citation est suivie d'une note du Ministère appliquée au cas Sparrow.
 */
export interface Quote {
  fr: string;
  en: string;
  who: string;
  source: string;
  note: string;
}

export const QUOTES: Quote[] = [
  {
    fr: "Pourquoi tombons-nous ? Pour apprendre à nous relever.",
    en: "Why do we fall? So we can learn to pick ourselves up.",
    who: "Alfred",
    source: "Batman Begins, 2005",
    note: "Le sujet est prié de se relever. Il reste du temps sur le compteur.",
  },
  {
    fr: "Je suis Batman.",
    en: "I'm Batman.",
    who: "Batman",
    source: "Batman, 1989",
    note: "Le Ministère prend acte. Cela ne change rien à la date cible.",
  },
  {
    fr: "Ce n'est pas ce que je suis au fond de moi, mais ce que je fais qui me définit.",
    en: "It's not who I am underneath, but what I do that defines me.",
    who: "Batman",
    source: "Batman Begins, 2005",
    note: "Aujourd'hui, le sujet attend. Cela le définit donc pleinement.",
  },
  {
    fr: "La nuit est toujours plus sombre juste avant l'aube.",
    en: "The night is darkest just before the dawn.",
    who: "Harvey Dent",
    source: "The Dark Knight, 2008",
    note: "Précision du Ministère : l'aube est prévue le 12 octobre 2031. Elle sera ponctuelle.",
  },
  {
    fr: "Pourquoi tant de sérieux ?",
    en: "Why so serious?",
    who: "Le Joker",
    source: "The Dark Knight, 2008",
    note: "Le dossier SP-2031 reste extrêmement sérieux. Le sujet, beaucoup moins.",
  },
  {
    fr: "Ou l'on meurt en héros, ou l'on vit assez longtemps pour devenir le méchant.",
    en: "You either die a hero, or you live long enough to see yourself become the villain.",
    who: "Harvey Dent",
    source: "The Dark Knight, 2008",
    note: "Le sujet a choisi une troisième option : attendre tranquillement.",
  },
  {
    fr: "Les chauves-souris me font peur. Il est temps que mes ennemis partagent ma terreur.",
    en: "Bats frighten me. It's time my enemies shared my dread.",
    who: "Bruce Wayne",
    source: "Batman Begins, 2005",
    note: "Ennemi n° 1 identifié : le calendrier. Il n'a pas peur.",
  },
  {
    fr: "Il existe en noir ?",
    en: "Does it come in black?",
    who: "Bruce Wayne",
    source: "Batman Begins, 2005",
    note: "Le compte à rebours existe en noir. Il ne va pas plus vite pour autant.",
  },
  {
    fr: "Certains hommes veulent juste voir le monde brûler.",
    en: "Some men just want to watch the world burn.",
    who: "Alfred",
    source: "The Dark Knight, 2008",
    note: "D'autres veulent juste voir le compteur arriver à zéro. Patience.",
  },
  {
    fr: "Endurez, Maître Wayne.",
    en: "Endure, Master Wayne.",
    who: "Alfred",
    source: "The Dark Knight, 2008",
    note: "Consigne officielle transmise au sujet. Valable jusqu'en 2031.",
  },
  {
    fr: "Ce n'est pas une question d'argent. C'est une question de message.",
    en: "It's not about money. It's about sending a message.",
    who: "Le Joker",
    source: "The Dark Knight, 2008",
    note: "Message reçu. Le compteur continue néanmoins.",
  },
  {
    fr: "L'entraînement n'est rien. La volonté est tout.",
    en: "The training is nothing! The will is everything!",
    who: "Henri Ducard",
    source: "Batman Begins, 2005",
    note: "La volonté du sujet est remarquable. Celle du calendrier aussi.",
  },
  {
    fr: "Parfois, la vérité ne suffit pas. Parfois, les gens méritent plus.",
    en: "Sometimes the truth isn't good enough. Sometimes people deserve more.",
    who: "Batman",
    source: "The Dark Knight, 2008",
    note: "Vérité du jour : ce n'est toujours pas le 12 octobre 2031.",
  },
  {
    fr: "Vous avez simplement adopté l'obscurité. Moi, j'y suis né.",
    en: "You merely adopted the dark. I was born in it.",
    who: "Bane",
    source: "The Dark Knight Rises, 2012",
    note: "Le sujet, lui, est né pour attendre. Visiblement.",
  },
  {
    fr: "Un héros peut être n'importe qui.",
    en: "A hero can be anyone.",
    who: "Batman",
    source: "The Dark Knight Rises, 2012",
    note: "Même quelqu'un qui consulte un compte à rebours sans broncher.",
  },
  {
    fr: "Je suis la vengeance.",
    en: "I'm vengeance.",
    who: "Batman",
    source: "The Batman, 2022",
    note: "Le Ministère suggère plutôt : « Je suis la patience ».",
  },
  {
    fr: "La peur est un outil.",
    en: "Fear is a tool.",
    who: "Batman",
    source: "The Batman, 2022",
    note: "Le calendrier, lui, n'est pas un outil. Il est inflexible.",
  },
  {
    fr: "La vengeance ne changera pas le passé.",
    en: "Vengeance won't change the past.",
    who: "Batman",
    source: "The Batman, 2022",
    note: "Le futur, en revanche, arrive. À la vitesse d'une seconde par seconde.",
  },
  {
    fr: "Les criminels sont une engeance superstitieuse et lâche.",
    en: "Criminals are a superstitious cowardly lot.",
    who: "Bruce Wayne",
    source: "Detective Comics #33, 1939",
    note: "Le sujet n'est ni superstitieux ni lâche. Juste en attente.",
  },
  {
    fr: "Jure-le-moi !",
    en: "Swear to me!",
    who: "Batman",
    source: "Batman Begins, 2005",
    note: "Le Ministère jure solennellement que la date cible ne bougera pas.",
  },
  {
    fr: "Avez-vous déjà dansé avec le diable au clair de lune ?",
    en: "Ever dance with the devil in the pale moonlight?",
    who: "Le Joker",
    source: "Batman, 1989",
    note: "Activité déconseillée au sujet pendant toute la durée du dossier.",
  },
  {
    fr: "Où trouve-t-il tous ces merveilleux jouets ?",
    en: "Where does he get those wonderful toys?",
    who: "Le Joker",
    source: "Batman, 1989",
    note: "Réponse : dans la caisse de soutien au Chevalier Noir. Voir plus bas.",
  },
];
