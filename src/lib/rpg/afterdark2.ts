/**
 * RPG — AFTER DARK, suite : une quête clandestine par région (après chaque chapitre).
 *
 *   Cité (après le ch. 2)     « La dette de Papi Lardon »  — tripot derrière le bistrot fermé ;
 *   Mont (après le ch. 3)     « La salle du fond »         — faux labo de « jus » derrière le refuge ;
 *   Kyukei (après le ch. 4)   « Le Snack Sakura »          — karaoké racketté, à côté de l'auberge ;
 *   Tour (après le ch. 5)     « Le Tic-Tac Club »          — casino où l'on mise ses minutes.
 *
 * Chaque quête : une porte dérobée sur une façade, une pièce, trois méthodes (cogner, ruser,
 * trahir) aux conséquences persistantes (drapeaux « ad:… »), un petit secret. Rien ne touche
 * à l'histoire principale ; aucune sauvegarde n'est réinitialisée.
 */

import { makeMap, type Dest, type Ground, type MapDef, type MapId, type Warp } from "./mapdef";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

const S = "Sparrow";
const fl = (r: Rpg, f: string) => r.flags.includes(`ad:${f}`);
const has = (r: Rpg, i: string) => r.items.includes(i);
const ko = (r: Rpg, b: string) => r.flags.includes(`ko:ad-${b}`);
const set = (...f: string[]): Effect[] => f.map((id) => ({ kind: "flag", id: `ad:${id}` }));
const say = (who: string, text: string) => ({ who, text });
const conv = (lines: Conversation["lines"], effects?: Effect[], extra: Partial<Conversation> = {}): Conversation => ({ lines, effects, ...extra });
const step = (quest: string, s: string): Effect => ({ kind: "step", quest, step: s });
const fini = (r: Rpg, q: string) => r.quests[q] === "terminee";

function room(id: MapId, name: string, region: MapDef["region"], floor: Ground, exit: Dest) {
  const M = makeMap(id, name, 12, 9, region, floor);
  M.fill("mur", 0, 0, 11, 1);
  M.fill("mur", 0, 0, 0, 8);
  M.fill("mur", 11, 0, 11, 8);
  M.fill("mur", 0, 8, 11, 8);
  M.def.ground[8][5] = floor;
  M.def.warps.push({ id: "sortie", at: { x: 5, y: 8 }, dir: "down", to: exit });
  M.def.spawn = { x: 5, y: 7, dir: "up" };
  return M;
}

/** Porte dérobée sur une façade (case de bâtiment, on « frappe » en montant). */
function porte(id: string, map: MapId, x: number, y: number, to: MapId, needs: (r: Rpg) => boolean, text: string): { map: MapId; warp: Warp } {
  return { map, warp: { id, at: { x, y }, dir: "up", to: { map: to, x: 5, y: 7, dir: "up" }, needs, text } };
}

// ════════════════════════ 1. CITÉ — LA DETTE DE PAPI LARDON ════════════════════════

const Q1 = "dette-lardon";
const LARDON = "Papi Lardon";
const GRAS = "Gras-Double";
const LOULOU = "Loulou";
const s1 = (x: string) => step(Q1, x);
/** La dette est réglée (toutes les méthodes passent par là). */
const regle1 = (m: string, ...more: string[]): Effect[] => [...set("tl-regle", `tl-${m}`, ...more), s1("regler")];

function tripot(): MapDef {
  const M = room("tripot", "Le tripot du bistrot", "interieur", "parquet", { map: "cite", x: 32, y: 17, dir: "down" });
  M.add({ kind: "comptoir", x: 1, y: 3, w: 3, h: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "table", x: 6, y: 4, w: 2, h: 1 });
  M.add({ kind: "chaise", x: 5, y: 4, w: 1, h: 1 });
  M.add({ kind: "chaise", x: 8, y: 4, w: 1, h: 1 });
  M.add({ kind: "armoire", x: 10, y: 2, w: 1, h: 1, key: "tl-congel" });
  M.add({ kind: "tonneau", x: 10, y: 7, w: 1, h: 1 });
  M.add({ kind: "caisse", x: 1, y: 7, w: 1, h: 1 });
  M.add({ kind: "pancarte", x: 4, y: 2, w: 1, h: 1, text: "ICI, ON NE MANGE PAS LES FRITES. ON LES JOUE." });
  M.def.npcs.push(
    { id: "lardon", name: LARDON, char: "lardon", start: { x: 2, y: 6 }, dir: "right" },
    { id: "gras", name: GRAS, char: "gras-double", start: { x: 7, y: 3 }, dir: "down", when: (r) => !fl(r, "tl-poings") },
    { id: "jumeaux", name: "Les Jumeaux Mayo", char: "jumeau", start: { x: 9, y: 3 }, dir: "left", when: (r) => !ko(r, "jumeaux") },
    { id: "loulou", name: LOULOU, char: "loulou", start: { x: 2, y: 2 }, dir: "down" },
    { id: "comptable", name: "Le Comptable", char: "comptable", start: { x: 9, y: 6 }, dir: "left" },
  );
  return M.def;
}

