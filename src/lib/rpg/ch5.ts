/**
 * RPG — chapitre 5 : Protocole Minuit (dialogues, énigme des cadrans, boss final, épilogue).
 *
 * Quête principale « minuit » (7 étapes) et quête secondaire « aiguilles ».
 * L'Inconnu du chapitre 1 s'appelle Seconde : l'ancien apprenti de Monsieur Minuit, l'horloger
 * qui a lancé le Protocole Minuit pour garder pour lui toutes les « encore une minute » du monde.
 * Après la victoire : le Cadran est réparé, il est 00:00, épilogue au quartier, puis mode libre.
 */

import { CADRANS, rouagesOk } from "./tour";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

const Q = "minuit";
const AI = "aiguilles";
const S = "Sparrow";
const CH = "Chevalier Noir";
const GE = "Gérard la Frite";
const LILI = "Lili";
const PO = "Pokeyz";
const SE = "Seconde";
const MI = "Monsieur Minuit";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const has = (r: Rpg, i: string) => r.items.includes(i);
const did = (r: Rpg, s: string, q = Q) => r.done.includes(`${q}:${s}`);
const step = (s: string, q = Q): Effect => ({ kind: "step", quest: q, step: s });
const say = (who: string, text: string) => ({ who, text });
const once = (lines: Conversation["lines"], effects?: Effect[]): Conversation => ({ lines, effects });
const fini = (r: Rpg) => r.quests[Q] === "terminee";
const inTeam = (r: Rpg, id: string) => r.party.includes(id);
const chevalier = (r: Rpg, text: string) => (inTeam(r, "chevalier") ? [say(CH, text)] : []);

const AIGUILLES = ["aiguille-1", "aiguille-2", "aiguille-3"];
const aiguilles = (r: Rpg) => AIGUILLES.filter((a) => has(r, a)).length;
/** Trouver une aiguille : l'objet, et l'étape de la quête secondaire. */
const aiguille = (n: number): Effect[] => [{ kind: "item", id: `aiguille-${n}` }, step(`aiguille-${n}`, AI)];

const heure = (on: boolean) => (on ? "00:00" : "23:59");
const cadranOn = (r: Rpg, n: number) => flag(r, `cadran-${n}`);
/** Tourner un cadran fait aussi tourner ses voisins (comme des engrenages). */
function tourner(n: number, r: Rpg): Conversation {
  if (did(r, "rouages")) return once([say("", "Le cadran est bloqué sur 00:00. Les engrenages ronronnent, satisfaits.")]);
  const touches = [n - 1, n, n + 1].filter((k) => k >= 1 && k <= CADRANS.length);
  const after = CADRANS.map((k) => (touches.includes(k) ? !cadranOn(r, k) : cadranOn(r, k)));
  const effects: Effect[] = touches.map((k) => (cadranOn(r, k) ? { kind: "unflag", id: `cadran-${k}` } : { kind: "flag", id: `cadran-${k}` }));
  const etat = `Cadrans : ${after.map(heure).join(" · ")}`;
  if (after.every(Boolean))
    return once(
      [
        say("", `Tu tournes le cadran n°${n}. Clac, clac… ${etat}.`),
        say("", "Les quatre aiguilles s'alignent sur 00:00. Un grand DÉCLIC résonne dans la Tour : la grille de l'escalier s'ouvre !"),
        say(PO, "Ce clic… C'est le plus beau son que j'aie jamais entendu. Et je bosse avec des basses."),
      ],
      [...effects, step("rouages")],
    );
  return once([say("", `Tu tournes le cadran n°${n}. Ses voisins tournent avec lui. ${etat}.`)], effects);
}

