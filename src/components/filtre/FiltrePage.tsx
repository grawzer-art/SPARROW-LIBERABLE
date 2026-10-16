"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { CASE_NUMBER } from "@/config";
import { now, remaining } from "@/lib/time";
import { load, save } from "@/lib/storage";
import { Toast } from "../Overlays";
import { drawFilter, type Landmarks, type Style } from "./draw";

type Phase = "idle" | "loading" | "live" | "result" | "error";

const STYLES: { id: Style; label: string }[] = [
  { id: "chevalier", label: "Chevalier Noir" },
  { id: "incognito", label: "Incognito" },
  { id: "barbe", label: "Barbe seule" },
];

const VERDICTS = [
  "SPARROW",
  "SPARROW (PROBABLE)",
  "SPARROW, SANS AUCUN DOUTE",
  "UN SOSIE DE SPARROW",
  "SPARROW APRÈS UNE SOIRÉE",
];

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/** Charge le moteur MediaPipe (hébergé dans /public/mediapipe) une seule fois. */
function getLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
      const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
      const opts = (delegate: "GPU" | "CPU") => ({
        baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
        runningMode: "VIDEO" as const,
        numFaces: 4,
        minFaceDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      try {
        return await FaceLandmarker.createFromOptions(fileset, opts("GPU"));
      } catch {
        return await FaceLandmarker.createFromOptions(fileset, opts("CPU"));
      }
    })();
    landmarkerPromise.catch(() => {
      landmarkerPromise = null;
    });
  }
  return landmarkerPromise;
}

