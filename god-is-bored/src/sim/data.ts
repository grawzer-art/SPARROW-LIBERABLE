import type { PersonalityId, Religion } from "./types";
import { TECHS } from "./TechTree";
import type { RNG } from "./rng";

export const CIV_COLORS = [0xd1495b, 0xedae49, 0x7b5ea7, 0x2fa59a, 0xe8743b, 0x4f7cac, 0xb5c334, 0xc65d9b];

/** Syllabes par culture, pour des noms qui sonnent "d'ailleurs" mais restent ridicules. */
export const SYLLABLES: string[][] = [
  ["bou", "din", "gnoc", "tar", "ti", "ne", "mou", "flon", "gru", "mel"],
  ["ka", "zor", "plo", "uk", "thar", "bog", "ren", "gul", "mak", "dus"],
  ["pa", "ta", "tie", "ro", "sti", "ber", "lu", "ge", "va", "ne"],
  ["fla", "mi", "ro", "ch", "ou", "ette", "cas", "so", "let", "pi"],
];
export const CIV_PREFIX: Record<PersonalityId, string[]> = {
  pacifist: ["Communauté de", "Jardins de", "Cercle de"],
  expansionist: ["Empire de", "Grand Royaume de", "Hégémonie de"],
  fanatic: ["Théocratie de", "Saint-Siège de", "Ordre de"],
  opportunist: ["République de", "Compagnie de", "Ligue de"],
  arrogant: ["Très Grand Royaume de", "Empire Éternel de", "Royaume Suprême de"],
  paranoid: ["Forteresse de", "Principauté de", "Bastion de"],
  stupid: ["Royaume de", "Confédération de", "République de"],
};
export const PERSONALITY_LABEL: Record<PersonalityId, string> = {
  pacifist: "Pacifiste",
  expansionist: "Expansionniste",
  fanatic: "Fanatique",
  opportunist: "Opportuniste",
  arrogant: "Arrogante",
  paranoid: "Paranoïaque",
  stupid: "Particulièrement stupide",
};
export const PERSONALITY_BLURB: Record<PersonalityId, string> = {
  pacifist: "Préfère les tartes aux épées. Se fait quand même envahir.",
  expansionist: "Chaque frontière est une suggestion.",
  fanatic: "Sûre d'avoir ta ligne directe. Elle n'a pas ton numéro.",
  opportunist: "Aime les guerres des autres, surtout quand elles sont finies.",
  arrogant: "N'a jamais perdu une guerre. A seulement 'reculé stratégiquement'.",
  paranoid: "Les nuages la surveillent. Les voisins aussi.",
  stupid: "Confond souvent son pied et la politique étrangère.",
};