const NPCS: Record<string, Rule[]> = {
  // ─── Parvis ───
  "tour-parvis:seconde": [
    {
      when: fini,
      talk: (r) =>
        once([
          say(SE, "Il est 00:00, puis 00:01, puis 00:02… J'avais oublié que le temps faisait ce bruit-là. Un tout petit tic, à chaque fois."),
          say(SE, "Le vieux Minuit répare des montres, en bas, au village. Gratuitement. Il dit qu'il a des minutes à rendre."),
          ...(aiguilles(r) === 3 && !did(r, "rendre", AI) ? [say(SE, "Oh ! Mes aiguilles ! Donne, donne.")] : []),
        ]),
    },
    {
      when: (r) => aiguilles(r) === 3 && !did(r, "rendre", AI),
      talk: () =>
        once(
          [
            say(SE, "Mes trois aiguilles ! Les heures, les minutes et la trotteuse. Ma montre va enfin pouvoir mentir correctement."),
            say(SE, "Elle avance d'une minute. Exprès. Comme ça, je ne suis jamais en retard. Tiens : prends-la. Toi, tu en as plus besoin que moi."),
            say(S, "Une montre ? Moi ? Je vais devoir regarder l'heure, maintenant ?"),
            say(SE, "Non. Elle sert juste à te rappeler que tu as le temps."),
          ],
          [step("rendre", AI), { kind: "drop", id: "aiguille-1" }, { kind: "drop", id: "aiguille-2" }, { kind: "drop", id: "aiguille-3" }, { kind: "gear", id: "montre-seconde" }],
        ),
    },
    {
      when: (r) => did(r, "seconde"),
      talk: (r) =>
        once([
          say(SE, did(r, "sablier") ? "Le sommet, Sparrow. Il t'attend. Et Minuit n'aime pas qu'on le fasse attendre… ce qui est assez drôle, vu son métier." : "La porte est ouverte. Méfie-toi du Grand Sablier : chaque grain qui tombe est une minute volée à quelqu'un."),
          ...(did(r, "rendre", AI) ? [] : [say(SE, `Et si tu croises mes aiguilles… ${aiguilles(r)} sur 3. Elles sont tombées quand j'ai fui la Tour.`)]),
        ]),
    },
    {
      talk: (r) => ({
        lines: [
          say("???", "Tu es venu. Je savais que tu viendrais. Enfin… je l'espérais très fort, ce qui revient presque au même."),
          say(S, "Le type en capuche du quartier ! Vous m'avez filé le premier fragment, à la station !"),
          say("", "L'inconnu baisse sa capuche. C'est un jeune homme aux yeux cernés, une loupe d'horloger coincée dans l'œil."),
          say(SE, "Je m'appelle Seconde. J'étais l'apprenti de Monsieur Minuit, le grand horloger de cette ville."),
          say(SE, "Un soir, il a inventé le Protocole Minuit. Arrêter le monde à 23:59 : la minute où tout le monde se dit « encore une minute ». Et garder toutes ces minutes pour lui. Pour toujours."),
          say(SE, "Il a construit le Cadran pour ça. La nuit où il l'a mis en marche, je l'ai brisé, à la station électrique de ton quartier. Les éclats se sont dispersés."),
          say(LILI, "Et moi, j'étais payée pour les ramasser. Le Roi, Gonflax, le Métronome… Tous ses gardiens. Je suis désolée, Seconde."),
          say(SE, "Tu as changé de camp. C'est ce qui compte. Il paraît que c'est contagieux, autour de Sparrow."),
          say(S, "Mais pourquoi moi ? Je suis pas un héros. Je suis un mec en jogging qui cherchait des frites."),
          say(SE, "Justement. Tu es le seul que le Protocole n'a jamais pu figer. Tu ne regardes jamais l'heure. Tu prends ton temps. Le temps, lui, n'a aucune prise sur ceux qui savent s'arrêter."),
          ...chevalier(r, "C'est donc ça, l'Élu de la Minute. Celui qui n'est jamais pressé."),
          say(PO, "J'ai toujours dit qu'être en retard, c'était un talent."),
          say(SE, "Avec tes quatre fragments, la porte de la Tour s'ouvrira. Au sommet, Minuit garde le cœur du Cadran. Une fois réuni, tu pourras faire passer la minute. Pour de vrai."),
          say(SE, "Ah, et… j'ai perdu les trois aiguilles de ma montre en fuyant la Tour. Si tu les croises dans un coffre, rapporte-les-moi."),
        ],
        effects: [step("seconde"), { kind: "quest", id: AI }],
      }),
    },
  ],
  "tour-parvis:trotteuse": [
    {
      when: (r) => !flag(r, "ko:trotteuse-parvis"),
      talk: () => ({ lines: [say("Trotteuse", "TIC. TIC. TIC. Intrus détecté à 23:59 ! Il est toujours 23:59 ! Donc intrus toujours détecté !")], then: { kind: "battle", id: "trotteuse" } }),
    },
    { talk: () => once([say("Trotteuse", "Tic… tac ? Tac. C'est nouveau, ça. Tac.")]) },
  ],
  "tour-parvis:coucou": [
    {
      when: (r) => !flag(r, "ko:coucou-parvis"),
      talk: () => ({ lines: [say("Coucou mécanique", "COUCOU ! COUCOU ! Il est 23:59 et vingt mille coucous ! COUCOU !")], then: { kind: "battle", id: "coucou" } }),
    },
    { talk: () => once([say("Coucou mécanique", "…cou.")]) },
  ],

  // ─── Salle des Rouages ───
  "tour:sablier": [
    {
      talk: (r) => ({
        lines: [
          say("Le Grand Sablier", "Sssshhh… Chaque grain qui tombe en moi est une minute volée. Une sieste écourtée. Un café bu trop vite. Un « j'arrive » jamais tenu."),
          say("Le Grand Sablier", "Monsieur Minuit m'a confié la garde des rouages. Personne ne monte."),
          say(GE, "Il est rempli de minutes volées ? Alors on va le vider. Et rendre la monnaie."),
          ...(flag(r, "sablier-1") ? [] : [say(S, "Gérard, c'est la meilleure phrase que tu aies jamais dite.")]),
        ],
        effects: [{ kind: "flag", id: "sablier-1" }],
        then: { kind: "battle", id: "sablier" },
      }),
    },
  ],
  "tour:trotteuses-1": [
    {
      when: (r) => !flag(r, "ko:trotteuses"),
      talk: () => ({ lines: [say("Trotteuse", "TIC-TIC ! Nous gardons le coffre de la Tour ! Nous le gardons depuis… toujours. Car c'est toujours 23:59.")], then: { kind: "battle", id: "trotteuses" } }),
    },
    { talk: () => once([say("Trotteuse", "Tac.")]) },
  ],
  "tour:trotteuses-2": [],
  "tour:coucous-1": [
    {
      when: (r) => !flag(r, "ko:coucous"),
      talk: () => ({ lines: [say("Coucou mécanique", "COUCOU ! Défense de toucher aux cadrans ! Ils sont très bien sur 23:59 ! Ils ADORENT 23:59 !")], then: { kind: "battle", id: "coucous" } }),
    },
    { talk: () => once([say("Coucou mécanique", "…cou.")]) },
  ],
  "tour:coucous-2": [],

  // ─── Sommet ───
  "tour-sommet:minuit": [
    {
      when: (r) => flag(r, "minuit-1"),
      talk: () => ({ lines: [say(MI, "Vous revoilà. Pile à l'heure, pour une fois. Reprenons.")], then: { kind: "battle", id: "minuit" } }),
    },
    {
      talk: (r) => ({
        lines: [
          say(MI, "Sparrow. Vous êtes en retard. Comme toujours. C'est presque admirable."),
          say("", "Un homme grand et maigre, en costume impeccable, se retourne lentement. Un monocle doré. Une canne d'onyx. Derrière lui, l'horloge géante affiche 23:59."),
          say(MI, "Vous savez combien de minutes j'ai récoltées ? Des milliards. Toutes les « encore cinq minutes » du matin. Toutes les « j'arrive » du soir. Toutes les pauses que vous n'avez jamais prises."),
          say(S, "Les siestes de la Confrérie. Les pauses du festival. Les frites du Roi. C'était vous."),
          say(MI, "Le monde gaspillait son temps. Moi, je le range. Ici, il ne s'use jamais. Il ne se passe rien, jamais, et rien ne finit, jamais. C'est parfait."),
          say(MI, "Lili, ma petite livreuse. Reviens, et je raye ton nom de la liste. Promis."),
          say(LILI, "Trop tard. C'est moi qui raye, maintenant."),
          ...chevalier(r, "Ton règne s'achève à minuit, horloger. Et minuit, c'est dans une minute."),
          say(PO, "Je lance la bande-son. Boss final, gros son. Ça va être propre."),
          say(MI, "Très bien. Je vous offre une dernière minute. Profitez-en : ce sera la plus longue de votre vie."),
        ],
        effects: [{ kind: "flag", id: "minuit-1" }],
        then: { kind: "battle", id: "minuit" },
      }),
    },
  ],
  "tour-sommet:echo": [
    {
      talk: () => ({
        lines: [
          say("Écho de Minuit", "Je ne suis qu'un écho. Une minute que le Cadran a oublié de rendre. Une revanche, Sparrow ? J'ai tout le temps du monde. Enfin… j'avais."),
        ],
        choices: [
          { label: "Revanche !", next: { lines: [say("Écho de Minuit", "Tic. Tac. À vous.")], then: { kind: "battle", id: "minuit-revanche" } } },
          { label: "Une autre fois.", next: { lines: [say("Écho de Minuit", "Prenez votre temps. Vous avez l'habitude.")] } },
        ],
      }),
    },
  ],
};
NPCS["tour:trotteuses-2"] = NPCS["tour:trotteuses-1"];
NPCS["tour:coucous-2"] = NPCS["tour:coucous-1"];

