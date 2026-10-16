/**
 * LA GAZETTE DU CHAOS — moteur éditorial.
 *
 * Tout est déterministe : une date donne toujours la même édition, sur tous les
 * téléphones. Ajouter un titre (avec sa date « ajout ») ne modifie pas les éditions
 * passées : il ne peut apparaître qu'à partir de sa date de publication.
 *
 * Rotation : chaque titre a une position fixe sur un cercle (hachage de son id) ;
 * chaque jour, le cercle tourne du nombre d'or. Les titres défilent ainsi sans
 * répétitions rapprochées, sans aucune base de données.
 */

import data from "@/data/gazette/titres.json";
import speciales from "@/data/gazette/speciales.json";
import { END, TIMEZONE } from "@/config";
import { zonedToUtc } from "@/lib/time";

export type RubriqueId = "france" | "monde" | "tech" | "vdm" | "sparrow";
export type Tampon = "EXCLUSIF" | "URGENT" | "À LA UNE" | "RÉVÉLATION" | "DERNIÈRE MINUTE";

export interface Titre {
  id: string;
  rubrique: RubriqueId;
  titre: string;
  ajout: string;
  chapo?: string;
  flash?: boolean;
  tampon?: Tampon;
}

export interface Breve {
  id: string;
  titre: string;
  ajout: string;
}

export interface Chiffre {
  valeur: string;
  texte: string;
}

export interface Edition {
  date: string;
  numero: number;
  /** Nom de l'édition spéciale, le cas échéant. */
  speciale?: string;
  bandeau?: string;
  une: Titre;
  titres: Titre[];
  breves: Breve[];
  urgent: string;
  chiffre: Chiffre;
  /** Titre « Flash spécial » de l'édition, s'il y en a un. */
  flash?: Titre;
}

/** Date de lancement de la Gazette : édition n° 1. */
export const LANCEMENT = "2026-10-16";
export const TITRES_PAR_EDITION = 7;
export const BREVES_PAR_EDITION = 4;

/** Typographie française : espaces insécables avant « : ; ? ! » et à l'intérieur des guillemets. */
export function typo(s: string): string {
  return s
    .replace(/«\s+/g, "«\u00a0")
    .replace(/\s+»/g, "\u00a0»")
    .replace(/\s+([:;?!])/g, "\u00a0$1");
}

export const RUBRIQUES = data.rubriques as Record<RubriqueId, { nom: string; court: string }>;
export const TOUS_TITRES = (data.titres as Titre[]).map((t) => ({
  ...t,
  titre: typo(t.titre),
  ...(t.chapo ? { chapo: typo(t.chapo) } : {}),
}));
export const TOUTES_BREVES = (data.breves as Breve[]).map((b) => ({ ...b, titre: typo(b.titre) }));
const URGENTS = (data.urgents as string[]).map(typo);
const CHIFFRES = (data.chiffres as Chiffre[]).map((c) => ({ ...c, texte: typo(c.texte) }));

interface Speciale {
  date: string;
  nom: string;
  bandeau: string;
  une: Omit<Titre, "ajout">;
}
const SPECIALES = (speciales.editions as Speciale[]).map((s) => ({
  ...s,
  bandeau: typo(s.bandeau),
  une: { ...s.une, titre: typo(s.une.titre), ...(s.une.chapo ? { chapo: typo(s.une.chapo) } : {}), ajout: s.date } as Titre,
}));

const DAY = 86_400_000;
const PHI = 0.6180339887498949;

