/**
 * RPG — chapitre 2 : La Cité des Frites Perdues (dialogues, objets, scènes).
 *
 * Quête principale « frites-perdues » (7 étapes) et quête secondaire « graines ».
 * Toutes les conditions lisent l'état sauvegardé (`Rpg`) : rien ne peut se bloquer,
 * et chaque étape peut être rejouée sans effet en double.
 */

import { vannesOk } from "./cite";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

const F = "frites-perdues";
const G = "graines";
const S = "Sparrow";
const CH = "Chevalier Noir";
const GE = "Gérard la Frite";
const ROI = "Roi de la Salade";
const LILI = "Lili";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const has = (r: Rpg, i: string) => r.items.includes(i);
const did = (r: Rpg, q: string, s: string) => r.done.includes(`${q}:${s}`);
const step = (s: string, q = F): Effect => ({ kind: "step", quest: q, step: s });
const apres = (r: Rpg) => flag(r, "ko:roi-salade");
const avecGerard = (r: Rpg) => r.party.includes("gerard");
const sachets = (r: Rpg) => ["sachet-1", "sachet-2", "sachet-3"].filter((s) => did(r, G, s)).length;
const say = (who: string, text: string) => ({ who, text });
const once = (lines: Conversation["lines"], effects?: Effect[]): Conversation => ({ lines, effects });

/** Sachet de graines trouvé (quête secondaire, faisable dans n'importe quel ordre). */
const sachet = (n: 1 | 2 | 3, where: string): Effect[] => [step(`sachet-${n}`, G), { kind: "item", id: "graines" }, { kind: "flag", id: `vu:${where}` }];