// ─── Objets ───

const THINGS: Chapter["things"] = {
  "village:porte-tour": () =>
    once([say("", "Un sentier monte vers le nord, dans la brume. Tout au bout, on devine une tour immense, et une horloge qui affiche 23:59."), say(LILI, "Le dernier nom de la liste est là-haut. Mais d'abord, le dojo. Katsu nous attend.")]),
  "tour-parvis:porte-minuit": () =>
    once([
      say("", "La porte de la Tour est verrouillée. La serrure a la forme d'un cadran sans aiguilles. Les fragments vibrent dans ta poche… mais rien ne se passe."),
      say(LILI, "Le petit gars en capuche, près de la porte. Je l'ai déjà vu quelque part. Il sait sûrement comment entrer."),
    ]),
  "tour-parvis:distributeur": () => ({ lines: [say("", "Un distributeur automatique, collé contre la Tour. Il ronronne. Un écran affiche : « IL EST 23:59 ».")], then: { kind: "shop", id: "tour" } }),
  "tour-parvis:coffre-parvis": (r) =>
    flag(r, "coffre-parvis")
      ? once([say("", "Le coffre est vide.")])
      : once([say("", "Dans le coffre, sous des feuilles mortes : une petite aiguille dorée. L'aiguille des heures d'une montre.")], [{ kind: "flag", id: "coffre-parvis" }, ...aiguille(1)]),
  "tour-parvis:panneau": () => once([say("", "« TOUR DE MINUIT — Horlogerie fine depuis toujours. Fermé pour cause d'éternité. »")]),
  "tour:coffre-tour": (r) =>
    flag(r, "coffre-tour")
      ? once([say("", "Le coffre est vide.")])
      : once([say("", "Le coffre de la Tour : un Café de minuit… et une longue aiguille fine. L'aiguille des minutes.")], [
          { kind: "flag", id: "coffre-tour" },
          { kind: "bag", id: "cafe-minuit", n: 1 },
          ...aiguille(2),
        ]),
  "tour:coffre-rouages": (r) =>
    flag(r, "coffre-rouages")
      ? once([say("", "Le coffre est vide.")])
      : once([say("", "Coincée entre deux engrenages : une aiguille toute fine, rouge au bout. La trotteuse d'une montre. Et deux Méga-cornets, pour une raison inconnue.")], [
          { kind: "flag", id: "coffre-rouages" },
          { kind: "bag", id: "mega-cornet", n: 2 },
          ...aiguille(3),
        ]),
  "tour:pancarte-rouages": () =>
    once([
      say("", "Une plaque de cuivre : « QUAND LES QUATRE MONTRENT MINUIT, L'ESCALIER S'OUVRE. »"),
      say("", "Plus bas, gravé à la main : « Chaque cadran entraîne ses voisins. Commence par les bords. — S. »"),
    ]),
  "tour:grille-escalier": (r) =>
    rouagesOk(r)
      ? once([say("", "La grille est ouverte. Un escalier en colimaçon monte vers le sommet.")])
      : once([say("", "Une grille fermée par un mécanisme d'horlogerie. Quatre cadrans, au fond de la salle, la commandent."), say(GE, "Ils sont tous sur 23:59. Évidemment.")]),
  "tour:banniere": () => once([say("", "Une bannière : un cadran sans aiguilles, et la devise « RIEN NE FINIT ». En dessous, quelqu'un a écrit à la craie : « sauf les frites ».")]),
  "tour-sommet:horloge": (r) =>
    fini(r)
      ? once([say("", "La grande horloge tourne. 00:07. 00:08. Les aiguilles avancent tranquillement, comme si de rien n'était.")])
      : once([say("", "La grande horloge de la Tour. Les aiguilles sont soudées sur 23:59. Elle tremble, comme si elle retenait un éternuement.")]),
  "tour-sommet:banniere": () => once([say("", "« PROTOCOLE MINUIT ». Le mot « protocole » a été barré. À la place : « caprice ».")]),
  // Épilogue au quartier
  "quartier:horloge": (r) => (flag(r, "fin") ? once([say("", "La grande horloge de la place tourne. 00:12. 00:13. Elle a l'air soulagée."), say(S, "Tu vois, c'était pas si dur.")]) : null),
  "quartier:affiche": (r) => (flag(r, "fin") ? once([say("", "« CHAT RETROUVÉ. Minuit est rentré tout seul, à 00:00 pile. Il a mangé. Il dort. Merci à tous. »")]) : null),
};
for (const n of CADRANS) THINGS[`tour:cadran-${n}`] = (r) => tourner(n, r);

