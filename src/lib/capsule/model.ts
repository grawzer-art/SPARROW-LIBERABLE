/**
 * CAPSULE TEMPORELLE 2031 — modèle de données.
 *
 * Les lettres ne sont JAMAIS écrites dans le code ni envoyées à un serveur :
 * elles vivent dans le stockage du navigateur (voir store.ts) et dans les
 * fichiers de sauvegarde exportés par l'utilisateur.
 *
 * Le format est versionné pour pouvoir évoluer (capsule collective privée,
 * chiffrement, etc. — voir docs/CAPSULE.md).
 */

import { END, START } from "@/config";
import { END_MS, zonedToUtc } from "@/lib/time";

export const CAPSULE_VERSION = 1;
export const BACKUP_KIND = "sparrow-capsule-2031";
export const MAX_LETTERS = 200;
export const MAX_BODY = 5000;
export const MAX_AUTHOR = 40;

export type Tone = "vanne" | "emouvant" | "conseil" | "prediction";

export const TONES: Record<Tone, string> = {
  vanne: "Vanne",
  emouvant: "Émouvant",
  conseil: "Conseil",
  prediction: "Prédiction",
};

/** Où vit la lettre. « local » aujourd'hui ; « collective » prévu pour plus tard. */
export type Origin = "local" | "collective";

export interface Letter {
  id: string;
  author: string;
  body: string;
  tone: Tone;
  /** ISO 8601 — date de scellement. */
  sealedAt: string;
  /** ISO 8601 — ouverture prévue (12/10/2031 00:00 Paris par défaut). */
  openAt: string;
  origin: Origin;
}

export interface Draft {
  author: string;
  body: string;
  tone: Tone;
}

export interface CapsuleData {
  version: typeof CAPSULE_VERSION;
  letters: Letter[];
  draft: Draft;
  /** Nombre de tentatives d'ouverture (statistique réelle, locale). */
  attempts: number;
  /** Dernière exportation de sauvegarde (ISO) ou null. */
  lastExportAt: string | null;
  /** Dernière modification des lettres (ISO) ou null. */
  updatedAt: string | null;
}

export const emptyDraft = (): Draft => ({ author: "", body: "", tone: "vanne" });

export const emptyCapsule = (): CapsuleData => ({
  version: CAPSULE_VERSION,
  letters: [],
  draft: emptyDraft(),
  attempts: 0,
  lastExportAt: null,
  updatedAt: null,
});

export const OPEN_MS = END_MS;

export function isOpen(now: number, letter?: Pick<Letter, "openAt">): boolean {
  const at = letter ? Date.parse(letter.openAt) : OPEN_MS;
  return now >= at;
}

/** Archives annuelles : chaque 12 octobre, de 2027 à 2031, à l'heure officielle. */
export const ARCHIVE_YEARS = [2027, 2028, 2029, 2030, 2031] as const;

export function archiveOpensAt(year: number): number {
  return zonedToUtc(`${year}-${END.date.slice(5)}`, END.time);
}

/** Année de capsule d'une date : 1 = du 12/10/2026 au 11/10/2027, etc. */
export function capsuleYearOf(ms: number): number {
  const start = zonedToUtc(START.date, START.time);
  if (ms < start) return 0;
  for (const [i, y] of ARCHIVE_YEARS.entries()) if (ms < archiveOpensAt(y)) return i + 1;
  return ARCHIVE_YEARS.length;
}

export function newId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `L${Date.now().toString(36)}${rnd}`;
}

const clean = (s: unknown, max: number) =>
  String(s ?? "")
    .replace(/\u0000/g, "")
    .slice(0, max);

export function sealLetter(draft: Draft, now: number): Letter {
  return {
    id: newId(),
    author: clean(draft.author, MAX_AUTHOR).trim() || "Anonyme",
    body: clean(draft.body, MAX_BODY).trim(),
    tone: draft.tone in TONES ? draft.tone : "vanne",
    sealedAt: new Date(now).toISOString(),
    openAt: new Date(OPEN_MS).toISOString(),
    origin: "local",
  };
}

