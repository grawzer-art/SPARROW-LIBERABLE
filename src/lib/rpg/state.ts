/** RPG — état sauvegardé (sans dépendance, pour éviter les imports circulaires avec core). */

export type QuestStatus = "disponible" | "active" | "terminee";

export interface Rpg {
  quests: Record<string, QuestStatus>;
  /** Étapes faites, sous la forme « quête:étape ». */
  done: string[];
  items: string[];
  flags: string[];
  /** Lieux découverts. */
  seen: string[];
}

export const emptyRpg = (): Rpg => ({ quests: { "ville-figee": "disponible" }, done: [], items: [], flags: [], seen: [] });

const strs = (a: unknown) => (Array.isArray(a) ? Array.from(new Set(a.filter((x): x is string => typeof x === "string"))).slice(0, 300) : []);

export function restoreRpg(raw: unknown): Rpg {
  const base = emptyRpg();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<Rpg>;
  const quests = { ...base.quests };
  if (o.quests && typeof o.quests === "object")
    for (const [k, v] of Object.entries(o.quests)) if (v === "disponible" || v === "active" || v === "terminee") quests[k] = v;
  return { quests, done: strs(o.done), items: strs(o.items), flags: strs(o.flags), seen: strs(o.seen) };
}

