/**
 * SPARROWGOTCHI — moteur (logique pure, sans DOM, testable).
 *
 * Toutes les jauges vont de 0 à 100, 100 = au top.
 * Le temps est réel : à chaque ouverture, on rattrape le temps écoulé (plafonné),
 * Sparrow a donc « vécu sa vie » pendant ton absence.
 * Sparrow ne meurt jamais : au pire il fait une crise (c'est un tamagotchi second degré).
 */

import { LINES, pick } from "./lines";

export type Stat = "satiete" | "humeur" | "energie" | "forme" | "fun";
export type Action = "frites" | "salade" | "dofus" | "sieste" | "douche" | "parler";
export type Status = "gras" | "focus" | "rage" | "dofus" | null;
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
  | "degout"
  | "crise";

export const STATS: { id: Stat; label: string }[] = [
  { id: "satiete", label: "Faim" },
  { id: "humeur", label: "Humeur" },
  { id: "energie", label: "Énergie" },
  { id: "forme", label: "Forme" },
  { id: "fun", label: "Gaming" },
];

const MIN = 60_000;
const HOUR = 60 * MIN;

/** Perte par heure (Sparrow ne dort presque jamais : l'énergie baisse lentement). */
export const DECAY: Record<Stat, number> = {
  satiete: 6,
  humeur: 2.5,
  energie: 2,
  forme: 1.2,
  fun: 4.5,
};

/** Au-delà de 6 h d'absence, le temps compte moins (une nuit loin du téléphone n'est pas un abandon). */
export function effectiveHours(h: number): number {
  return h <= 6 ? h : 6 + (h - 6) * 0.35;
}

/** Rattrapage maximal après une longue absence (on ne retrouve pas un Sparrow à zéro partout). */
export const MAX_CATCHUP = 48 * HOUR;
export const FLOOR = 4;

export interface State {
  v: 1;
  stats: Record<Stat, number>;
  status: Status;
  statusUntil: number;
  /** Horodatages des derniers repas (pour l'effet « trop de frites » / « trop de salade »). */
  recentFrites: number[];
  recentSalade: number[];
  cooldowns: Partial<Record<Action, number>>;
  born: number;
  last: number;
  counters: { frites: number; salade: number; dofus: number; siestesRefusees: number; crises: number };
}

export interface Result {
  state: State;
  line: string;
  /** Animation à jouer (même nom que l'action, ou un état spécial). */
  anim: Action | "refus" | "rage" | "drop" | "crise" | "gras" | "event";
  delta: Partial<Record<Stat, number>>;
}

export const COOLDOWN: Record<Action, number> = {
  frites: 8_000,
  salade: 8_000,
  dofus: 12_000,
  sieste: 25_000,
  douche: 15_000,
  parler: 2_500,
};

const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function newState(now: number): State {
  return {
    v: 1,
    stats: { satiete: 70, humeur: 70, energie: 65, forme: 60, fun: 55 },
    status: null,
    statusUntil: 0,
    recentFrites: [],
    recentSalade: [],
    cooldowns: {},
    born: now,
    last: now,
    counters: { frites: 0, salade: 0, dofus: 0, siestesRefusees: 0, crises: 0 },
  };
}

/** Valide un état lu depuis le stockage (ancienne version, données abîmées…). */
export function restore(raw: unknown, now: number): State {
  const base = newState(now);
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<State>;
  const num = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? x : d);
  const stats = { ...base.stats };
  for (const { id } of STATS) stats[id] = clamp(num(o.stats?.[id], base.stats[id]));
  const ts = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is number => typeof x === "number").slice(-10) : []);
  const c = (o.counters ?? {}) as Partial<State["counters"]>;
  return {
    v: 1,
    stats,
    status: (["gras", "focus", "rage", "dofus"] as const).includes(o.status as never) ? (o.status as Status) : null,
    statusUntil: num(o.statusUntil, 0),
    recentFrites: ts(o.recentFrites),
    recentSalade: ts(o.recentSalade),
    cooldowns: {},
    born: Math.min(num(o.born, now), now),
    last: Math.min(num(o.last, now), now),
    counters: {
      frites: num(c.frites, 0),
      salade: num(c.salade, 0),
      dofus: num(c.dofus, 0),
      siestesRefusees: num(c.siestesRefusees, 0),
      crises: num(c.crises, 0),
    },
  };
}

