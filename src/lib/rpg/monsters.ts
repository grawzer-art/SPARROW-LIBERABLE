/**
 * RPG — créatures sauvages : Bestiaire, capture et progression (logique pure, testable).
 *
 * Une créature capturée est un équipier (`MEMBERS`) avec son propre niveau, sauvegardé dans
 * `rpg.mons`. Elle rejoint l'équipe comme les compagnons de l'histoire ; seuls les quatre premiers
 * compagnons de la liste combattent, les autres restent en réserve (rien n'est jamais perdu).
 */

import { BATTLES, MEMBERS, MOVES } from "./bestiary";
import type { MonSave, Rpg } from "./state";
import type { ElemType } from "./types";

export type Rarity = "commun" | "peu-commun" | "rare" | "epique" | "legendaire";
export const RARITY_LABEL: Record<Rarity, string> = { commun: "Commun", "peu-commun": "Peu commun", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };

/** Bestiaire officiel du Chaos : 24 espèces de base (référence : noms, numéros, types, raretés, régions). */
export interface Species {
  id: string;
  /** Numéro officiel dans le Bestiaire. */
  n: number;
  name: string;
  type: ElemType;
  rarity: Rarity;
  region: string;
  /** Capacité signature (officielle). */
  signature: string;
  /** Lieu précis où on la trouve (espèces déjà présentes dans le jeu). */
  habitat?: string;
  /** Sprite de face (combat) : seulement les espèces déjà jouables. */
  sprite?: string;
}

const R404 = "Quartier 404", CITE = "Cité des Frites", MUSCLE = "Confrérie du Muscle", SAMOURAI = "Voie du Samouraï", TOUR = "Tour des Heures";
const sp = (n: number, id: string, name: string, type: ElemType, rarity: Rarity, region: string, signature: string, more: Partial<Species> = {}): Species => ({ n, id, name, type, rarity, region, signature, ...more });

export const SPECIES: Species[] = [
  sp(1, "grizap", "Grizap", "tech", "commun", R404, "Court-circuit"),
  sp(2, "lampix", "Lampix", "tech", "peu-commun", R404, "Flash électrique"),
  sp(3, "poubrom", "Poubrom", "ombre", "rare", R404, "Nuage toxique"),
  sp(4, "brokito", "Brokito", "nature", "commun", CITE, "Spores empoisonnées", { habitat: "Potager du Jardin royal (Cité des Frites Perdues)", sprite: "brokito" }),
  sp(5, "patatox", "Patatox", "feu", "peu-commun", CITE, "Patate brûlante"),
  sp(6, "saladrille", "Saladrille", "nature", "commun", CITE, "Fouet végétal"),
  sp(7, "fritcrabe", "Fritcrabe", "feu", "rare", CITE, "Pince dorée"),
  sp(8, "mayochaos", "Mayochaos", "ombre", "epique", CITE, "Sauce maudite"),
  sp(9, "gonflin", "Gonflin", "force", "commun", MUSCLE, "Petit uppercut"),
  sp(10, "proteino", "Protéino", "force", "peu-commun", MUSCLE, "Shake explosif"),
  sp(11, "musclopin", "Musclopin", "force", "rare", MUSCLE, "Triple répétition"),
  sp(12, "bancome", "Bancôme", "ombre", "epique", MUSCLE, "Développé spectral"),
  sp(13, "bambushi", "Bambushi", "nature", "commun", SAMOURAI, "Bambou tranchant"),
  sp(14, "ombrelot", "Ombrelot", "ombre", "peu-commun", SAMOURAI, "Frappe invisible"),
  sp(15, "kataneko", "Kataneko", "force", "rare", SAMOURAI, "Griffe du dojo"),
  sp(16, "paradojo", "Paradojo", "tech", "epique", SAMOURAI, "Parade parfaite"),
  sp(17, "rouageon", "Rouageon", "tech", "commun", TOUR, "Rouage tournoyant"),
  sp(18, "minicro", "Minicro", "temps", "peu-commun", TOUR, "Ralentissement"),
  sp(19, "bugfantom", "Bugfantom", "tech", "rare", TOUR, "Erreur fatale"),
  sp(20, "sablombre", "Sablombre", "temps", "epique", TOUR, "Sablier inversé"),
  sp(21, "fritalune", "Fritalune", "temps", "legendaire", CITE, "Tempête dorée"),
  sp(22, "halterox", "Haltérox", "force", "legendaire", MUSCLE, "Dernière répétition"),
  sp(23, "kagezora", "Kagezora", "ombre", "legendaire", SAMOURAI, "Lame céleste"),
  sp(24, "chronarque", "Chronarque", "temps", "legendaire", TOUR, "Fracture temporelle"),
];

/**
 * Évolutions officielles : formes supplémentaires suivies dans la collection (elles ne remplacent
 * pas les espèces de base). Les légendaires n'évoluent pas.
 */
export const EVOLUTIONS: { from: string; name: string; lv: number; extra?: string }[] = [
  { from: "brokito", name: "Brokolosse", lv: 16 },
  { from: "patatox", name: "Patatorche", lv: 20 },
  { from: "lampix", name: "Lampionox", lv: 18 },
  { from: "ombrelot", name: "Ombracier", lv: 22 },
  { from: "minicro", name: "Minuitro", lv: 25 },
  { from: "gonflin", name: "Gonflator", lv: 20 },
  { from: "kataneko", name: "Kataneko Shogun", lv: 25, extra: "épreuve du dojo" },
];