const lardon: Rule[] = [
  { when: (r) => fl(r, "tl-trahison"), talk: () => conv([say(LARDON, "Tu as vendu ma recette. Cinquante ans de friture. Tu l'as vendue comme on vend un vélo volé.")]) },
  {
    when: (r) => fl(r, "tl-regle") && !fl(r, "tl-cadeau"),
    talk: (r) =>
      conv(
        [
          say(LARDON, fl(r, "tl-poings") ? "Tu as cogné Gras-Double ? Pour moi ? À mon âge, c'est le plus beau cadeau qu'on m'ait fait. Après le dentier." : "La dette est effacée ? Je ne veux pas savoir comment. Si : je veux savoir. Non. Ne me dis rien."),
          say(LARDON, "Tiens. Mes frites du diable. La recette ne sort pas de cette tête. Les frites, si."),
        ],
        [...set("tl-cadeau"), { kind: "bag", id: "frites-diable", n: 3 }],
      ),
  },
  { when: (r) => fl(r, "tl-regle"), talk: () => conv([say(LARDON, "Je vais rouvrir le bistrot. Le jour où il sera minuit et une. Donc bientôt. Ou jamais.")]) },
  {
    when: (r) => fl(r, "tl-mission"),
    talk: () => ({
      lines: [say(LARDON, "Tu as l'air gêné, petit. Tu veux une frite ?"), say(S, "Gras-Double veut ta recette. Contre ta dette.")],
      choices: [
        {
          label: "Prendre la recette (trahir)",
          next: conv(
            [say(LARDON, "…Prends-la. Elle est dans mon tablier. Prends aussi mon respect pour toi, il est dans le même tablier."), say("", "Papi Lardon tend un papier gras. Ses mains tremblent. Pas à cause de l'âge.")],
            [{ kind: "item", id: "recette-lardon" }],
          ),
        },
        { label: "Renoncer", next: conv([say(LARDON, "Garde ta frite, alors. Et ta conscience. Les deux se mangent froides.")]) },
      ],
    }),
  },
  {
    when: (r) => !fl(r, "tl-lardon"),
    talk: () =>
      conv(
        [
          say(LARDON, "Psst. Toi. Tu as une tête à aider les vieux. Ou à les voler. Dans le doute, je te parle."),
          say(LARDON, "J'ai joué ma friterie aux cartes contre Gras-Double. J'ai perdu. Je lui dois 500 FP. Ce soir, il me casse les doigts."),
          say(LARDON, "Un friteur sans doigts, c'est un homme qui regarde l'huile. Pour toujours."),
        ],
        [...set("tl-lardon"), s1("lardon")],
      ),
  },
  { talk: () => conv([say(LARDON, "Gras-Double est là-bas. Il a trois mentons et zéro pitié. Fais attention à ses mains, elles sentent l'intérêt composé.")]) },
];

const gras: Rule[] = [
  {
    when: (r) => fl(r, "tl-trahison"),
    talk: () => conv([say(GRAS, "Associé ! Tu veux une frite ? Non, je plaisante. Elles sont à moi maintenant. Tout est à moi. C'est beau.")]),
  },
  {
    when: (r) => has(r, "recette-lardon"),
    talk: () =>
      conv(
        [say(GRAS, "La recette du vieux… Tu es une ordure, petit. Bienvenue dans la famille."), say(GRAS, "La dette est effacée. Et voilà ma chevalière. Elle a appartenu à mon père. Il l'a perdue aux cartes. Contre moi.")],
        [{ kind: "drop", id: "recette-lardon" }, { kind: "gear", id: "chevaliere-grasse" }, ...regle1("trahison", "rep-crapule")],
      ),
  },
  { when: (r) => fl(r, "tl-regle"), talk: () => conv([say(GRAS, "Partie terminée. Le vieux ne me doit plus rien. Toi, tu me dois un sourire. Je le prendrai plus tard.")]) },
  {
    when: (r) => fl(r, "tl-mission"),
    talk: () => conv([say(GRAS, "La recette. Le vieux te la donnera : tu as une tête de gendre. Va.")]),
  },
  {
    when: (r) => !fl(r, "tl-lardon"),
    talk: () => conv([say(GRAS, "On ne parle pas au patron sans raison. On joue, on perd, on paie. Dans cet ordre. Dégage, sauf si tu as une raison.")]),
  },
  {
    talk: (r) => ({
      lines: [say(GRAS, "Le vieux Lardon t'envoie ? Il me doit 500. Je suis un homme d'affaires : je casse des doigts, mais avec un sourire.")],
      choices: [
        {
          label: "« Effaçons la dette. Avec mes poings. »",
          next: ko(r, "jumeaux")
            ? { lines: [say(GRAS, "Mes jumeaux sont par terre ? Bon. Je vais devoir me salir les mains. Je déteste ça : après, elles sentent l'honnêteté.")], then: { kind: "battle", id: "ad-gras-double" } }
            : conv([say(GRAS, "Avec tes poings ? Passe d'abord sur mes jumeaux. Ils sont deux, ils partagent un neurone, et le neurone est méchant.")]),
        },
        ...(has(r, "cartes-marquees")
          ? [
              {
                label: "« Une partie. La dette contre ma mise. »",
                next: conv(
                  [
                    say("", "Gras-Double distribue. Loulou, derrière lui, tousse deux fois. Sparrow pose quatre rois. Puis un cinquième."),
                    say(GRAS, "Cinq rois ? …C'est impossible. C'est mon jeu. Je triche avec ce jeu depuis vingt ans !"),
                    say(S, "Justement. Tu devrais le changer."),
                    say(GRAS, "Dette effacée. Mais je t'ai à l'œil. J'ai deux yeux, et tous les deux te détestent."),
                  ],
                  [{ kind: "drop", id: "cartes-marquees" }, { kind: "reward", xp: 60, coins: 180 }, ...regle1("cartes", "rep-crapule")],
                ),
              },
            ]
          : []),
        {
          label: "« Je peux travailler pour vous. »",
          next: conv([say(GRAS, "Enfin quelqu'un de raisonnable ! Ramène-moi la recette des frites du diable de Lardon. Il te la donnera, tu as une tête de petit-fils. Et sa dette, je l'oublie.")], set("tl-mission")),
        },
        { label: "Partir", next: conv([say(GRAS, "Reviens quand tu auras un plan. Ou de l'argent. Ou un dentiste.")]) },
      ],
    }),
  },
];

