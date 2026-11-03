import * as THREE from "three";
import { blob, box, cone, cyl as cylG, dome as domeG, merge, prism } from "./geo";

// Habitants : 5 segments et icosaèdres, pour tenir quelques milliers d'instances sur iPhone.
const cyl = (rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, c: number) => cylG(rt, rb, h, Math.min(seg, 5), x, y, z, c);
const ball = (r: number, x: number, y: number, z: number, c: number, _w = 0, _h = 0) => blob(r, x, y, z, c);
const dome = (r: number, x: number, y: number, z: number, c: number, sy = 1) => blob(r, x, y + r * 0.3 * sy, z, c);

type G = THREE.BufferGeometry;
const SKIN = 0xf0c8a0;

/** Couleur de base des vêtements par époque (mélangée à la couleur de la civilisation). */
export const ERA_CLOTH = [0x8b6a45, 0xf0e6cf, 0x7a5c3a, 0x4a4a4a, 0x5a7090, 0xe8f0f8];
/** Couleur des outils par époque : pierre, bronze, fer, acier, plastique orange, énergie. */
export const ERA_TOOL = [0x8a8a80, 0xb87a3a, 0x8f969c, 0xb0b8c0, 0xff9a2a, 0x5ff0ff];

const cache = new Map<string, G>();
const memo = (k: string, f: () => G): G => { let g = cache.get(k); if (!g) { g = f(); cache.set(k, g); } return g; };

/** Corps (vêtements) : la silhouette change avec l'époque. */
export function citizenBody(era: number): G {
  return memo("body" + era, () => {
    switch (era) {
      case 0: return merge([cyl(0.05, 0.075, 0.15, 6, 0, 0.0, 0, 0xffffff), ball(0.06, 0.04, 0.17, 0, 0xcfc4b0, 5, 4), ball(0.06, -0.04, 0.17, 0, 0xcfc4b0, 5, 4)]);
      case 1: return merge([cyl(0.045, 0.07, 0.21, 7, 0, 0, 0, 0xffffff), box(0.1, 0.03, 0.09, 0, 0.12, 0, 0xd8b64a)]);
      case 2: return merge([cyl(0.045, 0.085, 0.23, 7, 0, 0, 0, 0xffffff), cyl(0.052, 0.052, 0.025, 7, 0, 0.12, 0, 0x4a3a2a), cone(0.06, 0.07, 6, 0, 0.2, 0, 0xffffff)]);
      case 3: return merge([cyl(0.04, 0.062, 0.2, 7, 0, 0.0, 0, 0xffffff), box(0.05, 0.1, 0.05, 0.02, 0, 0, 0x3a3a3a), cyl(0.065, 0.065, 0.02, 7, 0, 0.1, 0, 0x2a2a2a)]);
      case 4: return merge([box(0.06, 0.08, 0.05, -0.02, 0.0, 0, 0x2f3a52), box(0.06, 0.08, 0.05, 0.02, 0.0, 0, 0x2f3a52), cyl(0.045, 0.055, 0.15, 6, 0, 0.08, 0, 0xffffff)]);
      default: return merge([box(0.05, 0.09, 0.05, -0.02, 0.0, 0, 0xdde6ef), box(0.05, 0.09, 0.05, 0.02, 0.0, 0, 0xdde6ef), cyl(0.04, 0.05, 0.15, 7, 0, 0.09, 0, 0xffffff), box(0.15, 0.02, 0.06, 0, 0.2, 0, 0x62e4ff)]);
    }
  });
}

/** Tête + coiffe (couleurs propres, non teintées par la civilisation). */
export function citizenHead(era: number): G {
  return memo("head" + era, () => {
    const head = ball(0.05, 0, 0.27, 0, SKIN, 6, 5);
    switch (era) {
      case 0: return merge([head, ball(0.054, 0, 0.29, -0.01, 0x3a2a1c, 5, 4), box(0.01, 0.07, 0.01, 0.03, 0.32, 0.0, 0xd9d2c0)]);
      case 1: return merge([head, cyl(0.053, 0.053, 0.015, 8, 0, 0.3, 0, 0x4f9a52)]);
      case 2: return merge([head, cone(0.06, 0.09, 6, 0, 0.3, -0.005, 0x5a4a3a)]);
      case 3: return merge([head, cyl(0.075, 0.075, 0.012, 8, 0, 0.31, 0, 0x2a2a2a), cyl(0.045, 0.045, 0.07, 8, 0, 0.31, 0, 0x2a2a2a)]);
      case 4: return merge([head, ball(0.053, 0, 0.29, -0.012, 0x2a2018, 5, 4)]);
      default: return merge([head, box(0.11, 0.025, 0.05, 0, 0.27, 0.03, 0x62e4ff)]);
    }
  });
}

