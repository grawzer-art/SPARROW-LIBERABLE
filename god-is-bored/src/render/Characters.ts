import * as THREE from "three";
import { ball, blob, box, cone, cyl, merge } from "./geo";
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
/** Tronc ovale effilé (épaules plus larges que la taille) : remplace les torses en boîte. */
const oval = (w: number, h: number, d: number, y: number, color: number = W): G => { const g = cyl(w * 0.5, w * 0.6, h, 8, 0, y, 0, color); g.scale(1, 1, d / w); return g; };
/** Sphère aplatie ou étirée (têtes, mains, volumes arrondis) : même sommets que `ball`, proportions libres. */
const lobe = (rx: number, ry: number, rz: number, x: number, y: number, z: number, color: number = W, sw = 6, sh = 4): G => { const g = ball(1, 0, 0, 0, color, sw, sh); g.scale(rx, ry, rz); g.translate(x, y, z); return g; };
// repère : le personnage regarde vers +X, pieds en y=0, hanches y=0.15, épaules y=0.30
const legs = (era: number): G[] => {
  const reg = era <= 1 ? REGION.skin : REGION.pants;
  const shoe = era >= 3 ? 0x2a2622 : 0x5a4330;
  return [tag(cyl(0.024, 0.03, 0.15, 6, 0, 0, 0.034, W), PART.legL, reg), tag(cyl(0.024, 0.03, 0.15, 6, 0, 0, -0.034, W), PART.legR, reg),
    tag(lobe(0.044, 0.02, 0.03, 0.012, 0.016, 0.034, shoe), PART.legL, REGION.fixed), tag(lobe(0.044, 0.02, 0.03, 0.012, 0.016, -0.034, shoe), PART.legR, REGION.fixed)];
};
const arms = (era: number): G[] => {
  const reg = era <= 1 ? REGION.skin : REGION.cloth;
  return [tag(cyl(0.017, 0.022, 0.15, 6, 0, 0.155, 0.083, W), PART.armL, reg), tag(cyl(0.017, 0.022, 0.15, 6, 0, 0.155, -0.083, W), PART.armR, reg),
    tag(lobe(0.024, 0.026, 0.024, 0, 0.145, 0.083), PART.armL, REGION.skin), tag(lobe(0.024, 0.026, 0.024, 0, 0.145, -0.083), PART.armR, REGION.skin)];
};
const head = (): G[] => [tag(lobe(0.052, 0.058, 0.05, 0, 0.375, 0, W, 8, 6), PART.body, REGION.skin), tag(box(0.01, 0.013, 0.012, 0.05, 0.38, 0.02, 0x1d1a18), PART.body, REGION.fixed), tag(box(0.01, 0.013, 0.012, 0.05, 0.38, -0.02, 0x1d1a18), PART.body, REGION.fixed), tag(box(0.014, 0.018, 0.014, 0.056, 0.362, 0, W), PART.body, REGION.skin)];

