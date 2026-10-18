/**
 * RPG — AFTER DARK : contenus adultes facultatifs (humour noir, combats clandestins, choix moraux).
 *
 * Première quête : « Dernier verre avant minuit » (Quartier 404, après le chapitre 1).
 *   Entrée : un escalier dans la Ruelle du Chat → le bar clandestin LE DERNIER VERRE.
 *   Dédé, le pochtron, prétend savoir pourquoi l'horloge est bloquée. Il ne parlera que si le
 *   tournoi truqué de la cave tombe. Trois façons de le faire tomber :
 *     1. LE RING : s'inscrire et battre Kevin, Bertrand, Sœur Ginette puis BIG MAMA KIKI ;
 *     2. LE VIDEUR : acheter Bulldozer avec le Château Pétrole 1987, ou le mettre K.O. ;
 *     3. LES PREUVES : la seringue (bar) + le carnet de Tarif (La Fouine), puis DÉNONCER
 *        Tarif devant tout le bar… ou le FAIRE CHANTER.
 *   Dédé avoue ensuite qu'il a menti — mais son mensonge mène à un vrai secret : une montre
 *   maudite dans l'ancien local technique de la cave.
 * Conséquences persistantes (drapeaux « ad:… » dans la sauvegarde) : réputation, commerces
 * ouverts ou fermés, répliques des PNJ. Rien ne bloque l'histoire principale.
 */

import { makeMap, type Dest, type Ground, type MapDef, type MapId } from "./mapdef";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

export const AD_QUEST = "dernier-verre";
const S = "Sparrow";
const MOMO = "Momo";
const DEDE = "Dédé";
const BULL = "Bulldozer";
const FOUINE = "La Fouine";
const TARIF = "Monsieur Tarif";
const KIKI = "BIG MAMA KIKI";

const fl = (r: Rpg, f: string) => r.flags.includes(`ad:${f}`);
const has = (r: Rpg, i: string) => r.items.includes(i);
const ko = (r: Rpg, b: string) => r.flags.includes(`ko:ad-${b}`);
const set = (...f: string[]): Effect[] => f.map((id) => ({ kind: "flag", id: `ad:${id}` }));
const step = (s: string): Effect => ({ kind: "step", quest: AD_QUEST, step: s });
const say = (who: string, text: string) => ({ who, text });
const conv = (lines: Conversation["lines"], effects?: Effect[], extra: Partial<Conversation> = {}): Conversation => ({ lines, effects, ...extra });
const fini = (r: Rpg) => fl(r, "tournoi-fini");
const chantage = (r: Rpg) => fl(r, "m-chantage");

/** Le tournoi tombe (toutes les méthodes passent par là). */
const tombe = (methode: string, ...more: string[]): Effect[] => [...set("tournoi-fini", "acces-cave", `m-${methode}`, ...more), step("tournoi")];

// ═══════════════════════════════ CARTES ═══════════════════════════════

function room(id: MapId, name: string, w: number, h: number, region: MapDef["region"], floor: Ground) {
  const M = makeMap(id, name, w, h, region, floor);
  M.fill("mur", 0, 0, w - 1, 1);
  M.fill("mur", 0, 0, 0, h - 1);
  M.fill("mur", w - 1, 0, w - 1, h - 1);
  M.fill("mur", 0, h - 1, w - 1, h - 1);
  return M;
}

