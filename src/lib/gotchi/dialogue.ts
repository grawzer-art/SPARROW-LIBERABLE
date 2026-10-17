/**
 * Dialogues contextuels : Sparrow répond selon son humeur, ses besoins, l'heure,
 * la dernière action, le temps d'absence, ses habitudes et son équipement.
 * Les répliques récentes sont évitées (anti-répétition via state.said).
 */

import { HOUR, MIN, mood, parisHour, type Mood, type State } from "./core";
import { titleFor } from "./items";

type Rand = () => number;

const MOOD_LINES: Partial<Record<Mood, string[]>> = {
  content: [
    "La vie est belle. Les frites sont chaudes. Le Wi-Fi capte.",
    "Je suis au top. Ne touche à rien. Sauf si c'est pour des frites.",
    "T'es mon pote préféré. Le dis pas aux autres, ils sont jaloux.",
    "Aujourd'hui je me sens capable de tout. Sauf de manger une salade.",
    "Je rayonne. C'est peut-être l'huile de friture, mais je rayonne.",
  ],
  neutre: [
    "Ouais ? Je t'écoute. À moitié.",
    "Ça va. Ça irait mieux avec des frites, mais ça va.",
    "On parle de quoi ? De farm ? Oui ? Parfait.",
    "Je réfléchis. C'est rare, profite.",
    "J'ai une théorie : le lundi a été inventé par une salade.",
  ],
  affame: [
    "Je ne peux pas parler. J'ai trop faim pour faire des phrases.",
    "Tu parles, mais j'entends seulement « frites ».",
    "Mon ventre a lancé une alerte rouge. Coopère.",
    "Si tu m'aimais, la friteuse serait déjà chaude.",
  ],
  creve: [
    "Je ne suis pas fatigué. C'est toi qui es flou.",
    "Parle moins fort, mes yeux ont mal.",
    "Je ne dors pas, je fais une mise à jour de mon cerveau.",
    "Une micro-sieste ? Jamais. Bon. Peut-être. Non.",
  ],
  deprime: [
    "Je suis triste. Une session de farm aiderait. Je dis ça, je dis rien.",
    "Le monde est gris, comme une salade sans sauce.",
    "Même le canapé ne me comprend plus.",
  ],
  gras: [
    "Je suis Fritoman. Fritoman ne parle pas, il digère.",
    "Ne me secoue pas, je suis plein à ras bord.",
    "J'ai trop mangé. Je recommencerais sans hésiter.",
  ],
  focus: ["Hmm. Oui. Non. ATTAQUE !", "Je t'écoute… Non, en fait.", "Pas maintenant, je suis dans la zone."],
  rage: ["NE ME PARLE PAS. JE RAGE.", "Laisse-moi, je dois insulter un monstre.", "Si t'as rien de frit, recule."],
  dofus: ["Je suis en session. Rappelle demain.", "Je reviens. (Il ne reviendra pas.)"],
  boude: ["…", "Je boude. Ne me demande pas pourquoi, je ne le sais plus moi-même.", "Je ne te parle pas. Sauf si frites."],
  crise: ["Au secours. Des frites. Du farm. Quelque chose.", "Je suis au bout du rouleau. Du rouleau de printemps."],
};

const HOUR_LINES: [number, number, string[]][] = [
  [0, 5, [
    "Il est tard ? Je n'ai pas remarqué. Je ne remarque jamais.",
    "La nuit, c'est le meilleur moment pour farmer. Les monstres dorment.",
    "Toi aussi tu dors pas ? On est une équipe.",
  ]],
  [5, 11, [
    "Le matin, c'est comme le soir mais en plus agressif.",
    "Petit-déjeuner idéal : des frites d'hier. C'est du recyclage.",
    "Bonjour. J'ai pas dormi, mais bonjour.",
  ]],
  [11, 14, ["C'est l'heure du déjeuner. Je dis ça pour toi, hein. Moi j'ai pas faim. (Il a faim.)", "Midi pile. Mon estomac est plus précis qu'une horloge atomique."]],
  [14, 18, ["L'après-midi, je fais semblant d'être productif. Tu vois ? Là, je fais semblant.", "Pause goûter ? Frites goûter ?"]],
  [18, 24, ["Le soir, je suis au maximum de mes capacités. C'est-à-dire assis.", "Ce soir, gros donjon. Préviens personne."]],
];

const AFTER: Record<string, string[]> = {
  frites: ["J'ai encore le goût des frites. C'est le meilleur goût du monde.", "Tu m'as nourri. Je te dois une faveur. Une petite."],
  salade: ["J'ai encore le goût du jardin. C'est un traumatisme.", "La salade de tout à l'heure, on n'en reparle jamais."],
  dofus: ["T'as vu ma dernière session ? Non ? Dommage, c'était légendaire.", "Mes doigts sont encore chauds. Je suis une machine."],
  douche: ["Je sens bon. Profite, c'est une édition limitée.", "Après la douche, je me sens neuf. Neuf ans, environ."],
  sieste: ["Ma micro-sieste était incroyable. 4 minutes de pur génie.", "J'ai dormi ? Non. J'ai fermé les yeux avec intensité."],
  farm: ["Tu as vu comment j'ai farmé ? Écris-le dans mon dossier.", "Les monstres parlent encore de moi."],
};

