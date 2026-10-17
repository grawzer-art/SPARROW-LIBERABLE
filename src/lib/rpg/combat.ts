/**
 * RPG — moteur de combat au tour par tour (logique pure, testable, sans interface).
 *
 * Un combattant actif de chaque côté (Sparrow de dos, l'ennemi de face) ; les autres attendent.
 *  - Dégâts : puissance × attaque / défense × niveau, ±15 %, coups critiques (×1,5).
 *  - Précision, crans de statistiques (−3 à +3), états (étourdi, brûlé), garde.
 *  - Attaques préparées : annoncées un tour, lancées au suivant (on peut s'en protéger).
 *  - Boss à plusieurs phases (seuils de PV), IA qui pèse ses options.
 *  - Objets, changement d'équipier (l'ennemi en profite), fuite.
 * Chaque tour renvoie une liste d'événements que l'écran de combat anime un par un.
 */

import { BATTLES, CONSUMABLES, EQUIPMENT, FOES, FORMS, MEMBERS, MOVES, SKILLS, type BattleDef, type FormId, type Foe, type Move, type Stat, type StatusId } from "./bestiary";

// ─── Hasard reproductible (tests, rejouabilité) ───

export function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Combattants ───

export type Side = "ally" | "foe";

export interface Fighter {
  id: string;
  name: string;
  sprite: string;
  side: Side;
  lv: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  moves: string[];
  stages: Record<Stat, number>;
  status: { id: StatusId; turns: number } | null;
  /** Attaque en préparation (lancée au tour suivant). */
  charging: string | null;
  guard: boolean;
  /** Phase de boss atteinte (index dans `phases`, −1 = aucune). */
  phase: number;
  foe?: string;
  /** Transformation en cours (SPARROW TITAN) et statistiques d'origine. */
  form?: { turns: number; base: { atk: number; def: number; spd: number; maxHp: number; moves: string[]; sprite: string } } | null;
}

export interface Team {
  level: number;
  party: string[];
  gear: Partial<Record<"arme" | "armure" | "accessoire", string>>;
  skills: string[];
  bag: Record<string, number>;
  /** Durée de SPARROW TITAN (3 tours, 4 si le Sparrowgotchi est déjà au stade Titan). */
  titanTurns?: number;
  /** Créatures capturées : elles combattent à leur propre niveau. */
  mons?: Record<string, { level: number }>;
}

const stat = (g: [number, number], lv: number) => Math.round(g[0] + g[1] * (lv - 1));
const noStages = (): Record<Stat, number> => ({ atk: 0, def: 0, spd: 0, acc: 0 });

/** Techniques d'un équipier (les techniques apprises remplacent celles de base, puis celles des niveaux). */
export function movesOf(member: string, skills: string[], lv = 1): string[] {
  const m = MEMBERS[member];
  if (!m) return [];
  let moves = [...m.moves];
  for (const l of m.learn ?? []) if (lv >= l.lv) moves = moves.map((x) => (x === l.replaces ? l.move : x));
  for (const s of skills) {
    const k = SKILLS[s];
    if (k && k.member === member) moves = moves.map((x) => (x === k.replaces ? k.move : x));
  }
  return moves;
}

/** Bonus d'équipement (Sparrow seulement). */
export function gearBonus(gear: Team["gear"]) {
  const b = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const id of Object.values(gear)) {
    const e = id ? EQUIPMENT[id] : undefined;
    if (!e) continue;
    for (const k of ["hp", "atk", "def", "spd"] as const) b[k] += e.bonus[k] ?? 0;
  }
  return b;
}

export function makeAlly(id: string, t: Pick<Team, "level" | "gear" | "skills" | "mons">): Fighter {
  const m = MEMBERS[id];
  const lv = Math.max(1, Math.min(99, Math.floor(t.mons?.[id]?.level ?? t.level)));
  const b = id === "sparrow" ? gearBonus(t.gear) : { hp: 0, atk: 0, def: 0, spd: 0 };
  const evo = m.evo && lv >= m.evo.lv ? m.evo : null;
  const k = evo ? 1.12 : 1;
  const maxHp = Math.round(stat(m.grow.hp, lv) * k) + b.hp;
  return {
    id,
    name: evo?.name ?? m.name,
    sprite: evo?.sprite ?? m.sprite,
    side: "ally",
    lv,
    hp: maxHp,
    maxHp,
    atk: Math.round(stat(m.grow.atk, lv) * k) + b.atk,
    def: Math.round(stat(m.grow.def, lv) * k) + b.def,
    spd: Math.round(stat(m.grow.spd, lv) * k) + b.spd,
    moves: movesOf(id, t.skills, lv),
    stages: noStages(),
    status: null,
    charging: null,
    guard: false,
    phase: -1,
  };
}

