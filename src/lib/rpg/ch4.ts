/**
 * RPG — chapitre 4 : La Voie du Samouraï (dialogues, mix de Pokeyz, scènes).
 *
 * Quête principale « samourai » (8 étapes) et quête secondaire « lampions ».
 * Au village de Kyūkei, la fête des lanternes ne s'arrête plus : le Métronome impose
 * un tempo sans fin et les danseurs n'ont plus droit à la moindre pause. Pokeyz, le pote DJ
 * de Sparrow, est coincé derrière ses platines. Au dojo, Maître Katsu garde le 4ᵉ fragment.
 */

import { LAMPIONS, metronomeVaincu } from "./kyukei";
import type { Effect } from "./quest";
import type { Rpg } from "./state";
import type { Chapter, Conversation, Rule } from "./talk";

const Q = "samourai";
const LA = "lampions";
const S = "Sparrow";
const CH = "Chevalier Noir";
const GE = "Gérard la Frite";
const LILI = "Lili";
const PO = "Pokeyz";
const ME = "Le Métronome";
const KA = "Maître Katsu";
const SE = "Madame Sencha";
const MA = "Mamie Matcha";

const flag = (r: Rpg, f: string) => r.flags.includes(f);
const has = (r: Rpg, i: string) => r.items.includes(i);
const did = (r: Rpg, s: string, q = Q) => r.done.includes(`${q}:${s}`);
const step = (s: string, q = Q): Effect => ({ kind: "step", quest: q, step: s });
const say = (who: string, text: string) => ({ who, text });
const once = (lines: Conversation["lines"], effects?: Effect[]): Conversation => ({ lines, effects });
const fini = (r: Rpg) => r.quests[Q] === "terminee";
const chevalier = (r: Rpg, text: string) => (r.party.includes("chevalier") ? [say(CH, text)] : []);

const VINYLES = ["vinyle-1", "vinyle-2", "vinyle-3"];
export const vinyles = (r: Rpg) => VINYLES.filter((v) => has(r, v)).length;
/** Donne un vinyle ; le troisième valide l'étape « vinyles ». */
const vinyle = (r: Rpg, id: string): Effect[] => [
  { kind: "item", id },
  ...(VINYLES.filter((v) => v !== id).every((v) => has(r, v)) ? [step("vinyles")] : []),
];
const allumes = (r: Rpg) => LAMPIONS.filter((n) => flag(r, `lampion-${n}`)).length;

/** Le mix de Pokeyz : lancé depuis lui ou depuis ses platines, une fois les trois vinyles réunis. */
const mix = (): Conversation => ({
  lines: [
    say(PO, "Les trois sont là. « Pause Café », « Grasse Matinée » et « Dimanche Soir ». Mes trois meilleurs morceaux. Tous très lents."),
    say(PO, "On va mixer à deux. Moi je cale le tempo, toi tu tapes les temps. Si on tient le groove, les danseurs vont enfin pouvoir souffler entre deux morceaux."),
    say(S, "Je n'ai jamais mixé de ma vie. Mais j'ai déjà appuyé sur des boutons au bon moment. Beaucoup. Pendant des années."),
  ],
  choices: [
    { label: "Lancer le mix !", next: { lines: [], then: { kind: "minigame", id: "rythme" } } },
    { label: "Pas encore.", next: { lines: [say(PO, "Prends ton temps. Enfin… ici personne n'a le droit. Mais toi, si.")] } },
  ],
});

