/**
 * SPARROWGOTCHI 2.0 — état et fonctions de base (logique pure, testable, sans DOM).
 *
 * Jauges 0-100 (100 = au top). Le temps est réel : à chaque ouverture on rattrape le
 * temps écoulé (ralenti après 6 h, plafonné à 48 h). Sparrow ne meurt jamais.
 * Les sauvegardes v1 (premier Sparrowgotchi) sont migrées sans perte.
 */

import { TIMEZONE } from "@/config";
import { DEFAULT_EQUIP, DEFAULT_OWNED, levelReward, xpToNext } from "./items";

export type Stat = "satiete" | "humeur" | "energie" | "forme" | "fun";
export type Action = "frites" | "salade" | "dofus" | "sieste" | "douche" | "parler";
/** « gras » = état Fritoman. */
export type Status = "gras" | "focus" | "rage" | "dofus" | "boude" | null;
export type Mood =
  | "content"
  | "neutre"
  | "affame"
  | "creve"
  | "deprime"
  | "gras"
  | "focus"
  | "rage"
  | "dofus"
  | "boude"
  | "degout"
  | "crise";

export const STATS: { id: Stat; label: string }[] = [
  { id: "satiete", label: "Faim" },
  { id: "humeur", label: "Humeur" },
  { id: "energie", label: "Énergie" },
  { id: "forme", label: "Forme" },
  { id: "fun", label: "Gaming" },
];

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

export const DECAY: Record<Stat, number> = { satiete: 6, humeur: 2.5, energie: 2, forme: 1.2, fun: 4.5 };
export const MAX_CATCHUP = 48 * HOUR;
export const FLOOR = 4;

/** Au-delà de 6 h d'absence, le temps compte moins (une nuit loin du téléphone n'est pas un abandon). */
export function effectiveHours(h: number): number {
  return h <= 6 ? h : 6 + (h - 6) * 0.35;
}

export interface Counters {
  frites: number;
  salade: number;
  saladeRefus: number;
  dofus: number;
  farms: number;
  siestes: number;
  siestesRefusees: number;
  douches: number;
  talks: number;
  crises: number;
  fritoman: number;
  rages: number;
  rares: number;
  events: number;
  rareEvents: number;
  caches: number;
  pannes: number;
  trainings: number;
  reps: number;
}

export interface Mission {
  id: string;
  progress: number;
  claimed: boolean;
}

export interface Journal {
  t: number;
  txt: string;
  kind: "event" | "rare" | "level" | "trophy" | "mission" | "drop" | "info";
}

export interface State {
  v: 2;
  stats: Record<Stat, number>;
  status: Status;
  statusUntil: number;
  recentFrites: number[];
  recentSalade: number[];
  cooldowns: Partial<Record<Action, number>>;
  born: number;
  last: number;
  counters: Counters;
  // Progression
  level: number;
  xp: number;
  coins: number;
  owned: string[];
  equip: { lunettes: string; tenue: string; tete: string; deco: string[] };
  missions: { day: string; list: Mission[] };
  trophies: Record<string, number>;
  journal: Journal[];
  /** Jours (AAAA-MM-JJ, Paris) où le joueur est venu. */
  days: string[];
  bestFarm: number;
  /** Points de muscle (évolution jusqu'à SPARROW TITAN). */
  muscle: number;
  bestMuscu: number;
  pcBrokenUntil: number;
  lastAction: { a: string; t: number } | null;
  /** Dernières répliques dites (anti-répétition). */
  said: string[];
  /** Objet caché du jour déjà trouvé ? */
  cacheDay: string;
  seenEvents: string[];
}

export const emptyCounters = (): Counters => ({
  frites: 0,
  salade: 0,
  saladeRefus: 0,
  dofus: 0,
  farms: 0,
  siestes: 0,
  siestesRefusees: 0,
  douches: 0,
  talks: 0,
  crises: 0,
  fritoman: 0,
  rages: 0,
  rares: 0,
  events: 0,
  rareEvents: 0,
  caches: 0,
  pannes: 0,
  trainings: 0,
  reps: 0,
});

export const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function parisDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(ms),
  );
}

