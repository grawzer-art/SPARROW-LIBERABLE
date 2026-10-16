/** Bruitages discrets de la capsule, générés à la volée (aucun fichier audio). */
export class CapsuleSfx {
  enabled = true;
  private ctx: AudioContext | null = null;
  private humNode: { o: OscillatorNode; g: GainNode } | null = null;

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

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, slide = 0) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol: number, delay = 0, freq = 1800) {
    const ctx = this.ac();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start(t);
  }

  /** Cran du cadran. */
  tick(delay = 0) {
    this.noise(0.03, 0.12, delay, 3200);
  }
  /** Série de crans (cadran qui tourne). */
  dial(n = 10, spacing = 0.09) {
    for (let i = 0; i < n; i++) this.tick(i * spacing + Math.random() * 0.02);
  }
  deny() {
    this.tone(140, 0.32, "sawtooth", 0.05);
    this.tone(110, 0.38, "sawtooth", 0.05, 0.28);
  }
  grant() {
    [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.05, i * 0.08));
  }
  seal() {
    this.noise(0.12, 0.25, 0, 300);
    this.tone(90, 0.25, "sine", 0.12, 0, -40);
  }
  clunk() {
    this.noise(0.18, 0.3, 0, 220);
    this.tone(60, 0.35, "sine", 0.14, 0, -20);
  }
  beep() {
    this.tone(1320, 0.07, "square", 0.025);
  }
  humStart() {
    const ctx = this.ac();
    if (!ctx || this.humNode) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 180;
    o.frequency.linearRampToValueAtTime(420, ctx.currentTime + 1.6);
    g.gain.value = 0.02;
    o.connect(g).connect(ctx.destination);
    o.start();
    this.humNode = { o, g };
  }
  humStop() {
    if (!this.humNode || !this.ctx) return;
    const { o, g } = this.humNode;
    g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);
    o.stop(this.ctx.currentTime + 0.12);
    this.humNode = null;
  }
}
