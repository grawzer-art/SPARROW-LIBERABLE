import * as THREE from "three";

/**
 * Petites particules d'ambiance autour de la caméra (un seul draw call, aucune allocation par image) :
 * pollen et poussières dorées le jour, lucioles chaudes la nuit. Le nombre s'adapte à la qualité ; invisible de loin.
 */
export class Ambient {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private seed: Float32Array;
  private mat: THREE.ShaderMaterial;
  private n: number;

  constructor(scene: THREE.Scene, count: number) {
    this.n = count;
    this.pos = new Float32Array(count * 3);
    this.seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) { this.seed[i * 2] = Math.random() * 100; this.seed[i * 2 + 1] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aSeed", new THREE.BufferAttribute(this.seed, 2));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uNight: { value: 0 }, uTime: { value: 0 }, uPx: { value: 1 }, uFade: { value: 1 } },
      vertexShader: `attribute vec2 aSeed; uniform float uNight; uniform float uTime; uniform float uPx; varying float vA; varying float vN;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mv;
 float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed.y * 2.0) + aSeed.x);
 vA = tw; vN = uNight; gl_PointSize = uPx * (0.9 + aSeed.y * 1.4 + uNight * 1.6) * (14.0 / max(1.0, -mv.z)); }`,
      fragmentShader: `uniform float uFade; varying float vA; varying float vN;
void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.0, d); a *= a;
 vec3 day = vec3(1.0, 0.92, 0.66), night = vec3(0.78, 1.0, 0.42); vec3 col = mix(day, night, vN);
 gl_FragColor = vec4(col, a * vA * uFade * mix(0.32, 0.9, vN)); }`,
    });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false; this.points.renderOrder = 8;
    scene.add(this.points);
  }

  update(time: number, target: THREE.Vector3, camDist: number, night: number, px: number): void {
    // seulement de près : au-delà de ~40 unités l'effet ne se voit plus
    const fade = Math.max(0, Math.min(1, (46 - camDist) / 22));
    this.points.visible = fade > 0.02;
    if (!this.points.visible) return;
    const R = Math.max(7, Math.min(20, camDist * 0.85));
    const pos = this.pos, s = this.seed;
    for (let i = 0; i < this.n; i++) {
      const a = s[i * 2], b = s[i * 2 + 1];
      // dérive lente et sinueuse, bouclée dans un cylindre autour de la cible
      const u = (a * 0.37 + time * (0.012 + b * 0.02)) % 1, v = (a * 0.71 + time * (0.01 + b * 0.015)) % 1;
      const ang = u * 6.2832, rad = Math.sqrt(v) * R;
      pos[i * 3] = target.x + Math.cos(ang) * rad + Math.sin(time * 0.6 + a) * 0.6;
      pos[i * 3 + 2] = target.z + Math.sin(ang) * rad + Math.cos(time * 0.5 + a * 1.3) * 0.6;
      pos[i * 3 + 1] = target.y + 0.4 + ((b * 3 + time * (0.05 + b * 0.08) + a) % 3) * (night > 0.5 ? 0.55 : 0.8);
    }
    (this.points.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    this.mat.uniforms.uNight.value = night; this.mat.uniforms.uTime.value = time; this.mat.uniforms.uPx.value = px; this.mat.uniforms.uFade.value = fade;
  }
}