/** Équipement des soldats : casque + arme (+ bouclier), évoluent de la lance de pierre au fusil à énergie. */
export function soldierGear(era: number): G {
  return memo("gear" + era, () => {
    switch (era) {
      case 0: return merge([cyl(0.01, 0.01, 0.46, 4, 0.085, 0.0, 0, 0x7b5a3a), cone(0.022, 0.07, 4, 0.085, 0.46, 0, 0x8a8a80), ball(0.06, -0.075, 0.1, 0, 0x6b5a44, 5, 4), ball(0.055, 0, 0.3, 0, 0x7a5a3c, 5, 4)]);
      case 1: return merge([cyl(0.01, 0.01, 0.46, 4, 0.085, 0.0, 0, 0x7b5a3a), cone(0.024, 0.08, 4, 0.085, 0.46, 0, 0xc98a3a), cyl(0.075, 0.075, 0.015, 8, -0.085, 0.1, 0, 0xc98a3a).rotateZ(Math.PI / 2), cyl(0.055, 0.056, 0.05, 8, 0, 0.29, 0, 0xc98a3a)]);
      case 2: return merge([box(0.012, 0.3, 0.025, 0.09, 0.05, 0, 0xb8c0c8), box(0.05, 0.02, 0.025, 0.09, 0.14, 0, 0x6b4a2e), prism(0.1, 0.16, 0.02, -0.085, 0.04, 0, 0x8a2a2a), cyl(0.057, 0.057, 0.06, 8, 0, 0.28, 0, 0x8f969c), cone(0.057, 0.05, 8, 0, 0.34, 0, 0x8f969c)]);
      case 3: return merge([cyl(0.008, 0.008, 0.4, 4, 0.085, 0.04, 0, 0x4a3a2a), box(0.012, 0.02, 0.1, 0.085, 0.4, 0, 0xb0b8c0), box(0.05, 0.015, 0.05, 0.085, 0.44, 0, 0xb0b8c0), cyl(0.06, 0.06, 0.05, 8, 0, 0.28, 0, 0x4a4a4a), cyl(0.07, 0.07, 0.01, 8, 0, 0.28, 0, 0x4a4a4a)]);
      case 4: return merge([box(0.022, 0.034, 0.26, 0.085, 0.1, 0.0, 0x222a30), box(0.016, 0.06, 0.03, 0.085, 0.06, 0.04, 0x222a30), dome(0.062, 0, 0.27, 0, 0x5b6b45, 0.9), box(0.04, 0.12, 0.03, 0, 0.1, -0.06, 0x3a4a30)]);
      default: return merge([box(0.026, 0.04, 0.3, 0.09, 0.1, 0.0, 0xdde6ef), box(0.01, 0.01, 0.22, 0.09, 0.12, 0.0, 0x62e4ff), dome(0.064, 0, 0.27, 0, 0xdde6ef, 0.9), box(0.12, 0.03, 0.02, 0, 0.29, 0.05, 0x62e4ff), box(0.05, 0.14, 0.04, 0, 0.08, -0.07, 0x62e4ff)]);
    }
  });
}

/** Outil civil : manche + tête (couleur d'époque via la teinte d'instance). */
export function toolModel(): G {
  return memo("tool", () => merge([cyl(0.01, 0.01, 0.26, 4, 0.085, 0.0, 0, 0x7b5a3a), box(0.07, 0.035, 0.015, 0.085, 0.26, 0, 0xffffff)]));
}