const NPCS: Record<string, Rule[]> = {
  // ─── Chemin des Cerisiers ───
  "cerisiers:pelerin": [
    { when: fini, talk: () => once([say("Pèlerin essoufflé", "On dit que la fête s'est arrêtée. Enfin, qu'elle fait des pauses. Je vais peut-être y retourner. Assis.")]) },
    {
      talk: () =>
        once([
          say("Pèlerin essoufflé", "Ne va pas au village… Enfin, si, vas-y. Mais ne danse pas. Surtout, ne danse pas."),
          say("Pèlerin essoufflé", "La fête des lanternes dure depuis des jours. Le Métronome, sur la grande scène, interdit aux gens de s'arrêter entre deux morceaux."),
          say("Pèlerin essoufflé", "Il y a un jeune DJ coincé derrière les platines, avec un casque. Il a l'air sympa. Et très, très fatigué."),
          say(S, "Un DJ avec un casque… Non. Ce serait trop gros."),
        ]),
    },
  ],
  "cerisiers:sbire": [
    {
      when: (r) => !flag(r, "ko:sbire"),
      talk: () => ({ lines: [say("Sbire du Métronome", "UN, DEUX, TROIS, QUATRE ! On ne marche pas, ici, on avance EN RYTHME !")], then: { kind: "battle", id: "sbire-1" } }),
    },
    { talk: () => once([say("Sbire du Métronome", "Un… deux… je… je peux m'asseoir ?")]) },
  ],
  "cerisiers:lanterne": [
    {
      when: (r) => !flag(r, "ko:lanterne"),
      talk: () => ({ lines: [say("Lanterne Folle", "FSHHH ! *La lanterne de papier tourbillonne sur elle-même et crache des étincelles.*")], then: { kind: "battle", id: "lanterne-1" } }),
    },
    { talk: () => once([say("Lanterne Folle", "…fshh.")]) },
  ],

  // ─── Village de Kyūkei ───
  "village:pokeyz": [
    {
      when: (r) => did(r, "mix") && !metronomeVaincu(r),
      talk: () => once([say(PO, "Le Métronome est furax ! Il est descendu de la scène ! Fonce, Sparrow, je te couvre au son !")]),
    },
    { when: (r) => did(r, "vinyles") || vinyles(r) === 3, talk: () => mix() },
    {
      when: (r) => did(r, "pokeyz"),
      talk: (r) =>
        once([
          say(PO, `Mes vinyles, Sparrow ! Tu en as ${vinyles(r)} sur 3.`),
          ...(!has(r, "vinyle-1") ? [say(PO, "Deux sbires dansent en boucle sur la place, au sud. Ils ont piqué « Pause Café ».")] : []),
          ...(!has(r, "vinyle-2") ? [say(PO, "Le tambour possédé, dans le jardin à l'est, s'est assis sur « Grasse Matinée ». Enfin, il roule dessus.")] : []),
          ...(!has(r, "vinyle-3") ? [say(PO, "Le dernier a volé quand le Métronome a jeté mon bac. Il est tombé du côté de l'auberge, à l'ouest.")] : []),
        ]),
    },
    {
      talk: () =>
        once(
          [
            say(PO, "… Sparrow ? SPARROW ! Frérot ! Qu'est-ce que tu fais là, à minuit moins une, au milieu des cerisiers ?"),
            say(S, "POKEYZ ?! C'est plutôt à moi de te demander ça ! Tu mixes pour des danseurs en forme de légumes, maintenant ?"),
            say(PO, "J'avais une date au festival des lanternes. Une belle soirée. Et puis 23:59, et puis lui est arrivé."),
            say(PO, "Le Métronome. Il a pris mes trois vinyles les plus lents et il m'oblige à passer le même morceau en boucle. 136 BPM. Sans aucune pause."),
            say(PO, "Les danseurs ne peuvent plus s'arrêter. Moi non plus : si je retire la main des platines, il me regarde. Tic. Tac. C'est horrible."),
            say(LILI, "Sur la liste du Cadran, il y a un « Métronome — gardien de la porte du dojo ». C'est lui qui bloque l'accès à Maître Katsu."),
            say(PO, "Rapporte-moi mes trois vinyles, et on lui fait un mix dont il se souviendra. Un mix avec des PAUSES dedans."),
            say(S, "Pokeyz, mon frère, pour toi je ferais n'importe quoi. Même marcher."),
          ],
          [step("pokeyz")],
        ),
    },
  ],
  "village:metronome": [
    { when: (r) => did(r, "mix"), talk: () => ({ lines: [say(ME, "Tic. Tac. Tic. Tac. Tu oses revenir ? Reprenons la mesure.")], then: { kind: "battle", id: "metronome" } }) },
    {
      talk: (r) =>
        once([
          say(ME, "Tic. Tac. Tic. Tac. Un visiteur qui marche à contretemps. C'est insupportable."),
          say(ME, "Ici, on danse. Toujours. Une pause, c'est un temps perdu. Et tous les temps perdus, je les envoie à Monsieur M."),
          say(S, "« Monsieur M. »… Gonflax parlait d'un homme en costume qui s'appelait M."),
          ...chevalier(r, "Le Cadran, encore. Il récolte toutes les pauses du monde, Élu."),
          say(ME, "Tic. Tac. Tu n'entreras pas au dojo. Danse, ou va-t'en."),
        ]),
    },
  ],
  "village:danseur-1": [
    { when: metronomeVaincu, talk: () => once([say("Danseur fatigué", "Je… je suis assis. Par terre. Et c'est le meilleur moment de ma vie.")]) },
    { talk: () => once([say("Danseur fatigué", "Pas chassé, pas chassé, tourne… Ne me parle pas, je n'ai pas le droit de rater un temps !")]) },
  ],
  "village:danseur-2": [
    { when: metronomeVaincu, talk: () => once([say("Danseuse épuisée", "Entre deux morceaux, il y a un petit silence. Je l'avais oublié. C'est là qu'on respire.")]) },
    { talk: () => once([say("Danseuse épuisée", "Mes pieds dansent tout seuls. Moi, ça fait longtemps que je suis partie dormir dans ma tête.")]) },
  ],
  "village:danseur-3": [
    { when: metronomeVaincu, talk: () => once([say("Danseur en boucle", "Je ne suis plus en boucle. Je suis juste un danseur. Un danseur qui s'arrête quand il veut.")]) },
    { talk: () => once([say("Danseur en boucle", "Avant, après, avant, après, avant, après…")]) },
  ],
  "village:matcha": [
    {
      when: (r) => did(r, "merci", LA),
      talk: () => once([say(MA, "Mes lampions brillent, la fête respire. Reviens quand tu veux, mon grand. Il y aura toujours un bol de thé.")]),
    },
    {
      when: (r) => allumes(r) === LAMPIONS.length,
      talk: () =>
        once(
          [
            say(MA, "Les quatre lampions sont rallumés ! Regarde, même les danseurs ont levé la tête."),
            say(MA, "Tiens, prends ces boulettes de riz. Je les ai faites avant le début de la fête. Elles sont encore bonnes : rien ne refroidit, à minuit moins une."),
          ],
          [step("allumer", LA), step("merci", LA), { kind: "bag", id: "onigiri", n: 3 }, { kind: "bag", id: "the-vert", n: 2 }],
        ),
    },
    {
      when: (r) => did(r, "rencontre", LA),
      talk: (r) => once([say(MA, `Encore ${LAMPIONS.length - allumes(r)} lampion${LAMPIONS.length - allumes(r) > 1 ? "s" : ""} à rallumer, aux quatre coins de la place.`)]),
    },
    {
      talk: () =>
        once(
          [
            say(MA, "Ah, un jeune homme qui ne danse pas. Ça repose les yeux."),
            say(MA, "Le Métronome a soufflé mes quatre lampions, aux coins de la place. Il dit que la lumière ralentit les danseurs."),
            say(MA, "Une fête des lanternes sans lanternes… Si tu les rallumes, je te ferai un petit quelque chose."),
            say(GE, "Je peux frotter deux frites l'une contre l'autre. Ça marche, je l'ai vu dans un documentaire."),
          ],
          [{ kind: "quest", id: LA }, step("rencontre", LA)],
        ),
    },
  ],
  "village:wasabi": [
    { when: fini, talk: () => once([say("Monsieur Wasabi", "Le dojo est calme, le village aussi. Même moi, je suis moins piquant.")]) },
    { when: metronomeVaincu, talk: () => once([say("Monsieur Wasabi", "Le dojo est ouvert. Maître Katsu ne reçoit qu'un visiteur par siècle. Ça doit être toi.")]) },
    {
      talk: () =>
        once([
          say("Monsieur Wasabi", "Le dojo, là-haut à droite ? Fermé depuis le début de la fête. Le Métronome en garde l'entrée."),
          say("Monsieur Wasabi", "Le jeune DJ derrière les platines dit qu'il te connaît. Tu devrais aller le voir, il a une tête à faire pitié."),
        ]),
    },
  ],
  "village:sbires-1": [
    {
      when: (r) => !flag(r, "ko:sbires"),
      talk: () => ({ lines: [say("Sbire du Métronome", "UN-DEUX ! UN-DEUX ! Ce vinyle est confisqué ! Trop lent ! Beaucoup trop lent !")], then: { kind: "battle", id: "sbires-2" } }),
    },
    { talk: () => once([say("Sbire du Métronome", "Un… deux… pause ?")]) },
  ],
  "village:sbires-2": [],
  "village:tambour": [
    {
      when: (r) => !flag(r, "ko:tambour"),
      talk: () => ({ lines: [say("Tambour possédé", "BOUM. BOUM. BOUM. BOUM. *Il ne s'arrête jamais. Sous lui, on aperçoit un disque.*")], then: { kind: "battle", id: "tambour-1" } }),
    },
    { talk: () => once([say("Tambour possédé", "…boum.")]) },
  ],

  // ─── Auberge ───
  "auberge:sencha": [
    {
      when: (r) => !has(r, "vinyle-3") && !did(r, "vinyles"),
      talk: (r) => ({
        lines: [
          say(SE, "Bienvenue à l'Auberge du Thé Tiède. Ici, le thé ne refroidit jamais. Il ne chauffe jamais non plus. On s'y fait."),
          say(SE, "Tiens, ce disque est tombé du ciel tout à l'heure. En plein dans ma théière. « Dimanche Soir », c'est écrit dessus."),
          say(S, "C'est un vinyle de Pokeyz ! Il me le faut, madame."),
          say(SE, "Prends-le. Je préférerais qu'il retourne sur une platine plutôt que dans mon thé. Et achète-moi quelque chose, tant que tu y es."),
        ],
        effects: vinyle(r, "vinyle-3"),
        then: { kind: "shop", id: "auberge" },
      }),
    },
    { talk: (r) => ({ lines: [say(SE, fini(r) ? "On dit que tu as vaincu Maître Katsu. Une tasse pour fêter ça ? Tiède, évidemment." : "Du thé, des boulettes, des sabres. Tout ce qu'il faut pour un samouraï en jogging.")], then: { kind: "shop", id: "auberge" } }) },
  ],
  "auberge:client": [
    {
      talk: (r) =>
        once([
          say(
            "Voyageur",
            fini(r)
              ? "Tu as le regard des samouraïs, maintenant. Calme. Un peu endormi. Ça te va bien."
              : "Maître Katsu ? On dit qu'il frappe une seule fois, à la seconde exacte. Ni avant, ni après. Il appelle ça « la seconde juste ».",
          ),
        ]),
    },
  ],

  // ─── Dojo ───
  "dojo:disciple": [
    {
      talk: () =>
        once([
          say("Disciple", "Le maître dit que le Métronome frappe tout le temps, alors que le samouraï attend le bon moment. Je n'ai pas encore compris. Ça fait trois ans."),
          say("Disciple", "Il dit aussi qu'il te connaît. Depuis toujours. C'est bizarre : il n'a jamais quitté le dojo."),
        ]),
    },
  ],
  "dojo:katsu": [
    {
      when: fini,
      talk: () =>
        once([
          say(KA, "La Tour de Minuit t'attend, petit. Rappelle-toi : la seconde juste. Ni avant, ni après."),
          say(KA, "Et prends soin de Pokeyz. Dans mon monde, je ne l'ai pas fait."),
        ]),
    },
    { when: (r) => flag(r, "ko:katsu"), talk: () => ({ lines: [say(KA, "Assieds-toi. Il est temps que tu saches.")], then: { kind: "scene", id: "katsu-ch4" } }) },
    {
      when: (r) => flag(r, "katsu-1"),
      talk: () => ({ lines: [say(KA, "Tu reviens. Bien. Le sabre de bois attendait.")], then: { kind: "battle", id: "katsu" } }),
    },
    {
      talk: (r) => ({
        lines: [
          say(KA, "Sparrow. Tu as pris ton temps. C'est bien. C'est même la première leçon."),
          say(S, "Vous connaissez mon nom ? Vous êtes sur la liste du Cadran… Vous gardez le quatrième fragment."),
          say(KA, "Je le garde. Mais pas pour lui. Je le garde pour toi."),
          say(KA, "Le Métronome frappait tout le temps. Un samouraï ne frappe qu'une fois : à la seconde juste. Montre-moi si tu sais attendre."),
          ...(r.party.includes("pokeyz") ? [say(PO, "Je mets un son d'ambiance. Un truc dramatique, avec des tambours. Les gentils, cette fois.")] : []),
        ],
        effects: [{ kind: "flag", id: "katsu-1" }],
        then: { kind: "battle", id: "katsu" },
      }),
    },
  ],
};
NPCS["village:sbires-2"] = NPCS["village:sbires-1"];

