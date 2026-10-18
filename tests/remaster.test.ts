import { describe, expect, it } from "vitest";
import { MAPS } from "@/lib/rpg/maps";
import { solidAt } from "@/lib/rpg/mapdef";
import { emptyRpg } from "@/lib/rpg/state";

/**
 * Remaster graphique : le décor change, jamais les collisions.
 * Empreinte de la grille des cases bloquées de chaque carte (début et fin du chapitre 1),
 * relevée avant le remaster. Si un décor ajouté bloquait une case, l'empreinte changerait.
 */
const GRIDS: Record<string, string> = {"quartier":"6ea26d2c","cite":"25a059b8","maison-chou":"eadbfbfe","herboristerie":"9f0575c6","armurerie":"9f0575c6","restaurant":"d9597b38","egouts":"555559e","palais":"9f90dbbe","sentier":"cb6b037a","refuge":"82e5eec0","temple-cour":"9a80ecc6","temple":"8a7ca290","cerisiers":"96c60cf6","village":"eac29616","auberge":"b196103e","dojo":"41c279bc","tour-parvis":"edff9d40","tour":"75440c4a","tour-sommet":"2c1bd982","bar":"33083888","cave":"b9be03c2","local":"8e5032bc"};

function grid(id: string) {
  const m = MAPS[id as keyof typeof MAPS]!;
  let s = "";
  for (const r of [emptyRpg(), { ...emptyRpg(), flags: ["portail"], quests: { "ville-figee": "terminee" as const } }])
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) s += solidAt(m, { x, y }, r) ? "1" : "0";
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h.toString(16);
}

describe("Remaster graphique — collisions inchangées", () => {
  it("la grille des cases bloquées de chaque carte est identique à celle d'avant le remaster", () => {
    expect(Object.keys(GRIDS).sort()).toEqual(Object.keys(MAPS).sort());
    for (const id of Object.keys(GRIDS)) expect(grid(id), id).toBe(GRIDS[id]);
  });
});
