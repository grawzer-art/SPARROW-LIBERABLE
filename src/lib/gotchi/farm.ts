/**
 * Mini-jeu « Session de farm » (ouvert depuis le PC de Sparrow). Logique pure.
 *
 * 30 secondes : on tape les ressources qui poussent (épi, minerai, bois) et on tape
 * trois fois les petits monstres avant qu'ils n'attaquent (−1 PV). Les coups enchaînés
 * font monter le combo (×5 max). Très rarement, un Œuf Dofrite apparaît : il faut être rapide.
 * Univers 100 % inventé : aucun personnage, graphisme ou son d'un jeu existant.
 */

export const FARM_W = 120;
export const FARM_H = 120;
export const FARM_DUR = 30_000;
export const FARM_PV = 3;

export type Kind = "epi" | "minerai" | "bois" | "bouboule" | "croquinou" | "larvouille" | "oeuf";

export interface Ent {
  id: number;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  age: number;
  ttl: number;
  /** Temps depuis le dernier coup reçu (clignotement). */
  hit: number;
}

export interface Float {
  x: number;
  y: number;
  txt: string;
  age: number;
}

export interface Farm {
  t: number;
  score: number;
  combo: number;
  comboT: number;
  pv: number;
  ents: Ent[];
  floats: Float[];
  nextId: number;
  spawnIn: number;
  monsters: number;
  resources: number;
  egg: boolean;
  hurt: number;
  over: boolean;
}

export const RESOURCES: Kind[] = ["epi", "minerai", "bois"];
export const MONSTERS: Kind[] = ["bouboule", "croquinou", "larvouille"];
export const isMonster = (k: Kind) => MONSTERS.includes(k);

export const NAMES: Record<Kind, string> = {
  epi: "Épi doré",
  minerai: "Minerai",
  bois: "Bûche",
  bouboule: "Bouboule",
  croquinou: "Croquinou",
  larvouille: "Larvouille",
  oeuf: "Œuf Dofrite",
};

const STATS: Record<Kind, { hp: number; ttl: number; pts: number; speed: number; r: number }> = {
  epi: { hp: 1, ttl: 3200, pts: 10, speed: 0, r: 7 },
  minerai: { hp: 1, ttl: 3000, pts: 12, speed: 0, r: 7 },
  bois: { hp: 1, ttl: 3400, pts: 10, speed: 0, r: 7 },
  bouboule: { hp: 3, ttl: 4600, pts: 30, speed: 10, r: 9 },
  croquinou: { hp: 4, ttl: 5200, pts: 40, speed: 6, r: 9 },
  larvouille: { hp: 2, ttl: 3600, pts: 30, speed: 20, r: 8 },
  oeuf: { hp: 1, ttl: 2000, pts: 200, speed: 0, r: 8 },
};

export const newFarm = (): Farm => ({
  t: 0,
  score: 0,
  combo: 1,
  comboT: 0,
  pv: FARM_PV,
  ents: [],
  floats: [],
  nextId: 1,
  spawnIn: 400,
  monsters: 0,
  resources: 0,
  egg: false,
  hurt: 0,
  over: false,
});

function spawn(f: Farm, rand: () => number): Ent {
  const r = rand();
  const progress = f.t / FARM_DUR;
  let kind: Kind;
  if (r < 0.006) kind = "oeuf";
  else if (r < 0.4 + progress * 0.15) kind = MONSTERS[Math.floor(rand() * MONSTERS.length)];
  else kind = RESOURCES[Math.floor(rand() * RESOURCES.length)];
  const st = STATS[kind];
  const a = rand() * Math.PI * 2;
  return {
    id: f.nextId,
    kind,
    x: 14 + rand() * (FARM_W - 28),
    y: 16 + rand() * (FARM_H - 30),
    vx: Math.cos(a) * st.speed,
    vy: Math.sin(a) * st.speed,
    hp: st.hp,
    maxHp: st.hp,
    age: 0,
    ttl: st.ttl,
    hit: 99,
  };
}

/** Fait avancer le jeu de dt millisecondes. */
export function step(f0: Farm, dt: number, rand: () => number = Math.random): Farm {
  if (f0.over) return f0;
  const f: Farm = { ...f0, t: f0.t + dt, hurt: Math.max(0, f0.hurt - dt) };
  f.comboT = Math.max(0, f.comboT - dt);
  if (f.comboT === 0) f.combo = 1;
  const ents: Ent[] = [];
  for (const e0 of f0.ents) {
    const e = { ...e0, age: e0.age + dt, hit: e0.hit + dt };
    e.x += (e.vx * dt) / 1000;
    e.y += (e.vy * dt) / 1000;
    if (e.x < 10 || e.x > FARM_W - 10) e.vx *= -1;
    if (e.y < 12 || e.y > FARM_H - 10) e.vy *= -1;
    e.x = Math.max(10, Math.min(FARM_W - 10, e.x));
    e.y = Math.max(12, Math.min(FARM_H - 10, e.y));
    if (e.age >= e.ttl) {
      // Un monstre qu'on a laissé vivre attaque.
      if (isMonster(e.kind)) {
        f.pv -= 1;
        f.hurt = 500;
        f.combo = 1;
        f.floats = [...f.floats, { x: e.x, y: e.y, txt: "AÏE", age: 0 }];
      }
      continue;
    }
    ents.push(e);
  }
  f.ents = ents;
  f.spawnIn -= dt;
  const cap = 5 + Math.floor((f.t / FARM_DUR) * 3);
  if (f.spawnIn <= 0 && f.ents.length < cap) {
    f.ents = [...f.ents, spawn(f, rand)];
    f.nextId += 1;
    f.spawnIn = 850 - (f.t / FARM_DUR) * 400;
  }
  f.floats = f.floats.map((x) => ({ ...x, age: x.age + dt })).filter((x) => x.age < 800);
  if (f.t >= FARM_DUR || f.pv <= 0) f.over = true;
  return f;
}

/** Un tap aux coordonnées du jeu. */
export function tap(f0: Farm, x: number, y: number): { farm: Farm; hit: Kind | null; killed: boolean } {
  if (f0.over) return { farm: f0, hit: null, killed: false };
  let best: Ent | null = null;
  let bd = Infinity;
  for (const e of f0.ents) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < STATS[e.kind].r + 6 && d < bd) {
      best = e;
      bd = d;
    }
  }
  if (!best) return { farm: { ...f0, combo: 1, comboT: 0 }, hit: null, killed: false };
  const f: Farm = { ...f0 };
  const e = { ...best, hp: best.hp - 1, hit: 0 };
  const killed = e.hp <= 0;
  if (killed) {
    const pts = STATS[e.kind].pts * f.combo;
    f.score += pts;
    if (isMonster(e.kind)) f.monsters += 1;
    else if (e.kind === "oeuf") f.egg = true;
    else f.resources += 1;
    f.floats = [...f.floats, { x: e.x, y: e.y - 6, txt: e.kind === "oeuf" ? "ŒUF !!" : `+${pts}`, age: 0 }];
    f.ents = f.ents.filter((x) => x.id !== e.id);
    f.combo = Math.min(5, f.combo + 1);
  } else {
    f.ents = f.ents.map((x) => (x.id === e.id ? e : x));
  }
  f.comboT = 1400;
  return { farm: f, hit: e.kind, killed };
}
