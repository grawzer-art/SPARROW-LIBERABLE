/** RPG — boutiques, équipement et mini-jeu de cuisine (logique pure, testable). */

import type { State } from "../gotchi/core";
import { CONSUMABLES, EQUIPMENT, SHOPS, priceOf } from "./bestiary";

export interface Bought {
  state: State;
  ok: boolean;
  msg: string;
}

/** Acheter un article (les FP sont ceux du Sparrowgotchi). */
export function buyRpg(s: State, shop: string, id: string): Bought {
  const sh = SHOPS[shop];
  if (!sh || !sh.items.includes(id)) return { state: s, ok: false, msg: "Cet article n'est pas vendu ici." };
  const price = priceOf(id);
  const eq = EQUIPMENT[id];
  if (eq && s.rpg.owned.includes(id)) return { state: s, ok: false, msg: `Tu as déjà : ${eq.name}.` };
  const c = CONSUMABLES[id];
  if (c && (s.rpg.bag[id] ?? 0) >= 99) return { state: s, ok: false, msg: "Ton sac est plein de ça." };
  if (s.coins < price) return { state: s, ok: false, msg: `Pas assez de FP (${price} FP).` };
  const rpg = eq ? { ...s.rpg, owned: [...s.rpg.owned, id] } : { ...s.rpg, bag: { ...s.rpg.bag, [id]: (s.rpg.bag[id] ?? 0) + 1 } };
  return { state: { ...s, coins: s.coins - price, rpg }, ok: true, msg: `Acheté : ${eq?.name ?? c?.name} (−${price} FP).${eq ? " Équipe-le dans l'inventaire." : ""}` };
}

/** Équiper (ou retirer) un équipement possédé. */
export function equipRpg(s: State, id: string): State {
  const e = EQUIPMENT[id];
  if (!e || !s.rpg.owned.includes(id)) return s;
  const gear = { ...s.rpg.gear };
  if (gear[e.slot] === id) delete gear[e.slot];
  else gear[e.slot] = id;
  return { ...s, rpg: { ...s.rpg, gear } };
}

// ─── Mini-jeu « Frites parfaites » ───

export type Cuisson = "pale" | "bien" | "parfait" | "brule";

/** Zones de cuisson sur une jauge de 0 (crues) à 1 (carbonisées). */
export const CUISSON = { bien: [0.56, 0.82] as const, parfait: [0.65, 0.73] as const };

export function rate(level: number): Cuisson {
  if (level >= CUISSON.parfait[0] && level <= CUISSON.parfait[1]) return "parfait";
  if (level >= CUISSON.bien[0] && level <= CUISSON.bien[1]) return "bien";
  return level < CUISSON.bien[0] ? "pale" : "brule";
}

export const POINTS: Record<Cuisson, number> = { parfait: 2, bien: 1, pale: 0, brule: 0 };
export const FOURNEES = 5;
/** Il faut 6 points sur 10 (par exemple 3 fournées parfaites, ou 1 parfaite et 4 bien dorées). */
export const OBJECTIF = 6;

/** Vitesse de cuisson (jauge par seconde) : les fournées cuisent de plus en plus vite. */
export const cookSpeed = (batch: number) => 0.26 + batch * 0.05;

export const cookScore = (r: Cuisson[]) => r.reduce((a, x) => a + POINTS[x], 0);