/**
 * Niveau d'un ennemi : fixé par sa zone (barème du jeu), il ne suit plus Sparrow.
 * Un ennemi ordinaire a 0 ou +1 niveau de variation ; un boss a toujours son niveau +1.
 * S'entraîner rend donc vraiment plus fort.
 */
export const foeLevel = (f: Foe, roll = 0) => (f.boss ? f.lv[0] + 1 : f.lv[0] + (roll < 0.5 ? 0 : 1));

export function makeFoe(id: string, roll = 0): Fighter {
  const f = FOES[id];
  const lv = foeLevel(f, roll);
  const k = 1 + 0.07 * (lv - f.lv[0]);
  const maxHp = Math.round(f.hp * k);
  return {
    id,
    name: f.name,
    sprite: f.sprite,
    side: "foe",
    lv,
    hp: maxHp,
    maxHp,
    atk: Math.round(f.atk * k),
    def: Math.round(f.def * k),
    spd: Math.round(f.spd * k),
    moves: [...f.moves],
    stages: noStages(),
    status: null,
    charging: null,
    guard: false,
    phase: -1,
    foe: id,
  };
}

// ─── Combat ───

export type Outcome = "win" | "lose" | "flee" | null;

export interface Battle {
  def: BattleDef;
  allies: Fighter[];
  foes: Fighter[];
  /** Index du combattant actif de chaque côté. */
  a: number;
  f: number;
  bag: Record<string, number>;
  turn: number;
  over: Outcome;
  seed: number;
  /** Nombre de fuites ratées (la suivante est plus facile). */
  fleeTries: number;
  /** Objets utilisés (à retirer du sac à la fin). */
  used: Record<string, number>;
  /** SPARROW TITAN : disponible (technique apprise) / déjà utilisé dans ce combat. */
  titan: { can: boolean; used: boolean; turns: number; samourai: boolean };
  /** Objets volés par Lili (une fois par combat). */
  stolen: Record<string, number>;
  /** Créature capturée pendant ce combat (espèce et niveau). */
  captured?: { species: string; level: number };
  /** Équipiers qui sont entrés au combat (eux seuls gagnent de l'expérience). */
  fought: string[];
}

export type Action = { kind: "transform"; form?: FormId } | { kind: "move"; move: string } | { kind: "item"; item: string; target?: number } | { kind: "swap"; to: number } | { kind: "flee" };

export type BattleEvent =
  | { kind: "text"; text: string }
  | { kind: "use"; side: Side; who: string; move: string; fx: Move["fx"] }
  | { kind: "charge"; side: Side; who: string; move: string }
  | { kind: "damage"; side: Side; amount: number; hp: number; crit: boolean; hit: number }
  | { kind: "heal"; side: Side; amount: number; hp: number }
  | { kind: "miss"; side: Side }
  | { kind: "status"; side: Side; status: StatusId | null }
  | { kind: "stage"; side: Side; stat: Stat; n: number }
  | { kind: "faint"; side: Side; who: string }
  | { kind: "enter"; side: Side; index: number }
  | { kind: "phase"; text: string; sprite?: string }
  | { kind: "transform"; side: Side; on: boolean; sprite: string }
  /** Lancer de capsule : nombre de secousses (0 à 3), puis réussite ou échec. */
  | { kind: "capture"; shakes: number; ok: boolean }
  | { kind: "end"; outcome: Exclude<Outcome, null> };