function bar(): MapDef {
  const M = room("bar", "Le Dernier Verre", 14, 10, "interieur", "parquet");
  M.def.ground[9][6] = "parquet";
  M.def.warps.push(
    { id: "sortie", at: { x: 6, y: 9 }, dir: "down", to: { map: "quartier", x: 19, y: 4, dir: "down" } },
    // La porte de la cave, gardée par Bulldozer
    { id: "cave", at: { x: 11, y: 1 }, dir: "up", to: { map: "cave", x: 2, y: 2, dir: "down" }, needs: (r) => fl(r, "acces-cave"), lockedKey: "porte-cave" },
  );
  M.def.spawn = { x: 6, y: 8, dir: "up" };
  M.add({ kind: "comptoir", x: 2, y: 3, w: 6, h: 1 });
  M.add({ kind: "etagere", x: 1, y: 2, w: 1, h: 1 });
  M.add({ kind: "etagere", x: 7, y: 2, w: 1, h: 1 });
  M.add({ kind: "pancarte", x: 5, y: 2, w: 1, h: 1, text: "PAS DE BAGARRE AVANT MINUIT. (IL EST MINUIT MOINS UNE.)" });
  M.add({ kind: "table", x: 9, y: 6, w: 2, h: 1 });
  M.add({ kind: "chaise", x: 11, y: 6, w: 1, h: 1 });
  M.add({ kind: "table", x: 2, y: 7, w: 2, h: 1 });
  M.add({ kind: "chaise", x: 4, y: 7, w: 1, h: 1 });
  M.add({ kind: "tonneau", x: 12, y: 8, w: 1, h: 1, key: "ad-tonneau" });
  M.add({ kind: "caisse", x: 1, y: 8, w: 1, h: 1 });
  M.def.npcs.push(
    { id: "momo", name: MOMO, char: "momo", start: { x: 4, y: 2 }, dir: "down" },
    { id: "dede", name: DEDE, char: "dede", start: { x: 8, y: 3 }, dir: "left" },
    { id: "bulldozer", name: BULL, char: "bulldozer", start: { x: 11, y: 2 }, dir: "down", when: (r) => !fl(r, "acces-cave") },
    { id: "bulldozer", name: BULL, char: "bulldozer", start: { x: 12, y: 2 }, dir: "left", when: (r) => fl(r, "acces-cave") },
    { id: "fouine", name: FOUINE, char: "fouine", start: { x: 12, y: 4 }, dir: "left", watch: true },
    { id: "josiane", name: "Josiane", char: "josiane", start: { x: 6, y: 6 }, dir: "down", path: [{ x: 6, y: 6 }, { x: 7, y: 6 }], pause: 2.4 },
    { id: "habitue", name: "L'Habitué", char: "habitue", start: { x: 2, y: 5 }, dir: "right" },
  );
  return M.def;
}

function cave(): MapDef {
  const M = room("cave", "La Cave", 16, 11, "egout", "dalle");
  M.fill("tapis", 5, 4, 10, 7);
  M.def.warps.push(
    { id: "escalier", at: { x: 2, y: 1 }, dir: "up", to: { map: "bar", x: 10, y: 2, dir: "down" } },
    { id: "local", at: { x: 13, y: 1 }, dir: "up", to: { map: "local", x: 3, y: 4, dir: "up" }, needs: (r) => has(r, "cle-local"), lockedKey: "porte-local" },
  );
  M.def.spawn = { x: 2, y: 2, dir: "down" };
  for (const [x, y] of [
    [4, 3],
    [11, 3],
    [4, 8],
    [11, 8],
  ])
    M.add({ kind: "brasero", x, y, w: 1, h: 1 });
  M.add({ kind: "banc", x: 1, y: 6, w: 2, h: 1 });
  M.add({ kind: "banc", x: 13, y: 6, w: 2, h: 1 });
  M.add({ kind: "caisse", x: 14, y: 9, w: 1, h: 1 });
  M.add({ kind: "tonneau", x: 1, y: 9, w: 1, h: 1 });
  M.add({ kind: "pancarte", x: 7, y: 2, w: 1, h: 1, text: "RÈGLE N°1 : ON NE PARLE PAS DE LA CAVE. RÈGLE N°2 : KIKI GAGNE." });
  M.def.npcs.push(
    { id: "tarif", name: TARIF, char: "tarif", start: { x: 8, y: 3 }, dir: "down", when: (r) => !fini(r) || fl(r, "m-ring") },
    { id: "kevin", name: "Kevin", char: "kevin", start: { x: 3, y: 5 }, dir: "right" },
    { id: "bertrand", name: "Le Gros Bertrand", char: "bertrand", start: { x: 13, y: 4 }, dir: "left" },
    { id: "ginette", name: "Sœur Ginette", char: "ginette", start: { x: 13, y: 8 }, dir: "left" },
    { id: "kiki", name: KIKI, char: "kiki", start: { x: 8, y: 9 }, dir: "up", watch: true },
  );
  return M.def;
}

function local(): MapDef {
  const M = room("local", "Ancien local technique", 8, 6, "egout", "dalle");
  M.def.ground[5][3] = "dalle";
  M.def.warps.push({ id: "sortie", at: { x: 3, y: 5 }, dir: "down", to: { map: "cave", x: 13, y: 2, dir: "down" } });
  M.def.spawn = { x: 3, y: 4, dir: "up" };
  M.add({ kind: "coffre", x: 4, y: 2, w: 1, h: 1, key: "ad-coffre", on: (r) => fl(r, "coffre") });
  M.add({ kind: "armoire", x: 1, y: 2, w: 1, h: 1, key: "ad-miroir" });
  M.add({ kind: "grille", x: 6, y: 2, w: 1, h: 1, key: "ad-grille" });
  return M.def;
}

export const AD_MAPS: MapDef[] = [bar(), cave(), local()];

