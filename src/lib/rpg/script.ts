/**
 * RPG — scénario : dialogues des PNJ et textes des objets, selon l'avancement.
 *
 * Système réutilisable : chaque PNJ ou objet a une liste de répliques conditionnelles ;
 * la première dont la condition est vraie est jouée (avec ses effets, ses choix, son action).
 * Le registre est rangé par carte (« carte:pnj ») ; chaque chapitre apporte le sien.
 * Ce fichier contient le chapitre 1 (Quartier 404) et l'aiguillage vers les autres chapitres.
 */

import { CH2, CH2_CARD } from "./ch2";
import { flag, has, isDone, status, type Effect, type Rpg } from "./quest";
import { pick, type Chapter, type Conversation, type Rule, type ThingTalk } from "./talk";

export type { Action, Choice, Conversation, Line } from "./talk";

const Q = "ville-figee";
const d = (r: Rpg, step: string) => isDone(r, Q, step);
const fini = (r: Rpg) => status(r, Q) === "terminee";
const S = "Sparrow";
const step = (s: string): Effect => ({ kind: "step", quest: Q, step: s });

const NICO = "Nico le Livreur";
const BOUCHON = "Madame Bouchon";
const RAYMOND = "Raymond";
const INCONNU = "???";
const CHEVALIER = "Chevalier Noir";
const BROCOLI = "Soldat Brocoli";

