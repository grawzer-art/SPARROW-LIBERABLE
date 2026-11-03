import { TICKS_PER_YEAR } from "../sim/config";
import { DOGMA_LABEL, JOB_LABEL, PERSONALITY_BLURB, PERSONALITY_LABEL, PROPHECIES, STATE_LABEL, TECH_EFFECT, TECH_NAMES } from "../sim/data";
import { POWERS, POWER_BY_ID, type PowerId } from "../sim/DivinePowerSystem";
import { BUILDING_LABEL, ERA_BUILDING_NAMES } from "../sim/EconomySystem";
import { ERA_GOLD, ERA_NAMES, ERA_POP, ERA_STAB, eraOfTech, unlockedTypes } from "../sim/TechTree";
import { LAW_INFO } from "../sim/EventSystem";
import { techThreshold } from "../sim/CivilizationSystem";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { ChronicleEntry, Civ, EventType } from "../sim/types";
import type { Renderer } from "../render/Renderer";
import { MAX_TECH } from "../sim/config";

export interface GameHost {
  sim: SimulationEngine;
  renderer: Renderer;
  save(): string;
  load(): boolean;
  newWorld(seed?: number): void;
  hasSave(): boolean;
  exportSave(): void;
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

export class UI {
  private power: PowerId | null = null;
  private prophecyId = "peace";
  private filter = "all";
  private civFilter = -2;
  private tab: "chron" | "notif" = "chron";
  private sel: { kind: "none" | "civ" | "citizen" | "city" | "building"; id: number } = { kind: "none", id: -1 };
  private chronDirty = true;
  private lastDetails = "";
  private lastCivOpts = "";
  private notifs: { year: number; text: string }[] = [];
  private hist: { year: number; pops: Record<number, number> }[] = [];
  private lastHistYear = -1;
  private cursor: { x: number; y: number } | null = null;
  private lastInfo = 0;
  private pending = new Set<PowerId>();
  private down: { x: number; y: number; t: number } | null = null;
  private lastHud = 0;
  private lastBoredPulse = 0;
  private sheet: "powers" | "world" | "chron" | null = null;
  private unread = 0;
  private multi = false;
  private ptrs = new Set<number>();
  private lastPtr: string = "mouse";

  get mobile(): boolean { return window.matchMedia(MOBILE_Q).matches; }

  constructor(private game: GameHost) {
    this.buildPowers();
    this.buildChips();
    this.bind();
    this.attach();
  }

  get sim(): SimulationEngine { return this.game.sim; }

  /** (Re)lie l'UI à une nouvelle simulation. */
  attach(): void {
    this.sim.listeners.push((e) => this.onEvent(e));
    this.chronDirty = true;
    this.hist = [];
    this.lastHistYear = -1;
    this.sel = { kind: "none", id: -1 };
    this.notifs = [];
    this.lastDetails = "";
    this.setPower(null);
    this.closeSheet();
    this.unread = 0;
    this.updateBadge();
    this.updateCivSelect(true);
    this.updateSpeedButtons();
  }

  // ------------------------------------------------------------ construction

  private buildPowers(): void {
    const root = $("powers");
    root.innerHTML = POWERS.map((p) => `<button class="power" data-p="${p.id}" title="${esc(p.detail)}">
      <span class="g">${p.glyph}</span><span><div class="n">${p.name}</div><div class="d">${esc(p.blurb)}</div></span><i class="cd" style="width:0"></i></button>`).join("");
    root.querySelectorAll<HTMLButtonElement>(".power").forEach((b) => b.addEventListener("click", () => {
      const id = b.dataset.p as PowerId;
      if (!this.mobile) { this.setPower(this.power === id ? null : id); return; }
      if (id === "prophecy") { $("prophecy-box").classList.remove("hidden"); this.refreshProphecyOdds(); $("prophecy-box").scrollIntoView({ block: "nearest" }); return; }
      this.armPower(id);
    }));
    const sel = $<HTMLSelectElement>("prophecy-sel");
    sel.innerHTML = PROPHECIES.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join("");
    sel.addEventListener("change", () => { this.prophecyId = sel.value; this.refreshTargetInfo(true); });
  }

