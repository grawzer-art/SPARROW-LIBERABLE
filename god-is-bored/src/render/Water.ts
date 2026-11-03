import * as THREE from "three";
import type { Sky } from "./Sky";

/** Eau : surface ondulante, normales analytiques, Fresnel, reflets spéculaires du soleil ; la couleur vient du dégradé du fond. */
export class Water {
  readonly mesh: THREE.Mesh;
  constructor(scene: THREE.Scene, N: number, sky: Sky, mobile: boolean) {
    const seg = mobile ? 44 : 84;
    const g = new THREE.PlaneGeometry(N, N, seg, seg);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3f8fab, transparent: true, opacity: 0.8, roughness: 0.12, metalness: 0.0, depthWrite: false });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = sky.uniforms.uTime;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", `#include <common>
uniform float uTime;
float wv(vec2 p, float t){ return 0.016*sin(p.x*1.7+t*1.1)+0.012*sin(p.y*2.3+t*0.9)+0.008*sin((p.x+p.y)*3.1+t*1.7)+0.005*sin((p.x-p.y)*5.3-t*2.1); }
vec2 wg(vec2 p, float t){ return vec2(0.016*1.7*cos(p.x*1.7+t*1.1)+0.008*3.1*cos((p.x+p.y)*3.1+t*1.7)+0.005*5.3*cos((p.x-p.y)*5.3-t*2.1), 0.012*2.3*cos(p.y*2.3+t*0.9)+0.008*3.1*cos((p.x+p.y)*3.1+t*1.7)-0.005*5.3*cos((p.x-p.y)*5.3-t*2.1)); }`)
        .replace("#include <beginnormal_vertex>", `vec2 gr = wg(position.xz, uTime);
vec3 objectNormal = normalize(vec3(-gr.x, 1.0, -gr.y));
#ifdef USE_TANGENT
vec3 objectTangent = vec3( tangent.xyz );
#endif`)
        .replace("#include <begin_vertex>", `vec3 transformed = vec3(position);
transformed.y += wv(position.xz, uTime);`);
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
diffuseColor.a = clamp(0.66 + fres * 0.32, 0.0, 0.97);`);
    };
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.position.y = -0.03;
    this.mesh.renderOrder = 3;
    this.mesh.receiveShadow = false;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
  }
  dispose(scene: THREE.Scene): void { scene.remove(this.mesh); this.mesh.geometry.dispose(); }
}
