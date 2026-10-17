/**
 * RPG — chapitre 3 : La Confrérie du Muscle (dialogues, épreuves, scènes).
 *
 * Quête principale « confrerie » (8 étapes) et quête secondaire « flemme ».
 * Le Coach Gonflax fait s'entraîner tout le monde sans jamais s'arrêter. La vraie sagesse
 * de la Confrérie, oubliée de tous, tient en un mot : le repos. Sparrow est l'expert.
 */

import { sanctuaireOuvert, templeOuvert } from "./mont";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

const Q = "confrerie";
const FL = "flemme";
const S = "Sparrow";
const CH = "Chevalier Noir";
const GE = "Gérard la Frite";
const LILI = "Lili";
const GO = "Coach Gonflax";
const MO = "Sage Mollet";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const has = (r: Rpg, i: string) => r.items.includes(i);
const did = (r: Rpg, s: string, q = Q) => r.done.includes(`${q}:${s}`);
const step = (s: string, q = Q): Effect => ({ kind: "step", quest: q, step: s });
const say = (who: string, text: string) => ({ who, text });
const once = (lines: Conversation["lines"], effects?: Effect[]): Conversation => ({ lines, effects });
const epreuves = (r: Rpg) => ["force", "endurance", "esprit"].filter((e) => did(r, e)).length;
const fini = (r: Rpg) => r.quests[Q] === "terminee";

/** Les trois questions de l'Épreuve de l'Esprit : une mauvaise réponse renvoie au début. */
function quiz(n: number): Conversation {
  const QS = [
    { q: "Première question. Quand un muscle grandit-il vraiment ?", ok: "Pendant le repos.", ko: ["Pendant l'effort.", "Pendant le goûter."] },
    { q: "Deuxième question. Que faut-il faire après cent pompes ?", ok: "Une sieste.", ko: ["Cent pompes de plus.", "Un selfie."] },
    { q: "Dernière question. Qui est le plus fort de tous ?", ok: "Celui qui sait s'arrêter.", ko: ["Celui qui soulève le plus.", "Coach Gonflax."] },
  ];
  const cur = QS[n];
  const wrong: Conversation = { lines: [say(MO, "… Non. Médite là-dessus, et reviens me voir. Je ne bouge pas. C'est même ma spécialité.")] };
  const nextQ = n < QS.length - 1 ? quiz(n + 1) : null;
  const right: Conversation = nextQ
    ? { lines: [say(MO, "Juste."), ...nextQ.lines], choices: nextQ.choices }
    : {
          lines: [
            say(MO, "Juste. Trois fois juste. Tu as compris ce que la Confrérie a oublié depuis l'arrivée de Gonflax."),
            say(MO, "Le muscle ne pousse pas pendant l'effort. Il pousse pendant le repos. Le premier Titan de la Confrérie dormait douze heures par nuit."),
            say(S, "Douze heures ? C'est mon héros. Enfin, mon deuxième, après la friteuse."),
          ],
          effects: [step("esprit")],
        };
  // Ordre des réponses varié pour ne pas toujours mettre la bonne en premier
  const opts = [
    { label: cur.ko[0], next: wrong },
    { label: cur.ok, next: right },
    { label: cur.ko[1], next: wrong },
  ];
  if (n === 1) opts.push(opts.shift()!);
  if (n === 2) opts.unshift(opts.pop()!);
  return { lines: [say(MO, cur.q)], choices: opts };
}

/** Scène de l'éveil du Titan, quand les trois épreuves sont réussies. */
const eveil = (r: Rpg): Conversation => ({
  lines: [
    say(MO, "Force. Endurance. Esprit. Les trois épreuves sont réussies. Approche, Sparrow."),
    say(MO, "Le Titan ne naît pas de la fonte. Il naît de chaque répétition… et de chaque sieste qui la suit."),
    say(MO, "Ferme les yeux. Repense à chaque séance sur ton banc, chaque réveil difficile, chaque frite méritée."),
    say("", "Une chaleur dorée monte dans les bras de Sparrow. Son sweat craque aux coutures. Sa barbe frissonne."),
    say(S, "Je… je me sens capable de soulever un frigo. Plein. Avec la porte ouverte."),
    say(MO, "SPARROW TITAN. Une fois par combat, pendant quelques tours, tu pourras l'appeler. Ne l'utilise pas pour ouvrir les pots de cornichons."),
    ...(r.party.includes("chevalier") ? [say(CH, "Impressionnant, Élu. J'ai presque envie de faire une pompe. Presque.")] : []),
    say(MO, "La porte du sanctuaire s'ouvre. Gonflax t'attend. Montre-lui ce qu'est un vrai Titan : un Titan reposé."),
  ],
  effects: [step("titan"), { kind: "skill", id: "titan" }],
});

