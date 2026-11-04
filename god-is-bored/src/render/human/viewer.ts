import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { HumanActor, HumanLibrary } from "./HumanLibrary";

/**
 * Banc d'essai « Humanité réaliste » (?scene=human) : de vrais humains 3D riggés (glTF), animations de capture de mouvement retargetées,
 * visages expressifs, éclairage physique simple. Sert à valider le personnage avant toute reconstruction de l'environnement.
 */
interface Walker { a: HumanActor; home: THREE.Vector3; mode: string; phase: number; }

export async function startHumanViewer(): Promise<void> {
  const q = new URLSearchParams(location.search);
  document.body.innerHTML = `<div id="hv"><canvas id="hvc"></canvas><div id="hv-ui"><b>Humanité réaliste</b><span id="hv-st">chargement des modèles…</span><div id="hv-btns"></div></div><div id="hv-perf"></div></div>`;
  const style = document.createElement("style");
  style.textContent = `html,body{margin:0;height:100%;background:#0e1118;overflow:hidden;font:13px system-ui,sans-serif;color:#eee}#hv{position:fixed;inset:0}#hvc{width:100%;height:100%;display:block;touch-action:none}
#hv-ui{position:absolute;left:10px;right:10px;top:calc(env(safe-area-inset-top,0px) + 10px);display:flex;flex-direction:column;gap:6px;pointer-events:none}#hv-ui b{font:600 16px Georgia,serif;color:#ffe2a8;text-shadow:0 1px 4px #000}#hv-st{font-size:11.5px;color:#cfc6b8;text-shadow:0 1px 3px #000}
#hv-btns{position:fixed;left:8px;right:8px;bottom:calc(env(safe-area-inset-bottom,0px) + 10px);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:auto}#hv-btns button{min-height:42px;padding:0 14px;border-radius:21px;border:1px solid #ffffff30;background:rgba(30,25,40,.72);backdrop-filter:blur(10px);color:#f4ead6;font-weight:600}#hv-btns button.on{background:#ffe2a8;color:#2a2030}
#hv-perf{position:absolute;right:10px;top:calc(env(safe-area-inset-top,0px) + 10px);font:11px ui-monospace,monospace;color:#9fd;text-align:right;text-shadow:0 1px 3px #000;white-space:pre}`;
  document.head.appendChild(style);

  const canvas = document.getElementById("hvc") as HTMLCanvasElement;
  const mobile = matchMedia("(pointer: coarse)").matches || innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 2 : 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xb9c9d8); scene.fog = new THREE.Fog(0xc4d0da, 18, 60);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  camera.position.set(0.3, 1.7, innerWidth < innerHeight ? 8.2 : 5.6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.95, 0); controls.enableDamping = true; controls.minDistance = 1.2; controls.maxDistance = 14; controls.maxPolarAngle = Math.PI * 0.49;

  // lumière : ciel + soleil bas et chaud (ombres douces)
  scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x6b5a45, 0.85));
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
  sun.position.set(-4, 6.5, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048); sun.shadow.camera.left = -7; sun.shadow.camera.right = 7; sun.shadow.camera.top = 7; sun.shadow.camera.bottom = -7; sun.shadow.camera.far = 24; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.02;
  scene.add(sun);

  // sol : terre et herbes (texture procédurale à grain, sans damier)
  const tex = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 512; const g = c.getContext("2d")!;
    g.fillStyle = "#6f6a47"; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 9000; i++) { const x = Math.random() * 512, y = Math.random() * 512, r = Math.random() * 2.2 + 0.4, t = Math.random(); g.fillStyle = t < 0.45 ? `rgba(${70 + Math.random() * 40},${95 + Math.random() * 50},${40 + Math.random() * 30},0.5)` : t < 0.8 ? `rgba(${120 + Math.random() * 50},${100 + Math.random() * 30},${70 + Math.random() * 25},0.45)` : `rgba(${60 + Math.random() * 30},${55 + Math.random() * 25},${40 + Math.random() * 20},0.5)`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(10, 10); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  })();
  const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const st = document.getElementById("hv-st")!, perf = document.getElementById("hv-perf")!;
  const lib = await HumanLibrary.load("");
  st.textContent = `modèles chargés en ${(lib.stats.loadMs / 1000).toFixed(1)} s · humains riggés glTF · clips de capture de mouvement`;

  // cinq humains : variantes de corps, de taille, de peau, d'étoffe
  const SKIN = [0xe7b99a, 0xcf9a74, 0xa9744f, 0x84583a, 0xf0c8aa];
  const CLOTH = [0x6a5238, 0x7a6a4e, 0x5b4630, 0x8a7557, 0x4e4a3c];
  const cast: { body: string; h: number; skin: number; cloth: number }[] = [
    { body: "rpm_man", h: 1.0, skin: 0, cloth: 0 }, { body: "michelle", h: 0.96, skin: 1, cloth: 1 }, { body: "rpm_man", h: 1.05, skin: 2, cloth: 2 },
    { body: "michelle", h: 0.92, skin: 3, cloth: 3 }, { body: "rpm_man", h: 0.9, skin: 4, cloth: 4 },
  ];
  const N = Math.max(1, Math.min(60, Number(q.get("n")) || 5));
  const useHide = q.get("hide") === "1";
  const walkers: Walker[] = Array.from({ length: N }, (_, i) => cast[i % cast.length]).map((c, i) => {
    const a = lib.spawn(c.body); a.look({ height: c.h * (1 + ((i * 7) % 5) * 0.012), skin: SKIN[c.skin], ...(useHide ? { cloth: CLOTH[c.cloth] } : {}) });
    const cols = Math.min(N, 5), x = ((i % cols) - (cols - 1) / 2) * 0.95, z = (i % 2) * -0.7 - Math.floor(i / cols) * 1.4; a.group.position.set(x, 0, z); scene.add(a.group);
    return { a, home: new THREE.Vector3(x, 0, z), mode: "idle", phase: i * 1.3 };
  });
  const MODES: [string, string][] = [["idle", "Repos"], ["walk", "Marche"], ["run", "Course"], ["talk", "Conversation"], ["sneak", "Furtif"], ["sad", "Triste"]];
  let mode = "idle";
  const btns = document.getElementById("hv-btns")!;
  const setMode = (m: string) => { mode = m; btns.querySelectorAll("button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset.m === m)); };
  for (const [m, l] of MODES) { const b = document.createElement("button"); b.textContent = l; b.dataset.m = m; b.onclick = () => setMode(m); btns.appendChild(b); }
  const camBtn = (label: string, f: () => void) => { const b = document.createElement("button"); b.textContent = label; b.onclick = f; btns.appendChild(b); };
  camBtn("Visage", () => { const h = walkers[0].a.group.position; camera.position.set(h.x + 0.35, 1.72, h.z + 1.15); controls.target.set(h.x, 1.62, h.z); });
  camBtn("Ensemble", () => { camera.position.set(0.3, 1.7, innerWidth < innerHeight ? 8.2 : 5.6); controls.target.set(0, 0.95, 0); });
  setMode((q.get("mode") ?? "idle"));
  if (q.get("cam") === "face") { const h = walkers[0].a.group.position; camera.position.set(h.x + 0.3, 1.7, h.z + 1.05); controls.target.set(h.x, 1.62, h.z); }

  const resize = () => { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
  addEventListener("resize", resize); resize();

  const clock = new THREE.Clock(); let frames = 0, acc = 0, fps = 0;
  const tmp = new THREE.Vector3();
  const tick = () => {
    const dt = Math.min(0.1, clock.getDelta());
    walkers.forEach((w, i) => {
      const a = w.a;
      if (mode === "idle") { a.play("idle"); a.group.position.lerp(w.home, 0.05); a.face(0.1, 0); }
      else if (mode === "walk" || mode === "run" || mode === "sneak") {
        // déplacement réel sur un cercle : la vitesse suit le clip, les pieds ne glissent pas
        const sp = mode === "run" ? 3.1 : mode === "sneak" ? 0.9 : 1.35;
        w.phase += (sp / 2.6) * dt;
        const ang = w.phase + i * 1.26, r = 2.6;
        tmp.set(Math.cos(ang) * r, 0, Math.sin(ang) * r - 0.5);
        const prev = a.group.position.clone(); a.group.position.copy(tmp);
        a.group.rotation.y = Math.atan2(tmp.x - prev.x, tmp.z - prev.z);
        a.play(mode === "run" ? "run" : mode === "sneak" ? "sneak_pose" : "walk", 0.25, 1);
        a.face(mode === "run" ? 0 : 0.1, mode === "run" ? 0.12 : 0);
      } else if (mode === "talk") {
        // deux à deux, face à face ; l'un parle (bouche, gestes), l'autre écoute (hochements) puis on alterne
        const pair = i < 2 ? 0 : i < 4 ? 1 : 2;
        const partner = walkers[pair === 0 ? (i === 0 ? 1 : 0) : pair === 1 ? (i === 2 ? 3 : 2) : 4];
        const centre = new THREE.Vector3(pair === 0 ? -1.2 : pair === 1 ? 1.2 : 0, 0, pair === 2 ? 1.8 : 0);
        const side = i % 2 === 0 ? -0.42 : 0.42;
        const target = centre.clone().add(new THREE.Vector3(side, 0, 0));
        if (pair === 2) target.copy(w.home).add(new THREE.Vector3(0, 0, 0.8));
        a.group.position.lerp(target, 0.06);
        const look = partner === w ? new THREE.Vector3(0, 0, 4) : partner.a.group.position;
        const dir = tmp.copy(look).sub(a.group.position);
        a.group.rotation.y = Math.atan2(dir.x, dir.z);
        const turn = Math.floor((a.time + i * 0.7) / 4.2) % 2 === (i % 2);
        a.speak = turn ? 1 : 0;
        a.play(turn ? "agree" : "idle", 0.35, turn ? 0.6 : 1);
        if (!turn) a.face(0.25, 0);
      } else if (mode === "sad") { a.play("sad_pose", 0.4); a.face(0, 0); a.group.position.lerp(w.home, 0.05); }
      a.update(dt);
    });
    controls.update();
    renderer.render(scene, camera);
    frames++; acc += dt;
    if (acc > 1) { fps = frames / acc; frames = 0; acc = 0; const i = renderer.info; perf.textContent = `${fps.toFixed(0)} i/s\n${i.render.calls} appels · ${(i.render.triangles / 1000).toFixed(0)} k tri\n${i.memory.geometries} géom · ${i.memory.textures} tex`; (window as unknown as { __hv: unknown }).__hv = { fps, calls: i.render.calls, tris: i.render.triangles, geoms: i.memory.geometries, tex: i.memory.textures, mode }; }
    requestAnimationFrame(tick);
  };
  (window as unknown as { hv: unknown }).hv = { setMode, walkers, camera, controls, lib, scene, renderer };
  tick();
}
