import { CASE_NUMBER } from "@/config";
import { END_MS, formatDot, pad, type Remaining } from "./time";

const INK = "#090909";
const PAPER = "#F1EFE8";
const RED = "#E53935";
const STEEL = "#777777";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Dessine une image en « cover » dans un rectangle, convertie en noir & blanc contrasté. */
function drawMono(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, fy = 0.35) {
  const scale = Math.max(w / img.width, h / img.height);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.width - sw) / 2;
  const sy = (img.height - sh) * fy;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  try {
    const data = ctx.getImageData(x, y, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      let l = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      l = Math.max(0, Math.min(255, (l - 128) * 1.2 + 120));
      px[i] = Math.min(255, l + 6);
      px[i + 1] = l;
      px[i + 2] = l;
    }
    ctx.putImageData(data, x, y);
  } catch {
    /* canvas « tainted » : on garde la couleur */
  }
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "right" | "center" = "left") {
  const widths = [...text].map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (text.length - 1);
  let cx = align === "left" ? x : align === "right" ? x - total : x - total / 2;
  ctx.textAlign = "left";
  [...text].forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + spacing;
  });
}

/**
 * Génère la fiche de partage (1080×1350, format portrait réseaux sociaux).
 * `mode` = "countdown" pendant l'attente, "final" après le verdict.
 */
export async function renderShareCard(opts: { r: Remaining; photo: string; url: string; mode: "countdown" | "final" }): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  await Promise.all([
    document.fonts.load('400 200px "Anton"'),
    document.fonts.load('500 30px "IBM Plex Mono"'),
    document.fonts.load('700 30px "IBM Plex Mono"'),
  ]).catch(() => undefined);

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  const M = 64;
  // En-tête
  ctx.fillStyle = STEEL;
  ctx.font = '500 26px "IBM Plex Mono", monospace';
  ctx.textBaseline = "alphabetic";
  spaced(ctx, `DOSSIER CLASSIFIÉ · N° ${CASE_NUMBER}`, M, 96, 2);
  ctx.fillStyle = opts.mode === "final" ? RED : PAPER;
  spaced(ctx, opts.mode === "final" ? "STATUT : CLOS" : "STATUT : EN COURS", W - M, 96, 2, "right");
  ctx.fillStyle = STEEL;
  ctx.fillRect(M, 120, W - 2 * M, 2);

  // Photo
  const px = M;
  const py = 150;
  const pw = W - 2 * M;
  const ph = 470;
  try {
    const img = await loadImage(opts.photo);
    drawMono(ctx, img, px, py, pw, ph);
  } catch {
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(px, py, pw, ph);
  }
  ctx.fillStyle = "rgba(229,57,53,0.10)";
  ctx.fillRect(px, py, pw, ph);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 2;
  ctx.strokeRect(px, py, pw, ph);

  // Tampon
  ctx.save();
  ctx.translate(W - M - 360, py + ph - 70);
  ctx.rotate(-0.12);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 6;
  ctx.font = '700 40px "IBM Plex Mono", monospace';
  ctx.fillStyle = RED;
  const stampText = opts.mode === "final" ? "LIBÉRABLE" : "CONFIDENTIEL";
  const sw = ctx.measureText(stampText).width + stampText.length * 4 + 40;
  ctx.strokeRect(-20, -48, sw, 66);
  spaced(ctx, stampText, 0, 0, 4);
  ctx.restore();

  // Titre
  const fit = (text: string, max: number) => {
    ctx.font = '400 100px "Anton", Impact, sans-serif';
    const size = Math.min(max, (100 * (W - 2 * M)) / ctx.measureText(text).width);
    ctx.font = `400 ${size}px "Anton", Impact, sans-serif`;
    return size;
  };
  ctx.textAlign = "left";
  ctx.fillStyle = PAPER;
  const s1 = fit("SPARROW", 290);
  const y1 = py + ph + 28 + s1 * 0.87;
  ctx.fillText("SPARROW", M, y1);
  ctx.fillStyle = RED;
  const s2 = fit("EST LIBÉRABLE", 200);
  const y2 = y1 + 56 + s2 * 0.87;
  ctx.fillText("EST LIBÉRABLE", M, y2);

  // Compteur
  ctx.fillStyle = STEEL;
  ctx.fillRect(M, y2 + 26, W - 2 * M, 2);
  ctx.fillStyle = PAPER;
  ctx.font = '700 46px "IBM Plex Mono", monospace';
  const r = opts.r;
  const line =
    opts.mode === "final"
      ? "VERDICT RENDU · 0 J 00:00:00"
      : `${r.days} J ${pad(r.hours)}:${pad(r.minutes)}:${pad(r.seconds)}`;
  spaced(ctx, line, M, y2 + 88, 1);
  ctx.fillStyle = STEEL;
  ctx.font = '500 24px "IBM Plex Mono", monospace';
  spaced(ctx, opts.mode === "final" ? "APRÈS 1 826 JOURS DE PATIENCE" : `RESTANTS AVANT LE ${formatDot(END_MS)}`, M, y2 + 128, 2);

  // Pied
  ctx.fillStyle = RED;
  ctx.fillRect(M, H - 64, 14, 14);
  ctx.fillStyle = PAPER;
  ctx.font = '500 24px "IBM Plex Mono", monospace';
  spaced(ctx, opts.url.replace(/^https?:\/\//, "").replace(/\/$/, ""), M + 30, H - 50, 1);
  ctx.fillStyle = STEEL;
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  spaced(ctx, "DOCUMENT FICTIF · SANS VALEUR JURIDIQUE", W - M, H - 50, 1, "right");

  return new Promise((resolve, reject) => c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/png"));
}