/** Entrée du bar dans le Quartier 404 (escalier de la Ruelle du Chat), ouverte après le chapitre 1. */
export const BAR_DOOR = {
  id: "dernier-verre",
  at: { x: 19, y: 3 },
  dir: "up" as const,
  to: { map: "bar", x: 6, y: 8, dir: "up" } as Dest,
  needs: (r: Rpg) => r.quests["ville-figee"] === "terminee",
  text: "Un escalier descend vers une porte rouge. Néon : « LE DERNIER VERRE — FERMÉ ». Derrière, quelqu'un hurle « IL EST MINUIT MOINS UNE, BANDE DE LÂCHES ! ». Revenir plus tard.",
};

// ═══════════════════════════════ PNJ ═══════════════════════════════

const momo: Rule[] = [
  {
    when: chantage,
    talk: () =>
      conv([
        say(MOMO, "Je ne sers pas les maîtres chanteurs."),
        say(MOMO, "Enfin si. Mais je crache dedans. Et je te le dis, parce que j'ai une éthique."),
      ]),
  },
  {
    when: (r) => fl(r, "m-denonce") && !fl(r, "momo-cadeau"),
    talk: () =>
      conv(
        [
          say(MOMO, "Le héros du quartier ! Grâce à toi, ma cave sert enfin à stocker des patates, comme Dieu l'a voulu."),
          say(MOMO, "Tiens. Trois gnôles maison. Si t'es aveugle demain, c'est que c'était de la bonne."),
          say(MOMO, "Et un truc que je dis à personne : y a un client qui vient chaque nuit. Il commande jamais. Il regarde l'horloge. Il a ta dégaine. Exactement ta dégaine. Ça m'a toujours foutu les jetons."),
        ],
        [...set("momo-cadeau", "info-habitue"), { kind: "bag", id: "gnole-maison", n: 3 }],
      ),
  },
  {
    when: (r) => !fini(r) && has(r, "seringue") && has(r, "carnet-tarif"),
    talk: () => ({
      lines: [
        say(S, "Momo. Regarde ça. La seringue de Kiki, et le carnet de Tarif. Le tournoi est écrit d'avance. Kiki gagne au quatrième round, tous les soirs."),
        say(MOMO, "Tarif truque des combats… dans MA cave… avec MES tabourets ?"),
        say(MOMO, "Bon. Qu'est-ce que tu veux en faire ? Moi je veux juste qu'il dégage."),
      ],
      choices: [
        {
          label: "Dénoncer Tarif devant tout le bar",
          next: conv(
            [
              say("", "Momo frappe la cloche du comptoir. Silence. Sparrow brandit le carnet."),
              say(S, "MESDAMES, MESSIEURS, ET DÉDÉ : vos paris sont truqués depuis cent douze soirs !"),
              say("Josiane", "CENT DOUZE ?! J'ai parié ma perruque ! Et celle de ma mère !"),
              say("", "Le bar se lève comme un seul homme ivre. Tarif s'enfuit par l'escalier, poursuivi par une chaise. Le tournoi est mort."),
              say(MOMO, "Magnifique. Ça mérite un verre. Reviens me voir quand la poussière sera retombée."),
            ],
            [...tombe("denonce", "rep-honnete"), { kind: "drop", id: "carnet-tarif" }, { kind: "drop", id: "seringue" }],
          ),
        },
        {
          label: "Garder les preuves… et faire chanter Tarif",
          next: conv(
            [
              say(S, "Et si plutôt… Tarif me payait pour que ce carnet disparaisse ?"),
              say(MOMO, "T'es une pourriture. Une pourriture efficace, mais une pourriture."),
              say(MOMO, "Fais ça en bas, pas devant mes clients. Bulldozer, laisse-le passer."),
            ],
            set("acces-cave", "chantage-pret"),
          ),
        },
        { label: "Réfléchir encore", next: conv([say(MOMO, "Réfléchis. Mais pas trop longtemps : la vérité, ça tourne comme le lait.")]) },
      ],
    }),
  },
  {
    when: (r) => !fl(r, "momo-1"),
    talk: () => ({
      lines: [
        say(MOMO, "Ici, on sert des verres, pas des miracles. Et vu ta gueule, il va te falloir les deux."),
        say(S, "Sympa l'accueil. Vous avez aussi une formule avec le coup de poing ?"),
        say(MOMO, "Formule cave. Demande au frigo, devant la porte du fond. Il s'appelle Bulldozer. Il ne mord pas. Il écrase."),
      ],
      effects: set("momo-1"),
      choices: [
        { label: "Commander à boire", next: { lines: [say(MOMO, "Bière tiède ou gnôle maison. La bière, c'est pour les gens qui veulent se souvenir de leur soirée.")], then: { kind: "shop", id: "bar" } } },
        { label: "« Et vous, ça va ? »", next: momoStory() },
        { label: "Partir", next: conv([say(MOMO, "C'est ça. La porte est derrière toi, comme ta jeunesse.")]) },
      ],
    }),
  },
  {
    talk: (r) => ({
      lines: [say(MOMO, fl(r, "m-ring") ? "Champion ! Je t'offrirais bien un verre, mais t'as l'air de saigner dedans." : fini(r) ? "Le calme est revenu. C'est presque triste. Presque." : "Alors ? Tu bois ou tu regardes ?")],
      choices: [
        { label: "Commander à boire", next: { lines: [say(MOMO, "Ça marche.")], then: { kind: "shop", id: "bar" } } },
        ...(fl(r, "momo-histoire") ? [] : [{ label: "« Et vous, ça va ? »", next: momoStory() }]),
        { label: "Partir", next: conv([say(MOMO, "Reviens quand tu veux. Ou ne reviens pas. Je ne suis pas ta mère.")]) },
      ],
    }),
  },
];