const T1: Record<string, Rule[]> = {
  "tripot:lardon": lardon,
  "tripot:gras": gras,
  "tripot:jumeaux": [
    {
      when: (r) => fl(r, "tl-lardon") && !fl(r, "tl-regle"),
      talk: () => ({ lines: [say("Jumeau Mayo", "On est jumeaux."), say("Jumeau Mayo", "Moi aussi."), say("Jumeau Mayo", "Le patron dit qu'on te tape. Alors on te tape. On réfléchit pas, ça fait mal à la tête.")], then: { kind: "battle", id: "ad-jumeaux" } }),
    },
    { talk: () => conv([say("Jumeau Mayo", "On garde le patron."), say("Jumeau Mayo", "Moi aussi.")]) },
  ],
  "tripot:loulou": [
    { when: (r) => fl(r, "tl-cartes"), talk: () => conv([say(LOULOU, "Ma moitié, je l'ai prise dans ta poche pendant que tu frimais. Sans rancune, chéri.")]) },
    { when: (r) => has(r, "cartes-marquees") || fl(r, "tl-regle"), talk: () => conv([say(LOULOU, "Je n'ai rien dit. Je ne dis jamais rien. C'est pour ça que je suis encore vivante.")]) },
    {
      when: (r) => fl(r, "tl-lardon"),
      talk: () => ({
        lines: [say(LOULOU, "Tu veux sauver le vieux sans te faire casser le nez ? J'ai un jeu marqué. Le même que celui de Gras-Double, mais en mieux."), say(LOULOU, "Ma commission : la moitié de ce que tu gagnes. Et tu ne m'as jamais vue.")],
        choices: [
          { label: "Prendre le jeu marqué", next: conv([say(LOULOU, "Tousse deux fois quand tu as besoin d'un roi. Moi je tousse tout le temps, ça couvre.")], [{ kind: "item", id: "cartes-marquees" }]) },
          { label: "Refuser", next: conv([say(LOULOU, "Un honnête homme. Il en reste. Ils ont tous des bleus.")]) },
        ],
      }),
    },
    { talk: () => conv([say(LOULOU, "Je distribue les cartes. Pas les conseils. Les conseils, c'est en option.")]) },
  ],
  "tripot:comptable": [
    { talk: () => conv([say("Le Comptable", "Je tiens les comptes de Gras-Double. Il y a des colonnes « dettes », « intérêts », et « doigts ». Je ne regarde jamais la troisième.")]) },
  ],
};

const TH1: Chapter["things"] = {
  "tripot:tl-congel": (r) =>
    fl(r, "tl-secret")
      ? conv([say("", "Le congélateur ronronne. Les frites congelées te regardent. Tu fermes doucement.")])
      : conv(
          [
            say("", "Dans le congélateur, entre deux sacs de frites, un carnet gelé. « Clients en retard : … LE ROI DE LA SALADE — 12 000 FP — ardoise de frites, depuis 3 ans. »"),
            say(S, "…Il a interdit les frites parce qu'il ne pouvait pas payer sa note. Évidemment."),
          ],
          [...set("tl-secret"), { kind: "reward", xp: 40, coins: 0 }],
        ),
};

// ════════════════════════ 2. MONT — LA SALLE DU FOND ════════════════════════

const Q2 = "salle-fond";
const BRIN = "Frère Brindille";
const DOC = "Docteur Créatine";
const s2 = (x: string) => step(Q2, x);
const regle2 = (m: string, ...more: string[]): Effect[] => [...set("lf-ferme", `lf-${m}`, ...more), s2("labo")];

function labo(): MapDef {
  const M = room("labo", "La salle du fond", "interieur", "carrelage", { map: "sentier", x: 19, y: 13, dir: "down" });
  M.add({ kind: "comptoir", x: 4, y: 3, w: 4, h: 1 });
  M.add({ kind: "etagere", x: 3, y: 2, w: 1, h: 1 });
  M.add({ kind: "etagere", x: 8, y: 2, w: 1, h: 1 });
  M.add({ kind: "armoire", x: 1, y: 2, w: 1, h: 1, key: "lf-frigo" });
  M.add({ kind: "banc-muscu", x: 8, y: 6, w: 2, h: 1 });
  M.add({ kind: "caisse", x: 1, y: 7, w: 1, h: 1 });
  M.add({ kind: "pancarte", x: 10, y: 2, w: 1, h: 1, text: "LA SCIENCE, C'EST DE LA MUSCU AVEC DES GANTS." });
  M.def.npcs.push(
    { id: "brindille", name: BRIN, char: "brindille", start: { x: 2, y: 5 }, dir: "right" },
    { id: "doc", name: DOC, char: "dr-creatine", start: { x: 6, y: 2 }, dir: "down", when: (r) => !fl(r, "lf-casse") && !fl(r, "lf-denonce") },
    { id: "biscotos", name: "Les Frères Biscotos", char: "biscoto", start: { x: 9, y: 3 }, dir: "left", when: (r) => !ko(r, "biscotos") && !fl(r, "lf-denonce") },
    { id: "rotule", name: "Frère Rotule", char: "rotule", start: { x: 10, y: 5 }, dir: "left" },
  );
  return M.def;
}

