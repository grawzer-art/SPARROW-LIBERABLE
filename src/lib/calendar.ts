import { TIMEZONE } from "@/config";

/** Jour de la semaine (0 = dimanche) et date « murale » à Paris pour un instant donné. */
function parisParts(utcMs: number) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "short",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  });
  const p: Record<string, string> = {};
  for (const x of f.formatToParts(new Date(utcMs))) p[x.type] = x.value;
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, wd, hour: +p.hour };
}

export const parisHour = (utcMs: number) => parisParts(utcMs).hour;

/**
 * Compte les jours calendaires restants (à partir de demain, heure de Paris,
 * jusqu'à la veille de la date cible) qui vérifient `pred`.
 */
export function countDays(fromMs: number, toMs: number, pred: (wd: number, m: number, d: number) => boolean): number {
  if (toMs <= fromMs) return 0;
  const a = parisParts(fromMs);
  const b = parisParts(toMs);
  // Itération sur des dates civiles (UTC midi, insensible à l'heure d'été).
  let cur = Date.UTC(a.y, a.m - 1, a.d + 1, 12);
  const end = Date.UTC(b.y, b.m - 1, b.d, 12);
  let n = 0;
  while (cur < end) {
    const dt = new Date(cur);
    if (pred(dt.getUTCDay(), dt.getUTCMonth() + 1, dt.getUTCDate())) n++;
    cur += 86_400_000;
  }
  return n;
}