export const NPC_TALK: Record<string, Rule[]> = {
  nico: [
    {
      when: fini,
      talk: () => ({
        lines: [
          { who: NICO, text: "La minute a bougé ! J'ai senti mon pourboire avancer d'une minute ! Merci, Sparrow !" },
          { who: NICO, text: "Bon, maintenant je suis en retard. Mais en retard de façon NORMALE. C'est merveilleux." },
        ],
      }),
    },
    {
      when: (r) => !d(r, "nico"),
      talk: () => ({
        lines: [
          { who: NICO, text: "Ah ! Un humain qui bouge ! Enfin ! Je commençais à parler aux lampadaires." },
          { who: NICO, text: "Je livre cette pizza depuis… depuis… Il est quelle heure, là ?" },
          { who: S, text: "23:59. Comme d'hab'." },
          { who: NICO, text: "NON. Pas comme d'hab' ! Ça fait des HEURES qu'il est 23:59 ! J'ai fait six fois le tour du quartier, la minute ne passe pas !" },
          { who: NICO, text: "Va voir la grande horloge de la place si tu me crois pas. Moi j'y retourne pas : elle me regarde bizarrement." },
          { who: NICO, text: "Tiens, prends la pizza. Le client est figé devant sa télé, il la mangera jamais. Et moi je stresse trop pour manger." },
        ],
        effects: [step("nico"), { kind: "item", id: "pizza" }],
      }),
    },
    {
      when: (r) => !d(r, "horloges"),
      talk: () => ({ lines: [{ who: NICO, text: "L'horloge de la place, Sparrow ! Va voir ! Et ne la fixe pas trop longtemps, elle cligne pas des yeux." }] }),
    },
    {
      when: (r) => !d(r, "station"),
      talk: () => ({
        lines: [
          { who: NICO, text: "Bloquée sur 23:59, hein ? Je le savais ! Tout le quartier est branché sur la station électrique. Même mon scooter." },
          { who: NICO, text: "Si quelqu'un a débranché le temps, c'est là-bas. Moi je n'y vais pas, j'ai une phobie des trucs qui font « bzzz »." },
        ],
      }),
    },
    { talk: () => ({ lines: [{ who: NICO, text: "Tu vas à la station ? Si tu croises une minute qui passe, dis-lui que je l'attends." }] }) },
  ],

  bouchon: [
    {
      when: fini,
      talk: () => ({
        lines: [
          { who: BOUCHON, text: "Bonsoir jeune homme ! Belle soirée, n'est-ce pas ? Je sors juste chercher mon…" },
          { who: BOUCHON, text: "Oh ! J'ai dit autre chose ! Quelle émotion. Je n'avais pas fini une phrase différemment depuis… depuis 23:59." },
        ],
      }),
    },
    {
      when: (r) => !flag(r, "bouchon-1"),
      talk: () => ({
        lines: [
          { who: BOUCHON, text: "Bonsoir jeune homme ! Belle soirée, n'est-ce pas ? Je sors juste chercher mon pain." },
          { who: S, text: "À minuit moins une ?" },
          { who: BOUCHON, text: "Bonsoir jeune homme ! Belle soirée, n'est-ce pas ? Je sors juste chercher mon pain." },
          { who: S, text: "… Vous venez de le dire." },
          { who: BOUCHON, text: "Ah bon ? Pourtant j'ai l'impression de le dire pour la première fois. Depuis toujours." },
        ],
        effects: [{ kind: "flag", id: "bouchon-1" }],
      }),
    },
    {
      when: (r) => !has(r, "badge") && !d(r, "badge"),
      talk: () => ({
        lines: [
          { who: BOUCHON, text: "Bonsoir jeune homme ! Belle soir… Ah, c'est toi. Le petit qui joue à l'ordinateur la nuit." },
          { who: BOUCHON, text: "Le technicien de la station passe toujours par la ruelle à côté de chez moi. Il perd tout, ce garçon. Ses clés, son badge, sa dignité." },
        ],
      }),
    },
    {
      talk: () => ({
        lines: [
          { who: BOUCHON, text: "Bonsoir jeune homme ! Belle soirée, n'est-ce pas ?" },
          { who: BOUCHON, text: "Ma boulangerie ferme à minuit. Ça fait une éternité que j'arrive pile une minute avant." },
        ],
      }),
    },
  ],

  raymond: [
    {
      when: fini,
      talk: () => ({
        lines: [
          { who: RAYMOND, text: "Les frites surgelées décongèlent ! C'est un miracle ! Ou alors c'est juste la physique qui reprend le travail." },
          { who: RAYMOND, text: "La supérette rouvrira bientôt. Au prochain chapitre, comme on dit dans le métier." },
        ],
      }),
    },
    {
      when: (r) => has(r, "badge"),
      talk: () => ({
        lines: [
          { who: RAYMOND, text: "C'est le badge du technicien, ça ! Avec ça, tu peux ouvrir le portail de la station électrique, de l'autre côté de la place." },
          { who: RAYMOND, text: "Moi je n'y vais pas, j'ai un magasin à surveiller. Figé, certes. Mais surveillé." },
        ],
      }),
    },
    {
      when: (r) => !flag(r, "raymond-1"),
      talk: () => ({
        lines: [
          { who: RAYMOND, text: "Bienvenue à la Supérette 404 ! Ouverte 24 h sur 24. Enfin, 23 h 59 sur 23 h 59, en ce moment." },
          { who: RAYMOND, text: "J'ai voulu fermer la caisse : impossible, le ticket reste bloqué sur 23:59. Même les frites surgelées n'arrivent plus à décongeler." },
          { who: S, text: "Les frites ?! Là, c'est grave." },
          { who: RAYMOND, text: "Le technicien de la station est passé en courant tout à l'heure. Il a fait tomber un truc dans la benne de la ruelle, juste à côté. Il a juré, il est reparti." },
        ],
        effects: [{ kind: "flag", id: "raymond-1" }],
      }),
    },
    { talk: () => ({ lines: [{ who: RAYMOND, text: "La benne, dans la ruelle, entre ma boutique et chez Madame Bouchon. Fouille, je ne dirai rien. Je ne vois rien, je suis figé." }] }) },
  ],

  inconnu: [
    {
      when: (r) => !flag(r, "inconnu-1"),
      talk: () => ({
        lines: [
          { who: INCONNU, text: "…" },
          { who: INCONNU, text: "Tu es réveillé. Intéressant." },
          { who: S, text: "Euh… on se connaît ?" },
          { who: INCONNU, text: "Pas encore. Continue de chercher, Sparrow. Le temps ne t'attendra pas. Enfin… si. Justement. C'est bien le problème." },
        ],
        effects: [{ kind: "flag", id: "inconnu-1" }],
      }),
    },
    {
      when: (r) => !d(r, "station"),
      talk: () => ({ lines: [{ who: INCONNU, text: "Les horloges ne mentent pas. Elles ont juste arrêté de dire la vérité." }] }),
    },
    { talk: () => ({ lines: [{ who: INCONNU, text: "La station t'attend. Le transformateur aussi. Ne le fais pas attendre une minute de plus. Façon de parler." }] }) },
  ],
  chevalier: [
    {
      when: (r) => !flag(r, "chevalier-1"),
      talk: () => ({
        lines: [
          { who: CHEVALIER, text: "HALTE. Qui va là, dans la nuit qui ne finit pas ?" },
          { who: S, text: "Sparrow. Je vais là. Enfin, je vais surtout chercher à manger." },
          { who: CHEVALIER, text: "Le fragment d'horloge… Il brille dans ta poche. C'est donc toi, l'Élu de la Minute." },
          { who: S, text: "L'Élu de la Minute ? C'est un titre officiel ? Il y a une carte de membre ?" },
          { who: CHEVALIER, text: "Je suis le Chevalier Noir. Je garde cette route depuis 23:59. Ce qui fait, selon mes calculs… très longtemps, ou pas du tout." },
          { who: CHEVALIER, text: "Au-delà, la Cité des Frites Perdues. Un roi y a interdit la friture. Et l'un des fragments du temps s'y cache." },
          { who: S, text: "Interdit… la friture. Il y a des limites à ne pas franchir. Celle-là en est une." },
          { who: CHEVALIER, text: "Alors laisse-moi t'accompagner, Élu. Mon épée est à toi. Mon armure aussi, mais elle est à ma taille." },
        ],
        effects: [{ kind: "flag", id: "chevalier-1" }],
        choices: [
          {
            label: "En route, Chevalier !",
            next: {
              lines: [
                { who: CHEVALIER, text: "Que l'ombre guide nos pas. Et que l'huile soit chaude." },
                { who: "", text: "Le Chevalier Noir rejoint l'équipe !" },
              ],
              effects: [{ kind: "join", id: "chevalier" }],
            },
          },
          {
            label: "Je dois me préparer.",
            next: { lines: [{ who: CHEVALIER, text: "Sage décision. Je reste ici. Immobile. Dans le noir. C'est ce que je fais de mieux." }] },
          },
        ],
      }),
    },
    {
      talk: () => ({
        lines: [{ who: CHEVALIER, text: "Prêt, Élu ? La route du Centre-ville n'attend que nous." }],
        choices: [
          {
            label: "Allons-y !",
            next: {
              lines: [
                { who: CHEVALIER, text: "Parfait. J'ai répété ma pose héroïque toute la nuit." },
                { who: "", text: "Le Chevalier Noir rejoint l'équipe !" },
              ],
              effects: [{ kind: "join", id: "chevalier" }],
            },
          },
          { label: "Pas encore.", next: { lines: [{ who: CHEVALIER, text: "Je t'attends. Le temps aussi, de toute façon." }] } },
        ],
      }),
    },
    { talk: () => ({ lines: [{ who: CHEVALIER, text: "…" }] }) },
  ],

  eclaireur: [
    {
      when: (r) => !flag(r, "ko:eclaireur"),
      talk: () => ({
        lines: [
          { who: BROCOLI, text: "HALTE ! Au nom du Roi de la Salade, je confisque tout aliment frit, pané ou simplement heureux !" },
          { who: S, text: "Un brocoli. Avec un casque. Qui me parle. D'accord. La nuit est longue." },
          { who: CHEVALIER, text: "Un éclaireur de la Cité. Il ne nous laissera pas passer. Élu, montre-lui ce que vaut une manette bien tenue !" },
          { who: BROCOLI, text: "Pour la vitamine C ! À L'ATTAQUE !" },
        ],
        then: { kind: "battle", id: "eclaireur" },
      }),
    },
    { talk: () => ({ lines: [{ who: BROCOLI, text: "Je… je vais faire un rapport. Un rapport très vert." }] }) },
    { talk: () => ({ lines: [{ who: BROCOLI, text: "…" }] }) },
  ],
};