export function startBattle(id: string, team: Team, seed = Date.now()): Battle {
  const def = BATTLES[id];
  if (!def) throw new Error(`Combat inconnu : ${id}`);
  const members = ["sparrow", ...team.party.filter((p) => p !== "sparrow" && MEMBERS[p])].slice(0, 5);
  return {
    def,
    allies: members.map((m) => makeAlly(m, team)),
    foes: def.foes.map((f, i) => makeFoe(f, def.tutorial ? 0 : rng((seed ^ (i * 0x9e3779b9)) >>> 0)())),
    a: 0,
    f: 0,
    bag: { ...team.bag },
    turn: 0,
    over: null,
    seed: seed >>> 0,
    fleeTries: 0,
    used: {},
    titan: { can: team.skills.includes("titan"), samourai: team.skills.includes("samourai"), used: false, turns: Math.max(1, team.titanTurns ?? 3) },
    stolen: {},
    fought: ["sparrow"],
  };
}

const clone = (b: Battle): Battle => ({
  ...b,
  allies: b.allies.map((x) => ({ ...x, stages: { ...x.stages }, status: x.status && { ...x.status }, moves: [...x.moves], form: x.form && { ...x.form, base: { ...x.form.base, moves: [...x.form.base.moves] } } })),
  foes: b.foes.map((x) => ({ ...x, stages: { ...x.stages }, status: x.status && { ...x.status }, moves: [...x.moves] })),
  bag: { ...b.bag },
  used: { ...b.used },
  titan: { ...b.titan },
  stolen: { ...b.stolen },
  fought: [...b.fought],
});

export const ally = (b: Battle) => b.allies[b.a];
export const foe = (b: Battle) => b.foes[b.f];
const mult = (n: number) => (n >= 0 ? (2 + n) / 2 : 2 / (2 - n));
const accMult = (n: number) => (n >= 0 ? (3 + n) / 3 : 3 / (3 - n));
export const eff = (x: Fighter, s: Exclude<Stat, "acc">) => x[s] * mult(x.stages[s]) * (s === "atk" && x.status?.id === "brule" ? 0.85 : 1);

/** L'équipier actif est K.O. et il en reste : le joueur doit en choisir un autre. */
export const mustSwap = (b: Battle) => !b.over && ally(b).hp <= 0 && b.allies.some((x) => x.hp > 0);

/** Une transformation (SPARROW TITAN, SPARROW SAMOURAÏ) est-elle utilisable maintenant ? Une seule par combat. */
export const canTransform = (b: Battle, form: FormId = "titan") => {
  const me = ally(b);
  const learned = form === "titan" ? b.titan.can : b.titan.samourai;
  return !b.over && learned && !b.titan.used && me.id === "sparrow" && me.hp > 0 && !me.form && !me.charging;
};

/** Transformations apprises et encore utilisables dans ce combat. */
export const forms = (b: Battle): FormId[] => (["titan", "samourai"] as FormId[]).filter((f) => canTransform(b, f));

function transform(b: Battle, me: Fighter, form: FormId, ev: BattleEvent[]) {
  const F = FORMS[form];
  b.titan.used = true;
  me.form = { turns: b.titan.turns, base: { atk: me.atk, def: me.def, spd: me.spd, maxHp: me.maxHp, moves: [...me.moves], sprite: me.sprite } };
  const bonus = Math.round(me.maxHp * F.hp);
  me.atk = Math.round(me.atk * F.atk);
  me.def = Math.round(me.def * F.def);
  me.spd = Math.round(me.spd * F.spd);
  me.maxHp += bonus;
  me.hp += bonus;
  me.moves = [...F.moves];
  me.sprite = F.sprite;
  me.status = null;
  if (F.acc) me.stages.acc = Math.min(3, me.stages.acc + F.acc);
  ev.push(
    { kind: "text", text: F.intro },
    { kind: "transform", side: "ally", on: true, sprite: me.sprite },
    { kind: "heal", side: "ally", amount: bonus, hp: me.hp },
    { kind: "text", text: `${F.name} ! ${F.gain} pendant ${b.titan.turns} tours.` },
  );
}

/** Fin de la transformation (durée écoulée, K.O. ou changement d'équipier). */
function revert(me: Fighter, ev: BattleEvent[], quiet = false) {
  const f = me.form;
  if (!f) return;
  me.atk = f.base.atk;
  me.def = f.base.def;
  me.spd = f.base.spd;
  me.maxHp = f.base.maxHp;
  me.hp = Math.min(me.hp, me.maxHp);
  me.moves = f.base.moves;
  me.sprite = f.base.sprite;
  me.charging = null;
  me.form = null;
  if (quiet) return;
  ev.push({ kind: "transform", side: "ally", on: false, sprite: me.sprite }, { kind: "text", text: "La transformation s'estompe. Sparrow reprend son souffle." });
  if (me.hp > 0) ev.push({ kind: "heal", side: "ally", amount: 0, hp: me.hp });
}

