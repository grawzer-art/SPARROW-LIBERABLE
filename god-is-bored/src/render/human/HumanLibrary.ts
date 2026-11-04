import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";

/**
 * Bibliothèque de VRAIS humains 3D riggés (glTF/GLB) et de clips d'animation de capture de mouvement.
 * Les modèles sont chargés une fois, puis clonés avec leur squelette (SkeletonUtils) : géométries et textures partagées.
 * Les clips (Xbot : idle, walk, run, agree, headShake, sneak_pose, sad_pose) sont retargetés sur n'importe quel squelette
 * Mixamo / Ready Player Me : même hiérarchie d'os, préfixe « mixamorig » retiré, translation du bassin remise à l'échelle.
 */
export interface BodySpec { id: string; url: string; label: string; female: boolean; hide: RegExp | null; scale: number; garments?: { mesh: RegExp; drop: RegExp }[]; }

export const BODIES: BodySpec[] = [
  { id: "rpm_man", url: "assets/humans/rpm_man.glb", label: "Homme (Ready Player Me)", female: false, hide: /Headwear|Outfit_Footwear/i, scale: 1,
    // NB : le corps nu de ce modèle n'existe pas sous les vêtements (bras et jambes absents) : on ne peut pas retirer le costume (voir docs/realism/AUDIT.md)
  },
  { id: "michelle", url: "assets/humans/michelle.glb", label: "Femme (Mixamo « Michelle »)", female: true, hide: null, scale: 1.0 },
];
export const CLIP_URL = "assets/humans/anim_xbot.glb";
export const CLIPS = ["idle", "walk", "run", "agree", "headShake", "sneak_pose", "sad_pose"] as const;
export type ClipName = (typeof CLIPS)[number];

interface Loaded { spec: BodySpec; scene: THREE.Object3D; skinned: THREE.SkinnedMesh; clips: Map<string, THREE.AnimationClip>; }

export class HumanLibrary {
  private bodies = new Map<string, Loaded>();
  private source: THREE.SkinnedMesh | null = null;
  private srcClips: THREE.AnimationClip[] = [];
  stats = { loadMs: 0, bytes: 0 };