function outfit(era: number, female: boolean, v = 0): G[] {
  const out: G[] = [...legs(era), ...arms(era), ...head()];
  const B = (g: G, r: number = REGION.cloth) => out.push(tag(g, PART.body, r));
  switch (era) {
    case 0: // peaux de bêtes
      B(oval(0.085, 0.15, 0.135, 0.15)); B(cone(0.1, 0.1, 6, 0, 0.07, 0, W));
      out.push(tag(box(0.055, 0.032, 0.055, 0.0, 0.285, 0.083, 0xb09a78), PART.body, REGION.fixed), tag(box(0.055, 0.032, 0.055, 0.0, 0.285, -0.083, 0xb09a78), PART.body, REGION.fixed));
      out.push(tag(blob(0.062, -0.012, 0.395, 0, W), PART.body, REGION.hair), tag(box(0.05, 0.03, 0.05, 0.02, 0.42, 0.03, W), PART.body, REGION.hair));
      if (female) out.push(tag(box(0.03, 0.12, 0.08, -0.05, 0.27, 0, W), PART.body, REGION.hair));
      break;
    case 1: // tunique / toge
      B(oval(0.085, 0.16, 0.135, 0.15)); B(cone(0.105, female ? 0.17 : 0.1, 7, 0, female ? 0.02 : 0.06, 0, W));
      out.push(tag(box(0.09, 0.03, 0.14, 0, 0.2, 0, 0xd8b64a), PART.body, REGION.fixed));
      out.push(tag(blob(0.058, -0.004, 0.388, 0, W), PART.body, REGION.hair), tag(cyl(0.06, 0.06, 0.012, 7, 0, 0.405, 0, 0x4f9a52), PART.body, REGION.fixed));
      if (female) out.push(tag(box(0.04, 0.14, 0.09, -0.05, 0.25, 0, W), PART.body, REGION.hair));
      break;
    case 2: // surcot, capuche
      B(oval(0.088, 0.17, 0.138, 0.15)); B(cone(0.11, female ? 0.18 : 0.12, 7, 0, female ? 0.02 : 0.05, 0, W));
      out.push(tag(box(0.092, 0.022, 0.142, 0, 0.19, 0, 0x4a3a2a), PART.body, REGION.fixed));
      if (female) out.push(tag(blob(0.062, -0.006, 0.385, 0, 0xe8e2d4), PART.body, REGION.fixed), tag(box(0.05, 0.1, 0.1, -0.05, 0.27, 0, 0xe8e2d4), PART.body, REGION.fixed));
      else { out.push(tag(cone(0.066, 0.09, 6, -0.005, 0.39, 0, W), PART.body, REGION.accent), tag(blob(0.058, -0.012, 0.37, 0, W), PART.body, REGION.hair)); }
      break;
    case 3: // manteau, chapeau
      B(oval(0.09, 0.19, 0.14, 0.14)); if (female) B(cone(0.115, 0.17, 7, 0, 0.03, 0, W));
      out.push(tag(box(0.092, 0.2, 0.026, 0.0, 0.14, 0, 0x2a2622), PART.body, REGION.fixed));
      if (female) out.push(tag(blob(0.062, -0.01, 0.388, 0, W), PART.body, REGION.hair), tag(cyl(0.075, 0.075, 0.01, 7, 0, 0.405, 0, 0x4a3a30), PART.body, REGION.fixed));
      else out.push(tag(cyl(0.085, 0.085, 0.012, 7, 0, 0.405, 0, 0x2a2622), PART.body, REGION.fixed), tag(cyl(0.05, 0.05, 0.075, 7, 0, 0.415, 0, 0x2a2622), PART.body, REGION.fixed));
      break;
    case 4: // veste, jean
      B(oval(0.085, 0.16, 0.14, 0.15)); B(oval(0.08, 0.04, 0.136, 0.13));
      if (female) out.push(tag(box(0.1, 0.07, 0.15, 0, 0.1, 0, W), PART.body, REGION.cloth));
      out.push(tag(blob(0.06, -0.008, 0.385, 0, W), PART.body, REGION.hair));
      if (female) out.push(tag(box(0.035, 0.1, 0.09, -0.052, 0.28, 0, W), PART.body, REGION.hair));
      break;
    default: // combinaison, visière
      B(oval(0.08, 0.16, 0.13, 0.15)); out.push(tag(box(0.082, 0.02, 0.132, 0, 0.22, 0, 0x62e4ff), PART.body, REGION.fixed), tag(box(0.082, 0.012, 0.132, 0, 0.17, 0, 0x62e4ff), PART.body, REGION.fixed));
      out.push(tag(blob(0.058, -0.006, 0.385, 0, W), PART.body, REGION.hair), tag(box(0.04, 0.026, 0.11, 0.035, 0.375, 0, 0x62e4ff), PART.body, REGION.fixed));
      if (female) out.push(tag(box(0.03, 0.09, 0.08, -0.05, 0.28, 0, W), PART.body, REGION.hair));
  }
  if (v === 1) {
    // variante d'allure : bandeau, barbe ou châle selon l'âge et le genre (accent = couleur de la civilisation)
    if (female) out.push(tag(box(0.1, 0.03, 0.14, 0.0, 0.27, 0, W), PART.body, REGION.accent));
    else if (era <= 3) out.push(tag(box(0.032, 0.05, 0.07, 0.05, 0.31, 0, W), PART.body, REGION.hair));
    if (!female || era >= 4) out.push(tag(cyl(0.063, 0.063, 0.016, 7, 0, 0.39, 0, W), PART.body, REGION.accent));
  }
  return out;
}

