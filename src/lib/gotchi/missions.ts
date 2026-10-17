/**
 * Missions quotidiennes : 3 par jour (heure de Paris), tirées de façon déterministe.
 * Aucune obligation : les missions non faites disparaissent simplement le lendemain.
 */

import { log, parisDay, seeded, type State } from "./core";

export type MissionKey =
  | "frites"
  | "saladeOk"
  | "farm"
  | "farmScore"
  | "talk"
  | "douche"
  | "sieste"
  | "cache"
  | "dofusAuto"
  | "monstres"
  | "ressources"
  | "muscu"
  | "reps";

export interface MissionDef {
  id: string;
  txt: string;
  key: MissionKey;
  n: number;
  /** « max » : la progression garde la meilleure valeur (ex. score), sinon elle s'additionne. */
  max?: boolean;
  coins: number;
  xp: number;
}

export const MISSIONS: MissionDef[] = [
  { id: "m-frites2", txt: "Donner 2 portions de frites", key: "frites", n: 2, coins: 25, xp: 20 },
  { id: "m-frites4", txt: "Nourrir le monstre : 4 portions de frites", key: "frites", n: 4, coins: 45, xp: 35 },
  { id: "m-salade", txt: "Convaincre Sparrow de manger une salade", key: "saladeOk", n: 1, coins: 50, xp: 40 },
  { id: "m-farm1", txt: "Réussir une session de farm", key: "farm", n: 1, coins: 35, xp: 30 },
  { id: "m-farm2", txt: "Enchaîner 2 sessions de farm", key: "farm", n: 2, coins: 60, xp: 45 },
  { id: "m-score", txt: "Faire 400 points en une session", key: "farmScore", n: 400, max: true, coins: 60, xp: 50 },
  { id: "m-monstres", txt: "Vaincre 8 monstres", key: "monstres", n: 8, coins: 45, xp: 35 },
  { id: "m-ressources", txt: "Récolter 15 ressources", key: "ressources", n: 15, coins: 40, xp: 30 },
  { id: "m-talk", txt: "Discuter 3 fois avec Sparrow", key: "talk", n: 3, coins: 20, xp: 15 },
  { id: "m-douche", txt: "Lui faire prendre une douche (bon courage)", key: "douche", n: 1, coins: 25, xp: 20 },
  { id: "m-sieste", txt: "Obtenir une vraie micro-sieste", key: "sieste", n: 1, coins: 40, xp: 30 },
  { id: "m-cache", txt: "Trouver l'objet caché dans l'appartement", key: "cache", n: 1, coins: 50, xp: 40 },
  { id: "m-auto", txt: "Le laisser farmer seul une fois", key: "dofusAuto", n: 1, coins: 20, xp: 15 },
  { id: "m-muscu", txt: "Faire une séance de muscu", key: "muscu", n: 1, coins: 35, xp: 30 },
  { id: "m-reps", txt: "Enchaîner 25 répétitions", key: "reps", n: 25, coins: 45, xp: 35 },
];

export const missionDef = (id: string) => MISSIONS.find((m) => m.id === id);

/** Garantit que les missions du jour existent (renouvellement à minuit, heure de Paris). */
export function ensureMissions(s: State, now: number): State {
  const day = parisDay(now);
  if (s.missions.day === day && s.missions.list.length === 3) return s;
  const r = seeded(`missions:${day}`);
  const pool = [...MISSIONS];
  const list = [];
  const keys = new Set<string>();
  while (list.length < 3 && pool.length) {
    const i = Math.floor(r() * pool.length);
    const m = pool.splice(i, 1)[0];
    if (keys.has(m.key)) continue; // pas deux missions du même type le même jour
    keys.add(m.key);
    list.push({ id: m.id, progress: 0, claimed: false });
  }
  return { ...s, missions: { day, list } };
}

export function track(s: State, key: MissionKey, amount: number, now: number): State {
  const st = ensureMissions(s, now);
  let changed = false;
  const list = st.missions.list.map((m) => {
    const d = missionDef(m.id);
    if (!d || d.key !== key || m.claimed) return m;
    const progress = Math.min(d.n, d.max ? Math.max(m.progress, amount) : m.progress + amount);
    if (progress !== m.progress) changed = true;
    return { ...m, progress };
  });
  return changed ? { ...st, missions: { ...st.missions, list } } : st;
}

export const claimable = (s: State) =>
  s.missions.list.filter((m) => !m.claimed && (missionDef(m.id)?.n ?? Infinity) <= m.progress).length;

/** Encaisse une mission terminée. Renvoie null si impossible. */
export function claimMission(s: State, id: string, now: number): { state: State; coins: number; xp: number } | null {
  const m = s.missions.list.find((x) => x.id === id);
  const d = missionDef(id);
  if (!m || !d || m.claimed || m.progress < d.n) return null;
  const st: State = {
    ...s,
    missions: { ...s.missions, list: s.missions.list.map((x) => (x.id === id ? { ...x, claimed: true } : x)) },
  };
  return { state: log(st, `Mission accomplie : ${d.txt}`, "mission", now), coins: d.coins, xp: d.xp };
}