const HABITS: [(s: State) => boolean, string][] = [
  [(s) => s.counters.frites > 3 * (s.counters.salade + 1), "Tu me connais par cœur. Frites, frites, frites. C'est beau."],
  [(s) => s.counters.saladeRefus >= 5, "Tu continues avec ta salade ? Tu es têtu. J'aime bien."],
  [(s) => s.counters.farms >= 5, "On forme une sacrée équipe de farm, toi et moi."],
  [(s) => s.counters.siestesRefusees >= 5, "Arrête de me proposer des siestes. Je suis un guerrier."],
  [(s) => s.level >= 5, "Je suis devenu quelqu'un. Un quelqu'un en jogging, mais quelqu'un."],
  [(s) => s.days.length >= 3, "Tu reviens souvent, toi. On dirait que tu tiens à moi. C'est gênant."],
];

const EQUIP: Record<string, string[]> = {
  "lun-aviateur": ["Avec ces lunettes, je pourrais piloter un avion. Ou au moins un caddie."],
  "lun-3d": ["Avec les lunettes 3D, les frites me sautent au visage. C'est le rêve."],
  "lun-rondes": ["Je me sens sage. Pose-moi une question. Pas trop dure."],
  "lun-ski": ["Je suis prêt pour la descente. Vers le frigo."],
  "lun-laser": ["Ma visière voit à travers la salade. Il n'y a rien derrière. Comme prévu."],
  "ten-cape": ["La cape me donne +20 en charisme et -40 en discrétion."],
  "ten-peignoir": ["En peignoir, je suis en mode milliardaire. Sans le milliard."],
  "ten-frite": ["Ce maillot est le plus beau jour de ma vie. Après le prochain repas."],
  "ten-armure": ["Cette armure ne protège de rien, mais regarde comme elle brille."],
  "tet-masque": ["Je suis le Chevalier Noir. Gotham peut dormir. Moi non."],
  "tet-couronne": ["Je suis le roi de la frite. Inclinez-vous, et apportez de la sauce."],
  "tet-casque": ["Pardon ? J'ai mon casque. Je n'entends que les choses importantes."],
};

export function pickFresh(pool: string[], said: string[], rand: Rand): string {
  const fresh = pool.filter((l) => !said.includes(l));
  const src = fresh.length ? fresh : pool;
  return src[Math.floor(rand() * src.length) % src.length];
}

/** Choisit une réplique contextuelle quand on parle à Sparrow. */
export function talk(s: State, now: number, rand: Rand = Math.random): string {
  const m = mood(s, now);
  const h = parisHour(now);
  const pools: string[][] = [];
  const w = (pool: string[] | undefined, times = 1) => {
    if (pool?.length) for (let i = 0; i < times; i++) pools.push(pool);
  };

  // Les besoins pressants priment.
  if (["affame", "crise", "rage", "boude", "gras", "focus", "creve"].includes(m)) w(MOOD_LINES[m], 4);
  else w(MOOD_LINES[m], 2);

  const hourPool = HOUR_LINES.find(([a, b]) => h >= a && h < b)?.[2];
  w(hourPool);

  if (s.lastAction && now - s.lastAction.t < 15 * MIN) w(AFTER[s.lastAction.a], 2);
  w(HABITS.filter(([f]) => f(s)).map(([, l]) => l));
  w(EQUIP[s.equip.lunettes]);
  w(EQUIP[s.equip.tenue]);
  w(EQUIP[s.equip.tete]);
  if (s.pcBrokenUntil > now) w(["Mon PC est en panne. Je vis comme un homme des cavernes. Avec des frites, au moins."], 2);
  w([`Je suis « ${titleFor(s.level)} ». C'est écrit sur ma carte de visite imaginaire.`]);

  const pool = pools[Math.floor(rand() * pools.length)] ?? MOOD_LINES.neutre!;
  return pickFresh(pool, s.said, rand);
}

