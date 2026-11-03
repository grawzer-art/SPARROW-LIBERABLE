import * as THREE from "three";

/** InstancedMesh à capacité extensible : une géométrie réutilisée pour tous les exemplaires (économe sur iPhone). */
export class GrowMesh {
  mesh: THREE.InstancedMesh;
  private n = 0;
  private cap: number;
  constructor(private scene: THREE.Scene, private geo: THREE.BufferGeometry, private mat: THREE.Material, cap = 64, private shadow = false, private colored = true) {
    this.cap = cap;
    this.mesh = this.make(cap);
  }
  private make(cap: number): THREE.InstancedMesh {
    const m = new THREE.InstancedMesh(this.geo, this.mat, cap);
    m.frustumCulled = false;
    m.castShadow = this.shadow;
    m.receiveShadow = this.shadow;
    m.count = 0;
    m.visible = false;
    this.scene.add(m);
    return m;
  }
  begin(): void { this.n = 0; }
  get count(): number { return this.n; }
  push(matrix: THREE.Matrix4, color?: THREE.Color): void {
    if (this.n >= this.cap) this.grow();
    this.mesh.setMatrixAt(this.n, matrix);
    if (color) this.mesh.setColorAt(this.n, color);
    this.n++;
  }
  private grow(): void {
    const old = this.mesh;
    this.cap *= 2;
    const next = this.make(this.cap);
    (next.instanceMatrix.array as Float32Array).set(old.instanceMatrix.array as Float32Array);
    if (old.instanceColor) {
      next.setColorAt(0, new THREE.Color());
      (next.instanceColor!.array as Float32Array).set(old.instanceColor.array as Float32Array);
    }
    this.scene.remove(old);
    old.dispose();
    this.mesh = next;
  }
  end(): void {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.dispose();
  }
}
