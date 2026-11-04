import * as THREE from "three";
import type { SimulationEngine } from "../sim/SimulationEngine";
import type { FxEvent, WeatherZone } from "../sim/types";
import type { World } from "../sim/World";
import type { Renderer } from "./Renderer";

interface Anim { t: number; dur: number; step: (p: number, dt: number) => void; end?: () => void; }


/** Effets visuels purs : particules (sprites doux), éclairs, anneaux, météo. Aucune logique de jeu ici. */
export class Fx {
  private scene: THREE.Scene;
  private cap: number;
  private n = 0;
  private P: Float32Array;
  private V: Float32Array;
  private L: Float32Array; // life, max
  private S: Float32Array; // size, grow
  private C: Float32Array;
  private G: Float32Array;
  private A: Uint8Array; // 1 = additif (feu, étincelles)
  private pts: { mesh: THREE.Points; pos: Float32Array; col: Float32Array; size: Float32Array; alpha: Float32Array; add: boolean }[] = [];
  private tex: THREE.Texture;
  private uniforms = { uScale: { value: 600 }, uTex: { value: null as THREE.Texture | null } };
  private anims: Anim[] = [];
  private flash: THREE.PointLight;
  private weather = new Set<THREE.Group>();
  private lastT = 0;
  private boltMat = new THREE.MeshBasicMaterial({ color: 0xdff0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  private glowMat = new THREE.MeshBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  private tmpC = new THREE.Color();

  constructor(scene: THREE.Scene, cap = 3200) {
    this.scene = scene;
    this.cap = cap;
    this.P = new Float32Array(cap * 3); this.V = new Float32Array(cap * 3); this.L = new Float32Array(cap * 2);
    this.S = new Float32Array(cap * 2); this.C = new Float32Array(cap * 3); this.G = new Float32Array(cap); this.A = new Uint8Array(cap);
    // sprite doux (dégradé radial) pour fumée, flammes, poussière
    const cv = document.createElement("canvas"); cv.width = cv.height = 64;
    const g = cv.getContext("2d")!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.45, "rgba(255,255,255,0.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    this.tex = new THREE.CanvasTexture(cv);
    this.uniforms.uTex.value = this.tex;
    for (const add of [false, true]) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(cap * 3), col = new Float32Array(cap * 3), size = new Float32Array(cap), alpha = new Float32Array(cap);
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({
        uniforms: this.uniforms, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending,
        vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; varying vec3 vC; varying float vA;
          void main(){ vC=aColor; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=max(1.0, aSize*uScale/max(0.1,-mv.z)); }`,
        fragmentShader: `uniform sampler2D uTex; varying vec3 vC; varying float vA;
          void main(){ vec4 t=texture2D(uTex, gl_PointCoord); gl_FragColor=vec4(vC, t.a*vA);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`,
      });
      const mesh = new THREE.Points(geo, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = add ? 12 : 11;
      geo.setDrawRange(0, 0);
      scene.add(mesh);
      this.pts.push({ mesh, pos, col, size, alpha, add });
    }
    this.flash = new THREE.PointLight(0xbcd8ff, 0, 40, 1.6);
    scene.add(this.flash);
  }

  /** À appeler au redimensionnement : taille des sprites en pixels. */
  setScale(heightPx: number, fovDeg: number): void {
    this.uniforms.uScale.value = (heightPx * 0.5) / Math.tan((fovDeg * Math.PI) / 360);
  }

  clear(): void {
    this.n = 0;
    for (const p of this.pts) p.mesh.geometry.setDrawRange(0, 0);
    this.anims.length = 0;
    for (const w of this.weather) { this.scene.remove(w); }
    this.weather.clear();
  }

  emit(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number, color: number, grav = 0, grow = 0, additive?: boolean): void {
    if (this.n >= this.cap) return;
    const i = this.n++;
    this.P[i * 3] = x; this.P[i * 3 + 1] = y; this.P[i * 3 + 2] = z;
    this.V[i * 3] = vx; this.V[i * 3 + 1] = vy; this.V[i * 3 + 2] = vz;
    this.L[i * 2] = life; this.L[i * 2 + 1] = life;
    this.S[i * 2] = size; this.S[i * 2 + 1] = grow;
    this.tmpC.setHex(color);
    this.C[i * 3] = this.tmpC.r; this.C[i * 3 + 1] = this.tmpC.g; this.C[i * 3 + 2] = this.tmpC.b;
    this.G[i] = grav;
    // chaud et lumineux (flammes, étincelles) : mélange additif ; sinon (fumée, poussière) : mélange normal
    this.A[i] = additive ?? (this.tmpC.r > 0.7 && this.tmpC.g > 0.25 && this.tmpC.b < 0.8 && grow < 0.2 ? 1 : 0) ? 1 : 0;
  }

  /** Flamme animée (sprites additifs montants) : utilisée pour les incendies et les feux de camp. */
  flame(x: number, y: number, z: number, intensity = 1): void {
    this.emit(x + (Math.random() - 0.5) * 0.14, y, z + (Math.random() - 0.5) * 0.14, (Math.random() - 0.5) * 0.12, 0.55 + Math.random() * 0.5, (Math.random() - 0.5) * 0.12, 0.5 + Math.random() * 0.35, 0.2 * intensity, Math.random() < 0.5 ? 0xff7a1c : 0xffb02e, 0, -0.1, true);
    if (Math.random() < 0.35) this.emit(x, y + 0.05, z, (Math.random() - 0.5) * 0.25, 0.9 + Math.random() * 0.6, (Math.random() - 0.5) * 0.25, 0.7, 0.05, 0xffe07a, 1.2, 0, true);
  }

  dust(x: number, y: number, z: number): void {
    this.emit(x + (Math.random() - 0.5) * 0.6, y, z + (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4, 0.7, 0.12, 0xc9c1b0, -0.2, 0.15);
    if (Math.random() < 0.5) this.emit(x, y + 0.1, z, (Math.random() - 0.5) * 2, 1 + Math.random(), (Math.random() - 0.5) * 2, 0.35, 0.04, 0xffd36b, 4);
  }
  smoke(x: number, y: number, z: number): void {
    this.emit(x, y, z, (Math.random() - 0.5) * 0.12, 0.5, (Math.random() - 0.5) * 0.12, 2.0, 0.17, 0x8d8d90, -0.05, 0.28, false);
  }

  private burst(x: number, y: number, z: number, count: number, color: number, speed: number, life: number, size: number, grav = 6, up = 1): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.emit(x, y, z, Math.cos(a) * s * Math.cos(e), (Math.sin(e) * s + 1) * up, Math.sin(a) * s * Math.cos(e), life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), color, grav);
    }
  }

  private ring(x: number, y: number, z: number, r0: number, r1: number, dur: number, color: number, opacity = 0.8): void {
    const g = new THREE.RingGeometry(0.92, 1, 48);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    m.position.set(x, y, z);
    m.renderOrder = 15;
    this.scene.add(m);
    this.anims.push({ t: 0, dur, step: (p) => { const r = r0 + (r1 - r0) * (1 - Math.pow(1 - p, 2)); m.scale.set(r, 1, r); (m.material as THREE.MeshBasicMaterial).opacity = opacity * (1 - p); },
      end: () => { this.scene.remove(m); g.dispose(); (m.material as THREE.Material).dispose(); } });
  }

  private column(x: number, y: number, z: number, r: number, h: number, dur: number, color: number): void {
    const g = new THREE.CylinderGeometry(r, r * 1.4, h, 16, 1, true);
    g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    this.scene.add(m);
    this.anims.push({ t: 0, dur, step: (p) => { (m.material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.sin(p * Math.PI); m.scale.set(1 - p * 0.3, 1, 1 - p * 0.3); },
      end: () => { this.scene.remove(m); g.dispose(); (m.material as THREE.Material).dispose(); } });
  }

  private seg(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material, parent: THREE.Group): void {
    const d = b.clone().sub(a);
    const g = new THREE.CylinderGeometry(r, r, d.length(), 5);
    const m = new THREE.Mesh(g, mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    parent.add(m);
  }

  private bolt(x: number, y: number, z: number): void {
    const grp = new THREE.Group();
    const pts: THREE.Vector3[] = [];
    const top = y + 18;
    let cx = x + (Math.random() - 0.5) * 3, cz = z + (Math.random() - 0.5) * 3;
    const steps = 9;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const j = (1 - t) * 1.6;
      pts.push(new THREE.Vector3(i === steps ? x : cx + (Math.random() - 0.5) * j, top - (top - y) * t, i === steps ? z : cz + (Math.random() - 0.5) * j));
      cx += (x - cx) * 0.25; cz += (z - cz) * 0.25;
    }
    for (let i = 0; i < pts.length - 1; i++) { this.seg(pts[i], pts[i + 1], 0.045, this.boltMat, grp); this.seg(pts[i], pts[i + 1], 0.16, this.glowMat, grp); }
    this.scene.add(grp);
    this.flash.position.set(x, y + 3, z);
    this.flash.intensity = 120;
    this.anims.push({ t: 0, dur: 0.5, step: (p) => {
      const f = p < 0.15 ? 1 : (Math.sin(p * 60) > 0 ? 0.8 : 0.35) * (1 - p);
      this.boltMat.opacity = f; this.glowMat.opacity = 0.35 * f; this.flash.intensity = 120 * f * f;
    }, end: () => { this.scene.remove(grp); grp.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); this.flash.intensity = 0; this.boltMat.opacity = 1; this.glowMat.opacity = 0.35; } });
    this.burst(x, y + 0.1, z, 26, 0xfff3b0, 3.5, 0.6, 0.05, 9);
    this.burst(x, y + 0.1, z, 12, 0x555555, 1.2, 1.2, 0.14, -0.5);
    this.ring(x, y + 0.1, z, 0.2, 2.2, 0.5, 0xbcd8ff);
  }

  /** Animation de chute (avant l'impact réel dans la simulation). */
  meteorIncoming(x: number, y: number, N: number, world: World, onImpact: () => void): void {
    const tx = x - N / 2, tz = y - N / 2, ty = world.heightAt(x, y);
    const start = new THREE.Vector3(tx + 12, ty + 34, tz - 12);
    const g = new THREE.IcosahedronGeometry(0.55, 0);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xff9a3c }));
    const halo = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.add(halo);
    this.scene.add(m);
    this.anims.push({ t: 0, dur: 0.95, step: (p, dt) => {
      const e = p * p;
      m.position.set(start.x + (tx - start.x) * e, start.y + (ty - start.y) * e, start.z + (tz - start.z) * e);
      m.rotation.x += dt * 8; m.rotation.y += dt * 5;
      for (let i = 0; i < 3; i++) this.emit(m.position.x, m.position.y, m.position.z, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, 0.7, 0.2, Math.random() < 0.5 ? 0xff7a2a : 0x444444, 0, 0.1);
    }, end: () => { this.scene.remove(m); g.dispose(); halo.geometry.dispose(); onImpact(); } });
  }

  handle(e: FxEvent, sim: SimulationEngine, r: Renderer): void {
    const N = sim.world.size, w = sim.world;
    const gx = (x: number) => x - N / 2, gz = (y: number) => y - N / 2;
    switch (e.kind) {
      case "lightning": { this.bolt(gx(e.x), w.heightAt(e.x, e.y), gz(e.y)); r.shake(0.25); break; }
      case "meteor": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        const b = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffb04a, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
        b.position.set(x, y, z);
        this.scene.add(b);
        this.anims.push({ t: 0, dur: 0.9, step: (p) => { const s = e.r * 1.2 * Math.sqrt(p); b.scale.set(s, s * 0.8, s); (b.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - p); },
          end: () => { this.scene.remove(b); b.geometry.dispose(); } });
        this.burst(x, y + 0.3, z, 140, 0xff8a2a, 7, 1.4, 0.14, 8);
        this.burst(x, y + 0.3, z, 90, 0x6b5440, 5, 1.8, 0.18, 9);
        for (let i = 0; i < 50; i++) this.emit(x + (Math.random() - 0.5) * e.r, y + 0.5, z + (Math.random() - 0.5) * e.r, (Math.random() - 0.5) * 1.5, 1.2 + Math.random() * 2, (Math.random() - 0.5) * 1.5, 3.5, 0.3, 0x4a4540, -0.3, 0.5);
        this.ring(x, y + 0.15, z, 0.5, e.r * 2.2, 1.1, 0xffc07a);
        this.ring(x, y + 0.15, z, 0.3, e.r * 1.4, 0.8, 0xff7a2a);
        this.flash.position.set(x, y + 4, z); this.flash.color.setHex(0xffa860); this.flash.intensity = 200;
        this.anims.push({ t: 0, dur: 0.8, step: (p) => { this.flash.intensity = 200 * (1 - p) * (1 - p); }, end: () => { this.flash.intensity = 0; this.flash.color.setHex(0xbcd8ff); } });
        r.shake(1.2);
        break;
      }
      case "rain": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.burst(x, y + 6, z, 40, 0xcfe6ff, 2, 2, 0.06, 1, 0.3);
        this.ring(x, y + 0.2, z, 0.5, e.r, 1.5, 0x8fc5ff, 0.5);
        break;
      }
      case "plague": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, d = Math.random() * e.r; this.emit(x + Math.cos(a) * d, y + 0.2, z + Math.sin(a) * d, (Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4, 2.8, 0.25, 0x8fd04a, -0.1, 0.25); }
        this.ring(x, y + 0.15, z, 0.4, e.r * 1.3, 1.4, 0x9be04a);
        break;
      }
      case "bless": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.column(x, y, z, 0.7, 14, 3, 0xffe28a);
        for (let i = 0; i < 70; i++) { const a = Math.random() * 6.28, d = Math.random() * 2; this.emit(x + Math.cos(a) * d, y + 0.1, z + Math.sin(a) * d, 0, 1.2 + Math.random() * 1.8, 0, 2.4, 0.07, 0xffe9a0, -0.2); }
        this.ring(x, y + 0.15, z, 0.5, 4, 1.6, 0xffe28a);
        break;
      }
      case "wrath": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.ring(x, y + 0.2, z, 0.5, e.r * 1.4, 1.6, 0xff4a2a, 0.9);
        this.ring(x, y + 0.2, z, 0.3, e.r, 1.1, 0xffb04a, 0.7);
        for (let i = 0; i < 100; i++) { const a = Math.random() * 6.28, d = Math.random() * e.r; this.emit(x + Math.cos(a) * d, y + 0.2, z + Math.sin(a) * d, 0, 1 + Math.random() * 3, 0, 2, 0.1, Math.random() < 0.5 ? 0xff5a2a : 0x333333, -0.5, 0.1); }
        r.shake(1.6);
        break;
      }
      case "prophecy": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.column(x, y, z, 0.35, 16, 2.4, 0xfff6d0);
        for (let k = 0; k < 4; k++) setTimeout(() => this.ring(x, y + 1 + k * 1.4, z, 0.3, 2.2, 1.0, 0xfff1b0, 0.8), k * 280);
        break;
      }
      case "battle": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.burst(x, y + 0.2, z, 10, 0xffd36b, 1.6, 0.4, 0.04, 5);
        this.burst(x, y + 0.2, z, 5, 0xb9b2a2, 0.8, 1, 0.14, -0.2);
        break;
      }
      case "capture": {
        const civ = sim.civById.get(e.civ);
        const col = civ ? civ.color : 0xffffff;
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.burst(x, y + 0.5, z, 60, col, 3.5, 1.4, 0.1, 5);
        this.ring(x, y + 0.15, z, 0.5, 4, 1.2, col);
        break;
      }
      case "fire": {
        const x = gx(e.x), z = gz(e.y), y = w.heightAt(e.x, e.y);
        this.burst(x, y + 0.3, z, 70, 0xff8a2a, 3, 1.3, 0.12, 4);
        this.ring(x, y + 0.15, z, 0.4, 3.4, 0.9, 0xff9a4a);
        break;
      }
    }
  }

  update(dt: number, time: number): void {
    // animations
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      const p = Math.min(1, a.t / a.dur);
      a.step(p, dt);
      if (p >= 1) { a.end?.(); this.anims.splice(i, 1); }
    }
    // particules : intégration puis séparation additif / normal
    let k = 0;
    for (const p of this.pts) p.mesh.userData.n = 0;
    for (let i = 0; i < this.n; i++) {
      const life = this.L[i * 2] - dt;
      if (life <= 0) continue;
      const j = k;
      if (j !== i) {
        for (let q = 0; q < 3; q++) { this.P[j * 3 + q] = this.P[i * 3 + q]; this.V[j * 3 + q] = this.V[i * 3 + q]; this.C[j * 3 + q] = this.C[i * 3 + q]; }
        this.L[j * 2 + 1] = this.L[i * 2 + 1]; this.S[j * 2] = this.S[i * 2]; this.S[j * 2 + 1] = this.S[i * 2 + 1]; this.G[j] = this.G[i]; this.A[j] = this.A[i];
      }
      this.L[j * 2] = life;
      this.V[j * 3 + 1] -= this.G[j] * dt;
      this.P[j * 3] += this.V[j * 3] * dt; this.P[j * 3 + 1] += this.V[j * 3 + 1] * dt; this.P[j * 3 + 2] += this.V[j * 3 + 2] * dt;
      const t = life / this.L[j * 2 + 1];
      const sz = Math.max(0.01, this.S[j * 2] + this.S[j * 2 + 1] * (1 - t));
      const alpha = this.A[j] ? Math.min(1, t * 2.2) * 0.95 : Math.min(1, t * 1.6) * 0.5 * Math.min(1, (1 - t) * 8 + 0.2);
      const sys = this.pts[this.A[j]];
      const m = (sys.mesh.userData.n as number) | 0;
      sys.pos[m * 3] = this.P[j * 3]; sys.pos[m * 3 + 1] = this.P[j * 3 + 1]; sys.pos[m * 3 + 2] = this.P[j * 3 + 2];
      sys.col[m * 3] = this.C[j * 3]; sys.col[m * 3 + 1] = this.C[j * 3 + 1]; sys.col[m * 3 + 2] = this.C[j * 3 + 2];
      sys.size[m] = sz; sys.alpha[m] = alpha;
      sys.mesh.userData.n = m + 1;
      k++;
    }
    this.n = k;
    for (const p of this.pts) {
      const m = (p.mesh.userData.n as number) | 0;
      const g = p.mesh.geometry;
      g.setDrawRange(0, m);
      for (const name of ["position", "aColor", "aSize", "aAlpha"]) (g.attributes[name] as THREE.BufferAttribute).needsUpdate = true;
    }
    void time;
  }

  // ------------------------------------------------------------------ météo persistante

  weatherZone(z: WeatherZone, N: number, world: World): THREE.Group {
    const g = new THREE.Group();
    const r = Math.min(z.r, 9);
    g.position.set(z.x - N / 2, world.heightAt(z.x, z.y), z.y - N / 2);
    g.userData.kind = z.kind;
    if (z.kind === "rain") {
      const count = 260;
      const pos = new Float32Array(count * 6);
      const speeds = new Float32Array(count);
      const base = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r;
        base[i * 3] = Math.cos(a) * d; base[i * 3 + 1] = Math.random() * 7; base[i * 3 + 2] = Math.sin(a) * d;
        speeds[i] = 9 + Math.random() * 4;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xa9d4ff, transparent: true, opacity: 0.7 }));
      lines.frustumCulled = false;
      g.add(lines);
      g.userData.rain = { base, speeds, geo };
      const cloudMat = new THREE.MeshStandardMaterial({ color: 0xbfc7d1, flatShading: true, roughness: 1, transparent: true, opacity: 0.92 });
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3 + Math.random() * 0.9, 0), cloudMat);
        const a = Math.random() * 6.28, d = Math.random() * r * 0.6;
        c.position.set(Math.cos(a) * d, 7.8 + Math.random() * 0.6, Math.sin(a) * d);
        c.scale.y = 0.55;
        g.add(c);
      }
    } else {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(r, 36), new THREE.MeshBasicMaterial({ color: 0xd9a441, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.4;
      g.add(disc);
      g.userData.drought = { r };
    }
    this.weather.add(g);
    return g;
  }

  disposeWeather(o: THREE.Object3D): void {
    this.weather.delete(o as THREE.Group);
    o.traverse((c) => { const m = c as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
  }

  animateWeather(time: number): void {
    const dt = Math.min(0.05, time - this.lastT);
    this.lastT = time;
    for (const g of this.weather) {
      const rd = g.userData.rain as { base: Float32Array; speeds: Float32Array; geo: THREE.BufferGeometry } | undefined;
      if (rd) {
        const P = rd.geo.attributes.position as THREE.BufferAttribute;
        for (let i = 0; i < rd.speeds.length; i++) {
          rd.base[i * 3 + 1] -= rd.speeds[i] * dt;
          if (rd.base[i * 3 + 1] < 0) rd.base[i * 3 + 1] += 7.5;
          const x = rd.base[i * 3], y = rd.base[i * 3 + 1], z = rd.base[i * 3 + 2];
          P.setXYZ(i * 2, x, y, z); P.setXYZ(i * 2 + 1, x, y + 0.35, z);
        }
        P.needsUpdate = true;
      }
      const dr = g.userData.drought as { r: number } | undefined;
      if (dr && Math.random() < 0.3) {
        const a = Math.random() * 6.28, d = Math.random() * dr.r;
        this.emit(g.position.x + Math.cos(a) * d, g.position.y + 0.3, g.position.z + Math.sin(a) * d, 0.5, 0.2, 0.2, 2.2, 0.07, 0xd9b36a, 0, 0.1);
      }
    }
  }
}