/** Répliques d'épilogue des habitants du quartier (jouées avant leurs répliques habituelles). */
export const EPILOGUE_NPCS: Record<string, Rule[]> = {
  "quartier:nico": [
    {
      when: (r) => flag(r, "fin"),
      talk: () => once([say("Nico le Livreur", "00:14 ! J'ai livré ma pizza ! Le client m'a donné un pourboire ! Le temps passe, Sparrow, et moi aussi je passe : au prochain client !")]),
    },
  ],
  "quartier:bouchon": [
    {
      when: (r) => flag(r, "fin"),
      talk: () => once([say("Madame Bouchon", "Bonsoir jeune homme ! Belle soirée, n'est-ce pas ? J'ai enfin acheté mon pain. Il est rassis. Il a l'âge de la minute. C'est merveilleux.")]),
    },
  ],
  "quartier:raymond": [
    {
      when: (r) => flag(r, "fin"),
      talk: () => once([say("Raymond", "La caisse imprime « 00:15 » ! Les frites sont décongelées ! Je t'en mets un cornet de côté, Sparrow. Offert. Pour toujours. Enfin, pour un temps normal.")]),
    },
  ],
};

// ─── Moments scénarisés ───

function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  if (map === "tour-parvis" && !did(r, "nord"))
    return {
      lines: [
        say("", "Au bout du sentier, une tour immense perce les nuages. Tout en haut, une horloge géante affiche 23:59. Ses aiguilles tremblent."),
        say(LILI, "Le dernier nom de la liste. « MONSIEUR MINUIT — Tour de Minuit — Protocole »."),
        say(S, "Quatre fragments. Une tour. Un mec qui vole les minutes. Et moi qui voulais juste des frites, au départ."),
        say(PO, "C'est le dernier niveau, frérot. Le dernier niveau, c'est toujours une tour."),
      ],
      effects: [{ kind: "quest", id: Q }, step("nord")],
    };
  if (map === "tour" && first) return once([say("", "La Salle des Rouages. Des engrenages géants tournent dans les murs… tous dans le vide. Au fond, une grille ferme l'escalier."), say(GE, "Ça sent l'huile de machine. Pas la bonne huile.")]);
  if (map === "tour-sommet" && !did(r, "sommet"))
    return { lines: [say("", "Le sommet de la Tour. Le vent siffle. La ville entière est en dessous, figée, minuscule. Au centre, quelqu'un attend, dos tourné.")], effects: [step("sommet")] };
  if (map === "quartier" && flag(r, "fin") && !flag(r, "epilogue-vu"))
    return {
      lines: [
        say("", "Le quartier 404. La grande horloge de la place affiche 00:11. Les lampadaires ne grésillent plus. Quelque part, un chat miaule."),
        say(S, "On est rentrés. Et il est minuit passé. Pour de vrai."),
        say(GE, "Ça sent la friture fraîche. Raymond a rouvert la supérette."),
        say(LILI, "Je vais rendre tout ce que j'ai volé. Enfin… presque tout. Je garde la lettre. En souvenir."),
        ...chevalier(r, "Ma garde est terminée, Élu. Pour la première fois depuis 23:59, je vais pouvoir m'asseoir."),
        say(PO, "Et maintenant, on fait quoi ?"),
        say(S, "Maintenant ? On a tout le temps. Je propose une sieste. Puis des frites. Puis une autre sieste."),
        say("", "Sur l'affiche de la place, quelqu'un a barré « CHAT PERDU » et écrit : « RETROUVÉ — il s'appelle Minuit, il est rentré à 00:00 pile »."),
        say("", "MODE LIBRE : explore les cinq chapitres, termine les quêtes secondaires, et défie l'Écho de Minuit au sommet de la Tour."),
      ],
      effects: [{ kind: "flag", id: "epilogue-vu" }, { kind: "flag", id: "mode-libre" }],
    };
  return null;
}