const NPCS: Record<string, Rule[]> = {
  // ─── La Cité ───
  "cite:carotte": [
    { when: apres, talk: () => once([say("Monsieur Carotte", "Les friteuses sont rallumées ! J'en pleure. Bon, je pleure souvent, je suis une carotte sensible.")]) },
    {
      when: (r) => !flag(r, "carotte-1"),
      talk: () =>
        once(
          [
            say("Monsieur Carotte", "Des étrangers ! Bienvenue dans la Cité des Frites Perdues. Enfin… perdues. Interdites, plutôt."),
            say(S, "Interdites ? Les FRITES ?"),
            say("Monsieur Carotte", "Lis le décret sur la place, au nord. Et parle à Madame Chou : sa maison est au nord-ouest, celle au toit vert. Elle sait des choses. Des choses croustillantes."),
          ],
          [{ kind: "flag", id: "carotte-1" }],
        ),
    },
    { talk: () => once([say("Monsieur Carotte", "Madame Chou, nord-ouest, toit vert. Et ne parle pas trop fort de friture : les brocolis ont des oreilles. Enfin, des fleurettes.")]) },
  ],
  "cite:pois": [
    { when: apres, talk: () => once([say("Petit Pois", "J'ai mangé une frite ! Une VRAIE ! Elle était chaude et elle faisait crouch !")]) },
    {
      when: (r) => !flag(r, "pois-1"),
      talk: () => once([say("Petit Pois", "Ma maman dit que les frites, ça rend bête."), say("Petit Pois", "Moi, je veux être bête. Très, très bête.")], [{ kind: "flag", id: "pois-1" }]),
    },
    { talk: () => once([say("Petit Pois", "Tu sens la frite, toi. C'est trop cool. Attention aux gardes !")]) },
  ],
  "cite:panais": [
    {
      when: apres,
      talk: () => once([say("Vieux Panais", "Le Roi a retrouvé le sourire, et la cité ses frites. Mais ce « Cadran »… Méfie-toi des gens qui comptent le temps des autres, petit.")]),
    },
    {
      when: (r) => !flag(r, "panais-1"),
      talk: () =>
        once(
          [
            say("Vieux Panais", "Avant, cette place s'appelait la Place des Cornets. Il y coulait de l'huile chaude jour et nuit. Enfin, c'est ce qu'on raconte aux enfants."),
            say("Vieux Panais", "Le Roi adorait les frites. Il en mangeait au petit-déjeuner, au déjeuner, et entre les deux."),
            say("Vieux Panais", "Puis un étranger est venu. Costume impeccable. Une montre à la place du sourire. Il a offert au Roi une couronne neuve, avec une pierre qui brille…"),
            say("Vieux Panais", "Le lendemain : décret. Plus de frites. Plus de rires. « Du temps perdu », disait le Roi."),
            say(CH, "Une pierre qui brille… Élu, ton fragment d'horloge brille de la même façon."),
          ],
          [{ kind: "flag", id: "panais-1" }],
        ),
    },
    { talk: () => once([say("Vieux Panais", "Une pierre dans la couronne du Roi… Si c'est un morceau du temps, il faudra le lui reprendre. Poliment. Ou pas.")]) },
  ],
  "cite:tubercule": [
    { when: (r) => r.quests[G] === "terminee", talk: () => once([say("Mamie Tubercule", "Mes graines poussent déjà ! Dans un an, toute la cité mangera des frites de Mamie. Tu reviendras goûter, mon grand.")]) },
    {
      when: (r) => sachets(r) === 3,
      talk: () =>
        once(
          [
            say("Mamie Tubercule", "Mes trois sachets ! Tu les as tous retrouvés ! Oh, mon petit, viens que je t'embrasse. Non ? Bon, alors une poignée de main."),
            say("Mamie Tubercule", "Tiens, c'est le bracelet de mon défunt mari. Du gros sel tressé. Ça porte bonheur, et ça rend rapide. Lui, ça ne l'a pas empêché de glisser dans l'huile, mais bon."),
          ],
          [step("rendre", G), { kind: "drop", id: "graines" }, { kind: "gear", id: "bracelet-sel" }],
        ),
    },
    {
      when: (r) => flag(r, "graines-ok") || sachets(r) > 0,
      talk: (r) =>
        once([
          say("Mamie Tubercule", `Tu en as trouvé ${sachets(r)} sur 3. Les autres… Je me souviens d'une fontaine, d'un tonneau dans la ruelle, et d'un endroit qui sentait très mauvais.`),
        ]),
    },
    {
      talk: () => ({
        lines: [
          say("Mamie Tubercule", "Psst, jeune homme. Quand les gardes ont confisqué les pommes de terre, j'ai caché mes dernières graines. Trois sachets."),
          say("Mamie Tubercule", "Une fontaine sèche, un tonneau dans la Ruelle des Friteurs… et le troisième, je l'ai jeté dans un trou qui puait. Mes jambes ne me portent plus jusque-là."),
        ],
        choices: [
          {
            label: "Je vais les retrouver !",
            next: { lines: [say("Mamie Tubercule", "Quel gentil garçon. Mal habillé, mais gentil.")], effects: [{ kind: "quest", id: G }, { kind: "flag", id: "graines-ok" }] },
          },
          { label: "Pas le temps, Mamie.", next: { lines: [say("Mamie Tubercule", "Le temps, le temps… Tout le monde dit ça, depuis le décret.")] } },
        ],
      }),
    },
  ],
  "cite:garde-1": [
    {
      talk: () =>
        once([
          say("Garde Laitue", "Circulez. Le palais est fermé au public, aux frites, et aux gens qui sentent la frite."),
          say(S, "Je ne sens pas la frite."),
          say("Garde Laitue", "*renifle* … Circulez quand même."),
        ]),
    },
  ],
  "cite:garde-2": [
    {
      talk: () =>
        once([
          say("Garde Laitue", "Par ordre de Sa Majesté, personne n'entre. Même par les égouts. Surtout pas par les égouts. Oubliez que j'ai dit « égouts »."),
          say(CH, "Il vient de nous donner une excellente idée."),
        ]),
    },
  ],
  "cite:patrouille": [
    {
      when: (r) => !flag(r, "ko:patrouille"),
      talk: () => ({
        lines: [say("Soldat Brocoli", "CONTRÔLE ANTI-FRITURE ! Vous avez une odeur suspecte. Veuillez me suivre… au combat !")],
        then: { kind: "battle", id: "brocoli-cite" },
      }),
    },
    { talk: () => once([say("Soldat Brocoli", "…")]) },
  ],
  "cite:porte-1": [
    {
      when: (r) => !flag(r, "ko:porte-ruelle"),
      talk: () => ({
        lines: [
          say("Soldat Brocoli", "Halte ! La Ruelle des Friteurs est interdite ! Ordre du Roi !"),
          say("Soldat Brocoli", "Oui ! Interdite ! Et nous sommes DEUX ! Ça fait le double d'interdit !"),
          say(CH, "Deux brocolis. Ils se protègent l'un l'autre : il faudra les vaincre tous les deux."),
        ],
        then: { kind: "battle", id: "brocolis-porte" },
      }),
    },
    { talk: () => once([say("Soldat Brocoli", "…")]) },
  ],
  "cite:porte-2": [],
  "cite:roi-place": [
    {
      when: (r) => !flag(r, "frites-roi"),
      talk: () =>
        once(
          [
            say(ROI, "Élu ! Je distribue des frites pour me faire pardonner. Tiens, prends-en quelques cornets."),
            say(ROI, "Avec des légumes à côté, hein. Il ne faut pas exagérer. Enfin, un peu, si."),
          ],
          [{ kind: "bag", id: "frites", n: 3 }, { kind: "flag", id: "frites-roi" }],
        ),
    },
    { talk: () => once([say(ROI, "Je n'aurais jamais dû écouter ce Cadran. Les frites, ce n'est pas du temps perdu. C'est du temps BIEN utilisé.")]) },
  ],

  // ─── Maison Chou ───
  "maison-chou:chou": [
    {
      when: apres,
      talk: () => once([say("Madame Chou", "Les gardes ont rendu les friteuses ! Merci, Sparrow. Tu es toujours le bienvenu ici. Essuie tes pieds, quand même.")]),
    },
    {
      when: (r) => !did(r, F, "interdiction"),
      talk: () =>
        once(
          [
            say("Madame Chou", "Entrez, entrez ! Vite, avant qu'un garde ne vous voie. Vous avez lu le décret ?"),
            say(S, "Il paraît que les frites sont interdites. J'ai besoin de comprendre. Pour ma santé mentale."),
            say("Madame Chou", "Depuis que le Roi porte sa nouvelle couronne, il ne supporte plus rien de frit. Il dit que la friture « fait perdre du temps »."),
            say("Madame Chou", "Les gardes ont confisqué toutes les friteuses. Sauf une. Celle de Gérard la Frite, le dernier friturier libre de la cité."),
            say("Madame Chou", "Il se cache dans un marché clandestin, au fond de la Ruelle des Friteurs, à l'est. La porte ne s'ouvre qu'avec le mot de passe."),
            say("Madame Chou", "Le voici, sur ce ticket gras. Ne le perdez pas : on n'en imprime plus."),
          ],
          [step("interdiction"), { kind: "item", id: "mot-de-passe" }],
        ),
    },
    { talk: () => once([say("Madame Chou", "La Ruelle des Friteurs, à l'est de la place. Des gardes bloquent l'entrée. Le mot de passe est sur le ticket.")]) },
  ],

  // ─── Boutiques ───
  "herboristerie:persil": [{ talk: () => ({ lines: [say("Madame Persil", "Bienvenue à l'Herboristerie ! Tisanes, soupes, et un ketchup… strictement médical.")], then: { kind: "shop", id: "herboristerie" } }) }],
  "armurerie:navet": [{ talk: () => ({ lines: [say("Maître Navet", "Armurerie du Navet. Des armes solides comme une racine.")], then: { kind: "shop", id: "armurerie" } }) }],
  "restaurant:frida": [{ talk: () => ({ lines: [say("Frida la Friteuse", "Chut. Ici, on vend ce qui croustille.")], then: { kind: "shop", id: "marche-cache" } }) }],

  // ─── La Friterie Clandestine ───
  "restaurant:gerard": [
    {
      when: (r) => !did(r, F, "gerard"),
      talk: () => ({
        lines: [
          say(GE, "Qui va là ? Un garde ? Un brocoli déguisé ? Un inspecteur de la vitamine ?"),
          say(S, "Sparrow. Madame Chou m'envoie. Je viens pour… les frites. Et pour sauver le temps, accessoirement."),
          say(GE, "Gérard. Gérard la Frite. Dernier friturier libre de la cité. Croustillant dehors, fondant dedans."),
          say(GE, "Tu veux affronter le Roi ? Alors prouve-moi d'abord que tu sais faire des frites parfaites. Un friturier ne suit pas n'importe qui."),
        ],
        effects: [step("gerard")],
        choices: [
          { label: "Relever le défi !", next: { lines: [say(GE, "À la friteuse ! Sors chaque fournée quand elle est bien dorée. Pas avant. Pas après.")], then: { kind: "minigame", id: "frites" } } },
          { label: "Plus tard.", next: { lines: [say(GE, "Je ne bouge pas. Je suis une frite, je n'ai que ça à faire.")] } },
        ],
      }),
    },
    {
      talk: () => ({
        lines: [say(GE, "Alors, ces frites parfaites, ça vient ?")],
        choices: [
          { label: "À la friteuse !", next: { lines: [say(GE, "Bien dorées. Pas avant. Pas après.")], then: { kind: "minigame", id: "frites" } } },
          { label: "Pas encore.", next: { lines: [say(GE, "L'huile t'attend. Elle est patiente, l'huile.")] } },
        ],
      }),
    },
  ],
  "restaurant:lili-ombre": [
    {
      talk: () =>
        once(
          [
            say("???", "Jolies frites. Dommage que le Roi ait d'autres projets pour sa couronne."),
            say(S, "Vous êtes qui, vous ? Il y a une règle dans cette aventure : les gens mystérieux doivent se présenter."),
            say("???", "Personne. Pas encore. Mais je garde un œil sur toi, l'Élu."),
            say("", "La silhouette remonte sa capuche violette et se glisse par la fenêtre. Plus personne."),
          ],
          [{ kind: "flag", id: "lili-vue" }],
        ),
    },
  ],
  "restaurant:client": [
    { when: apres, talk: () => once([say("Client masqué", "J'enlève mon masque ! Je suis Monsieur Poireau, et je MANGE DES FRITES EN PUBLIC !")]) },
    { talk: () => once([say("Client masqué", "Je ne suis pas là. Vous ne m'avez pas vu. Ces frites ne sont pas à moi.")]) },
  ],

  // ─── Égouts ───
  "egouts:patate": [
    {
      when: (r) => !flag(r, "ko:patate-egout"),
      talk: () => ({
        lines: [say("Patate Renégate", "Gnnnh ! Des intrus dans NOS égouts ! Le Roi nous a promis des chips si on gardait le passage !")],
        then: { kind: "battle", id: "patate-1" },
      }),
    },
    { talk: () => once([say("Patate Renégate", "…")]) },
  ],
  "egouts:patates-1": [
    {
      when: (r) => !flag(r, "ko:patates"),
      talk: () => ({
        lines: [say("Patate Renégate", "Halte ! L'échelle du palais est gardée ! Par nous ! Les Patates Renégates !"), say("Patate Renégate", "Et on est en bande. Comme des frites. Mais en patates.")],
        then: { kind: "battle", id: "patate-2" },
      }),
    },
    { talk: () => once([say("Patate Renégate", "…")]) },
  ],
  "egouts:patates-2": [],
  "egouts:repentie": [
    {
      talk: () =>
        once(
          [
            say("Patate repentie", "Je… j'ai honte. Le Roi nous a promis des chips. Des chips ! On a trahi notre propre famille."),
            say("Patate repentie", "Tiens, prends mon pin's. Il porte bonheur. Moi, il ne m'a pas porté bonheur, mais toi, peut-être."),
          ],
          [{ kind: "gear", id: "pin-patate" }, { kind: "flag", id: "pin-donne" }],
        ),
    },
  ],

  // ─── Palais ───
  "palais:ronde": [
    {
      when: (r) => !flag(r, "ko:ronde"),
      talk: () => ({ lines: [say("Garde Laitue", "INTRUS ! Au nom de Sa Majesté Verte, je vais vous croquer !")], then: { kind: "battle", id: "laitue-1" } }),
    },
    { talk: () => once([say("Garde Laitue", "…")]) },
  ],
  "palais:porte-trone": [
    {
      when: (r) => has(r, "uniforme"),
      talk: () =>
        once(
          [
            say("Garde Laitue", "Halte ! Qui va l… Ah. Une nouvelle recrue. Ton uniforme est de travers. Et ton ami en armure noire ?"),
            say(CH, "… Je suis la nouvelle mode de la garde."),
            say("Garde Laitue", "Ah. D'accord. Passez. Le Roi est d'humeur vinaigrette, aujourd'hui."),
          ],
          [{ kind: "flag", id: "passe-garde" }],
        ),
    },
    {
      talk: () => ({
        lines: [
          say("Garde Laitue", "Halte ! Personne ne voit le Roi sans uniforme ! … Attendez. Vous sentez… LA FRITE !"),
          say("Soldat Brocoli", "ALERTE ! ALERTE FRITURE !"),
        ],
        then: { kind: "battle", id: "laitue-2" },
      }),
    },
  ],
  "palais:porte-trone-2": [{ talk: () => once([say("Soldat Brocoli", "Je garde la porte avec mon collègue. Lui, il décide. Moi, je fais « hmm ».")]) }],
  "palais:roi": [
    {
      when: (r) => !flag(r, "roi-1"),
      talk: () => ({
        lines: [
          say(ROI, "QUI OSE ? Qui ose entrer dans ma salle du trône avec… cette odeur ?"),
          say(S, "Sparrow. Et oui, c'est de la friture. Je suis venu rendre les frites au peuple."),
          say(ROI, "Les frites sont du TEMPS PERDU ! Chaque minute passée à grignoter est une minute volée à… à…"),
          say(CH, "À qui, Majesté ?"),
          say(ROI, "Peu importe ! Ma couronne me dit que j'ai raison ! Elle brille quand j'ai raison ! Et elle brille TOUT LE TEMPS !"),
          say(GE, "Votre Majesté, autrefois, vous mangiez mes frites trois fois par jour…"),
          say(ROI, "SILENCE, TUBERCULE ! Gardes ! … Ah, il n'y a plus de gardes. Très bien. Je vais m'en occuper MOI-MÊME !"),
        ],
        effects: [{ kind: "flag", id: "roi-1" }],
        then: { kind: "battle", id: "roi-salade" },
      }),
    },
    {
      talk: () => ({
        lines: [say(ROI, "Encore toi ? Ma couronne brille plus fort que ta manette, Élu. EN GARDE !")],
        then: { kind: "battle", id: "roi-salade" },
      }),
    },
  ],
  "palais:lili": [{ talk: () => once([say(LILI, "…")]) }],
};