const T2: Record<string, Rule[]> = {
  "labo:brindille": [
    { when: (r) => fl(r, "lf-associe"), talk: () => conv([say(BRIN, "J'ai bu le jus. Je ne sens plus mes jambes. Mais je sens mes bras. Trop. Ils me parlent.")]) },
    {
      when: (r) => fl(r, "lf-ferme") && !fl(r, "lf-cadeau"),
      talk: () =>
        conv(
          [say(BRIN, "Plus de jus, plus de docteur. Je vais m'entraîner pour de vrai. Cent pompes par jour. Enfin, trois. Puis cent."), say(BRIN, "Prends mon bandeau. Il m'a porté chance. Enfin, il ne m'a pas porté malheur. C'est déjà ça.")],
          [...set("lf-cadeau"), { kind: "gear", id: "bandeau-brindille" }],
        ),
    },
    { when: (r) => fl(r, "lf-ferme"), talk: () => conv([say(BRIN, "Une pompe. Deux pompes. …Tu peux revenir plus tard ? Je suis à deux.")]) },
    {
      when: (r) => !fl(r, "lf-brindille"),
      talk: () =>
        conv(
          [
            say(BRIN, "Chut ! Je ne suis pas là. Un moine de la Confrérie n'achète pas de jus. Sauf moi. Parce que je suis maigre."),
            say(BRIN, "Le Docteur dit qu'avec son jus, je soulèverai le Gong en une semaine. Il veut 300 FP. Et il dit que les effets secondaires, c'est « du caractère »."),
          ],
          [...set("lf-brindille"), s2("brindille")],
        ),
    },
    { talk: () => conv([say(BRIN, "Tu crois que le jus est dangereux ? Le Docteur dit que non. Mais il le dit en reculant.")]) },
  ],
  "labo:doc": [
    { when: (r) => fl(r, "lf-associe"), talk: () => conv([say(DOC, "Associé ! Les ventes explosent. Les clients aussi, parfois. C'est le métier.")]) },
    { when: (r) => !fl(r, "lf-brindille"), talk: () => conv([say(DOC, "Consultation sans rendez-vous ? 80 FP. Le diagnostic est gratuit : tu es faible. L'ordonnance : mon jus.")]) },
    {
      talk: (r) => ({
        lines: [say(DOC, "Tu viens pour le petit Brindille ? Mon meilleur client. Il ne le sait pas encore."), say(S, "Ton jus, c'est quoi exactement ?"), say(DOC, "De la science. Et un peu de piment. Et un secret. Surtout le secret.")],
        choices: [
          {
            label: "Fermer le labo. De force.",
            next: ko(r, "biscotos")
              ? { lines: [say(DOC, "Mes Biscotos dorment ? Très bien. Je vais te faire une piqûre de rappel. Sur le crâne.")], then: { kind: "battle", id: "ad-creatine" } }
              : conv([say(DOC, "De force ? Les Frères Biscotos s'occupent des réclamations. Ils ont un bras chacun pour ça. Deux, même.")]),
          },
          {
            label: "« Associons-nous. Je vends ton jus au sommet. »",
            next: conv(
              [say(DOC, "Un commercial ! Enfin ! Tiens : ta part d'avance et deux échantillons. Ne lis pas l'étiquette, elle est triste."), say("", "Brindille, au fond, te regarde avec des yeux de chiot qu'on vient de vendre.")],
              [{ kind: "reward", xp: 60, coins: 220 }, { kind: "bag", id: "proteine-louche", n: 2 }, ...regle2("associe", "rep-crapule")],
            ),
          },
          { label: "Partir", next: conv([say(DOC, "Reviens quand tu veux. Je serai là. Le Mont aussi. Ton dos, je ne promets rien.")]) },
        ],
      }),
    },
  ],
  "labo:biscotos": [
    {
      when: (r) => fl(r, "lf-brindille") && !fl(r, "lf-ferme"),
      talk: () => ({ lines: [say("Frère Biscoto", "Tu touches au Docteur, tu touches à nos bras."), say("Frère Biscoto", "Et nos bras, on les a payés cher. En jus.")], then: { kind: "battle", id: "ad-biscotos" } }),
    },
    { talk: () => conv([say("Frère Biscoto", "On s'entraîne. On ne parle pas. Parler, ça muscle pas.")]) },
  ],
  "labo:rotule": [
    { when: (r) => fl(r, "lf-denonce"), talk: () => conv([say("Frère Rotule", "Les Frères ont chassé le Docteur jusqu'au col, en pyjama. C'était beau. On aurait dit une procession. Une procession qui court.")]) },
    {
      when: (r) => has(r, "registre-doc") && fl(r, "lf-brindille") && !fl(r, "lf-ferme"),
      talk: () => ({
        lines: [say(S, "Frère Rotule. Lis ça. Ton « jus », c'est de l'eau, du colorant et du piment. Le Docteur l'écrit lui-même."), say("Frère Rotule", "…De l'eau ? J'ai payé 2 000 FP pour de l'EAU ? J'ai des abdominaux d'eau ?!")],
        choices: [
          {
            label: "« Préviens la Confrérie. »",
            next: conv(
              [say("Frère Rotule", "FRÈRES ! AU LABO ! ON NOUS A VENDU DE L'EAU !"), say("", "Un grondement descend du temple. Le Docteur et ses Biscotos s'enfuient par la fenêtre, en laissant leurs blouses. Et leur dignité."), say("Frère Rotule", "Tiens, pour ta peine. Des vrais cornets. Pas du jus.")],
              [{ kind: "drop", id: "registre-doc" }, { kind: "bag", id: "mega-cornet", n: 2 }, { kind: "reward", xp: 80, coins: 0 }, ...regle2("denonce", "rep-honnete")],
            ),
          },
          { label: "Garder le registre pour l'instant", next: conv([say("Frère Rotule", "Je vais m'asseoir. Je me sens soudain très léger. Comme de l'eau.")]) },
        ],
      }),
    },
    { talk: () => conv([say("Frère Rotule", "Je ne suis pas là. Je suis au temple, en méditation. Profonde. Avec des haltères.")]) },
  ],
};

const TH2: Chapter["things"] = {
  "labo:lf-frigo": (r) =>
    has(r, "registre-doc") || fl(r, "lf-ferme")
      ? conv([say("", "Le frigo est vide. Il y reste une odeur de piment et de mensonge.")])
      : conv(
          [
            say("", "Dans le frigo, des fioles vertes et un registre. « JUS DU DOCTEUR : eau du torrent, colorant vert, piment. Prix : 300 FP. Coût : 0,02 FP. »"),
            say("", "Et en dessous : « Commande spéciale — Coach G. — 40 doses — URGENT »."),
            say(S, "Gonflax… Bien sûr. Même ses muscles étaient en promo."),
          ],
          [{ kind: "item", id: "registre-doc" }, ...set("lf-secret")],
        ),
};

