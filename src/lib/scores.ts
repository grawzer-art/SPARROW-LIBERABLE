/** Règles partagées (client + serveur) du tableau des scores. */
export interface ScoreEntry {
  name: string;
  days: number;
  frites: number;
  skin: string;
  at: string;
}

export const NAME_MAX = 14;

/** Nettoie un pseudo : lettres (accents compris), chiffres, espace, - _ ' . — en majuscules. */
export function cleanName(raw: string): string {
  return raw
    .normalize("NFC")
    .replace(/[^\p{L}\p{N} _'.-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NAME_MAX)
    .toUpperCase();
}

/** Contrôle de vraisemblance : vitesse max ≈ 9 jours/s + 5 jours par portion de frites. */
export function plausible(days: number, frites: number, seconds: number): boolean {
  if (!Number.isInteger(days) || days < 0 || days > 1826) return false;
  if (!Number.isInteger(frites) || frites < 0 || frites > 600) return false;
  if (!(seconds > 0) || seconds > 4 * 3600) return false;
  return days <= seconds * 9.5 + frites * 5 + 5;
}

export const sortScores = (a: ScoreEntry, b: ScoreEntry) => b.days - a.days || b.frites - a.frites || a.at.localeCompare(b.at);