const FIRST_F = ["Brunhilde", "Gertrude", "Mathilde", "Odile", "Ysolde", "Berthe", "Clothilde", "Hortense", "Pétronille", "Ursule", "Bernadette", "Gudule"];
const FIRST_M = ["Gérard", "Aldebert", "Ragnulf", "Hubert", "Eudes", "Gontran", "Anselme", "Baudouin", "Ermenfroy", "Cunibert", "Thibaut", "Lothaire", "Fulbert", "Odon"];
const EPITHETS = ["le Prudent", "le Magnifique", "le Rond", "le Moite", "l'Inattendu", "le Bruyant", "le Persuadé", "le Magnifiquement Moyen", "le Tiède", "le Collant"];
export const GOAT_NAMES = ["Chèvre Mélodie", "Chèvre Brigitte", "Bouc Édouard", "Chèvre Pâquerette", "Bouc Hector"];
export const TITLES: Record<PersonalityId, string[]> = {
  pacifist: ["Doyenne", "Grand Médiateur", "Sage"],
  expansionist: ["Empereur", "Impératrice", "Conquérant"],
  fanatic: ["Grand Prêtre", "Grande Prêtresse", "Prophète"],
  opportunist: ["Président", "Consul", "Président-Directeur"],
  arrogant: ["Roi-Soleil", "Reine Incomparable", "Souverain Suprême"],
  paranoid: ["Veilleur", "Régent", "Sentinelle en Chef"],
  stupid: ["Roi", "Reine", "Grand Chef"],
};
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
export function roman(n: number): string {
  return ROMAN[Math.min(n, 12)] || String(n);
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function genPlaceName(rng: RNG, culture: number): string {
  const syl = SYLLABLES[culture % SYLLABLES.length];
  const n = 2 + rng.int(2);
  let s = "";
  for (let i = 0; i < n; i++) s += rng.pick(syl);
  return capitalize(s);
}

export function genCitizenName(rng: RNG, culture: number, female: boolean): string {
  const syl = SYLLABLES[culture % SYLLABLES.length];
  const n = 1 + rng.int(2);
  let s = "";
  for (let i = 0; i < n; i++) s += rng.pick(syl);
  s = capitalize(s);
  return female ? s + rng.pick(["a", "ie", "ette", "ine", "ou"]) : s + rng.pick(["", "o", "ot", "ard", "us"]);
}

export function genLeaderName(rng: RNG, dynasty: number, female: boolean, goat = false): string {
  if (goat) return rng.pick(GOAT_NAMES);
  const base = female ? rng.pick(FIRST_F) : rng.pick(FIRST_M);
  return dynasty > 1 ? `${base} ${roman(dynasty)}` : `${base} ${rng.pick(EPITHETS)}`;
}

export const CITY_SUFFIX = ["", "", "-sur-Mer", "-la-Grande", "-les-Bains", "-le-Haut", "-en-Vue"];

const RELIGION_A = ["Soupe", "Pigeon", "Caillou", "Marmite", "Moustache", "Nuage", "Navet", "Cloche", "Troisième Lune", "Tartine", "Flamant", "Rutabaga"];
const RELIGION_B = ["Éternel(le)", "Sacré(e)", "Pardonné(e)", "Omniscient(e)", "Légèrement Divin(e)", "Tiède", "Qui Nous Regarde", "du Mardi", "Indiscutable"];
export function genReligion(rng: RNG): Religion {
  const a = rng.pick(RELIGION_A);
  const fem = ["Soupe", "Marmite", "Troisième Lune", "Tartine", "Cloche", "Moustache"].includes(a);
  let b = rng.pick(RELIGION_B).replace("(e)", fem ? "e" : "");
  const forms = [`Culte ${fem ? "de la" : "du"} ${a} ${b}`, `Église ${fem ? "de la" : "du"} ${a}`, `Les Fidèles ${fem ? "de la" : "du"} ${a} ${b}`];
  const dogma = rng.pick(["peace", "war", "harvest", "scholar", "chaos"] as const);
  return { name: rng.pick(forms).replace("de le", "du"), dogma };
}

export const DOGMA_LABEL: Record<string, string> = {
  peace: "Dogme : aimer son prochain (sauf le voisin)",
  war: "Dogme : la guerre est une forme de prière",
  harvest: "Dogme : la récolte est sacrée, le reste aussi",
  scholar: "Dogme : savoir, donc mépriser les autres",
  chaos: "Dogme : personne ne se souvient du dogme",
};

export const TECH_NAMES = TECHS.map((t) => t.name);
export const TECH_EFFECT = TECHS.map((t) => t.effect);

export const PROPHECIES: { id: string; name: string; text: string }[] = [
  { id: "peace", name: "Aimez-vous les uns les autres", text: "Paix et pardon entre voisins." },
  { id: "war", name: "Purifiez les mécréants", text: "Un appel limpide à la guerre sainte." },
  { id: "temple", name: "Bâtissez-moi un temple", text: "Un grand édifice en mon honneur." },
  { id: "harvest", name: "Cultivez la terre", text: "Plantez, récoltez, ne vous plaignez pas." },
  { id: "expand", name: "Fondez une nouvelle cité", text: "Allez et multipliez-vous, ailleurs." },
];

export const PROPHECY_MISREAD: Record<string, string[]> = {
  peace: [
    "Ils ont compris qu'il fallait « pacifier » leurs voisins. Par la force.",
    "Ils ont interprété « aimez-vous » comme un encouragement démographique.",
  ],
  war: [
    "Ils ont déclaré la guerre à leurs propres hérétiques, c'est-à-dire eux-mêmes un mardi sur deux.",
    "Ils ont purifié... leurs réserves de nourriture, par le feu.",
  ],
  temple: [
    "Ils ont érigé une statue colossale du dirigeant, qui ressemble remarquablement peu à Dieu.",
    "Ils ont bâti une grande taverne. « C'est un temple, en un sens. »",
  ],
  harvest: [
    "Ils ont planté uniquement des navets. Le reste de la prophétie est resté sans suite.",
    "Ils ont cultivé la terre. Y compris les routes.",
  ],
  expand: [
    "Ils ont fondé une ville sur un marais, au motif que personne d'autre n'en voulait.",
    "Ils ont fondé une ville, puis une deuxième à côté, puis une troisième pour se disputer avec.",
  ],
};

export const PERS: Record<PersonalityId, { intel: number; aggr: number; faith: number; war: number; expand: number; tech: number; soldiers: number }> = {
  pacifist: { intel: 0.55, aggr: 0.15, faith: 0.45, war: 0.15, expand: 0.7, tech: 1.1, soldiers: 0.05 },
  expansionist: { intel: 0.5, aggr: 0.6, faith: 0.4, war: 1.4, expand: 1.8, tech: 1, soldiers: 0.12 },
  fanatic: { intel: 0.4, aggr: 0.55, faith: 0.85, war: 1.2, expand: 1, tech: 0.85, soldiers: 0.1 },
  opportunist: { intel: 0.6, aggr: 0.45, faith: 0.35, war: 1.0, expand: 1.1, tech: 1.1, soldiers: 0.09 },
  arrogant: { intel: 0.45, aggr: 0.65, faith: 0.5, war: 1.3, expand: 1.2, tech: 0.95, soldiers: 0.12 },
  paranoid: { intel: 0.5, aggr: 0.5, faith: 0.5, war: 0.9, expand: 0.8, tech: 1, soldiers: 0.16 },
  stupid: { intel: 0.2, aggr: 0.5, faith: 0.55, war: 1.1, expand: 1, tech: 0.6, soldiers: 0.1 },
};

export const JOB_LABEL: Record<string, string> = {
  child: "Enfant", farmer: "Fermier", lumberjack: "Bûcheron", miner: "Mineur", builder: "Bâtisseur", soldier: "Soldat", scholar: "Érudit",
};
export const STATE_LABEL: Record<string, string> = {
  idle: "Désœuvré", wander: "Flâne", eat: "Cherche à manger", forage: "Cueille des trucs", work: "Travaille", build: "Construit",
  travel: "En chemin", mate: "S'occupe de démographie", flee: "Panique", fight: "Se bat", march: "Marche au front", sick: "Malade",
};
