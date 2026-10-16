/**
 * CAPS SYMBOLIQUES — annoncés une seule fois par appareil, au moment du passage
 * (ou à la visite suivante si elle a lieu dans la fenêtre `window`).
 * `at` = millisecondes restantes au moment du cap.
 */
const DAY = 86_400_000;

export interface Milestone {
  id: string;
  at: number;
  /** Fenêtre après le cap pendant laquelle l'annonce peut encore s'afficher. */
  window: number;
  code: string;
  title: string;
  text: string;
}

export const MILESTONES: Milestone[] = [
  { id: "d1500", at: 1500 * DAY, window: 7 * DAY, code: "CAP-1500", title: "1 500 JOURS", text: "Le sujet franchit la barre des 1 500 jours. Personne n'a applaudi. Par respect." },
  { id: "d1000", at: 1000 * DAY, window: 7 * DAY, code: "CAP-1000", title: "1 000 JOURS", text: "Quatre chiffres, plus pour longtemps. Le Ministère autorise un sourire discret." },
  { id: "d500", at: 500 * DAY, window: 7 * DAY, code: "CAP-0500", title: "500 JOURS", text: "Mi-chemin dépassé depuis un moment. Le compteur commence à transpirer." },
  { id: "d100", at: 100 * DAY, window: 5 * DAY, code: "CAP-0100", title: "100 JOURS", text: "Trois chiffres. Le sujet a été vu en train de choisir une tenue de sortie." },
  { id: "d30", at: 30 * DAY, window: 3 * DAY, code: "CAP-0030", title: "30 JOURS", text: "Un mois. Un seul. Le calendrier tremble légèrement." },
  { id: "d7", at: 7 * DAY, window: 2 * DAY, code: "CAP-0007", title: "7 JOURS", text: "Une semaine. Préparez les confettis. Ne les lancez pas encore." },
  { id: "h24", at: 1 * DAY, window: 12 * 3_600_000, code: "CAP-24H", title: "DERNIÈRES 24 HEURES", text: "État d'alerte maximal. Le sujet ne tient plus en place. Nous non plus." },
];

/** Cap à annoncer maintenant, ou null. */
export function dueMilestone(remainingMs: number, seen: string[]): Milestone | null {
  const due = MILESTONES.filter(
    (m) => remainingMs > 0 && remainingMs <= m.at && m.at - remainingMs <= m.window && !seen.includes(m.id),
  );
  return due.length ? due[due.length - 1] : null;
}

/** Caps déjà franchis (pour ne pas les annoncer à retardement). */
export function passedMilestones(remainingMs: number): string[] {
  return MILESTONES.filter((m) => remainingMs <= m.at).map((m) => m.id);
}