// ─── Objets du décor ───

const THINGS: Chapter["things"] = {
  "cite:decret": (r) => ({
    lines: [
      say("", "« DÉCRET ROYAL N°1 — Par ordre de Sa Majesté le Roi de la Salade : LA FRITE EST INTERDITE. »"),
      say("", "« Article 2 : la pomme de terre ne peut être consommée que bouillie, sans sel, et en silence. »"),
      say("", "« Article 3 : tout rire en public est considéré comme du temps perdu. »"),
      ...(flag(r, "decret-lu") ? [] : [say(S, "Interdire les frites ET le rire. Ce roi a un problème. Il faut que quelqu'un m'explique.")]),
    ],
    effects: [{ kind: "flag", id: "decret-lu" }],
  }),
  "cite:statue": () => once([say("", "Une statue du Roi de la Salade. Sur le socle : « À NOTRE ROI, QUI NOUS A SAUVÉS DU GRAS ». En dessous, quelqu'un a gravé : « et du goût »."), say(S, "J'aime bien ce quelqu'un.")]),
  "cite:fontaine-seche": (r) =>
    did(r, G, "sachet-1")
      ? once([say("", "La fontaine des Cornets, à sec. On raconte qu'avant, il en coulait de l'huile chaude. C'était sûrement une légende. Sûrement.")])
      : once(
          [say("", "La fontaine est à sec depuis le décret. Au fond du bassin, sous des feuilles mortes… un petit sachet en papier !"), say(S, "Des graines de pommes de terre. Mamie Tubercule en cherchait.")],
          sachet(1, "fontaine"),
        ),
  "cite:tonneau-sachet": (r) =>
    did(r, G, "sachet-2")
      ? once([say("", "Un tonneau vide. Il sent le vinaigre.")])
      : once([say("", "Tu soulèves le couvercle du tonneau… Un sachet de graines, bien caché sous des épluchures !")], sachet(2, "tonneau")),
  "cite:plaque": (r) =>
    !has(r, "cle-egouts")
      ? once([say("", "Une plaque d'égout fermée par un cadenas royal. Il faudrait une clé."), ...(did(r, F, "cuisine") ? [] : [say(CH, "Les égouts passent sous toute la cité. Jusqu'au palais, sans doute.")])])
      : {
          lines: [say("", "La clé de Gérard tourne dans le cadenas. La plaque se soulève. Une odeur… intéressante monte des profondeurs.")],
          choices: [
            { label: "Descendre", next: { lines: [say(S, "Bon. On respire par la bouche, et on y va.")], then: { kind: "warp", to: { map: "egouts", x: 2, y: 2, dir: "down" } } } },
            { label: "Pas maintenant", next: { lines: [say(S, "Je reviendrai. Avec un pince-nez.")] } },
          ],
        },
  "cite:etal": () => once([say("", "Des légumes. Rien que des légumes. Une étiquette : « PROMO : LE CÉLERI À 1 FP ». Personne n'achète.")]),
  "cite:affiche": (_r, text) =>
    once([say("", text?.includes("GÉRARD") ? "« ON RECHERCHE : GÉRARD LA FRITE. Signe distinctif : croustillant. Récompense : un sac de céleri. »" : `« ${text ?? "…"} »`)]),
  "cite:pancarte": (_r, text) => once([say("", text === "MANGEZ VERT" ? "« MANGEZ VERT. PENSEZ VERT. RÊVEZ VERT. » Quelqu'un a ajouté au feutre : « RÊVEZ FRIT »." : `« ${text ?? "…"} »`)]),
  "cite:caisse": () => once([say("", "Une caisse de navets. Ils te regardent. Enfin, tu as l'impression.")]),
  "cite:tonneau": () => once([say("", "Un tonneau de vinaigre. Le parfum officiel de la cité.")]),

  "maison-chou:bibliotheque": () => once([say("", "« 101 recettes au chou ». « Le chou et vous ». « Mon chou, ma vie ». Une vraie passion.")]),
  "maison-chou:lit-int": () => once([say(S, "Un lit bien fait. Je n'ai pas fait le mien depuis 23:59. Ni avant.")]),
  "herboristerie:comptoir": () => once([say("", "Le comptoir de l'herboristerie. Ça sent la menthe et le secret.")]),
  "armurerie:comptoir": () => once([say("", "Le comptoir de l'armurerie. Une spatule en exposition brille d'un éclat inquiétant.")]),
  "restaurant:cuisiniere": () => once([say("", "La friteuse de Gérard. L'huile chante doucement. C'est la plus belle chanson du monde.")]),
  "restaurant:comptoir": () => once([say("", "Le comptoir de la friterie. Il colle un peu. Bon signe.")]),
  "restaurant:etal": () => once([say("", "L'étal de Frida : des cornets, des sauces, et une odeur qui ferait pleurer un brocoli.")]),
  "restaurant:table": () => once([say("", "Une assiette de frites abandonnée. Tu résistes. Héroïquement. Pendant une seconde.")]),

  "egouts:vanne-1": (r) => vanne(r, 1),
  "egouts:vanne-2": (r) => vanne(r, 2),
  "egouts:vanne-3": (r) => vanne(r, 3),
  "egouts:indice-vannes": () => once([say("", "Une plaque gravée, couverte de mousse : « GAUCHE OUVERTE · MILIEU FERMÉ · DROITE OUVERTE ». Plus bas : « et ne buvez pas l'eau ».")]),
  "egouts:echelle-cite": () => ({
    lines: [say("", "Une échelle rouillée remonte vers la Ruelle des Friteurs.")],
    choices: [
      { label: "Remonter", next: { lines: [], then: { kind: "warp", to: { map: "cite", x: 37, y: 18, dir: "down" } } } },
      { label: "Rester", next: { lines: [say(S, "On continue. Le palais est par là, quelque part.")] } },
    ],
  }),
  "egouts:echelle-palais": (r) => ({
    lines: [say("", "Une échelle monte vers une trappe. Au-dessus, on entend des pas lourds et… quelqu'un qui croque du céleri."), ...(did(r, F, "egouts") ? [] : [say(CH, "Le palais. Nous y sommes, Élu.")])],
    effects: [step("egouts")],
    choices: [
      { label: "Monter", next: { lines: [], then: { kind: "warp", to: { map: "palais", x: 3, y: 14, dir: "down" } } } },
      { label: "Pas encore", next: { lines: [say(S, "Deux minutes. Je me prépare mentalement. Et physiquement. Surtout mentalement.")] } },
    ],
  }),
  "egouts:caisse-sachet": (r) =>
    did(r, G, "sachet-3")
      ? once([say("", "Une caisse vide. Elle sent encore plus mauvais que le reste. C'est un exploit.")])
      : once([say("", "Dans une caisse qui flotte presque, un sachet de graines, miraculeusement sec !"), say(S, "Mamie Tubercule, tu me dois une vraie douche.")], sachet(3, "egout")),
  "egouts:coffre-egout": (r) =>
    flag(r, "coffre-egout")
      ? once([say("", "Le coffre est vide.")])
      : once(
          [say("", "Un coffre de contrebandier ! Dedans : un Méga-cornet et une Sauce piquante.")],
          [
            { kind: "flag", id: "coffre-egout" },
            { kind: "bag", id: "mega-cornet", n: 1 },
            { kind: "bag", id: "sauce-piquante", n: 1 },
          ],
        ),
  "egouts:tonneau": () => once([say("", "Un tonneau de chips. Le salaire des Patates Renégates, sans doute.")]),

  "palais:armoire": (r) =>
    has(r, "uniforme")
      ? once([say("", "L'armoire des gardes. Il ne reste que des chaussettes vertes.")])
      : once(
          [
            say("", "Dans l'armoire : un uniforme de Garde Laitue, plié avec soin. Il gratte rien qu'à le regarder."),
            say(S, "Un déguisement. Parfait. Personne ne remarquera un gamer barbu en armure de salade."),
            say(CH, "Je garde mon armure, merci. J'ai une réputation."),
          ],
          [{ kind: "item", id: "uniforme" }],
        ),
  "palais:echelle-cave": () => ({
    lines: [say("", "L'échelle redescend dans les égouts.")],
    choices: [
      { label: "Redescendre", next: { lines: [], then: { kind: "warp", to: { map: "egouts", x: 26, y: 11, dir: "down" } } } },
      { label: "Rester", next: { lines: [] } },
    ],
  }),
  "palais:coffre-palais": (r) =>
    flag(r, "coffre-palais")
      ? once([say("", "Le coffre est vide.")])
      : once([say("", "Le coffre du trésor royal ! Dedans : deux Ketchups de rappel et une Part de pizza. Le Roi en cachait ? Hypocrite.")], [
          { kind: "flag", id: "coffre-palais" },
          { kind: "bag", id: "ketchup", n: 2 },
          { kind: "bag", id: "part-pizza", n: 1 },
        ]),
  "palais:trone": (r) => once([say("", apres(r) ? "Le trône est vide. Des miettes de frites traînent déjà sur le coussin." : "Le trône du Roi. Il y a des miettes de croûtons partout.")]),
  "palais:lit-int": () => once([say(S, "Le dortoir des gardes. Les draps sont en feuilles de laitue. Ça doit être frais, l'été.")]),
  "palais:caisse": () => once([say("", "Une caisse marquée « CROÛTONS — RÉSERVE PERSONNELLE DU ROI ».")]),
  "palais:tonneau": () => once([say("", "Un tonneau de vinaigrette royale. Attention : très acide.")]),
};

