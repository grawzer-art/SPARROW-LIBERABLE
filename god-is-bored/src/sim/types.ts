export type Job = "child" | "farmer" | "lumberjack" | "miner" | "builder" | "soldier" | "scholar";
export type CState =
  | "idle" | "wander" | "eat" | "forage" | "work" | "build" | "travel"
  | "mate" | "flee" | "fight" | "march" | "sick" | "rest" | "talk";

export type PersonalityId =
  | "pacifist" | "expansionist" | "fanatic" | "opportunist" | "arrogant" | "paranoid" | "stupid";

export type BuildingType =
  | "hall" | "house" | "farm" | "lumber" | "quarry" | "barracks" | "temple" | "castle"
  | "market" | "walls" | "mill" | "forge" | "factory" | "station" | "power" | "lab";

/** Modificateurs économiques/militaires issus des bâtiments réellement construits. */
export interface CivMods { farm: number; wood: number; stone: number; gold: number; tech: number; army: number; }

/** Actions du moteur de décision (indices stables : ils servent aussi à la sauvegarde et au diagnostic). */
export type ActionId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Âme d'un habitant : besoins vitaux supplémentaires, traits persistants, foyer, parenté et décision courante.
 * Données compactes (tableaux de nombres) : sauvegardées telles quelles, identité conservée au chargement.
 */
export interface SoulState {
  v: 1;
  fat: number; soc: number; com: number; fear: number; // besoins 0..100 : fatigue, solitude, inconfort, peur (faim et santé : sur Citizen)
  t: [number, number, number, number, number]; // traits 0..1 : sociabilité, curiosité, ambition, empathie, prudence (le courage reste Citizen.courage)
  home: number; mother: number; father: number; mate: number; // identifiants (-1 : aucun)
  act: ActionId; since: number; until: number; target: number; // action en cours, tick de début, échéance, cible (habitant)
  sc: number[]; // dernières utilités calculées (x100), une par action : « pourquoi » de la dernière décision
  fail: number; failUntil: number; // dernière action impossible et fin de sa mise à l'écart
}

export interface Citizen {
  id: number;
  name: string;
  age: number;
  civ: number;
  city: number;
  x: number; y: number; px: number; py: number;
  hp: number;
  hunger: number;
  job: Job;
  intel: number; courage: number; aggr: number; faith: number;
  female: boolean;
  state: CState;
  tx: number; ty: number;
  work: number; // id bâtiment cible (-1 aucun)
  wx: number; wy: number; // cible de travail persistante (-1 aucune)
  think: number;
  cooldown: number;
  mateT: number;
  sick: number;
  immune: number;
  panic: number;
  fx: number; fy: number; // point de fuite
  army: number;
  slot: number; // position dans la formation
  stuck: number;
  workT: number;
  dead?: boolean;
  path?: number[] | null;
  pathI?: number;
  soul?: SoulState;
}

export interface Leader {
  name: string;
  title: string;
  age: number;
  intel: number; aggr: number; ambition: number; vanity: number;
  goat: boolean;
  dynasty: number;
  since: number;
}

export interface Religion { name: string; dogma: "peace" | "war" | "harvest" | "scholar" | "chaos"; }

export interface Law { id: string; name: string; since: number; }

export interface Prayer { want: "rain" | "fire" | "food" | "victory" | "cure" | "gift"; tick: number; }

export interface Civ {
  id: number;
  name: string;
  formal: string;
  color: number;
  alive: boolean;
  personality: PersonalityId;
  religion: Religion;
  leader: Leader;
  culture: number;
  tech: number; techProg: number;
  techs: string[]; // technologies réellement découvertes (ids, dans l'ordre)
  era: number; // époque visuelle/civilisationnelle 0..5 (dépend de la tech, de la population, de la stabilité et de l'or)
  eraSince: number; // année d'entrée dans l'époque actuelle
  eraLow: number; // années consécutives de déclin (régression)
  style: number; // identité architecturale 0..3 (indépendante du niveau)
  mods: CivMods;
  food: number; wood: number; stone: number; gold: number;
  stability: number;
  lowStab: number;
  capital: number;
  foundedYear: number;
  extinctYear: number;
  laws: Law[];
  blessed: number;
  prayer: Prayer | null;
  lastWarEnd: number;
  lastCityTick: number;
  lastBoast: number;
  lastEvt: Record<string, number>;
  // recensement (recalculé à chaque tick)
  pop: number; adults: number; soldiers: number; farmers: number;
  jobs: Record<string, number>;
  avgIntel: number; avgFaith: number;
  famine: number; // années de famine consécutives
  stats: { births: number; deaths: number; kills: number; warsWon: number; warsLost: number; peakPop: number; collapses: number };
  strikes: number; // foudres reçues récemment
  tiles: number;
}

export interface City {
  id: number; civ: number; name: string; x: number; y: number;
  pop: number; cap: number; hp: number; maxHp: number; foundedYear: number; siege: number;
  hasHall: boolean;
  walls: number; // époque des remparts (-1 : aucun)
}

export interface Building {
  id: number; type: BuildingType; civ: number; city: number;
  x: number; y: number; hp: number; maxHp: number; progress: number; workers: number;
  ruin: number; // >0 : années restantes en ruine
  era: number; // époque de construction (un bâtiment garde son style historique)
  rot: number; // orientation (lacet, radians) : la façade regarde la rue
  up: number; // progression d'une modernisation (-1 : aucune)
  upTo: number; // époque visée
}

export type ArmyState = "muster" | "march" | "siege" | "retreat";
export interface Army {
  id: number; civ: number; war: number; x: number; y: number;
  soldiers: number[]; state: ArmyState; target: number; // city ciblée
  home: number; morale: number; combat: boolean; startSize: number;
  path: number[] | null; pathI: number; pathTarget: number; stuck: number; born: number;
}

export type CasusBelli = "conquest" | "resources" | "revenge" | "alliance" | "provocation" | "ego";
export interface War {
  id: number; a: number; d: number; aAllies: number[]; dAllies: number[];
  cb: CasusBelli; start: number; casA: number; casD: number; takenA: number; takenD: number;
  active: boolean; leaderName: string; reason: string; target: number; forgotten: boolean; lastBattle: number;
  civCas: number;
}

export type EventType =
  | "birth" | "war" | "peace" | "treaty" | "leader" | "catastrophe" | "miracle"
  | "discovery" | "collapse" | "absurd" | "city" | "divine" | "law";

export interface ChronicleEntry {
  id: number; tick: number; year: number; civ: number; civ2: number;
  type: EventType; text: string; consequences: string; importance: 1 | 2 | 3;
}

export interface WeatherZone { kind: "rain" | "drought"; x: number; y: number; r: number; ttl: number; }

export type FxEvent =
  | { kind: "lightning"; x: number; y: number }
  | { kind: "meteor"; x: number; y: number; r: number }
  | { kind: "rain"; x: number; y: number; r: number }
  | { kind: "plague"; x: number; y: number; r: number }
  | { kind: "bless"; x: number; y: number }
  | { kind: "wrath"; x: number; y: number; r: number }
  | { kind: "prophecy"; x: number; y: number }
  | { kind: "battle"; x: number; y: number }
  | { kind: "capture"; x: number; y: number; civ: number }
  | { kind: "fire"; x: number; y: number };
