import * as THREE from "three";

const lerp3 = (a: number, b: number, t: number, out: THREE.Color) => out.setHex(a).lerp(new THREE.Color(b), t);

/**
 * Lumière du jour : soleil chaud et ombres douces, ciel hémisphérique, brume atmosphérique, cycle jour/nuit.
 * `night` (0 jour, 1 nuit profonde) pilote aussi l'éclairage artificiel (fenêtres, lampadaires, feux).
 */
export class Sky {
  readonly uniforms = { uTime: { value: 0 }, uNight: { value: 0 } };
  time = 0.4; // 0 minuit · 0.25 aube · 0.5 midi · 0.75 crépuscule
  auto = true;
  night = 0;
  private fog: THREE.FogExp2;
  private c1 = new THREE.Color();
  private c2 = new THREE.Color();
  private cssClock = 0;
  /** Durée d'une journée en secondes réelles. */
  dayLength = 200;

  constructor(private scene: THREE.Scene, private sun: THREE.DirectionalLight, private hemi: THREE.HemisphereLight, private ambient: THREE.AmbientLight, private renderer: THREE.WebGLRenderer, private mobile: boolean) {
    this.fog = new THREE.FogExp2(0x8ea3c0, mobile ? 0.0032 : 0.0026);
    scene.fog = this.fog;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.apply(0);
  }

  setTime(t: number): void {
    this.time = ((t % 1) + 1) % 1;
    this.apply(0);
  }

  update(dt: number): void {
    this.uniforms.uTime.value += dt;
    if (this.auto) { this.time = (this.time + dt / this.dayLength) % 1; }
    this.cssClock += dt;
    if (this.cssClock > 0.4 || !this.auto) { this.cssClock = 0; this.apply(dt); }
  }

  private apply(_dt: number): void {
    const t = this.time;
    const elev = Math.sin((t - 0.25) * Math.PI * 2); // -1..1
    const day = Math.max(0, Math.min(1, (elev + 0.12) / 0.5)); // 0 nuit .. 1 plein jour
    this.night = 1 - day;
    this.uniforms.uNight.value = this.night;
    const az = (t - 0.5) * Math.PI * 1.1 - 0.7;
    const el = Math.max(0.2, elev * 1.0 + 0.1) * 1.0 + 0.12;
    const L = 80;
    this.sun.position.set(Math.sin(az) * L * Math.cos(el * 0.9), L * Math.sin(Math.min(1.35, el * 1.15)), Math.cos(az) * L * Math.cos(el * 0.9) + 8);
    // couleur du soleil : blanc chaud le jour, orange à l'horizon, bleu lunaire la nuit
    const warm = 1 - Math.min(1, Math.max(0, elev - 0.05) / 0.45);
    lerp3(0xfff0d8, 0xff9a55, warm * (1 - this.night), this.sun.color);
    this.sun.color.lerp(this.c1.setHex(0x7f98ff), this.night);
    this.sun.intensity = 0.38 + 2.5 * day;
    lerp3(0xdbe8ff, 0xffc7a0, warm * (1 - this.night) * 0.6, this.hemi.color);
    this.hemi.color.lerp(this.c1.setHex(0x30427a), this.night);
    this.hemi.groundColor.setHex(0x7a6650).lerp(this.c1.setHex(0x1a1f33), this.night);
    this.hemi.intensity = 0.62 + 0.75 * day;
    this.ambient.intensity = 0.1 + 0.08 * this.night;
    // brume
    lerp3(0x8ea3c0, 0xc9a98f, warm * (1 - this.night) * 0.5, this.fog.color);
    this.fog.color.lerp(this.c1.setHex(0x111a30), this.night * 0.92);
    this.renderer.toneMappingExposure = 1.0 - 0.08 * this.night;
    // fond (CSS) : dégradé du ciel
    if (typeof document === "undefined") return;
    const root = document.documentElement.style;
    lerp3(0xa9bdd6, 0xe6b48a, warm * (1 - this.night) * 0.55, this.c2);
    this.c2.lerp(this.c1.setHex(0x2a3868), this.night);
    root.setProperty("--sky-a", "#" + this.c2.getHexString());
    lerp3(0x3a4662, 0x4a3f55, warm * (1 - this.night) * 0.5, this.c2);
    this.c2.lerp(this.c1.setHex(0x0a0f1e), this.night);
    root.setProperty("--sky-b", "#" + this.c2.getHexString());
  }
}