const NPCS: Record<string, Rule[]> = {
  // ─── La Cité (après le chapitre 2) ───
  // (les répliques de la Cité qui annoncent le chapitre 3 sont dans les objets : porte nord)

  // ─── Sentier ───
  "sentier:randonneur": [
    { when: fini, talk: () => once([say("Randonneur épuisé", "On m'a dit que les moines faisaient la sieste, maintenant ! Je vais peut-être y retourner. Pour la sieste.")]) },
    {
      when: (r) => !flag(r, "randonneur-1"),
      talk: () =>
        once(
          [
            say("Randonneur épuisé", "Fuyez… Enfin, non, montez si vous voulez. Mais fuyez dans votre tête."),
            say("Randonneur épuisé", "Là-haut, la Confrérie du Muscle. Je suis entré pour une séance d'essai. Trois semaines plus tard, je faisais encore des squats."),
            say("Randonneur épuisé", "Le Coach Gonflax interdit le repos. Il dit qu'une minute assis est une minute perdue. Il porte un haltère d'or qui brille… bizarrement."),
            say(GE, "Une pierre qui brille ? Encore ? Le Cadran a décidément des goûts de décorateur très limités."),
            say("Randonneur épuisé", "Il y a un refuge en chemin. Brenda vous fera une soupe. Et un pont… gardé par un shaker. Je ne peux pas en dire plus. Je tremble encore."),
          ],
          [{ kind: "flag", id: "randonneur-1" }],
        ),
    },
    { talk: () => once([say("Randonneur épuisé", "Le refuge est un peu plus haut, à droite du sentier. Dites à Brenda que je suis vivant. Fatigué, mais vivant.")]) },
  ],
  "sentier:haltere": [
    { when: (r) => !flag(r, "ko:haltere"), talk: () => ({ lines: [say("Haltère Sauvage", "CLONK ! CLONK ! *Il roule vers vous avec une intention claire.*")], then: { kind: "battle", id: "haltere-1" } }) },
    { talk: () => once([say("Haltère Sauvage", "Clonk…")]) },
  ],
  "sentier:proteinator": [
    {
      when: (r) => !flag(r, "ko:proteinator"),
      talk: () => ({
        lines: [
          say("Protéinator", "SHAKE ! SHAKE ! SHAKE ! Personne ne traverse le pont sans avoir bu ses 40 grammes de protéines !"),
          say(S, "Un shaker géant avec des bras. Évidemment. Pourquoi pas."),
          say(GE, "Attention, il va mousser !"),
        ],
        then: { kind: "battle", id: "proteinator" },
      }),
    },
    { talk: () => once([say("Protéinator", "…blop.")]) },
  ],
  "sentier:halteres-1": [
    {
      when: (r) => !flag(r, "ko:halteres"),
      talk: () => ({ lines: [say("Haltère Sauvage", "CLONK CLONK ! *Deux haltères vous barrent le col. Ils ont l'air de s'entraîner ensemble depuis longtemps.*")], then: { kind: "battle", id: "halteres-2" } }),
    },
    { talk: () => once([say("Haltère Sauvage", "Clonk…")]) },
  ],
  "sentier:halteres-2": [],

  // ─── Refuge ───
  "refuge:brenda": [
    {
      when: (r) => !did(r, "refuge"),
      talk: () => ({
        lines: [
          say("Brenda", "Des visiteurs ! Entrez, entrez, il fait frais. Je suis Brenda, gardienne du refuge. Soupe ? Lit ? Câlin ? Non ? Bon."),
          say(S, "On va au Temple de la Confrérie. Il paraît que le coach a un haltère qui brille."),
          say("Brenda", "Gonflax… Avant, la Confrérie était un endroit paisible. On s'entraînait le matin, on faisait la sieste l'après-midi. Le Sage Mollet y veillait."),
          say("Brenda", "Puis Gonflax a reçu cet haltère d'or, d'un homme en costume. Depuis : plus de repos. Plus jamais. Les moines ne dorment plus."),
          say("Brenda", "Pour entrer au temple, il faut passer Frère Haltère, à la porte. Il ne laisse entrer que les membres. Ou les gens très malins."),
          say("Brenda", "Tiens, je te vends ce qu'il faut pour la route."),
        ],
        effects: [step("refuge")],
        then: { kind: "shop", id: "refuge" },
      }),
    },
    { talk: (r) => ({ lines: [say("Brenda", fini(r) ? "La Confrérie dort enfin ! J'entends les ronflements d'ici. Tu veux une soupe pour fêter ça ?" : "Couvre-toi bien, et mange quelque chose de chaud.")], then: { kind: "shop", id: "refuge" } }) },
  ],
  "refuge:alpiniste": [
    {
      talk: (r) =>
        once([
          say("Vieil alpiniste", did(r, "titan") ? "Tu as la carrure d'un Titan, maintenant. Mais tu as gardé tes cernes. Bonne nouvelle : ça veut dire que tu dors encore." : "Au temple, il y a trois épreuves : la Force, l'Endurance et l'Esprit. Les jeunes oublient toujours la troisième. C'est pourtant la plus importante."),
        ]),
    },
  ],

  // ─── Parvis ───
  "temple-cour:lili": [
    {
      talk: () => ({
        lines: [
          say(LILI, "Tiens, tiens. L'Élu de la Minute et sa bande de cuisine."),
          say(S, "Lili ! La voleuse de lettres ! Tu as un sacré culot de te montrer."),
          say(LILI, "La lettre du Cadran ? Elle est codée. Il paraît que les fragments d'horloge la font parler. Et devine qui en a deux dans la poche."),
          say(LILI, "Le troisième fragment est dans l'haltère de Gonflax. Frère Haltère ne laisse entrer personne. Moi, je sais comment le distraire."),
          say(LILI, "Marché : je vous fais entrer, et tu me laisses lire la lettre à la lumière de tes fragments. Juste lire."),
        ],
        choices: [
          {
            label: "Marché conclu.",
            next: {
              lines: [
                say(LILI, "Parfait. Regarde bien."),
                say("", "Lili jette une poignée de poudre violette… qui forme un mot dans l'air : « SIESTE OFFERTE ». Frère Haltère écarquille les yeux et court vers la forêt."),
                say(LILI, "La porte est à vous. On se reverra à l'intérieur. Ou pas. Je ne suis pas très fiable, il paraît."),
              ],
              effects: [{ kind: "flag", id: "lili-deal" }, { kind: "flag", id: "temple-ouvert" }],
            },
          },
          {
            label: "Je ne traite pas avec toi.",
            next: {
              lines: [
                say(LILI, "Comme tu veux. Bonne chance avec le gros costaud. Il adore se battre."),
                say("", "Lili disparaît derrière une colonne."),
              ],
              effects: [{ kind: "flag", id: "lili-refus" }],
            },
          },
        ],
      }),
    },
  ],
  "temple-cour:gardien": [
    {
      when: (r) => !flag(r, "lili-refus"),
      talk: () =>
        once([
          say("Frère Haltère", "HALTE ! Seuls les membres de la Confrérie entrent ! Montre ta carte de membre… ou tes abdos !"),
          say(S, "J'ai un abdo. Un seul, mais il est très costaud."),
          say("Frère Haltère", "Insuffisant ! Reviens avec une carte… ou va parler à la fille en violet qui rôde depuis ce matin. Elle me fait peur."),
        ]),
    },
    {
      talk: () => ({
        lines: [
          say("Frère Haltère", "Toujours pas de carte ? Alors il faudra me prouver ta force, ici, maintenant !"),
          say(CH, "Enfin quelqu'un de raisonnable. Battons-nous."),
        ],
        then: { kind: "battle", id: "moine-1" },
      }),
    },
  ],
  "temple-cour:moine-a": [
    { when: fini, talk: () => once([say("Moine du Gain", "Je fais une pompe… puis une sieste. Une pompe… puis une sieste. C'est merveilleux.")]) },
    { talk: () => once([say("Moine du Gain", "Mille cinq cent douze… mille cinq cent treize… Je ne sens plus mes bras. Je ne sens plus mon âme. Ne me parle pas, je vais perdre le compte.")]) },
  ],
  "temple-cour:moine-b": [
    { when: fini, talk: () => once([say("Moine du Gain", "Le Coach dit qu'on peut s'asseoir, maintenant. Je ne sais plus comment on fait. Tu peux me montrer ?")]) },
    { talk: () => once([say("Moine du Gain", "La douleur est une information. Et l'information, c'est que j'ai très mal. Merci de demander.")]) },
  ],

  // ─── Temple ───
  "temple:fonte": [
    { when: (r) => did(r, "force"), talk: () => once([say("Maître Fonte", "Tu as soulevé la barre comme un vrai membre. Le banc te reste ouvert, si tu veux t'entraîner encore.")]) },
    {
      talk: () =>
        once([
          say("Maître Fonte", "Épreuve de la Force. Le banc est là. Soulève la barre au bon moment, douze fois au moins, sans crampe."),
          say("Maître Fonte", "Et ne triche pas. Je vois tout. Enfin, je vois flou depuis trois ans sans dormir, mais je vois."),
        ]),
    },
  ],
  "temple:arbitre": [
    { when: (r) => did(r, "endurance"), talk: () => once([say("Maître d'Arène", "Trois adversaires d'affilée. Tu as tenu. Respect.")]) },
    {
      talk: () => ({
        lines: [
          say("Maître d'Arène", "Épreuve de l'Endurance ! Trois adversaires, l'un après l'autre, sans pause. Pas de fuite possible."),
          say("Maître d'Arène", "Prêt ?"),
        ],
        choices: [
          {
            label: "Prêt !",
            next: { lines: [say("Maître d'Arène", "QUE L'ÉPREUVE COMMENCE !")], then: { kind: "battle", id: "arene" } },
          },
          { label: "Pas encore.", next: { lines: [say("Maître d'Arène", "L'arène ne bouge pas. Prends ton temps. Enfin… Gonflax dirait le contraire.")] } },
        ],
      }),
    },
  ],
  "temple:mollet": [
    { when: fini, talk: () => once([say(MO, "La Confrérie dort enfin. Le temple ronfle comme une vieille chaudière. C'est le plus beau son du monde.")]) },
    { when: (r) => did(r, "titan"), talk: () => once([say(MO, "Le sanctuaire est ouvert. Va, Titan. Et pense à boire de l'eau.")]) },
    { when: (r) => epreuves(r) === 3, talk: (r) => eveil(r) },
    {
      when: (r) => did(r, "esprit"),
      talk: (r) =>
        once([say(MO, `Tu as réussi l'Épreuve de l'Esprit. Il te reste ${3 - epreuves(r)} épreuve${3 - epreuves(r) > 1 ? "s" : ""}. La Force, à l'ouest. L'Endurance, à l'est.`)]),
    },
    {
      talk: () => ({
        lines: [
          say(MO, "Hmm ? Un visiteur… qui n'est pas en train de faire des pompes. Quel soulagement."),
          say(MO, "Je suis le Sage Mollet, fondateur de la Confrérie. Gonflax m'a laissé ici, avec les livres. Il dit que réfléchir, c'est du temps perdu."),
          say(MO, "Épreuve de l'Esprit. Trois questions. Une seule mauvaise réponse et il faudra recommencer."),
        ],
        choices: [
          { label: "Je suis prêt.", next: quiz(0) },
          { label: "Plus tard.", next: { lines: [say(MO, "Les livres attendront. Ils ont l'habitude.")] } },
        ],
      }),
    },
  ],
  "temple:flemme": [
    {
      when: (r) => has(r, "oreiller"),
      talk: () =>
        once(
          [
            say("Frère Flemme", "C'est… c'est un oreiller. Un VRAI oreiller. Avec une housse. Et une odeur de lessive."),
            say("Frère Flemme", "Merci, Sparrow. Prends mon masque de nuit, je n'en aurai plus besoin : je vais dormir trois ans d'un coup."),
            say("", "Frère Flemme s'effondre sur son lit et se met à ronfler immédiatement. C'est beau."),
          ],
          [step("dodo", FL), { kind: "drop", id: "oreiller" }, { kind: "gear", id: "masque-nuit" }, { kind: "flag", id: "flemme-dort" }],
        ),
    },
    {
      when: (r) => did(r, "rencontre", FL),
      talk: () => once([say("Frère Flemme", "La réserve… au sud-ouest du hall. Les oreillers confisqués sont dans un coffre. Deux moines le gardent. Ils ne dorment jamais, évidemment.")]),
    },
    {
      talk: () => ({
        lines: [
          say("Frère Flemme", "Bonjour… ou bonsoir… Je ne sais plus. Je n'ai pas dormi depuis trois ans. Ordre du Coach."),
          say(S, "Trois ans ? Moi, au bout de trois heures, je deviens une autre personne. Une moins bien."),
          say("Frère Flemme", "Gonflax a confisqué tous les oreillers. Ils sont dans la réserve, au sud-ouest. Si tu m'en ramenais un… je te serais éternellement reconnaissant. Éternellement endormi, aussi."),
        ],
        effects: [{ kind: "quest", id: FL }, step("rencontre", FL)],
      }),
    },
  ],
  "temple:reserve-1": [
    {
      when: (r) => !flag(r, "ko:reserve"),
      talk: () => ({ lines: [say("Moine du Gain", "HALTE ! La réserve est interdite ! Ici, on garde les oreillers, les canapés et tout ce qui est mou !")], then: { kind: "battle", id: "moine-reserve" } }),
    },
    { talk: () => once([say("Moine du Gain", "…")]) },
  ],
  "temple:reserve-2": [],
  "temple:ronde": [
    {
      when: (r) => !flag(r, "ko:ronde-temple"),
      talk: () => ({ lines: [say("Moine du Gain", "Un intrus qui marche lentement ? IL MARCHE LENTEMENT ! Au combat !")], then: { kind: "battle", id: "moine-1" } }),
    },
    { talk: () => once([say("Moine du Gain", "Mille un, mille deux…")]) },
  ],
  "temple:gonflax": [
    {
      when: fini,
      talk: () =>
        once([
          say(GO, "J'apprends la sieste. C'est dur. Hier j'ai tenu quatre minutes. Le Sage dit que c'est un début."),
          say(GO, "Merci, petit. Je ne savais plus m'arrêter. Le Cadran m'avait pris ça aussi."),
        ]),
    },
    {
      when: (r) => !flag(r, "gonflax-1"),
      talk: () => ({
        lines: [
          say(GO, "TOI ! Le petit barbu qui marche les mains dans les poches ! Tu as passé MES épreuves ?"),
          say(S, "Et réveillé le Titan, aussi. Bon, réveillé, façon de parler : il a surtout fait une très bonne sieste."),
          say(GO, "LA SIESTE EST UNE INSULTE ! Chaque seconde de repos est une seconde VOLÉE au progrès ! C'est écrit là, sur mon haltère d'or !"),
          say(CH, "Cet haltère… La pierre qui brille dessus. C'est un fragment, Élu."),
          say(GO, "Il ne quittera pas mes mains ! Échauffement terminé : PLACE À LA SÉANCE !"),
        ],
        effects: [{ kind: "flag", id: "gonflax-1" }],
        then: { kind: "battle", id: "gonflax" },
      }),
    },
    {
      talk: () => ({ lines: [say(GO, "Tu reviens pour une deuxième série ? J'adore. ALLEZ, ON NE LÂCHE RIEN !")], then: { kind: "battle", id: "gonflax" } }),
    },
  ],
  "temple:lili-s": [{ talk: () => once([say(LILI, "…")]) }],
};
NPCS["sentier:halteres-2"] = NPCS["sentier:halteres-1"];
NPCS["temple:reserve-2"] = NPCS["temple:reserve-1"];