const afterBattle2 = (id: string): Conversation | null => {
  if (id === "ad-biscotos") return conv([say("Frère Biscoto", "Mes bras… ils se dégonflent…"), say("Frère Biscoto", "C'était donc de l'air ? J'ai payé pour de l'AIR ?")]);
  if (id === "ad-creatine")
    return conv([say(DOC, "Mon labo… ma science… mes clients…"), say("", "Le Docteur ramasse ses fioles et s'enfuit vers le col, poursuivi par sa propre ordonnance."), say(BRIN, "Il est parti ? Alors je suis… normal ? Ça me va.")], regle2("casse", "rep-honnete"));
  return null;
};

// ════════════════════════ 3. KYUKEI — LE SNACK SAKURA ════════════════════════

const Q3 = "snack-sakura";
const FUMIKO = "Mama Fumiko";
const OYA = "Oyabun Tonkatsu";
const JIRO = "Jirō";
const s3 = (x: string) => step(Q3, x);
const regle3 = (m: string, ...more: string[]): Effect[] => [...set("ss-fini", `ss-${m}`, ...more), s3("racket")];

function snack(): MapDef {
  const M = room("snack", "Snack Sakura", "interieur", "parquet", { map: "village", x: 8, y: 8, dir: "down" });
  M.add({ kind: "comptoir", x: 1, y: 3, w: 3, h: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "platines", x: 6, y: 2, w: 2, h: 1 });
  M.add({ kind: "lampion", x: 9, y: 2, w: 1, h: 1 });
  M.add({ kind: "table", x: 8, y: 6, w: 2, h: 1 });
  M.add({ kind: "table", x: 2, y: 6, w: 2, h: 1 });
  M.add({ kind: "pancarte", x: 4, y: 2, w: 1, h: 1, text: "KARAOKÉ — UNE CHANSON = UN VERRE. DEUX CHANSONS = DEUX VERRES. TROIS = ON APPELLE TA MÈRE." });
  M.def.npcs.push(
    { id: "fumiko", name: FUMIKO, char: "fumiko", start: { x: 2, y: 2 }, dir: "down" },
    { id: "oyabun", name: OYA, char: "oyabun", start: { x: 6, y: 3 }, dir: "down", when: (r) => !fl(r, "ss-bagarre") && !fl(r, "ss-karaoke") },
    { id: "sushis", name: "Les Sushis de main", char: "sushi", start: { x: 9, y: 4 }, dir: "left", when: (r) => !ko(r, "sushis") && !fl(r, "ss-karaoke") },
    { id: "jiro", name: JIRO, char: "jiro", start: { x: 10, y: 6 }, dir: "left" },
  );
  return M.def;
}

/** Duel de karaoké : trois couplets de « La Ballade du Riz Froid ». */
function karaoke(n: number): Conversation {
  const rate = conv([say(OYA, "FAUX. Tu chantes comme un chat dans une friteuse. Reviens quand tu connaîtras tes classiques."), say(JIRO, "(Psst… viens me voir. Je connais la chanson. Je l'ai écrite.)")]);
  const Q: [string, string[], number][] = [
    ["« Le riz est froid, la nuit est noire… »", ["« …mais mon cœur est un bol tiède »", "« …et la sauce soja est en retard »", "« …comme mon ex »"], 0],
    ["« Je t'ai attendue sous les lampions… »", ["« …et j'ai attrapé un rhume »", "« …mille ans, ou peut-être un quart d'heure »", "« …avec des baguettes dans le nez »"], 1],
    ["« Et si demain n'arrive jamais… »", ["« …je mangerai le dessert d'abord »", "« …je chanterai plus fort »", "« …au moins il sera toujours ce soir »"], 2],
  ];
  if (n >= Q.length)
    return conv(
      [
        say("", "Sparrow tient la dernière note. Longtemps. Trop longtemps. Le néon grésille. Un lampion pleure."),
        say(OYA, "…Personne n'avait jamais fini ma chanson. Ma mère me la chantait. Avant de partir acheter du riz. Il y a quarante ans."),
        say(OYA, "Le Snack est libre. Je m'en vais. Tiens, mon saké : il a le goût de cette chanson."),
      ],
      [{ kind: "bag", id: "sake-oyabun", n: 2 }, { kind: "reward", xp: 120, coins: 0 }, ...regle3("karaoke", "rep-honnete")],
    );
  const [vers, opts, ok] = Q[n];
  return { lines: [say(OYA, vers)], choices: opts.map((label, i) => ({ label, next: i === ok ? karaoke(n + 1) : rate })) };
}

