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
  /** Créatures capturées (Bestiaire), par espèce : niveau, expérience, date de capture. */
  mons?: Record<string, MonSave>;
  /** Niveau et expérience propres des compagnons (ils ne suivent plus Sparrow). */
  levels?: Record<string, { level: number; xp: number }>;
  /** PV restants entre deux combats, en fraction des PV max (absent = en pleine forme). */
  hp?: Record<string, number>;
  /** Dernière infirmerie visitée : on y réapparaît après une défaite (absent = l'appartement). */
  respawn?: { map: string; x: number; y: number; dir: "up" | "down" | "left" | "right" };
}

export interface MonSave {
  level: number;
  xp: number;
  caught: number;
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
  const mons: Record<string, MonSave> = {};
  if (o.mons && typeof o.mons === "object")
    for (const [k, v] of Object.entries(o.mons as Record<string, Partial<MonSave>>))
      if (v && typeof v.level === "number" && v.level >= 1)
        mons[k] = { level: Math.min(99, Math.floor(v.level)), xp: typeof v.xp === "number" && v.xp > 0 ? Math.floor(v.xp) : 0, caught: typeof v.caught === "number" ? v.caught : 0 };
  const levels: Record<string, { level: number; xp: number }> = {};
  if (o.levels && typeof o.levels === "object")
    for (const [k, v] of Object.entries(o.levels as Record<string, Partial<MonSave>>))
      if (v && typeof v.level === "number" && v.level >= 1) levels[k] = { level: Math.min(99, Math.floor(v.level)), xp: typeof v.xp === "number" && v.xp > 0 ? Math.floor(v.xp) : 0 };
  const hp: Record<string, number> = {};
  if (o.hp && typeof o.hp === "object")
    for (const [k, v] of Object.entries(o.hp as Record<string, unknown>)) if (typeof v === "number" && v >= 0 && v < 1) hp[k] = Math.round(v * 1000) / 1000;
  const sp = o.respawn as Rpg["respawn"] | undefined;
  const respawn = sp && typeof sp.map === "string" && Number.isInteger(sp.x) && Number.isInteger(sp.y) && ["up", "down", "left", "right"].includes(sp.dir) ? { map: sp.map, x: sp.x, y: sp.y, dir: sp.dir } : null;
  return {
    ...(Object.keys(hp).length ? { hp } : {}),
    ...(respawn ? { respawn } : {}),
    ...(Object.keys(levels).length ? { levels } : {}), quests, done: strs(o.done), items: strs(o.items), flags: strs(o.flags), seen: strs(o.seen), bag, party: strs(o.party), gear, owned, skills: strs(o.skills), ...(Object.keys(mons).length ? { mons } : {}) };
}
