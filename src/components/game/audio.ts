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
}