/** Le joueur ne choisit pas : l'équipier actif lance son attaque préparée (ou est étourdi). */
export function forced(b: Battle): Action | null {
  const me = ally(b);
  if (me.charging) return { kind: "move", move: me.charging };
  return null;
}

/** Dégâts d'une technique (sans hasard : utile à l'IA et aux tests). */
export function baseDamage(user: Fighter, target: Fighter, m: Move): number {
  if (!m.power) return 0;
  return (m.power * (eff(user, "atk") / Math.max(1, eff(target, "def"))) * (user.lv + 9)) / 60;
}

/** Vue d'une technique pour le menu (puissance / précision). */
export const moveInfo = (id: string) => MOVES[id];

/** Joue un tour complet : l'action du joueur, puis celle de l'ennemi, dans l'ordre de vitesse. */
export function playTurn(b0: Battle, action: Action): { battle: Battle; events: BattleEvent[] } {
  const b = clone(b0);
  const ev: BattleEvent[] = [];
  if (b.over) return { battle: b, events: ev };
  const r = rng(b.seed + b.turn * 7919);
  b.turn++;

  // Remplacement d'un équipier K.O. : pas de tour ennemi.
  if (mustSwap(b)) {
    if (action.kind === "swap" && b.allies[action.to]?.hp > 0) {
      b.a = action.to;
      if (!b.fought.includes(ally(b).id)) b.fought.push(ally(b).id);
      ev.push({ kind: "enter", side: "ally", index: b.a }, { kind: "text", text: `À toi, ${ally(b).name} !` });
    }
    return { battle: b, events: ev };
  }

  const foeAct = chooseFoe(b, r);
  type Step = { side: Side; act: Action; prio: number; spd: number };
  const steps: Step[] = [
    { side: "ally", act: action, prio: prioOf(action, ally(b)), spd: eff(ally(b), "spd") },
    { side: "foe", act: foeAct, prio: prioOf(foeAct, foe(b)), spd: eff(foe(b), "spd") },
  ];
  steps.sort((x, y) => y.prio - x.prio || y.spd - x.spd || (r() < 0.5 ? -1 : 1));

  for (const s of steps) {
    if (b.over) break;
    const me = s.side === "ally" ? ally(b) : foe(b);
    if (me.hp <= 0) continue;
    if (s.side === "ally") doAlly(b, s.act, ev, r);
    else doFoe(b, s.act, ev, r);
    checkKo(b, ev);
  }
  // Fin du tour : transformation, brûlure, fin des gardes
  if (!b.over) {
    const me = ally(b);
    if (me.form && me.hp > 0) {
      me.form.turns--;
      if (me.form.turns <= 0) revert(me, ev);
    }
    for (const x of [ally(b), foe(b)]) {
      x.guard = false;
      if (x.hp > 0 && x.status?.id === "brule") {
        const d = Math.max(1, Math.round(x.maxHp / 14));
        x.hp = Math.max(0, x.hp - d);
        ev.push({ kind: "text", text: `${x.name} souffre de sa brûlure.` }, { kind: "damage", side: x.side, amount: d, hp: x.hp, crit: false, hit: 0 });
        x.status.turns--;
        if (x.status.turns <= 0 && x.hp > 0) {
          x.status = null;
          ev.push({ kind: "status", side: x.side, status: null }, { kind: "text", text: `La brûlure de ${x.name} est guérie.` });
        }
      }
    }
    checkKo(b, ev);
  }
  return { battle: b, events: ev };
}

function prioOf(a: Action, x: Fighter): number {
  if (a.kind === "swap" || a.kind === "item") return 6;
  if (a.kind === "transform") return 5;
  if (a.kind === "flee") return 7;
  if (a.kind !== "move") return 0;
  return MOVES[x.charging ?? a.move]?.priority ?? 0;
}