/** Hachage FNV-1a → [0, 1). */
export function hash01(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Finaliseur (murmur3) : disperse les identifiants proches (« sp-001 », « sp-002 »…).
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export const MAX_PAR_RUBRIQUE = 2;

/** Sélectionne n titres dans l'ordre de rotation, en limitant chaque rubrique (variété). */
function varie(ordre: Titre[], n: number, deja: Titre[]): Titre[] {
  const count: Partial<Record<RubriqueId, number>> = {};
  for (const t of deja) count[t.rubrique] = (count[t.rubrique] ?? 0) + 1;
  const out: Titre[] = [];
  const ids = new Set(deja.map((t) => t.id));
  for (const t of ordre) {
    if (out.length >= n) break;
    if (ids.has(t.id) || (count[t.rubrique] ?? 0) >= MAX_PAR_RUBRIQUE) continue;
    out.push(t);
    ids.add(t.id);
    count[t.rubrique] = (count[t.rubrique] ?? 0) + 1;
  }
  // Complète si une rubrique manque de titres.
  for (const t of ordre) {
    if (out.length >= n) break;
    if (!ids.has(t.id)) {
      out.push(t);
      ids.add(t.id);
    }
  }
  return out;
}

/** Date civile « AAAA-MM-JJ » à Paris pour un instant donné. */
export function parisDate(ms: number): string {
  const f = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" });
  return f.format(new Date(ms));
}

const civil = (date: string) => {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};

export const addDays = (date: string, n: number) => new Date(civil(date) + n * DAY).toISOString().slice(0, 10);

export function editionNumber(date: string): number {
  return Math.round((civil(date) - civil(LANCEMENT)) / DAY) + 1;
}

function rotate<T extends { id: string }>(items: T[], day: number, salt: string): T[] {
  // Positions régulièrement espacées (ordre fixé par le hachage), puis rotation du nombre d'or.
  const n = items.length;
  const shift = (day * PHI) % 1;
  return [...items]
    .sort((a, b) => hash01(salt + a.id) - hash01(salt + b.id))
    .map((it, i) => ({ it, k: (i / n - shift + 1) % 1 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.it);
}

/** Jours restants (au début de la journée, heure de Paris) avant la date symbolique. */
export function joursRestants(date: string): number {
  const end = zonedToUtc(END.date, END.time);
  const start = zonedToUtc(date, "00:00");
  return Math.round((end - start) / DAY);
}

export const PALIERS = [1500, 1000, 500, 365, 100, 30, 7, 1];

/** Édition DERNIÈRE MINUTE générée pour les grands paliers du compte à rebours. */
function palier(date: string): Speciale | null {
  const j = joursRestants(date);
  if (!PALIERS.includes(j)) return null;
  const titres: Record<number, string> = {
    1500: "J-1500 : le compteur perd son premier « 1 ». Sparrow parle d'un « tournant historique »",
    1000: "J-1000 : le compteur n'a plus que quatre chiffres… pour la dernière fois. Sparrow pleure de joie, puis de fatigue",
    500: "J-500 : Sparrow commence à compter en semaines pour se donner l'impression d'aller plus vite",
    365: "J-365 : plus qu'un an. Sparrow demande s'il peut le faire en accéléré",
    100: "J-100 : trois chiffres seulement. Le calendrier, nerveux, commence à transpirer",
    30: "J-30 : Sparrow essaie déjà ses tenues de sortie. Le masque est passé au pressing",
    7: "J-7 : une semaine. La rédaction installe un lit de camp devant le compteur",
    1: "J-1 : demain, c'est le grand jour. Sparrow n'a pas fermé l'œil depuis 1 825 jours",
  };
  return {
    date,
    nom: `DERNIÈRE MINUTE · J-${j.toLocaleString("fr-FR")}`,
    bandeau: "Édition spéciale du compte à rebours · Tirage d'urgence",
    une: { id: `pa-${j}`, rubrique: "sparrow", tampon: "DERNIÈRE MINUTE", titre: typo(titres[j]), flash: true, ajout: date } as Titre,
  };
}

export function specialeDu(date: string): Speciale | null {
  return SPECIALES.find((s) => s.date === date) ?? palier(date);
}

/** Construit l'édition d'une date (« AAAA-MM-JJ », heure de Paris). */
export function editionDu(date: string): Edition {
  const day = editionNumber(date) - 1;
  const eligibles = TOUS_TITRES.filter((t) => t.ajout <= date);
  const ordre = rotate(eligibles, day, "t:");
  const sp = specialeDu(date);

  const une: Titre = sp ? (sp.une as Titre) : ordre[0];
  const titres = varie(ordre, TITRES_PAR_EDITION, [une]);

  const breves = rotate(
    TOUTES_BREVES.filter((b) => b.ajout <= date),
    day,
    "b:",
  ).slice(0, BREVES_PAR_EDITION);
  const urgent = URGENTS[Math.floor(hash01(`u:${date}`) * URGENTS.length)];
  const chiffre = CHIFFRES[Math.floor(hash01(`c:${date}`) * CHIFFRES.length)];
  const flash = [une, ...titres].find((t) => t.flash);

  return {
    date,
    numero: editionNumber(date),
    speciale: sp?.nom,
    bandeau: sp?.bandeau,
    une,
    titres,
    breves,
    urgent,
    chiffre,
    flash,
  };
}

/** Liste des éditions publiées, de la plus récente à la plus ancienne. */
export function archives(aujourdhui: string, max = 400): { date: string; numero: number; une: string; speciale?: string }[] {
  const out = [];
  for (let d = aujourdhui; d >= LANCEMENT && out.length < max; d = addDays(d, -1)) {
    const e = editionDu(d);
    out.push({ date: d, numero: e.numero, une: e.une.titre, speciale: e.speciale });
  }
  return out;
}

/** Retrouve un titre (normal ou d'édition spéciale) par son identifiant. */
export function titreParId(id: string): Titre | Breve | null {
  return (
    TOUS_TITRES.find((t) => t.id === id) ??
    TOUTES_BREVES.find((b) => b.id === id) ??
    SPECIALES.find((s) => s.une.id === id)?.une ??
    (id.startsWith("pa-") ? (palierParId(id) ?? null) : null)
  );
}

function palierParId(id: string): Titre | null {
  const j = Number(id.slice(3));
  if (!PALIERS.includes(j)) return null;
  const end = zonedToUtc(END.date, END.time);
  return (palier(parisDate(end - j * DAY + DAY / 2))?.une as Titre | undefined) ?? null;
}

/** Titres publiés d'une rubrique (les plus récents d'abord). */
export function parRubrique(r: RubriqueId, aujourdhui: string): Titre[] {
  return TOUS_TITRES.filter((t) => t.rubrique === r && t.ajout <= aujourdhui).sort((a, b) => b.ajout.localeCompare(a.ajout));
}

export function isTitre(t: Titre | Breve): t is Titre {
  return "rubrique" in t;
}
