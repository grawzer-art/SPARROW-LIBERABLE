/**
 * Stockage de la capsule.
 *
 * Toute l'interface passe par `CapsuleStore`. Aujourd'hui : `LocalCapsuleStore`
 * (localStorage du navigateur, rien ne quitte le téléphone).
 * Demain : un `CollectiveCapsuleStore` pourra implémenter la même interface
 * pour une capsule collective privée (voir docs/CAPSULE.md), sans toucher à l'UI.
 */

import { emptyCapsule, normalize, type CapsuleData } from "./model";

export interface CapsuleStore {
  /** Libellé affiché à l'utilisateur (« ce téléphone », « capsule des potes »…). */
  readonly label: string;
  /** Les données quittent-elles l'appareil ? */
  readonly remote: boolean;
  load(): Promise<CapsuleData>;
  save(data: CapsuleData): Promise<void>;
}

const KEY = "sp.capsule.v1";

export class LocalCapsuleStore implements CapsuleStore {
  readonly label = "ce téléphone";
  readonly remote = false;

  async load(): Promise<CapsuleData> {
    try {
      const raw = window.localStorage.getItem(KEY);
      return raw ? normalize(JSON.parse(raw)) : emptyCapsule();
    } catch {
      return emptyCapsule();
    }
  }

  async save(data: CapsuleData): Promise<void> {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      throw new Error("Stockage plein ou bloqué (navigation privée ?). Exportez une sauvegarde.");
    }
  }
}

/** Demande au navigateur de ne pas effacer automatiquement nos données (si possible). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