/** Accessoires d'armée par époque : étendard, chariot, cavalerie, canon, char, drone. */
export function armyProp(era: number): G {
  return memo("prop" + era, () => {
    switch (era) {
      case 0: return merge([cyl(0.015, 0.015, 0.55, 4, 0, 0, 0, 0x7b5a3a), ball(0.07, 0, 0.58, 0, 0xcfc4b0, 5, 4), box(0.12, 0.08, 0.02, 0.07, 0.4, 0, 0x8a6a47)]);
      case 1: return merge([box(0.3, 0.07, 0.18, 0, 0.1, 0, 0x8a6a47), cyl(0.07, 0.07, 0.025, 8, -0.1, 0.07, 0.11, 0x5e4630).rotateX(Math.PI / 2), cyl(0.07, 0.07, 0.025, 8, 0.1, 0.07, 0.11, 0x5e4630).rotateX(Math.PI / 2), box(0.22, 0.04, 0.03, 0.05, 0.2, 0, 0x7b5a3a), box(0.04, 0.12, 0.04, 0.17, 0.12, 0, 0x7b5a3a)]);
      case 2: return merge([box(0.3, 0.12, 0.1, 0, 0.2, 0, 0x7a5436), cyl(0.025, 0.025, 0.18, 4, -0.11, 0.05, 0.03, 0x5e4630), cyl(0.025, 0.025, 0.18, 4, -0.11, 0.05, -0.03, 0x5e4630), cyl(0.025, 0.025, 0.18, 4, 0.11, 0.05, 0.03, 0x5e4630), cyl(0.025, 0.025, 0.18, 4, 0.11, 0.05, -0.03, 0x5e4630),
        box(0.1, 0.14, 0.07, 0.18, 0.26, 0, 0x7a5436), box(0.08, 0.05, 0.05, 0.25, 0.28, 0, 0x6a4426), box(0.06, 0.12, 0.08, -0.02, 0.3, 0, 0xb0b8c0), cyl(0.012, 0.012, 0.3, 4, -0.02, 0.4, 0, 0x6b4a2e)]);
      case 3: return merge([cyl(0.04, 0.05, 0.3, 7, 0.08, 0.0, 0, 0x3a3a3a).rotateZ(Math.PI / 2).translate(0, 0.14, 0), box(0.16, 0.05, 0.1, -0.06, 0.1, 0, 0x6b4a2e), cyl(0.08, 0.08, 0.03, 8, -0.06, 0.08, 0.075, 0x4a3a2a).rotateX(Math.PI / 2), cyl(0.08, 0.08, 0.03, 8, -0.06, 0.08, -0.075, 0x4a3a2a).rotateX(Math.PI / 2), ball(0.05, 0.2, 0.15, 0, 0x2a2a2a, 5, 4)]);
      case 4: return merge([box(0.34, 0.08, 0.2, 0, 0.04, 0, 0x4a5236), box(0.36, 0.03, 0.06, 0, 0.0, 0.12, 0x2a2a2a), box(0.36, 0.03, 0.06, 0, 0.0, -0.12, 0x2a2a2a), box(0.2, 0.07, 0.14, -0.03, 0.12, 0, 0x5b6b45), cyl(0.012, 0.012, 0.28, 4, 0.2, 0.16, 0, 0x2a2a2a).rotateZ(Math.PI / 2).translate(0, 0, 0)]);
      default: return merge([dome(0.12, 0, 0.26, 0, 0xdde6ef, 0.8), cyl(0.14, 0.16, 0.05, 10, 0, 0.2, 0, 0x2f3d4d), cyl(0.15, 0.15, 0.02, 10, 0, 0.17, 0, 0x62e4ff), box(0.02, 0.02, 0.22, 0.12, 0.28, 0, 0x62e4ff), cyl(0.012, 0.012, 0.2, 4, 0, 0.0, 0, 0x62e4ff)]);
    }
  });
}

/** Véhicules et drones du trafic (décor lié aux routes réelles). */
export function trainCar(loco: boolean): G {
  return memo("train" + loco, () => loco
    ? merge([box(0.34, 0.1, 0.12, 0, 0.04, 0, 0x2a2a2a), box(0.14, 0.14, 0.12, 0.1, 0.12, 0, 0x3a3a3a), cyl(0.035, 0.04, 0.12, 6, -0.1, 0.14, 0, 0x2a2a2a), cyl(0.05, 0.05, 0.1, 6, 0.02, 0.1, 0, 0x555555).rotateZ(Math.PI / 2)])
    : merge([box(0.32, 0.12, 0.12, 0, 0.04, 0, 0x8a5a3a), box(0.34, 0.03, 0.13, 0, 0.16, 0, 0x4a4a4a)]));
}
export function carModel(): G {
  return memo("car", () => merge([box(0.14, 0.05, 0.075, 0, 0.015, 0, 0xffffff), box(0.07, 0.04, 0.065, -0.005, 0.065, 0, 0x7fb6d6)]));
}
export function droneModel(): G {
  return memo("drone", () => merge([box(0.07, 0.025, 0.07, 0, 0, 0, 0xdde6ef), box(0.16, 0.008, 0.016, 0, 0.03, 0, 0x2f3d4d), box(0.016, 0.008, 0.16, 0, 0.03, 0, 0x2f3d4d), ball(0.014, 0, -0.012, 0, 0x62e4ff, 4, 3)]));
}
export function pylonModel(): G {
  return memo("pylon", () => merge([cyl(0.012, 0.03, 0.55, 4, 0, 0, 0, 0x8d949c), box(0.26, 0.018, 0.018, 0, 0.44, 0, 0x8d949c), box(0.2, 0.018, 0.018, 0, 0.34, 0, 0x8d949c)]));
}
export function lampModel(): G {
  return memo("lamp", () => merge([cyl(0.008, 0.012, 0.26, 4, 0, 0, 0, 0x3a3a3a), ball(0.025, 0, 0.28, 0, 0xffd98a, 5, 4)]));
}