function momoStory(): Conversation {
  return conv(
    [
      say(MOMO, "…Personne ne m'a demandé ça depuis 23:59. Depuis toujours, donc."),
      say(MOMO, "Ma femme est partie avec le livreur de glaçons. Les glaçons, eux, sont restés. Tous les soirs, je les regarde fondre. Ils fondent pas. Le temps est bloqué. C'est pire."),
      say(S, "…C'est la chose la plus triste que j'aie jamais entendue dans un bar."),
      say(MOMO, "Merci d'avoir écouté. Tiens : un Château Pétrole 1987. Je le gardais pour une grande occasion. Il n'y a jamais de grande occasion."),
    ],
    [...set("momo-histoire"), { kind: "item", id: "chateau-petrole" }],
  );
}

const dede: Rule[] = [
  {
    when: (r) => fl(r, "verite"),
    talk: () => conv([say(DEDE, "Tu l'as ouverte, la boîte ? Si la montre te parle… *hic*… lui réponds pas. Moi j'ai répondu une fois. Depuis, je bois.")]),
  },
  {
    when: fini,
    talk: (r) =>
      conv(
        [
          say(DEDE, fl(r, "m-ring") ? "TU AS BATTU KIKI ?! J'ai récupéré ma mise ! Mon appart ! Enfin… mon canapé. Bon, j'ai pas d'appart. J'avais parié un canapé." : "Le tournoi est mort ! Ma mise est sauvée ! Je vais pouvoir la reperdre ailleurs !"),
          say(S, "Bon. L'horloge. Le pastis. 1987. Raconte."),
          say(DEDE, "…J'ai menti. Sur l'horloge. Sur le pastis. Sur 1987. Je sais rien de l'horloge. Personne sait rien. C'est bien ça le problème."),
          say(S, "Je vais te faire avaler ton verre. Avec le verre."),
          say(DEDE, "ATTENDS ! Pas sur TOUT. Au fond de la cave, y a un vieux local technique. Un soir, j'y ai vu un truc briller. Une montre. Sans aiguilles. Elle chuchotait mon prénom. Personne connaît mon prénom. Même moi, j'hésite."),
          say(DEDE, "J'ai refermé à clé, et j'ai bu pour oublier. Ça a marché : regarde-moi. Tiens, la clé. Moi, j'y retourne pas."),
        ],
        [...set("dede-1", "verite"), step("dede"), step("verite"), { kind: "item", id: "cle-local" }],
      ),
  },
  {
    when: (r) => !fl(r, "dede-1"),
    talk: () =>
      conv(
        [
          say(DEDE, "Toi… *hic*… t'as une tête de type qui veut savoir pourquoi l'horloge est bloquée."),
          say(DEDE, "Moi je sais. C'est moi qui l'ai bloquée. J'ai renversé mon pastis dans le mécanisme. En 1987."),
          say(S, "En 1987 ? L'horloge n'existait même pas."),
          say(DEDE, "Détail historique. Bref : je te dis tout… mais pas gratuit. J'ai parié mon appart sur le tournoi de la cave. Contre Kiki. Comme un con. Kiki gagne toujours : c'est truqué."),
          say(DEDE, "Fais tomber ce tournoi, et je te dis TOUT. Le vrai tout. Pas le tout de d'habitude."),
          say(DEDE, "Tu cognes sur le ring, tu achètes le frigo de la porte, ou tu prouves que c'est truqué. Moi je ferais les trois, mais je tiens pas debout."),
        ],
        [...set("dede-1"), { kind: "quest", id: AD_QUEST }, step("dede")],
      ),
  },
  {
    talk: (r) =>
      conv([
        say(DEDE, has(r, "seringue") || has(r, "carnet-tarif") ? "Des preuves ? Montre-les à Momo. Momo déteste deux choses : les tricheurs et les gens qui lui demandent comment il va." : "Le ring, le frigo ou les preuves. Choisis. Et ramène-moi un verre en passant. Non ? Radin."),
      ]),
  },
];