function doAlly(b: Battle, a: Action, ev: BattleEvent[], r: () => number) {
  const me = ally(b);
  if (a.kind === "flee") {
    if (!b.def.canFlee) {
      ev.push({ kind: "text", text: "Impossible de fuir ce combat !" });
      return;
    }
    const chance = Math.min(0.95, 0.5 + (eff(me, "spd") - eff(foe(b), "spd")) / 40 + b.fleeTries * 0.2);
    if (r() < chance) {
      b.over = "flee";
      ev.push({ kind: "text", text: "Sparrow prend la fuite… avec style." }, { kind: "end", outcome: "flee" });
    } else {
      b.fleeTries++;
      ev.push({ kind: "text", text: "Pas moyen de s'échapper !" });
    }
    return;
  }
  if (a.kind === "transform") {
    const form = a.form ?? "titan";
    if (canTransform(b, form)) transform(b, me, form, ev);
    return;
  }
  if (a.kind === "swap") {
    const to = b.allies[a.to];
    if (!to || to.hp <= 0 || a.to === b.a) return;
    me.charging = null;
    revert(me, ev, true);
    ev.push({ kind: "text", text: `${me.name}, reviens !` });
    b.a = a.to;
    if (!b.fought.includes(to.id)) b.fought.push(to.id);
    ev.push({ kind: "enter", side: "ally", index: b.a }, { kind: "text", text: `À toi, ${to.name} !` });
    return;
  }
  if (a.kind === "item") {
    useItem(b, a.item, a.target ?? b.a, ev, r);
    return;
  }
  act(b, me, foe(b), a.move, ev, r);
}

function doFoe(b: Battle, a: Action, ev: BattleEvent[], r: () => number) {
  if (a.kind !== "move") return;
  act(b, foe(b), ally(b), a.move, ev, r);
}

/** Chance de capture : meilleure quand la créature est affaiblie ou sous un état. */
export function catchChance(base: number, x: Fighter): number {
  const hp = x.hp / x.maxHp;
  const k = base * (1.35 - hp) * (x.status ? 1.35 : 1);
  return Math.max(0.05, Math.min(0.95, k));
}

function capture(b: Battle, id: string, ev: BattleEvent[], r: () => number) {
  const c = CONSUMABLES[id];
  const x = foe(b);
  if (!b.def.wild) {
    ev.push({ kind: "text", text: "On ne capture pas une créature qui a déjà un maître !" });
    return;
  }
  b.bag[id]--;
  b.used[id] = (b.used[id] ?? 0) + 1;
  const p = catchChance(c.capture ?? 0.5, x);
  const roll = r();
  const ok = roll < p;
  // Plus on était proche de réussir, plus la capsule tremble longtemps
  const shakes = ok ? 3 : Math.min(2, Math.floor((p / Math.max(roll, 0.01)) * 2.4));
  ev.push({ kind: "text", text: `Sparrow lance une ${c.name} !` }, { kind: "capture", shakes, ok });
  if (ok) {
    b.over = "win";
    b.captured = { species: b.def.wild, level: x.lv };
    ev.push({ kind: "text", text: `Clic ! ${MEMBERS[b.def.wild]?.name ?? x.name} est capturé !` }, { kind: "end", outcome: "win" });
  } else ev.push({ kind: "text", text: shakes >= 2 ? `Oh non ! ${x.name} fait sauter la capsule de justesse !` : `${x.name} s'échappe de la capsule !` });
}

export function useItem(b: Battle, id: string, target: number, ev: BattleEvent[], r: () => number = Math.random) {
  const c = CONSUMABLES[id];
  if (c?.capture && (b.bag[id] ?? 0) > 0) return capture(b, id, ev, r);
  const t = b.allies[target];
  if (!c || !t || (b.bag[id] ?? 0) <= 0) return;
  if (c.ko ? t.hp > 0 : t.hp <= 0) return;
  b.bag[id]--;
  b.used[id] = (b.used[id] ?? 0) + 1;
  ev.push({ kind: "text", text: `Sparrow utilise : ${c.name}.` });
  const side: Side = "ally";
  const active = target === b.a;
  const heal = (n: number) => {
    const before = t.hp;
    t.hp = Math.min(t.maxHp, t.hp + n);
    if (active) ev.push({ kind: "heal", side, amount: t.hp - before, hp: t.hp });
    ev.push({ kind: "text", text: `${t.name} récupère ${t.hp - before} PV.` });
  };
  if (c.use.revive) {
    t.hp = 0;
    heal(Math.round((t.maxHp * c.use.revive) / 100));
    t.status = null;
    t.charging = null;
    return;
  }
  if (c.use.heal) heal(c.use.heal);
  if (c.use.healPct) heal(Math.round((t.maxHp * c.use.healPct) / 100));
  if (c.use.cleanse && t.status) {
    t.status = null;
    if (active) ev.push({ kind: "status", side, status: null });
  }
  if (c.use.stage) applyStage(t, c.use.stage.stat, c.use.stage.n, ev, active);
}