// ─── Objets ───

const THINGS: Chapter["things"] = {
  "cite:porte-nord": (r) =>
    r.quests["frites-perdues"] === "terminee"
      ? once([say("", "Le portail nord est ouvert. Le sentier du Mont Biscotto monte dans la brume.")])
      : once([say("", "Le portail nord de la cité est verrouillé. « Fermé par ordre du Roi » — évidemment.")]),
  "temple-cour:porte-temple": () =>
    once([
      say("Frère Haltère", "Hé ! On ne passe pas comme ça ! Membres seulement !"),
      say(CH, "Il faudra trouver un moyen de l'éloigner… ou de le convaincre."),
    ]),
  "temple-cour:gong": () => once([say("", "BOOONG ! Tous les moines sursautent… puis reprennent leurs pompes, plus vite."), say(GE, "Évite de recommencer. Ils risquent de s'évanouir.")]),
  "temple-cour:haltere-geant": () => once([say("", "Un haltère d'or géant. Sur le socle : « FONDÉ PAR LE SAGE MOLLET — LE REPOS EST LE PREMIER EXERCICE ». Quelqu'un a gratté le mot « REPOS ».")]),
  "temple-cour:sac-frappe": () => once([say(S, "Je tape dans le sac. Le sac ne bouge pas. Mon poignet, si.")]),
  "temple-cour:pancarte": () => once([say("", "« LA DOULEUR EST UNE INFORMATION ». En dessous, au crayon : « et l'information, c'est : arrête ».")]),
  "temple:banc-force": (r) =>
    did(r, "force")
      ? {
          lines: [say("", "Le banc de la Salle de la Force. La barre t'attend.")],
          choices: [
            { label: "S'entraîner", next: { lines: [], then: { kind: "minigame", id: "muscu" } } },
            { label: "Pas maintenant", next: { lines: [] } },
          ],
        }
      : {
          lines: [say("", "ÉPREUVE DE LA FORCE : soulever la barre au moins 12 fois, sans crampe."), say(GE, "Je te tiens les frites. Enfin, je ME tiens. Allez !")],
          choices: [
            { label: "Soulever !", next: { lines: [], then: { kind: "minigame", id: "muscu" } } },
            { label: "Pas encore", next: { lines: [say(S, "Je m'échauffe. Mentalement.")] } },
          ],
        },
  "temple:grille-sanctuaire": (r) =>
    sanctuaireOuvert(r)
      ? once([say("", "La grille du sanctuaire est ouverte.")])
      : once([say("", "Une lourde grille ferme le sanctuaire. Une inscription : « SEUL UN TITAN PEUT ENTRER »."), say(CH, `Les trois épreuves, Élu. Il en reste ${3 - epreuves(r)}.`)]),
  "temple:statue-titan": () => once([say("", "La statue du Premier Titan. Il dort, les bras croisés sur son haltère. Sur le socle : « ZZZ ». C'est son seul enseignement. Il est très profond.")]),
  "temple:coffre-arene": (r) =>
    flag(r, "coffre-arene")
      ? once([say("", "Le coffre est vide.")])
      : once([say("", "Le coffre des champions de l'arène : un Méga-cornet et deux Barres protéinées.")], [
          { kind: "flag", id: "coffre-arene" },
          { kind: "bag", id: "mega-cornet", n: 1 },
          { kind: "bag", id: "barre-proteinee", n: 2 },
        ]),
  "temple:coffre-oreiller": (r) =>
    flag(r, "coffre-oreiller")
      ? once([say("", "Le coffre de la réserve est vide. Il reste des plumes partout.")])
      : !flag(r, "ko:reserve")
        ? once([say("", "Les gardiens de la réserve ne te laisseront pas l'ouvrir.")])
        : once(
            [say("", "Le coffre des objets confisqués : des coussins, des plaids, une bouillotte… et un oreiller moelleux."), say(S, "Je pourrais rester ici pour toujours. Mais Frère Flemme en a plus besoin que moi. De peu.")],
            [{ kind: "flag", id: "coffre-oreiller" }, { kind: "item", id: "oreiller" }, ...(did(r, "rencontre", FL) ? [step("oreiller", FL)] : [{ kind: "quest" as const, id: FL }, step("oreiller", FL)])],
          ),
  "temple:gong": () => once([say("", "BOOONG ! Le son résonne dans tout le temple. Quelque part, un moine pleure de fatigue.")]),
  "temple:pancarte": () => once([say("", "« ON NE S'ARRÊTE JAMAIS ». Quelqu'un a ajouté : « sauf pour le déjeuner ? » — c'est barré.")]),
  "temple:sac-frappe": () => once([say(S, "Un sac de frappe. Je lui donne une petite tape. Respect mutuel.")]),
  "temple:bibliotheque": () => once([say("", "« Le Repos du Guerrier », « L'Art de la Sieste », « Dormir pour Grandir »… Tous couverts de poussière.")]),
  "temple:lit-int": () => once([say(S, "Les lits du dortoir. Jamais défaits. Les draps sont encore pliés en carré.")]),
  "temple:caisse": () => once([say("", "Une caisse de bandeaux en éponge. Il y en a assez pour essuyer un océan.")]),
  "refuge:comptoir": () => once([say("", "Le comptoir de Brenda. Une soupe mijote derrière. L'odeur te réchauffe jusqu'aux chaussettes.")]),
  "refuge:lit-int": () => once([say(S, "Un lit de refuge. Il grince. Je l'aime déjà.")]),
  "sentier:panneau": (_r, text) => once([say("", text === "MONT BISCOTTO" ? "« MONT BISCOTTO — Temple de la Confrérie du Muscle : 1 200 marches. Ascenseur : non. »" : `« ${text ?? "…"} »`)]),
};