/** Message d'accueil en fonction du temps écoulé depuis la dernière visite. */
export function welcome(away: number, s: State, rand: Rand = Math.random): string | null {
  if (away < 30 * MIN) return null;
  const h = Math.round(away / HOUR);
  const dur = h < 1 ? "moins d'une heure" : h < 48 ? `${h} h` : `${Math.round(h / 24)} jours`;
  const pool =
    away > 3 * 24 * HOUR
      ? [`${dur} sans nouvelles. J'ai cru que tu m'avais échangé contre un Tamagotchi normal.`, `${dur} ! J'ai parlé au frigo tout ce temps. Il est sympa, mais il est froid.`]
      : s.stats.satiete < 30
        ? [`Absent ${dur}. J'ai mangé un ticket de caisse pour survivre.`]
        : s.stats.fun < 30
          ? [`Absent ${dur}. J'ai compté les pixels de mon écran. Deux fois.`]
          : s.stats.energie < 30
            ? [`Absent ${dur}. Je n'ai pas dormi. C'est un choix de vie.`]
            : [`Absent ${dur}. J'ai survécu sans toi. Je fais semblant de ne pas t'avoir attendu.`, `Te revoilà après ${dur}. Assieds-toi, je te raconte ce que tu as raté.`];
  return pool[Math.floor(rand() * pool.length)];
}

// ─── Répliques liées à ce que fait vraiment le joueur (déplacements, objets) ───

export const PLAY_LINES = {
  start: [
    "Ah, on me pilote maintenant ? Doucement avec le joystick, je suis fragile.",
    "Tu me diriges ? Très bien. Mais je choisis la musique.",
    "Mode manette activé. Je me sens comme un perso de jeu. Un perso principal.",
  ],
  bump: [
    "Aïe. Ce meuble n'était pas là hier.",
    "Tu viens de me faire foncer dans un mur. Je note.",
    "Je rentre dans les meubles, mais avec style.",
    "Collision. Mon honneur est intact, mon genou moins.",
  ],
  long: [
    "On va où exactement ? S'il y a des frites au bout, je marche.",
    "Je fais plus de pas en 5 minutes qu'en une semaine. Merci, je crois.",
    "C'est un appartement, pas un marathon.",
  ],
  room: {
    chambre: ["La chambre. Je n'y dors pas, j'y stocke des chaussettes.", "Le lit me regarde. Je ne le regarde pas."],
    gaming: ["Mon bureau. Mon trône. Mon destin.", "Le PC m'appelle. Je l'entends ronronner."],
    salon: ["Le salon. Territoire officiel du canapé.", "Ici, j'ai fait 300 siestes de 4 minutes."],
    cuisine: ["La cuisine. Mon sanctuaire.", "Ça sent la friture. Je suis chez moi."],
    muscu: ["La salle de sport. Ça sent l'effort. Et un peu les frites.", "Ici, on soulève. Des haltères, et parfois une frite."],
  } as Record<string, string[]>,
  canape: [
    "Encore une émission de cuisine sans frites. Je zappe.",
    "La télé, c'est comme un PC, mais sans les monstres.",
    "Je regarde la télé, mais je pense à mon farm.",
  ],
  miroir: [
    ["Miroir, mon beau miroir… Ah. C'est moi. D'accord.", "Pour l'instant, mes muscles sont en mode furtif."],
    ["Je suis sec. Comme une frite trop cuite, mais en beau.", "On voit un début de biceps. Ou c'est la lumière."],
    ["Costaud ! Le t-shirt commence à souffrir.", "Regarde ce bras. Non, l'autre. Pareil, en fait."],
    ["Bodybuildé. Je pourrais porter le frigo. Je ne le ferai pas.", "Mes épaules ont leurs propres épaules."],
    ["SPARROW TITAN. Le miroir a peur de moi.", "Je suis devenu une légende. Une légende qui mange des frites."],
  ],
  frigo: [
    "Le frigo contient : de la mayo, de l'espoir, et une salade suspecte.",
    "J'ouvre, je regarde, je referme. Comme d'habitude.",
    "Toujours pas de frites dans le frigo. C'est un scandale national.",
  ],
  fenetre: [
    "Dehors, il y a le monde. Il n'a pas l'air d'avoir de Wi-Fi.",
    "Je regarde passer les pigeons. Ils me jugent.",
    "Il fait beau. Parfait pour rester à l'intérieur.",
  ],
  lit: [
    "Le lit ? Non. J'ai des responsabilités. Et un PC.",
    "Je m'assois sur le lit. Je ne m'allonge pas. C'est une règle.",
    "Dormir, c'est perdre du temps de jeu.",
  ],
};

export type PlayLine = "start" | "bump" | "long" | "frigo" | "fenetre" | "canape" | "lit";

export function playLine(kind: PlayLine, said: string[], rand: Rand = Math.random): string {
  return pickFresh(PLAY_LINES[kind], said, rand);
}

export function roomLine(room: string, said: string[], rand: Rand = Math.random): string {
  return pickFresh(PLAY_LINES.room[room] ?? PLAY_LINES.room.salon, said, rand);
}

export function mirrorLine(stage: number, said: string[], rand: Rand = Math.random): string {
  return pickFresh(PLAY_LINES.miroir[Math.max(0, Math.min(4, stage))], said, rand);
}