/** Textes des objets du Quartier 404. `text` = inscription d'un panneau. */
function examineQuartier(id: string, r: Rpg, text?: string): Conversation | null {
  switch (id) {
    case "horloge":
      if (fini(r)) return { lines: [{ who: S, text: "00:00. Elle s'est remise à tourner. Doucement, comme si elle avait peur de réveiller quelqu'un." }] };
      if (!d(r, "horloges"))
        return {
          lines: [
            { who: "", text: "La grande horloge de la place affiche 23:59. L'aiguille des secondes tremble… mais n'avance pas." },
            { who: S, text: "Bloquée. Comme mon four. Et mon PC. Et toutes les horloges du quartier, apparemment." },
            { who: S, text: "Une panne générale ? Si c'est électrique, la station électrique de l'autre côté de la place doit y être pour quelque chose." },
          ],
          effects: [step("horloges")],
        };
      return { lines: [{ who: "", text: "23:59. Toujours. Elle a l'air de retenir sa respiration." }] };
    case "benne":
      if (!has(r, "badge") && !d(r, "badge"))
        return {
          lines: [
            { who: "", text: "Tu fouilles la benne… Une chaussette. Un ticket de caisse daté de 23:59. Une frite fossilisée…" },
            { who: "", text: "… et un badge ! « MAINTENANCE — STATION 404 »." },
            { who: S, text: "Je ne vais pas demander pourquoi il était là. Je vais juste le garder." },
          ],
          effects: [{ kind: "item", id: "badge" }, step("badge")],
        };
      return { lines: [{ who: "", text: "La benne. Elle sent la frite froide et le mystère." }] };
    case "portail":
      if (flag(r, "portail")) return { lines: [{ who: "", text: "Le portail de la station est ouvert. Ça bourdonne là-dedans." }] };
      if (has(r, "badge"))
        return {
          lines: [
            { who: "", text: "Tu passes le badge devant le lecteur… BIP ! Le portail s'ouvre en grinçant." },
            { who: S, text: "Je me sens comme un agent secret. Un agent secret en jogging." },
          ],
          effects: [{ kind: "flag", id: "portail" }],
        };
      return { lines: [{ who: "", text: "« ACCÈS RÉSERVÉ AU PERSONNEL DE MAINTENANCE ». Un lecteur de badge clignote, impatient." }] };
    case "transfo":
      if (fini(r)) return { lines: [{ who: "", text: "Le transformateur ronronne doucement, apaisé. Pour l'instant." }] };
      if (d(r, "nico") && d(r, "horloges") && d(r, "badge"))
        return {
          lines: [{ who: S, text: "Bon. Le gros truc qui bourdonne en violet. Si quelque chose a cassé le temps, c'est forcément lui." }],
          cutscene: "evenement",
        };
      return {
        lines: [
          { who: "", text: "Le transformateur ronronne. Une lueur violette s'échappe des grilles." },
          { who: S, text: "Je ne sais pas encore ce que je cherche… Les gens du quartier savent peut-être quelque chose." },
        ],
      };
    case "barriere":
      if (text === "TRAVAUX") return { lines: [{ who: "", text: "« TRAVAUX ». Depuis 23:59. Pour toujours, a priori." }] };
      if (fini(r))
        return {
          lines: [
            { who: "", text: "La barrière s'est levée. Au loin, les lumières du Centre-ville clignotent…" },
            { who: "", text: "Une odeur de friture flotte dans l'air. CHAPITRE 2 — LA CITÉ DES FRITES PERDUES." },
          ],
        };
      return { lines: [{ who: "", text: "Route barrée : « ANOMALIE EN COURS — CENTRE-VILLE INACCESSIBLE »." }] };
    case "panneau":
      return { lines: [{ who: "", text: text === "DANGER" ? "« DANGER — HAUTE TENSION — ET HAUTE ÉTRANGETÉ »." : `« ${text ?? "…"} »` }] };
    case "boite":
      return { lines: [{ who: S, text: "Ma boîte aux lettres. Une pub pour une salle de sport. Le destin me parle." }] };
    case "fontaine":
      return {
        lines: [
          { who: "", text: "L'eau de la fontaine tombe… au ralenti. Une goutte reste suspendue en l'air." },
          { who: S, text: "Je la pousse du doigt. Elle ne bouge pas. Elle a l'air vexée." },
        ],
      };
    case "banc":
      return { lines: [{ who: S, text: "Un banc. Je m'assieds deux secondes. Le banc aussi a l'air d'attendre minuit." }] };
    case "poubelle":
      return { lines: [{ who: "", text: "Une poubelle. Dedans : un sandwich figé en pleine chute." }] };
    case "affiche":
      return { lines: [{ who: "", text: "« CHAT PERDU. S'appelle Minuit. Ne vient jamais quand on l'appelle. Évidemment. »" }] };
    case "velo":
      return { lines: [{ who: S, text: "Mon vélo. Pneu à plat depuis 2019. Une valeur sûre." }] };
    case "route":
      if (!fini(r)) return { lines: [{ who: "", text: "Route barrée : « ANOMALIE EN COURS — CENTRE-VILLE INACCESSIBLE »." }] };
      if (!r.party.includes("chevalier"))
        return { lines: [{ who: "", text: "Une silhouette en armure noire attend près de la barrière levée. Elle a l'air de vouloir te parler. Avec beaucoup de solennité." }] };
      return { lines: [{ who: CHEVALIER, text: "Le soldat légume nous barre la route. Il faudra passer sur son… sur ses feuilles." }] };
  }
  return null;
}