function vanne(r: Rpg, n: 1 | 2 | 3): Conversation {
  const id = `vanne-${n}`;
  const open = flag(r, id);
  const next: Rpg = { ...r, flags: open ? r.flags.filter((f) => f !== id) : [...r.flags, id] };
  const solvedNow = vannesOk(next) && !vannesOk(r);
  return {
    lines: [
      say("", `Tu tournes la vanne ${["de gauche", "du milieu", "de droite"][n - 1]}… Elle est maintenant ${open ? "FERMÉE" : "OUVERTE"}.`),
      ...(solvedNow ? [say("", "Un grand bruit de vidange résonne dans les tunnels… Plus loin, le courant s'est calmé !"), say(CH, "Bien joué, Élu. Le passage vers l'est est libre.")] : []),
    ],
    effects: [{ kind: open ? "unflag" : "flag", id }],
  };
}

// ─── Moments scénarisés ───

function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  if (map === "cite" && !did(r, F, "route"))
    return {
      lines: [
        say("", "Au bout de la route, des remparts. Des toits verts. Une coupole dorée. Et une odeur… de céleri."),
        say(S, "La Cité des Frites Perdues. Le nom promettait plus de frites."),
        say(CH, "Restons discrets, Élu. Les soldats légumes patrouillent. Cherchons d'abord à comprendre ce qui se passe ici."),
      ],
      effects: [step("route")],
    };
  if (!first) return null;
  if (map === "restaurant")
    return once([
      say("Frida la Friteuse", "Bienvenue à la Friterie Clandestine. Ici, on frit en silence et on mange en cachette."),
      say(S, "Cette odeur… Je crois que je vais pleurer."),
    ]);
  if (map === "egouts") return once([say(S, "Les égouts. Ça sent la patate abandonnée et les mauvaises décisions."), say(CH, "Il y a des vannes sur ce mur. Elles commandent peut-être le courant.")]);
  if (map === "palais") return once([say("", "Les caves du palais. Ça sent le vinaigre et l'autorité."), say(CH, "Silence. Les gardes ne doivent pas nous voir… ou alors, il faudrait leur ressembler.")]);
  return null;
}