// ─── Objets ───

const lampion = (n: number) => (r: Rpg): Conversation => {
  if (flag(r, `lampion-${n}`)) return once([say("", "Le lampion brille d'une lumière chaude et douce. Les danseurs le regardent en passant.")]);
  const reste = LAMPIONS.length - allumes(r) - 1;
  return once(
    [
      say("", "Un lampion de papier, éteint. Gérard frotte deux frites l'une contre l'autre… et une petite flamme apparaît. Personne ne sait comment."),
      say(GE, reste > 0 ? `Et de ${allumes(r) + 1} ! Encore ${reste}.` : "Le dernier ! Mamie Matcha va être contente."),
    ],
    [{ kind: "flag", id: `lampion-${n}` }, ...(reste === 0 ? [step("allumer", LA)] : [])],
  );
};

const THINGS: Chapter["things"] = {
  "temple-cour:porte-est": () => once([say("", "Un chemin bordé de cerisiers part vers l'est. Un moine le barre : « Personne ne quitte le temple tant que le Coach n'a pas dit stop. »")]),
  "village:porte-dojo": (r) =>
    once([
      say("", "La porte du dojo est fermée. Un écriteau : « FERMÉ PENDANT LE FESTIVAL — SIGNÉ : LE MÉTRONOME »."),
      ...(did(r, "pokeyz") ? [say(LILI, "Tant que le Métronome tient la fête, ce dojo restera fermé.")] : [say(S, "Le DJ, là-bas, derrière les platines… Je devrais aller lui parler.")]),
    ]),
  "village:platines": (r) => {
    if (r.party.includes("pokeyz")) return once([say("", "Les platines de Pokeyz, au repos. Entre deux morceaux, enfin, un vrai silence.")]);
    if ((did(r, "vinyles") || vinyles(r) === 3) && !did(r, "mix")) return mix();
    return once([say("", "Les platines tournent toutes seules : toujours le même morceau, à 136 BPM. L'aiguille saute dès qu'on s'approche.")]);
  },
  "village:scene": () => once([say("", "La grande scène du festival, couverte de lampions et de rubans. Il y flotte une odeur de thé et de baskets fatiguées.")]),
  "*:cerisier": () => once([say("", "Un cerisier en fleurs. Les pétales tombent… et s'arrêtent à mi-chemin du sol, suspendus à minuit moins une.")]),
  "*:pierre": () => once([say("", "Une lanterne de pierre, couverte de mousse. Quelqu'un y a gravé : « UNE PAUSE PAR JOUR, AU MOINS ».")]),
  "*:ratelier": () => once([say("", "Un râtelier de sabres de bois. Ils sont tous parfaitement alignés, sauf un, un peu de travers. Comme s'il attendait quelqu'un.")]),
  "dojo:coffre-dojo": (r) =>
    flag(r, "coffre-dojo")
      ? once([say("", "Le coffre du dojo est vide. Il reste un petit mot : « Bien. Tu as pensé à fouiller. »")])
      : once([say("", "Le coffre du dojo : deux thés verts et une boulette de riz. Un petit mot : « Pour après le combat. Tu en auras besoin. »")], [
          { kind: "flag", id: "coffre-dojo" },
          { kind: "bag", id: "the-vert", n: 2 },
          { kind: "bag", id: "onigiri", n: 1 },
        ]),
  "auberge:comptoir": () => once([say("", "Le comptoir de Madame Sencha. Une théière fume tranquillement. Elle a l'air d'avoir reçu un disque sur la tête récemment.")]),
  "dojo:banniere": () => once([say("", "Une bannière calligraphiée : « LA SECONDE JUSTE ». En dessous, plus petit : « et une bonne sieste après ».")]),
};
for (const n of LAMPIONS) THINGS[`village:lampion-${n}`] = lampion(n);