const bulldozer: Rule[] = [
  {
    when: (r) => fl(r, "m-videur-achete") || fl(r, "m-videur-ko"),
    talk: (r) => conv([say(BULL, fl(r, "m-videur-ko") ? "Je suis en reconversion. Fleuriste ou tueur à gages, j'hésite. Les deux, c'est des bouquets." : "J'ai démissionné. Je garde juste la porte par habitude. Et parce que j'aime bien la porte.")]),
  },
  {
    when: (r) => fl(r, "acces-cave"),
    talk: () => conv([say(BULL, "Descends. Et si tu meurs, meurs proprement : j'ai lavé hier.")]),
  },
  {
    talk: (r) => ({
      lines: [say(BULL, "La cave est réservée aux combattants. Pas aux touristes qui se prennent pour des héros."), say(S, "Et si je suis un combattant qui se prend pour un touriste ?"), say(BULL, "Alors t'es un touriste.")],
      choices: [
        {
          label: "« Je viens combattre. »",
          next: conv([say(BULL, "Inscription auprès de Monsieur Tarif, en bas. Si tu chiales, tu chiales en bas. Pas devant ma porte, je viens de la cirer.")], set("acces-cave", "inscrit")),
        },
        ...(has(r, "chateau-petrole")
          ? [
              {
                label: "Lui offrir le Château Pétrole 1987",
                next: conv(
                  [
                    say(BULL, "Un… Château Pétrole 1987 ? Ma mère en buvait pour décaper la baignoire. Et le chat."),
                    say("", "Bulldozer essuie une larme avec un poing de la taille d'un jambon."),
                    say(BULL, "Tu sais quoi ? Je démissionne. Sans moi, Tarif tient plus personne. Son tournoi, c'est fini. Va dire à Dédé que le bar est libre."),
                    say(BULL, "Et va voir La Fouine de ma part. Elle vend des trucs qui marchent. Parfois. Souvent pas. Mais parfois."),
                  ],
                  [{ kind: "drop", id: "chateau-petrole" }, ...tombe("videur-achete", "fouine-ok")],
                ),
              },
            ]
          : []),
        {
          label: "L'intimider",
          next: {
            lines: [say(S, "Écarte-toi, ou je t'écarte."), say(BULL, "Toi ? M'écarter ? …Vas-y. Essaie. J'ai pas frappé quelqu'un depuis 23:59. C'est long, 23:59.")],
            then: { kind: "battle", id: "ad-bulldozer" },
          },
        },
        {
          label: "Lui mentir : « Je suis de l'hygiène. »",
          next: conv([say(BULL, "T'as une carte ?"), say(S, "J'ai… une carte de fidélité de la supérette."), say(BULL, "Moi aussi. Encore deux tampons et j'ai un yaourt. Dégage.")]),
        },
      ],
    }),
  },
];

const fouine: Rule[] = [
  {
    when: (r) => fl(r, "fouine-ok"),
    talk: (r) => ({
      lines: [say(FOUINE, chantage(r) ? "Le maître chanteur ! Enfin quelqu'un de fréquentable. Remise de bienvenue : aucune. Mais je souris." : "Bulldozer m'a parlé de toi. Il a pleuré. Ça m'a convaincue.")],
      choices: [
        { label: "Voir la marchandise", next: { lines: [say(FOUINE, "Tout est neuf. Enfin, neuf pour toi.")], then: { kind: "shop", id: "marche-noir" } } },
        { label: "Partir", next: conv([say(FOUINE, "Vérifie tes poches en sortant. Par principe.")]) },
      ],
    }),
  },
  {
    when: (r) => !fini(r) && !has(r, "carnet-tarif"),
    talk: (r) => ({
      lines: [
        say(FOUINE, "Psst. Tu cherches quelque chose ? Moi je cherche quelqu'un qui cherche quelque chose."),
        say(FOUINE, "J'ai le carnet de paris de Tarif. Je l'ai trouvé. Dans sa poche. Pendant qu'il était dedans, la poche."),
        say(FOUINE, has(r, "chateau-petrole") ? "Ce que je veux ? Ce Château Pétrole qui dépasse de ta poche. Une vraie rareté. Comme un homme honnête." : "Ce que je veux ? Un truc rare. Une bouteille, une rumeur, un rein. Momo a une bouteille qu'il garde pour une grande occasion…"),
      ],
      choices: has(r, "chateau-petrole")
        ? [
            {
              label: "Échanger le Château Pétrole contre le carnet",
              next: conv(
                [say(FOUINE, "Marché conclu. Lis la page 112 : « Kiki gagne au 4e round ». Même écriture tous les soirs. Tarif a autant d'imagination que de cheveux."), say(S, "Il est chauve."), say(FOUINE, "Voilà.")],
                [{ kind: "drop", id: "chateau-petrole" }, { kind: "item", id: "carnet-tarif" }],
              ),
            },
            { label: "Garder la bouteille", next: conv([say(FOUINE, "Garde-la. Bois-la. Pleure. C'est ton droit.")]) },
          ]
        : undefined,
    }),
  },
  { talk: () => conv([say(FOUINE, "Reviens quand t'auras un truc qui m'intéresse. Ou quelqu'un qui m'intéresse. Spoiler : c'est pas toi.")]) },
];