function afterBattle(id: string, r: Rpg): Conversation | null {
  if (id === "brocolis-porte")
    return once([say("", "Les deux Soldats Brocoli s'enfuient en roulant."), say(CH, "La ruelle est libre. La porte de l'échoppe, au fond… c'est sûrement là.")]);
  if (id === "patate-1")
    return once([say("", "La Patate Renégate s'écroule… puis se relève, honteuse, et s'éloigne vers un recoin du tunnel."), say(S, "Elle a l'air de vouloir parler. Plus tard, peut-être.")]);
  if (id === "laitue-2") return once([say(CH, "La porte de la salle du trône est libre. Le Roi est juste derrière.")]);
  if (id === "roi-salade")
    return {
      lines: [
        say(ROI, "Non… non… Ma couronne… Elle ne brille plus…"),
        say("", "Le Roi de la Salade tombe à genoux. Une pierre lumineuse se détache de sa couronne et roule jusqu'aux pieds de Sparrow."),
        say(S, "Un fragment d'horloge. Le même que le mien. Il vibre…"),
        say(ROI, "Pitié ! Ce n'était pas mon idée ! C'était… EUX. Le Cadran."),
        say(CH, "Le Cadran ?"),
        say(ROI, "Une organisation. Ils ont des agents partout. Un homme en costume m'a offert cette pierre contre une promesse : que la cité arrête de perdre son temps."),
        say(ROI, "Plus de frites, plus de rires, plus de pauses. Il disait que le temps des autres lui appartenait. Il signait ses lettres d'un simple « M »."),
        say(GE, "Une lettre ? Où est-elle, Majesté ?"),
        say(ROI, "Là, dans ma cape, je…"),
      ],
      effects: [{ kind: "flag", id: "lili-trone" }],
      then: { kind: "scene", id: "lili" },
    };
  return null;
}