// ─── Moments scénarisés ───

function arrival(map: string, r: Rpg, first: boolean): Conversation | null {
  if (map === "cerisiers" && !did(r, "chemin"))
    return {
      lines: [
        say("", "À l'est du temple, un chemin de pierre file entre les cerisiers en fleurs. Les pétales tombent… et restent suspendus dans l'air."),
        say(LILI, "La liste du Cadran. Prochain nom : « MAÎTRE KATSU — Voie du Samouraï — dojo de Kyūkei ». Le village est au bout de ce chemin."),
        say(S, "Le quatrième fragment. On se rapproche. J'ai presque envie de courir. Presque."),
        say(GE, "Ça sent le thé et la fête. Et… les beignets ? Je retire tout ce que j'ai dit sur ce chapitre."),
      ],
      effects: [{ kind: "quest", id: Q }, step("chemin")],
    };
  if (map === "village" && !did(r, "village"))
    return {
      lines: [
        say("", "Le village de Kyūkei est en pleine fête des lanternes. La musique tape fort. Les danseurs tournent, tournent… sans jamais s'arrêter."),
        say(S, "Aucune pause entre les morceaux. Même pas une seconde. C'est une soirée cauchemar."),
        say(LILI, "Le dojo de Katsu est en haut, à droite. Et ce grand machin qui fait « tic-tac » sur la scène n'a pas l'air de vouloir qu'on y entre."),
        say("", "Derrière les platines, un jeune DJ en sweat à capuche, casque sur les oreilles, mixe le même morceau en boucle. Il a l'air épuisé."),
      ],
      effects: [step("village")],
    };
  if (map === "dojo" && first) return once([say("", "Le dojo est silencieux. Après le vacarme du festival, le silence a presque un goût."), say(S, "Enfin une pièce où personne ne danse.")]);
  return null;
}

