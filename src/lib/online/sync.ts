/**
 * SPARROW ONLINE — synchronisation des déplacements (logique pure, testable).
 *
 * - On n'envoie PAS la position à chaque image : seulement quand le joueur change de case ou de
 *   direction (au plus ~16 fois par seconde), plus un battement toutes les 15 s à l'arrêt.
 * - Chez les autres, chaque joueur glisse d'une case à l'autre (interpolation) ; s'il a pris
 *   du retard (réseau lent) il accélère, et s'il est trop loin il est replacé directement.
 */

import type { Facing, Tile } from "@/lib/rpg/mapdef";

export const ROOM = "quartier-404";
/** Joueurs par instance du quartier (au-delà, une nouvelle instance s'ouvre). */
export const MAX_PER_INSTANCE = 20;
export const HEARTBEAT_MS = 15000;
export const MIN_SEND_MS = 60;
const TILE = 16;
const STEP_S = 0.2;

export interface Pos extends Tile {
  dir: Facing;
}

const DIRS: Facing[] = ["down", "up", "left", "right"];
export const dirCode = (d: Facing) => DIRS.indexOf(d);
export const dirOf = (n: unknown): Facing => DIRS[typeof n === "number" ? n : 0] ?? "down";

/** Message de déplacement (court : il passe souvent). */
export interface Move {
  x: number;
  y: number;
  d: number;
  /** Numéro de séquence : on ignore les messages arrivés dans le désordre. */
  s: number;
}

export function isMove(p: unknown): p is Move {
  const m = p as Move;
  return !!m && [m.x, m.y, m.d, m.s].every((v) => Number.isInteger(v)) && m.x >= 0 && m.y >= 0 && m.x < 200 && m.y < 200 && m.d >= 0 && m.d < 4;
}

/** Décide quand envoyer sa position. */
export class SendPolicy {
  private last: Pos | null = null;
  private lastAt = -Infinity;
  private seq = 0;
  /** Renvoie le message à envoyer maintenant, ou null. */
  next(p: Pos, now: number): Move | null {
    const changed = !this.last || this.last.x !== p.x || this.last.y !== p.y || this.last.dir !== p.dir;
    const due = changed ? now - this.lastAt >= MIN_SEND_MS : now - this.lastAt >= HEARTBEAT_MS;
    if (!due) return null;
    this.last = { ...p };
    this.lastAt = now;
    return { x: p.x, y: p.y, d: dirCode(p.dir), s: ++this.seq };
  }
  /** Après une reconnexion : renvoyer tout de suite. */
  reset() {
    this.last = null;
    this.lastAt = -Infinity;
  }
}

/** Position affichée d'un autre joueur, qui rattrape la dernière position reçue. */
export class Track {
  tile: Tile;
  px: number;
  py: number;
  dir: Facing;
  walking = false;
  seen: number;
  private seq = -1;
  constructor(p: Pos, now: number) {
    this.tile = { x: p.x, y: p.y };
    this.px = p.x * TILE;
    this.py = p.y * TILE;
    this.dir = p.dir;
    this.seen = now;
  }
  /** Nouvelle position reçue (ignorée si plus ancienne que la dernière). */
  push(m: Move, now: number) {
    this.seen = now;
    if (m.s <= this.seq) return;
    this.seq = m.s;
    this.tile = { x: m.x, y: m.y };
    this.dir = dirOf(m.d);
    const far = Math.abs(this.px / TILE - m.x) + Math.abs(this.py / TILE - m.y);
    if (far > 8) {
      // Trop loin (reconnexion, onglet en pause) : on le replace
      this.px = m.x * TILE;
      this.py = m.y * TILE;
    }
  }
  /** Avance vers la case cible ; plus vite s'il a du retard. */
  step(dt: number) {
    const tx = this.tile.x * TILE;
    const ty = this.tile.y * TILE;
    const dx = tx - this.px;
    const dy = ty - this.py;
    const dist = Math.abs(dx) + Math.abs(dy);
    if (dist < 0.01) {
      this.px = tx;
      this.py = ty;
      this.walking = false;
      return;
    }
    const lag = dist / TILE;
    const speed = (TILE / STEP_S) * (lag > 2 ? 2.5 : lag > 1.2 ? 1.5 : 1);
    const k = Math.min(1, (speed * dt) / dist);
    // Comme une marche case par case : d'abord l'axe le plus long
    if (Math.abs(dx) >= Math.abs(dy)) this.px += Math.sign(dx) * Math.min(Math.abs(dx), speed * dt);
    else this.py += Math.sign(dy) * Math.min(Math.abs(dy), speed * dt);
    if (k >= 1) {
      this.px = Math.abs(tx - this.px) < 0.5 ? tx : this.px;
      this.py = Math.abs(ty - this.py) < 0.5 ? ty : this.py;
    }
    this.walking = true;
  }
}

/** Première instance où il reste de la place. */
export const pickInstance = (counts: number[]) => {
  const i = counts.findIndex((n) => n < MAX_PER_INSTANCE);
  return i < 0 ? counts.length : i;
};

// ─── Chat ───

export const MAX_MESSAGE = 200;

/** Même nettoyage que le serveur : caractères de contrôle retirés, espaces regroupés. */
export const cleanMessage = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Anti-spam côté client (le serveur applique les mêmes règles et a le dernier mot). */
export class ChatLimiter {
  private sent: { at: number; body: string }[] = [];
  check(body: string, now: number): string | null {
    const b = cleanMessage(body);
    if (!b) return "Message vide.";
    if (b.length > MAX_MESSAGE) return `200 caractères maximum.`;
    this.sent = this.sent.filter((m) => now - m.at < 30_000);
    const last = this.sent[this.sent.length - 1];
    if (last && now - last.at < 1500) return "Doucement : un message toutes les 1,5 s.";
    if (this.sent.length >= 8) return "Trop de messages : attends quelques secondes.";
    if (this.sent.some((m) => m.body === b && now - m.at < 15_000)) return "Message déjà envoyé.";
    return null;
  }
  record(body: string, now: number) {
    this.sent.push({ at: now, body: cleanMessage(body) });
  }
}