function afterBattle(id: string, _r: Rpg): Conversation | null {
  if (id === "sablier")
    return once(
      [
        say("", "Le Grand Sablier se fissure. Des milliards de grains dorés s'envolent par les fenêtres de la Tour, vers la ville."),
        say(S, "Les minutes volées… elles rentrent chez elles."),
        say(SE, "Les rouages ! Il faut remettre les quatre cadrans sur minuit pour ouvrir l'escalier. Lis la plaque !"),
      ],
      [step("sablier")],
    );
  if (id === "minuit")
    return {
      lines: [
        say(MI, "Non… non, non, non. Une minute. Il me fallait juste… une minute de plus."),
        say("", "Le cadran dans la poitrine de Monsieur Minuit s'arrête. Il s'en détache doucement et flotte vers Sparrow. Les quatre fragments jaillissent de sa poche et viennent s'y emboîter."),
        say(SE, "Le Cadran… Il est entier. Sparrow, c'est toi qui dois le remettre en marche."),
      ],
      effects: [step("minuit")],
      then: { kind: "scene", id: "aube" },
    };
  if (id === "minuit-revanche")
    return once([say("Écho de Minuit", "Tic… tac. Bien joué. Vous avez gagné une minute. Gardez-la, celle-là."), say(PO, "On est trop forts. Faudrait qu'on le fasse en live.")], [{ kind: "bag", id: "cafe-minuit", n: 1 }]);
  return null;
}