/** Scènes enchaînées après un dialogue (`then: { kind: "scene" }`). */
function scene(id: string): Conversation | null {
  if (id === "lili")
    return {
      lines: [
        say("", "Une silhouette en capuche violette tombe du lustre, arrache la lettre de la cape du Roi… et atterrit sur le trône."),
        say(LILI, "Merci pour le coup de main, les garçons. Je cherchais ce papier depuis des semaines."),
        say(S, "Toi ! La fille de la friterie !"),
        say(LILI, "Lili. Voleuse professionnelle, acrobate amateur. Ce qui brille m'intéresse, et ce qui est écrit encore plus."),
        say(GE, "Lili… la Fantôme des Toits ! Elle vole tout ce qui brille. Et ce qui ne brille pas aussi."),
        say(LILI, "Garde ton fragment, l'Élu. Moi, je garde la lettre. Le Cadran ne pardonne pas à ceux qui fouillent dans ses affaires… alors on verra qui court le plus vite."),
        say("", "Un nuage de poudre violette. Quand il se dissipe, Lili a disparu. Il ne reste qu'un coin de page arraché sur le trône."),
        say(S, "Un cadran sans aiguilles… et un mot : « PROTOCOLE ». C'est tout."),
        say(ROI, "Je… je lève le décret. Les frites sont de nouveau autorisées. Prenez cette fourchette : c'était celle du friturier royal. Elle est à vous."),
        say(CH, "Deux fragments, Élu. Et un ennemi qui a enfin un nom."),
      ],
      effects: [
        { kind: "flag", id: "lili-partie" },
        { kind: "item", id: "note-cadran" },
        { kind: "gear", id: "fourchette-sacree" },
        { kind: "bag", id: "mega-cornet", n: 2 },
        step("roi"),
      ],
    };
  return null;
}