/** La scène finale de la quête, jouée au transformateur. */
export function evenement(): Conversation {
  return {
    lines: [
      { who: "", text: "Le transformateur s'emballe. Toutes les horloges du quartier clignotent en même temps : 23:59… 23:59… 23:59…" },
      { who: INCONNU, text: "Alors c'est toi. Le seul qui bouge encore dans ce quartier." },
      { who: S, text: "Bouger, c'est un grand mot. J'ai surtout marché jusqu'ici. C'est déjà beaucoup pour moi." },
      { who: INCONNU, text: "Le temps de ce quartier s'est brisé. Les morceaux se sont éparpillés. Celui-ci bloquait la station." },
      { who: "", text: "Une lueur violette jaillit du transformateur et se pose dans la main de Sparrow." },
      { who: INCONNU, text: "Un fragment d'horloge. Garde-le. Tant qu'il en manquera, la nuit ne finira pas vraiment." },
      { who: S, text: "Et vous êtes qui, au juste ? Le gardien des minutes ? Le technicien qui a perdu son badge ?" },
      { who: INCONNU, text: "Quelqu'un qui attend minuit depuis très longtemps. On se reverra au Centre-ville, Sparrow." },
      { who: "", text: "Les horloges passent à 00:00… et s'y arrêtent. Une seule minute a passé. Mais au bout de la rue, la barrière du Centre-ville s'est levée." },
    ],
    effects: [step("sortir"), step("explorer"), step("station"), step("evenement"), { kind: "flag", id: "inconnu-parti" }],
  };
}

