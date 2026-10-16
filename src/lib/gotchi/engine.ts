/**
 * SPARROWGOTCHI 2.0 — moteur de jeu (logique pure, sans DOM, testable).
 *
 * Assemble l'état (core), la progression (items), les missions, les trophées,
 * les événements et les dialogues. Toutes les fonctions renvoient un nouvel état.
 * Sparrow ne meurt jamais : au pire il boude, fait une crise ou refuse un moment.
 */

import { checkTrophies } from "./achievements";
import {
  HOUR,
  MIN,
  apply,
  bump,
  gain,
  log,
  moyenne,
  parisDay,
  parisHour,
  seeded,
  setStatus,
  tick,
  type Action,
  type Stat,
  type State,
} from "./core";
import { talk, welcome, pickFresh } from "./dialogue";
import { pickEvent, type GameEvent, type Scene } from "./events";
import { ITEMS, RARES, itemById, type Item } from "./items";
import { LINES } from "./lines";
import { claimMission, claimable, ensureMissions, track } from "./missions";

export * from "./core";
export { EVENTS, type GameEvent, type Scene } from "./events";

type Rand = () => number;

/** Séquence animée à jouer dans l'appartement. */
export type Anim =
  | Action
  | "refus"
  | "rage"
  | "drop"
  | "victoire"
  | "crise"
  | "gras"
  | "rabe"
  | "grimace"
  | "miracle"
  | "boude"
  | "event";

export interface Note {
  kind: "level" | "trophy" | "drop" | "mission" | "coins";
  txt: string;
}

export interface Result {
  state: State;
  line: string;
  anim: Anim;
  delta: Partial<Record<Stat, number>>;
  notes: Note[];
  /** Pour les événements : décor et rareté (animation spéciale si légendaire). */
  scene?: Scene;
  rarity?: GameEvent["rarity"];
}

export const COOLDOWN: Record<Action, number> = {
  frites: 8_000,
  salade: 8_000,
  dofus: 12_000,
  sieste: 25_000,
  douche: 15_000,
  parler: 2_500,
};

/** XP / pièces par action (petit, la vraie progression vient du mini-jeu et des missions). */
const REWARD: Record<Action, [number, number]> = {
  frites: [4, 2],
  salade: [8, 3],
  dofus: [6, 3],
  sieste: [5, 2],
  douche: [4, 2],
  parler: [2, 1],
};

export function cooldownLeft(s: State, a: Action, now: number): number {
  return Math.max(0, (s.cooldowns[a] ?? 0) - now);
}

const live = (s: State, st: State["status"], now: number) => s.status === st && now < s.statusUntil;

const pick = (pool: string[], s: State, rand: Rand) => pickFresh(pool, s.said, rand);

function remember(s: State, line: string): State {
  return { ...s, said: [...s.said.filter((l) => l !== line), line].slice(-12) };
}

/** Débloque trophées et signale les missions qui viennent d'être terminées. */
function settle(before: State, s0: State, now: number, notes: Note[]): State {
  const { state, unlocked } = checkTrophies(s0, now);
  for (const t of unlocked) notes.push({ kind: "trophy", txt: `Trophée : ${t.name} (+${t.coins} FP)` });
  if (claimable(state) > claimable(before)) notes.push({ kind: "mission", txt: "Mission accomplie ! Va encaisser." });
  return state;
}

function reward(s: State, xp: number, coins: number, now: number, notes: Note[]): State {
  const g = gain(s, xp, coins, now);
  for (const l of g.levels) notes.push({ kind: "level", txt: `NIVEAU ${l} !` });
  return g.state;
}

/** Donne un objet rare non possédé (ou des pièces si la collection est complète). */
export function grantRare(s: State, now: number, rand: Rand, prefer?: string): { state: State; item: Item | null; coins: number } {
  const missing = RARES.filter((id) => !s.owned.includes(id));
  const id = prefer && missing.includes(prefer) ? prefer : missing[Math.floor(rand() * missing.length)];
  if (!id) return { state: { ...s, coins: s.coins + 60 }, item: null, coins: 60 };
  const item = itemById(id)!;
  let st = bump({ ...s, owned: [...s.owned, id] }, "rares");
  st = log(st, `Objet rare obtenu : ${item.name}`, "drop", now);
  return { state: st, item, coins: 0 };
}