/** Affiche « scène » (photo + masque) dans une affiche 1080×1350 aux couleurs du dossier. */
async function makePoster(scene: HTMLCanvasElement, faces: number): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  await Promise.all([document.fonts.load('400 120px "Anton"'), document.fonts.load('700 28px "IBM Plex Mono"')]).catch(
    () => undefined,
  );
  ctx.fillStyle = "#090909";
  ctx.fillRect(0, 0, W, H);
  const s = Math.max(W / scene.width, H / scene.height);
  const sw = W / s;
  const sh = H / s;
  ctx.drawImage(scene, (scene.width - sw) / 2, (scene.height - sh) / 2, sw, sh, 0, 0, W, H);

  // Bandeaux haut et bas
  let g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, "rgba(9,9,9,0.85)");
  g.addColorStop(1, "rgba(9,9,9,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 220);
  g = ctx.createLinearGradient(0, H - 380, 0, H);
  g.addColorStop(0, "rgba(9,9,9,0)");
  g.addColorStop(0.45, "rgba(9,9,9,0.82)");
  g.addColorStop(1, "rgba(9,9,9,0.96)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H - 380, W, 380);

  ctx.fillStyle = "#f1efe8";
  ctx.font = '700 26px "IBM Plex Mono", monospace';
  ctx.textAlign = "left";
  ctx.fillText(`DOSSIER ${CASE_NUMBER} · RECONNAISSANCE FACIALE`, 56, 80);
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.arc(64, 118, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f1efe8";
  ctx.fillText(faces > 1 ? `${faces} SUSPECTS · TOUS DES SPARROW` : "SUJET IDENTIFIÉ : SPARROW", 86, 128);

  // Tampon
  ctx.save();
  ctx.translate(W - 250, 150);
  ctx.rotate(-0.14);
  ctx.strokeStyle = "#e53935";
  ctx.fillStyle = "#e53935";
  ctx.lineWidth = 6;
  ctx.font = '700 34px "IBM Plex Mono", monospace';
  ctx.textAlign = "center";
  ctx.strokeRect(-170, -44, 340, 64);
  ctx.fillText("CONFIDENTIEL", 0, 0);
  ctx.restore();

  ctx.textAlign = "left";
  ctx.fillStyle = "#f1efe8";
  ctx.font = '400 150px "Anton", Impact, sans-serif';
  ctx.fillText("SPARROW", 52, H - 170);
  ctx.fillStyle = "#e53935";
  ctx.font = '400 92px "Anton", Impact, sans-serif';
  ctx.fillText("EST LIBÉRABLE", 56, H - 70);
  const r = remaining(now());
  ctx.fillStyle = "#f1efe8";
  ctx.font = '700 30px "IBM Plex Mono", monospace';
  ctx.textAlign = "right";
  ctx.fillText(`J-${r.days.toLocaleString("fr-FR")}`, W - 56, H - 168);
  ctx.fillStyle = "#9a978e";
  ctx.font = '700 20px "IBM Plex Mono", monospace';
  ctx.fillText(window.location.host, W - 56, H - 76);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
}

export function FiltrePage() {
  const video = useRef<HTMLVideoElement>(null);
  const overlay = useRef<HTMLCanvasElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef(0);
  const lmRef = useRef<FaceLandmarker | null>(null);
  const facesRef = useRef<Landmarks[]>([]);
  const styleRef = useRef<Style>("chevalier");
  const facingRef = useRef<"user" | "environment">("user");
  const lastTime = useRef(-1);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [phase, setPhase] = useState<Phase>("idle");
  const [style, setStyleState] = useState<Style>("chevalier");
  const [faces, setFaces] = useState(0);
  const [verdict, setVerdict] = useState({ who: VERDICTS[0], pct: 97 });
  const [result, setResult] = useState<{ url: string; blob: Blob } | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(false);
  const [toastText, setToastText] = useState<string | null>(null);

  const toast = useCallback((m: string) => {
    setToastText(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(null), 3000);
  }, []);

  const setStyle = (s: Style) => {
    setStyleState(s);
    styleRef.current = s;
    save("sp.filtre.style", s);
  };

  useEffect(() => {
    const s = load<Style>("sp.filtre.style", "chevalier");
    if (STYLES.some((x) => x.id === s)) {
      setStyleState(s);
      styleRef.current = s;
    }
    return () => {
      cancelAnimationFrame(raf.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Verdict qui change de temps en temps (pure fantaisie)
  useEffect(() => {
    if (phase !== "live") return;
    const id = setInterval(() => {
      setVerdict({ who: VERDICTS[Math.floor(Math.random() * VERDICTS.length)], pct: 61 + Math.floor(Math.random() * 39) });
    }, 2200);
    return () => clearInterval(id);
  }, [phase]);

  const loop = useCallback(() => {
    const v = video.current;
    const cv = overlay.current;
    const lm = lmRef.current;
    if (v && cv && lm && v.readyState >= 2) {
      if (cv.width !== v.videoWidth || cv.height !== v.videoHeight) {
        cv.width = v.videoWidth;
        cv.height = v.videoHeight;
      }
      if (v.currentTime !== lastTime.current) {
        lastTime.current = v.currentTime;
        try {
          const res = lm.detectForVideo(v, performance.now());
          const prev = facesRef.current;
          // Lissage : moins de tremblements
          facesRef.current = res.faceLandmarks.map((f, i) =>
            prev[i] && prev[i].length === f.length
              ? f.map((p, k) => ({ x: prev[i][k].x * 0.45 + p.x * 0.55, y: prev[i][k].y * 0.45 + p.y * 0.55 }))
              : f.map((p) => ({ x: p.x, y: p.y })),
          );
        } catch {
          /* image ignorée */
        }
      }
      const ctx = cv.getContext("2d")!;
      ctx.clearRect(0, 0, cv.width, cv.height);
      drawFilter(ctx, facesRef.current, cv.width, cv.height, {
        style: styleRef.current,
        mirror: facingRef.current === "user",
        target: true,
      });
      setFaces((n) => (n !== facesRef.current.length ? facesRef.current.length : n));
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  const startCamera = useCallback(
    async (facing: "user" | "environment" = facingRef.current) => {
      setError("");
      setPhase("loading");
      try {
        const [lm, s] = await Promise.all([
          getLandmarker(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 1280 } },
            audio: false,
          }),
        ]);
        await lm.setOptions({ runningMode: "VIDEO" });
        lmRef.current = lm;
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = s;
        facingRef.current = facing;
        const v = video.current!;
        v.srcObject = s;
        await v.play().catch(() => undefined);
        facesRef.current = [];
        setPhase("live");
        cancelAnimationFrame(raf.current);
        raf.current = requestAnimationFrame(loop);
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Accès à la caméra refusé. Autorise-le dans Réglages → Safari → Caméra, ou importe une photo."
            : name === "NotFoundError"
              ? "Aucune caméra trouvée. Tu peux importer une photo à la place."
              : "Le scanner facial n'a pas pu démarrer sur ce téléphone. Essaie d'importer une photo.",
        );
        setPhase("error");
      }
    },
    [loop],
  );

  const stopCamera = () => {
    cancelAnimationFrame(raf.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  const capture = async () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 350);
    navigator.vibrate?.(20);
    const scene = document.createElement("canvas");
    scene.width = v.videoWidth;
    scene.height = v.videoHeight;
    const ctx = scene.getContext("2d")!;
    const mirror = facingRef.current === "user";
    ctx.save();
    if (mirror) {
      ctx.translate(scene.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0);
    ctx.restore();
    drawFilter(ctx, facesRef.current, scene.width, scene.height, { style: styleRef.current, mirror, target: false });
    const blob = await makePoster(scene, facesRef.current.length);
    stopCamera();
    setResult((old) => {
      if (old) URL.revokeObjectURL(old.url);
      return { url: URL.createObjectURL(blob), blob };
    });
    setPhase("result");
  };

  const importPhoto = async (files: FileList | null) => {
    const f = files?.[0];
    if (fileInput.current) fileInput.current.value = "";
    if (!f) return;
    stopCamera();
    setPhase("loading");
    try {
      const lm = await getLandmarker();
      const src = URL.createObjectURL(f);
      const img = new Image();
      img.src = src;
      await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const scene = document.createElement("canvas");
      scene.width = Math.round(img.naturalWidth * scale);
      scene.height = Math.round(img.naturalHeight * scale);
      const ctx = scene.getContext("2d")!;
      ctx.drawImage(img, 0, 0, scene.width, scene.height);
      URL.revokeObjectURL(src);
      await lm.setOptions({ runningMode: "IMAGE" });
      const res = lm.detect(scene);
      await lm.setOptions({ runningMode: "VIDEO" });
      if (!res.faceLandmarks.length) {
        toast("Aucun visage trouvé. Le suspect s'est caché ?");
        setPhase(stream.current ? "live" : "idle");
        return;
      }
      drawFilter(ctx, res.faceLandmarks, scene.width, scene.height, { style: styleRef.current, mirror: false, target: false });
      const blob = await makePoster(scene, res.faceLandmarks.length);
      setResult((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { url: URL.createObjectURL(blob), blob };
      });
      setPhase("result");
    } catch {
      setError("Impossible de lire cette photo. Essaie avec une autre.");
      setPhase("error");
    }
  };

  const share = async () => {
    if (!result) return;
    const file = new File([result.blob], `sparrow-filtre-${Date.now()}.jpg`, { type: "image/jpeg" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Filtre Sparrow" });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = result.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast("Photo enregistrée.");
  };

  const restart = () => {
    setResult(null);
    void startCamera();
  };

  return (
    <div className="fl">
      <div className="fl__stage">
        <video
          ref={video}
          className={`fl__video${facingRef.current === "user" ? " is-mirror" : ""}`}
          playsInline
          muted
          autoPlay
          aria-hidden="true"
        />
        <canvas ref={overlay} className="fl__overlay" aria-hidden="true" />
        <div className="fl__scan" aria-hidden="true" />
        {flash && <div className="fl__flash" aria-hidden="true" />}

        {/* HUD façon caméra de surveillance */}
        <div className="fl__hud mono" aria-live="polite">
          <div className="fl__hudrow">
            <span>
              <i className="fl__rec" /> REC · {CASE_NUMBER}
            </span>
            <span>RECONNAISSANCE FACIALE</span>
          </div>
          {phase === "live" && (
            <p className={`fl__verdict${faces ? " on" : ""}`}>
              {faces === 0
                ? "AUCUN SUSPECT DANS LE CHAMP"
                : faces === 1
                  ? `SUJET IDENTIFIÉ : ${verdict.who} · ${verdict.pct} %`
                  : `${faces} SUSPECTS DÉTECTÉS · TOUS DES SPARROW`}
            </p>
          )}
        </div>

        {(phase === "idle" || phase === "error" || phase === "loading") && (
          <div className="fl__intro">
            <p className="mono fl__kicker">ANNEXE D · IDENTIFICATION</p>
            <h1 className="fl__title">
              <span>FILTRE</span>
              <span className="red">SPARROW</span>
            </h1>
            <p className="mono fl__lead">
              Le masque du Chevalier Noir et la barbe rousse, collés sur ta tête en direct. Fonctionne aussi à plusieurs.
            </p>
            {phase === "loading" ? (
              <p className="mono fl__loading">
                <span className="feed__cursor" /> CHARGEMENT DU SCANNER FACIAL…
              </p>
            ) : (
              <>
                {error && <p className="mono fl__error">{error}</p>}
                <button type="button" className="btn btn--primary fl__start" onClick={() => void startCamera("user")}>
                  Activer la caméra
                </button>
                <button type="button" className="btn fl__import" onClick={() => fileInput.current?.click()}>
                  Importer une photo
                </button>
              </>
            )}
            <p className="mono fl__privacy">Tout se passe dans ton téléphone. Aucune image n&apos;est envoyée.</p>
          </div>
        )}

        {phase === "result" && result && (
          <div className="fl__result">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={result.url} alt="Photo avec le filtre Sparrow" className="fl__resultimg" />
            <div className="fl__resultbar">
              <button type="button" className="btn btn--primary" onClick={() => void share()}>
                Partager
              </button>
              <button type="button" className="btn" onClick={restart}>
                Reprendre
              </button>
            </div>
          </div>
        )}
      </div>

      {phase === "live" && (
        <div className="fl__controls">
          <div className="fl__styles" role="radiogroup" aria-label="Style du filtre">
            {STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={style === s.id}
                className={style === s.id ? "on" : ""}
                onClick={() => setStyle(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="fl__bar">
            <button type="button" className="fl__side mono" onClick={() => fileInput.current?.click()} aria-label="Importer une photo">
              Photo
            </button>
            <button type="button" className="fl__shutter" onClick={() => void capture()} aria-label="Prendre la photo">
              <span />
            </button>
            <button
              type="button"
              className="fl__side mono"
              onClick={() => void startCamera(facingRef.current === "user" ? "environment" : "user")}
              aria-label="Changer de caméra"
            >
              ↺ Cam
            </button>
          </div>
        </div>
      )}

      <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => void importPhoto(e.target.files)} />
      <Toast text={toastText} />
    </div>
  );
}
