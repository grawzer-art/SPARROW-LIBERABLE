import { TICKS_PER_YEAR } from "../sim/config";
import { TRAIT_LABEL } from "../sim/SoulSystem";
import { DOGMA_LABEL, PERSONALITY_BLURB, PERSONALITY_LABEL, PROPHECIES, STATE_LABEL, TECH_EFFECT, TECH_NAMES } from "../sim/data";
import { POWERS, POWER_BY_ID, type PowerId } from "../sim/DivinePowerSystem";
import { BUILDING_LABEL, ERA_BUILDING_NAMES } from "../sim/EconomySystem";
import { ERA_GOLD, ERA_NAMES, ERA_POP, ERA_STAB, eraOfTech, unlockedTypes } from "../sim/TechTree";
import { LAW_INFO } from "../sim/EventSystem";
import { techThreshold } from "../sim/CivilizationSystem";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { PlanetSim } from "../sim/PlanetSim";
import type { ChronicleEntry, Citizen, Civ, EventType } from "../sim/types";
import type { Renderer } from "../render/Renderer";
import { TOPIC_LABEL, type Talk } from "../sim/Talk";
import { MAX_TECH } from "../sim/config";

export interface GameHost {
  mode: "planet" | "region" | "local";
  ps: PlanetSim;
  worldChronicle(limit?: number): { region: string; entry: ChronicleEntry }[];
  sim: SimulationEngine;
  renderer: Renderer;
  save(): string;
  load(): boolean;
  newWorld(seed?: number): void;
  hasSave(): boolean;
  exportSave(): void;
  /** Retour progressif au globe (zoom arrière animé). */
  showGlobe(): void;
  /** Liste des continents (sélecteur de la vue Planète) et vol vers l'un d'eux. */
  continents(): { id: number; name: string }[];
  focusContinent(id: number): void;
  /** Vol vers un village (n'importe quelle région) : zoom continu jusqu'à la vue rapprochée. */
  observeVillage(region: number, cityId: number): void;
  /** Ferme la carte contextuelle de la vue planète (sélection). */
  clearPlanetSelection(): void;
}

export const MOBILE_Q = "(max-width: 760px), (pointer: coarse) and (max-width: 940px)";
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const FILTERS: { id: string; label: string; types: EventType[] | null }[] = [
  { id: "all", label: "Tout", types: null },
  { id: "war", label: "Guerres", types: ["war", "peace"] },
  { id: "pol", label: "Traités", types: ["treaty", "law"] },
  { id: "realm", label: "Royaumes", types: ["birth", "city", "collapse"] },
  { id: "lead", label: "Dirigeants", types: ["leader"] },
  { id: "cat", label: "Catastrophes", types: ["catastrophe"] },
  { id: "mir", label: "Miracles", types: ["miracle", "divine"] },
  { id: "dis", label: "Découvertes", types: ["discovery"] },
  { id: "abs", label: "Absurde", types: ["absurd"] },
];
const TYPE_ICON: Record<EventType, string> = {
  birth: "✧", war: "⚔", peace: "☮", treaty: "✎", leader: "♛", catastrophe: "☄", miracle: "✦", discovery: "💡", collapse: "✖", absurd: "?!", city: "⌂", divine: "ϟ", law: "§",
};
const JOB_F: Record<string, string> = { child: "Enfant", farmer: "Fermière", lumberjack: "Bûcheronne", miner: "Mineuse", builder: "Bâtisseuse", soldier: "Soldate", scholar: "Érudite" };
const JOB_M: Record<string, string> = { child: "Enfant", farmer: "Fermier", lumberjack: "Bûcheron", miner: "Mineur", builder: "Bâtisseur", soldier: "Soldat", scholar: "Érudit" };

/** Humeur lisible, déduite des besoins réels de l'habitant (aucune donnée inventée). */
export function moodOf(c: Citizen): string {
  const f = c.female, s = c.soul;
  if (c.sick > 0) return "Malade";
  if (c.hunger > 70) return f ? "Affamée" : "Affamé";
  if (c.panic > 0 || (s && s.fear > 40)) return f ? "Effrayée" : "Effrayé";
  if (s && s.fat > 80) return f ? "Épuisée" : "Épuisé";
  if (s && s.soc > 75) return f ? "Seule" : "Seul";
  if (s && s.com >= 60 && c.hunger < 40) return f ? "Heureuse" : "Heureux";
  return f ? "Sereine" : "Serein";
}
const ACT3: Record<string, string> = { "Travailler": "Travaille", "Se nourrir": "Se nourrit", "Se reposer": "Se repose", "Discuter": "Discute", "Fuir un danger": "Fuit un danger", "Flâner": "Flâne", "Attendre": "Attend" };
export const jobOf = (c: Citizen): string => (c.female ? JOB_F : JOB_M)[c.job] ?? c.job;

type CardSpec = { title: string; sub: string; color?: number; actions: { id: string; label: string; main?: boolean; cool?: boolean }[]; back?: boolean; grid?: boolean };
type Sel = { kind: "none" | "civ" | "citizen" | "city" | "building" | "talk"; id: number };

export class UI {
  private power: PowerId | null = null;
  private prophecyId = "peace";
  private filter = "all";
  private sel: Sel = { kind: "none", id: -1 };
  private bound = new WeakSet<SimulationEngine>();
  private hist: { year: number; pops: Record<number, number> }[] = [];
  private lastHistYear = -1;
  private cursor: { x: number; y: number } | null = null;
  private pending = new Set<PowerId>();
  private down: { x: number; y: number; t: number } | null = null;
  private lastHud = 0;
  private multi = false;
  private ptrs = new Set<number>();
  private follow: number | null = null;
  private tray = false;
  private sheet: "planet" | "menu" | "details" | null = null;
  private planetTab: "cont" | "civ" | "chron" = "cont";
  private menuTab: "time" | "stats" | "game" = "time";
  private influence = false;
  private talkPair: [number, number] | null = null;
  private framing: { pair: [number, number]; prev: { x: number; y: number; dist: number; el: number; az: number }; endAt: number } | null = null;
  private planetInf = false;
  private cardIsPlanet: { ref?: { region: number; id: number }; spec: CardSpec } | null = null;
  private detailRef: { sim: SimulationEngine; sel: Sel } | null = null;
  private lastSheetHtml = "";
  private snackT = 0;

  get mobile(): boolean { return window.matchMedia(MOBILE_Q).matches; }

  constructor(private game: GameHost) {
    this.bind();
    this.attach();
  }

  get sim(): SimulationEngine { return this.game.sim; }

  /** (Re)lie l'UI à une nouvelle simulation. Les événements ne sont JAMAIS affichés : ils vont dans les Chroniques. */
  attach(): void {
    this.hist = [];
    this.lastHistYear = -1;
    this.sel = { kind: "none", id: -1 };
    this.follow = null;
    this.setPower(null);
    this.closeSheet();
    this.showCard(null);
    $("h-name").textContent = this.planetName();
    this.buildTray();
    this.updateSpeed();
  }

  /** Nom de planète déterministe (graine). */
  planetName(): string {
    const seed = this.game.ps.seed >>> 0;
    const A = ["Ter", "Ael", "Nor", "Kal", "Vor", "Ily", "Mer", "Zan", "Oru", "Sel"], B = ["ra", "ion", "dal", "mara", "vek", "thas", "nea", "gol", "ria", "lun"], C = ["", "a", "is", "on", "ae", "us"];
    return A[seed % A.length] + B[(seed >>> 4) % B.length] + C[(seed >>> 9) % C.length];
  }

  // ------------------------------------------------------------ construction