const fin = (): Effect[] => [step("aube"), { kind: "flag", id: "fin" }, { kind: "item", id: "cadran" }];

function scene(id: string): Conversation | null {
  if (id !== "aube") return null;
  return {
    lines: [
      say("", "Sparrow tient le Cadran entre ses mains. Il est tiède. Il bat comme un cœur, très lentement. Dedans, on entend des milliards de minutes chuchoter."),
      say(SE, "Toutes les minutes du Protocole sont là. Tu peux les rendre au monde. Ou… les garder. Personne ne t'en voudrait."),
    ],
    choices: [
      {
        label: "Les rendre à tout le monde.",
        next: {
          lines: [
            say(S, "Elles sont pas à moi. Elles sont à Nico, à Madame Bouchon, aux moines, aux danseurs… À tout le monde."),
            say("", "Sparrow tourne le Cadran d'un cran. CLIC."),
            ...epilogueTour(),
          ],
          effects: fin(),
        },
      },
      {
        label: "En garder une, pour une sieste.",
        next: {
          lines: [
            say(S, "Je les rends toutes. Sauf une. Une toute petite. Pour une sieste. C'est pas négociable."),
            say(SE, "… C'est exactement ce que j'aurais fait."),
            say("", "Sparrow tourne le Cadran d'un cran. CLIC."),
            ...epilogueTour(),
          ],
          effects: fin(),
        },
      },
    ],
  };
}