// ─── Moments scénarisés ───

function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  if (map === "sentier" && !did(r, "nord"))
    return {
      lines: [
        say("", "Au-delà du portail nord, un sentier grimpe dans la brume. Tout en haut, on devine les toits rouges d'un temple."),
        say(S, "Les deux fragments vibrent dans ma poche. Ils tirent vers le sommet. J'ai pas fait de randonnée depuis… jamais, en fait."),
        say(GE, "Courage. Les frites, c'est des pommes de terre qui ont marché jusqu'à l'huile."),
        say(CH, "Ce n'est pas du tout comme ça que ça marche, Gérard."),
      ],
      effects: [{ kind: "quest", id: Q }, step("nord")],
    };
  if (map === "temple" && !did(r, "temple"))
    return {
      lines: [
        say("", "Le hall du temple résonne de grognements, de souffles et de « ENCORE UNE ! ». Personne ne s'arrête."),
        say(S, "C'est la pire salle de sport du monde. Il n'y a même pas de distributeur de chips."),
        say(CH, "Trois salles d'épreuves : la Force à l'ouest, l'Endurance à l'est, l'Esprit au nord-ouest. Le sanctuaire est fermé par une grille."),
      ],
      effects: [step("temple")],
    };
  if (map === "temple-cour" && first) return once([say(S, "Le Temple de la Confrérie. Même les arbres ont l'air de faire des abdos.")]);
  return null;
}