  private buildChips(): void {
    const c = $("chips");
    c.innerHTML = FILTERS.map((f) => `<button class="chip ${f.id === this.filter ? "on" : ""}" data-f="${f.id}">${f.label}</button>`).join("");
    c.querySelectorAll<HTMLButtonElement>(".chip").forEach((b) => b.addEventListener("click", () => {
      this.filter = b.dataset.f!;
      c.querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === b));
      this.chronDirty = true;
    }));
    $<HTMLSelectElement>("f-civ").addEventListener("change", (e) => { this.civFilter = Number((e.target as HTMLSelectElement).value); this.chronDirty = true; });
    document.querySelectorAll<HTMLButtonElement>(".tab").forEach((b) => b.addEventListener("click", () => {
      this.tab = b.dataset.tab as "chron" | "notif";
      document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("active", x === b));
      $("chron-list").classList.toggle("hidden", this.tab !== "chron");
      $("notif-list").classList.toggle("hidden", this.tab !== "notif");
      $("chips").classList.toggle("hidden", this.tab !== "chron");
      $("f-civ").classList.toggle("hidden", this.tab !== "chron");
      if (this.tab === "notif") this.renderNotifs();
    }));
  }

  private bind(): void {
    const r = this.game.renderer;
    const el = r.three.domElement;
    // contrôle du temps
    $("t-pause").addEventListener("click", () => this.togglePause());
    document.querySelectorAll<HTMLButtonElement>(".time [data-speed]").forEach((b) => b.addEventListener("click", () => { this.sim.speed = Number(b.dataset.speed); this.sim.paused = false; this.updateSpeedButtons(); }));
    // caméra
    $("c-rot-l").addEventListener("click", () => r.rotate(-0.4));
    $("c-rot-r").addEventListener("click", () => r.rotate(0.4));
    $("c-in").addEventListener("click", () => r.zoom(0.8));
    $("c-out").addEventListener("click", () => r.zoom(1.25));
    $("c-reset").addEventListener("click", () => r.resetCamera());
    // navigation mobile : barre d'onglets + bottom sheets
    document.querySelectorAll<HTMLButtonElement>("#tabbar [data-sheet]").forEach((b) => b.addEventListener("click", () => {
      const n = b.dataset.sheet as "powers" | "world" | "chron";
      if (this.sheet === n) this.closeSheet(); else { this.setPower(null); this.openSheet(n); }
    }));
    document.querySelectorAll<HTMLButtonElement>(".sheet .sx").forEach((b) => b.addEventListener("click", () => this.closeSheet()));
    for (const id of ["left", "right", "bottom"]) this.bindSheetDrag($(id), () => this.closeSheet());
    this.bindSheetDrag(document.querySelector("#modal .card") as HTMLElement, () => $("modal").classList.add("hidden"));
    $("ab-cancel").addEventListener("click", () => this.setPower(null));
    $("ab-msg").addEventListener("click", () => { this.openSheet("powers"); $("prophecy-box").classList.remove("hidden"); });
    $("prophecy-go").addEventListener("click", () => { this.prophecyId = $<HTMLSelectElement>("prophecy-sel").value; this.armPower("prophecy"); });
    // Safari iOS : pas de zoom de page ni de menu contextuel sur la carte
    for (const ev of ["gesturestart", "gesturechange", "gestureend"]) document.addEventListener(ev, (e) => e.preventDefault());
    el.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });
    // menus
    $("b-stats").addEventListener("click", () => this.showStats());
    $("b-menu").addEventListener("click", () => this.showMenu());
    $("modal-x").addEventListener("click", () => $("modal").classList.add("hidden"));
    $("modal").addEventListener("pointerdown", (e) => { if (e.target === $("modal")) $("modal").classList.add("hidden"); });
    // carte
    el.addEventListener("contextmenu", (e) => e.preventDefault());
    el.addEventListener("pointerdown", (e) => {
      this.ptrs.add(e.pointerId);
      if (this.ptrs.size > 1) this.multi = true;
      this.lastPtr = e.pointerType;
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      if (e.pointerType !== "mouse" && this.power && this.ptrs.size === 1) {
        const g = r.pickGround(e.clientX, e.clientY);
        if (g) { this.cursor = g; this.updateCursor(); }
      }
    });
    const release = (e: PointerEvent, click: boolean) => {
      this.ptrs.delete(e.pointerId);
      const d = this.down;
      if (this.ptrs.size > 0) return;
      const wasMulti = this.multi;
      this.multi = false; this.down = null;
      if (!click || !d || wasMulti || e.button > 0) return;
      const slop = e.pointerType === "mouse" ? 6 : 12;
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > slop || performance.now() - d.t > 500) { if (this.mobile && this.power) r.setCursor(0, 0, 0, null); return; }
      const g = r.pickGround(e.clientX, e.clientY);
      if (g) this.onMapClick(g.x, g.y, e.pointerType);
    };
    el.addEventListener("pointerup", (e) => release(e, true));
    el.addEventListener("pointercancel", (e) => release(e, false));
    el.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || e.pointerType === "pen" && this.mobile) return;
      const g = r.pickGround(e.clientX, e.clientY);
      this.cursor = g;
      this.updateCursor();
    });
    el.addEventListener("pointerleave", () => { this.cursor = null; r.setCursor(0, 0, 0, null); });
    window.addEventListener("keydown", (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "Escape") { this.setPower(null); $("modal").classList.add("hidden"); this.closeSheet(); }
      else if (e.key === " ") { e.preventDefault(); this.togglePause(); }
      else if (e.key === "1") { this.sim.speed = 1; this.sim.paused = false; this.updateSpeedButtons(); }
      else if (e.key === "2") { this.sim.speed = 3; this.sim.paused = false; this.updateSpeedButtons(); }
      else if (e.key === "3") { this.sim.speed = 10; this.sim.paused = false; this.updateSpeedButtons(); }
    });
  }

  private togglePause(): void {
    this.sim.paused = !this.sim.paused;
    this.updateSpeedButtons();
  }

  private updateSpeedButtons(): void {
    const s = this.sim;
    $("t-pause").classList.toggle("on", s.paused);
    document.querySelectorAll<HTMLButtonElement>(".time [data-speed]").forEach((b) => b.classList.toggle("on", !s.paused && Number(b.dataset.speed) === s.speed));
  }

  // ------------------------------------------------------------ pouvoirs

  /** Mobile : arme un pouvoir, referme le tiroir et affiche la barre d'action avec le bouton Annuler. */
  armPower(p: PowerId): void {
    this.closeSheet();
    this.setPower(p);
  }

  private refreshProphecyOdds(): void {
    const sim = this.sim;
    const civ = sim.aliveCivs().sort((a, b) => b.pop - a.pop)[0];
    if (!civ) return;
    $("prophecy-odds").textContent = "Comprise selon l'intelligence, la foi et le dirigeant de la civilisation visée.";
  }

  setPower(p: PowerId | null): void {
    this.power = p;
    document.querySelectorAll<HTMLButtonElement>(".power").forEach((b) => b.classList.toggle("sel", b.dataset.p === p));
    $("prophecy-box").classList.toggle("hidden", p !== "prophecy" && !(this.mobile && this.sheet === "powers" && false));
    $("hint").classList.toggle("on", !!p);
    $("app").classList.toggle("armed", !!p);
    if (p) {
      const info = POWER_BY_ID[p];
      $("hint").textContent = info.target === "civ" ? `${info.name} : cliquez sur un territoire (Échap pour renoncer)` : `${info.name} : cliquez sur la carte (Échap pour renoncer)`;
      $("ab-name").textContent = `${info.glyph} ${info.name}`;
      const msg = PROPHECIES.find((m) => m.id === this.prophecyId)?.name ?? "";
      $("ab-hint").textContent = p === "prophecy" ? `« ${msg} » : touchez un territoire` : info.target === "civ" ? "Touchez un territoire" : "Touchez la carte pour l'appliquer ici";
      $("ab-msg").classList.toggle("hidden", p !== "prophecy");
    } else this.game.renderer.setCursor(0, 0, 0, null);
    this.refreshTargetInfo(true);
    this.updateCursor();
    this.syncInset();
  }

  // ------------------------------------------------------------ bottom sheets (mobile)

  private sheetEl(n: "powers" | "world" | "chron"): HTMLElement {
    return $(n === "powers" ? "left" : n === "world" ? "right" : "bottom");
  }

  openSheet(n: "powers" | "world" | "chron"): void {
    if (!this.mobile) return;
    for (const k of ["powers", "world", "chron"] as const) { const el = this.sheetEl(k); el.classList.toggle("open", k === n); el.style.transform = ""; el.style.transition = ""; }
    this.sheet = n;
    $("app").classList.add("sheet-open");
    document.querySelectorAll<HTMLButtonElement>("#tabbar [data-sheet]").forEach((b) => b.classList.toggle("on", b.dataset.sheet === n));
    if (n === "powers") { $("prophecy-box").classList.add("hidden"); }
    if (n === "chron") { this.unread = 0; this.updateBadge(); this.chronDirty = true; }
    if (n === "world") { this.lastDetails = ""; this.renderDetails(); }
    setTimeout(() => this.syncInset(), 30);
    setTimeout(() => this.syncInset(), 320);
  }

  closeSheet(): void {
    for (const k of ["powers", "world", "chron"] as const) { const el = this.sheetEl(k); el.classList.remove("open"); el.style.transform = ""; el.style.transition = ""; }
    this.sheet = null;
    $("app").classList.remove("sheet-open");
    document.querySelectorAll("#tabbar [data-sheet]").forEach((b) => b.classList.remove("on"));
    this.syncInset();
  }

  /** Recentre la scène dans la zone visible au-dessus du tiroir. */
  private syncInset(): void {
    const r = this.game.renderer;
    if (!this.mobile) { r.setBottomInset(0); return; }
    let px = 0;
    if (this.sheet) { const rect = this.sheetEl(this.sheet).getBoundingClientRect(); px = Math.max(0, window.innerHeight - rect.top - ($("tabbar").offsetHeight || 0)); }
    else if (this.power) px = 70;
    r.setBottomInset(px);
  }

  private updateBadge(): void {
    const b = document.querySelector<HTMLElement>('#tabbar [data-sheet="chron"] .badge');
    if (b) { b.style.display = this.unread > 0 && this.sheet !== "chron" ? "block" : "none"; b.textContent = this.unread > 9 ? "9+" : String(this.unread); }
  }

  /** Glisser vers le bas pour refermer (touch). Ne démarre que si le contenu est tout en haut. */
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
      if (!drag && d > 10 && (!scroller || scroller.scrollTop <= 0)) { drag = true; el.style.transition = "none"; }
      if (drag) { e.preventDefault(); dy = Math.max(0, d - 10); el.style.transform = `translateY(${dy}px)`; }
    }, { passive: false });
    const end = () => {
      if (!drag) return;
      drag = false;
      const v = dy / Math.max(1, performance.now() - t0);
      el.style.transition = "";
      if (dy > Math.min(110, el.offsetHeight * 0.25) || v > 0.6) { onClose(); el.style.transform = ""; }
      else el.style.transform = "";
    };
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
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
      const col = { lightning: 0xbcd8ff, meteor: 0xff8a4a, rain: 0x8fc5ff, plague: 0x9be04a, wrath: 0xff5a3a }[this.power as string] ?? 0xffffff;
      r.setCursor(this.cursor.x, this.cursor.y, info.radius, col);
    }
    this.refreshTargetInfo(false);
  }

  private refreshTargetInfo(force: boolean): void {
    const box = $("target-info");
    const now = performance.now();
    if (!force && now - this.lastInfo < 120) return;
    this.lastInfo = now;
    if (!this.power) {
      box.innerHTML = `<b>Aucun pouvoir actif.</b><br>Choisissez un pouvoir, puis désignez une cible. Ou observez : c'est gratuit, et souvent pire.`;
      return;
    }
    const info = POWER_BY_ID[this.power];
    const cd = this.sim.divine.cooldownLeft(this.sim, this.power);
    let html = `<b>${info.name}</b> — ${esc(info.detail)}`;
    if (cd > 0) html += `<br><span style="color:var(--red)">Repos divin : ${Math.ceil(cd / TICKS_PER_YEAR)} an(s).</span>`;
    if (this.cursor) {
      const { x, y } = this.cursor;
      if (info.target === "area") {
        let pop = 0, b = 0;
        for (const c of this.sim.citizens) if (Math.hypot(c.x - x, c.y - y) <= info.radius) pop++;
        for (const bb of this.sim.buildings) if (bb.civ >= 0 && Math.hypot(bb.x + 0.5 - x, bb.y + 0.5 - y) <= info.radius) b++;
        const civ = this.sim.divine.civAt(this.sim, x, y);
        html += `<br><br>Zone ciblée : <b>${pop}</b> habitant(s), <b>${b}</b> bâtiment(s)${civ ? ` · territoire de <b style="color:${hex(civ.color)}">${esc(civ.name)}</b>` : " · terres sans maître"}.`;
      } else {
        const civ = this.sim.divine.civAt(this.sim, x, y);
        if (civ) {
          html += `<br><br>Cible : <b style="color:${hex(civ.color)}">${esc(civ.formal)}</b>`;
          if (this.power === "prophecy") {
            const o = this.sim.divine.understanding(civ);
            $("prophecy-odds").innerHTML = `Chance qu'ils comprennent : <b>${Math.round(o * 100)} %</b><br>Intelligence ${(civ.avgIntel * 100).toFixed(0)} % · foi ${(civ.avgFaith * 100).toFixed(0)} % · dirigeant ${(civ.leader.intel * 100).toFixed(0)} %`;
          }
        } else html += `<br><br>Aucune civilisation sous le curseur.`;
      }
    }
    box.innerHTML = html;
  }

  private onMapClick(x: number, y: number, pointer = "mouse"): void {
    const sim = this.sim;
    const touch = pointer !== "mouse";
    if (this.power) {
      const p = this.power;
      if (this.pending.has(p)) return;
      const cd = sim.divine.cooldownLeft(sim, p);
      if (cd > 0) { this.toast(`${POWER_BY_ID[p].name} : encore ${Math.ceil(cd / TICKS_PER_YEAR)} an(s) de repos divin.`, "", false); return; }
      const run = () => {
        this.pending.delete(p);
        const res = sim.divine.cast(sim, p, x, y, { prophecy: this.prophecyId });
        this.toast(res.msg, "", false);
        if (touch) this.game.renderer.setCursor(0, 0, 0, null);
        this.notifs.unshift({ year: sim.year, text: res.msg });
        this.lastDetails = "";
      };
      if (p === "meteor") {
        this.pending.add(p);
        this.game.renderer.fx.meteorIncoming(x, y, sim.world.size, sim.world, run);
      } else run();
      return;
    }
    this.selectAt(x, y, touch);
  }

  // ------------------------------------------------------------ sélection

  private selectAt(x: number, y: number, touch = false): void {
    const sim = this.sim;
    const k = touch ? 1.5 : 1;
    let best: { d: number; kind: "citizen" | "building" | "city"; id: number } | null = null;
    for (const c of sim.citizens) {
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < 0.85 * k && (!best || d < best.d)) best = { d, kind: "citizen", id: c.id };
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
    if (best) this.select(best.kind, best.id);
    else {
      const civ = sim.divine.civAt(sim, x, y);
      if (civ && sim.world.owner[sim.world.tileAt(x, y)] === civ.id) this.select("civ", civ.id);
      else { this.select("none", -1); if (this.mobile) this.closeSheet(); }
    }
  }

  select(kind: "none" | "civ" | "citizen" | "city" | "building", id: number): void {
    this.sel = { kind, id };
    this.game.renderer.selection = { kind, id };
    this.lastDetails = "";
    if (kind === "none") this.game.renderer.clearSelection();
    this.renderDetails();
    if (kind !== "none" && this.mobile) this.openSheet("world");
  }

  /** Appelé à chaque frame : l'anneau de sélection suit sa cible. */
  frame(): void {
    const sim = this.sim, r = this.game.renderer;
    const s = this.sel;
    if (s.kind === "citizen") {
      const c = sim.citizenById.get(s.id);
      if (c && !c.dead) { const civ = sim.civById.get(c.civ); r.setSelectionRing(c.x, c.y, 0.45, civ?.color ?? 0xffffff); }
      else this.select("none", -1);
    } else if (s.kind === "civ") {
      const civ = sim.civById.get(s.id);
      const cap = civ ? sim.cityById.get(civ.capital) ?? sim.cities.find((c) => c.civ === civ.id) : null;
      if (civ && cap) r.setSelectionRing(cap.x + 0.5, cap.y + 0.5, 2.2, civ.color);
      else r.clearSelection();
    } else if (s.kind === "city") {
      const c = sim.cityById.get(s.id);
      if (c) r.setSelectionRing(c.x + 0.5, c.y + 0.5, 1.4, sim.civById.get(c.civ)?.color ?? 0xffffff); else this.select("none", -1);
    } else if (s.kind === "building") {
      const b = sim.buildingById.get(s.id);
      if (b && b.hp >= 0) r.setSelectionRing(b.x + 0.5, b.y + 0.5, 0.7, sim.civById.get(b.civ)?.color ?? 0xaaaaaa); else this.select("none", -1);
    }
    const now = performance.now();
    if (now - this.lastHud > 250) { this.lastHud = now; this.hud(); }
  }

  // ------------------------------------------------------------ HUD

  private hud(): void {
    const sim = this.sim;
    $("s-year").textContent = String(sim.year);
    $("s-pop").textContent = String(sim.totalPop());
    $("s-civs").textContent = String(sim.aliveCivs().length);
    const wars = sim.activeWars().length;
    $("s-wars").textContent = String(wars);
    $("s-wars-wrap").classList.toggle("warn", wars > 0);
    $("s-bored").style.width = `${Math.round(sim.boredom)}%`;
    // cooldowns
    document.querySelectorAll<HTMLButtonElement>(".power").forEach((b) => {
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
      this.updateCivSelect(false);
    }
    if (this.chronDirty) this.renderChron();
    this.renderDetails();
    this.updateSpeedButtons();
    if (this.power) this.refreshTargetInfo(false);
  }

  private updateCivSelect(force: boolean): void {
    const sel = $<HTMLSelectElement>("f-civ");
    const opts = ["Toutes les civilisations", ...this.sim.civs.map((c) => c.name)].join("|");
    if (!force && opts === this.lastCivOpts) return;
    this.lastCivOpts = opts;
    sel.innerHTML = `<option value="-2">Toutes les civilisations</option><option value="-1">Monde (sans civilisation)</option>` +
      this.sim.civs.map((c) => `<option value="${c.id}">${esc(c.name)}${c.alive ? "" : " †"}</option>`).join("");
    sel.value = String(this.civFilter);
  }

  // ------------------------------------------------------------ panneau de droite

  private bar(v: number, max: number, cls = ""): string {
    return `<div class="bar ${cls}"><i style="width:${Math.max(0, Math.min(100, (v / max) * 100)).toFixed(0)}%"></i></div>`;
  }

  private renderDetails(): void {
    const sim = this.sim;
    let html = "";
    let title = "Observation";
    const s = this.sel;
    if (s.kind === "civ") {
      const civ = sim.civById.get(s.id);
      if (civ) { title = "Civilisation"; html = this.civHtml(civ); } else this.sel = { kind: "none", id: -1 };
    } else if (s.kind === "citizen") {
      const c = sim.citizenById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (c && civ) {
        title = "Habitant";
        const faith = c.faith > 0.7 ? "fervent" : c.faith > 0.4 ? "pratiquant" : "tiède";
        html = `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(c.name)}</h2></div>
        <div class="quote">${esc(JOB_LABEL[c.job])} de ${esc(civ.name)} — ${esc(STATE_LABEL[c.state] ?? c.state)}${c.sick > 0 ? " (malade)" : ""}</div>
        <div class="kv"><span>Identifiant</span><b>#${c.id}</b><span>Âge</span><b>${Math.floor(c.age)} ans</b><span>Position</span><b>${c.x.toFixed(1)} ; ${c.y.toFixed(1)}</b>
        <span>Ville</span><b>${esc(sim.cityById.get(c.city)?.name ?? "—")}</b><span>Croyance</span><b>${esc(civ.religion.name)}</b></div>
        <div class="kv"><span>Santé</span><b>${Math.round(c.hp)}</b></div>${this.bar(c.hp, 100, c.hp < 35 ? "red" : "green")}
        <div class="kv"><span>Faim</span><b>${Math.round(c.hunger)}</b></div>${this.bar(c.hunger, 100, c.hunger > 70 ? "red" : "")}
        <div class="kv"><span>Intelligence</span><b>${Math.round(c.intel * 100)}</b></div>${this.bar(c.intel, 1, "blue")}
        <div class="kv"><span>Courage</span><b>${Math.round(c.courage * 100)}</b></div>${this.bar(c.courage, 1)}
        <div class="kv"><span>Agressivité</span><b>${Math.round(c.aggr * 100)}</b></div>${this.bar(c.aggr, 1, "red")}
        <div class="kv"><span>Foi</span><b>${faith}</b></div>${this.bar(c.faith, 1)}
        <p><button class="link" data-go="civ:${civ.id}">Voir ${esc(civ.name)}</button></p>`;
      } else this.sel = { kind: "none", id: -1 };
    } else if (s.kind === "city") {
      const c = sim.cityById.get(s.id);
      const civ = c ? sim.civById.get(c.civ) : undefined;
      if (c && civ) {
        title = "Ville";
        const counts: Record<string, number> = {};
        const nm = (t: string, e: number) => (ERA_BUILDING_NAMES[t]?.[Math.min(5, e)] ?? BUILDING_LABEL[t as keyof typeof BUILDING_LABEL]);
        for (const b of sim.buildings) if (b.city === c.id && b.civ >= 0 && b.progress >= 1) { const k = nm(b.type, b.era) + (b.up >= 0 ? " (modernisation)" : ""); counts[k] = (counts[k] ?? 0) + 1; }
        const sites = sim.buildings.filter((b) => b.city === c.id && b.progress < 1 && b.civ >= 0).length;
        html = `<div class="h-civ"><span class="sw" style="background:${hex(civ.color)}"></span><h2>${esc(c.name)}</h2></div>
        <div class="quote">${civ.capital === c.id ? "Capitale" : "Ville"} de ${esc(civ.formal)}</div>
        <div class="kv"><span>Population</span><b>${c.pop} / ${c.cap}</b><span>Fondée en</span><b>An ${c.foundedYear}</b><span>Remparts</span><b>${Math.round(c.hp)} / ${c.maxHp}</b>
        <span>Statut</span><b>${c.siege > 0 ? "Assiégée" : "Paisible"}</b><span>Chantiers</span><b>${sites}</b></div>
        <div class="sec">Bâtiments</div>
        <div class="kv">${Object.entries(counts).sort().map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join("") || "<span>Aucun</span><b>—</b>"}</div>
        <p><button class="link" data-go="civ:${civ.id}">Voir ${esc(civ.name)}</button></p>`;
      } else this.sel = { kind: "none", id: -1 };
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
      } else this.sel = { kind: "none", id: -1 };
    }
    if (this.sel.kind === "none") {
      title = "Observation";
      const civs = sim.civs.slice().sort((a, b) => Number(b.alive) - Number(a.alive) || b.pop - a.pop);
      html = `<div class="empty">Aucune sélection. Cliquez sur un territoire, une ville ou un habitant. Ou choisissez un favori ci-dessous.</div>` +
        civs.map((c) => `<button class="civcard ${c.alive ? "" : "dead"}" data-go="civ:${c.id}"><span class="sw" style="background:${hex(c.color)}"></span>
        <span><b>${esc(c.name)}</b>${c.alive ? "" : " †"}<small>${c.alive ? `${c.pop} hab. · ${PERSONALITY_LABEL[c.personality]} · ${ERA_NAMES[c.era]}` : `Disparue en l'an ${c.extinctYear}`}</small></span></button>`).join("");
    }
    if (this.sel.kind !== "none") html = `<p><button class="link back" data-go="none:-1">← Toutes les civilisations</button></p>` + html;
    $("right-title").textContent = title;
    document.querySelectorAll<HTMLElement>("#right .gt").forEach((g) => (g.textContent = title === "Observation" ? "Monde" : title));
    if (html !== this.lastDetails) {
      const el = $("details");
      const top = $("right").scrollTop;
      el.innerHTML = html;
      $("right").scrollTop = top;
      this.lastDetails = html;
      el.querySelectorAll<HTMLButtonElement>("[data-go]").forEach((b) => b.addEventListener("click", () => {
        const [k, id] = b.dataset.go!.split(":");
        this.select(k as "civ" | "none", Number(id));
        if (k === "none") return;
        const civ = this.sim.civById.get(Number(id));
        const cap = civ ? this.sim.cityById.get(civ.capital) : null;
        if (cap) this.game.renderer.focusOn(cap.x + 0.5, cap.y + 0.5, 38);
      }));
    }
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

  private civHtml(civ: Civ): string {
    const sim = this.sim;
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

  // ------------------------------------------------------------ chroniques & notifications

  private onEvent(e: ChronicleEntry): void {
    this.chronDirty = true;
    if (e.importance >= 2 && this.sheet !== "chron") { this.unread++; this.updateBadge(); }
    if (e.importance >= 2) {
      const civ = this.sim.civById.get(e.civ);
      const fast = this.sim.speed >= 3 && !this.sim.paused;
      if (!fast || e.importance === 3) this.toast(e.text, e.consequences, e.type === "war" || e.type === "catastrophe", e.importance === 3, e.type);
      this.notifs.unshift({ year: e.year, text: e.text });
      if (this.notifs.length > 80) this.notifs.pop();
      void civ;
      if (this.tab === "notif") this.renderNotifs();
    }
  }

  private matches(e: ChronicleEntry): boolean {
    const f = FILTERS.find((x) => x.id === this.filter)!;
    if (f.types && !f.types.includes(e.type)) return false;
    if (this.civFilter === -1) return e.civ < 0;
    if (this.civFilter >= 0 && e.civ !== this.civFilter && e.civ2 !== this.civFilter) return false;
    return true;
  }

  private renderChron(): void {
    this.chronDirty = false;
    const list = $("chron-list");
    const out: string[] = [];
    const ch = this.sim.chronicle;
    for (let i = ch.length - 1; i >= 0 && out.length < 140; i--) {
      const e = ch[i];
      if (!this.matches(e)) continue;
      const civ = this.sim.civById.get(e.civ);
      out.push(`<div class="ev i${e.importance} type-${e.type}"><div class="y">An ${e.year}</div><div><div class="t"><span class="dot" style="background:${civ ? hex(civ.color) : "#888"}"></span>${esc(e.text)}</div>${e.consequences ? `<div class="c">${TYPE_ICON[e.type]} ${esc(e.consequences)}</div>` : ""}</div></div>`);
    }
    list.innerHTML = out.join("") || `<div class="empty" style="padding:10px">Rien à signaler. Ce qui, en histoire, est toujours suspect.</div>`;
  }

  private renderNotifs(): void {
    $("notif-list").innerHTML = this.notifs.map((n) => `<div class="ev"><div class="y">An ${n.year}</div><div class="t">${esc(n.text)}</div></div>`).join("") || `<div class="empty" style="padding:10px">Aucune notification. Les mortels se tiennent bien. Pour l'instant.</div>`;
  }

  toast(text: string, sub = "", war = false, big = false, _type?: string): void {
    const box = $("toasts");
    const mob = this.mobile;
    const t = document.createElement("div");
    t.className = `toast ${war ? "war" : ""} ${big && !mob ? "big" : ""}`;
    t.innerHTML = `${esc(text)}${sub && !mob ? `<small>${esc(sub)}</small>` : ""}`;
    box.appendChild(t);
    while (box.children.length > (mob ? 2 : 3)) box.firstElementChild?.remove();
    setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 600); }, mob ? (big ? 4200 : 3000) : big ? 7000 : 4500);
    t.addEventListener("click", () => t.remove());
  }

  // ------------------------------------------------------------ modales

  private menuHtml(withTitle: boolean): string {
    return `${withTitle ? "<h2>Menu divin</h2>" : '<div class="sec">Partie</div>'}
      <div class="row" style="justify-content:flex-start">
        <button class="secondary" id="m-save">Sauvegarder</button>
        <button class="secondary" id="m-load" ${this.game.hasSave() ? "" : "disabled"}>Charger</button>
        <button class="secondary desk-only" id="m-export">Exporter (.json)</button>
      </div>
      <p class="quote">Sauvegarde automatique toutes les 45 secondes dans ce navigateur.</p>
      <div class="sec">Nouveau monde</div>
      <div class="row" style="justify-content:flex-start"><label>Graine <input id="m-seed" type="text" inputmode="numeric" placeholder="aléatoire" style="width:120px" /></label>
      <button class="primary" id="m-new">Recommencer l'humanité</button></div>
      <p class="quote">Même graine, même carte. Pas la même histoire : vous y êtes pour quelque chose.</p>
      <div class="sec desk-only">Commandes</div>
      <p class="law desk-only">Clic gauche glissé : pivoter · Clic droit / 2 doigts : déplacer · Molette / pincement : zoom · WASD/flèches : déplacer · Q/E : pivoter · Espace : pause · 1/2/3 : vitesses · Échap : annuler le pouvoir.</p>
      <div class="sec mob-only">Commandes tactiles</div>
      <p class="law mob-only">1 doigt : déplacer la vue · 2 doigts : zoom (et pivoter en les faisant glisser) · toucher un habitant ou une ville : sa fiche · glisser une fenêtre vers le bas : la fermer.</p>`;
  }

  private bindMenu(): void {
    $("m-save").addEventListener("click", () => { this.toast(this.game.save(), "", false); });
    $("m-load").addEventListener("click", () => { if (this.game.load()) $("modal").classList.add("hidden"); });
    $("m-export").addEventListener("click", () => this.game.exportSave());
    $("m-new").addEventListener("click", () => {
      const v = ($("m-seed") as HTMLInputElement).value.trim();
      this.game.newWorld(v ? Number(v.replace(/\D/g, "")) || undefined : undefined);
      $("modal").classList.add("hidden");
    });
  }

  private showMenu(): void {
    $("modal-body").innerHTML = this.menuHtml(true);
    $("modal").classList.remove("hidden");
    this.bindMenu();
  }

  private showStats(): void {
    const sim = this.sim, st = sim.stats;
    const alive = sim.aliveCivs();
    const soldiers = alive.reduce((a, c) => a + c.soldiers, 0);
    const buildings = sim.buildings.filter((b) => b.civ >= 0 && b.progress >= 1).length;
    const avgTech = alive.length ? alive.reduce((a, c) => a + c.tech, 0) / alive.length : 0;
    const body = $("modal-body");
    body.innerHTML = `<h2>Statistiques mondiales — An ${sim.year}</h2>
      <div class="grid2 kv"><span>Habitants</span><b>${sim.totalPop()}</b><span>Pic de population</span><b>${st.peakPop}</b><span>Civilisations vivantes</span><b>${alive.length} / ${sim.civs.length}</b>
      <span>Villes</span><b>${sim.cities.length}</b><span>Bâtiments</span><b>${buildings}</b><span>Soldats</span><b>${soldiers}</b><span>Niveau technologique moyen</span><b>${avgTech.toFixed(1)}</b>
      <span>Guerres actives / total</span><b>${sim.activeWars().length} / ${st.warsStarted}</b><span>Naissances</span><b>${st.births}</b><span>Décès (total)</span><b>${st.deaths}</b>
      <span>— de vieillesse</span><b>${st.oldAgeDeaths}</b><span>— de faim</span><b>${st.famineDeaths}</b><span>— de guerre</span><b>${st.warDeaths}</b>
      <span>— de peste</span><b>${st.plagueDeaths}</b><span>— de votre fait</span><b>${st.godDeaths}</b><span>Villes fondées</span><b>${st.citiesFounded}</b></div>
      <div class="sec">Population par civilisation</div><canvas id="chart" class="chart"></canvas><div class="legend" id="legend"></div>
      ${this.mobile ? this.menuHtml(false) : ""}`;
    $("modal").classList.remove("hidden");
    this.drawChart();
    if (this.mobile) this.bindMenu();
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
    for (const civ of this.sim.civs) {
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
    $("legend").innerHTML = this.sim.civs.map((c) => `<span><span class="sw" style="display:inline-block;background:${hex(c.color)}"></span> ${esc(c.name)}${c.alive ? "" : " †"}</span>`).join("");
  }

  /** Monde recréé / rechargé : on repart d'un état propre. */
  rebind(): void {
    this.attach();
  }
}
