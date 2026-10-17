/**
 * Trophées absurdes. `secret: true` = description cachée tant qu'il n'est pas débloqué.
 */

import { parisHour, type State } from "./core";
import { ITEMS } from "./items";

export interface Trophy {
  id: string;
  name: string;
  desc: string;
  coins: number;
  secret?: boolean;
  check: (s: State, now: number) => boolean;
}

const c = (s: State) => s.counters;

export const TROPHIES: Trophy[] = [
  { id: "t-premiere-frite", name: "Première frite", desc: "Donner sa première portion de frites.", coins: 10, check: (s) => c(s).frites >= 1 },
  { id: "t-frites-50", name: "Actionnaire de friterie", desc: "50 portions de frites servies.", coins: 60, check: (s) => c(s).frites >= 50 },
  { id: "t-frites-200", name: "Le sang c'est de l'huile", desc: "200 portions de frites servies.", coins: 150, check: (s) => c(s).frites >= 200 },
  { id: "t-fritoman", name: "Naissance de Fritoman", desc: "Déclencher la transformation Fritoman.", coins: 25, check: (s) => c(s).fritoman >= 1 },
  { id: "t-fritoman-10", name: "Fritoman récidiviste", desc: "Transformer Sparrow en Fritoman 10 fois.", coins: 80, check: (s) => c(s).fritoman >= 10 },
  { id: "t-salade-1", name: "Miracle vert", desc: "Lui faire accepter une salade.", coins: 20, check: (s) => c(s).salade >= 1 },
  { id: "t-salade-10", name: "Diplomate du potager", desc: "10 salades acceptées.", coins: 80, check: (s) => c(s).salade >= 10 },
  { id: "t-refus-20", name: "Lapin rejeté", desc: "Se faire refuser 20 salades.", coins: 50, check: (s) => c(s).saladeRefus >= 20 },
  { id: "t-farm-1", name: "Premier donjon", desc: "Terminer une session de farm.", coins: 15, check: (s) => c(s).farms >= 1 },
  { id: "t-farm-25", name: "Farmeur à temps plein", desc: "25 sessions de farm.", coins: 100, check: (s) => c(s).farms >= 25 },
  { id: "t-score-600", name: "Clavier en fusion", desc: "Faire 600 points en une session.", coins: 70, check: (s) => s.bestFarm >= 600 },
  { id: "t-rare", name: "Drop de légende", desc: "Obtenir un objet rare.", coins: 50, check: (s) => c(s).rares >= 1 },
  { id: "t-rage-10", name: "Gestion de la colère : non", desc: "10 rages devant l'écran.", coins: 40, check: (s) => c(s).rages >= 10 },
  { id: "t-sieste-refus", name: "Le sommeil c'est pour les faibles", desc: "Se faire refuser 15 siestes.", coins: 50, check: (s) => c(s).siestesRefusees >= 15 },
  { id: "t-douche-10", name: "Hygiène exemplaire (relativement)", desc: "10 douches.", coins: 40, check: (s) => c(s).douches >= 10 },
  { id: "t-talk-50", name: "Psy à mi-temps", desc: "Parler 50 fois avec Sparrow.", coins: 60, check: (s) => c(s).talks >= 50 },
  { id: "t-niv-5", name: "Ça progresse", desc: "Atteindre le niveau 5.", coins: 40, check: (s) => s.level >= 5 },
  { id: "t-niv-10", name: "Vétéran du canapé", desc: "Atteindre le niveau 10.", coins: 100, check: (s) => s.level >= 10 },
  { id: "t-garde-robe", name: "Fashion week", desc: "Posséder 8 objets.", coins: 60, check: (s) => s.owned.length >= 8 },
  { id: "t-fidele", name: "Pote fidèle", desc: "Venir 5 jours différents.", coins: 60, check: (s) => s.days.length >= 5 },
  { id: "t-cache", name: "Fouineur", desc: "Trouver 5 objets cachés.", coins: 50, check: (s) => c(s).caches >= 5 },
  { id: "t-muscu-1", name: "Premier biceps", desc: "Terminer une séance de muscu.", coins: 15, check: (s) => c(s).trainings >= 1 && c(s).reps >= 1 },
  { id: "t-reps-200", name: "Ça pousse", desc: "200 répétitions au total.", coins: 80, check: (s) => c(s).reps >= 200 },
  { id: "t-costaud", name: "Le t-shirt craque", desc: "Atteindre le stade Costaud.", coins: 60, check: (s) => s.muscle >= 90 },
  { id: "t-titan", name: "SPARROW TITAN", desc: "Atteindre la transformation ultime.", coins: 250, secret: true, check: (s) => s.muscle >= 400 },
  { id: "t-deco", name: "Décorateur d'intérieur", desc: "Améliorer un meuble de l'appartement.", coins: 30, check: (s) => s.owned.some((id) => /^(pc|lit|sport|canape)-/.test(id)) },
  // Secrets
  {
    id: "t-nuit",
    name: "Hibou du donjon",
    desc: "Jouer entre 2 h et 5 h du matin.",
    coins: 50,
    secret: true,
    check: (s, now) => s.lastAction != null && now - s.lastAction.t < 60_000 && parisHour(now) >= 2 && parisHour(now) < 5,
  },
  {
    id: "t-chevalier",
    name: "Gotham n'a rien demandé",
    desc: "Porter la cape et le masque du Chevalier Noir en même temps.",
    coins: 80,
    secret: true,
    check: (s) => s.equip.tenue === "ten-cape" && s.equip.tete === "tet-masque",
  },
  { id: "t-dofrite", name: "L'œuf sacré", desc: "Trouver l'Œuf Dofrite.", coins: 120, secret: true, check: (s) => s.owned.includes("dec-dofrite") },
  { id: "t-tres-rare", name: "Témoin de l'impossible", desc: "Assister à un événement très rare.", coins: 80, secret: true, check: (s) => c(s).rareEvents >= 1 },
  { id: "t-panne", name: "Ctrl+Alt+Suppr", desc: "Vivre une panne d'ordinateur.", coins: 30, secret: true, check: (s) => c(s).pannes >= 1 },
  {
    id: "t-collection",
    name: "Musée de la frite",
    desc: "Posséder tous les objets rares.",
    coins: 300,
    secret: true,
    check: (s) => ITEMS.filter((i) => i.rare).every((i) => s.owned.includes(i.id)),
  },
];

/** Débloque les trophées mérités et verse leurs récompenses. */
export function checkTrophies(s: State, now: number): { state: State; unlocked: Trophy[] } {
  const unlocked = TROPHIES.filter((t) => !s.trophies[t.id] && t.check(s, now));
  if (!unlocked.length) return { state: s, unlocked };
  const trophies = { ...s.trophies };
  let coins = s.coins;
  const journal = [...s.journal];
  for (const t of unlocked) {
    trophies[t.id] = now;
    coins += t.coins;
    journal.push({ t: now, txt: `Trophée : ${t.name} (+${t.coins} FP)`, kind: "trophy" });
  }
  return { state: { ...s, trophies, coins, journal: journal.slice(-40) }, unlocked };
}