  static async load(base = ""): Promise<HumanLibrary> {
    const lib = new HumanLibrary();
    const t0 = performance.now();
    const loader = new GLTFLoader();
    // page autonome : les modèles peuvent être embarqués (data URLs) dans window.__HUMAN_ASSETS
    const emb = (window as unknown as { __HUMAN_ASSETS?: Record<string, string> }).__HUMAN_ASSETS;
    const get = async (url: string) => loader.loadAsync(emb?.[url] ?? base + url);
    const [clipsGltf, ...bodies] = await Promise.all([get(CLIP_URL), ...BODIES.map((b) => get(b.url))]);
    clipsGltf.scene.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh && !lib.source) lib.source = o as THREE.SkinnedMesh; });
    clipsGltf.scene.updateMatrixWorld(true);
    lib.srcClips = clipsGltf.animations;
    bodies.forEach((g, i) => {
      const spec = BODIES[i];
      let skinned: THREE.SkinnedMesh | null = null;
      g.scene.traverse((o) => {
        const m = o as THREE.SkinnedMesh;
        if (m.isMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; }
        if (m.isSkinnedMesh && m.skeleton.bones.some((b) => /Hips$/.test(b.name)) && (!skinned || m.skeleton.bones.length > skinned.skeleton.bones.length)) skinned = m;
      });
      g.scene.updateMatrixWorld(true);
      const body: Loaded = { spec, scene: g.scene, skinned: skinned!, clips: new Map() };
      lib.bodies.set(spec.id, body);
      lib.retargetAll(body);
    });
    lib.stats.loadMs = performance.now() - t0;
    return lib;
  }

  /**
   * Retargeting des clips de capture de mouvement sur le squelette d'un corps, en espace monde : pour chaque os, la rotation du clip
   * par rapport à la pose de repos de la source est appliquée à la pose de repos du corps (les deux sont en T). Cela corrige les repères
   * d'os différents (Mixamo, Ready Player Me…). La translation du bassin est mise à l'échelle (hauteur) et réduite à son mouvement vertical :
   * le déplacement vient de la simulation, les pieds ne glissent pas.
   */
  private retargetAll(body: Loaded): void {
    const src = this.source!;
    const tBones = body.skinned.skeleton.bones, sBones = src.skeleton.bones;
    const strip = (n: string) => n.replace(/^mixamorig:?/, "");
    const sByName = new Map(sBones.map((b) => [strip(b.name), b]));
    const root = (o: THREE.Object3D) => { while (o.parent) o = o.parent; return o; };
    const worldQ = (o: THREE.Object3D) => o.getWorldQuaternion(new THREE.Quaternion());
    // poses de repos (monde)
    body.skinned.skeleton.pose(); root(body.skinned).updateMatrixWorld(true);
    src.skeleton.pose(); root(src).updateMatrixWorld(true);
    const tRestW = new Map<THREE.Bone, THREE.Quaternion>(), tRestL = new Map<THREE.Bone, THREE.Quaternion>();
    for (const b of tBones) { tRestW.set(b, worldQ(b)); tRestL.set(b, b.quaternion.clone()); }
    const sRestW = new Map<string, THREE.Quaternion>();
    for (const [n, b] of sByName) sRestW.set(n, worldQ(b));
    const tHips = tBones.find((b) => /Hips$/.test(strip(b.name)))!;
    const tRestPos = tHips.position.clone();
    const parentRestW = (b: THREE.Bone) => (b.parent ? worldQ(b.parent) : new THREE.Quaternion());
    const tParentRest = new Map<THREE.Bone, THREE.Quaternion>(); for (const b of tBones) tParentRest.set(b, parentRestW(b));
    const FPS = 30, qd = new THREE.Quaternion(), qt = new THREE.Quaternion(), qp = new THREE.Quaternion();
    const mixer = new THREE.AnimationMixer(src);
    for (const clip of this.srcClips) {
      if (!CLIPS.includes(clip.name as ClipName)) continue;
      const act = mixer.clipAction(clip); act.reset().play();
      const hipTrack = clip.tracks.find((t) => /Hips\.position$/.test(t.name));
      const hipInterp = hipTrack ? hipTrack.createInterpolant() : null;
      const hipY0 = hipInterp ? hipInterp.evaluate(0)[1] : 1;
      const n = Math.max(2, Math.round(clip.duration * FPS)), times: number[] = [], quat = new Map<THREE.Bone, number[]>(), hipPos: number[] = [];
      for (const b of tBones) quat.set(b, []);
      for (let f = 0; f < n; f++) {
        const t = (f / n) * clip.duration; times.push(t);
        mixer.setTime(t); root(src).updateMatrixWorld(true);
        const world = new Map<THREE.Bone, THREE.Quaternion>();
        for (const b of tBones) {
          const sb = sByName.get(strip(b.name));
          const pw = b.parent && world.has(b.parent as THREE.Bone) ? world.get(b.parent as THREE.Bone)! : (tParentRest.get(b) as THREE.Quaternion);
          let local: THREE.Quaternion, wq: THREE.Quaternion;
          if (sb) {
            qd.copy(worldQ(sb)).multiply(sRestW.get(strip(b.name))!.clone().invert()); // rotation du clip, dans le repère monde
            qt.copy(qd).multiply(tRestW.get(b)!);
            wq = qt.clone();
            local = qp.copy(pw).invert().multiply(wq).clone();
          } else { local = tRestL.get(b)!.clone(); wq = pw.clone().multiply(local); }
          world.set(b, wq);
          quat.get(b)!.push(local.x, local.y, local.z, local.w);
        }
        hipPos.push(tRestPos.x, hipInterp ? tRestPos.y * (hipInterp.evaluate(t)[1] / Math.max(1e-4, hipY0)) : tRestPos.y, tRestPos.z); // montée/descente du bassin en proportion de sa hauteur (indépendant des unités du clip)
      }
      act.stop();
      const tracks: THREE.KeyframeTrack[] = [];
      for (const b of tBones) tracks.push(new THREE.QuaternionKeyframeTrack(`.bones[${b.name}].quaternion`, times, quat.get(b)!));
      tracks.push(new THREE.VectorKeyframeTrack(`.bones[${tHips.name}].position`, times, hipPos));
      body.clips.set(clip.name, new THREE.AnimationClip(clip.name, clip.duration, tracks));
    }
    body.skinned.skeleton.pose();
  }

  spawn(bodyId: string): HumanActor {
    const body = this.bodies.get(bodyId)!;
    const root = SkeletonUtils.clone(body.scene) as THREE.Object3D;
    const actor = new HumanActor(root, body.spec);
    for (const c of CLIPS) { const clip = body.clips.get(c); if (clip) actor.addClip(clip); }
    return actor;
  }
}

