/**
 * RPG — types communs des dialogues (sans dépendance vers les chapitres).
 *
 * Une conversation = des répliques, puis éventuellement :
 *  - des effets (quête, objets, drapeaux, recrutement, FP…) appliqués à la fin ;
 *  - un choix (chaque réponse mène à une autre conversation) ;
 *  - une action (combat, boutique, mini-jeu, voyage, scène).
 */

import type { Dest } from "./mapdef";
import type { Effect } from "./quest";
import type { Rpg } from "./state";

export interface Line {
  who: string;
  text: string;
}

export type Action =
  | { kind: "battle"; id: string }
  | { kind: "shop"; id: string }
  | { kind: "minigame"; id: string }
  | { kind: "warp"; to: Dest }
  | { kind: "scene"; id: string };

export interface Choice {
  label: string;
  next: Conversation;
}

export interface Conversation {
  lines: Line[];
  effects?: Effect[];
  /** Scène scénarisée à jouer après le dialogue (chapitre 1). */
  cutscene?: "evenement";
  choices?: Choice[];
  then?: Action;
}

export type Rule = { when?: (r: Rpg) => boolean; talk: (r: Rpg) => Conversation };
export type ThingTalk = (r: Rpg, text?: string) => Conversation | null;

export interface Chapter {
  /** Répliques des PNJ, clé « carte:pnj ». */
  npcs: Record<string, Rule[]>;
  /** Textes des objets, clé « carte:objet » (ou « *:objet » pour toutes les cartes). */
  things: Record<string, ThingTalk>;
  arrival?: (map: string, r: Rpg, first: boolean) => Conversation | null;
  afterBattle?: (id: string, r: Rpg) => Conversation | null;
}

export const pick = (rules: Rule[], r: Rpg) => rules.find((x) => !x.when || x.when(r))!.talk(r);
