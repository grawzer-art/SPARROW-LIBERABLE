/**
 * RPG — quêtes scénarisées, objets et drapeaux (logique pure, testable).
 * Séparées des missions quotidiennes de Sparrowgotchi. Sauvegardées dans `state.rpg`.
 *
 * Les étapes d'une quête peuvent se faire dans le désordre (trouver le badge avant de
 * parler à Nico, par exemple) : aucune progression ne peut se bloquer.
 */

import { gain, log, type State } from "../gotchi/core";

import { type QuestStatus, type Rpg } from "./state";

export { emptyRpg, restoreRpg, type QuestStatus, type Rpg } from "./state";

export interface QuestStep {
  id: string;
  txt: string;
}

export interface Quest {
  id: string;
  chapter: number;
  name: string;
  desc: string;
  steps: QuestStep[];
  reward: { xp: number; coins: number; item?: string };
}

export const QUESTS: Quest[] = [
  {
    id: "ville-figee",
    chapter: 1,
    name: "La Ville Figée",
    desc: "Une panne mystérieuse a figé le quartier. Toutes les horloges affichent 23:59. Sparrow est le seul à s'en inquiéter. Enfin, presque.",
    steps: [
      { id: "sortir", txt: "Sortir de l'appartement" },
      { id: "explorer", txt: "Explorer le quartier jusqu'à la place de la Fontaine" },
      { id: "nico", txt: "Discuter avec Nico le Livreur" },
      { id: "horloges", txt: "Examiner la grande horloge de la place" },
      { id: "badge", txt: "Trouver un badge de maintenance" },
      { id: "station", txt: "Entrer dans la station électrique" },
      { id: "evenement", txt: "Examiner le transformateur" },
    ],
    reward: { xp: 120, coins: 150, item: "fragment-1" },
  },
];

export const questById = (id: string) => QUESTS.find((q) => q.id === id);

export interface ItemDef {
  id: string;
  name: string;
  desc: string;
  icon: string;
}

export const RPG_ITEMS: ItemDef[] = [
  { id: "pizza", name: "Pizza tiède", desc: "Livrée par Nico. Tiède depuis 23:59. Elle ne refroidit pas, elle ne réchauffe pas. Elle attend.", icon: "◒" },
  { id: "badge", name: "Badge de maintenance", desc: "« MAINTENANCE — STATION 404 ». Ouvre le portail de la station électrique.", icon: "▣" },
  { id: "fragment-1", name: "Fragment d'horloge n°1", desc: "Un éclat de cadran qui vibre doucement. Il en manque d'autres, quelque part au Centre-ville.", icon: "◈" },
];

export const itemDef = (id: string) => RPG_ITEMS.find((i) => i.id === id);

export const isDone = (r: Rpg, quest: string, stepId: string) => r.done.includes(`${quest}:${stepId}`);
export const has = (r: Rpg, item: string) => r.items.includes(item);
export const flag = (r: Rpg, f: string) => r.flags.includes(f);
export const status = (r: Rpg, quest: string): QuestStatus => r.quests[quest] ?? "disponible";

/** Prochaine étape à faire (la première non cochée). */
export function nextStep(r: Rpg, quest: string): QuestStep | null {
  const q = questById(quest);
  return q?.steps.find((s) => !isDone(r, quest, s.id)) ?? null;
}

export type Effect =
  | { kind: "step"; quest: string; step: string }
  | { kind: "item"; id: string }
  | { kind: "drop"; id: string }
  | { kind: "flag"; id: string }
  | { kind: "seen"; id: string };

export interface Applied {
  state: State;
  notes: string[];
  /** La quête vient d'être terminée. */
  completed: Quest | null;
}

/** Applique des effets de dialogue / d'objet ; gère activation, fin de quête et récompenses. */
export function applyEffects(s0: State, effects: Effect[], now: number): Applied {
  let s = s0;
  let r: Rpg = { ...s.rpg, quests: { ...s.rpg.quests } };
  const notes: string[] = [];
  let completed: Quest | null = null;
  for (const e of effects) {
    if (e.kind === "item" && !r.items.includes(e.id)) {
      r = { ...r, items: [...r.items, e.id] };
      notes.push(`Objet obtenu : ${itemDef(e.id)?.name ?? e.id}`);
    } else if (e.kind === "drop") r = { ...r, items: r.items.filter((i) => i !== e.id) };
    else if (e.kind === "flag" && !r.flags.includes(e.id)) r = { ...r, flags: [...r.flags, e.id] };
    else if (e.kind === "seen" && !r.seen.includes(e.id)) r = { ...r, seen: [...r.seen, e.id] };
    else if (e.kind === "step") {
      const key = `${e.quest}:${e.step}`;
      const q = questById(e.quest);
      if (!q || r.done.includes(key) || r.quests[e.quest] === "terminee") continue;
      if (r.quests[e.quest] !== "active") {
        r.quests[e.quest] = "active";
        notes.push(`Nouvelle quête : ${q.name}`);
      }
      r = { ...r, done: [...r.done, key] };
      const st = q.steps.find((x) => x.id === e.step);
      if (st) notes.push(`✓ ${st.txt}`);
      if (q.steps.every((x) => r.done.includes(`${q.id}:${x.id}`))) {
        r.quests[e.quest] = "terminee";
        completed = q;
        if (q.reward.item && !r.items.includes(q.reward.item)) r = { ...r, items: [...r.items, q.reward.item] };
      }
    }
  }
  s = { ...s, rpg: r };
  if (completed) {
    s = log(s, `Quête terminée : ${completed.name}`, "level", now);
    const g = gain(s, completed.reward.xp, completed.reward.coins, now);
    s = g.state;
    notes.push(`Quête terminée ! +${completed.reward.xp} XP · +${completed.reward.coins} FP`);
    for (const l of g.levels) notes.push(`NIVEAU ${l} !`);
  }
  return { state: s, notes, completed };
}
