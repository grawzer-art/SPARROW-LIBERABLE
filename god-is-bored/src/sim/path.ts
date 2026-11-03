import { World, T } from "./World";

const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];

function tileCost(w: World, i: number): number {
  switch (w.type[i]) {
    case T.RIVER: return 2.2;
    case T.HILL: return 1.5;
    case T.SAND: return 1.1;
    default: return 1;
  }
}

/** A* sur la grille. Retourne des waypoints [x0,y0,x1,y1,...] en coordonnées tuile (centres), ou null. */
export function findPath(w: World, sx: number, sy: number, tx: number, ty: number): number[] | null {
  const n = w.size;
  let six = Math.floor(sx), siy = Math.floor(sy), tix = Math.floor(tx), tiy = Math.floor(ty);
  if (!w.inb(six, siy) || !w.inb(tix, tiy)) return null;
  // si la cible est impassable, on cherche la tuile passable la plus proche
  if (!w.passable(tix + 0.5, tiy + 0.5)) {
    let found = false;
    for (let r = 1; r < 5 && !found; r++)
      for (let dy = -r; dy <= r && !found; dy++)
        for (let dx = -r; dx <= r; dx++)
          if (w.inb(tix + dx, tiy + dy) && w.passable(tix + dx + 0.5, tiy + dy + 0.5)) { tix += dx; tiy += dy; found = true; break; }
    if (!found) return null;
  }
  const start = siy * n + six, goal = tiy * n + tix;
  if (start === goal) return [tix + 0.5, tiy + 0.5];
  const g = new Float32Array(n * n).fill(Infinity);
  const from = new Int32Array(n * n).fill(-1);
  const closed = new Uint8Array(n * n);
  // tas binaire
  const heap: number[] = [], hf: number[] = [];
  const push = (i: number, f: number) => {
    heap.push(i); hf.push(f);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (hf[p] <= hf[c]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]]; [hf[p], hf[c]] = [hf[c], hf[p]]; c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0];
    const li = heap.pop()!, lf = hf.pop()!;
    if (heap.length) {
      heap[0] = li; hf[0] = lf;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1, r = l + 1;
        let m = c;
        if (l < heap.length && hf[l] < hf[m]) m = l;
        if (r < heap.length && hf[r] < hf[m]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]]; [hf[m], hf[c]] = [hf[c], hf[m]]; c = m;
      }
    }
    return top;
  };
  g[start] = 0;
  push(start, 0);
  let guard = 0;
  while (heap.length && guard++ < 20000) {
    const cur = pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (cur === goal) break;
    const cx = cur % n, cy = (cur / n) | 0;
    for (const [dx, dy, c] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (!w.inb(nx, ny)) continue;
      if (!w.passable(nx + 0.5, ny + 0.5)) continue;
      if (dx !== 0 && dy !== 0 && (!w.passable(cx + dx + 0.5, cy + 0.5) || !w.passable(cx + 0.5, cy + dy + 0.5))) continue;
      const j = ny * n + nx;
      if (closed[j]) continue;
      const ng = g[cur] + c * tileCost(w, j);
      if (ng < g[j]) {
        g[j] = ng; from[j] = cur;
        push(j, ng + Math.hypot(tix - nx, tiy - ny));
      }
    }
  }
  if (from[goal] < 0) return null;
  const rev: number[] = [];
  let c = goal;
  while (c !== start && c >= 0) { rev.push(c); c = from[c]; }
  rev.reverse();
  // allègement : un waypoint sur deux (le dernier est conservé)
  const out: number[] = [];
  rev.forEach((t, k) => {
    if (k % 2 === 1 || k === rev.length - 1) out.push((t % n) + 0.5, ((t / n) | 0) + 0.5);
  });
  return out;
}

export interface Mover {
  x: number; y: number; stuck: number; path?: number[] | null; pathI?: number;
}

/** Retourne 0 = en route, 1 = arrivé, 2 = inaccessible. */
export function moveToward(w: World, m: Mover, tx: number, ty: number, speed: number, arriveDist = 0.18): 0 | 1 | 2 {
  const dEnd = Math.hypot(tx - m.x, ty - m.y);
  if (dEnd < arriveDist) { m.path = null; return 1; }
  let gx = tx, gy = ty;
  if (m.path && m.path.length) {
    const i = m.pathI ?? 0;
    if (i >= m.path.length / 2) { m.path = null; }
    else {
      gx = m.path[i * 2]; gy = m.path[i * 2 + 1];
      if (Math.hypot(gx - m.x, gy - m.y) < 0.3) { m.pathI = i + 1; if (m.pathI >= m.path.length / 2) m.path = null; }
    }
  }
  const dx = gx - m.x, dy = gy - m.y, d = Math.hypot(dx, dy) || 1;
  const step = Math.min(d, speed * w.speedMult(m.x, m.y));
  const base = Math.atan2(dy, dx);
  const tries = [0, 0.5, -0.5, 1.0, -1.0, 1.6, -1.6];
  let moved = false;
  for (const a of tries) {
    const ang = base + a;
    const nx = m.x + Math.cos(ang) * step, ny = m.y + Math.sin(ang) * step;
    if (w.passable(nx, ny)) {
      if (a === 0) m.stuck = Math.max(0, m.stuck - 1); else m.stuck++;
      m.x = nx; m.y = ny; moved = true;
      break;
    }
  }
  if (!moved) m.stuck += 2;
  if (m.stuck > 30 && !m.path) {
    const p = findPath(w, m.x, m.y, tx, ty);
    m.stuck = 0;
    if (p) { m.path = p; m.pathI = 0; } else return 2;
  } else if (m.stuck > 120) { m.stuck = 0; return 2; }
  return 0;
}
