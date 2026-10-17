/**
 * Mini-jeu « Séance de muscu » (banc de la salle de sport). Logique pure.
 *
 * Un curseur va et vient sur la jauge de force. On appuie (A ou toucher) quand il est
 * dans la zone verte : une répétition. Au centre exact : PARFAIT, et le combo monte.
 * Plus le combo grimpe, plus la zone rétrécit et le curseur accélère.
 * 3 ratés = crampe, la séance s'arrête (on garde ce qui a été soulevé).
 */

export const MUSCU_DUR = 25_000;
export const MAX_FAILS = 3;

export interface Muscu {
  t: number;
  /** Position du curseur 0..1 et sens. */
  cur: number;
  dir: 1 | -1;
  /** Centre et demi-largeur de la zone. */
  zone: number;
  half: number;
  reps: number;
  perfects: number;
  combo: number;
  bestCombo: number;
  fails: number;
  /** Animation de la barre (0 = en bas, 1 = soulevée). */
  lift: number;
  last: { kind: "parfait" | "ok" | "rate"; at: number } | null;
  over: boolean;
}

export const newMuscu = (): Muscu => ({
  t: 0,
  cur: 0,
  dir: 1,
  zone: 0.5,
  half: 0.16,
  reps: 0,
  perfects: 0,
  combo: 0,
  bestCombo: 0,
  fails: 0,
  lift: 0,
  last: null,
  over: false,
});

/** Vitesse du curseur (aller simple par seconde), qui augmente avec le combo. */
export const speed = (m: Muscu) => 0.9 + Math.min(1.4, m.combo * 0.08) + (m.t / MUSCU_DUR) * 0.3;

export function stepMuscu(m0: Muscu, dt: number): Muscu {
  if (m0.over) return m0;
  const m = { ...m0, t: m0.t + dt, lift: Math.max(0, m0.lift - dt / 400) };
  let cur = m.cur + m.dir * speed(m) * (dt / 1000);
  let dir = m.dir;
  while (cur > 1 || cur < 0) {
    if (cur > 1) {
      cur = 2 - cur;
      dir = -1;
    } else {
      cur = -cur;
      dir = 1;
    }
  }
  m.cur = cur;
  m.dir = dir;
  if (m.t >= MUSCU_DUR) m.over = true;
  return m;
}

/** Le joueur pousse. `rand` place la zone suivante. */
export function press(m0: Muscu, rand: () => number = Math.random): { m: Muscu; kind: "parfait" | "ok" | "rate" } {
  if (m0.over) return { m: m0, kind: "rate" };
  const d = Math.abs(m0.cur - m0.zone);
  const m = { ...m0 };
  let kind: "parfait" | "ok" | "rate";
  if (d <= m.half * 0.3) kind = "parfait";
  else if (d <= m.half) kind = "ok";
  else kind = "rate";
  if (kind === "rate") {
    m.fails += 1;
    m.combo = 0;
    if (m.fails >= MAX_FAILS) m.over = true;
  } else {
    m.reps += 1;
    m.combo += 1;
    m.bestCombo = Math.max(m.bestCombo, m.combo);
    if (kind === "parfait") m.perfects += 1;
    m.lift = 1;
    // Zone suivante : plus étroite avec le combo, placée ailleurs.
    m.half = Math.max(0.06, 0.16 - m.combo * 0.008);
    m.zone = m.half + rand() * (1 - 2 * m.half);
  }
  m.last = { kind, at: m.t };
  return { m, kind };
}

export const muscuScore = (m: Pick<Muscu, "reps" | "perfects">) => m.reps * 10 + m.perfects * 5;
