import * as THREE from "three";
import { blob, box, cone, cyl, merge } from "./geo";
import type { Sky } from "./Sky";

type G = THREE.BufferGeometry;

/** Parties du corps (pilotées dans le vertex shader) et régions de couleur (teintées par instance). */
export const PART = { body: 0, legL: 1, legR: 2, armL: 3, armR: 4, hand: 5 } as const;
export const REGION = { fixed: 0, skin: 1, hair: 2, cloth: 3, pants: 4, accent: 5 } as const;

function tag(g: G, part: number, region: number): G {
  const n = g.attributes.position.count;
  g.setAttribute("aPart", new THREE.Float32BufferAttribute(new Float32Array(n).fill(part), 1));
  g.setAttribute("aRegion", new THREE.Float32BufferAttribute(new Float32Array(n).fill(region), 1));
  return g;
}
const W = 0xffffff;
// repère : le personnage regarde vers +X, pieds en y=0, hanches y=0.15, épaules y=0.30
const legs = (era: number): G[] => {
  const reg = era <= 1 ? REGION.skin : REGION.pants;
  return [tag(box(0.05, 0.15, 0.052, 0, 0, 0.034, W), PART.legL, reg), tag(box(0.05, 0.15, 0.052, 0, 0, -0.034, W), PART.legR, reg),
    tag(box(0.07, 0.025, 0.056, 0.008, 0, 0.034, era >= 3 ? 0x2a2622 : 0x5a4330), PART.legL, REGION.fixed), tag(box(0.07, 0.025, 0.056, 0.008, 0, -0.034, era >= 3 ? 0x2a2622 : 0x5a4330), PART.legR, REGION.fixed)];
};
const arms = (era: number): G[] => {
  const reg = era <= 1 ? REGION.skin : REGION.cloth;
  return [tag(box(0.038, 0.15, 0.038, 0, 0.155, 0.083, W), PART.armL, reg), tag(box(0.038, 0.15, 0.038, 0, 0.155, -0.083, W), PART.armR, reg),
    tag(box(0.04, 0.04, 0.04, 0, 0.14, 0.083, W), PART.armL, REGION.skin), tag(box(0.04, 0.04, 0.04, 0, 0.14, -0.083, W), PART.armR, REGION.skin)];
};
const head = (): G[] => [tag(blob(0.056, 0.004, 0.37, 0, W), PART.body, REGION.skin), tag(box(0.012, 0.014, 0.014, 0.054, 0.37, 0.02, 0x1d1a18), PART.body, REGION.fixed), tag(box(0.012, 0.014, 0.014, 0.054, 0.37, -0.02, 0x1d1a18), PART.body, REGION.fixed)];