function afterBattle(id: string, r: Rpg): Conversation | null {
  if (id === "proteinator") return once([say("", "Le Protéinator se vide de sa mousse et roule dans la rivière en faisant « blop »."), say(GE, "Paix à son shaker.")]);
  if (id === "moine-1" && !templeOuvert(r))
    return once([say("Frère Haltère", "Tu… tu as gagné… Bon. Entre. Mais ne dis à personne que je me suis assis pour reprendre mon souffle."), say("", "Frère Haltère s'assoit. Pour la première fois depuis des mois, il sourit.")], [{ kind: "flag", id: "temple-ouvert" }]);
  if (id === "arene") return once([say("Maître d'Arène", "TROIS SUR TROIS ! L'Épreuve de l'Endurance est réussie !")], [step("endurance")]);
  if (id === "moine-reserve") return once([say(S, "La réserve est libre. Il y a un coffre au fond.")]);
  if (id === "gonflax")
    return {
      lines: [
        say(GO, "Je… je ne peux plus… Mes bras… Ils veulent… s'ARRÊTER ?"),
        say("", "L'haltère d'or glisse des mains du Coach. La pierre lumineuse s'en détache et roule jusqu'à Sparrow."),
        say(S, "Le troisième fragment."),
        say(GO, "Un homme en costume… Il disait s'appeler M. Il m'a promis un corps éternel si la Confrérie ne s'arrêtait jamais."),
        say(GO, "Chaque minute de repos que mes moines ne prenaient pas… il la récoltait. Dans un sablier. Pour sa « Tour »."),
        say(CH, "Le Cadran ne vole pas le temps au hasard. Il vole les pauses, les repas, les siestes. Tout ce qui fait respirer les gens."),
      ],
      effects: [{ kind: "flag", id: "lili-sanctuaire" }],
      then: { kind: "scene", id: "lili-ch3" },
    };
  return null;
}

