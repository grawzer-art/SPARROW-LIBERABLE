import "./style.css";
import { Renderer } from "./render/Renderer";
import { PlanetView, type LocalPose, type PlanetCard } from "./render/PlanetView";
import { PlanetSim, START_INHABITED_REGIONS } from "./sim/PlanetSim";
import { SimulationEngine } from "./sim/SimulationEngine";
import type { ChronicleEntry } from "./sim/types";
import { buildReferenceWorld } from "./sim/Reference";
import { TICK_MS } from "./sim/config";
import { UI, MOBILE_Q, type GameHost } from "./ui/UI";

export type GameMode = "planet" | "region" | "local";

class Game implements GameHost {
  ps!: PlanetSim;
  sim!: SimulationEngine;
  renderer: Renderer;
  planetView: PlanetView;
  ui!: UI;
  mode: GameMode = "local";
  private busy = false;
  private startLocal = false;
  private last = performance.now();
  private lastSave = performance.now();
  private lastRender = 0;
  private accDt = 0;

  constructor() {
    this.renderer = new Renderer(document.getElementById("stage")!, document.getElementById("labels")!, { mobile: window.matchMedia(MOBILE_Q).matches });
    this.ps = PlanetSim.fromEngine(SimulationEngine.create(this.randomSeed()));
    this.sim = this.ps.active;
    this.renderer.setSim(this.sim);
    this.renderer.resetCamera();
    this.planetView = new PlanetView(this.renderer, document.getElementById("app")!, window.matchMedia(MOBILE_Q).matches, {
      card: (c) => this.showCard(c),
      enterLocal: (p) => this.goLocal(p),
      modeChanged: (m) => { this.mode = m; this.syncChrome(); },
    });
    this.planetView.setPlanetSim(this.ps);
    this.bindRemote();
    this.ui = new UI(this);
    this.bindPlanetUi();
    (window as unknown as { game: Game }).game = this;
    const q = new URLSearchParams(location.search);
    if (q.has("ref")) { this.referenceScene(); this.setMode("local", true); }
    else this.intro();
    if (q.has("local")) this.startLocal = true;
    requestAnimationFrame((t) => this.loop(t));
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.started()) this.save(); });
    window.addEventListener("beforeunload", () => { if (this.started()) { try { PlanetSim.save(this.ps); } catch { /* ignore */ } } });
  }

  // ------------------------------------------------------------------ échelles de vue

  /** Démarrage d'une partie : on découvre la planète depuis l'espace (ou la scène locale avec ?local). */
  private arrive(): void {
    if (this.startLocal) { this.setMode("local", true); return; }
    this.setMode("planet", true);
    this.planetView.intro();
  }

  /** Change d'échelle sans animation (démarrage, scripts de test). */
  setMode(m: GameMode, instant = true): void {
    if (m === "local") {
      if (this.mode !== "local") { this.planetView.activate(false); this.renderer.setControlsEnabled(true); }
      this.mode = "local";
    } else {
      this.renderer.setControlsEnabled(false);
      this.planetView.activate(true);
      if (m === "region") this.planetView.dive(this.ps.activeId, undefined, instant); else { this.mode = "planet"; this.planetView.setView({ mode: "planet" }); }
      this.mode = m;
    }
    this.syncChrome();
  }

  private syncChrome(): void {
    const b = document.body.classList;
    b.remove("m-planet", "m-region", "m-local");
    b.add("m-" + this.mode);
    document.querySelectorAll<HTMLButtonElement>("#crumbs button").forEach((e) => e.classList.toggle("on", e.dataset.lvl === this.mode));
    if (this.mode === "local") this.showCard(null);
  }

  private veil(on: boolean): Promise<void> {
    const v = document.getElementById("veil")!;
    v.classList.toggle("on", on);
    return new Promise((r) => setTimeout(r, 400));
  }

  /** REGION -> LOCAL : le voile masque le changement de scène ; la caméra locale reprend exactement la pose de la vue régionale. */
  async goLocal(p: LocalPose): Promise<void> {
    if (this.busy || this.mode === "local") return;
    this.busy = true;
    await this.veil(true);
    this.planetView.activate(false);
    this.renderer.setControlsEnabled(true);
    if (p.region !== this.ps.activeId) this.activateRegion(p.region); // la scène locale de la région visée remplace l'ancienne (ressources graphiques libérées)
    this.renderer.setPose(p.x, p.y, p.dist, p.el, p.az);
    this.mode = "local";
    this.syncChrome();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await this.veil(false);
    this.busy = false;
  }

  /** LOCAL -> REGION (même point, même distance, même azimut). */
  async goRegion(): Promise<void> {
    if (this.busy || this.mode !== "local") return;
    this.busy = true;
    const pose = this.renderer.getPose();
    await this.veil(true);
    this.renderer.setControlsEnabled(false);
    this.planetView.activate(true);
    this.planetView.enterRegionFromLocal({ ...pose, region: this.ps.activeId });
    this.mode = "region";
    this.syncChrome();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await this.veil(false);
    this.busy = false;
  }

  /** Navigation par les « fils d'Ariane » : remonte ou descend d'une ou deux échelles. */
  async goLevel(l: GameMode): Promise<void> {
    if (this.busy || l === this.mode) return;
    if (l === "local") { if (this.mode === "region") this.planetView.action("enter"); else { this.planetView.dive(); } return; }
    if (l === "region") { if (this.mode === "local") await this.goRegion(); else this.planetView.dive(); return; }
    if (this.mode === "local") await this.goRegion();
    this.planetView.ascend();
  }

  private showCard(c: PlanetCard | null): void {
    const card = document.getElementById("planet-card")!;
    document.body.classList.toggle("card-open", !!c);
    if (!c) { card.classList.add("hidden"); return; }
    document.getElementById("pc-title")!.textContent = c.title;
    const lines = document.getElementById("pc-lines")!; lines.textContent = "";
    for (const l of c.lines) { const d = document.createElement("div"); d.textContent = l; lines.appendChild(d); }
    const acts = document.getElementById("pc-actions")!; acts.textContent = "";
    for (const a of c.actions) { const b = document.createElement("button"); b.textContent = a.label; b.addEventListener("click", () => this.planetView.action(a.id)); acts.appendChild(b); }
    card.classList.remove("hidden");
  }

  private bindPlanetUi(): void {
    document.querySelectorAll<HTMLButtonElement>("#crumbs button").forEach((b) => b.addEventListener("click", () => { void this.goLevel(b.dataset.lvl as GameMode); }));
    document.querySelector("#planet-card .pc-x")!.addEventListener("click", () => this.showCard(null));
    document.getElementById("p-in")!.addEventListener("click", () => this.planetView.zoomBy(0.72));
    document.getElementById("p-out")!.addEventListener("click", () => this.planetView.zoomBy(1.4));
    document.getElementById("c-globe")!.addEventListener("click", () => { void this.goRegion(); });
    document.getElementById("p-home")!.addEventListener("click", () => this.planetView.recenter());
    document.getElementById("p-chron")!.addEventListener("click", () => this.ui.showWorldChronicle());
  }

  started(): boolean {
    return document.getElementById("intro")!.classList.contains("hidden");
  }

  randomSeed(): number {
    return Math.floor(Math.random() * 900000) + 100;
  }

  private intro(): void {
    const intro = document.getElementById("intro")!;
    const cont = document.getElementById("i-continue")!;
    if (PlanetSim.hasSave()) cont.classList.remove("hidden");
    this.sim.paused = true;
    cont.addEventListener("click", () => { if (this.load()) { intro.classList.add("hidden"); } });
    document.getElementById("i-new")!.addEventListener("click", () => {
      const v = (document.getElementById("i-seed") as HTMLInputElement).value.trim();
      this.newWorld(v ? Number(v.replace(/\D/g, "")) || undefined : undefined);
      intro.classList.add("hidden");
    });
    // démarrage direct possible : un clic ailleurs ne ferme rien, volontairement
  }

  /** Scène de référence graphique : trois villes à trois époques, jour, caméra sur la cité moderne. */
  private referenceScene(): void {
    document.getElementById("intro")!.classList.add("hidden");
    const sim = SimulationEngine.create(42);
    sim.paused = true;
    const ids = buildReferenceWorld(sim);
    this.swap(PlanetSim.fromEngine(sim));
    sim.paused = false;
    const civ = sim.civById.get(ids.modern)!;
    const c = sim.cityById.get(civ.capital) ?? sim.citiesOf(civ.id)[0];
    if (c) this.renderer.focusOn(c.x + 0.5, c.y + 0.5, 20);
    this.renderer.setTimeOfDay(0.45);
  }

  /** Remplace le monde par un autre (nouvelle partie, chargement). */
  private swap(ps: PlanetSim): void {
    const speed = this.sim?.speed || 1;
    this.ps = ps;
    for (const e of ps.engines.values()) { e.speed = speed; e.paused = false; }
    this.sim = ps.active;
    this.renderer.setSim(this.sim);
    this.renderer.resetCamera();
    this.planetView.setPlanetSim(ps);
    this.bindRemote();
    this.ui.rebind();
    this.buildChips();
  }

  /** Sélecteur discret de continents (vue planète) : recentre le globe et ouvre la fiche. */
  private buildChips(): void {
    const box = document.getElementById("continents")!;
    box.textContent = "";
    for (const c of this.planetView.continentChoices()) {
      const b = document.createElement("button");
      b.textContent = c.name;
      b.addEventListener("click", () => this.planetView.focusContinent(c.id));
      box.appendChild(b);
    }
  }

  /** Change de région locale observée : même monde, autre simulation (les autres continuent de vivre). */
  activateRegion(id: number): void {
    if (id === this.ps.activeId && this.sim === this.ps.engineOf(id)) return;
    const prev = this.sim;
    this.sim = this.ps.setActive(id);
    this.sim.speed = prev.speed; this.sim.paused = prev.paused;
    this.renderer.setSim(this.sim);
    this.renderer.resetCamera();
    this.bindRemote();
    this.ui.rebind();
  }

  /** Les événements des régions non observées arrivent en notifications compactes préfixées par leur région. */
  private remoteBound = new WeakSet<SimulationEngine>();
  private bindRemote(): void {
    for (const [id, e] of this.ps.engines) {
      if (this.remoteBound.has(e)) continue;
      this.remoteBound.add(e);
      e.listeners.push((en) => { if (e !== this.sim) this.onRemoteEvent(id, e, en); });
    }
  }
  private onRemoteEvent(id: number, e: SimulationEngine, en: ChronicleEntry): void {
    if (en.importance < 2) return;
    const name = this.ps.planet.regionById(id)?.name ?? `Région ${id}`;
    this.ui.remoteNotice(name, en.text, en.type === "war" || en.type === "catastrophe");
    void e;
  }

  /** Chronique de TOUTE la planète : événements de toutes les régions, par ordre chronologique. */
  worldChronicle(limit = 80): { region: string; entry: ChronicleEntry }[] {
    const out: { region: string; entry: ChronicleEntry; tick: number }[] = [];
    for (const [id, e] of this.ps.engines) {
      const name = this.ps.planet.regionById(id)?.name ?? `Région ${id}`;
      for (const en of e.chronicle.slice(-60)) if (en.importance >= 2) out.push({ region: name, entry: en, tick: en.tick });
    }
    return out.sort((a, b) => b.tick - a.tick).slice(0, limit);
  }

  newWorld(seed?: number): void {
    this.swap(PlanetSim.create(seed ?? this.randomSeed()));
    this.arrive();
    this.ui.toast(`Nouveau monde (graine ${this.sim.seed}) : ${this.ps.totals().civs} civilisations sur ${this.ps.totals().inhabited} régions.`, "", false, true);
  }

  save(): string {
    const r = PlanetSim.save(this.ps);
    this.lastSave = performance.now();
    return r.ok ? `Partie sauvegardée (An ${this.sim.year}, ${this.ps.engines.size} régions, ${(r.bytes / 1024).toFixed(0)} Ko).` : `Échec de la sauvegarde : ${r.error}`;
  }

  load(): boolean {
    const ps = PlanetSim.load();
    if (!ps) { this.ui.toast("Aucune sauvegarde exploitable.", "", false); return false; }
    let note = "";
    // migration explicite d'une ancienne partie à région unique : Terre Première et sa planète restent intactes, un nouveau peuple est ajouté
    if (ps.engines.size === 1) {
      const added = ps.addInhabitedRegions(START_INHABITED_REGIONS - 1);
      if (added.length) note = ` Un nouveau peuple a été découvert : ${added[0].name}.`;
    }
    this.swap(ps);
    this.arrive();
    this.ui.toast(`Partie restaurée : An ${this.sim.year}, ${ps.totals().population} habitants sur ${ps.engines.size} régions.${note}`, "", false);
    return true;
  }

  hasSave(): boolean {
    return PlanetSim.hasSave();
  }

  exportSave(): void {
    const blob = new Blob([this.ps.serialize()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `god-is-bored-an${this.sim.year}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  private loop(now: number): void {
    const dt = Math.min(0.25, (now - this.last) / 1000);
    this.last = now;
    try {
      this.ps.advance(dt * 1000);
      this.accDt += dt;
      // plafonne le rendu (60 i/s, 30 en dernier recours) : Safari ProMotion tourne à 120 Hz
      if (now - this.lastRender >= this.renderer.frameInterval) {
        const alpha = this.sim.paused ? 1 : Math.min(1, this.sim.acc / TICK_MS);
        if (this.mode === "local") this.renderer.frame(Math.min(0.25, this.accDt), alpha);
        else { this.renderer.drainFx(); this.planetView.frame(Math.min(0.25, this.accDt)); }
        this.accDt = 0;
        this.lastRender = now;
        this.ui.frame();
      }
      if (now - this.lastSave > 45000 && this.started()) this.save();
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}

new Game();
