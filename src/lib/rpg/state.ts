/** RPG — état sauvegardé (sans dépendance, pour éviter les imports circulaires avec core). */

export type QuestStatus = "disponible" | "active" | "terminee";

export interface Rpg {
  quests: Record<string, QuestStatus>;
  /** Étapes faites, sous la forme « quête:étape ». */
  done: string[];
  /** Objets de quête (uniques). */
  items: string[];
  flags: string[];
  /** Lieux découverts. */
  seen: string[];
  /** Consommables (soins, bonus) et leur quantité. */
  bag: Record<string, number>;
  /** Compagnons recrutés (Sparrow est toujours là). */
  party: string[];
  /** Équipement de Sparrow. */
  gear: { arme?: string; armure?: string; accessoire?: string };
  /** Équipements possédés. */
  owned: string[];
  /** Techniques apprises en plus des techniques de base. */
  skills: string[];
}

export const emptyRpg = (): Rpg => ({
  quests: { "ville-figee": "disponible" },
  done: [],
  items: [],
  flags: [],
  seen: [],
  bag: {},
  party: [],
  gear: {},
  owned: [],
  skills: [],
});

const strs = (a: unknown) => (Array.isArray(a) ? Array.from(new Set(a.filter((x): x is string => typeof x === "string"))).slice(0, 300) : []);

export function restoreRpg(raw: unknown): Rpg {
  const base = emptyRpg();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<Rpg>;
  const quests = { ...base.quests };
  if (o.quests && typeof o.quests === "object")
    for (const [k, v] of Object.entries(o.quests)) if (v === "disponible" || v === "active" || v === "terminee") quests[k] = v;
  const bag: Record<string, number> = {};
  if (o.bag && typeof o.bag === "object")
    for (const [k, v] of Object.entries(o.bag)) if (typeof v === "number" && v > 0) bag[k] = Math.min(99, Math.floor(v));
  const g = (o.gear ?? {}) as Rpg["gear"];
  const owned = strs(o.owned);
  const gear: Rpg["gear"] = {};
  for (const slot of ["arme", "armure", "accessoire"] as const) if (typeof g[slot] === "string" && owned.includes(g[slot]!)) gear[slot] = g[slot];
  return { quests, done: strs(o.done), items: strs(o.items), flags: strs(o.flags), seen: strs(o.seen), bag, party: strs(o.party), gear, owned, skills: strs(o.skills) };
}
