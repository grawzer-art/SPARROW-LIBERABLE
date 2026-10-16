import { END, START, TIMEZONE } from "@/config";

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Décalage (ms) du fuseau `timeZone` par rapport à UTC à l'instant `utcMs`. */
export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts: Record<string, number> = {};
  for (const p of dtf.formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(utcMs / SECOND) * SECOND;
}

/**
 * Convertit une date/heure « murale » d'un fuseau en instant absolu (ms UTC).
 * Gère l'heure d'été : on corrige le décalage en deux passes.
 */
export function zonedToUtc(date: string, time: string, timeZone: string = TIMEZONE): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, hh, mm, 0);
  let utc = wall - tzOffsetMs(wall, timeZone);
  utc = wall - tzOffsetMs(utc, timeZone);
  return utc;
}

export const START_MS = zonedToUtc(START.date, START.time);
export const END_MS = zonedToUtc(END.date, END.time);
export const TOTAL_MS = END_MS - START_MS;
/** Durée totale en jours calendaires (1 826). */
export const TOTAL_DAYS = Math.round(TOTAL_MS / DAY);

export interface Remaining {
  /** Millisecondes restantes (≥ 0). */
  ms: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  /** Fraction écoulée entre START et END, bornée à [0, 1]. */
  progress: number;
  done: boolean;
  /** Le compteur n'a pas encore officiellement démarré. */
  notStarted: boolean;
}

/**
 * Temps restant jusqu'à END_MS. On arrondit à la seconde supérieure pour que
 * l'affichage tombe à 0:00:00:00 exactement à l'instant cible, pas une seconde avant.
 */
export function remaining(now: number, end: number = END_MS, start: number = START_MS): Remaining {
  const ms = Math.max(0, end - now);
  const totalSeconds = Math.ceil(ms / SECOND);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const progress = Math.min(1, Math.max(0, (now - start) / (end - start)));
  return { ms, days, hours, minutes, seconds, progress, done: ms === 0, notStarted: now < start };
}

/** Délai jusqu'au prochain changement de seconde affichée : évite toute dérive. */
export function msUntilNextTick(now: number, end: number = END_MS): number {
  const ms = end - now;
  if (ms <= 0) return SECOND;
  const r = ms % SECOND;
  return (r === 0 ? SECOND : r) + 5;
}

export const pad = (n: number, len = 2) => String(n).padStart(len, "0");

/** Formate une date au format 12.10.2031 dans le fuseau officiel. */
export function formatDot(utcMs: number): string {
  const f = new Intl.DateTimeFormat("fr-FR", { timeZone: TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  return f.format(new Date(utcMs)).replace(/\//g, ".");
}

export function formatClock(utcMs: number): string {
  const f = new Intl.DateTimeFormat("fr-FR", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return f.format(new Date(utcMs));
}

/**
 * Horloge de référence. En temps normal = Date.now().
 * Pour tester : ajouter ?simuler=2031-10-11T23:59:50 à l'URL (heure de Paris),
 * le temps s'écoule ensuite normalement à partir de ce point.
 */
let simulatedOffset = 0;
export function initClock(search: string): boolean {
  const q = new URLSearchParams(search).get("simuler");
  if (!q) return false;
  const m = q.match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2})(?::(\d{2}))?)?$/);
  if (!m) return false;
  const target = zonedToUtc(m[1], m[2] ?? "00:00") + Number(m[3] ?? 0) * SECOND;
  simulatedOffset = target - Date.now();
  return true;
}
export const now = () => Date.now() + simulatedOffset;