function afterBattle(id: string, r: Rpg): Conversation | null {
  if (id === "sbires-2")
    return once([say("", "Les deux sbires s'arrêtent net, à contretemps, et tombent assis. Un vinyle roule à tes pieds : « Pause Café »."), say(S, "Et d'un.")], vinyle(r, "vinyle-1"));
  if (id === "tambour-1")
    return once([say("", "Le tambour s'arrête enfin de rouler. Dessous, un vinyle presque pas rayé : « Grasse Matinée »."), say(GE, "Grasse matinée… Mon titre préféré. Sans l'avoir écouté.")], vinyle(r, "vinyle-2"));
  if (id === "metronome")
    return {
      lines: [
        say(ME, "Tic… tac… tic… … … … tac ?"),
        say("", "L'aiguille du Métronome ralentit, ralentit… et s'immobilise au milieu. Pour la première fois depuis des jours, la musique s'arrête."),
        say("", "Dans le silence, tous les danseurs s'assoient en même temps. Quelqu'un soupire. Quelqu'un rit. Quelqu'un ronfle déjà."),
        say(PO, "Tu as entendu ça, Sparrow ? Ce silence ? C'est le plus beau drop de toute ma carrière."),
        say(PO, "Je viens avec toi. Tu n'as pas le choix, de toute façon : un héros sans bande-son, c'est juste un mec qui marche."),
        say(PO, "Tiens, mon casque de secours. Avec ça, tu entendras le tempo avant tout le monde."),
        say("", "Une petite clé tombe de la boîte du Métronome : « DOJO »."),
        ...chevalier(r, "Le dojo est ouvert, Élu. Maître Katsu nous attend."),
      ],
      effects: [{ kind: "join", id: "pokeyz" }, { kind: "gear", id: "casque-audio" }, step("metronome")],
    };
  if (id === "katsu")
    return {
      lines: [
        say("", "Le sabre de bois de Maître Katsu s'arrête à un cheveu de l'épaule de Sparrow. Puis il le pose au sol, doucement."),
        say(KA, "La seconde juste. Tu l'as trouvée. Moi, à ton âge, j'ai mis… très longtemps."),
      ],
      effects: [step("katsu")],
      then: { kind: "scene", id: "katsu-ch4" },
    };
  return null;
}