function epilogueTour(): Conversation["lines"] {
  return [
    say("", "La grande horloge de la Tour tremble… et ses aiguilles se rejoignent. 00:00."),
    say("", "Dans toute la ville, au même instant, les horloges passent à minuit. Nico livre sa pizza. Madame Bouchon finit sa phrase. Les moines s'endorment. Les danseurs s'assoient."),
    say(MI, "C'est… c'est donc ça. Le bruit du temps qui passe. Je l'avais oublié."),
    say("", "Monsieur Minuit a vieilli d'un coup. Ce n'est plus qu'un vieil horloger fatigué, qui tient sa canne à deux mains."),
    say(MI, "Je voulais que rien ne finisse. J'avais peur de la dernière minute. Alors j'ai volé celles de tout le monde."),
    say(S, "Elles finissent toutes, les minutes. C'est pour ça qu'on en profite. Enfin… moi, j'en profite surtout pour dormir."),
    say(SE, "Venez, maître. On a des montres à réparer. Beaucoup de montres."),
    say(LILI, "Regarde la liste, Sparrow."),
    say("", "Sur la lettre du Cadran, tous les noms sont rayés. Tout en bas, une écriture qui ressemble beaucoup à celle de Sparrow, en plus vieille : « Merci. Ici aussi, il vient de sonner minuit. — K. »"),
    say(PO, "Katsu… Il a réussi, lui aussi. Dans son monde."),
    say(S, "Bon. On rentre ? J'ai une sieste en retard. Une très, très longue sieste."),
  ];
}

export const CH5: Chapter & { scene: typeof scene } = {
  npcs: NPCS,
  things: THINGS,
  arrival,
  afterBattle,
  scene,
};

export const FINAL_QUEST = Q;
export const CH5_CARD = ["CHAPITRE 5 TERMINÉ", "PROTOCOLE MINUIT", "+800 XP · +600 FP", "Objet : le Cadran réparé", "Il est 00:00. La minute a passé."];

/** Générique de fin (défile après la dernière carte de chapitre). */
export const CREDITS: string[][] = [
  ["SPARROW : 23:59", "L'Élu de la Minute"],
  ["Avec", "Sparrow", "le Chevalier Noir", "Gérard la Frite", "Lili", "Pokeyz"],
  ["Et", "Nico le Livreur", "Madame Bouchon", "Raymond", "le Roi de la Salade", "Mamie Tubercule", "Coach Gonflax", "le Sage Mollet", "Frère Flemme", "Brenda", "le Métronome", "Madame Sencha", "Mamie Matcha", "Maître Katsu", "Seconde"],
  ["Dans le rôle du méchant", "Monsieur Minuit"],
  ["Chapitres", "1 · La Ville Figée", "2 · La Cité des Frites Perdues", "3 · La Confrérie du Muscle", "4 · La Voie du Samouraï", "5 · Protocole Minuit"],
  ["Pixels, musique et code", "faits maison, image par image"],
  ["Merci d'avoir joué !", "Il est 00:00.", "Prends ton temps."],
];