/** Valide une lettre venue d'un fichier importé (données non fiables). */
export function validLetter(x: unknown): Letter | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  const id = typeof o.id === "string" && /^[A-Za-z0-9_-]{4,64}$/.test(o.id) ? o.id : null;
  const sealedAt = typeof o.sealedAt === "string" && !Number.isNaN(Date.parse(o.sealedAt)) ? o.sealedAt : null;
  const openAt = typeof o.openAt === "string" && !Number.isNaN(Date.parse(o.openAt)) ? o.openAt : null;
  const body = clean(o.body, MAX_BODY).trim();
  if (!id || !sealedAt || !openAt || !body) return null;
  const tone = typeof o.tone === "string" && o.tone in TONES ? (o.tone as Tone) : "vanne";
  return {
    id,
    author: clean(o.author, MAX_AUTHOR).trim() || "Anonyme",
    body,
    tone,
    sealedAt,
    // Une sauvegarde ne peut pas avancer la date d'ouverture.
    openAt: Date.parse(openAt) < OPEN_MS ? new Date(OPEN_MS).toISOString() : openAt,
    origin: "local",
  };
}

export interface Backup {
  kind: typeof BACKUP_KIND;
  version: number;
  exportedAt: string;
  letters: Letter[];
}

export function makeBackup(letters: Letter[], now: number): Backup {
  return { kind: BACKUP_KIND, version: CAPSULE_VERSION, exportedAt: new Date(now).toISOString(), letters };
}

/** Lit un fichier de sauvegarde. Renvoie les lettres valides, ou une erreur lisible. */
export function parseBackup(text: string): { letters: Letter[] } | { error: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "Fichier illisible : ce n'est pas une sauvegarde de la capsule." };
  }
  const o = data as Partial<Backup>;
  if (!o || o.kind !== BACKUP_KIND || !Array.isArray(o.letters)) {
    return { error: "Ce fichier n'est pas une sauvegarde SPARROW · CAPSULE 2031." };
  }
  if (typeof o.version === "number" && o.version > CAPSULE_VERSION) {
    return { error: "Sauvegarde créée par une version plus récente de l'application." };
  }
  const letters = o.letters.map(validLetter).filter((l): l is Letter => l !== null);
  return { letters };
}

/** Fusionne sans doublons (par identifiant), triées par date de scellement. */
export function mergeLetters(current: Letter[], incoming: Letter[]): { letters: Letter[]; added: number } {
  const ids = new Set(current.map((l) => l.id));
  const fresh = incoming.filter((l) => !ids.has(l.id));
  const letters = [...current, ...fresh]
    .sort((a, b) => a.sealedAt.localeCompare(b.sealedAt))
    .slice(0, MAX_LETTERS);
  return { letters, added: Math.min(fresh.length, MAX_LETTERS - current.length) };
}

/** Normalise des données lues depuis le stockage (anciennes versions, champs manquants). */
export function normalize(raw: unknown): CapsuleData {
  const base = emptyCapsule();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Partial<CapsuleData>;
  const letters = Array.isArray(o.letters) ? o.letters.map(validLetter).filter((l): l is Letter => !!l) : [];
  const d = (o.draft ?? {}) as Partial<Draft>;
  return {
    version: CAPSULE_VERSION,
    letters,
    draft: {
      author: clean(d.author, MAX_AUTHOR),
      body: clean(d.body, MAX_BODY),
      tone: d.tone && d.tone in TONES ? d.tone : "vanne",
    },
    attempts: Number.isFinite(o.attempts) ? Math.max(0, Math.floor(o.attempts as number)) : 0,
    lastExportAt: typeof o.lastExportAt === "string" ? o.lastExportAt : null,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

/** Des lettres ont été modifiées depuis la dernière sauvegarde exportée. */
export function needsBackup(data: CapsuleData): boolean {
  if (data.letters.length === 0) return false;
  if (!data.lastExportAt) return true;
  return !!data.updatedAt && data.updatedAt > data.lastExportAt;
}