function scene(id: string): Conversation | null {
  if (id !== "katsu-ch4") return null;
  return {
    lines: [
      say(KA, "Regarde-moi bien, Sparrow. La barbe grise. Les lunettes. La façon de tenir le sabre… comme une manette."),
      say(S, "… Non. Non non non. Vous êtes…"),
      say(KA, "Toi. Plus tard. Dans un monde où personne n'a arrêté le Cadran à temps. Où il est 23:59 depuis si longtemps que tout le monde a oublié ce qu'est une pause."),
      say(KA, "Là-bas, le Roi de la Salade règne toujours. La Confrérie ne dort plus jamais. Et Pokeyz… je n'ai jamais rallumé ses platines."),
      say(PO, "… Sérieux ? Dans ton monde, je mixe encore la même boucle ?"),
      say(KA, "Depuis toujours. C'est pour ça que je suis revenu, avec le quatrième fragment. Pour t'apprendre ce que j'ai compris trop tard."),
      say(KA, "Le Cadran frappe tout le temps. Il veut que tout aille vite, sans arrêt. On ne le bat pas en allant plus vite que lui. On le bat en choisissant son moment."),
      say("", "Katsu pose le fragment dans la main de Sparrow. Un éclair bleu parcourt son bras. Son sweat flotte comme un kimono. Ses yeux se posent, calmes."),
      say(KA, "SPARROW SAMOURAÏ. Une fois par combat, tu pourras l'appeler. Rapide, précis, patient. Tout ce que je n'ai pas été."),
      say(LILI, "Quatre fragments. La lettre parle encore : « PROTOCOLE MINUIT — la Tour — Monsieur Minuit »."),
      say(KA, "Monsieur Minuit. Le Cadran, c'est lui. Il vit au sommet de sa Tour et il collectionne les secondes que le monde n'a pas prises. Vas-y. Et cette fois, gagne."),
      say(S, "Je vais gagner. Et après, je vais faire une sieste. Une longue. Avec Pokeyz en fond sonore."),
      say(KA, "C'est exactement la bonne réponse. Prends mon ruban. Il était à toi, de toute façon."),
    ],
    effects: [{ kind: "skill", id: "samourai" }, { kind: "gear", id: "ruban-katsu" }, step("voie")],
  };
}