function applyStage(x: Fighter, s: Stat, n: number, ev: BattleEvent[], show = true) {
  const before = x.stages[s];
  x.stages[s] = Math.max(-3, Math.min(3, before + n));
  const d = x.stages[s] - before;
  const label = { atk: "L'attaque", def: "La défense", spd: "La vitesse", acc: "La précision" }[s];
  if (!d) {
    ev.push({ kind: "text", text: `${label} de ${x.name} ne peut plus ${n > 0 ? "monter" : "baisser"} !` });
    return;
  }
  if (show) ev.push({ kind: "stage", side: x.side, stat: s, n: d });
  ev.push({ kind: "text", text: `${label} de ${x.name} ${d > 0 ? (d > 1 ? "monte beaucoup" : "monte") : d < -1 ? "baisse beaucoup" : "baisse"} !` });
}

/** Utilisation d'une technique (préparation, précision, dégâts, effets). */
function act(b: Battle, user: Fighter, target: Fighter, moveId: string, ev: BattleEvent[], r: () => number) {
  const m = MOVES[moveId];
  if (!m) return;
  // Étourdi : perd son tour (et sa préparation)
  if (user.status?.id === "etourdi") {
    user.status = null;
    user.charging = null;
    ev.push({ kind: "text", text: `${user.name} est étourdi et ne peut pas agir !` }, { kind: "status", side: user.side, status: null });
    return;
  }
  if (m.charge && user.charging !== moveId) {
    user.charging = moveId;
    ev.push({ kind: "charge", side: user.side, who: user.name, move: moveId }, { kind: "text", text: chargeLine(user, m) });
    return;
  }
  user.charging = null;
  ev.push({ kind: "use", side: user.side, who: user.name, move: moveId, fx: m.fx }, { kind: "text", text: `${user.name} utilise ${m.name} !` });

  if (m.target === "self" || m.target === "ally") {
    applyEffects(b, m, user, user, ev, r, 0);
    if (m.target === "ally" && user.side === "ally") {
      // Soin d'équipe : les équipiers en réserve récupèrent aussi un peu.
      for (const x of b.allies) {
        if (x === user || x.hp <= 0 || x.hp >= x.maxHp) continue;
        const before = x.hp;
        x.hp = Math.min(x.maxHp, x.hp + Math.round(x.maxHp * 0.2));
        ev.push({ kind: "text", text: `${x.name} (en réserve) récupère ${x.hp - before} PV.` });
      }
    }
    return;
  }
  // Précision
  const hitChance = (m.acc / 100) * accMult(user.stages.acc);
  if (r() > hitChance) {
    ev.push({ kind: "miss", side: target.side }, { kind: "text", text: `${user.name} rate son coup !` });
    return;
  }
  let dealt = 0;
  if (m.power) {
    const n = m.hits ? m.hits[0] + Math.floor(r() * (m.hits[1] - m.hits[0] + 1)) : 1;
    let landed = 0;
    for (let i = 0; i < n && target.hp > 0; i++) {
      const crit = r() < 0.0625;
      let d = baseDamage(user, target, m) * (0.85 + r() * 0.15) * (crit ? 1.5 : 1);
      const ex = m.effects?.find((e) => e.kind === "execute");
      const finishing = ex?.kind === "execute" && target.hp / target.maxHp < ex.below;
      if (finishing) d *= ex.mult;
      if (target.guard) d *= 0.5;
      const amount = Math.max(1, Math.round(d));
      target.hp = Math.max(0, target.hp - amount);
      dealt += amount;
      landed++;
      ev.push({ kind: "damage", side: target.side, amount, hp: target.hp, crit, hit: i });
      if (crit) ev.push({ kind: "text", text: "Coup critique !" });
      if (finishing) ev.push({ kind: "text", text: "Coup de grâce !" });
    }
    if (target.guard) {
      target.guard = false;
      ev.push({ kind: "text", text: `${target.name} encaisse en garde.` });
    }
    if (n > 1) ev.push({ kind: "text", text: `Touché ${landed} fois !` });
  }
  applyEffects(b, m, user, target, ev, r, dealt);
}