/** Après le mini-jeu de cuisine. */
export function afterMinigame(id: string, ok: boolean, r: Rpg): Conversation | null {
  if (id !== "frites") return null;
  if (!ok)
    return once([
      say(GE, "Hmm. Trop pâles, ou trop brûlées. Une frite, c'est comme une amitié : ça ne se rate pas deux fois. Enfin si, on peut réessayer. Reviens me voir."),
    ]);
  if (avecGerard(r)) return once([say(GE, "Toujours la main, hein ? Ça fait plaisir.")]);
  return once(
    [
      say(GE, "… Dorées. Croustillantes. Fondantes. Ce sont… des frites parfaites."),
      say(GE, "Ça faisait longtemps que je n'avais pas eu envie de pleurer d'huile. Très bien, Sparrow. Je viens avec toi."),
      say(GE, "Et je t'apprends ma botte secrète : la Pluie de frites. Et prends cette clé : elle ouvre la plaque d'égout de la ruelle. Les égouts mènent sous le palais."),
      say(CH, "Un friturier dans l'équipe. Voilà qui change tout. Et qui sent bon."),
    ],
    [step("cuisine"), { kind: "join", id: "gerard" }, { kind: "skill", id: "pluie-frites" }, { kind: "item", id: "cle-egouts" }, { kind: "bag", id: "frites", n: 2 }],
  );
}