export function afterMinigame(id: string, ok: boolean, r: Rpg): Conversation | null {
  if (id !== "rythme") return null;
  if (did(r, "mix")) return ok ? once([say(PO, "Propre ! On devrait faire une tournée. « Sparrow & Pokeyz — Le Tour des Pauses ».")]) : null;
  if (!ok) return once([say(PO, "On a perdu le groove. Pas grave : respire un coup, et on relance. C'est ça le secret, frérot.")]);
  return {
    lines: [
      say("", "Le mix s'achève sur un long silence. Les danseurs s'arrêtent net… et soufflent. Une vraie pause. La première depuis des jours."),
      say(PO, "ÇA, c'est un set ! Regarde-les, Sparrow, ils respirent !"),
      say(ME, "TIC ! TAC ! QUI A OSÉ METTRE UN SILENCE DANS MA MESURE ?!"),
      say("", "Le Métronome bondit de la scène, son aiguille battant à toute vitesse."),
      say(ME, "Tu vas danser, Élu de la Minute. À MON tempo. Pour toujours."),
    ],
    effects: [step("mix")],
    then: { kind: "battle", id: "metronome" },
  };
}

export const CH4: Chapter & { scene: typeof scene; afterMinigame: typeof afterMinigame } = {
  npcs: NPCS,
  things: THINGS,
  arrival,
  afterBattle,
  scene,
  afterMinigame,
};

export const CH4_CARD = ["CHAPITRE 4 TERMINÉ", "LA VOIE DU SAMOURAÏ", "+600 XP · +450 FP", "Objet : Fragment d'horloge n°4 · Pokeyz rejoint l'équipe", "Prochain chapitre : Protocole Minuit"];
