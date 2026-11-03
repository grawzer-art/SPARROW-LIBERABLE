import * as THREE from "three";
import type { Sky } from "./Sky";

/** Halos lumineux nocturnes (additifs) : feux, lanternes, fenêtres, lampadaires, LED, selon l'époque réellement atteinte. */
/** Couleur et taille d'une source de lumière nocturne selon l'époque : foyer, chandelle, lanterne, gaz, ampoule, LED. */
export function lightStyle(era: number, k = 1): [number, number] {
  switch (era) {
    case 0: return [0xff8a2a, 0.55 * k];
    case 1: return [0xffa850, 0.34 * k];
    case 2: return [0xffb860, 0.38 * k];
    case 3: return [0xffd070, 0.46 * k];
    case 4: return [0xfff0c8, 0.5 * k];
    default: return [0x7fe8ff, 0.55 * k];
  }
}

export class Glow {
  private pts: THREE.Points;
  private pos: Float32Array; private col: Float32Array; private size: Float32Array;
  private cap: number;
  private uniforms = { uScale: { value: 600 }, uTex: { value: null as THREE.Texture | null }, uNight: { value: 0 } };
  private c = new THREE.Color();
  constructor(scene: THREE.Scene, private sky: Sky, cap = 900) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3); this.col = new Float32Array(cap * 3); this.size = new Float32Array(cap);
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.3, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.uniforms.uTex.value = new THREE.CanvasTexture(cv);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aColor", new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute vec3 aColor; attribute float aSize; uniform float uScale; varying vec3 vC;
        void main(){ vC=aColor; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0, aSize*uScale/max(0.1,-mv.z)); }`,
      fragmentShader: `uniform sampler2D uTex; uniform float uNight; varying vec3 vC;
        void main(){ float a=texture2D(uTex, gl_PointCoord).a; gl_FragColor=vec4(vC*a*uNight, a*uNight); }`,
    });
    this.pts = new THREE.Points(geo, mat);
    this.pts.frustumCulled = false; this.pts.renderOrder = 13;
    geo.setDrawRange(0, 0);
    scene.add(this.pts);
  }
  setScale(heightPx: number, fovDeg: number): void { this.uniforms.uScale.value = (heightPx * 0.5) / Math.tan((fovDeg * Math.PI) / 360); }
  private style(era: number, k: number): [number, number] {
    return lightStyle(era, k);
  }
  private _unused(era: number, k: number): [number, number] {
    switch (era) {
      case 0: return [0xff8a2a, 0.55 * k];
      case 1: return [0xffa850, 0.34 * k];
      case 2: return [0xffb860, 0.38 * k];
      case 3: return [0xffd070, 0.46 * k];
      case 4: return [0xfff0c8, 0.5 * k];
      default: return [0x7fe8ff, 0.55 * k];
    }
  }
  update(lights: [number, number, number, number, number][], fires: [number, number, number][], lamps: [number, number, number][], time: number): void {
    const night = this.sky.night;
    this.uniforms.uNight.value = night;
    if (night < 0.05) { this.pts.geometry.setDrawRange(0, 0); return; }
    let n = 0;
    const put = (x: number, y: number, z: number, hex: number, sz: number) => {
      if (n >= this.cap) return;
      this.c.setHex(hex);
      this.pos[n * 3] = x; this.pos[n * 3 + 1] = y; this.pos[n * 3 + 2] = z;
      this.col[n * 3] = this.c.r; this.col[n * 3 + 1] = this.c.g; this.col[n * 3 + 2] = this.c.b;
      this.size[n] = sz; n++;
    };
    for (const [x, y, z, era, k] of lights) { const [h, s] = this.style(era, k); put(x, y, z, h, s * (0.92 + 0.08 * Math.sin(time * 9 + x * 13 + z * 7))); }
    for (const [x, y, z] of lamps) put(x, y + 0.3, z, 0xffe0a0, 0.5);
    for (const [x, y, z] of fires) put(x, y + 0.18, z, 0xff8a2a, 0.9 + 0.15 * Math.sin(time * 11 + x * 5));
    const g = this.pts.geometry;
    g.setDrawRange(0, n);
    for (const k of ["position", "aColor", "aSize"]) (g.attributes[k] as THREE.BufferAttribute).needsUpdate = true;
  }
}