const tarif: Rule[] = [
  {
    when: (r) => fl(r, "m-ring"),
    talk: () => conv([say(TARIF, "Cent douze soirs de paris parfaits. Puis toi. Tu as ruiné ma vie, mon mois et mon ulcère. Dans cet ordre.")]),
  },
  {
    when: (r) => fl(r, "chantage-pret"),
    talk: () => ({
      lines: [say(S, "Bonsoir, Monsieur Tarif. Joli carnet. Il serait dommage qu'il finisse entre les mains du bar entier."), say(TARIF, "…Combien ?")],
      choices: [
        {
          label: "« 260 FP. Et tu fermes boutique. »",
          next: conv(
            [
              say(TARIF, "260 ? T'es un monstre. J'aime bien les monstres : ils paient leurs dettes."),
              say("", "Tarif compte les billets en pleurant, puis remonte l'escalier avec sa valise. Le tournoi est mort. Tu viens de gagner de l'argent sale. Il sent l'ulcère."),
            ],
            [{ kind: "reward", xp: 40, coins: 260 }, { kind: "drop", id: "carnet-tarif" }, { kind: "drop", id: "seringue" }, ...tombe("chantage", "rep-crapule", "fouine-ok")],
          ),
        },
        { label: "Finalement, laisser tomber", next: conv([say(TARIF, "Sage décision. Les gens sages vivent vieux. Moi, par exemple.")]) },
      ],
    }),
  },
  {
    when: (r) => !fl(r, "inscrit"),
    talk: () => conv([say(TARIF, "Les inscriptions, c'est auprès de Bulldozer, en haut. Moi je compte. Je ne parle qu'aux combattants et aux billets.")]),
  },
  {
    when: (r) => !ko(r, "kevin"),
    talk: () => ({
      lines: [say(TARIF, "Inscrit ! Premier round : Kevin « La Tornade ». Il frappe vite et il pense lentement. Comme toi, mais dans l'autre sens."), say("", "Un seau d'eau glacée en pleine figure. « C'est le soin de la maison. »")],
      effects: [{ kind: "heal" }],
      then: { kind: "battle", id: "ad-kevin" },
    }),
  },
  {
    when: (r) => !ko(r, "bertrand"),
    talk: () => ({
      lines: [say(TARIF, "Deuxième round : le Gros Bertrand. Il ne frappe pas souvent. Il n'a pas besoin."), say("", "Seau d'eau. Encore. Tu commences à apprécier.")],
      effects: [{ kind: "heal" }],
      then: { kind: "battle", id: "ad-bertrand" },
    }),
  },
  {
    when: (r) => !ko(r, "ginette"),
    talk: () => ({
      lines: [say(TARIF, "Demi-finale : Sœur Ginette. Elle bénit ses adversaires. Avant, pendant, et surtout après."), say("", "Seau d'eau bénite. « Ça coûte pareil. »")],
      effects: [{ kind: "heal" }],
      then: { kind: "battle", id: "ad-ginette" },
    }),
  },
  {
    talk: () => ({
      lines: [say(TARIF, "La finale. BIG MAMA KIKI. Cent douze combats, cent douze victoires. Je parie sur elle. Rien de personnel : c'est écrit."), say(KIKI, "Approche, mon poussin. Maman va t'expliquer la vie. Avec les coudes.")],
      effects: [{ kind: "heal" }],
      then: { kind: "battle", id: "ad-kiki" },
    }),
  },
];