const T3: Record<string, Rule[]> = {
  "snack:fumiko": [
    { when: (r) => fl(r, "ss-racket"), talk: () => conv([say(FUMIKO, "Tu passes prendre l'enveloppe ? Elle est sur le comptoir. À côté de ma honte. Sers-toi des deux.")]) },
    {
      when: (r) => fl(r, "ss-fini") && !fl(r, "ss-cadeau"),
      talk: (r) =>
        conv(
          [say(FUMIKO, fl(r, "ss-bagarre") ? "Tu as cassé la figure de l'Oyabun dans MON snack. Merci. Ça faisait vingt ans que je rêvais de le faire avec le micro." : "Tu as fait pleurer l'Oyabun ? Avec SA chanson ? Tu es un monstre. Un monstre merveilleux."), say(FUMIKO, "Prends le micro d'or. Il frappe juste, et il chante faux. Comme toi.")],
          [...set("ss-cadeau"), { kind: "gear", id: "micro-or" }],
        ),
    },
    { when: (r) => fl(r, "ss-fini"), talk: () => conv([say(FUMIKO, "Ce soir, karaoké gratuit. Sauf pour Jirō. Jirō paie double, il chante triple.")]) },
    {
      when: (r) => !fl(r, "ss-fumiko"),
      talk: () =>
        conv(
          [
            say(FUMIKO, "Bienvenue au Snack Sakura. Ici, on chante pour oublier. Moi, j'oublie surtout de fermer."),
            say(FUMIKO, "Tous les soirs, l'Oyabun Tonkatsu chante la même chanson. Et après, il faut lui payer « sa chanson ». 200 FP. Sinon ses Sushis cassent un tabouret. Ou un client."),
          ],
          [...set("ss-fumiko"), s3("fumiko")],
        ),
    },
    { talk: () => conv([say(FUMIKO, "Un thé ? Un saké ? Une épaule pour pleurer ? L'épaule est en option, et elle est déjà prise par Jirō.")]) },
  ],
  "snack:oyabun": [
    { when: (r) => fl(r, "ss-racket"), talk: () => conv([say(OYA, "Mon collecteur préféré ! Tu as la voix d'une casserole et le cœur d'une enveloppe. J'aime ça.")]) },
    { when: (r) => !fl(r, "ss-fumiko"), talk: () => conv([say(OYA, "Silence. Je m'échauffe. Chaque note que tu me fais rater, je te la facture.")]) },
    {
      talk: (r) => ({
        lines: [say(OYA, "Tu veux parler de Fumiko ? Ici, on ne parle pas. On chante. Ou on saigne. Choisis ta tonalité.")],
        choices: [
          {
            label: "« On règle ça dehors. Enfin, dedans. »",
            next: ko(r, "sushis")
              ? { lines: [say(OYA, "Mes Sushis sont roulés ? Bien. Je vais te mettre en musique. Avec les poings.")], then: { kind: "battle", id: "ad-oyabun" } }
              : conv([say(OYA, "Mes Sushis de main d'abord. Ils sont frais. Et ils mordent.")]),
          },
          { label: "« Duel de karaoké. Si je gagne, tu pars. »", next: karaoke(0) },
          {
            label: "« Je peux collecter pour vous. »",
            next: conv(
              [say(OYA, "Un collecteur ! Ma voix et tes jambes, on va faire un tube. Tiens, ta première paie. Fumiko te paiera la suite.")],
              [{ kind: "reward", xp: 60, coins: 300 }, ...regle3("racket", "rep-crapule")],
            ),
          },
          { label: "Partir", next: conv([say(OYA, "Reviens au refrain. Tout le monde revient au refrain.")]) },
        ],
      }),
    },
  ],
  "snack:sushis": [
    {
      when: (r) => fl(r, "ss-fumiko") && !fl(r, "ss-fini"),
      talk: () => ({ lines: [say("Sushi de main", "Tu as regardé l'Oyabun de travers."), say("Sushi de main", "Il n'a pas de travers. Tu l'as donc regardé tout court. C'est pire.")], then: { kind: "battle", id: "ad-sushis" } }),
    },
    { talk: () => conv([say("Sushi de main", "On est là pour l'ambiance. L'ambiance, c'est nous.")]) },
  ],
  "snack:jiro": [
    {
      when: (r) => fl(r, "ss-fini"),
      talk: () => conv([say(JIRO, "Tu sais pourquoi je connais la chanson ? On l'a écrite ensemble, l'Oyabun et moi. Il y a quarante ans. Il prenait le refrain. Moi, les coups."), say(JIRO, "Je suis content qu'il soit parti. Je vais enfin chanter mon couplet.")], set("ss-secret")),
    },
    {
      when: (r) => fl(r, "ss-fumiko"),
      talk: () =>
        conv([
          say(JIRO, "*hic* La Ballade du Riz Froid… Je la connais par cœur. Écoute bien, je ne la chante qu'une fois. Puis deux. Puis jusqu'à la fermeture."),
          say(JIRO, "« Le riz est froid, la nuit est noire, mais mon cœur est un bol tiède… Je t'ai attendue sous les lampions, mille ans, ou peut-être un quart d'heure… »"),
          say(JIRO, "« …Et si demain n'arrive jamais, au moins il sera toujours ce soir. » *hic* C'est beau, hein ? C'est triste. C'est pareil."),
        ]),
    },
    { talk: () => conv([say(JIRO, "Je suis rōnin. Ça veut dire « sans maître ». Et sans portefeuille. Tu m'offres un verre ?")]) },
  ],
};

const afterBattle3 = (id: string): Conversation | null => {
  if (id === "ad-sushis") return conv([say("Sushi de main", "On est… roulés…"), say(FUMIKO, "Je vous mets dans une boîte, avec du gingembre.")]);
  if (id === "ad-oyabun") return conv([say(OYA, "Ma voix… ma belle voix…"), say("", "L'Oyabun ramasse sa veste et sort sans chanter. Pour la première fois en quarante ans, le Snack est silencieux. Puis tout le monde applaudit.")], regle3("bagarre", "rep-honnete"));
  return null;
};

// ════════════════════════ 4. TOUR — LE TIC-TAC CLUB ════════════════════════

const Q4 = "tic-tac";
const VEUVE = "La Veuve du Cadran";
const JOUEUR = "Monsieur Encore-Une";
const s4 = (x: string) => step(Q4, x);
const regle4 = (m: string, ...more: string[]): Effect[] => [...set("tt-fini", `tt-${m}`, ...more), s4("banque")];

function casino(): MapDef {
  const M = room("casino", "Le Tic-Tac Club", "palais", "tapis", { map: "tour-parvis", x: 8, y: 7, dir: "down" });
  M.add({ kind: "table", x: 5, y: 4, w: 2, h: 1 });
  M.add({ kind: "table", x: 8, y: 6, w: 2, h: 1 });
  M.add({ kind: "comptoir", x: 9, y: 3, w: 2, h: 1 });
  M.add({ kind: "coffre", x: 1, y: 2, w: 1, h: 1, key: "tt-coffre", on: (r) => fl(r, "tt-secret") });
  M.add({ kind: "pancarte", x: 3, y: 2, w: 1, h: 1, text: "ICI, ON NE MISE QUE SON TEMPS. LA MAISON GAGNE TOUJOURS. LA MAISON, C'EST ELLE." });
  M.def.npcs.push(
    { id: "veuve", name: VEUVE, char: "veuve", start: { x: 6, y: 3 }, dir: "down", when: (r) => !fl(r, "tt-casse") && !fl(r, "tt-roulette") },
    { id: "pendules", name: "Les Videurs Pendule", char: "pendule", start: { x: 8, y: 2 }, dir: "down", when: (r) => !ko(r, "pendules") },
    { id: "joueur", name: JOUEUR, char: "joueur", start: { x: 2, y: 5 }, dir: "right" },
    { id: "tic", name: "Tic, le barman", char: "tic", start: { x: 10, y: 2 }, dir: "down" },
  );
  return M.def;
}