function chargeLine(user: Fighter, m: Move) {
  if (user.side === "foe") return `${user.name} prépare ${m.name} ! Attention au prochain tour !`;
  return `${user.name} se concentre… ${m.name} au prochain tour !`;
}

function applyEffects(b: Battle, m: Move, user: Fighter, target: Fighter, ev: BattleEvent[], r: () => number, dealt: number) {
  for (const e of m.effects ?? []) {
    if (e.kind === "heal") {
      const before = target.hp;
      target.hp = Math.min(target.maxHp, target.hp + Math.round((target.maxHp * e.pct) / 100));
      ev.push({ kind: "heal", side: target.side, amount: target.hp - before, hp: target.hp });
      ev.push({ kind: "text", text: target.hp > before ? `${target.name} récupère ${target.hp - before} PV.` : `${target.name} est déjà en pleine forme.` });
    } else if (e.kind === "cleanse") {
      if (target.status) {
        target.status = null;
        ev.push({ kind: "status", side: target.side, status: null }, { kind: "text", text: `${target.name} se sent mieux.` });
      }
    } else if (e.kind === "guard") {
      user.guard = true;
      ev.push({ kind: "text", text: `${user.name} se met en garde.` });
    } else if (e.kind === "steal") {
      if (!dealt || user.side !== "ally" || Object.keys(b.stolen).length) continue;
      const k = r();
      const item = k < 0.55 ? "frites" : k < 0.8 ? "barre-proteinee" : k < 0.93 ? "mega-cornet" : "ketchup";
      b.stolen[item] = 1;
      b.bag[item] = Math.min(99, (b.bag[item] ?? 0) + 1);
      ev.push({ kind: "text", text: `${user.name} chipe : ${CONSUMABLES[item].name} !` });
    } else if (e.kind === "execute") {
      continue;
    } else if (e.kind === "recoil") {
      if (!dealt) continue;
      const d = Math.max(1, Math.round((dealt * e.pct) / 100));
      user.hp = Math.max(0, user.hp - d);
      ev.push({ kind: "damage", side: user.side, amount: d, hp: user.hp, crit: false, hit: 0 }, { kind: "text", text: `${user.name} se fait mal en roulant.` });
    } else if (e.kind === "stage") {
      const who = e.who === "self" ? user : target;
      if (who.hp <= 0) continue;
      if (e.chance !== undefined && r() * 100 >= e.chance) continue;
      applyStage(who, e.stat, e.n, ev);
    } else if (e.kind === "status") {
      if (target.hp <= 0 || target.status || r() * 100 >= e.chance) continue;
      target.status = { id: e.status, turns: e.status === "brule" ? 3 : 1 };
      // Un ennemi étourdi perd aussi l'attaque qu'il préparait : c'est la parade aux attaques annoncées.
      ev.push({ kind: "status", side: target.side, status: e.status }, { kind: "text", text: e.status === "brule" ? `${target.name} est brûlé !` : `${target.name} est étourdi !` });
    }
  }
}

function checkKo(b: Battle, ev: BattleEvent[]) {
  if (b.over) return;
  const f = foe(b);
  if (f.hp <= 0) {
    ev.push({ kind: "faint", side: "foe", who: f.name }, { kind: "text", text: `${f.name} est K.O. !` });
    const next = b.foes.findIndex((x) => x.hp > 0);
    if (next < 0) {
      b.over = "win";
      ev.push({ kind: "end", outcome: "win" });
      return;
    }
    b.f = next;
    ev.push({ kind: "enter", side: "foe", index: next }, { kind: "text", text: `${b.foes[next].name} prend la relève !` });
  } else checkPhase(b, f, ev);
  const a = ally(b);
  if (a.hp <= 0) {
    revert(a, ev, true);
    a.charging = null;
    a.status = null;
    ev.push({ kind: "faint", side: "ally", who: a.name }, { kind: "text", text: `${a.name} est K.O. !` });
    if (!b.allies.some((x) => x.hp > 0)) {
      b.over = "lose";
      ev.push({ kind: "end", outcome: "lose" });
    }
  }
}

