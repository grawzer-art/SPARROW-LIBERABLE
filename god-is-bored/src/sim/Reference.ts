import type { SimulationEngine } from "./SimulationEngine";
import { techThreshold } from "./TechTree";

/**
 * Scène de référence (URL `?ref`) : un même monde avec un village primitif (préhistoire), une cité médiévale et une ville
 * futuriste, obtenus par les systèmes réels de la simulation (recherche financée, plafonnée pour figer l'époque voulue).
 */
export function buildReferenceWorld(sim: SimulationEngine, years = 300): { modern: number; medieval: number; primitive: number } {
  const [A, B, C] = sim.civs.slice(0, 3);
  for (const x of sim.civs) for (const y of sim.civs) if (x.id < y.id) sim.truce[sim.pairKey(x.id, y.id)] = 1e9;
  for (let y = 0; y < years; y++) {
    A.techProg += 40; A.gold += 40;
    if (B.era < 2) { B.techProg += 40; B.gold += 40; } else { B.gold = Math.min(B.gold, 139); B.techProg = Math.min(B.techProg, techThreshold(B.tech) * 0.5); }
    C.gold = Math.min(C.gold, 10); C.techProg = Math.min(C.techProg, techThreshold(C.tech) * 0.5);
    sim.runYears(1);
  }
  return { modern: A.id, medieval: B.id, primitive: C.id };
}