function outfit(era: number, female: boolean): G[] {
  const out: G[] = [...legs(era), ...arms(era), ...head()];
  const B = (g: G, r: number = REGION.cloth) => out.push(tag(g, PART.body, r));
  switch (era) {
    case 0: // peaux de bêtes
      B(box(0.085, 0.15, 0.135, 0, 0.15, 0, W)); B(cone(0.1, 0.1, 6, 0, 0.07, 0, W));
      out.push(tag(box(0.07, 0.04, 0.07, 0.0, 0.28, 0.075, 0xb09a78), PART.body, REGION.fixed), tag(box(0.07, 0.04, 0.07, 0.0, 0.28, -0.075, 0xb09a78), PART.body, REGION.fixed));
      out.push(tag(blob(0.062, -0.012, 0.395, 0, W), PART.body, REGION.hair), tag(box(0.05, 0.03, 0.05, 0.02, 0.42, 0.03, W), PART.body, REGION.hair));
      if (female) out.push(tag(box(0.03, 0.12, 0.08, -0.05, 0.27, 0, W), PART.body, REGION.hair));
      break;
    case 1: // tunique / toge
      B(box(0.085, 0.16, 0.135, 0, 0.15, 0, W)); B(cone(0.105, female ? 0.17 : 0.1, 7, 0, female ? 0.02 : 0.06, 0, W));
      out.push(tag(box(0.09, 0.03, 0.14, 0, 0.2, 0, 0xd8b64a), PART.body, REGION.fixed));
      out.push(tag(blob(0.058, -0.004, 0.388, 0, W), PART.body, REGION.hair), tag(cyl(0.06, 0.06, 0.012, 7, 0, 0.405, 0, 0x4f9a52), PART.body, REGION.fixed));
      if (female) out.push(tag(box(0.04, 0.14, 0.09, -0.05, 0.25, 0, W), PART.body, REGION.hair));
      break;
    case 2: // surcot, capuche
      B(box(0.088, 0.17, 0.138, 0, 0.15, 0, W)); B(cone(0.11, female ? 0.18 : 0.12, 7, 0, female ? 0.02 : 0.05, 0, W));
      out.push(tag(box(0.092, 0.022, 0.142, 0, 0.19, 0, 0x4a3a2a), PART.body, REGION.fixed));
      if (female) out.push(tag(blob(0.062, -0.006, 0.385, 0, 0xe8e2d4), PART.body, REGION.fixed), tag(box(0.05, 0.1, 0.1, -0.05, 0.27, 0, 0xe8e2d4), PART.body, REGION.fixed));
      else { out.push(tag(cone(0.066, 0.09, 6, -0.005, 0.39, 0, W), PART.body, REGION.accent), tag(blob(0.058, -0.012, 0.37, 0, W), PART.body, REGION.hair)); }
      break;
    case 3: // manteau, chapeau
      B(box(0.09, 0.19, 0.14, 0, 0.14, 0, W)); if (female) B(cone(0.115, 0.17, 7, 0, 0.03, 0, W));
      out.push(tag(box(0.092, 0.2, 0.026, 0.0, 0.14, 0, 0x2a2622), PART.body, REGION.fixed));
      if (female) out.push(tag(blob(0.062, -0.01, 0.388, 0, W), PART.body, REGION.hair), tag(cyl(0.075, 0.075, 0.01, 7, 0, 0.405, 0, 0x4a3a30), PART.body, REGION.fixed));
      else out.push(tag(cyl(0.085, 0.085, 0.012, 7, 0, 0.405, 0, 0x2a2622), PART.body, REGION.fixed), tag(cyl(0.05, 0.05, 0.075, 7, 0, 0.415, 0, 0x2a2622), PART.body, REGION.fixed));
      break;
    case 4: // veste, jean
      B(box(0.085, 0.16, 0.14, 0, 0.15, 0, W)); B(box(0.08, 0.04, 0.136, 0, 0.13, 0, W));
      if (female) out.push(tag(box(0.1, 0.07, 0.15, 0, 0.1, 0, W), PART.body, REGION.cloth));
      out.push(tag(blob(0.06, -0.008, 0.385, 0, W), PART.body, REGION.hair));
      if (female) out.push(tag(box(0.035, 0.1, 0.09, -0.052, 0.28, 0, W), PART.body, REGION.hair));
      break;
    default: // combinaison, visière
      B(box(0.08, 0.16, 0.13, 0, 0.15, 0, W)); out.push(tag(box(0.082, 0.02, 0.132, 0, 0.22, 0, 0x62e4ff), PART.body, REGION.fixed), tag(box(0.082, 0.012, 0.132, 0, 0.17, 0, 0x62e4ff), PART.body, REGION.fixed));
      out.push(tag(blob(0.058, -0.006, 0.385, 0, W), PART.body, REGION.hair), tag(box(0.04, 0.026, 0.11, 0.035, 0.375, 0, 0x62e4ff), PART.body, REGION.fixed));
      if (female) out.push(tag(box(0.03, 0.09, 0.08, -0.05, 0.28, 0, W), PART.body, REGION.hair));
  }
  return out;
}

const cache = new Map<string, G>();
export function characterGeometry(era: number, female: boolean): G {
  const key = `c${era}${female ? "f" : "m"}`;
  let g = cache.get(key);
  if (!g) { g = merge(outfit(era, female)); cache.set(key, g); }
  return g;
}