const RABE = [
  "Tu crois que… une deuxième portion… ce serait abusé ? Non ? Super.",
  "C'était l'entrée. On passe au plat ? Le plat, c'est des frites.",
  "Je ne dis pas que j'en veux encore. Je le pense très fort.",
  "Une portion, c'est une portion. Deux portions, c'est une tradition.",
];
const FRITOMAN = [
  "JE SUIS… FRITOMAN ! Mes pouvoirs : rien. Mais avec du sel.",
  "Transformation Fritoman activée. Ne touche pas, ça glisse.",
  "Fritoman est né. Il ne peut plus bouger, mais il est heureux.",
];
const SALADE_MIRACLE = [
  "Attends… c'est… bon ?! Ne le dis à personne. JAMAIS.",
  "J'ai aimé cette salade. Je ne me reconnais plus. Qui suis-je ?",
  "Bon. Elle était pas mal. Mais c'est un accident, ça n'arrivera plus.",
];
const BOUDE_REFUS = [
  "Je boude. Il n'y a que les frites qui peuvent négocier.",
  "Non. Je boude. C'est un travail à plein temps.",
  "Tu vois pas que je boude ? Reviens avec des frites.",
];
const PANNE = [
  "Le PC est en panne. Je regarde l'écran noir. Il me regarde aussi.",
  "Pas de PC, pas de farm. Je vais devoir… parler à des gens ?",
];
const DOUCHE_EXTRA = [
  "J'ai chanté sous la douche. Les voisins ont applaudi. Ou tapé au mur.",
  "Eau froide ! TRAHISON ! Bon, je me sens vivant.",
  "Je suis frais comme une salade. Beurk, mauvaise comparaison.",
  "Je me suis aspergé le visage. Les lunettes sont mouillées. Je ne vois plus rien. Ça va.",
];
const VICTOIRE = [
  "VICTOIRE ! Le boss est tombé. Je suis une légende de mon salon.",
  "J'ai gagné ! Note-le quelque part, personne ne me croira.",
];

