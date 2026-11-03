import "./style.css";
import { Renderer } from "./render/Renderer";
import { SaveManager } from "./sim/SaveManager";
import { SimulationEngine } from "./sim/SimulationEngine";
import { TICK_MS } from "./sim/config";
import { UI, type GameHost } from "./ui/UI";

class Game implements GameHost {
  sim!: SimulationEngine;
  renderer: Renderer;
  ui!: UI;
  private last = performance.now();
  private lastSave = performance.now();

  constructor() {
    this.renderer = new Renderer(document.getElementById("stage")!, document.getElementById("labels")!);
    this.sim = SimulationEngine.create(this.randomSeed());
    this.renderer.setSim(this.sim);
    this.ui = new UI(this);
    (window as unknown as { game: Game }).game = this;
    this.intro();
    requestAnimationFrame((t) => this.loop(t));
    document.addEventListener("visibilitychange", () => { if (document.hidden && this.started()) this.save(); });
    window.addEventListener("beforeunload", () => { if (this.started()) { try { SaveManager.save(this.sim); } catch { /* ignore */ } } });
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
    if (SaveManager.hasSave()) cont.classList.remove("hidden");
    this.sim.paused = true;
    cont.addEventListener("click", () => { if (this.load()) { intro.classList.add("hidden"); } });
    document.getElementById("i-new")!.addEventListener("click", () => {
      const v = (document.getElementById("i-seed") as HTMLInputElement).value.trim();
      this.newWorld(v ? Number(v.replace(/\D/g, "")) || undefined : undefined);
      intro.classList.add("hidden");
    });
    // démarrage direct possible : un clic ailleurs ne ferme rien, volontairement
  }

  private swap(sim: SimulationEngine): void {
    sim.speed = this.sim?.speed || 1;
    this.sim = sim;
    this.renderer.setSim(sim);
    this.ui.rebind();
    sim.paused = false;
    const c = sim.cities.find((k) => k.id === sim.civs[0]?.capital);
    if (c) this.renderer.resetCamera();
  }

  newWorld(seed?: number): void {
    this.swap(SimulationEngine.create(seed ?? this.randomSeed()));
    this.ui.toast(`Nouveau monde (graine ${this.sim.seed}). Trois civilisations, aucune expérience.`, "", false, true);
  }

  save(): string {
    const r = SaveManager.save(this.sim);
    this.lastSave = performance.now();
    return r.ok ? `Partie sauvegardée (An ${this.sim.year}, ${(r.bytes / 1024).toFixed(0)} Ko).` : `Échec de la sauvegarde : ${r.error}`;
  }

  load(): boolean {
    const s = SaveManager.load();
    if (!s) { this.ui.toast("Aucune sauvegarde exploitable.", "", false); return false; }
    this.swap(s);
    this.ui.toast(`Partie restaurée : An ${s.year}, ${s.totalPop()} habitants.`, "", false);
    return true;
  }

  hasSave(): boolean {
    return SaveManager.hasSave();
  }

  exportSave(): void {
    const blob = new Blob([SaveManager.serialize(this.sim)], { type: "application/json" });
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
      this.sim.advance(dt * 1000);
      const alpha = this.sim.paused ? 1 : Math.min(1, this.sim.acc / TICK_MS);
      this.renderer.frame(dt, alpha);
      this.ui.frame();
      if (now - this.lastSave > 45000 && this.started()) this.save();
    } catch (e) {
      console.error(e);
    }
    requestAnimationFrame((t) => this.loop(t));
  }
}

new Game();