/**
 * Retire d'un vêtement les triangles dont l'os dominant appartient à `drop` (manches, jambes…) : un pantalon devient un pagne court,
 * une veste un gilet sans manches. La géométrie reste celle du modèle riggé d'origine (mêmes poids, même squelette), seulement découpée.
 */
export function trimGarment(mesh: THREE.SkinnedMesh, drop: RegExp): void {
  const g = mesh.geometry as THREE.BufferGeometry;
  const si = g.getAttribute("skinIndex") as THREE.BufferAttribute, sw = g.getAttribute("skinWeight") as THREE.BufferAttribute, idx = g.getIndex();
  if (!si || !sw || !idx) return;
  const names = mesh.skeleton.bones.map((b) => b.name);
  const dominant = (v: number): string => { let bi = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = k === 0 ? sw.getX(v) : k === 1 ? sw.getY(v) : k === 2 ? sw.getZ(v) : sw.getW(v); if (w > bw) { bw = w; bi = k === 0 ? si.getX(v) : k === 1 ? si.getY(v) : k === 2 ? si.getZ(v) : si.getW(v); } } return names[bi]; };
  const gone = new Uint8Array(si.count);
  for (let v = 0; v < si.count; v++) gone[v] = drop.test(dominant(v)) ? 1 : 0;
  const keep: number[] = [];
  for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i), b = idx.getX(i + 1), c = idx.getX(i + 2); if (!gone[a] && !gone[b] && !gone[c]) keep.push(a, b, c); }
  const ng = g.clone(); ng.setIndex(keep);
  mesh.geometry = ng;
}