/** Formes évoluées obtenues (une créature capturée qui a atteint son niveau d'évolution). */
export const evolvedForms = (r: Rpg) => EVOLUTIONS.filter((e) => (r.mons?.[e.from]?.level ?? 0) >= e.lv && MEMBERS[e.from]?.evo).map((e) => e.name);

export const speciesOf = (id: string) => SPECIES.find((s) => s.id === id) ?? null;

/** Places de combat pour les compagnons (Sparrow en plus). */
export const ACTIVE = 4;

/** Expérience pour passer au niveau suivant. */
export const xpNeed = (lv: number) => 30 + lv * 20;

/** Rencontre ou capture : la créature est vue dans le Bestiaire. */
export const seenKey = (sp: string) => `vu:${sp}`;
export const isSeen = (r: Rpg, sp: string) => r.flags.includes(seenKey(sp)) || !!r.mons?.[sp];

/** Ajoute une créature capturée (si déjà capturée, garde le meilleur niveau). */
export function addCaught(r: Rpg, sp: string, level: number, now: number): Rpg {
  const cur = r.mons?.[sp];
  const mon: MonSave = cur ? { ...cur, level: Math.max(cur.level, level) } : { level, xp: 0, caught: now };
  return { ...r, mons: { ...(r.mons ?? {}), [sp]: mon }, flags: r.flags.includes(seenKey(sp)) ? r.flags : [...r.flags, seenKey(sp)] };
}

/** Niveaux propres de toute l'équipe (compagnons et créatures), pour le combat et les pages. */
export const ownLevels = (r: Rpg): Record<string, { level: number }> => ({ ...(r.levels ?? {}), ...(r.mons ?? {}) });

/** Niveau d'un équipier (Sparrow : niveau du Sparrowgotchi ; un compagnon sans niveau propre le suit). */
export const levelOf = (r: Rpg, id: string, sparrow: number) => (id === "sparrow" ? sparrow : (r.mons?.[id]?.level ?? r.levels?.[id]?.level ?? sparrow));

/** Compagnons sans niveau propre (anciennes sauvegardes) : ils gardent le niveau de Sparrow, puis progressent seuls. */
export function fixLevels(r: Rpg, sparrow: number): Rpg {
  const missing = r.party.filter((id) => id !== "sparrow" && !r.mons?.[id] && !r.levels?.[id] && MEMBERS[id]);
  if (!missing.length) return r;
  return { ...r, levels: { ...(r.levels ?? {}), ...Object.fromEntries(missing.map((id) => [id, { level: sparrow, xp: 0 }])) } };
}

/**
 * Seuls les équipiers qui ont combattu gagnent l'expérience du combat (Sparrow passe par le Sparrowgotchi).
 * Renvoie les messages : montées de niveau, techniques apprises, évolutions.
 */
export function teamGainXp(r: Rpg, xp: number, fought: string[]): { rpg: Rpg; ups: string[] } {
  const ups: string[] = [];
  if (xp <= 0) return { rpg: r, ups };
  const mons = { ...(r.mons ?? {}) };
  const levels = { ...(r.levels ?? {}) };
  for (const id of new Set(fought)) {
    const m = MEMBERS[id];
    if (id === "sparrow" || !m) continue;
    const isMon = !!mons[id];
    const cur = isMon ? mons[id] : (levels[id] ?? { level: 1, xp: 0 });
    let { level, xp: x } = cur;
    x += xp;
    while (level < 99 && x >= xpNeed(level)) {
      x -= xpNeed(level);
      level++;
      const name = m.evo && level > m.evo.lv ? m.evo.name : m.name;
      ups.push(`${name} passe au niveau ${level} !`);
      for (const l of m.learn ?? []) if (l.lv === level) ups.push(`${name} apprend ${MOVES[l.move]?.name ?? l.move} !`);
      if (m.evo?.lv === level) ups.push(`Quoi ? ${m.name} évolue en ${m.evo.name} !`);
    }
    if (isMon) mons[id] = { ...mons[id], level, xp: x };
    else levels[id] = { level, xp: x };
  }
  return { rpg: { ...r, ...(Object.keys(mons).length ? { mons } : {}), ...(Object.keys(levels).length ? { levels } : {}) }, ups };
}

/** Ancienne règle (V1) : les créatures de l'équipe active gagnent l'expérience. */
export const monsGainXp = (r: Rpg, xp: number) => teamGainXp(r, xp, r.party.slice(0, ACTIVE).filter((id) => r.mons?.[id]));

/** Intégrer une créature à l'équipe active (en tête), ou la remettre au Bestiaire. */
export function toggleTeam(r: Rpg, sp: string): Rpg {
  if (!r.mons?.[sp]) return r;
  if (r.party.slice(0, ACTIVE).includes(sp)) return { ...r, party: r.party.filter((p) => p !== sp) };
  return { ...r, party: [sp, ...r.party.filter((p) => p !== sp)] };
}

/** Combat sauvage d'une espèce. */
export const wildBattle = (sp: string) => Object.values(BATTLES).find((b) => b.wild === sp)?.id ?? null;
