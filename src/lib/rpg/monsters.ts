/**
 * RPG — créatures sauvages : Bestiaire, capture et progression (logique pure, testable).
 *
 * Une créature capturée est un équipier (`MEMBERS`) avec son propre niveau, sauvegardé dans
 * `rpg.mons`. Elle rejoint l'équipe comme les compagnons de l'histoire ; seuls les quatre premiers
 * compagnons de la liste combattent, les autres restent en réserve (rien n'est jamais perdu).
 */

import { BATTLES, MEMBERS } from "./bestiary";
import type { MonSave, Rpg } from "./state";

export interface Species {
  id: string;
  /** Numéro dans le Bestiaire. */
  n: number;
  type: string;
  habitat: string;
  /** Sprite de face (combat). */
  sprite: string;
}

export const SPECIES: Species[] = [{ id: "brokito", n: 1, type: "Végétal", habitat: "Potager du Jardin royal (Cité des Frites Perdues)", sprite: "brokito" }];

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

/** Les créatures qui ont combattu gagnent de l'expérience ; renvoie aussi les montées de niveau. */
export function monsGainXp(r: Rpg, xp: number): { rpg: Rpg; ups: string[] } {
  const ups: string[] = [];
  if (!r.mons || xp <= 0) return { rpg: r, ups };
  const mons = { ...r.mons };
  for (const id of r.party.slice(0, ACTIVE)) {
    const m = mons[id];
    if (!m) continue;
    let { level, xp: x } = m;
    x += xp;
    while (level < 99 && x >= xpNeed(level)) {
      x -= xpNeed(level);
      level++;
      ups.push(`${MEMBERS[id]?.name ?? id} passe au niveau ${level} !`);
    }
    mons[id] = { ...m, level, xp: x };
  }
  return { rpg: { ...r, mons }, ups };
}

/** Intégrer une créature à l'équipe active (en tête), ou la remettre au Bestiaire. */
export function toggleTeam(r: Rpg, sp: string): Rpg {
  if (!r.mons?.[sp]) return r;
  if (r.party.slice(0, ACTIVE).includes(sp)) return { ...r, party: r.party.filter((p) => p !== sp) };
  return { ...r, party: [sp, ...r.party.filter((p) => p !== sp)] };
}

/** Combat sauvage d'une espèce. */
export const wildBattle = (sp: string) => Object.values(BATTLES).find((b) => b.wild === sp)?.id ?? null;