/** Texture de peau tannée (grain, rayures, taches) : vêtement de peau, sans aucune texture moderne. */
export function hideTexture(base: string, seed = 1): THREE.CanvasTexture {
  const c = document.createElement("canvas"); c.width = c.height = 256;
  const g = c.getContext("2d")!; g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  let r = seed * 9301 + 49297; const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 2600; i++) { const x = rnd() * 256, y = rnd() * 256, l = 2 + rnd() * 9, a = rnd() * 6.28; g.strokeStyle = rnd() < 0.5 ? `rgba(40,25,12,${0.05 + rnd() * 0.12})` : `rgba(210,175,130,${0.04 + rnd() * 0.1})`; g.lineWidth = 0.6 + rnd() * 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  for (let i = 0; i < 40; i++) { const x = rnd() * 256, y = rnd() * 256, rad = 6 + rnd() * 20; const gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, `rgba(30,18,8,${0.08 + rnd() * 0.12})`); gr.addColorStop(1, "rgba(30,18,8,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

/** Un humain en scène : corps animé par mélange de clips, visage expressif (morphs), variantes physiques. */
export class HumanActor {
  readonly mixer: THREE.AnimationMixer;
  readonly group = new THREE.Group();
  private actions = new Map<string, THREE.AnimationAction>();
  private current: THREE.AnimationAction | null = null;
  private morphMeshes: THREE.Mesh[] = [];
  private skinMats: THREE.MeshStandardMaterial[] = [];
  private clothMats: THREE.MeshStandardMaterial[] = [];
  private clothMeshes: THREE.Mesh[] = [];
  time = 0;
  speak = 0;

  constructor(readonly root: THREE.Object3D, readonly spec: BodySpec) {
    this.group.add(root);
    // les pistes retargetées sont de la forme `.bones[os]` : le mélangeur doit être posé sur un SkinnedMesh du corps (le squelette est partagé par tous ses maillages)
    let sk: THREE.Object3D = root;
    root.traverse((o) => { const m = o as THREE.SkinnedMesh; if (m.isSkinnedMesh && m.skeleton.bones.some((b) => /Hips$/.test(b.name)) && (sk === root || m.skeleton.bones.length > (sk as THREE.SkinnedMesh).skeleton.bones.length)) sk = m; });
    this.mixer = new THREE.AnimationMixer(sk);
    root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (spec.hide && spec.hide.test(m.name)) { m.visible = false; return; }
      if (spec.garments && (m as THREE.SkinnedMesh).isSkinnedMesh) for (const gm of spec.garments) if (gm.mesh.test(m.name)) { trimGarment(m as THREE.SkinnedMesh, gm.drop); this.clothMeshes.push(m); }
      if (m.morphTargetDictionary && ("mouthOpen" in m.morphTargetDictionary || "mouthSmile" in m.morphTargetDictionary)) this.morphMeshes.push(m);
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      m.material = mat;
      const n = (m.name + mat.name).toLowerCase();
      if (/skin|head|body|ch03_body/.test(n) && !/outfit|top|bottom/.test(n)) this.skinMats.push(mat);
      else if (/outfit|top|bottom|cloth|shirt|pant/.test(n)) this.clothMats.push(mat);
    });
    this.group.scale.setScalar(spec.scale);
  }

  addClip(c: THREE.AnimationClip): void { const a = this.mixer.clipAction(c); a.setEffectiveWeight(0); this.actions.set(c.name, a); }
  get clipNames(): string[] { return [...this.actions.keys()]; }

  /** Fondu enchaîné vers un clip (marche, course, geste…), sans saccade. */
  play(name: string, fade = 0.25, speed = 1): void {
    const next = this.actions.get(name);
    if (!next) return;
    next.setEffectiveTimeScale(speed);
    if (this.current === next) return;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.current) this.current.fadeOut(fade);
    this.current = next;
  }
  get playing(): string { return this.current?.getClip().name ?? ""; }

  /** Variantes physiques : taille, teinte de peau, étoffe des vêtements (un vêtement de peau ou de lin, jamais une couleur flashy). */
  look(o: { height?: number; skin?: THREE.ColorRepresentation; cloth?: THREE.ColorRepresentation; clothRough?: number }): void {
    if (o.height) this.group.scale.setScalar(this.spec.scale * o.height);
    if (o.skin) for (const m of this.skinMats) m.color.set(o.skin);
    if (o.cloth) { const css = "#" + new THREE.Color(o.cloth).getHexString(); const tex = hideTexture(css, Math.round(new THREE.Color(o.cloth).getHex() % 997)); for (const m of this.clothMats) { m.map = tex; m.normalMap = null; m.color.set(0xffffff); m.roughness = o.clothRough ?? 0.97; m.metalness = 0; m.needsUpdate = true; } }
  }

  /** Expression du visage (0..1) : sourire, bouche ouverte (parole). */
  face(smile: number, open: number): void {
    for (const m of this.morphMeshes) {
      const d = m.morphTargetDictionary!, inf = m.morphTargetInfluences!;
      if ("mouthSmile" in d) inf[d.mouthSmile] = smile;
      if ("mouthOpen" in d) inf[d.mouthOpen] = open;
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.mixer.update(dt);
    // parole : la bouche suit un rythme syllabique tant que `speak` > 0
    if (this.speak > 0) this.face(0.15, this.speak * (0.25 + 0.35 * Math.abs(Math.sin(this.time * 11)) * (0.6 + 0.4 * Math.sin(this.time * 3.1))));
  }
}