const NPCS: Record<string, Rule[]> = {
  "bar:momo": momo,
  "bar:dede": dede,
  "bar:bulldozer": bulldozer,
  "bar:fouine": fouine,
  "bar:josiane": [
    { when: (r) => fl(r, "m-denonce"), talk: () => conv([say("Josiane", "Le héros ! Je t'embrasserais bien, mais t'as une tête à porter plainte.")]) },
    {
      talk: (r) =>
        conv([
          say("Josiane", r.flags.includes("ad:josiane-1") ? "Tu reviens pour mon numéro ? J'en ai pas. J'ai qu'un répertoire. Et il chante faux." : "♪ Minuit moins uneuuuh… et toujours pas d'amouuuur… ♪"),
          say("Josiane", "Toi, t'es mignon. Comme un chien qu'on aurait mal dessiné."),
        ], set("josiane-1")),
    },
  ],
  "bar:habitue": [
    {
      when: (r) => fl(r, "info-habitue"),
      talk: () => conv([say("L'Habitué", "Momo t'a parlé de moi ? Il parle trop. Je ne regarde pas l'horloge. C'est elle qui me regarde."), say("L'Habitué", "On se reverra, Sparrow. On se revoit toujours. C'est même tout ce qu'on fait.")]),
    },
    {
      talk: () =>
        conv([
          say("L'Habitué", "Moi ? Je fais rien. Je suis assis là depuis 23:59."),
          say("L'Habitué", "Tu me reconnais pas ? On s'est déjà parlé. Hier. Et le jour d'avant. Et le jour d'avant-avant. Tu avais la même blague sur le jogging."),
          say(S, "J'ai pas de blague sur le jogging."),
          say("L'Habitué", "Pas encore."),
        ]),
    },
  ],
  "cave:tarif": tarif,
  "cave:kevin": [
    { when: (r) => ko(r, "kevin"), talk: () => conv([say("Kevin", "J'ai glissé. Sur ta main. Plusieurs fois. Ça compte pas.")]) },
    { talk: () => conv([say("Kevin", "Tu sais pourquoi on m'appelle La Tornade ? Parce que je laisse des débris."), say(S, "Ou parce que tu tournes en rond ?"), say("Kevin", "…Qui t'a raconté ?")]) },
  ],
  "cave:bertrand": [
    { when: (r) => ko(r, "bertrand"), talk: () => conv([say("Le Gros Bertrand", "Bien joué. Tu m'aides à me relever ? Non ? Je vais dormir là, alors. Je dormais là de toute façon.")]) },
    { talk: () => conv([say("Le Gros Bertrand", "Je vais m'asseoir sur toi. C'est pas une menace. C'est ma technique. C'est aussi ma personnalité.")]) },
  ],
  "cave:ginette": [
    { when: (r) => ko(r, "ginette"), talk: () => conv([say("Sœur Ginette", "Je prierai pour toi, mon fils. Contre toi, surtout. Mais pour toi aussi, un peu. Le dimanche.")]) },
    { talk: () => conv([say("Sœur Ginette", "As-tu péché, mon enfant ? Non ? Ne t'inquiète pas. Ce soir, je m'occupe de tout.")]) },
  ],
  "cave:kiki": [
    {
      when: (r) => ko(r, "kiki"),
      talk: () => conv([say(KIKI, "Personne m'avait jamais battue. Ça me fait un truc, là. Ça doit être de la fierté. Ou ma hernie."), say(KIKI, "Passe me voir quand tu veux. Je t'apprendrai à tomber avec style. Toi, tu tombes comme une chaise.")]),
    },
    {
      when: fini,
      talk: () => conv([say(KIKI, "Plus de tournoi, plus de paris. Je vais devoir trouver un vrai métier. Mère au foyer. Dans un foyer qui fait peur.")]),
    },
    { talk: () => conv([say(KIKI, "Mon poussin. Si tu montes sur mon ring, tu en redescends en compote. Bio, la compote. Je suis pas un monstre.")]) },
  ],
};

// ═══════════════════════════════ OBJETS ═══════════════════════════════