// ─── Registre de tous les chapitres ───

const CH1: Chapter = {
  npcs: Object.fromEntries(Object.entries(NPC_TALK).map(([k, v]) => [`quartier:${k}`, v])),
  things: {},
};

const ALL: Chapter = { npcs: { ...CH1.npcs, ...CH2.npcs }, things: { ...CH1.things, ...CH2.things } };

/** Réplique d'un PNJ sur une carte. */
export function talkTo(id: string, r: Rpg, map = "quartier"): Conversation {
  const rules = ALL.npcs[`${map}:${id}`];
  return rules ? pick(rules, r) : { lines: [{ who: "", text: "…" }] };
}

const generic: Record<string, ThingTalk> = {
  panneau: (_r, text) => ({ lines: [{ who: "", text: `« ${text ?? "…"} »` }] }),
  pancarte: (_r, text) => ({ lines: [{ who: "", text: `« ${text ?? "…"} »` }] }),
  affiche: (_r, text) => ({ lines: [{ who: "", text: `« ${text ?? "…"} »` }] }),
  banc: () => ({ lines: [{ who: S, text: "Un banc. Je m'assieds deux secondes. Ça compte comme du repos." }] }),
  poubelle: () => ({ lines: [{ who: "", text: "Une poubelle. Rien d'utile. Rien de frit non plus." }] }),
  etagere: () => ({ lines: [{ who: "", text: "Des étagères bien rangées. Trop bien rangées." }] }),
  bibliotheque: () => ({ lines: [{ who: "", text: "Des livres de cuisine. Toutes les pages sur la friture ont été arrachées." }] }),
  tonneau: () => ({ lines: [{ who: "", text: "Un tonneau. Il sent le vinaigre." }] }),
  "lit-int": () => ({ lines: [{ who: S, text: "Un lit. Pas le mien. Je résiste à l'envie de faire une sieste." }] }),
  fontaine: () => ({ lines: [{ who: "", text: "L'eau de la fontaine coule tranquillement." }] }),
};