function checkPhase(b: Battle, f: Fighter, ev: BattleEvent[]) {
  const phases = f.foe ? FOES[f.foe].phases : undefined;
  if (!phases) return;
  const next = f.phase + 1;
  const p = phases[next];
  if (!p || f.hp / f.maxHp > p.below) return;
  f.phase = next;
  f.moves = [...p.moves];
  f.charging = null;
  f.status = null;
  if (p.sprite) f.sprite = p.sprite;
  ev.push({ kind: "phase", text: p.line, sprite: p.sprite });
  if (p.heal) {
    const before = f.hp;
    f.hp = Math.min(f.maxHp, f.hp + Math.round((f.maxHp * p.heal) / 100));
    ev.push({ kind: "heal", side: "foe", amount: f.hp - before, hp: f.hp });
  }
  for (const [s, n] of Object.entries(p.stages ?? {})) applyStage(f, s as Stat, n!, ev);
}

// ─── IA ennemie ───

/** L'ennemi pèse ses options : dégâts attendus, soins quand il faiblit, bonus en début de combat. */
export function chooseFoe(b: Battle, r: () => number): Action {
  const me = foe(b);
  const them = ally(b);
  if (me.charging) return { kind: "move", move: me.charging };
  const hpRatio = me.hp / me.maxHp;
  const scored = me.moves.map((id) => {
    const m = MOVES[id];
    let s = 0;
    if (m.power) {
      const hits = m.hits ? (m.hits[0] + m.hits[1]) / 2 : 1;
      const dmg = baseDamage(me, them, m) * hits * (m.acc / 100);
      s = dmg;
      if (dmg >= them.hp) s *= 2.2; // achever
      if (m.charge) s *= them.guard || them.hp < dmg / 2 ? 0.3 : 0.55; // une attaque annoncée se pare : moins tentante
    }
    for (const e of m.effects ?? []) {
      if (e.kind === "heal") s += hpRatio < 0.4 ? 24 : hpRatio < 0.7 ? 4 : -10;
      if (e.kind === "stage" && e.who === "self") s += me.stages[e.stat] < 1 && b.turn < 6 ? 9 : -6;
      if (e.kind === "stage" && e.who === "target" && !m.power) s += them.stages[e.stat] > -1 ? 8 : -8;
      if (e.kind === "status") s += them.status ? 0 : (e.chance / 100) * 6;
      if (e.kind === "guard") s += them.charging ? 22 : -4;
    }
    return { id, s: Math.max(0.5, s) };
  });
  // Choix pondéré : l'ennemi préfère le meilleur coup, sans être prévisible.
  const total = scored.reduce((a, x) => a + x.s * x.s, 0);
  let k = r() * total;
  for (const x of scored) {
    k -= x.s * x.s;
    if (k <= 0) return { kind: "move", move: x.id };
  }
  return { kind: "move", move: scored[scored.length - 1].id };
}

// ─── Fin de combat ───

export interface Spoils {
  xp: number;
  fp: number;
  drops: Record<string, number>;
  /** Objets consommés pendant le combat. */
  used: Record<string, number>;
}

export function spoils(b: Battle): Spoils {
  if (b.over !== "win") return { xp: 0, fp: 0, drops: {}, used: b.used };
  const drops: Record<string, number> = { ...(b.def.drops ?? {}) };
  for (const [k, n] of Object.entries(b.stolen)) drops[k] = (drops[k] ?? 0) + n;
  return { xp: b.def.xp, fp: b.def.fp, drops, used: b.used };
}

/** Sac après le combat : objets utilisés retirés (même en cas de défaite), butin ajouté. */
export function bagAfter(bag: Record<string, number>, s: Spoils): Record<string, number> {
  const out: Record<string, number> = { ...bag };
  for (const [k, n] of Object.entries(s.used)) out[k] = Math.max(0, (out[k] ?? 0) - n);
  for (const [k, n] of Object.entries(s.drops)) out[k] = Math.min(99, (out[k] ?? 0) + n);
  for (const k of Object.keys(out)) if (out[k] <= 0) delete out[k];
  return out;
}