const THINGS: Chapter["things"] = {
  "bar:ad-tonneau": (r) =>
    has(r, "seringue") || fini(r)
      ? conv([say("", "Un tonneau. Il sent le crime et le vinaigre. Surtout le crime.")])
      : conv([say("", "Derrière le tonneau, une seringue vide. Étiquette : « SÉRUM K. — 3 doses avant la finale »."), say(S, "Kiki se dope. Évidemment que Kiki se dope.")], [{ kind: "item", id: "seringue" }]),
  "bar:porte-cave": () => conv([say("", "Une porte en fer. Derrière, des cris, des paris, des os. Bulldozer est planté devant comme un frigo qui a des opinions.")]),
  "bar:comptoir": () => conv([say("", "Le comptoir colle. Il a toujours collé. Il collera encore quand l'univers aura refroidi.")]),
  "cave:porte-local": () => conv([say("", "« LOCAL TECHNIQUE — DÉFENSE D'ENTRER ». La porte est fermée à clé. De l'autre côté, un tic. Puis un tac. Puis rien.")]),
  "cave:caisse": () => conv([say("", "Des caisses de bière. Vides. Et une dent. Pas à toi. Pas encore.")]),
  "local:ad-coffre": (r) =>
    fl(r, "coffre")
      ? conv([say("", "Le coffre est vide. Il fait encore tic, tout seul.")])
      : conv(
          [
            say("", "Dans le coffre, une montre sans aiguilles. Elle est chaude. Elle fait tic. Puis tac. Puis « Sparrow »."),
            say(S, "…Non. Non, non, non. Une montre qui connaît mon nom. Je la laisse là."),
            say("", "Sparrow la met dans sa poche."),
            say(S, "Bien sûr que je la prends. Je suis un idiot, pas un lâche."),
          ],
          [...set("coffre"), { kind: "gear", id: "montre-maudite" }, step("local")],
        ),
  "local:ad-miroir": () => conv([say("", "Un vieux miroir piqué. Ton reflet cligne des yeux une demi-seconde après toi."), say("", "Puis il sourit. Toi, non.")]),
  "local:ad-grille": () => conv([say("", "Une grille d'aération. Quelqu'un a gravé dessous : « NE LA PORTE PAS PLUS D'UNE NUIT ». La signature est un S."), say(S, "Plein de gens ont un prénom en S. Sylvie. Serge. Sparrow. …Surtout Sylvie.")]),
};

// ═══════════════════════════════ ARRIVÉES ET COMBATS ═══════════════════════════════

function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  if (map === "bar" && first)
    return conv(
      [
        say("", "LE DERNIER VERRE. Néons rouges, air épais, un ventilateur qui brasse de la sueur d'avant 23:59."),
        say("", "Quelqu'un ronfle sous une table. Quelqu'un d'autre chante faux par-dessus. Au fond, une porte en fer, et devant, un homme en forme de frigo."),
        say(S, "Enfin un endroit qui me ressemble."),
      ],
      [{ kind: "quest", id: AD_QUEST }, step("entrer")],
    );
  if (map === "cave" && first) return conv([say("", "La cave pue la bière, la sueur et la mauvaise décision. Au centre, un ring tendu de cordes à linge. Autour, des parieurs qui ont tous l'air d'avoir déjà perdu.")]);
  if (map === "local" && first)
    return conv([
      say("", "Le local technique. Une ampoule nue. Une vieille radio grésille dans le noir."),
      say("Radio", "…khhh… Sparrow ? … Encore toi ? … Tu descends toujours ici à 23:59… Tu remontes toujours avec la montre… Et tu oublies toujours… khhh…"),
      say(S, "…Je vais faire comme si j'avais rien entendu. C'est ma spécialité."),
    ]);
  void r;
  return null;
}

function afterBattle(id: string): Conversation | null {
  if (id === "ad-kevin") return conv([say("Kevin", "Aïe… mon brushing… T'as touché mon BRUSHING !"), say(TARIF, "Kevin est éliminé. Personne ne le pleure. Prochain round quand tu veux.")]);
  if (id === "ad-bertrand") return conv([say("", "Le Gros Bertrand s'effondre. La cave entière fait un petit bond."), say(TARIF, "Bertrand est hors-jeu. Et un peu dans le sol.")]);
  if (id === "ad-ginette") return conv([say("Sœur Ginette", "Seigneur, pardonne-lui… non. En fait, non."), say(TARIF, "Ginette est éliminée. Reste la finale. Prie, si tu sais faire.")]);
  if (id === "ad-bulldozer")
    return conv(
      [
        say("", "Bulldozer tombe à genoux. Le plancher du bar aussi, un peu."),
        say(BULL, "OK. OK. T'as gagné. Je me barre. Et le tournoi avec moi : sans videur, Tarif c'est juste un vieux avec un carnet."),
        say(BULL, "Tiens. Deux cafés de minuit. Je les gardais pour tenir debout. J'en aurai plus besoin : je vais rester assis. Longtemps."),
      ],
      [...tombe("videur-ko"), { kind: "bag", id: "cafe-minuit", n: 2 }],
    );
  if (id === "ad-kiki")
    return conv(
      [
        say(KIKI, "…Cent… treize… Non. Cent douze… et une défaite."),
        say("", "Silence total. Puis la cave explose. Des billets volent. Tarif s'évanouit dans ses propres paris."),
        say(KIKI, "Personne m'avait jamais battue. Garde la ceinture, mon poussin. Elle te va mal, mais elle te va."),
      ],
      [...tombe("ring", "rep-honnete"), { kind: "gear", id: "ceinture-ring" }],
    );
  return null;
}

export const AD: Chapter = { npcs: NPCS, things: THINGS, arrival, afterBattle: (id) => afterBattle(id) };