/** Texte d'un objet du décor sur une carte. `text` = inscription d'un panneau. */
export function examine(id: string, r: Rpg, text?: string, map = "quartier"): Conversation {
  const own = map === "quartier" ? examineQuartier(id, r, text) : (ALL.things[`${map}:${id}`]?.(r, text) ?? null);
  return own ?? ALL.things[`*:${id}`]?.(r, text) ?? generic[id]?.(r, text) ?? { lines: [{ who: "", text: "Rien de spécial." }] };
}

// ─── Moments scénarisés (arrivée sur une carte, après un combat) ───

/** Réplique à l'arrivée sur une carte (`first` = première visite). */
export function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  return CH2.arrival?.(map, r, first) ?? null;
}

/** Après une victoire. */
export function afterBattle(id: string, r: Rpg): Conversation | null {
  if (id === "eclaireur")
    return {
      lines: [
        { who: BROCOLI, text: "Impossible… vaincu par un humain en jogging… Le Roi… le Roi saura…" },
        { who: "", text: "Le Soldat Brocoli s'enfuit en roulant vers le Centre-ville." },
        { who: CHEVALIER, text: "Bien joué, Élu. Ta manette est aussi tranchante que ton sens de l'humour." },
        { who: CHEVALIER, text: "Après chaque combat, l'équipe reprend son souffle. Mais les objets utilisés, eux, ne reviennent pas. Garde tes frites." },
        { who: CHEVALIER, text: "La route est libre. La Cité des Frites Perdues nous attend, à l'est." },
      ],
      effects: [{ kind: "quest", id: "frites-perdues" }],
    };
  return CH2.afterBattle?.(id, r) ?? null;
}

/** Scène enchaînée après un dialogue (`then: { kind: "scene" }`). */
export const scene = (id: string): Conversation | null => CH2.scene(id);

/** Après un mini-jeu lancé depuis un dialogue. */
export const afterMinigame = (id: string, ok: boolean, r: Rpg): Conversation | null => CH2.afterMinigame(id, ok, r);

/** Étapes de quête liées à une zone (on y entre pour la première fois ou non). */
export function zoneEffects(zone: string): Effect[] {
  if (zone === "place") return [step("explorer")];
  if (zone === "station") return [step("station")];
  return CH2.zoneEffects(zone);
}

/** Titre de l'aventure. */
export const GAME_TITLE = "SPARROW : 23:59";
export const GAME_SUBTITLE = "L'Élu de la Minute";

/** Écran titre à l'ouverture d'un chapitre (première visite de sa carte). */
export function openingCard(map: string, r: Rpg): string[] | null {
  if (map === "quartier" && !d(r, "sortir")) return ["CHAPITRE 1 · LA VILLE FIGÉE", GAME_TITLE, GAME_SUBTITLE];
  if (map === "cite" && !r.done.includes("frites-perdues:route")) return ["CHAPITRE 2 · LA CITÉ DES FRITES PERDUES", GAME_TITLE, GAME_SUBTITLE];
  return null;
}

/** Carte de fin de chapitre (quêtes principales seulement). */
export function chapterCard(quest: string): string[] | null {
  if (quest === Q) return ["CHAPITRE 1 TERMINÉ", "LA VILLE FIGÉE", "+120 XP · +150 FP", "Objet : Fragment d'horloge n°1", "La barrière du Centre-ville s'est levée…"];
  if (quest === "frites-perdues") return CH2_CARD;
  return null;
}

/** Après une défaite (on s'est retiré pour se préparer). */
export function afterDefeat(id: string): Conversation | null {
  return {
    lines: [
      { who: S, text: id === "roi-salade" ? "Aïe. Ce roi a la feuille dure. Il me faut de meilleurs objets… ou de meilleures frites." : "Pfff. Je reviendrai. Avec un plan. Ou au moins avec des frites." },
    ],
  };
}
