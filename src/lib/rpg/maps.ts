/** RPG — registre des cartes de l'aventure et reprise de la position sauvegardée. */

import { restoreOn, type Facing, type MapDef, type MapId, type Tile } from "./mapdef";
import { CH2_MAPS } from "./cite";
import { nurseOn } from "./infirmerie";
import { CH4_MAPS } from "./kyukei";
import { CH3_MAPS } from "./mont";
import { CH5_MAPS } from "./tour";
import { QUARTIER } from "./quartier";
import type { Rpg } from "./state";

export const MAPS: Partial<Record<MapId, MapDef>> = {
  quartier: QUARTIER,
  ...Object.fromEntries([...CH2_MAPS, ...CH3_MAPS, ...CH4_MAPS, ...CH5_MAPS].map((m) => [m.id, m])),
};

// Infirmeries : Camomille attend dans chaque grande région
for (const m of Object.values(MAPS)) if (m) m.npcs.push(...nurseOn(m.id));

export const mapOf = (id: string): MapDef | null => MAPS[id as MapId] ?? null;

export type Where = { map: MapId } & Tile & { dir: Facing };

/** Position sauvegardée dehors (`sp.gotchi.where`), validée contre la carte. */
export function restoreWhere(raw: unknown, r: Rpg): Where | null {
  const o = raw as { map?: unknown } | null;
  if (!o || typeof o.map !== "string") return null;
  const m = mapOf(o.map);
  if (!m) return null;
  const t = restoreOn(m, o, r);
  return t ? { map: m.id, ...t } : null;
}