/** Équipement des soldats (casque + arme + bouclier) : les armes suivent les bras animés. */
export function gearGeometry(era: number): G {
  const key = "g" + era;
  let g = cache.get(key);
  if (g) return g;
  const hand = (g2: G) => tag(g2, PART.hand, REGION.fixed);
  const sh = (g2: G) => tag(g2, PART.armL, REGION.fixed);
  const hat = (g2: G) => tag(g2, PART.body, REGION.fixed);
  const parts: G[] = [];
  switch (era) {
    case 0: parts.push(hand(cyl(0.011, 0.011, 0.48, 4, 0.05, -0.02, -0.083, 0x7b5a3a)), hand(cone(0.024, 0.075, 4, 0.05, 0.46, -0.083, 0x8a8a80)), sh(blob(0.062, 0.05, 0.2, 0.1, 0x6b5a44)), hat(blob(0.058, -0.006, 0.4, 0, 0x7a5a3c))); break;
    case 1: parts.push(hand(cyl(0.011, 0.011, 0.48, 4, 0.05, -0.02, -0.083, 0x7b5a3a)), hand(cone(0.026, 0.085, 4, 0.05, 0.46, -0.083, 0xc98a3a)), sh(cyl(0.08, 0.08, 0.016, 7, 0.05, 0.2, 0.11, 0xc98a3a).rotateX(0)), hat(cyl(0.06, 0.06, 0.06, 7, 0, 0.375, 0, 0xc98a3a)), hat(cone(0.04, 0.05, 6, 0, 0.43, 0, 0xb0402a))); break;
    case 2: parts.push(hand(box(0.012, 0.34, 0.03, 0.06, 0.05, -0.083, 0xc4cbd2)), hand(box(0.06, 0.02, 0.03, 0.06, 0.15, -0.083, 0x6b4a2e)), sh(box(0.02, 0.17, 0.12, 0.06, 0.11, 0.1, 0x8a2a2a)), hat(cyl(0.06, 0.06, 0.07, 7, 0, 0.36, 0, 0x8f969c)), hat(cone(0.06, 0.05, 7, 0, 0.43, 0, 0x8f969c))); break;
    case 3: parts.push(hand(cyl(0.009, 0.009, 0.42, 4, 0.06, 0.0, -0.083, 0x4a3a2a)), hand(box(0.012, 0.025, 0.12, 0.06, 0.34, -0.083, 0xb0b8c0)), hand(box(0.06, 0.012, 0.05, 0.06, 0.42, -0.083, 0xb0b8c0)), hat(cyl(0.062, 0.062, 0.05, 7, 0, 0.375, 0, 0x4a4a4a)), hat(cyl(0.075, 0.075, 0.01, 7, 0, 0.375, 0, 0x4a4a4a))); break;
    case 4: parts.push(hand(box(0.024, 0.036, 0.3, 0.1, 0.15, -0.083, 0x222a30).rotateY(-Math.PI / 2).translate(0.12, 0, 0)), hand(box(0.016, 0.07, 0.03, 0.08, 0.12, -0.083, 0x222a30)), hat(blob(0.064, -0.002, 0.395, 0, 0x5b6b45)), hat(box(0.1, 0.12, 0.034, -0.065, 0.2, 0, 0x3a4a30))); break;
    default: parts.push(hand(box(0.3, 0.04, 0.028, 0.1, 0.17, -0.083, 0xdde6ef)), hand(box(0.22, 0.012, 0.012, 0.13, 0.19, -0.083, 0x62e4ff)), hat(blob(0.066, -0.002, 0.395, 0, 0xdde6ef)), hat(box(0.14, 0.04, 0.02, -0.07, 0.22, 0, 0x62e4ff)), hat(box(0.04, 0.03, 0.12, 0.05, 0.375, 0, 0x62e4ff)));
  }
  g = merge(parts);
  cache.set(key, g);
  return g;
}

/** Outil de travail civil (hache / pioche / marteau) : suit le bras droit ; couleur propre à l'époque. */
export function toolGeometry(era: number): G {
  const key = "t" + era;
  let g = cache.get(key);
  if (g) return g;
  const head = [0x8a8a80, 0xb87a3a, 0x8f969c, 0xb0b8c0, 0xff9a2a, 0x5ff0ff][era];
  g = merge([tag(cyl(0.01, 0.01, 0.25, 4, 0.045, 0.0, -0.083, 0x7b5a3a), PART.hand, REGION.fixed), tag(box(0.07, 0.04, 0.016, 0.045, 0.24, -0.083, head), PART.hand, REGION.fixed)]);
  cache.set(key, g);
  return g;
}

/** Silhouette légère pour le niveau de détail lointain (aucune animation). */
export function farPersonGeometry(): G {
  let g = cache.get("far");
  if (!g) {
    g = merge([tag(cyl(0.05, 0.07, 0.3, 5, 0, 0, 0, W), PART.body, REGION.cloth), tag(blob(0.052, 0, 0.35, 0, W), PART.body, REGION.skin)]);
    cache.set("far", g);
  }
  return g;
}

/** Matériau partagé : animation des membres + teintes par instance dans le vertex shader (un seul draw call par jeu de géométrie). */
export function characterMaterial(sky: Sky): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = sky.uniforms.uTime;
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", `#include <common>
uniform float uTime;
attribute float aPart; attribute float aRegion;
attribute vec4 aAnim; attribute vec3 aCloth; attribute vec3 aSkin; attribute vec3 aHair; attribute vec3 aAccent;
vec2 gPiv; float gAng; float gYoff;
void limb(){
  float m = aAnim.x, ph = aAnim.y, sp = aAnim.z;
  gAng = 0.0; gPiv = vec2(0.0); gYoff = 0.0;
  float wk = sin(uTime*9.0*sp + ph);
  float wr = uTime*5.0*sp + ph;
  float wf = uTime*7.0*sp + ph;
  if (m > 0.5 && m < 1.5) gYoff = abs(wk)*0.014;
  else if (m > 3.5) gYoff = -0.075;
  else if (m < 0.5) gYoff = sin(uTime*1.6+ph)*0.003;
  if (aPart > 0.5) {
    if (aPart < 2.5) {
      gPiv = vec2(0.0, 0.15);
      float s = aPart < 1.5 ? 1.0 : -1.0;
      if (m < 0.5) gAng = 0.0; else if (m < 1.5) gAng = s*wk*0.75; else if (m < 2.5) gAng = 0.0; else if (m < 3.5) gAng = s*sin(wf*0.5)*0.35; else gAng = 1.45;
    } else {
      gPiv = vec2(0.0, 0.30);
      if (aPart < 3.5) { // bras gauche
        if (m < 0.5) gAng = sin(uTime*1.3+ph)*0.07; else if (m < 1.5) gAng = -wk*0.6; else if (m < 2.5) gAng = sin(wr+1.0)*0.3; else if (m < 3.5) gAng = -0.4+sin(wf+1.5)*0.4; else gAng = -0.3;
      } else { // bras droit + objet tenu
        if (m < 0.5) gAng = -sin(uTime*1.3+ph)*0.07; else if (m < 1.5) gAng = wk*0.6; else if (m < 2.5) gAng = -0.7+sin(wr)*1.05; else if (m < 3.5) gAng = -1.3+sin(wf)*0.7; else gAng = -0.2;
      }
    }
  }
}`)
      .replace("#include <beginnormal_vertex>", `limb();