export function parisHour(ms: number): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(new Date(ms)));
}

export function newState(now: number): State {
  return {
    v: 2,
    stats: { satiete: 70, humeur: 70, energie: 65, forme: 60, fun: 55 },
    status: null,
    statusUntil: 0,
    recentFrites: [],
    recentSalade: [],
    cooldowns: {},
    born: now,
    last: now,
    counters: emptyCounters(),
    level: 1,
    xp: 0,
    coins: 30,
    owned: [...DEFAULT_OWNED],
    equip: { ...DEFAULT_EQUIP, deco: [] },
    missions: { day: "", list: [] },
    trophies: {},
    journal: [],
    days: [parisDay(now)],
    bestFarm: 0,
    muscle: 0,
    bestMuscu: 0,
    pcBrokenUntil: 0,
    lastAction: null,
    said: [],
    cacheDay: "",
    seenEvents: [],
  };
}

const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
const strs = (a: unknown, max = 200) => (Array.isArray(a) ? a.filter((x): x is string => typeof x === "string").slice(-max) : []);

/** Restaure un état sauvegardé (v1 ou v2, données éventuellement abîmées) sans rien perdre. */
export function restore(raw: unknown, now: number): State {
  const base = newState(now);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<State> & { counters?: Partial<Counters> };
  const stats = { ...base.stats };
  for (const { id } of STATS) stats[id] = clamp(num(o.stats?.[id], base.stats[id]));
  const ts = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is number => typeof x === "number").slice(-10) : []);
  const counters = emptyCounters();
  for (const k of Object.keys(counters) as (keyof Counters)[]) counters[k] = Math.max(0, num(o.counters?.[k], 0));
  const owned = Array.from(new Set([...DEFAULT_OWNED, ...strs(o.owned)]));
  const eq = (o.equip ?? {}) as Partial<State["equip"]>;
  const pickOwned = (id: unknown, d: string) => (typeof id === "string" && owned.includes(id) ? id : d);
  const missions =
    o.missions && typeof o.missions.day === "string" && Array.isArray(o.missions.list)
      ? {
          day: o.missions.day,
          list: o.missions.list
            .filter((m) => m && typeof m.id === "string")
            .slice(0, 5)
            .map((m) => ({ id: m.id, progress: Math.max(0, num(m.progress, 0)), claimed: !!m.claimed })),
        }
      : base.missions;
  const trophies: Record<string, number> = {};
  if (o.trophies && typeof o.trophies === "object")
    for (const [k, v] of Object.entries(o.trophies)) if (typeof v === "number") trophies[k] = v;
  const journal = Array.isArray(o.journal)
    ? o.journal.filter((j) => j && typeof j.txt === "string" && typeof j.t === "number").slice(-40)
    : [];
  const level = Math.max(1, Math.floor(num(o.level, 1)));
  return {
    v: 2,
    stats,
    status: (["gras", "focus", "rage", "dofus", "boude"] as const).includes(o.status as never) ? (o.status as Status) : null,
    statusUntil: num(o.statusUntil, 0),
    recentFrites: ts(o.recentFrites),
    recentSalade: ts(o.recentSalade),
    cooldowns: {},
    born: Math.min(num(o.born, now), now),
    last: Math.min(num(o.last, now), now),
    counters,
    level,
    xp: Math.max(0, Math.min(num(o.xp, 0), xpToNext(level) - 1)),
    coins: Math.max(0, Math.floor(num(o.coins, base.coins))),
    owned,
    equip: {
      lunettes: pickOwned(eq.lunettes, DEFAULT_EQUIP.lunettes),
      tenue: pickOwned(eq.tenue, DEFAULT_EQUIP.tenue),
      tete: pickOwned(eq.tete, DEFAULT_EQUIP.tete),
      deco: strs(eq.deco, 10).filter((d) => owned.includes(d)),
    },
    missions,
    trophies,
    journal,
    days: strs(o.days, 400).length ? strs(o.days, 400) : base.days,
    bestFarm: Math.max(0, num(o.bestFarm, 0)),
    muscle: Math.max(0, num(o.muscle, 0)),
    bestMuscu: Math.max(0, num(o.bestMuscu, 0)),
    pcBrokenUntil: Math.min(num(o.pcBrokenUntil, 0), now + 2 * HOUR),
    lastAction:
      o.lastAction && typeof o.lastAction.a === "string" && typeof o.lastAction.t === "number" ? o.lastAction : null,
    said: strs(o.said, 12),
    cacheDay: typeof o.cacheDay === "string" ? o.cacheDay : "",
    seenEvents: strs(o.seenEvents, 200),
  };
}