function apply(s: State, d: Partial<Record<Stat, number>>): State {
  const stats = { ...s.stats };
  for (const k of Object.keys(d) as Stat[]) stats[k] = clamp(stats[k] + (d[k] ?? 0));
  return { ...s, stats };
}

/** Fait passer le temps (dt en ms). L'état « gras » ou une session Dofus modifient la vitesse de chute. */
export function tick(s: State, now: number): State {
  const dt = Math.min(Math.max(0, now - s.last), MAX_CATCHUP);
  if (dt <= 0) return s;
  const h = effectiveHours(dt / HOUR);
  const mult: Partial<Record<Stat, number>> = {};
  if (s.status === "dofus" && now < s.statusUntil) {
    mult.fun = -0.5; // le fun monte pendant la session
    mult.energie = 3;
    mult.satiete = 1.4;
  }
  if (s.status === "gras" && now < s.statusUntil) mult.forme = 3;
  const stats = { ...s.stats };
  for (const { id } of STATS) {
    const loss = DECAY[id] * (mult[id] ?? 1) * h;
    // Les jauges ne descendent pas sous FLOOR avec le seul passage du temps (pas de mort).
    stats[id] = loss > 0 ? Math.max(Math.min(stats[id], FLOOR), stats[id] - loss) : clamp(stats[id] - loss);
  }
  const expired = s.status && now >= s.statusUntil;
  const cutoff = now - 45 * MIN;
  return {
    ...s,
    stats,
    status: expired ? null : s.status,
    statusUntil: expired ? 0 : s.statusUntil,
    recentFrites: s.recentFrites.filter((t) => t > cutoff),
    recentSalade: s.recentSalade.filter((t) => t > cutoff),
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

export function cooldownLeft(s: State, a: Action, now: number): number {
  return Math.max(0, (s.cooldowns[a] ?? 0) - now);
}

function withCooldown(s: State, a: Action, now: number): State {
  return { ...s, cooldowns: { ...s.cooldowns, [a]: now + COOLDOWN[a] } };
}

function setStatus(s: State, status: Status, minutes: number, now: number): State {
  return { ...s, status, statusUntil: now + minutes * MIN };
}

/** Effectue une action du joueur. */
export function act(s0: State, a: Action, now: number, rand: () => number = Math.random): Result {
  let s = tick(s0, now);
  const busy = s.status === "focus" && now < s.statusUntil && a !== "frites" && a !== "parler";
  if (busy) {
    return { state: s, line: pick(LINES.focusRefus, rand), anim: "refus", delta: {} };
  }
  s = withCooldown(s, a, now);
  let d: Partial<Record<Stat, number>> = {};
  let line = "";
  let anim: Result["anim"] = a;

  switch (a) {
    case "frites": {
      s = { ...s, recentFrites: [...s.recentFrites, now], counters: { ...s.counters, frites: s.counters.frites + 1 } };
      if (s.stats.satiete >= 95) {
        d = { humeur: 5, forme: -4 };
        line = pick(LINES.fritesPlein, rand);
      } else {
        d = { satiete: 30, humeur: 12, forme: -6 };
        line = pick(LINES.frites, rand);
      }
      if (s.recentFrites.length >= 3 && s.status !== "gras") {
        s = setStatus(s, "gras", 12, now);
        d = { ...d, energie: -8 };
        line = pick(LINES.gras, rand);
        anim = "gras";
      }
      break;
    }
    case "salade": {
      if (s.recentSalade.length >= 1 || rand() < 0.25) {
        d = { humeur: -8 };
        line = pick(LINES.saladeRefus, rand);
        anim = "refus";
        s = { ...s, recentSalade: [...s.recentSalade, now] };
      } else {
        s = { ...s, recentSalade: [...s.recentSalade, now], counters: { ...s.counters, salade: s.counters.salade + 1 } };
        d = { satiete: 12, forme: 12, humeur: -5 };
        line = pick(LINES.salade, rand);
        if (s.status === "gras") s = { ...s, status: null, statusUntil: 0 };
      }
      break;
    }
    case "dofus": {
      s = { ...s, counters: { ...s.counters, dofus: s.counters.dofus + 1 } };
      const r = rand();
      if (r < 0.2) {
        d = { humeur: -12, fun: 10, energie: -10 };
        s = setStatus(s, "rage", 3, now);
        line = pick(LINES.rage, rand);
        anim = "rage";
      } else if (r < 0.3) {
        d = { humeur: 30, fun: 30, energie: -8 };
        line = pick(LINES.drop, rand);
        anim = "drop";
      } else if (r < 0.45) {
        d = { humeur: 12, fun: 25, energie: -12 };
        s = setStatus(s, "focus", 4, now);
        line = pick(LINES.focus, rand);
      } else {
        d = { humeur: 15, fun: 25, energie: -10, forme: -3 };
        line = pick(LINES.dofus, rand);
      }
      break;
    }
    case "sieste": {
      if (s.stats.energie > 70 || rand() < 0.35) {
        d = { energie: 6 };
        line = pick(LINES.siesteRefus, rand);
        anim = "refus";
        s = { ...s, counters: { ...s.counters, siestesRefusees: s.counters.siestesRefusees + 1 } };
      } else {
        d = { energie: 28, humeur: 4 };
        line = pick(LINES.sieste, rand);
      }
      break;
    }
    case "douche": {
      d = { forme: 15, humeur: 4 };
      line = pick(LINES.douche, rand);
      if (s.status === "gras") {
        s = { ...s, status: null, statusUntil: 0 };
        line = pick(LINES.doucheGras, rand);
      }
      break;
    }
    case "parler": {
      d = { humeur: 3 };
      const m = mood(s, now);
      line = pick(LINES.parler[m] ?? LINES.parler.neutre, rand);
      break;
    }
  }
  s = apply(s, d);
  return { state: s, line, anim, delta: d };
}

/**
 * Événement aléatoire (appelé régulièrement pendant que l'écran est ouvert, et au retour).
 * Renvoie null la plupart du temps.
 */
export function randomEvent(s0: State, now: number, rand: () => number = Math.random): Result | null {
  let s = tick(s0, now);
  const st = s.stats;
  if (moyenne(s) < 22) {
    s = { ...s, counters: { ...s.counters, crises: s.counters.crises + 1 } };
    return { state: s, line: pick(LINES.crise, rand), anim: "crise", delta: {} };
  }
  if (rand() > 0.5) return null;
  if (st.satiete < 40) return { state: s, line: pick(LINES.reclameFrites, rand), anim: "event", delta: {} };
  if (st.energie < 30) return { state: s, line: pick(LINES.pasSommeil, rand), anim: "event", delta: {} };
  if (st.fun < 35 && !s.status) {
    s = setStatus(apply(s, { fun: 15, energie: -6, humeur: 6 }), "dofus", 6, now);
    return { state: s, line: pick(LINES.sessionInfinie, rand), anim: "dofus", delta: { fun: 15, energie: -6, humeur: 6 } };
  }
  return { state: s, line: pick(LINES.punchline, rand), anim: "event", delta: {} };
}

/** Résumé de ce qui s'est passé pendant l'absence (affiché au retour). */
export function absenceReport(before: State, after: State, now: number): string | null {
  const away = now - before.last;
  if (away < 30 * MIN) return null;
  const h = Math.round(away / HOUR);
  const dur = h < 1 ? "moins d'une heure" : h < 48 ? `${h} h` : `${Math.round(h / 24)} jours`;
  if (after.stats.satiete < 30) return `Absent ${dur}. Sparrow a mangé un ticket de caisse pour survivre.`;
  if (after.stats.fun < 30) return `Absent ${dur}. Sparrow a compté les pixels de son écran. Deux fois.`;
  if (after.stats.energie < 30) return `Absent ${dur}. Sparrow n'a pas dormi. Il affirme que c'est un choix.`;
  return `Absent ${dur}. Sparrow a survécu sans toi. Il fait semblant de ne pas t'avoir attendu.`;
}

export const ageJours = (s: State, now: number) => Math.floor((now - s.born) / (24 * HOUR));