float cA = cos(gAng), sA = sin(gAng);
mat2 gR = mat2(cA, sA, -sA, cA);
vec3 objectNormal = vec3(gR * normal.xy, normal.z);
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
      .replace("#include <begin_vertex>", `vec3 transformed = vec3(position);
transformed.xy = gPiv + gR * (transformed.xy - gPiv);
transformed.y += gYoff;`)
      .replace("#include <color_vertex>", `#ifdef USE_COLOR
vColor = color;
if (aRegion > 0.5) {
  if (aRegion < 1.5) vColor = aSkin * color; else if (aRegion < 2.5) vColor = aHair * color; else if (aRegion < 3.5) vColor = aCloth * color; else if (aRegion < 4.5) vColor = aCloth * 0.45 * color; else vColor = aAccent * color;
}
#endif`);
  };
  return mat;
}

/** Jeu d'instances avec attributs par instance (animation, vêtements, peau, cheveux). Capacité extensible. */
export class CharSet {
  mesh: THREE.InstancedMesh;
  n = 0;
  private cap: number;
  private anim: THREE.InstancedBufferAttribute; private cloth: THREE.InstancedBufferAttribute; private skin: THREE.InstancedBufferAttribute; private hair: THREE.InstancedBufferAttribute; private acc: THREE.InstancedBufferAttribute;
  constructor(private scene: THREE.Scene, private geo: G, private mat: THREE.Material, cap = 128) {
    this.cap = cap;
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.anim = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); this.cloth = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.skin = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.hair = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.acc = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.attach();
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.visible = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false;
    scene.add(this.mesh);
  }
  private attach(): void {
    const g = this.mesh.geometry;
    g.setAttribute("aAnim", this.anim); g.setAttribute("aCloth", this.cloth); g.setAttribute("aSkin", this.skin); g.setAttribute("aHair", this.hair); g.setAttribute("aAccent", this.acc);
  }
  begin(): void { this.n = 0; }
  push(m: THREE.Matrix4, mode: number, phase: number, speed: number, cloth: THREE.Color, skin: THREE.Color, hair: THREE.Color, accent: THREE.Color): void {
    if (this.n >= this.cap) this.grow();
    const i = this.n++;
    this.mesh.setMatrixAt(i, m);
    this.anim.setXYZW(i, mode, phase, speed, 0);
    this.cloth.setXYZ(i, cloth.r, cloth.g, cloth.b); this.skin.setXYZ(i, skin.r, skin.g, skin.b); this.hair.setXYZ(i, hair.r, hair.g, hair.b); this.acc.setXYZ(i, accent.r, accent.g, accent.b);
  }
  private grow(): void {
    const old = this.mesh, cap = this.cap * 2;
    const mk = (a: THREE.InstancedBufferAttribute, k: number) => { const n = new THREE.InstancedBufferAttribute(new Float32Array(cap * k), k); n.array.set(a.array as Float32Array); return n; };
    this.anim = mk(this.anim, 4); this.cloth = mk(this.cloth, 3); this.skin = mk(this.skin, 3); this.hair = mk(this.hair, 3); this.acc = mk(this.acc, 3);
    // la géométrie est partagée : on la clone pour porter les nouveaux attributs
    const g = this.geo.clone();
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap);
    (this.mesh.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    this.cap = cap;
    this.attach();
    this.mesh.frustumCulled = false; this.mesh.castShadow = false;
    this.scene.remove(old); old.geometry.dispose?.();
    this.scene.add(this.mesh);
  }
  end(): void {
    this.mesh.count = this.n; this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const a of [this.anim, this.cloth, this.skin, this.hair, this.acc]) a.needsUpdate = true;
  }
  dispose(): void { this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.dispose(); }
}