export function apply(s: State, d: Partial<Record<Stat, number>>): State {
  const stats = { ...s.stats };
  for (const k of Object.keys(d) as Stat[]) stats[k] = clamp(stats[k] + (d[k] ?? 0));
  return { ...s, stats };
}

export function setStatus(s: State, status: Status, minutes: number, now: number): State {
  return { ...s, status, statusUntil: now + minutes * MIN };
}

export function bump(s: State, key: keyof Counters, n = 1): State {
  return { ...s, counters: { ...s.counters, [key]: s.counters[key] + n } };
}

export function log(s: State, txt: string, kind: Journal["kind"], now: number): State {
  return { ...s, journal: [...s.journal, { t: now, txt, kind }].slice(-40) };
}

/** Fait passer le temps. */
export function tick(s: State, now: number): State {
  const dt = Math.min(Math.max(0, now - s.last), MAX_CATCHUP);
  if (dt <= 0) return s;
  const h = effectiveHours(dt / HOUR);
  const mult: Partial<Record<Stat, number>> = {};
  const live = (st: Status) => s.status === st && now < s.statusUntil;
  if (live("dofus")) {
    mult.fun = -0.5;
    mult.energie = 3;
    mult.satiete = 1.4;
  }
  if (live("gras")) mult.forme = 3;
  if (live("boude")) mult.humeur = 1.5;
  const stats = { ...s.stats };
  for (const { id } of STATS) {
    const loss = DECAY[id] * (mult[id] ?? 1) * h;
    stats[id] = loss > 0 ? Math.max(Math.min(stats[id], FLOOR), stats[id] - loss) : clamp(stats[id] - loss);
  }
  const expired = s.status && now >= s.statusUntil;
  const cutoff = now - 45 * MIN;
  const day = parisDay(now);
  return {
    ...s,
    stats,
    status: expired ? null : s.status,
    statusUntil: expired ? 0 : s.statusUntil,
    recentFrites: s.recentFrites.filter((t) => t > cutoff),
    recentSalade: s.recentSalade.filter((t) => t > cutoff),
    days: s.days.includes(day) ? s.days : [...s.days, day].slice(-400),
    last: now,
  };
}

export function moyenne(s: State): number {
  return STATS.reduce((a, { id }) => a + s.stats[id], 0) / STATS.length;
}

export function mood(s: State, now: number): Mood {
  if (s.status && now < s.statusUntil) return s.status;
  const st = s.stats;
  if (moyenne(s) < 22) return "crise";
  if (st.satiete < 25) return "affame";
  if (st.energie < 20) return "creve";
  if (st.humeur < 25 || st.fun < 15) return "deprime";
  if (moyenne(s) > 70) return "content";
  return "neutre";
}

/** Ajoute de l'expérience et des pièces ; gère les montées de niveau (plusieurs possibles). */
export function gain(s: State, xp: number, coins: number, now: number): { state: State; levels: number[] } {
  let level = s.level;
  let x = s.xp + Math.max(0, Math.round(xp));
  let c = s.coins + Math.max(0, Math.round(coins));
  const levels: number[] = [];
  while (x >= xpToNext(level)) {
    x -= xpToNext(level);
    level += 1;
    c += levelReward(level);
    levels.push(level);
  }
  let out: State = { ...s, xp: x, coins: c, level };
  for (const l of levels) out = log(out, `Niveau ${l} atteint ! +${levelReward(l)} FP`, "level", now);
  return { state: out, levels };
}

export const ageJours = (s: State, now: number) => Math.floor((now - s.born) / DAY);

/** Petit générateur déterministe (missions du jour, objet caché). */
export function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