const T4: Record<string, Rule[]> = {
  "casino:joueur": [
    { when: (r) => fl(r, "tt-associe"), talk: () => conv([say(JOUEUR, "23:58. Toujours 23:58. Il me manque une minute pour arriver à minuit. Tu me l'as reprise. Merci quand même.")]) },
    {
      when: (r) => fl(r, "tt-fini"),
      talk: () => conv([say(JOUEUR, "23:59 ! J'ai retrouvé ma minute ! Je vais en faire quelque chose de bien. Ou la rejouer. Non. Quelque chose de bien. Probablement.")]),
    },
    {
      when: (r) => !fl(r, "tt-joueur"),
      talk: () =>
        conv(
          [
            say(JOUEUR, "Une dernière. Juste une dernière… Oh. Bonsoir. Je joue mes minutes. Ici, c'est la seule monnaie."),
            say(JOUEUR, "J'ai tout perdu. Il me restait 23:59, j'ai misé la dernière minute. Maintenant je suis bloqué à 23:58. Pour toujours. Tu sais ce que c'est, d'être en retard sur un monde figé ?"),
          ],
          [...set("tt-joueur"), s4("joueur")],
        ),
    },
    { talk: () => conv([say(JOUEUR, "La Veuve garde ma minute dans son coffre. Avec celles des autres. Elle dit qu'elle les collectionne. Comme des papillons. Morts.")]) },
  ],
  "casino:veuve": [
    { when: (r) => fl(r, "tt-associe"), talk: () => conv([say(VEUVE, "Mon associé. Tu gardes la porte et je garde les minutes. Un couple parfait. Ne tombe pas amoureux.")]) },
    { when: (r) => !fl(r, "tt-joueur"), talk: () => conv([say(VEUVE, "Faites vos jeux, mon chou. Ou faites demi-tour. Les deux me rapportent.")]) },
    {
      talk: (r) => ({
        lines: [say(VEUVE, "Tu veux la minute de ce pauvre homme ? Elle est à moi. Tout ce qui tombe sur mon tapis est à moi. Toi aussi, si tu tombes.")],
        choices: [
          {
            label: "« Je viens casser la banque. »",
            next: ko(r, "pendules")
              ? { lines: [say(VEUVE, "Mes Pendules ont cessé de battre ? Dommage. Je vais devoir jouer moi-même. Je ne perds jamais quand je joue moi-même.")], then: { kind: "battle", id: "ad-veuve" } }
              : conv([say(VEUVE, "Casser la banque ? Passe d'abord mes Pendules. Ils ont une seule qualité : ils reviennent toujours.")]),
          },
          {
            label: "« Tout sur un numéro. Sa minute contre la mienne. »",
            next: {
              lines: [say(VEUVE, "Oh, un joueur. Choisis, mon chou. La bille tourne.")],
              choices: [
                { label: "Rouge", next: conv([say(VEUVE, "Noir. Quel dommage. Je te laisse rejouer. Par pur sadisme.")]) },
                { label: "Noir", next: conv([say(VEUVE, "Rouge. Quelle tristesse. Rejoue, j'adore te voir perdre.")]) },
                { label: "Le 23", next: conv([say(VEUVE, "Le 22. Presque. Ici, « presque », c'est ce qu'on grave sur les tombes.")]) },
                {
                  label: "Le zéro",
                  next: conv(
                    [
                      say("", "La bille tourne, tourne… et s'arrête sur le zéro. Le seul chiffre qui ne bouge jamais dans une ville où il est toujours minuit."),
                      say(VEUVE, "…Le zéro. Qui t'a dit ? Tic ? Je vais faire de Tic un Tac."),
                      say(VEUVE, "Prends sa minute. Et prends la caisse, je ne supporte pas de la voir après ça. Le club est fermé."),
                    ],
                    [{ kind: "reward", xp: 160, coins: 400 }, ...regle4("roulette", "rep-honnete")],
                  ),
                },
              ],
            },
          },
          {
            label: "« Associons-nous. »",
            next: conv(
              [
                say(VEUVE, "Enfin quelqu'un qui comprend le temps. Il ne se gagne pas : il se prend. Tiens, ton premier pourcentage. Et ce dé : il tombe toujours bien. Presque."),
                say("", "Au fond, Monsieur Encore-Une regarde sa montre. Elle indique toujours 23:58."),
              ],
              [{ kind: "reward", xp: 80, coins: 350 }, { kind: "gear", id: "de-pipe" }, ...regle4("associe", "rep-crapule")],
            ),
          },
          { label: "Partir", next: conv([say(VEUVE, "Reviens, mon chou. Tout le monde revient. C'est le principe d'une horloge.")]) },
        ],
      }),
    },
  ],
  "casino:pendules": [
    {
      when: (r) => fl(r, "tt-joueur") && !fl(r, "tt-fini"),
      talk: () => ({ lines: [say("Videur Pendule", "Tic."), say("Videur Pendule", "Tac."), say("Videur Pendule", "Ça veut dire « dégage », en pendule.")], then: { kind: "battle", id: "ad-pendules" } }),
    },
    { talk: () => conv([say("Videur Pendule", "Tic."), say("Videur Pendule", "…Tac.")]) },
  ],
  "casino:tic": [
    { when: (r) => fl(r, "tt-fini"), talk: () => conv([say("Tic", "…"), say("", "Tic essuie un verre et te fait un clin d'œil. Puis un deuxième. Il a un tic.")]) },
    {
      when: (r) => fl(r, "tt-joueur"),
      talk: () =>
        conv([
          say("Tic", "Je ne parle jamais. Mais toi, tu as l'air d'avoir besoin d'un conseil."),
          say("Tic", "Dans une ville où il est toujours minuit, la bille ne tombe que sur ce qui ne bouge pas. Pense à l'heure qu'il est vraiment. Pas minuit moins une. L'autre."),
        ]),
    },
    { talk: () => conv([say("Tic", "…"), say("", "Tic te sert un verre d'eau. Il le facture une minute.")]) },
  ],
};

