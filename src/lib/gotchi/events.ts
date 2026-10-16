/**
 * Événements aléatoires (effets réels, jamais bloquants).
 * rarity : "commun" (souvent), "rare", "legendaire" (très rare, animation spéciale).
 * scene  : animation jouée dans l'appartement.
 */

import type { Stat, State, Status } from "./core";

export type Scene =
  | "frigo"
  | "pc"
  | "canape"
  | "danse"
  | "rage"
  | "douche"
  | "boude"
  | "rire"
  | "panne"
  | "fenetre"
  | "lit"
  | "legendaire";

export interface GameEvent {
  id: string;
  rarity: "commun" | "rare" | "legendaire";
  weight: number;
  when?: (s: State, hour: number) => boolean;
  text: string;
  d?: Partial<Record<Stat, number>>;
  coins?: number;
  xp?: number;
  status?: [Status, number];
  /** Panne de PC : mini-jeu indisponible pendant N minutes. */
  panne?: number;
  /** Donne un objet rare non possédé. */
  rareItem?: boolean;
  scene: Scene;
}

const nuit = (h: number) => h < 6 || h >= 23;

export const EVENTS: GameEvent[] = [
  // ─── Gaming ───
  { id: "e-nuit-dofus", rarity: "commun", weight: 6, when: (_, h) => h >= 5 && h < 11, text: "Sparrow a passé la nuit à farmer. Il appelle ça « se lever tôt ».", d: { energie: -18, fun: 25, humeur: 6 }, xp: 10, scene: "pc" },
  { id: "e-session-infinie", rarity: "commun", weight: 5, when: (s) => s.stats.fun < 45, text: "« Une petite quête. » Ça fait trois heures.", d: { fun: 20, energie: -8 }, status: ["dofus", 6], scene: "pc" },
  { id: "e-guilde", rarity: "commun", weight: 3, text: "Sa guilde l'a nommé « responsable des frites ». Il prend le poste très au sérieux.", d: { humeur: 12 }, coins: 10, scene: "pc" },
  { id: "e-lag", rarity: "commun", weight: 4, text: "LAG. Il a perdu un combat. Le routeur est en garde à vue.", d: { humeur: -10, fun: 5 }, status: ["rage", 3], scene: "rage" },
  { id: "e-panne", rarity: "commun", weight: 3, text: "Son PC vient de mourir. Il a tenté le massage cardiaque. Panne temporaire.", d: { humeur: -12 }, panne: 12, scene: "panne" },
  { id: "e-update", rarity: "commun", weight: 3, text: "Mise à jour obligatoire de 48 Go. Sparrow fixe la barre de progression comme un faucon.", d: { fun: -6 }, panne: 5, scene: "panne" },
  { id: "e-souris", rarity: "commun", weight: 2, text: "Sa souris a rendu l'âme après 4 millions de clics. Minute de silence.", d: { humeur: -6 }, scene: "pc" },
  { id: "e-farm-or", rarity: "rare", weight: 1.2, text: "Session de farm parfaite pendant ton absence. Il a vendu ses ressources une fortune.", coins: 45, xp: 20, d: { fun: 15 }, scene: "pc" },
  { id: "e-afk", rarity: "commun", weight: 2, text: "Il est resté AFK 40 minutes en plein donjon. Son équipe le cherche encore.", d: { energie: 8, fun: -4 }, scene: "canape" },
  { id: "e-stream", rarity: "commun", weight: 2, text: "Il a lancé un stream. Spectateurs : 1. C'était sa mère, par erreur.", d: { humeur: 5 }, xp: 5, scene: "pc" },

  // ─── Nourriture ───
  { id: "e-12-frites", rarity: "commun", weight: 4, text: "Sparrow a commandé 12 portions de frites « pour la semaine ». Il en reste 0.", d: { satiete: 35, humeur: 12, forme: -12 }, status: ["gras", 10], scene: "frigo" },
  { id: "e-refus-salade", rarity: "commun", weight: 4, text: "Il refuse catégoriquement de manger une salade. Il l'a mise à la poubelle « par respect ».", d: { humeur: 4, forme: -3 }, scene: "boude" },
  { id: "e-frigo-vide", rarity: "commun", weight: 3, when: (s) => s.stats.satiete < 50, text: "Il a ouvert le frigo 14 fois. Rien n'est apparu. Il ne perd pas espoir.", d: { humeur: -6 }, scene: "frigo" },
  { id: "e-frite-canape", rarity: "commun", weight: 3, text: "Il a retrouvé une frite sous le canapé. Il ne dira pas de quand elle date. Il l'a mangée.", d: { satiete: 5, humeur: 8, forme: -2 }, scene: "canape" },
  { id: "e-mayo", rarity: "commun", weight: 2, text: "Pénurie de mayonnaise. Sparrow a écrit une lettre au gouvernement.", d: { humeur: -8 }, scene: "frigo" },
  { id: "e-salade-ok", rarity: "rare", weight: 1, text: "Événement inexpliqué : il a mangé une feuille de salade de son plein gré. Les scientifiques sont perplexes.", d: { forme: 15, satiete: 6 }, xp: 15, scene: "frigo" },
  { id: "e-livreur", rarity: "commun", weight: 2, text: "Le livreur de frites l'appelle par son prénom. Ils ont parlé 20 minutes.", d: { humeur: 10, satiete: 20 }, scene: "fenetre" },
  { id: "e-cuisine", rarity: "commun", weight: 2, text: "Il a essayé de cuisiner. L'alarme incendie aussi a participé.", d: { humeur: -5, forme: -4 }, scene: "frigo" },
  { id: "e-regime", rarity: "commun", weight: 2, text: "Il annonce un régime. Il a tenu 11 minutes. C'est un record.", d: { forme: 3, humeur: -3 }, scene: "boude" },

  // ─── Sommeil (presque jamais) ───
  { id: "e-sieste-38", rarity: "commun", weight: 3, when: (s) => s.stats.energie < 60, text: "Il a fait une micro-sieste de 38 secondes. Il se sent « comme après 8 heures ».", d: { energie: 14 }, scene: "canape" },
  { id: "e-insomnie", rarity: "commun", weight: 3, when: (_, h) => nuit(h), text: "3 h du matin. Il fixe le plafond en réfléchissant à un build. Il ne dormira pas.", d: { energie: -6, fun: 4 }, scene: "lit" },
  { id: "e-cafe", rarity: "commun", weight: 3, text: "Il a bu six cafés « pour se détendre ». Il entend les couleurs.", d: { energie: 22, humeur: -4, forme: -5 }, scene: "frigo" },
  { id: "e-lit-piege", rarity: "commun", weight: 2, text: "Il s'est assis sur le lit « deux secondes ». Il s'est relevé en hurlant que c'était un piège.", d: { energie: 4 }, scene: "lit" },
  { id: "e-rv-sommeil", rarity: "rare", weight: 0.8, when: (s) => s.stats.energie < 35, text: "Il s'est endormi debout pendant 4 minutes. Il nie fermement.", d: { energie: 25 }, scene: "lit" },

  // ─── Humeur, vie quotidienne ───
  { id: "e-danse", rarity: "commun", weight: 3, when: (s) => s.stats.humeur > 55, text: "Il danse seul dans le salon sur une musique de donjon. Personne ne doit le savoir.", d: { humeur: 10, energie: -4 }, scene: "danse" },
  { id: "e-boude", rarity: "commun", weight: 3, when: (s) => s.stats.humeur < 45, text: "Sparrow boude. Il refuse de dire pourquoi. Il veut des frites.", status: ["boude", 6], scene: "boude" },
  { id: "e-crise-frites", rarity: "commun", weight: 3, when: (s) => s.stats.satiete < 35, text: "Crise dramatique : « On m'a privé de frites. Je porte plainte contre l'univers. »", d: { humeur: -10 }, scene: "boude" },
  { id: "e-fenetre", rarity: "commun", weight: 2, text: "Il regarde par la fenêtre en se demandant si le 12 octobre 2031 est déjà passé. Non.", d: { humeur: -2 }, scene: "fenetre" },
  { id: "e-blague", rarity: "commun", weight: 2, text: "Il s'est raconté une blague à lui-même. Il a ri 10 minutes. Toi, non.", d: { humeur: 12 }, scene: "rire" },
  { id: "e-miroir", rarity: "commun", weight: 2, text: "Il s'est regardé dans le miroir et s'est dit « beau gosse ». Le miroir n'a pas répondu.", d: { humeur: 8 }, scene: "danse" },
  { id: "e-douche-chaude", rarity: "commun", weight: 2, text: "Douche de 45 minutes. Il en est ressorti philosophe et légèrement cuit.", d: { forme: 14, energie: -4 }, scene: "douche" },
  { id: "e-chaussette", rarity: "commun", weight: 2, text: "Il a perdu une chaussette. Il soupçonne le frigo.", d: { humeur: -4 }, scene: "fenetre" },
  { id: "e-pigeon", rarity: "commun", weight: 2, text: "Un pigeon est entré. Ils se sont regardés longtemps. Le pigeon est reparti avec une frite.", d: { humeur: 6, satiete: -4 }, scene: "fenetre" },
  { id: "e-voisin", rarity: "commun", weight: 2, text: "Le voisin a frappé pour « le bruit des clics ». Sparrow a cliqué plus fort.", d: { humeur: 4, fun: 6 }, scene: "rage" },
  { id: "e-sport", rarity: "commun", weight: 1.5, text: "Il a fait une pompe. Une seule. Il est allongé depuis, « en récupération ».", d: { forme: 6, energie: -10 }, scene: "canape" },
  { id: "e-calendrier", rarity: "commun", weight: 2, text: "Il a essayé d'arracher plusieurs pages du calendrier d'un coup. Le compteur n'a pas bougé.", d: { humeur: -5 }, scene: "boude" },
  { id: "e-pote", rarity: "commun", weight: 2, text: "Un pote lui a envoyé « ça va ? ». Il a répondu trois paragraphes et un mème.", d: { humeur: 14 }, scene: "rire" },
  { id: "e-menage", rarity: "rare", weight: 0.8, text: "Il a fait le ménage. Spontanément. On a vérifié deux fois.", d: { forme: 10, humeur: 6 }, coins: 15, xp: 10, scene: "danse" },

  // ─── Trouvailles ───
  { id: "e-piece", rarity: "commun", weight: 3, text: "Il a trouvé des Frit'pièces dans le canapé. Le canapé est une banque.", coins: 15, scene: "canape" },
  { id: "e-tresor", rarity: "rare", weight: 1, text: "Il a trouvé un vieux trésor de guilde au fond d'un placard. Jackpot.", coins: 60, xp: 15, scene: "rire" },
  { id: "e-objet-rare", rarity: "rare", weight: 0.7, text: "Il a découvert un objet extrêmement rare derrière l'ordinateur. Il pleure de joie.", rareItem: true, xp: 25, scene: "legendaire" },

  // ─── Légendaires (très rares, animation spéciale) ───
  { id: "e-dofrite", rarity: "legendaire", weight: 0.25, text: "ÉVÉNEMENT LÉGENDAIRE : un œuf de frites dorées est apparu sur le bureau. Il brille. Il chante (un peu).", rareItem: true, coins: 80, xp: 40, scene: "legendaire" },
  { id: "e-batsignal", rarity: "legendaire", weight: 0.25, text: "ÉVÉNEMENT LÉGENDAIRE : le bat-signal s'est allumé dans le ciel. Il était juste en forme de frite.", d: { humeur: 30, energie: 20 }, coins: 50, xp: 40, scene: "legendaire" },
  { id: "e-calendrier-tremble", rarity: "legendaire", weight: 0.2, text: "ÉVÉNEMENT LÉGENDAIRE : le calendrier a tremblé. Pendant une seconde, il a eu peur de Sparrow.", d: { humeur: 25, fun: 20, forme: 15 }, coins: 60, xp: 50, scene: "legendaire" },
  { id: "e-sommeil-8h", rarity: "legendaire", weight: 0.15, text: "ÉVÉNEMENT LÉGENDAIRE : Sparrow a dormi 8 heures d'affilée. Les experts parlent d'une éclipse.", d: { energie: 60, humeur: 15 }, xp: 50, scene: "legendaire" },
];

export function pickEvent(s: State, hour: number, rand: () => number): GameEvent {
  const pool = EVENTS.filter((e) => !e.when || e.when(s, hour));
  // Les objets rares déjà tous possédés : pas d'événement « objet rare ».
  const total = pool.reduce((a, e) => a + e.weight, 0);
  let x = rand() * total;
  for (const e of pool) {
    x -= e.weight;
    if (x <= 0) return e;
  }
  return pool[pool.length - 1];
}
