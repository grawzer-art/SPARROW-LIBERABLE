import "./style.css";
import "./ui2.css";
import { Renderer } from "./render/Renderer";
import { PlanetView, type LocalPose, type PlanetCard, type ScaleLevel } from "./render/PlanetView";
import { PlanetSim, START_INHABITED_REGIONS } from "./sim/PlanetSim";
import { SimulationEngine } from "./sim/SimulationEngine";
import type { ChronicleEntry } from "./sim/types";
import { buildReferenceWorld } from "./sim/Reference";
import { buildWitnessScene, type WitnessCast } from "./sim/WitnessScene";
import { Director } from "./render/Director";
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
  level: ScaleLevel = "local";
  private busy = false;
  director: Director | null = null;
  witness: WitnessCast | null = null;
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
      card: (c) => this.planetCard(c),
      enterLocal: (p) => this.goLocal(p),
      modeChanged: (m) => { if (this.mode !== "local") { this.mode = m; this.syncChrome(); } },
      levelChanged: (l) => { this.level = l; this.syncChrome(); },
      villageTap: (r, id) => this.ui.villageTap(r, id),
      place: (t) => { const el = document.getElementById("place"); if (el && el.textContent !== t) el.textContent = t; },
    });
    this.planetView.setPlanetSim(this.ps);
    this.ui = new UI(this);
    this.ui.onPlanetAction = (id) => this.planetView.action(id);
    (window as unknown as { game: Game }).game = this;
    const q = new URLSearchParams(location.search);
    if (q.get("scene") === "sentience") { this.sentienceScene(q.get("ui") === "1"); }
    else if (q.has("ref")) { this.referenceScene(); this.setMode("local", true); }
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
      if (m === "region") { const r = this.ps.planet.regionById(this.ps.activeId); if (r) this.planetView.setView({ P: this.ps.planet.localToDir(r, r.size / 2, r.size / 2), d: 0.3, el: 0.8, region: r.id }); }
      else this.planetView.setView({ mode: "planet" });
      this.mode = m; this.level = this.planetView.state.level;
    }
    this.syncChrome();
  }

  private syncChrome(): void {
    const b = document.body.classList;
    b.remove("m-planet", "m-region", "m-local");
    b.add(this.mode === "local" ? "m-local" : this.level === "planet" ? "m-planet" : "m-region");
    if (this.mode === "local") this.ui?.setPlanetCard(null);
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
    this.mode = "local"; this.level = "local";
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
    this.mode = "region"; this.level = "region";
    this.syncChrome();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    await this.veil(false);
    this.busy = false;
  }

  /** Raccourcis (fils d'Ariane) : un zoom animé, jamais un changement brusque de scène ; depuis le local, retour fondu puis zoom arrière. */
  async goLevel(l: ScaleLevel): Promise<void> {
    if (this.busy) return;
    if (this.mode === "local") { if (l === "local") return; await this.goRegion(); }
    this.planetView.goLevel(l);
  }

  /** Carte contextuelle de la vue planète (village, continent, lieu) : rendue par l'interface commune. */
  private planetCard(c: PlanetCard | null): void {
    if (!c) { this.ui?.setPlanetCard(null); return; }
    const esc = (t: string) => t.replace(/[&<>]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[m]!));
    this.ui.setPlanetCard({ title: c.title, sub: c.lines.map(esc).join("<br>"), color: c.color, actions: c.actions.map((a, i) => ({ ...a, main: i === 0 })) }, c.ref);
  }

  // --- services pour l'interface (GameHost)
  showGlobe(): void { void this.goLevel("planet"); }
  continents(): { id: number; name: string }[] { return this.planetView.continentChoices(); }
  focusContinent(id: number): void { void this.goLevel("planet").then(() => this.planetView.focusContinent(id)); }
  clearPlanetSelection(): void { this.planetView.clearSelection(); }
  async observeVillage(region: number, cityId: number): Promise<void> {
    if (this.mode === "local" && region === this.ps.activeId) { const c = this.sim.cityById.get(cityId); if (c) this.renderer.focusOn(c.x + 0.5, c.y + 0.5, 22); return; }
    if (this.mode === "local") await this.goRegion();
    this.planetView.flyToVillage(region, cityId);
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

  /** Scène témoin « Sentience » : village, cinq habitants avec mémoire, conversation spontanée, décision, action collective ; vue sans interface pilotée par le réalisateur. */
  private sentienceScene(showUi: boolean): void {
    document.getElementById("intro")!.classList.add("hidden");
    const { e, cast } = buildWitnessScene();
    this.witness = cast;
    this.swap(PlanetSim.fromEngine(e));
    e.speed = Number(new URLSearchParams(location.search).get("speed")) || 1; e.paused = false;
    this.setMode("local", true);
    this.renderer.setPose(cast.home.x + 0.5, cast.home.y + 1.5, 21, 0.62, 0.9);
    if (!showUi) document.body.classList.add("noui");
    const ids = () => [cast.mira.id, cast.ysa.id, cast.tobias.id, cast.garen.id, cast.lenn.id, cast.kid.id];
    this.director = new Director(() => this.sim, this.renderer, () => ({ x: cast.home.x + 0.5, y: cast.home.y + 1.5 }), ids, () => cast.sites.find((id) => (this.sim.buildingById.get(id)?.progress ?? 1) < 1) ?? cast.site);
    const el = this.renderer.three.domElement;
    el.addEventListener("pointerdown", () => this.director?.yield(14));
    el.addEventListener("wheel", () => this.director?.yield(14), { passive: true });
    // un toucher sur le décor fait apparaître l'interface (et le réalisateur laisse la main) ; deux touchers rapides la masquent
    el.addEventListener("dblclick", () => document.body.classList.toggle("noui"));
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
    this.ui.rebind();
  }

  /** Change de région locale observée : même monde, autre simulation (les autres continuent de vivre). */
  activateRegion(id: number): void {
    if (id === this.ps.activeId && this.sim === this.ps.engineOf(id)) return;
    const prev = this.sim;
    this.sim = this.ps.setActive(id);
    this.sim.speed = prev.speed; this.sim.paused = prev.paused;
    this.renderer.setSim(this.sim);
    this.renderer.resetCamera();
    this.ui.rebind();
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
    this.ui.snack(`Nouveau monde · graine ${this.sim.seed}`);
  }

  save(): string {
    const r = PlanetSim.save(this.ps);
    this.lastSave = performance.now();
    return r.ok ? `Partie sauvegardée (An ${this.sim.year}, ${this.ps.engines.size} régions, ${(r.bytes / 1024).toFixed(0)} Ko).` : `Échec de la sauvegarde : ${r.error}`;
  }

  load(): boolean {
    const ps = PlanetSim.load();
    if (!ps) { this.ui.snack("Aucune sauvegarde exploitable."); return false; }
    let note = "";
    if (ps.migrateScale()) note += " Géographie mise à l'échelle : vos lieux et peuples n'ont pas bougé.";
    // migration explicite d'une ancienne partie à région unique : Terre Première et sa planète restent intactes, un nouveau peuple est ajouté
    if (ps.engines.size === 1) {
      const added = ps.addInhabitedRegions(START_INHABITED_REGIONS - 1);
      if (added.length) note += ` Un nouveau peuple a été découvert : ${added[0].name}.`;
    }
    this.swap(ps);
    this.arrive();
    this.ui.snack(`Partie restaurée · An ${this.sim.year}${note}`);
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
        if (this.mode === "local") { this.director?.update(Math.min(0.25, this.accDt)); this.renderer.frame(Math.min(0.25, this.accDt), alpha); }
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

if (new URLSearchParams(location.search).get("scene") === "human") void import("./render/human/viewer").then((m) => m.startHumanViewer());
else new Game();
