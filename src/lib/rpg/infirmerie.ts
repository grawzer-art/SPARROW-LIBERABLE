/**
 * RPG — infirmeries : une par grande région (l'appartement de Sparrow tient ce rôle au Quartier 404).
 * L'infirmière Camomille soigne toute l'équipe (compagnons et créatures) et enregistre le lieu
 * comme point de retour : après une défaite, Sparrow s'y réveille, sans rien perdre.
 */

import type { Facing, MapId, NpcDef, Tile } from "./mapdef";
import type { Rpg } from "./state";
import type { Rule } from "./talk";

const NURSE = "Camomille";

interface Spot {
  map: MapId;
  at: Tile;
  dir: Facing;
  /** Case devant l'infirmière : on y réapparaît, tourné vers elle. */
  back: Tile & { dir: Facing };
  hello: string;
}

export const INFIRMERIES: Spot[] = [
  { map: "herboristerie", at: { x: 7, y: 5 }, dir: "left", back: { x: 6, y: 5, dir: "right" }, hello: "Infirmerie de la Cité ! Madame Persil me prête ce coin. Les tisanes, c'est elle. Les bobos, c'est moi." },
  { map: "refuge", at: { x: 8, y: 4 }, dir: "down", back: { x: 8, y: 5, dir: "up" }, hello: "Infirmerie du Mont. Ici on soigne les claquages, les ampoules et les ego froissés." },
  { map: "auberge", at: { x: 8, y: 4 }, dir: "left", back: { x: 7, y: 4, dir: "right" }, hello: "Infirmerie de Kyukei. Respire. Un thé, un pansement, et ça repart." },
  { map: "tour-parvis", at: { x: 10, y: 14 }, dir: "down", back: { x: 10, y: 15, dir: "up" }, hello: "Même au pied de la Tour, il faut une infirmerie. Surtout au pied de la Tour, en fait." },
];

/** PNJ ajoutés aux cartes (présents dès qu'on y arrive). */
export const nurseOn = (map: MapId): NpcDef[] => INFIRMERIES.filter((s) => s.map === map).map((s) => ({ id: "camomille", name: NURSE, char: "infirmiere", start: s.at, dir: s.dir }));

const hurt = (r: Rpg) => !!r.hp && Object.keys(r.hp).length > 0;

export const INFIRMERIE_NPCS: Record<string, Rule[]> = Object.fromEntries(
  INFIRMERIES.map((s) => [
    `${s.map}:camomille`,
    [
      {
        talk: (r: Rpg) => ({
          lines: [
            { who: NURSE, text: s.hello },
            { who: NURSE, text: hurt(r) ? "Allez, tout le monde sur le banc. … Voilà : PV au maximum, compagnons et créatures." : "Tout le monde est en pleine forme. Je note quand même ton passage." },
            { who: NURSE, text: "Si l'équipe tombe K.O., tu te réveilleras ici. Sans rien perdre, promis." },
          ],
          effects: [{ kind: "heal" }, { kind: "respawn", at: { map: s.map, ...s.back } }],
        }),
      },
    ],
  ]),
);