/** Effectue une action du joueur. */
export function act(s0: State, a: Action, now: number, rand: Rand = Math.random): Result {
  const before = ensureMissions(tick(s0, now), now);
  let s = before;
  const notes: Note[] = [];

  // Il boude : seules les frites (et la discussion) passent.
  if (live(s, "boude", now) && a !== "frites" && a !== "parler") {
    const line = pick(BOUDE_REFUS, s, rand);
    return { state: remember(s, line), line, anim: "boude", delta: {}, notes };
  }
  if (live(s, "focus", now) && a !== "frites" && a !== "parler") {
    const line = pick(LINES.focusRefus, s, rand);
    return { state: remember(s, line), line, anim: "refus", delta: {}, notes };
  }

  s = { ...s, cooldowns: { ...s.cooldowns, [a]: now + COOLDOWN[a] } };
  let d: Partial<Record<Stat, number>> = {};
  let line = "";
  let anim: Anim = a;
  let [xp, coins] = REWARD[a];

  switch (a) {
    case "frites": {
      s = bump({ ...s, recentFrites: [...s.recentFrites, now] }, "frites");
      s = track(s, "frites", 1, now);
      if (s.status === "boude") s = { ...s, status: null, statusUntil: 0 };
      if (s.stats.satiete >= 95) {
        d = { humeur: 5, forme: -4 };
        line = pick(LINES.fritesPlein, s, rand);
      } else {
        d = { satiete: 30, humeur: 12, forme: -6 };
        line = pick(LINES.frites, s, rand);
      }
      if (s.recentFrites.length >= 3 && !live(s, "gras", now)) {
        s = bump(setStatus(s, "gras", 12, now), "fritoman");
        d = { ...d, energie: -8 };
        line = pick(FRITOMAN, s, rand);
        anim = "gras";
      } else if (s.stats.satiete < 80 && rand() < 0.3) {
        line = pick(RABE, s, rand);
        anim = "rabe";
      }
      break;
    }
    case "salade": {
      const refuse = s.recentSalade.length >= 1 || rand() < 0.4;
      s = { ...s, recentSalade: [...s.recentSalade, now] };
      if (refuse) {
        d = { humeur: -8 };
        line = pick(LINES.saladeRefus, s, rand);
        anim = "refus";
        s = bump(s, "saladeRefus");
        xp = 2;
        coins = 1;
        if (rand() < 0.15) s = setStatus(s, "boude", 3, now);
      } else {
        s = track(bump(s, "salade"), "saladeOk", 1, now);
        if (s.status === "gras") s = { ...s, status: null, statusUntil: 0 };
        if (rand() < 0.1) {
          d = { satiete: 14, forme: 14, humeur: 10 };
          line = pick(SALADE_MIRACLE, s, rand);
          anim = "miracle";
          xp += 10;
        } else {
          d = { satiete: 12, forme: 12, humeur: -5 };
          line = pick(LINES.salade, s, rand);
          anim = "grimace";
        }
      }
      break;
    }
    case "dofus": {
      if (s.pcBrokenUntil > now) {
        line = pick(PANNE, s, rand);
        return { state: remember(before, line), line, anim: "refus", delta: {}, notes };
      }
      s = track(bump(s, "dofus"), "dofusAuto", 1, now);
      const r = rand();
      if (r < 0.2) {
        d = { humeur: -12, fun: 10, energie: -10 };
        s = bump(setStatus(s, "rage", 3, now), "rages");
        line = pick(LINES.rage, s, rand);
        anim = "rage";
      } else if (r < 0.3) {
        d = { humeur: 30, fun: 30, energie: -8 };
        line = pick(LINES.drop, s, rand);
        anim = "drop";
        coins += 15;
      } else if (r < 0.42) {
        d = { humeur: 20, fun: 25, energie: -10 };
        line = pick(VICTOIRE, s, rand);
        anim = "victoire";
        xp += 4;
      } else if (r < 0.57) {
        d = { humeur: 12, fun: 25, energie: -12 };
        s = setStatus(s, "focus", 4, now);
        line = pick(LINES.focus, s, rand);
      } else {
        d = { humeur: 15, fun: 25, energie: -10, forme: -3 };
        line = pick(LINES.dofus, s, rand);
      }
      break;
    }
    case "sieste": {
      // Uniquement des micro-siestes : il refuse s'il est en forme.
      if (s.stats.energie > 70 || rand() < 0.35) {
        d = { energie: 6 };
        line = pick(LINES.siesteRefus, s, rand);
        anim = "refus";
        s = bump(s, "siestesRefusees");
        xp = 1;
        coins = 0;
      } else {
        d = { energie: 28, humeur: 4 };
        line = pick(LINES.sieste, s, rand);
        s = track(bump(s, "siestes"), "sieste", 1, now);
      }
      break;
    }
    case "douche": {
      d = { forme: 15, humeur: 4 };
      s = track(bump(s, "douches"), "douche", 1, now);
      if (s.status === "gras") {
        s = { ...s, status: null, statusUntil: 0 };
        line = pick(LINES.doucheGras, s, rand);
      } else line = pick([...LINES.douche, ...DOUCHE_EXTRA], s, rand);
      break;
    }
    case "parler": {
      d = { humeur: 3 };
      line = talk(s, now, rand);
      s = track(bump(s, "talks"), "talk", 1, now);
      break;
    }
  }

  s = apply(s, d);
  s = { ...remember(s, line), lastAction: { a, t: now } };
  s = reward(s, xp, coins, now, notes);
  s = settle(before, s, now, notes);
  return { state: s, line, anim, delta: d, notes };
}

/** Applique un événement aléatoire. */
export function applyEvent(s0: State, e: GameEvent, now: number, rand: Rand = Math.random): Result {
  const before = ensureMissions(s0, now);
  const notes: Note[] = [];
  let s = apply(before, e.d ?? {});
  if (e.status) s = setStatus(s, e.status[0], e.status[1], now);
  if (e.panne) s = bump({ ...s, pcBrokenUntil: now + e.panne * MIN }, "pannes");
  let line = e.text;
  if (e.rareItem) {
    const g = grantRare(s, now, rand, e.id === "e-dofrite" ? "dec-dofrite" : undefined);
    s = g.state;
    if (g.item) {
      notes.push({ kind: "drop", txt: `Objet rare : ${g.item.name}` });
      line += ` (${g.item.name} ajouté au sac.)`;
    } else line += " (Collection complète : +60 FP à la place.)";
  }
  s = bump(s, "events");
  if (e.rarity === "legendaire") s = bump(s, "rareEvents");
  s = { ...s, seenEvents: s.seenEvents.includes(e.id) ? s.seenEvents : [...s.seenEvents, e.id] };
  s = log(s, e.text, e.rarity === "commun" ? "event" : "rare", now);
  s = reward(s, e.xp ?? 0, e.coins ?? 0, now, notes);
  if (e.coins) notes.push({ kind: "coins", txt: `+${e.coins} FP` });
  s = settle(before, s, now, notes);
  return { state: s, line, anim: "event", delta: e.d ?? {}, notes, scene: e.scene, rarity: e.rarity };
}

