/**
 * RPG — mini-jeu « Le Mix de Pokeyz » (chapitre 4), logique pure.
 *
 * Des notes descendent vers une ligne : on appuie sur A quand elles la touchent.
 * Le Métronome impose une boucle parfaite et sans pause ; le mix de Pokeyz la casse avec
 * des silences, des contretemps et un drop. Il faut toucher au moins 70 % des notes.
 */

export const BPM = 112;
export const BEAT = 60_000 / BPM;
/** Fenêtres de jugement (ms). */
export const PARFAIT = 70;
export const BIEN = 150;
export const OBJECTIF_RYTHME = 0.7;

/** Partition : temps (en temps musicaux) de chaque note. Les silences font partie du mix. */
const PATTERN = [
  // Intro calme
  0, 2, 4, 6,
  // Boucle du Métronome (régulière)
  8, 9, 10, 11, 12, 13, 14, 15,
  // Pokeyz casse la boucle : contretemps et silence
  16, 17.5, 19, 20.5, 22, 24,
  // Montée
  26, 26.5, 27, 27.5, 28, 28.5, 29, 29.5,
  // Le drop
  31, 32, 33, 33.5, 34, 35, 36,
];

export const LEAD_IN = 2_000;
export const CHART: number[] = PATTERN.map((b) => LEAD_IN + b * BEAT);
export const DURATION = CHART[CHART.length - 1] + 1_500;

export type Judge = "parfait" | "bien" | "rate";

export interface Rythme {
  t: number;
  /** Index de la prochaine note à jouer. */
  next: number;
  results: Judge[];
  combo: number;
  bestCombo: number;
  last: { judge: Judge; at: number } | null;
  over: boolean;
}

export const newRythme = (): Rythme => ({ t: 0, next: 0, results: [], combo: 0, bestCombo: 0, last: null, over: false });

/** Avance le temps : les notes dépassées sans appui comptent comme ratées. */
export function stepRythme(g: Rythme, dt: number): Rythme {
  if (g.over) return g;
  const t = g.t + dt;
  let { next, combo } = g;
  const results = [...g.results];
  let last = g.last;
  while (next < CHART.length && t - CHART[next] > BIEN) {
    results.push("rate");
    combo = 0;
    last = { judge: "rate", at: t };
    next++;
  }
  return { ...g, t, next, results, combo, last, over: t >= DURATION };
}

/** Appui sur A : on juge la note la plus proche (si elle est assez près). */
export function hit(g: Rythme): { g: Rythme; judge: Judge | null } {
  if (g.over || g.next >= CHART.length) return { g, judge: null };
  const d = Math.abs(g.t - CHART[g.next]);
  if (d > BIEN * 1.6) return { g, judge: null }; // trop tôt : on ignore (pas de pénalité)
  const judge: Judge = d <= PARFAIT ? "parfait" : d <= BIEN ? "bien" : "rate";
  const combo = judge === "rate" ? 0 : g.combo + 1;
  return {
    g: { ...g, next: g.next + 1, results: [...g.results, judge], combo, bestCombo: Math.max(g.bestCombo, combo), last: { judge, at: g.t } },
    judge,
  };
}

export const hitRatio = (r: Judge[]) => r.filter((x) => x !== "rate").length / CHART.length;
export const rythmeOk = (r: Judge[]) => hitRatio(r) >= OBJECTIF_RYTHME;
