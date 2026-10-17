import { describe, expect, it } from "vitest";
import {
  ROOMS,
  ROOM_IDS,
  SPOTS,
  START,
  cachePlace,
  canStand,
  doorCrossed,
  doorExit,
  move,
  nearbySpot,
  pathInRoom,
  restorePlace,
  roomRoute,
  spotAt,
  type Door,
  type Pos,
  type RoomId,
} from "@/lib/gotchi/map";

/** Suit un chemin et vérifie chaque pixel. */
function walk(room: RoomId, from: Pos, pts: Pos[]) {
  let cur = from;
  for (const wp of pts) {
    const n = Math.ceil(Math.hypot(wp.x - cur.x, wp.y - cur.y));
    for (let i = 1; i <= n; i++) {
      const x = cur.x + ((wp.x - cur.x) * i) / n;
      const y = cur.y + ((wp.y - cur.y) * i) / n;
      expect(canStand(room, x, y), `${room} (${x.toFixed(1)}, ${y.toFixed(1)})`).toBe(true);
    }
    cur = wp;
  }
  return cur;
}

describe("Carte de l'appartement", () => {
  it("départ, points d'utilisation, places assises et entrées de porte valides", () => {
    expect(canStand(START.room, START.x, START.y)).toBe(true);
    for (const s of SPOTS) expect(canStand(s.room, s.stand.x, s.stand.y), s.id).toBe(true);
    for (const r of ROOM_IDS)
      for (const d of Object.keys(ROOMS[r].doors) as Door[]) {
        const { approach } = doorExit(d);
        expect(canStand(r, approach.x, approach.y), `${r} ${d}`).toBe(true);
      }
  });
  it("les portes sont réciproques et mènent à un endroit accessible", () => {
    const opp: Record<Door, Door> = { N: "S", S: "N", E: "W", W: "E" };
    for (const r of ROOM_IDS)
      for (const [d, n] of Object.entries(ROOMS[r].doors) as [Door, RoomId][]) {
        expect(ROOMS[n].doors[opp[d]], `${r} ${d}`).toBe(r);
        const { exit } = doorExit(d);
        const to = doorCrossed(r, exit)!;
        expect(to.room).toBe(n);
        expect(canStand(to.room, to.x, to.y), `${r} → ${n}`).toBe(true);
      }
  });
  it("on peut franchir chaque porte en marchant", () => {
    for (const r of ROOM_IDS)
      for (const d of Object.keys(ROOMS[r].doors) as Door[]) {
        const { approach, exit } = doorExit(d);
        walk(r, approach, [exit]);
      }
  });
  it("chaque objet est atteignable depuis chaque entrée de sa pièce", () => {
    for (const s of SPOTS) {
      const starts = (Object.keys(ROOMS[s.room].doors) as Door[]).map((d) => doorExit(d).approach);
      for (const a of starts) {
        const p = pathInRoom(s.room, a, s.stand);
        expect(p, `${s.id} depuis (${a.x},${a.y})`).not.toBeNull();
        expect(walk(s.room, a, p!)).toEqual(s.stand);
      }
    }
  });
  it("toutes les pièces sont reliées", () => {
    for (const a of ROOM_IDS) for (const b of ROOM_IDS) if (a !== b) expect(roomRoute(a, b).length).toBeGreaterThan(0);
    expect(roomRoute("chambre", "muscu").map((h) => h.room)).toEqual(["chambre", "salon", "cuisine"]);
  });
  it("les meubles bloquent ; on ne traverse pas les murs", () => {
    expect(canStand("salon", 80, 96)).toBe(false); // canapé
    expect(canStand("salon", 80, 20)).toBe(false); // mur du fond
    expect(canStand("chambre", 2, 40)).toBe(false); // mur sans porte
    expect(move("salon", { x: 80, y: 110 }, 0, -10).blocked).toBe(true);
  });
  it("objet à portée et objet touché", () => {
    const pc = SPOTS.find((s) => s.id === "pc")!;
    expect(nearbySpot("gaming", pc.stand)?.id).toBe("pc");
    expect(nearbySpot("salon", pc.stand)).toBeNull();
    expect(spotAt("cuisine", 60, 30)?.id).toBe("friteuse");
  });
  it("position sauvegardée et objet caché", () => {
    expect(restorePlace({ x: 175, y: 53 })).toEqual(START); // ancienne position 3.0
    expect(restorePlace({ room: "cuisine", x: 60, y: 70 })).toEqual({ room: "cuisine", x: 60, y: 70 });
    expect(restorePlace({ room: "cuisine", x: 60, y: 10 })).toEqual(START);
    const c = cachePlace(0.42)!;
    expect(canStand(c.room, c.x, c.y)).toBe(true);
    expect(cachePlace(null)).toBeNull();
  });
});
