/**
 * RPG — scénario : dialogues des PNJ et textes des objets, selon l'avancement de la quête.
 *
 * Système réutilisable : chaque PNJ ou objet a une liste de répliques conditionnelles ;
 * la première dont la condition est vraie est jouée (avec ses effets). Ajouter un PNJ =
 * ajouter une entrée dans `NPC_TALK` ; aucune fenêtre n'est codée à part.
 */

import type { NpcId, ObjectId } from "./quartier";
import { flag, has, isDone, status, type Effect, type Rpg } from "./quest";

export interface Line {
  who: string;
  text: string;
}

export interface Conversation {
  lines: Line[];
  effects?: Effect[];
  /** Scène scénarisée à jouer après le dialogue. */
  cutscene?: "evenement";
}

type Rule = { when?: (r: Rpg) => boolean; talk: (r: Rpg) => Conversation };

const Q = "ville-figee";
const d = (r: Rpg, step: string) => isDone(r, Q, step);
const fini = (r: Rpg) => status(r, Q) === "terminee";
const S = "Sparrow";
const step = (s: string): Effect => ({ kind: "step", quest: Q, step: s });

const NICO = "Nico le Livreur";
const BOUCHON = "Madame Bouchon";
const RAYMOND = "Raymond";
const INCONNU = "???";

export const NPC_TALK: Record<NpcId, Rule[]> = {
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
};

export function talkTo(id: NpcId, r: Rpg): Conversation {
  const rule = NPC_TALK[id].find((x) => !x.when || x.when(r))!;
  return rule.talk(r);
}

/** Textes des objets du décor. `text` = inscription d'un panneau. */
export function examine(id: ObjectId, r: Rpg, text?: string): Conversation {
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
            { who: "", text: "CHAPITRE 2 — LE CENTRE-VILLE : bientôt." },
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
  }
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