/**
 * Événement pendant que l'écran est ouvert. Renvoie souvent null (on ne veut pas
 * l'inonder) ; parfois une simple réflexion liée à ses besoins, parfois un vrai événement.
 */
export function randomEvent(s0: State, now: number, rand: Rand = Math.random): Result | null {
  const s = tick(s0, now);
  if (moyenne(s) < 22) {
    const st = bump(s, "crises");
    return { state: st, line: pick(LINES.crise, s, rand), anim: "crise", delta: {}, notes: [] };
  }
  const r = rand();
  if (r < 0.35) return null;
  if (r < 0.55) {
    const pool = s.stats.satiete < 40 ? LINES.reclameFrites : s.stats.energie < 30 ? LINES.pasSommeil : LINES.punchline;
    const line = pick(pool, s, rand);
    return { state: remember(s, line), line, anim: "parler", delta: {}, notes: [] };
  }
  return applyEvent(s, pickEvent(s, parisHour(now), rand), now, rand);
}

/**
 * Retour après une absence : rattrapage du temps + quelques événements « vécus » pendant
 * ce temps (1 à 3 selon la durée). Renvoie null si l'absence est courte.
 */
export function catchUp(
  before: State,
  now: number,
  rand: Rand = Math.random,
): { state: State; welcome: string; events: Result[] } | null {
  const away = now - before.last;
  let s = ensureMissions(tick(before, now), now);
  const w = welcome(away, s, rand);
  if (!w) return null;
  const n = away < 2 * HOUR ? 1 : Math.min(3, 1 + Math.floor(away / (4 * HOUR)));
  const events: Result[] = [];
  for (let i = 0; i < n; i++) {
    const e = pickEvent(s, parisHour(now), rand);
    if (e.panne) continue; // pas de panne « rétroactive » au retour
    const r = applyEvent(s, e, now, rand);
    s = r.state;
    events.push(r);
  }
  return { state: s, welcome: w, events };
}

// ─── Boutique / équipement ───

export function buy(s: State, id: string, now: number): { state: State; ok: boolean; msg: string } {
  const it = itemById(id);
  if (!it || it.rare) return { state: s, ok: false, msg: "Introuvable en boutique." };
  if (s.owned.includes(id)) return { state: s, ok: false, msg: "Déjà dans le sac." };
  if (s.level < it.level) return { state: s, ok: false, msg: `Niveau ${it.level} requis.` };
  if (s.coins < it.price) return { state: s, ok: false, msg: `Il manque ${it.price - s.coins} FP.` };
  const notes: Note[] = [];
  let st: State = { ...s, coins: s.coins - it.price, owned: [...s.owned, id] };
  st = log(st, `Achat : ${it.name}`, "info", now);
  st = equip(st, id);
  st = settle(s, st, now, notes);
  return { state: st, ok: true, msg: notes.length ? `${it.name} acheté ! ${notes.map((n) => n.txt).join(" · ")}` : `${it.name} acheté et équipé !` };
}

/** Équipe un objet possédé (décoration : bascule on/off). */
export function equip(s: State, id: string): State {
  const it = itemById(id);
  if (!it || !s.owned.includes(id)) return s;
  if (it.slot === "deco") {
    const deco = s.equip.deco.includes(id) ? s.equip.deco.filter((d) => d !== id) : [...s.equip.deco, id];
    return { ...s, equip: { ...s.equip, deco } };
  }
  return { ...s, equip: { ...s.equip, [it.slot]: id } };
}

export const isEquipped = (s: State, id: string) =>
  s.equip.lunettes === id || s.equip.tenue === id || s.equip.tete === id || s.equip.deco.includes(id);