const cache = new Map<string, G>();
export function characterGeometry(era: number, female: boolean, v = 0): G {
  const key = `c${era}${female ? "f" : "m"}${v}`;
  let g = cache.get(key);
  if (!g) { g = merge(outfit(era, female, v)); cache.set(key, g); }
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

/**
 * Outil civil tenu par le bras droit, dans le repère du bras au repos (main vers y≈0.16) : le manche prolonge le bras vers le bas,
 * la tête de l'outil est à l'extrémité, donc elle frappe devant le personnage quand le bras se balance.
 * kind : 0 hache (bûcheron), 1 pioche (mineur), 2 houe (cultivateur), 3 marteau (bâtisseur), 4 panier (cueillette), 5 tablette (érudit).
 */
export const TOOL = { axe: 0, pick: 1, hoe: 2, hammer: 3, basket: 4, tablet: 5 } as const;
export function toolGeometry(era: number, kind = 0): G {
  const key = `t${era}k${kind}`;
  let g = cache.get(key);
  if (g) return g;
  const head = [0x8a8a80, 0xb87a3a, 0x8f969c, 0xb0b8c0, 0xff9a2a, 0x5ff0ff][era];
  const wood = era >= 5 ? 0x62e4ff : 0x7b5a3a, Z = -0.083;
  const R = (g2: G) => tag(g2, PART.hand, REGION.fixed);
  const shaft = (len: number) => R(cyl(0.009, 0.009, len, 4, 0.0, 0.17 - len, Z, wood));
  let parts: G[];
  switch (kind) {
    case 0: parts = [shaft(0.18), R(box(0.065, 0.05, 0.014, 0.035, -0.05, Z, head)), R(box(0.014, 0.05, 0.02, -0.005, -0.05, Z, 0x5a4330))]; break;
    case 1: parts = [shaft(0.18), R(box(0.016, 0.022, 0.14, 0.0, -0.06, Z, head)), R(box(0.016, 0.03, 0.02, 0.0, -0.085, Z + 0.07, head))]; break;
    case 2: parts = [shaft(0.2), R(box(0.075, 0.014, 0.05, 0.03, -0.065, Z, head))]; break;
    case 3: parts = [shaft(0.17), R(box(0.05, 0.04, 0.05, 0.0, -0.06, Z, head)), R(box(0.05, 0.012, 0.05, 0.0, -0.02, Z, 0x5a4330))]; break;
    case 4: parts = [R(cyl(0.05, 0.036, 0.055, 7, 0.045, 0.0, Z, 0xb89455)), R(cyl(0.046, 0.046, 0.012, 7, 0.045, 0.05, Z, 0xd8c36a)), R(blob(0.026, 0.045, 0.07, Z + 0.01, 0x7a9a3c))]; break;
    default: parts = [R(box(0.012, 0.075, 0.05, 0.04, 0.09, Z, era >= 4 ? 0x2a2f36 : 0xe8dcc0)), R(box(0.014, 0.05, 0.034, 0.047, 0.1, Z, era >= 4 ? 0x62e4ff : 0x8a6a47))];
  }
  g = merge(parts);
  cache.set(key, g);
  return g;
}

/** Charge portée à deux mains devant le torse : 0 planches (bâtisseur vers son chantier), 1 fagot, 2 sac de grain. */
export function loadGeometry(kind = 0): G {
  const key = "load" + kind;
  let g = cache.get(key);
  if (g) return g;
  const R = (g2: G) => tag(g2, PART.body, REGION.fixed);
  g = merge(kind === 0
    ? [R(box(0.2, 0.025, 0.07, 0.12, 0.19, 0, 0xc9a266)), R(box(0.2, 0.025, 0.07, 0.12, 0.215, 0.012, 0xb48f55)), R(box(0.2, 0.025, 0.07, 0.12, 0.24, -0.008, 0xd2ae72)), R(box(0.025, 0.07, 0.09, 0.07, 0.19, 0, 0x7b5a3a))]
    : kind === 1
      ? [R(cyl(0.045, 0.045, 0.2, 6, 0.12, 0.2, 0, 0x7b5a3a).rotateX(Math.PI / 2)), R(cyl(0.04, 0.04, 0.2, 6, 0.12, 0.23, 0.02, 0x8f6c47).rotateX(Math.PI / 2))]
      : [R(blob(0.075, 0.12, 0.22, 0, 0xd9c283)), R(blob(0.06, 0.12, 0.27, 0, 0xcfb674))]);
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
// pose (angle, décalage vertical) d'un membre pour un mode : 0 repos, 1 marche, 2 frappe (hache/marteau/pioche), 3 combat, 4 assis, 5 bêche/cueillette, 6 lecture, 7 parle, 8 écoute, 9 dispute, 10 porte
vec2 pose(float m, float part){
  float ph = aAnim.y, sp = aAnim.z;
  float wk = sin(uTime*9.0*sp + ph), wr = uTime*5.0*sp + ph, wf = uTime*7.0*sp + ph, ws = uTime*3.2*sp + ph;
  float s = part < 1.5 ? 1.0 : -1.0;
  float a = 0.0, y = 0.0;
  bool leg = part > 0.5 && part < 2.5, aL = part > 2.5 && part < 3.5, aR = part > 3.5;
  if (m < 0.5) { y = sin(uTime*1.6+ph)*0.003; if (aL) a = sin(uTime*1.3+ph)*0.07; else if (aR) a = -sin(uTime*1.3+ph)*0.07; }
  else if (m < 1.5) { y = abs(wk)*0.014; if (leg) a = s*wk*0.75; else if (aL) a = -wk*0.6; else if (aR) a = wk*0.6; }
  else if (m < 2.5) { y = -0.004 - 0.006*sin(wr); if (aL) a = 0.95 + sin(wr-0.3)*0.75; else if (aR) a = 1.4 + sin(wr)*0.85; }
  else if (m < 3.5) { if (leg) a = s*sin(wf*0.5)*0.35; else if (aL) a = 0.6 + sin(wf+1.5)*0.3; else if (aR) a = 1.0 + sin(wf)*0.9; }
  else if (m < 4.5) { y = -0.075; if (leg) a = 1.45; else if (part > 2.5) a = 0.55; }
  else if (m < 5.5) { y = -0.012 - 0.008*sin(ws); if (aL) a = 0.85 + sin(ws+0.5)*0.4; else if (aR) a = 0.9 + sin(ws)*0.45; }
  else if (m < 6.5) { if (aL) a = 0.95 + sin(uTime*0.9+ph)*0.04; else if (aR) a = 1.05 + sin(uTime*0.8+ph)*0.05; y = sin(uTime*1.6+ph)*0.003; }
  else if (m < 7.5) { // parle : gestes amples et alternés, léger balancement
    y = sin(uTime*2.2+ph)*0.004;
    if (aL) a = 0.55 + max(0.0, sin(wf*0.7+1.7))*1.0; else if (aR) a = 0.7 + max(0.0, sin(wf*0.6))*1.15; }
  else if (m < 8.5) { // écoute : attentif, hoche la tête (corps), un bras ramené vers le torse
    y = sin(uTime*1.4+ph)*0.005;
    if (aL) a = 0.12 + sin(uTime*1.1+ph)*0.05; else if (aR) a = 0.55 + sin(uTime*0.9+ph)*0.08; }
  else if (m < 9.5) { // dispute : gestes brusques des deux bras
    y = abs(sin(wf*1.4))*0.006;
    if (aL) a = 0.9 + sin(wf*2.1+1.0)*0.85; else if (aR) a = 1.1 + sin(wf*2.4)*0.95; }
  else { // porte : bras tendus devant, marche si besoin
    y = abs(wk)*0.01*step(0.5, sp);
    if (leg) a = s*wk*0.6*step(0.5, sp); else if (part > 2.5) a = 1.32 + sin(ws*0.6)*0.03; }
  return vec2(a, y);
}
void limb(){
  gAng = 0.0; gYoff = 0.0; gPiv = vec2(0.0);
  float w = aAnim.w, pm = floor(w + 0.001), t = clamp(fract(w + 0.001) / 0.95, 0.0, 1.0);
  vec2 r = pose(aAnim.x, aPart);
  if (t > 0.001 && abs(pm - aAnim.x) > 0.5) r = mix(r, pose(pm, aPart), t);
  gAng = (aPart > 0.5) ? r.x : 0.0; gYoff = r.y;
  if (aPart > 0.5) gPiv = aPart < 2.5 ? vec2(0.0, 0.15) : vec2(0.0, 0.30);
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
  push(m: THREE.Matrix4, mode: number, phase: number, speed: number, prev: number, cloth: THREE.Color, skin: THREE.Color, hair: THREE.Color, accent: THREE.Color): void {
    if (this.n >= this.cap) this.grow();
    const i = this.n++;
    this.mesh.setMatrixAt(i, m);
    this.anim.setXYZW(i, mode, phase, speed, prev);
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