const TH4: Chapter["things"] = {
  "casino:tt-coffre": (r) =>
    !fl(r, "tt-fini") || fl(r, "tt-associe")
      ? conv([say("", "Un coffre noir. Il fait tic-tac. Il est fermé, et il le sait.")])
      : fl(r, "tt-secret")
        ? conv([say("", "Le coffre est vide. Toutes les minutes sont rentrées chez elles.")])
        : conv(
            [
              say("", "Le coffre s'ouvre. Des centaines de petites minutes s'envolent comme des lucioles et filent vers la ville."),
              say("", "Au fond, une dernière fiche : « SPARROW — mise : 1 minute — perdue — il y a très longtemps. »"),
              say(S, "…Je n'ai jamais mis les pieds ici. Je crois. Non. Je ne veux pas savoir."),
            ],
            [...set("tt-secret"), { kind: "reward", xp: 60, coins: 0 }],
          ),
};

const afterBattle4 = (id: string): Conversation | null => {
  if (id === "ad-pendules") return conv([say("Videur Pendule", "Tic… tic… tic…"), say("", "Ils s'arrêtent. Quelqu'un, quelque part, a oublié de les remonter.")]);
  if (id === "ad-veuve")
    return conv([say(VEUVE, "Les jeux… sont faits…"), say("", "La Veuve laisse tomber son éventail. Les cartes s'envolent. Elle disparaît derrière le rideau, dans un bruit de roulette qui ralentit."), say(JOUEUR, "Ma minute ! Elle revient ! Je l'entends !")], [
      { kind: "gear", id: "jeton-minuit" },
      ...regle4("casse", "rep-honnete"),
    ]);
  return null;
};

// ════════════════════════ ASSEMBLAGE ════════════════════════

export const AD2_MAPS: MapDef[] = [tripot(), labo(), snack(), casino()];

export const AD2_QUESTS = [Q1, Q2, Q3, Q4];

/** Portes dérobées, ouvertes une fois le chapitre de la région terminé. */
export const AD2_DOORS = [
  porte("ad-tripot", "cite", 32, 16, "tripot", (r) => fini(r, "frites-perdues"), "Une petite porte de service, derrière le bistrot fermé. On entend des cartes qu'on bat, et quelqu'un qui pleure. Pas maintenant."),
  porte("ad-labo", "sentier", 19, 12, "labo", (r) => fini(r, "confrerie"), "Une porte sans poignée à l'arrière du refuge. Ça sent le piment et la sueur. Une voix crie « SÉRIE SUIVANTE ! ». Plus tard."),
  porte("ad-snack", "village", 8, 7, "snack", (r) => fini(r, "samourai"), "Une porte coulissante, un néon rose : « SNACK SAKURA — FERMÉ ». Derrière, quelqu'un massacre une ballade. Plus tard."),
  porte("ad-casino", "tour-parvis", 8, 6, "casino", (r) => fini(r, "minuit"), "Une porte dérobée dans le mur de la Tour. Un judas s'ouvre : « Pas ce soir. » Il se referme. Il est pourtant toujours ce soir."),
];

const arrival = (map: string, _r: Rpg, first: boolean): Conversation | null => {
  if (!first) return null;
  if (map === "tripot")
    return conv([say("", "Derrière le bistrot fermé, un tripot enfumé. Des frites servent de jetons. Personne ne les mange : c'est mauvais pour les affaires."), say(S, "Une salle de jeu clandestine. Dans une ville où les frites sont interdites. Évidemment.")], [{ kind: "quest", id: Q1 }, s1("entrer")]);
  if (map === "labo")
    return conv([say("", "Une salle carrelée, des néons verts, des fioles qui bouillonnent. Ça sent le piment, la sueur et l'escroquerie."), say(S, "Un labo de muscles en contrebande. La Confrérie a vraiment tous les vices.")], [{ kind: "quest", id: Q2 }, s2("entrer")]);
  if (map === "snack")
    return conv([say("", "Lampions roses, fumée, un écran de karaoké qui affiche les paroles en retard. Au micro, un homme en costume crème chante faux avec une conviction terrifiante."), say(S, "Le genre d'endroit où on entre pour un verre et où on ressort avec un secret. Ou sans dents.")], [{ kind: "quest", id: Q3 }, s3("entrer")]);
  if (map === "casino")
    return conv([say("", "Velours, lustres, et des tables où l'on ne mise pas d'argent mais des minutes, rangées dans de petites fioles qui font tic-tac."), say(S, "Un casino du temps. Dans une ville où le temps est en panne. C'est soit génial, soit très, très mauvais.")], [{ kind: "quest", id: Q4 }, s4("entrer")]);
  return null;
};

const afterBattle = (id: string): Conversation | null => {
  if (id === "ad-jumeaux") return conv([say("Jumeau Mayo", "Aïe."), say("Jumeau Mayo", "Moi aussi.")]);
  if (id === "ad-gras-double")
    return conv(
      [say(GRAS, "D'accord ! D'accord ! La dette est effacée ! Et mes mentons aussi, presque !"), say("", "Gras-Double s'enfuit par la porte de service en laissant son tablier. Le tripot applaudit. Les jetons-frites aussi, un peu.")],
      regle1("poings", "rep-honnete"),
    );
  return afterBattle2(id) ?? afterBattle3(id) ?? afterBattle4(id);
};

export const AD2: Chapter = { npcs: { ...T1, ...T2, ...T3, ...T4 }, things: { ...TH1, ...TH2, ...TH4 }, arrival, afterBattle };