/** Applique l'équipement puis vérifie les trophées (cape + masque…). */
export function equipAndCheck(s: State, id: string, now: number): { state: State; notes: Note[] } {
  const notes: Note[] = [];
  const st = settle(s, equip(s, id), now, notes);
  return { state: st, notes };
}

export const shopItems = () => ITEMS.filter((i) => !i.rare);

// ─── Mini-jeu de farm ───

export interface FarmResult {
  score: number;
  monsters: number;
  resources: number;
  egg: boolean;
}

export const canFarm = (s: State, now: number) => s.pcBrokenUntil <= now;

export function farmReward(
  s0: State,
  r: FarmResult,
  now: number,
  rand: Rand = Math.random,
): { state: State; coins: number; xp: number; drop: Item | null; notes: Note[]; record: boolean } {
  const before = ensureMissions(tick(s0, now), now);
  const notes: Note[] = [];
  const score = Math.max(0, Math.floor(r.score));
  const coins = Math.round(score / 8);
  const xp = Math.round(score / 12) + 5;
  let s = apply(before, { energie: -8, fun: 30, humeur: 8, satiete: -5 });
  s = bump(bump(s, "farms"), "dofus");
  const record = score > s.bestFarm;
  s = { ...s, bestFarm: Math.max(s.bestFarm, score), lastAction: { a: "farm", t: now } };
  s = track(s, "farm", 1, now);
  s = track(s, "farmScore", score, now);
  s = track(s, "monstres", r.monsters, now);
  s = track(s, "ressources", r.resources, now);
  let drop: Item | null = null;
  if (r.egg || rand() < 0.04 + Math.min(0.06, score / 20000)) {
    const g = grantRare(s, now, rand, r.egg ? "dec-dofrite" : undefined);
    s = g.state;
    drop = g.item;
    if (drop) notes.push({ kind: "drop", txt: `DROP RARE : ${drop.name} !` });
  }
  s = log(s, `Session de farm : ${score} pts, +${coins} FP`, "info", now);
  s = reward(s, xp, coins, now, notes);
  s = settle(before, s, now, notes);
  return { state: s, coins, xp, drop, notes, record };
}

// ─── Objet caché du jour ───

/** Position (en pixels-monde) de l'objet caché du jour, ou null s'il est déjà trouvé. */
export function cacheSpot(s: State, now: number, worldW: number): { x: number; y: number } | null {
  const day = parisDay(now);
  if (s.cacheDay === day) return null;
  const r = seeded(`cache:${day}`);
  return { x: 8 + Math.floor(r() * (worldW - 16)), y: 46 + Math.floor(r() * 10) };
}

export function findCache(s0: State, now: number, rand: Rand = Math.random): Result | null {
  const day = parisDay(now);
  if (s0.cacheDay === day) return null;
  const before = ensureMissions(tick(s0, now), now);
  const notes: Note[] = [];
  const coins = 15 + Math.floor(rand() * 16);
  let s = track(bump({ ...before, cacheDay: day }, "caches"), "cache", 1, now);
  const finds = [
    "une frite fossilisée",
    "une manette de 2009",
    "un ticket de caisse de friterie",
    "une chaussette orpheline",
    "un post-it « farmer demain »",
    "une pièce sous le tapis",
  ];
  const what = finds[Math.floor(rand() * finds.length)];
  s = log(s, `Objet caché trouvé : ${what}`, "info", now);
  s = reward(s, 10, coins, now, notes);
  s = settle(before, s, now, notes);
  notes.unshift({ kind: "coins", txt: `+${coins} FP` });
  return { state: s, line: `Tu as trouvé ${what} ! Sparrow : « Ah, c'est là que c'était. »`, anim: "victoire", delta: {}, notes };
}

// ─── Missions ───

export function claim(s: State, id: string, now: number): { state: State; notes: Note[] } | null {
  const c = claimMission(s, id, now);
  if (!c) return null;
  const notes: Note[] = [{ kind: "coins", txt: `+${c.coins} FP · +${c.xp} XP` }];
  let st = reward(c.state, c.xp, c.coins, now, notes);
  st = settle(s, st, now, notes);
  return { state: st, notes };
}

export { claimable, ensureMissions } from "./missions";