function scene(id: string): Conversation | null {
  if (id !== "lili-ch3") return null;
  return {
    lines: [
      say(LILI, "La Tour de Minuit. J'avais raison."),
      say("", "Lili sort de l'ombre d'une colonne, la lettre du Cadran à la main. Les trois fragments se mettent à briller : des lettres violettes apparaissent sur le papier."),
      say(LILI, "C'est une liste. Les porteurs de fragments. Le Roi de la Salade, rayé. Gonflax, rayé… parce que vous les avez battus."),
      say(LILI, "Et en bas : « LILI — À SUPPRIMER APRÈS LIVRAISON ». C'est moi qui leur portais les pierres. Ils comptaient me faire disparaître une fois le travail fini."),
      say(S, "… Ils t'ont doublée."),
      say(LILI, "Alors on va les doubler ensemble. Prochain nom sur la liste : « MAÎTRE KATSU — Voie du Samouraï ». Il garde le quatrième fragment."),
      say(LILI, "Je viens avec vous. Pas parce que je vous aime bien. Parce que je n'aime pas qu'on raye mon nom."),
      say(GE, "Une voleuse dans l'équipe. J'ai intérêt à surveiller mes frites."),
      say(MO, "La Confrérie va enfin pouvoir dormir. Prends la ceinture du Premier Titan, Sparrow. Elle t'ira mieux qu'à Gonflax."),
    ],
    effects: [{ kind: "join", id: "lili" }, { kind: "gear", id: "ceinture-titan" }, { kind: "item", id: "liste-cadran" }, step("gonflax")],
  };
}

export function afterMinigame(id: string, ok: boolean, r: Rpg): Conversation | null {
  if (id !== "muscu") return null;
  if (did(r, "force")) return ok ? once([say("Maître Fonte", "Belle série. Les muscles poussent… surtout si tu dors ce soir.")]) : null;
  if (!ok) return once([say("Maître Fonte", "Pas assez de répétitions. Repose-toi un instant, puis recommence. Oui, j'ai dit « repose-toi ». Ne le répète pas.")]);
  return once(
    [say("Maître Fonte", "DOUZE ! ET PLUS ! L'Épreuve de la Force est réussie !"), say(S, "Je sens mes bras. Ils ne m'aiment plus. Mais ils sont fiers.")],
    [step("force")],
  );
}

export const CH3: Chapter & { scene: typeof scene; afterMinigame: typeof afterMinigame } = {
  npcs: NPCS,
  things: THINGS,
  arrival,
  afterBattle,
  scene,
  afterMinigame,
};

export const CH3_CARD = ["CHAPITRE 3 TERMINÉ", "LA CONFRÉRIE DU MUSCLE", "+450 XP · +350 FP", "Objet : Fragment d'horloge n°3 · Lili rejoint l'équipe", "Prochain chapitre : La Voie du Samouraï"];
