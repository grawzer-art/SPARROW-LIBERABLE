/** Petits sons 8-bit générés à la volée (aucun fichier audio). Coupés par défaut. */
export class Chiptune {
  private ctx: AudioContext | null = null;
  enabled = false;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType = "square", vol = 0.06, slide = 0, delay = 0) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  jump(double: boolean) {
    this.tone(double ? 520 : 380, 0.12, "square", 0.05, double ? 400 : 300);
  }
  coin() {
    this.tone(988, 0.07, "square", 0.05);
    this.tone(1319, 0.16, "square", 0.05, 0, 0.07);
  }
  power() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.1, "triangle", 0.07, 0, i * 0.07));
  }
  hit() {
    this.tone(180, 0.25, "sawtooth", 0.07, -120);
  }
  milestone() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.14, "square", 0.05, 0, i * 0.1));
  }
  over() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.22, "triangle", 0.08, 0, i * 0.18));
  }
  win() {
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.16, "square", 0.05, 0, i * 0.12));
  }

  // ─── Combat ───

  private noise(dur: number, vol = 0.08, delay = 0, freq = 1200) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const len = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
  select() {
    this.tone(660, 0.05, "square", 0.04);
  }
  encounter() {
    [880, 660, 880, 660, 1046].forEach((f, i) => this.tone(f, 0.08, "square", 0.05, 0, i * 0.08));
  }
  strike(crit = false) {
    this.noise(crit ? 0.3 : 0.18, crit ? 0.14 : 0.1, 0, crit ? 2400 : 1400);
    this.tone(crit ? 140 : 200, 0.15, "square", 0.05, -100);
  }
  fire() {
    this.noise(0.4, 0.08, 0, 900);
    this.tone(300, 0.3, "sawtooth", 0.03, 300);
  }
  heal() {
    [523, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.1, "triangle", 0.05, 0, i * 0.06));
  }
  buff(up: boolean) {
    this.tone(up ? 400 : 800, 0.25, "square", 0.04, up ? 600 : -500);
  }
  miss() {
    this.tone(500, 0.12, "triangle", 0.04, -250);
  }
  faint() {
    this.tone(500, 0.6, "square", 0.05, -440);
  }
  charge() {
    this.tone(200, 0.5, "sawtooth", 0.03, 600);
  }

  private loop: ReturnType<typeof setInterval> | undefined;
  /** Petite boucle de combat (basse + mélodie), coupée avec le son. */
  music(kind: "combat" | "boss" | null) {
    clearInterval(this.loop);
    this.loop = undefined;
    if (!kind || !this.enabled) return;
    const bass = kind === "boss" ? [110, 110, 131, 110, 98, 98, 117, 131] : [131, 131, 165, 131, 147, 147, 175, 147];
    const lead = kind === "boss" ? [440, 0, 523, 494, 440, 0, 392, 415, 440, 0, 523, 587, 659, 587, 523, 494] : [523, 0, 659, 0, 587, 523, 494, 0, 523, 0, 659, 784, 698, 659, 587, 0];
    let i = 0;
    const beat = kind === "boss" ? 0.13 : 0.15;
    this.loop = setInterval(() => {
      if (!this.enabled) return this.music(null);
      const b = bass[Math.floor(i / 2) % bass.length];
      if (i % 2 === 0) this.tone(b, beat * 1.8, "triangle", 0.05);
      const l = lead[i % lead.length];
      if (l) this.tone(l, beat * 0.9, "square", 0.018);
      if (i % 4 === 2) this.noise(0.04, 0.03, 0, 6000);
      i++;
    }, beat * 1000);
  }
}
