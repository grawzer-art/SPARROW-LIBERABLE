/// <reference lib="webworker" />
import { Geo } from "../sim/Geo";
import { Planet } from "../sim/Planet";
import { buildChunkData } from "../sim/terrainChunk";

// Génération des tuiles de terrain hors du thread principal (la géographie est pure et déterministe).
let geo: Geo | null = null;
self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "init") { geo = new Geo(new Planet(m.seed, [], m.gen, 2)); return; }
  if (m.type === "chunk" && geo) {
    const d = buildChunkData(geo, m.face, m.level, m.i, m.j);
    (self as unknown as Worker).postMessage({ type: "chunk", key: m.key, h: d.h, riv: d.riv, col: d.col, tree: d.tree }, [d.h.buffer, d.riv.buffer, d.col.buffer, d.tree.buffer]);
  }
};
