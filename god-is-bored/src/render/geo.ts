import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

function colored(g: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
  const ng = g.index ? g.toNonIndexed() : g;
  const c = new THREE.Color(color);
  const n = ng.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  ng.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return ng;
}
export const box = (w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0): THREE.BufferGeometry => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return colored(g, color);
};
export const cone = (r: number, h: number, seg: number, x: number, y: number, z: number, color: number, ry = 0): THREE.BufferGeometry => {
  const g = new THREE.ConeGeometry(r, h, seg);
  if (ry) g.rotateY(ry);
  g.translate(x, y + h / 2, z);
  return colored(g, color);
};
export const cyl = (rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, color: number): THREE.BufferGeometry => {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg);
  g.translate(x, y + h / 2, z);
  return colored(g, color);
};
/** Sphère très légère (icosaèdre) pour les habitants : 60 sommets au lieu de ~180. */
export const blob = (r: number, x: number, y: number, z: number, color: number): THREE.BufferGeometry => {
  const g = new THREE.IcosahedronGeometry(r, 0);
  g.translate(x, y, z);
  return colored(g, color);
};
export const ball = (r: number, x: number, y: number, z: number, color: number, w = 8, h = 6): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, w, h);
  g.translate(x, y, z);
  return colored(g, color);
};
/** Prisme triangulaire (toit à deux pans, faîte le long de l'axe z). */
export const prism = (w: number, h: number, d: number, x: number, y: number, z: number, color: number, ry = 0): THREE.BufferGeometry => {
  const hw = w / 2, hd = d / 2;
  const v = [
    -hw, 0, -hd, hw, 0, -hd, 0, h, -hd, // pignon arrière
    -hw, 0, hd, 0, h, hd, hw, 0, hd, // pignon avant
    -hw, 0, -hd, 0, h, -hd, 0, h, hd, -hw, 0, -hd, 0, h, hd, -hw, 0, hd, // pan gauche
    hw, 0, -hd, hw, 0, hd, 0, h, hd, hw, 0, -hd, 0, h, hd, 0, h, -hd, // pan droit
    -hw, 0, -hd, -hw, 0, hd, hw, 0, hd, -hw, 0, -hd, hw, 0, hd, hw, 0, -hd, // dessous
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array((v.length / 3) * 2), 2));
  g.computeVertexNormals();
  if (ry) g.rotateY(ry);
  g.translate(x, y, z);
  return colored(g, color);
};
/** Demi-sphère (dôme). */
export const dome = (r: number, x: number, y: number, z: number, color: number, sy = 1): THREE.BufferGeometry => {
  const g = new THREE.SphereGeometry(r, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  g.scale(1, sy, 1);
  g.translate(x, y, z);
  return colored(g, color);
};
export const merge = (list: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  const m = mergeGeometries(list, false);
  if (!m) throw new Error("merge failed");
  m.computeVertexNormals();
  return m;
};

export interface BuildingGeo { body: THREE.BufferGeometry; accent: THREE.BufferGeometry | null; }

const STONE = 0xcfc7b4, WOOD = 0x8a6a4a, CREAM = 0xe9dcc0, DARK = 0x6e6a66;

export function buildingGeometries(): Record<string, BuildingGeo> {
  const q = Math.PI / 4;
  return {
    house: {
      body: merge([box(0.5, 0.34, 0.44, 0, 0, 0, CREAM), box(0.1, 0.18, 0.1, 0.16, 0.34, -0.1, STONE)]),
      accent: merge([cone(0.46, 0.34, 4, 0, 0.34, 0, 0xffffff, q)]),
    },
    hall: {
      body: merge([box(0.8, 0.46, 0.7, 0, 0, 0, STONE), box(0.26, 0.62, 0.26, -0.28, 0, -0.24, CREAM), cyl(0.02, 0.02, 0.9, 5, 0.34, 0, 0.3, WOOD), box(0.2, 0.06, 0.06, 0, 0.46, 0.38, 0x8a6a4a)]),
      accent: merge([cone(0.62, 0.38, 4, 0, 0.46, 0, 0xffffff, q), cone(0.2, 0.26, 4, -0.28, 0.62, -0.24, 0xffffff, q), box(0.26, 0.15, 0.02, 0.47, 0.72, 0.3, 0xffffff)]),
    },
    farm: {
      body: merge([box(0.92, 0.05, 0.92, 0, 0, 0, 0xd7b950), box(0.84, 0.07, 0.07, 0, 0.04, -0.3, 0xa98d36), box(0.84, 0.07, 0.07, 0, 0.04, 0, 0xa98d36), box(0.84, 0.07, 0.07, 0, 0.04, 0.3, 0xa98d36),
        cyl(0.02, 0.02, 0.3, 4, 0.4, 0.05, 0.4, WOOD), box(0.14, 0.1, 0.02, 0.4, 0.28, 0.4, 0xcdb27a)]),
      accent: null,
    },
    lumber: {
      body: merge([box(0.38, 0.26, 0.34, -0.1, 0, 0, WOOD), cyl(0.07, 0.07, 0.32, 6, 0.27, 0.07, 0.15, 0x7b5a3a), cyl(0.07, 0.07, 0.32, 6, 0.3, 0.07, -0.05, 0x7b5a3a), cyl(0.07, 0.07, 0.32, 6, 0.28, 0.2, 0.05, 0x8f6c47)]),
      accent: merge([cone(0.36, 0.22, 4, -0.1, 0.26, 0, 0xffffff, q)]),
    },
    quarry: {
      body: merge([box(0.4, 0.24, 0.36, -0.12, 0, 0.05, 0x9a9a98, 0.4), box(0.3, 0.16, 0.3, 0.2, 0, -0.12, 0xb2b0aa, 0.9), box(0.24, 0.3, 0.22, 0.16, 0, 0.2, 0x8a8987, 0.2)]),
      accent: null,
    },
    barracks: {
      body: merge([box(0.88, 0.34, 0.5, 0, 0, 0, 0xb9a98f), cyl(0.02, 0.02, 0.8, 5, 0.38, 0, 0.3, WOOD)]),
      accent: merge([cone(0.58, 0.28, 4, 0, 0.34, 0, 0xffffff, q), box(0.22, 0.16, 0.02, 0.5, 0.62, 0.3, 0xffffff)]),
    },
    temple: {
      body: merge([box(0.86, 0.08, 0.7, 0, 0, 0, 0xf0ece0), cyl(0.05, 0.05, 0.4, 6, -0.3, 0.08, -0.22, 0xf4f1e8), cyl(0.05, 0.05, 0.4, 6, 0.3, 0.08, -0.22, 0xf4f1e8),
        cyl(0.05, 0.05, 0.4, 6, -0.3, 0.08, 0.22, 0xf4f1e8), cyl(0.05, 0.05, 0.4, 6, 0.3, 0.08, 0.22, 0xf4f1e8), box(0.76, 0.06, 0.6, 0, 0.48, 0, 0xe2ddd0)]),
      accent: merge([cone(0.5, 0.3, 4, 0, 0.54, 0, 0xffffff, q), ball(0.06, 0, 0.9, 0, 0xffffff)]),
    },
    castle: {
      body: merge([box(0.96, 0.22, 0.96, 0, 0, 0, 0xb8b3a6), box(0.5, 0.78, 0.5, 0, 0.22, 0, 0xcbc6b8),
        cyl(0.15, 0.17, 0.72, 7, -0.4, 0, -0.4, 0xc2bdae), cyl(0.15, 0.17, 0.72, 7, 0.4, 0, -0.4, 0xc2bdae), cyl(0.15, 0.17, 0.72, 7, -0.4, 0, 0.4, 0xc2bdae), cyl(0.15, 0.17, 0.72, 7, 0.4, 0, 0.4, 0xc2bdae),
        cyl(0.02, 0.02, 0.5, 5, 0, 1, 0, WOOD)]),
      accent: merge([cone(0.2, 0.3, 7, -0.4, 0.72, -0.4, 0xffffff), cone(0.2, 0.3, 7, 0.4, 0.72, -0.4, 0xffffff), cone(0.2, 0.3, 7, -0.4, 0.72, 0.4, 0xffffff), cone(0.2, 0.3, 7, 0.4, 0.72, 0.4, 0xffffff),
        cone(0.36, 0.28, 4, 0, 1.0, 0, 0xffffff, q), box(0.24, 0.14, 0.02, 0.14, 1.34, 0, 0xffffff)]),
    },
  };
}

export function treeGeometry(): THREE.BufferGeometry {
  return merge([cyl(0.025, 0.035, 0.14, 5, 0, 0, 0, 0x6b4a2e), cone(0.17, 0.24, 6, 0, 0.1, 0, 0x3f7d46), cone(0.13, 0.22, 6, 0, 0.26, 0, 0x4b8f4f), cone(0.085, 0.18, 6, 0, 0.4, 0, 0x5aa05a)]);
}
export function bodyGeometry(): THREE.BufferGeometry {
  return merge([cyl(0.045, 0.065, 0.2, 6, 0, 0, 0, 0xffffff)]);
}
export function headGeometry(): THREE.BufferGeometry {
  return merge([ball(0.05, 0, 0.25, 0, 0xffffff, 6, 5)]);
}
export function spearGeometry(): THREE.BufferGeometry {
  return merge([cyl(0.008, 0.008, 0.42, 4, 0.075, 0.02, 0, 0x7b5a3a), cone(0.022, 0.07, 4, 0.075, 0.44, 0, 0xcfd3d8), box(0.02, 0.15, 0.1, -0.075, 0.04, 0, 0x8a8f96)]);
}