  private buildTray(): void {
    const t = $("tray");
    t.innerHTML = POWERS.map((p) => `<button class="pw" data-p="${p.id}" aria-label="${esc(p.name)}"><span class="g">${p.glyph}</span><span class="n">${p.name}</span><i class="cd" style="width:0"></i></button>`).join("");
    t.querySelectorAll<HTMLButtonElement>(".pw").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.p as PowerId;
      if (this.power === id) { this.setPower(null); return; }
      if (id === "prophecy") { this.showMessages(); return; }
      this.setPower(id);
    }));
  }

  private showMessages(): void {
    const m = $("msgs");
    m.innerHTML = `<small>Quel message envoyer ?</small>` + PROPHECIES.map((p) => `<button data-m="${p.id}">${esc(p.name)}</button>`).join("");
    m.classList.remove("hidden");
    m.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { this.prophecyId = b.dataset.m!; m.classList.add("hidden"); this.setPower("prophecy"); }));
  }

  private bind(): void {
    const r = this.game.renderer;
    const el = r.three.domElement;
    // dock
    document.querySelectorAll<HTMLButtonElement>("#dock [data-d]").forEach((b) => b.addEventListener("click", () => {
      const d = b.dataset.d;
      if (d === "interact") { this.setPower(null); this.closeSheet(); this.showTray(false); this.dockOn("interact"); }
      else if (d === "powers") { this.closeSheet(); this.showTray(!this.tray); }
      else if (d === "planet") { this.showTray(false); this.setPower(null); this.openSheet("planet"); }
    }));
    $("h-info").addEventListener("click", () => { this.planetTab = "chron"; this.openSheet("planet"); });
    $("h-menu").addEventListener("click", () => { this.menuTab = "time"; this.openSheet("menu"); });
    $("armed-x").addEventListener("click", () => this.setPower(null));
    document.querySelector("#follow button")!.addEventListener("click", () => { if (this.follow !== null) { const sim = this.sim; this.detailRef = { sim, sel: { kind: "citizen", id: this.follow } }; this.openSheet("details"); } });
    document.querySelector("#follow .fx")!.addEventListener("click", () => { this.follow = null; this.refreshCardIfAny(); });
    document.querySelector("#card .cx")!.addEventListener("click", () => { if (this.planetInf && this.cardIsPlanet) { this.planetInf = false; this.showCard(this.cardIsPlanet.spec); } else if (this.influence) { this.influence = false; this.refreshCard(); } else this.dismissSelection(); });
    document.querySelector("#sheet .sx")!.addEventListener("click", () => this.closeSheet());
    this.bindSheetDrag($("sheet"), () => this.closeSheet());
    // Safari iOS : pas de zoom de page ni de menu contextuel sur la carte
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault());
    el.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    // carte (scène locale)
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      if (this.game.mode !== "local") return;
      this.ptrs.add(e.pointerId);
      if (this.ptrs.size > 1) this.multi = true;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (e.pointerType !== "mouse" && this.power && this.ptrs.size === 1) {
        const g = r.pickGround(e.clientX, e.clientY);
        if (g) { this.cursor = g; this.updateCursor(); }
      }
    });
    const release = (e: PointerEvent, click: boolean) => {
      if (this.game.mode !== "local") { this.ptrs.clear(); this.down = null; return; }
      this.ptrs.delete(e.pointerId);
      const d = this.down;
      if (this.ptrs.size > 0) return;
      const wasMulti = this.multi;
      this.multi = false; this.down = null;
      if (!click || !d || wasMulti || e.button > 0) return;
      const slop = e.pointerType === "mouse" ? 6 : 12;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > slop || performance.now() - d.t > 500) { if (this.power) r.setCursor(0, 0, 0, null); return; }
      const g = r.pickGround(e.clientX, e.clientY);
      if (g) this.onMapClick(g.x, g.y, e.pointerType);
    };
    el.addEventListener("pointerup", (e) => release(e, true));
    el.addEventListener("pointercancel", (e) => release(e, false));
    el.addEventListener("pointermove", (e) => {
      if (this.game.mode !== "local") return;
      // un glissement de la vue interrompt le suivi d'un habitant
      if (this.down && Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 10) { this.follow = null; this.framing = null; }
      if (e.pointerType === "touch" || e.pointerType === "pen" && this.mobile) return;
      const g = r.pickGround(e.clientX, e.clientY);
      this.cursor = g;
      this.updateCursor();
    });
    el.addEventListener("pointerleave", () => { this.cursor = null; r.setCursor(0, 0, 0, null); });
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") { this.setPower(null); this.closeSheet(); this.dismissSelection(); }
      else if (e.key === " ") { e.preventDefault(); this.togglePause(); }
      else if (e.key === "1") this.setSpeed(1);
      else if (e.key === "2") this.setSpeed(3);
      else if (e.key === "3") this.setSpeed(10);
    });
  }

  private dockOn(d: string): void { document.querySelectorAll<HTMLButtonElement>("#dock [data-d]").forEach((b) => b.classList.toggle("on", b.dataset.d === d)); }

  private showTray(on: boolean): void {
    this.tray = on;
    if (on) this.dismissSelection(); // le plateau de pouvoirs prend la place de la carte
    $("tray").classList.toggle("hidden", !on);
    if (!on) $("msgs").classList.add("hidden");
    this.dockOn(on ? "powers" : this.sheet === "planet" ? "planet" : "interact");
    this.syncInset();
  }

  /** Recentre la scène dans la zone visible au-dessus des panneaux. */
  private syncInset(): void {
    const r = this.game.renderer;
    let px = 0;
    if (this.sheet) { const rect = $("sheet").getBoundingClientRect(); px = Math.max(0, window.innerHeight - rect.top); }
    else if (!$("card").classList.contains("hidden")) px = 150;
    else if (this.tray) px = 110;
    r.setBottomInset(px);
  }

  // ------------------------------------------------------------ temps

  private togglePause(): void { this.sim.paused = !this.sim.paused; this.updateSpeed(); }
  private setSpeed(n: number): void { this.sim.speed = n; this.sim.paused = false; this.updateSpeed(); }
  private updateSpeed(): void {
    const s = this.sim;
    $("h-speed").textContent = s.paused ? "❚❚" : s.speed === 1 ? "▶" : "×" + s.speed;
    document.querySelectorAll<HTMLButtonElement>("#sheet [data-speed]").forEach((b) => b.classList.toggle("on", !s.paused && Number(b.dataset.speed) === s.speed));
    document.querySelectorAll<HTMLButtonElement>("#sheet [data-pause]").forEach((b) => b.classList.toggle("on", s.paused));
  }

  // ------------------------------------------------------------ pouvoirs

  setPower(p: PowerId | null): void {
    this.power = p;
    document.querySelectorAll<HTMLButtonElement>(".pw").forEach((b) => b.classList.toggle("sel", b.dataset.p === p));
    $("armed").classList.toggle("hidden", !p);
    $("app").classList.toggle("armed", !!p);
    if (p) {
      const info = POWER_BY_ID[p];
      const where = this.game.mode === "local" ? (info.target === "civ" ? "touchez un territoire" : "touchez le monde") : "touchez un village";
      $("armed-g").textContent = info.glyph;
      const msg = p === "prophecy" ? ` « ${PROPHECIES.find((m) => m.id === this.prophecyId)?.name ?? ""} »` : "";
      $("armed-t").textContent = `${info.name}${msg} · ${where}`;
      this.showCard(null);
    } else this.game.renderer.setCursor(0, 0, 0, null);
    this.updateCursor();
    this.syncInset();
  }

  private updateCursor(): void {
    const r = this.game.renderer;
    if (!this.power || !this.cursor) { r.setCursor(0, 0, 0, null); return; }
    const info = POWER_BY_ID[this.power];
    if (info.target === "civ") {
      const civ = this.sim.divine.civAt(this.sim, this.cursor.x, this.cursor.y);
      const cap = civ ? this.sim.cityById.get(civ.capital) : null;
      if (civ && cap) r.setCursor(cap.x + 0.5, cap.y + 0.5, 2.6, civ.color);
      else r.setCursor(this.cursor.x, this.cursor.y, 0.7, 0x888888);
    } else {
      const col = ({ lightning: 0xbcd8ff, fire: 0xff9a4a, meteor: 0xff8a4a, rain: 0x8fc5ff, plague: 0x9be04a, wrath: 0xff5a3a } as Record<string, number>)[this.power as string] ?? 0xffffff;
      r.setCursor(this.cursor.x, this.cursor.y, info.radius, col);
    }
  }

  /** Lance le pouvoir armé sur un moteur donné, à une position (scène locale ou village touché depuis le globe). */
  private cast(sim: SimulationEngine, p: PowerId, x: number, y: number, civ?: number): void {
    if (this.pending.has(p)) return;
    const cd = sim.divine.cooldownLeft(sim, p);
    if (cd > 0) { this.snack(`${POWER_BY_ID[p].name} : encore ${Math.ceil(cd / TICKS_PER_YEAR)} an(s) de repos divin.`); return; }
    const run = () => {
      this.pending.delete(p);
      const res = sim.divine.cast(sim, p, x, y, { prophecy: this.prophecyId, civ });
      this.snack(res.msg);
      if (this.game.mode === "local") this.game.renderer.setCursor(0, 0, 0, null);
    };
    if (p === "meteor" && sim === this.sim && this.game.mode === "local") {
      this.pending.add(p);
      this.game.renderer.fx.meteorIncoming(x, y, sim.world.size, sim.world, run);
    } else run();
  }

  /** Un village a été touché sur le globe/la région : si un pouvoir est armé, il s'y applique directement. */
  villageTap(regionId: number, cityId: number): boolean {
    if (!this.power) return false;
    const eng = this.game.ps.engineOf(regionId);
    const city = eng?.cityById.get(cityId);
    if (!eng || !city) return false;
    this.cast(eng, this.power, city.x + 0.5, city.y + 0.5, city.civ);
    return true;
  }

  private onMapClick(x: number, y: number, pointer = "mouse"): void {
    if (this.power) { this.cast(this.sim, this.power, x, y); return; }
    void pointer;
    this.selectAt(x, y, pointer !== "mouse");
  }

  // ------------------------------------------------------------ sélection et carte contextuelle

  private selectAt(x: number, y: number, touch = false): void {
    const sim = this.sim;
    const k = touch ? 1.7 : 1;
    let best: { d: number; kind: "citizen" | "building" | "city"; id: number } | null = null;
    for (const c of sim.citizens) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < 0.9 * k && (!best || d < best.d)) best = { d, kind: "citizen", id: c.id };
    }
    if (!best) {
      for (const c of sim.cities) {
        const d = Math.hypot(c.x + 0.5 - x, c.y + 0.5 - y);
        if (d < 1.3 * k + (touch ? 0.6 : 0) && (!best || d < best.d)) best = { d, kind: "city", id: c.id };
      }
    }
    if (!best) {
      const i = sim.world.tileAt(x, y);
      if (i >= 0 && sim.world.bld[i] >= 0) best = { d: 0, kind: "building", id: sim.world.bld[i] };
    }
    if (best && best.kind === "citizen") {
      const c = sim.citizenById.get(best.id), tk = c ? sim.talk.of(c) : undefined;
      if (tk) { this.select("citizen", best.id); this.talkPair = [tk.talk.a, tk.talk.b]; this.refreshCard(); return; } // toucher quelqu'un qui parle : on touche la conversation
    }
    if (best) this.select(best.kind, best.id);
    else {
      const civ = sim.divine.civAt(sim, x, y);
      if (civ && sim.world.owner[sim.world.tileAt(x, y)] === civ.id) this.select("civ", civ.id);
      else this.select("none", -1);
    }
  }

  select(kind: Sel["kind"], id: number): void {
    this.sel = { kind, id };
    this.talkPair = null;
    this.game.renderer.selection = { kind: kind === "talk" ? "citizen" : kind, id };
    this.influence = false;
    if (kind === "none") { this.game.renderer.clearSelection(); this.follow = null; this.showCard(null); return; }
    if (this.tray) this.showTray(false);
    this.refreshCard();
  }

  private dismissSelection(): void {
    if (this.cardIsPlanet) this.game.clearPlanetSelection();
    this.influence = false;
    this.cardIsPlanet = null;
    if (this.sel.kind !== "none") this.select("none", -1); else this.showCard(null);
  }

  /** Carte d'une sélection en scène locale. */
  private specFor(sim: SimulationEngine, s: Sel): CardSpec | null {
    if (s.kind === "citizen" && this.talkPair && !this.influence) { const ts = this.talkSpec(sim); if (ts) return ts; }
    if (s.kind === "citizen") {
      const c = sim.citizenById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (!c || c.dead) return null;
      const act = c.soul ? (ACT3[sim.soul.explain(c).action] ?? sim.soul.explain(c).action) : STATE_LABEL[c.state] ?? c.state;
      if (this.influence) {
        const cool = (k: string) => (sim.cooldowns["inf_" + k] ?? 0) > sim.tick;
        const g = (k: string) => sim.divine.gate(sim, k) > 0;
        return { title: c.name, sub: "Que lui accorder ?", color: civ?.color, back: true, grid: true, actions: [
          { id: "inf:dream", label: "☾ Rêve", cool: g("dream") }, { id: "inf:bond", label: "♥ Rapprocher", cool: g("bond") }, { id: "inf:inspire", label: "💡 Inspirer", cool: cool("inspire") },
          { id: "inf:bless", label: "✦ Bénir", cool: cool("bless") }, { id: "inf:heal", label: "✚ Guérir", cool: cool("heal") }, { id: "inf:smite", label: "ϟ Foudroyer", cool: cool("smite") }] };
      }
      const d = sim.mind.describe(sim, c);
      const intent = d.intent !== "Reste et vit sa vie" ? `<br><em>${esc(d.intent)}</em>` : "";
      return { title: `${c.name} — ${Math.floor(c.age)} ans`, sub: `${jobOf(c)} · ${moodOf(c)} · ${act}${intent}<br><span class="thought">« ${esc(d.thought)} »</span>`, color: civ?.color,
        actions: [{ id: "observe", label: this.follow === c.id ? "Suivi ✓" : "Suivre", main: true }, { id: "influence", label: "Influencer" }, { id: "details", label: "Détails" }] };
    }
    if (s.kind === "city") {
      const c = sim.cityById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (!c || !civ) return null;
      const sites = sim.buildings.filter((b) => b.city === c.id && b.progress < 1 && b.civ >= 0).length;
      const state = c.siege > 0 ? "assiégée" : sim.world.fire.some((f, i) => f > 0 && sim.world.bld[i] >= 0 && sim.buildingById.get(sim.world.bld[i])?.city === c.id) ? "en proie aux flammes" : sites > 2 ? "en plein chantier" : "paisible";
      if (this.influence) return this.civInfluenceSpec(sim, civ, c.name);
      return { title: c.name, sub: `${civ.name}${civ.capital === c.id ? " · capitale" : ""} · ${c.pop} habitants<br>Village ${state}`, color: civ.color,
        actions: [{ id: "observe", label: "Observer", main: true }, { id: "influence", label: "Influencer" }, { id: "details", label: "Détails" }] };
    }
    if (s.kind === "civ") {
      const civ = sim.civById.get(s.id);
      if (!civ) return null;
      if (this.influence) return this.civInfluenceSpec(sim, civ, civ.formal);
      return { title: civ.formal, sub: `${civ.pop} habitants · ${ERA_NAMES[civ.era]} · ${PERSONALITY_LABEL[civ.personality]}`, color: civ.color,
        actions: [{ id: "observe", label: "Observer", main: true }, { id: "influence", label: "Influencer" }, { id: "details", label: "Détails" }] };
    }
    if (s.kind === "building") {
      const b = sim.buildingById.get(s.id);
      if (!b) return null;
      const civ = sim.civById.get(b.civ);
      const label = ERA_BUILDING_NAMES[b.type]?.[Math.min(5, b.era)] ?? BUILDING_LABEL[b.type];
      return { title: label, sub: civ ? `${esc(civ.name)} · ${ERA_NAMES[b.era]}` : "Ruines abandonnées", color: civ?.color, actions: [{ id: "details", label: "Détails", main: true }] };
    }
    return null;
  }

  /** Carte d'une conversation : ce qui se dit, sur quoi, sur quel ton. Les répliques se lisent à la demande (jamais en bulles permanentes). */
  private talkSpec(sim: SimulationEngine): CardSpec | null {
    const [a, b] = this.talkPair!;
    const A = sim.citizenById.get(a), B = sim.citizenById.get(b);
    if (!A || !B) return null;
    const tk = sim.talk.get(a, b);
    if (!tk) { this.talkPair = null; return null; }
    const last = tk.lines.slice(-2).map((l) => `<em>${esc(sim.citizenById.get(l.who)?.name ?? "?")}</em> : « ${esc(l.text)} »`).join("<br>");
    const ton = ["tranquille", "tendu", "chaleureux"][tk.mood];
    return { title: `${A.name} et ${B.name}`, sub: `${TOPIC_LABEL[tk.topic]} · ton ${ton}${tk.over ? " · terminée" : ""}<br>${last || "…"}${tk.effect ? `<br><span class="thought">${esc(tk.effect)}</span>` : ""}`, color: sim.civById.get(A.civ)?.color,
      actions: [{ id: "talk:frame", label: this.framing ? "Caméra libre" : "Écouter", main: true }, { id: "talk:log", label: "Échanges" }, { id: "details", label: "Détails" }] };
  }

  /** Cadrage automatique et discret d'une conversation : la caméra se rapproche, se met de profil, suit les interlocuteurs, puis revient à sa place. */
  private frameTalk(on: boolean): void {
    const r = this.game.renderer;
    if (!on) { if (this.framing) { const f = this.framing; this.framing = null; r.setPose(f.prev.x, f.prev.y, f.prev.dist, f.prev.el, f.prev.az); } return; }
    if (!this.talkPair) return;
    this.framing = { pair: this.talkPair, prev: r.getPose(), endAt: 0 };
  }
  private framingStep(dt: number): void {
    const f = this.framing; if (!f) return;
    const sim = this.sim, r = this.game.renderer;
    const A = sim.citizenById.get(f.pair[0]), B = sim.citizenById.get(f.pair[1]);
    const tk = sim.talk.get(f.pair[0], f.pair[1]);
    if (!A || !B || A.dead || B.dead) { this.framing = null; return; }
    if (tk && !tk.over) f.endAt = 0; else if (!f.endAt) f.endAt = performance.now() + 1800;
    if (f.endAt && performance.now() > f.endAt) { // la conversation est finie : retour fluide à la vue précédente, puis caméra libre
      const p = f.prev; r.glide(p.x, p.y, p.dist, p.el, p.az, Math.min(1, dt * 2.5));
      const c = r.getPose();
      if (Math.hypot(c.x - p.x, c.y - p.y) < 0.4 && Math.abs(c.dist - p.dist) < 0.5) this.framing = null;
      return;
    }
    const mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2;
    const ax = Math.atan2(B.y - A.y, B.x - A.x), cur = r.getPose();
    // de profil : la caméra se place perpendiculairement à l'axe des deux visages, du côté où elle se trouve déjà
    const opts = [ax + Math.PI / 2, ax - Math.PI / 2];
    const diff = (u: number) => Math.abs(Math.atan2(Math.sin(u - cur.az), Math.cos(u - cur.az)));
    const az = diff(opts[0]) < diff(opts[1]) ? opts[0] : opts[1];
    r.glide(mx, my, 5.8, 0.46, az, Math.min(1, dt * 2.2));
  }

  /** Interventions sur une civilisation / un village : foi, découverte, protection, châtiment, dirigeant, bénédiction. */
  private civInfluenceSpec(sim: SimulationEngine, civ: Civ, title: string): CardSpec {
    const g = (k: string) => sim.divine.gate(sim, k + "_" + civ.id) > 0;
    return { title, sub: `${esc(civ.name)} : que lui accorder ?`, color: civ.color, back: true, grid: true, actions: [
      { id: "civ:faith", label: "☼ Foi", cool: g("faith") }, { id: "civ:inspire", label: "💡 Découverte", cool: g("inspire") }, { id: "civ:leader", label: "♛ Dirigeant" },
      { id: "civ:protect", label: "⛨ Protéger", cool: g("protect") }, { id: "civ:punish", label: "☄ Punir", cool: g("punish") }, { id: "civ:bless", label: "✦ Bénir", cool: sim.divine.cooldownLeft(sim, "bless") > 0 }] };
  }

  /** Mini-menu de choix (messages de rêve, attitudes du dirigeant). */
  private choose(title: string, items: { id: string; label: string }[], pick: (id: string) => void): void {
    const m = $("msgs");
    m.innerHTML = `<small>${esc(title)}</small>` + items.map((it) => `<button data-m="${it.id}">${esc(it.label)}</button>`).join("");
    m.classList.remove("hidden");
    m.querySelectorAll<HTMLButtonElement>("button").forEach((b) => b.addEventListener("click", () => { m.classList.add("hidden"); pick(b.dataset.m!); }));
  }

  private refreshCard(): void {
    const spec = this.specFor(this.sim, this.sel);
    if (!spec) { this.showCard(null); return; }
    this.cardIsPlanet = null;
    this.showCard(spec);
  }

  /** Carte posée par la vue planète (village, continent, lieu). */
  setPlanetCard(spec: CardSpec | null, ref?: { region: number; id: number }): void {
    if (!spec) { if (this.cardIsPlanet) { this.cardIsPlanet = null; this.showCard(null); } return; }
    this.cardIsPlanet = { spec, ref };
    if (this.tray && !ref) this.showTray(false);
    this.showCard(spec);
  }

  private showCard(spec: CardSpec | null): void {
    const card = $("card");
    document.body.classList.toggle("card-open", !!spec);
    if (!spec) { card.classList.add("hidden"); this.syncInset(); return; }
    $("c-title").textContent = spec.title;
    $("c-sub").innerHTML = spec.sub;
    const dot = $("c-dot"); dot.style.background = spec.color !== undefined ? hex(spec.color) : "#ffe2a8"; dot.style.display = "block";
    const acts = $("c-actions"); acts.textContent = ""; acts.classList.toggle("grid", !!spec.grid);
    for (const a of spec.actions) {
      const b = document.createElement("button");
      b.textContent = a.label; if (a.main) b.className = "main"; if (a.cool) b.classList.add("cool");
      b.addEventListener("click", () => this.cardAction(a.id));
      acts.appendChild(b);
    }
    card.classList.remove("hidden");
    this.syncInset();
  }

  private cardAction(id: string): void {
    if (this.cardIsPlanet) { this.planetCardAction(id); return; }
    const sim = this.sim, s = this.sel;
    if (id === "talk:frame") { this.frameTalk(!this.framing); this.refreshCard(); return; }
    if (id === "talk:log" && this.talkPair) { this.detailRef = { sim, sel: { kind: "talk", id: this.talkPair[0] } }; this.openSheet("details"); return; }
    if (id === "influence") { this.influence = true; this.refreshCard(); return; }
    if (id.startsWith("inf:") || id.startsWith("civ:")) { this.divineAction(sim, id, s); return; }
    if (id === "observe") {
      if (s.kind === "citizen") {
        if (this.follow === s.id) { this.follow = null; this.snack("Vous ne suivez plus cet habitant."); }
        else { this.follow = s.id; const c = sim.citizenById.get(s.id); if (c) this.game.renderer.focusOn(c.x, c.y, 11); this.snack("Vous suivez cet habitant pendant sa vie."); }
        this.refreshCard();
      } else if (s.kind === "city" || s.kind === "civ") {
        const city = s.kind === "city" ? sim.cityById.get(s.id) : sim.cityById.get(sim.civById.get(s.id)?.capital ?? -1);
        if (city) this.game.renderer.focusOn(city.x + 0.5, city.y + 0.5, 22);
      }
      return;
    }
    if (id === "details") { this.detailRef = { sim, sel: { ...s } }; this.openSheet("details"); }
  }

  /** Interventions divines depuis une carte : individu (`inf:`) ou civilisation (`civ:`). Le résultat vient de la simulation. */
  private divineAction(sim: SimulationEngine, id: string, s: Sel): void {
    const d = sim.divine, k = id.slice(4);
    const civId = s.kind === "city" ? sim.cityById.get(s.id)?.civ : s.kind === "civ" ? s.id : undefined;
    const done = (res: { ok: boolean; msg: string }, close = true) => {
      this.snack(res.msg);
      if (res.ok && close) this.influence = false;
      if (res.ok) { const c = s.kind === "citizen" ? sim.citizenById.get(s.id) : undefined; if (c) this.game.renderer.fx.handle({ kind: "bless", x: c.x, y: c.y }, sim, this.game.renderer); }
      if (this.cardIsPlanet) { this.planetInf = false; this.showCard(this.cardIsPlanet.spec); } else this.refreshCard();
    };
    if (id.startsWith("inf:")) {
      if (k === "dream") { this.choose("Quel rêve envoyer ?", [{ id: "hope", label: "« Tout ira mieux. »" }, { id: "flee", label: "« Quitte ce lieu. »" }, { id: "doubt", label: "« Ton chef te ment. »" }, { id: "bond", label: "« Tu n'es pas seul(e). »" }], (m) => done(d.dream(sim, s.id, m as "hope" | "flee" | "doubt" | "bond"))); return; }
      if (k === "bond") { done(d.favorBond(sim, s.id)); return; }
      done(d.influence(sim, s.id, k as "bless" | "heal" | "inspire" | "smite"));
      return;
    }
    if (civId === undefined) return;
    if (k === "leader") { this.choose("Souffler au dirigeant…", [{ id: "peace", label: "La paix" }, { id: "war", label: "La guerre" }, { id: "generosity", label: "La générosité" }], (m) => done(d.influenceLeader(sim, civId, m as "peace" | "war" | "generosity"))); return; }
    if (k === "faith") done(d.encourageFaith(sim, civId));
    else if (k === "inspire") done(d.inspireDiscovery(sim, civId));
    else if (k === "protect") done(d.protect(sim, civId));
    else if (k === "punish") done(d.punish(sim, civId));
    else if (k === "bless") done(d.cast(sim, "bless", 0, 0, { civ: civId }));
  }

  private planetCardAction(id: string): void {
    const pc = this.cardIsPlanet!;
    const ref = pc.ref;
    if (ref) {
      const eng = this.game.ps.engineOf(ref.region), city = eng?.cityById.get(ref.id), civ = city ? eng!.civById.get(city.civ) : undefined;
      if (eng && city && civ) {
        if (id === "influence") { this.planetInf = true; this.showCard(this.civInfluenceSpec(eng, civ, city.name)); return; }
        if (id.startsWith("civ:")) { this.divineAction(eng, id, { kind: "city", id: ref.id }); this.planetInf = false; this.showCard(pc.spec); return; }
        if (id === "details") { this.detailRef = { sim: eng, sel: { kind: "city", id: ref.id } }; this.openSheet("details"); return; }
        if (id === "observe") { this.game.observeVillage(ref.region, ref.id); return; }
      }
    }
    this.onPlanetAction?.(id);
  }
  /** Branché par Game : actions « zoom » / « enter » de la vue planète. */
  onPlanetAction?: (id: string) => void;

  /** Appelé à chaque frame. */
  frame(): void {
    const sim = this.sim, r = this.game.renderer;
    const s = this.sel;
    if (this.game.mode === "local") {
      if (s.kind === "citizen") {
        const c = sim.citizenById.get(s.id);
        if (c && !c.dead) {
          const civ = sim.civById.get(c.civ); r.setSelectionRing(c.x, c.y, 0.5, civ?.color ?? 0xffffff);
          if (this.follow === s.id) r.focusOn(c.x, c.y, Math.min(14, r.getPose().dist), false);
        } else this.select("none", -1);
      } else if (s.kind === "civ") {
        const civ = sim.civById.get(s.id);
        const cap = civ ? sim.cityById.get(civ.capital) ?? sim.cities.find((c) => c.civ === civ.id) : null;
        if (civ && cap) r.setSelectionRing(cap.x + 0.5, cap.y + 0.5, 2.2, civ.color); else r.clearSelection();
      } else if (s.kind === "city") {
        const c = sim.cityById.get(s.id);
        if (c) r.setSelectionRing(c.x + 0.5, c.y + 0.5, 1.4, sim.civById.get(c.civ)?.color ?? 0xffffff); else this.select("none", -1);
      } else if (s.kind === "building") {
        const b = sim.buildingById.get(s.id);
        if (b && b.hp >= 0) r.setSelectionRing(b.x + 0.5, b.y + 0.5, 0.7, sim.civById.get(b.civ)?.color ?? 0xaaaaaa); else this.select("none", -1);
      }
    }
    this.followPill();
    this.bubble();
    this.framingStep(Math.min(0.1, (performance.now() - (this.lastFrameT || performance.now())) / 1000)); this.lastFrameT = performance.now();
    const now = performance.now();
    if (now - this.lastHud > 250) { this.lastHud = now; this.hud(); }
  }

  private hud(): void {
    const sim = this.sim;
    const world = this.game.mode !== "local", tot = this.game.ps.totals();
    $("h-year").textContent = String(sim.year);
    $("h-pop").textContent = String(tot.population);
    void world;
    document.querySelectorAll<HTMLButtonElement>(".pw").forEach((b) => {
      const p = b.dataset.p as PowerId;
      const left = sim.divine.cooldownLeft(sim, p);
      b.classList.toggle("cool", left > 0);
      (b.querySelector(".cd") as HTMLElement).style.width = left > 0 ? `${Math.min(100, (left / POWER_BY_ID[p].cooldown) * 100)}%` : "0";
    });
    if (sim.year !== this.lastHistYear) {
      this.lastHistYear = sim.year;
      const pops: Record<number, number> = {};
      for (const c of sim.civs) pops[c.id] = c.pop;
      this.hist.push({ year: sim.year, pops });
      if (this.hist.length > 600) this.hist.shift();
    }
    // la fiche de l'habitant suit ses besoins ; le panneau Détails reste à jour
    if (!this.cardIsPlanet && this.sel.kind !== "none" && !this.influence) this.refreshCardText();
    if (this.sheet === "details") this.renderSheet();
    this.updateSpeed();
  }

  /** Bulle d'intention au-dessus de l'habitant sélectionné ou suivi : on voit d'un coup d'œil ce qu'il compte faire. */
  private bubble(): void {
    const el = document.getElementById("bubble");
    if (!el) return;
    const id = this.sel.kind === "citizen" ? this.sel.id : this.follow;
    const c = id !== null && this.game.mode === "local" ? this.sim.citizenById.get(id) : undefined;
    if (!c || c.dead || this.sheet) { if (!el.classList.contains("hidden")) el.classList.add("hidden"); return; }
    const m = c.mind, g = m?.goal ?? 0;
    const ico = c.panic > 0 ? "😨" : c.sick > 0 ? "🤒" : g === 1 ? "🧳" : g === 3 ? "✊" : g === 4 ? "😠" : g === 2 ? "💞" : g === 5 ? "🙏" : c.state === "talk" ? "💬" : c.state === "rest" ? "💤" : c.state === "eat" || c.state === "forage" ? "🍞" : c.state === "mate" ? "❤️" : c.hunger > 70 ? "🍽" : "💭";
    const p = this.game.renderer.screenOf(c.x, c.y);
    if (!p) { el.classList.add("hidden"); return; }
    if (el.textContent !== ico) el.textContent = ico;
    el.classList.remove("hidden");
    el.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  }

  private lastFrameT = 0;
  private followName = "";
  /** Pastille « Suivi » : un habitant suivi pendant sa vie ; sa mort est annoncée discrètement. */
  private followPill(): void {
    const el = document.getElementById("follow");
    if (!el) return;
    if (this.follow === null) { if (!el.classList.contains("hidden")) el.classList.add("hidden"); return; }
    const c = this.sim.citizenById.get(this.follow);
    if (!c || c.dead) {
      this.snack(`${this.followName || "L'habitant suivi"} est mort(e). Sa vie est dans les Chroniques.`);
      this.follow = null; el.classList.add("hidden"); return;
    }
    this.followName = c.name;
    const t = `Suivi · ${c.name}`;
    if (el.classList.contains("hidden")) el.classList.remove("hidden");
    if (el.firstElementChild!.textContent !== t) el.firstElementChild!.textContent = t;
  }

  private refreshCardText(): void {
    const spec = this.specFor(this.sim, this.sel);
    if (!spec) return;
    if ($("c-title").textContent !== spec.title) $("c-title").textContent = spec.title;
    if ($("c-sub").innerHTML !== spec.sub) $("c-sub").innerHTML = spec.sub;
  }

  // ------------------------------------------------------------ panneaux coulissants

  openSheet(n: "planet" | "menu" | "details"): void {
    this.showTray(false);
    this.showCard(null);
    this.sheet = n;
    const el = $("sheet");
    el.style.transform = ""; el.classList.remove("hidden");
    el.style.animation = "none"; void el.offsetWidth; el.style.animation = "";
    document.body.classList.add("sheet-open");
    this.dockOn(n === "planet" ? "planet" : "interact");
    this.lastSheetHtml = "";
    this.renderSheet();
    this.syncInset();
  }

  closeSheet(): void {
    if (!this.sheet) return;
    const wasDetails = this.sheet === "details";
    this.sheet = null;
    $("sheet").classList.add("hidden");
    document.body.classList.remove("sheet-open");
    this.dockOn(this.tray ? "powers" : "interact");
    if (wasDetails) this.refreshCardIfAny();
    this.syncInset();
  }

  private refreshCardIfAny(): void {
    if (this.cardIsPlanet) this.showCard(this.cardIsPlanet.spec);
    else if (this.sel.kind !== "none") this.refreshCard();
  }

  private renderSheet(): void {
    const body = $("sheet-body");
    let title = "", html = "";
    if (this.sheet === "details") {
      const d = this.detailRef;
      if (!d) { this.closeSheet(); return; }
      const r = this.detailsHtml(d.sim, d.sel);
      title = r.title; html = r.html;
      if (!r.html) { this.closeSheet(); return; }
    } else if (this.sheet === "planet") { title = this.planetName(); html = this.planetHtml(); }
    else if (this.sheet === "menu") { title = "Temps et réglages"; html = this.menuHtml(); }
    $("sheet-t").textContent = title;
    if (html === this.lastSheetHtml) return;
    this.lastSheetHtml = html;
    const top = body.scrollTop;
    body.innerHTML = html;
    body.scrollTop = top;
    this.bindSheet();
    if (this.sheet === "menu" && this.menuTab === "stats") this.drawChart();
  }

  private bindSheet(): void {
    const body = $("sheet-body");
    body.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((b) => b.addEventListener("click", () => {
      const t = b.dataset.tab!;
      if (this.sheet === "planet") this.planetTab = t as "cont" | "civ" | "chron"; else this.menuTab = t as "time" | "stats" | "game";
      this.lastSheetHtml = ""; this.renderSheet();
    }));
    body.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach((b) => b.addEventListener("click", () => { this.filter = b.dataset.filter!; this.lastSheetHtml = ""; this.renderSheet(); }));
    body.querySelectorAll<HTMLButtonElement>("[data-speed]").forEach((b) => b.addEventListener("click", () => { this.setSpeed(Number(b.dataset.speed)); }));
    body.querySelectorAll<HTMLButtonElement>("[data-pause]").forEach((b) => b.addEventListener("click", () => this.togglePause()));
    body.querySelectorAll<HTMLButtonElement>("[data-cont]").forEach((b) => b.addEventListener("click", () => { this.closeSheet(); this.game.focusContinent(Number(b.dataset.cont)); }));
    body.querySelectorAll<HTMLButtonElement>("[data-globe]").forEach((b) => b.addEventListener("click", () => { this.closeSheet(); this.game.showGlobe(); }));
    body.querySelectorAll<HTMLButtonElement>("[data-civgo]").forEach((b) => b.addEventListener("click", () => {
      const [reg, id] = b.dataset.civgo!.split(":").map(Number);
      this.closeSheet();
      const eng = this.game.ps.engineOf(reg), civ = eng?.civById.get(id), cap = civ ? eng!.cityById.get(civ.capital) ?? eng!.cities.find((c) => c.civ === id) : null;
      if (cap) this.game.observeVillage(reg, cap.id);
    }));
    body.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => {
      const [k, id] = b.dataset.go!.split(":");
      if (this.detailRef) { this.detailRef = { sim: this.detailRef.sim, sel: { kind: k as Sel["kind"], id: Number(id) } }; this.lastSheetHtml = ""; this.renderSheet(); }
    }));
    const act = (id: string, f: () => void) => { const e = body.querySelector<HTMLElement>("#" + id); if (e) e.addEventListener("click", f); };
    act("m-save", () => this.snack(this.game.save()));
    act("m-load", () => { if (this.game.load()) this.closeSheet(); });
    act("m-export", () => this.game.exportSave());
    act("m-new", () => { const v = (body.querySelector("#m-seed") as HTMLInputElement).value.trim(); this.closeSheet(); this.game.newWorld(v ? Number(v.replace(/\D/g, "")) || undefined : undefined); });
  }

  private tabs(list: [string, string][], cur: string): string {
    return `<div class="tabs2">${list.map(([id, l]) => `<button data-tab="${id}" class="${id === cur ? "on" : ""}">${l}</button>`).join("")}</div>`;
  }

  private planetHtml(): string {
    const ps = this.game.ps;
    let h = this.tabs([["cont", "Continents"], ["civ", "Peuples"], ["chron", "Chroniques"]], this.planetTab);
    if (this.planetTab === "cont") {
      h += `<div class="btns"><button class="pri" data-globe="1">Voir le globe</button></div><div class="lst">` +
        this.game.continents().map((c) => `<button class="row2" data-cont="${c.id}"><span><b>${esc(c.name)}</b></span><span class="go">›</span></button>`).join("") + `</div>`;
    } else if (this.planetTab === "civ") {
      h += `<div class="lst">`;
      const rows: { reg: number; civ: Civ }[] = [];
      for (const [reg, e] of ps.engines) for (const c of e.civs) rows.push({ reg, civ: c });
      rows.sort((a, b) => Number(b.civ.alive) - Number(a.civ.alive) || b.civ.pop - a.civ.pop);
      h += rows.map(({ reg, civ: c }) => `<button class="row2" data-civgo="${reg}:${c.id}" style="${c.alive ? "" : "opacity:.45"}"><i class="sw" style="background:${hex(c.color)}"></i><span><b>${esc(c.name)}${c.alive ? "" : " †"}</b><small>${c.alive ? `${c.pop} hab. · ${PERSONALITY_LABEL[c.personality]} · ${ERA_NAMES[c.era]}` : `Disparue en l'an ${c.extinctYear}`}</small></span><span class="go">›</span></button>`).join("") || `<div class="law">Personne.</div>`;
      h += `</div>`;
    } else {
      h += `<div class="chipsrow">${FILTERS.map((f) => `<button data-filter="${f.id}" class="${f.id === this.filter ? "on" : ""}">${f.label}</button>`).join("")}</div>`;
      const f = FILTERS.find((x) => x.id === this.filter)!;
      const rows = this.game.worldChronicle(120).filter(({ entry: e }) => !f.types || f.types.includes(e.type));
      h += rows.map(({ region, entry: e }) => `<div class="ev i${e.importance} type-${e.type}"><div class="y">An ${e.year}</div><div><div class="t"><b style="color:var(--warm)">${esc(region)}</b> — ${esc(e.text)}</div>${e.consequences ? `<div class="c">${TYPE_ICON[e.type]} ${esc(e.consequences)}</div>` : ""}</div></div>`).join("") || `<div class="law" style="padding:10px 0">Rien à signaler. Ce qui, en histoire, est toujours suspect.</div>`;
    }
    return h;
  }

  private menuHtml(): string {
    let h = this.tabs([["time", "Temps"], ["stats", "Statistiques"], ["game", "Partie"]], this.menuTab);
    const s = this.sim;
    if (this.menuTab === "time") {
      h += `<div class="seg"><button data-pause="1" class="${s.paused ? "on" : ""}">❚❚</button><button data-speed="1" class="${!s.paused && s.speed === 1 ? "on" : ""}">×1</button><button data-speed="3" class="${!s.paused && s.speed === 3 ? "on" : ""}">×3</button><button data-speed="10" class="${!s.paused && s.speed === 10 ? "on" : ""}">×10</button></div>
      <p class="law">Le temps s'écoule pour toute la planète, que vous la regardiez ou non. Année ${s.year}.</p>`;
    } else if (this.menuTab === "stats") {
      const tot = this.game.ps.totals(), st = s.stats, alive = s.aliveCivs();
      h += `<div class="kv"><span>Habitants (planète)</span><b>${tot.population}</b><span>Civilisations vivantes</span><b>${tot.civs}</b><span>Guerres actives</span><b>${tot.wars}</b><span>Pic de population (région)</span><b>${st.peakPop}</b>
      <span>Villes (région)</span><b>${s.cities.length}</b><span>Naissances (région)</span><b>${st.births}</b><span>Décès (région)</span><b>${st.deaths}</b><span>— vieillesse / faim / guerre</span><b>${st.oldAgeDeaths} / ${st.famineDeaths} / ${st.warDeaths}</b><span>Civilisations (région)</span><b>${alive.length}/${s.civs.length}</b></div>
      <div class="sheet-sec">Population par civilisation</div><canvas id="chart" class="chart"></canvas><div class="legend" id="legend"></div>`;
    } else {
      h += `<div class="btns"><button id="m-save">Sauvegarder</button><button id="m-load" ${this.game.hasSave() ? "" : "disabled"}>Charger</button><button id="m-export">Exporter (.json)</button></div>
      <p class="law">Sauvegarde automatique toutes les 45 secondes dans ce navigateur.</p>
      <div class="sheet-sec">Nouveau monde</div>
      <div class="btns"><input id="m-seed" type="text" inputmode="numeric" placeholder="graine (aléatoire)" style="flex:1 1 140px;min-height:46px;border-radius:15px;padding:0 14px"><button id="m-new" class="pri">Recommencer l'humanité</button></div>
      <p class="law">Même graine, même planète. Pas la même histoire : vous y êtes pour quelque chose.</p>
      <div class="sheet-sec">Gestes</div><p class="law">Glisser : se déplacer · Pincer : zoomer (de la planète jusqu'au village) · Deux doigts : pivoter · Toucher : sélectionner · Pouvoir : le choisir, puis toucher le monde.</p>`;
    }
    return h;
  }

  private detailsHtml(sim: SimulationEngine, s: Sel): { title: string; html: string } {
    let html = "", title = "Détails";
    if (s.kind === "talk") {
      const pair = this.talkPair ?? [s.id, -1];
      const A = sim.citizenById.get(pair[0]), B = sim.citizenById.get(pair[1]);
      const tk = A && B ? sim.talk.get(A.id, B.id) : undefined;
      if (A && B && tk) {
        title = "Conversation";
        const ton = ["tranquille", "tendu", "chaleureux"][tk.mood];
        html = `<div class="h-civ"><h2>${esc(A.name)} et ${esc(B.name)}</h2></div><div class="quote">${TOPIC_LABEL[tk.topic]} · ton ${ton}${tk.over ? " · terminée" : " · en cours"}</div>` +
          tk.lines.map((l) => `<div class="talkline ${l.who === A.id ? "l" : "r"}"><b>${esc(sim.citizenById.get(l.who)?.name ?? "?")}</b><span>${esc(l.text)}</span></div>`).join("") +
          (tk.effect ? `<div class="sheet-sec">Ce que cela change</div><p class="thought big">${esc(tk.effect)}</p>` : "") +
          `<div class="sheet-sec">Ce qu'ils en retiennent</div>` + [A, B].map((c) => { const d = sim.mind.describe(sim, c); return `<div class="law" style="color:var(--text)"><b>${esc(c.name)}</b> : ${esc(d.intent)}. ${d.why.length ? "Parce qu'il/elle " + d.why.map(esc).join(", ") + "." : ""}</div>`; }).join("");
      }
    } else if (s.kind === "civ") {
      const civ = sim.civById.get(s.id);
      if (civ) { title = "Civilisation"; html = this.civHtml(civ, sim); }
    } else if (s.kind === "citizen") {
      const c = sim.citizenById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (c && civ) {
        title = c.name;
        const faith = c.faith > 0.7 ? "fervent" : c.faith > 0.4 ? "pratiquant" : "tiède";
        const d = sim.mind.describe(sim, c);
        const m = sim.mind.ensure(sim, c);
        const emoBars = ["Peur", "Joie", "Tristesse", "Colère", "Espoir"].map((n, i) => `<div class="kv"><span>${n}</span><b>${Math.round(m.emo[i])}</b></div>${this.bar(m.emo[i], 100, i === 1 || i === 4 ? "green" : i === 0 ? "" : "red")}`).join("");
        const trust = m.trust > 30 ? "confiance" : m.trust > -20 ? "réserve" : m.trust > -55 ? "méfiance" : "défiance";
        html = `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(c.name)}</h2></div>
        <div class="quote">${esc(jobOf(c))} de ${esc(civ.name)} · ${Math.floor(c.age)} ans · ${esc(sim.cityById.get(c.city)?.name ?? "—")}</div>
        <div class="sheet-sec">Pensée</div><p class="thought big">« ${esc(d.thought)} »</p>
        <div class="sheet-sec">Intention</div><p class="law" style="color:var(--text)"><b>${esc(d.intent)}</b>${d.why.length ? "<br>Parce qu'il/elle " + d.why.map(esc).join(", ") + "." : ""}</p>
        <div class="kv"><span>Humeur</span><b>${esc(d.emotion)}</b><span>Envers son chef</span><b>${trust}</b></div>
        <div class="sheet-sec">Souvenirs marquants</div>${d.memories.length ? d.memories.map((x) => `<div class="law" style="color:var(--text)">${esc(x)}</div>`).join("") : '<div class="law">Rien de marquant, pour l\'instant.</div>'}
        <div class="sheet-sec">Relations</div>${d.relations.length ? d.relations.map((x) => `<div class="law" style="color:var(--text)">${esc(x)}</div>`).join("") : '<div class="law">Encore peu de liens.</div>'}
        <div class="sheet-sec">Émotions</div>${emoBars}
        <div class="sheet-sec">Santé et caractère</div>
        <div class="kv"><span>Croyance</span><b>${esc(civ.religion.name)} · ${faith}</b></div>
        <div class="kv"><span>Santé</span><b>${Math.round(c.hp)}</b></div>${this.bar(c.hp, 100, c.hp < 35 ? "red" : "green")}
        <div class="kv"><span>Faim</span><b>${Math.round(c.hunger)}</b></div>${this.bar(c.hunger, 100, c.hunger > 70 ? "red" : "")}
        <div class="kv"><span>Intelligence</span><b>${Math.round(c.intel * 100)}</b></div>${this.bar(c.intel, 1, "blue")}
        <div class="kv"><span>Courage</span><b>${Math.round(c.courage * 100)}</b></div>${this.bar(c.courage, 1)}
        <div class="kv"><span>Agressivité</span><b>${Math.round(c.aggr * 100)}</b></div>${this.bar(c.aggr, 1, "red")}
        ${this.soulHtml(c, sim)}`;
      }
    } else if (s.kind === "city") {
      const c = sim.cityById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (c && civ) {
        title = c.name;
        const counts: Record<string, number> = {};
        const nm = (t: string, e: number) => (ERA_BUILDING_NAMES[t]?.[Math.min(5, e)] ?? BUILDING_LABEL[t as keyof typeof BUILDING_LABEL]);
        for (const b of sim.buildings) if (b.city === c.id && b.civ >= 0 && b.progress >= 1) { const k = nm(b.type, b.era) + (b.up >= 0 ? " (modernisation)" : ""); counts[k] = (counts[k] ?? 0) + 1; }
        const sites = sim.buildings.filter((b) => b.city === c.id && b.progress < 1 && b.civ >= 0).length;
        html = `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(c.name)}</h2></div>
        <div class="quote">${civ.capital === c.id ? "Capitale" : "Ville"} de ${esc(civ.formal)}</div>
        <div class="kv"><span>Population</span><b>${c.pop} / ${c.cap}</b><span>Fondée en</span><b>An ${c.foundedYear}</b><span>Remparts</span><b>${Math.round(c.hp)} / ${c.maxHp}</b>
        <span>Statut</span><b>${c.siege > 0 ? "Assiégée" : "Paisible"}</b><span>Chantiers</span><b>${sites}</b></div>
        <div class="sheet-sec">Bâtiments</div>
        <div class="kv">${Object.entries(counts).sort().map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("") || "<span>Aucun</span><b>—</b>"}</div>
        <p><button class="link" data-go="civ:${civ.id}">Voir ${esc(civ.name)}</button></p>`;
      }
    } else if (s.kind === "building") {
      const b = sim.buildingById.get(s.id);
      if (b) {
        const civ = sim.civById.get(b.civ);
        title = "Bâtiment";
        const label = ERA_BUILDING_NAMES[b.type]?.[Math.min(5, b.era)] ?? BUILDING_LABEL[b.type];
        html = `<div class="h-civ"><h2>${label}</h2></div>
        <div class="quote">${civ ? `Propriété de ${esc(civ.name)} · ${ERA_NAMES[b.era]}${civ.era > b.era ? " (bâtiment historique)" : ""}` : "Ruines abandonnées"}${b.up >= 0 ? ` · modernisation ${Math.round(b.up * 100)} %` : ""}</div>
        <div class="kv"><span>Ville</span><b>${esc(sim.cityById.get(b.city)?.name ?? "—")}</b><span>Avancement</span><b>${Math.round(b.progress * 100)} %</b>
        <span>Solidité</span><b>${Math.round(b.hp)} / ${b.maxHp}</b><span>Travailleurs</span><b>${b.workers}</b></div>
        ${civ ? `<p><button class="link" data-go="civ:${civ.id}">Voir ${esc(civ.name)}</button></p>` : ""}`;
      }
    }
    return { title, html };
  }

  /** Bloc « âme » de la fiche : action en cours, raisons de la décision (utilités), besoins et traits. */
  private soulHtml(c: Citizen, sim: SimulationEngine): string {
    const s = c.soul;
    if (!s) return "";
    const ex = sim.soul.explain(c);
    const home = s.home >= 0 ? sim.buildingById.get(s.home) : undefined;
    const why = ex.reasons.slice(0, 3).map(([n, v]) => `${esc(n)} ${v}`).join(" · ");
    const mother = s.mother >= 0 ? sim.citizenById.get(s.mother)?.name : undefined;
    const traits = TRAIT_LABEL.map((n, i) => `<span>${n}</span><b>${Math.round(s.t[i] * 100)}</b>`).join("");
    return `<p class="hint"><b>Vie intérieure</b></p>
      <div class="kv"><span>Action</span><b>${esc(ex.action)}</b><span>Logis</span><b>${home ? "oui" : "sans toit"}</b>${mother ? `<span>Mère</span><b>${esc(mother)}</b>` : ""}</div>
      <div class="kv"><span>Fatigue</span><b>${Math.round(s.fat)}</b></div>${this.bar(s.fat, 100, s.fat > 80 ? "red" : "")}
      <div class="kv"><span>Solitude</span><b>${Math.round(s.soc)}</b></div>${this.bar(s.soc, 100, s.soc > 80 ? "red" : "")}
      <div class="kv"><span>Confort</span><b>${Math.round(s.com)}</b></div>${this.bar(s.com, 100, s.com < 30 ? "red" : "green")}
      <div class="kv"><span>Peur</span><b>${Math.round(s.fear)}</b></div>${this.bar(s.fear, 100, s.fear > 40 ? "red" : "")}
      <div class="kv">${traits}</div>
      <p class="hint">Pourquoi : ${why || "—"}</p>`;
  }

  private bar(v: number, max: number, cls = ""): string {
    return `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(0)}%"></i></div>`;
  }

  /** Ce qui retient la civilisation à sa époque actuelle (technologie, population, stabilité, or). */
  private eraHint(civ: Civ): string {
    if (civ.era >= 5) return `<div class="law">Dernière époque atteinte. Il ne reste que la décadence.</div>`;
    const n = civ.era + 1;
    const ok = (v: boolean) => (v ? "var(--green)" : "var(--red)");
    const techOk = eraOfTech(civ.tech) >= n;
    return `<div class="law">Pour entrer dans « ${ERA_NAMES[n]} » :
      <span style="color:${ok(techOk)}">technologie ${techOk ? "✓" : "✗"}</span> ·
      <span style="color:${ok(civ.pop >= ERA_POP[n])}">population ${civ.pop}/${ERA_POP[n]}</span> ·
      <span style="color:${ok(civ.stability >= ERA_STAB[n])}">stabilité ${Math.round(civ.stability)}/${ERA_STAB[n]}</span> ·
      <span style="color:${ok(civ.gold >= ERA_GOLD[n])}">or ${Math.floor(civ.gold)}/${ERA_GOLD[n]}</span></div>
      <div class="law">Bâtiments disponibles : ${unlockedTypes(civ).map((t) => BUILDING_LABEL[t]).join(", ")}.</div>`;
  }

  private civHtml(civ: Civ, sim: SimulationEngine): string {
    const cities = sim.citiesOf(civ.id);
    const L = civ.leader;
    const war = sim.wars.find((w) => w.active && (w.a === civ.id || w.d === civ.id || w.aAllies.includes(civ.id) || w.dAllies.includes(civ.id)));
    const armies = sim.armies.filter((a) => a.civ === civ.id);
    const nextTech = civ.tech < MAX_TECH ? techThreshold(civ.tech) : 1;
    const rels = sim.civs.filter((o) => o.id !== civ.id && o.alive).map((o) => {
      const st = sim.statusOf(civ.id, o.id);
      const op = sim.opinion(civ.id, o.id);
      const truce = (sim.truce[sim.pairKey(civ.id, o.id)] ?? 0) > sim.tick && st === "peace";
      const chip = st === "war" ? `<span class="tag-chip war">Guerre</span>` : st === "alliance" ? `<span class="tag-chip alliance">Alliance</span>` : truce ? `<span class="tag-chip">Trêve</span>` : `<span class="tag-chip">Paix</span>`;
      const col = op < -20 ? "red" : op > 20 ? "green" : "";
      return `<div class="rel"><span class="sw" style="background:${hex(o.color)}"></span><button class="link" data-go="civ:${o.id}" style="min-width:86px;text-align:left">${esc(o.name)}</button>${chip}
        <div class="bar ${col}"><i style="width:${((op + 100) / 2).toFixed(0)}%"></i></div><b style="width:34px;text-align:right">${op > 0 ? "+" : ""}${Math.round(op)}</b></div>`;
    }).join("") || `<div class="empty">Plus personne à détester.</div>`;
    if (!civ.alive) {
      return `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(civ.formal)} †</h2></div>
      <div class="quote">Disparue en l'an ${civ.extinctYear}, après ${civ.extinctYear - civ.foundedYear} ans d'existence.</div>
      <div class="kv"><span>Naissances</span><b>${civ.stats.births}</b><span>Décès</span><b>${civ.stats.deaths}</b><span>Pic de population</span><b>${civ.stats.peakPop}</b><span>Ennemis tués</span><b>${civ.stats.kills}</b></div>`;
    }
    return `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(civ.formal)}</h2></div>
    <span class="pers">${PERSONALITY_LABEL[civ.personality]}</span>
    <div class="quote">${esc(PERSONALITY_BLURB[civ.personality])}</div>
    <div class="sec" style="margin-top:6px">Dirigeant</div>
    <div class="kv"><span>${esc(L.title)}</span><b>${esc(L.name)}</b><span>Âge</span><b>${L.age} ans</b><span>Au pouvoir depuis</span><b>An ${L.since}</b>
    <span>Intelligence</span><b>${Math.round(L.intel * 100)}</b><span>Belligérance</span><b>${Math.round(L.aggr * 100)}</b><span>Vanité</span><b>${Math.round(L.vanity * 100)}</b></div>
    ${L.goat ? `<div class="law">Oui, c'est bien une chèvre.</div>` : ""}
    <div class="sec">Population & territoire</div>
    <div class="kv"><span>Habitants</span><b>${civ.pop}</b><span>Adultes</span><b>${civ.adults}</b><span>Villes</span><b>${cities.length}</b><span>Territoire</span><b>${civ.tiles} cases</b>
    <span>Fondée en</span><b>An ${civ.foundedYear}</b></div>
    <div class="kv"><span>Stabilité</span><b>${Math.round(civ.stability)} %</b></div>${this.bar(civ.stability, 100, civ.stability < 25 ? "red" : "green")}
    ${civ.blessed > 0 ? `<div class="law" style="color:var(--gold)">✦ Bénie par Dieu (${Math.ceil(civ.blessed / TICKS_PER_YEAR)} ans)</div>` : ""}
    <div class="sec">Ressources</div>
    <div class="res"><div><b>${Math.floor(civ.food)}</b><small>Vivres</small></div><div><b>${Math.floor(civ.wood)}</b><small>Bois</small></div><div><b>${Math.floor(civ.stone)}</b><small>Pierre</small></div><div><b>${Math.floor(civ.gold)}</b><small>Or</small></div></div>
    <div class="kv"><span>Fermiers</span><b>${civ.jobs.farmer}</b><span>Bûcherons</span><b>${civ.jobs.lumberjack}</b><span>Mineurs</span><b>${civ.jobs.miner}</b><span>Bâtisseurs</span><b>${civ.jobs.builder}</b><span>Érudits</span><b>${civ.jobs.scholar}</b></div>
    <div class="sec">Technologie</div>
    <div class="kv"><span>Époque</span><b style="color:var(--gold)">${ERA_NAMES[civ.era]}</b></div>
    ${this.eraHint(civ)}
    <div class="kv"><span>Niveau ${civ.tech}</span><b>${TECH_NAMES[civ.tech]}</b></div>
    ${civ.tech < MAX_TECH ? this.bar(civ.techProg, nextTech, "blue") : ""}
    <div class="law">${esc(TECH_EFFECT[civ.tech])}</div>
    <div class="sec">Armée</div>
    <div class="kv"><span>Soldats</span><b>${civ.soldiers}</b><span>Armées en campagne</span><b>${armies.length ? armies.map((a) => `${a.soldiers.length} (${{ muster: "rassemblement", march: "marche", siege: "siège", retreat: "retraite" }[a.state]})`).join(", ") : "aucune"}</b></div>
    ${war ? `<div class="law" style="color:var(--red)">En guerre : ${esc(sim.civById.get(war.a === civ.id ? war.d : war.a)?.name ?? "?")} — pertes ${war.a === civ.id ? war.casA : war.casD} (contre ${war.a === civ.id ? war.casD : war.casA}).</div>` : ""}
    <div class="sec">Religion</div>
    <div class="kv"><span>${esc(civ.religion.name)}</span><b>Foi ${Math.round(civ.avgFaith * 100)} %</b></div><div class="law">${esc(DOGMA_LABEL[civ.religion.dogma])}</div>
    ${civ.prayer ? `<div class="law">Prie actuellement pour : ${{ rain: "de la pluie", fire: "du feu", food: "du pain", victory: "la victoire", cure: "la guérison", gift: "un cadeau" }[civ.prayer.want]}.</div>` : ""}
    ${civ.laws.length ? `<div class="sec">Lois en vigueur</div>${civ.laws.map((l) => `<div class="law"><b>${esc(l.name)}</b> (an ${l.since}) — ${esc(LAW_INFO[l.id]?.effect ?? "")}</div>`).join("")}` : ""}
    <div class="sec">Relations diplomatiques</div>${rels}
    <div class="sec">Statistiques</div>
    <div class="kv"><span>Naissances / décès</span><b>${civ.stats.births} / ${civ.stats.deaths}</b><span>Guerres gagnées / perdues</span><b>${civ.stats.warsWon} / ${civ.stats.warsLost}</b>
    <span>Ennemis tués</span><b>${civ.stats.kills}</b><span>Pic de population</span><b>${civ.stats.peakPop}</b><span>Effondrements</span><b>${civ.stats.collapses}</b></div>`;
  }


  // ------------------------------------------------------------ retours discrets

  /** Retour bref à une action du joueur (résultat d'un pouvoir, sauvegarde). Jamais un événement du monde : ceux-ci vont aux Chroniques. */
  snack(text: string): void {
    const box = $("snack");
    box.textContent = "";
    const d = document.createElement("div");
    d.textContent = text;
    box.appendChild(d);
    const my = ++this.snackT;
    setTimeout(() => { if (my === this.snackT) d.classList.add("out"); }, 2200);
    setTimeout(() => { if (my === this.snackT) d.remove(); }, 2700);
  }

  /** Tiroir : glisser vers le bas pour refermer. Ne démarre que si le contenu est tout en haut. */
  private bindSheetDrag(el: HTMLElement, onClose: () => void): void {
    let y0 = 0, drag = false, dy = 0, scroller: HTMLElement | null = null, t0 = 0;
    const findScroller = (t: EventTarget | null): HTMLElement | null => {
      let n = t as HTMLElement | null;
      while (n && n !== el.parentElement) {
        if (n.scrollHeight > n.clientHeight + 2) { const o = getComputedStyle(n).overflowY; if (o === "auto" || o === "scroll") return n; }
        if (n === el) break;
        n = n.parentElement;
      }
      return null;
    };
    el.addEventListener("touchstart", (e) => { y0 = e.touches[0].clientY; t0 = performance.now(); drag = false; dy = 0; scroller = findScroller(e.target); }, { passive: true });
    el.addEventListener("touchmove", (e) => {
      const d = e.touches[0].clientY - y0;
      if (!drag && d > 10 && (!scroller || scroller.scrollTop <= 0)) { drag = true; el.style.animation = "none"; el.style.transition = "none"; }
      if (drag) { e.preventDefault(); dy = Math.max(0, d - 10); el.style.transform = `translateY(${dy}px)`; }
    }, { passive: false });
    const end = () => {
      if (!drag) return;
      drag = false;
      const v = dy / Math.max(1, performance.now() - t0);
      el.style.transition = "";
      const close = dy > Math.min(110, el.offsetHeight * 0.25) || v > 0.6;
      el.style.transform = "";
      if (close) onClose();
    };
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
  }

  private drawChart(): void {
    const cv = $<HTMLCanvasElement>("chart");
    if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const g = cv.getContext("2d")!;
    g.scale(dpr, dpr);
    const h = this.hist;
    if (h.length < 2) { g.fillStyle = "#9aa3b5"; g.font = "12px sans-serif"; g.fillText("Pas encore assez d'histoire à raconter.", 12, 24); return; }
    let max = 10;
    for (const p of h) for (const v of Object.values(p.pops)) max = Math.max(max, v);
    const x0 = 34, y0 = 10, w = W - x0 - 10, hh = H - y0 - 20;
    g.strokeStyle = "#ffffff18"; g.fillStyle = "#9aa3b5"; g.font = "10px sans-serif";
    for (let i = 0; i <= 4; i++) { const y = y0 + hh - (hh * i) / 4; g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); g.fillText(String(Math.round((max * i) / 4)), 4, y + 3); }
    g.fillText(`An ${h[0].year}`, x0, H - 5); g.fillText(`An ${h[h.length - 1].year}`, x0 + w - 40, H - 5);
    for (const civ of this.game.sim.civs) {
      g.strokeStyle = hex(civ.color); g.lineWidth = 2; g.beginPath();
      let started = false;
      h.forEach((p, i) => {
        const v = p.pops[civ.id];
        if (v === undefined) return;
        const x = x0 + (w * i) / (h.length - 1), y = y0 + hh - (hh * v) / max;
        if (!started) { g.moveTo(x, y); started = true; } else g.lineTo(x, y);
      });
      g.stroke();
    }
    $("legend").innerHTML = this.game.sim.civs.map((c) => `<span><span class="sw" style="display:inline-block;background:${hex(c.color)}"></span> ${esc(c.name)}${c.alive ? "" : " †"}</span>`).join("");
  }


  /** Monde recréé / rechargé : on repart d'un état propre. */
  rebind(): void {
    this.attach();
  }
}