/** Effets d'une zone découverte (quêtes). */
export function zoneEffects(zone: string): Effect[] {
  if (zone === "palais-trone") return [step("palais")];
  return [];
}

/** Clés de dialogue des portes fermées. */
const LOCKED: Chapter["things"] = {
  "cite:porte-secrete": (r) => ({
    lines: [say("", "Tu frappes à la porte de l'échoppe. Un petit judas s'ouvre. Une voix : « Mot de passe ? »")],
    choices: [
      ...(has(r, "mot-de-passe")
        ? [
            {
              label: "« Croustillant dehors, fondant dedans. »",
              next: {
                lines: [say("", "« … Entre. Et essuie tes pieds, on a fait le ménage. »")],
                effects: [{ kind: "flag", id: "porte-secrete" } as Effect],
                then: { kind: "warp" as const, to: { map: "restaurant" as const, x: 7, y: 8, dir: "up" as const } },
              },
            },
          ]
        : []),
      { label: "« Salade ? »", next: { lines: [say("", "« Mauvaise réponse. Très mauvaise. » Le judas se referme.")] } },
      { label: "« Je suis l'Élu de la Minute. »", next: { lines: [say("", "« Et moi je suis la Reine de la Mayonnaise. Dégage. »")] } },
    ],
  }),
  "cite:palais-porte": (r) =>
    once([
      say("Garde Laitue", "Le palais est fermé ! Personne n'entre par la grande porte !"),
      ...(did(r, F, "interdiction") && !did(r, F, "egouts") ? [say(CH, "Il doit exister un autre chemin. Par en dessous, peut-être.")] : []),
    ]),
  "palais:palais-sortie": () => once([say("", "La grande porte est barrée de l'intérieur. La clé est sûrement chez le Roi.")]),
};

// Les deux gardes d'un même groupe parlent d'une seule voix.
NPCS["cite:porte-2"] = NPCS["cite:porte-1"];
NPCS["egouts:patates-2"] = NPCS["egouts:patates-1"];

export const CH2: Chapter & { scene: typeof scene; zoneEffects: typeof zoneEffects; afterMinigame: typeof afterMinigame } = {
  npcs: NPCS,
  things: { ...THINGS, ...LOCKED },
  arrival,
  afterBattle,
  scene,
  zoneEffects,
  afterMinigame,
};

/** Carte de fin de chapitre. */
export const CH2_CARD = ["CHAPITRE 2 TERMINÉ", "LA CITÉ DES FRITES PERDUES", "+300 XP · +250 FP", "Objet : Fragment d'horloge n°2", "Prochain chapitre : La Confrérie du Muscle"];

/** Pour les tests : les clés de dialogue exposées. */
export const CH2_KEYS = { npcs: Object.keys(NPCS), things: Object.keys({ ...THINGS, ...LOCKED }) };
