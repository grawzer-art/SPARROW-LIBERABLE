import { RUBRIQUES, isTitre, type Breve, type Titre } from "@/lib/gazette/edition";

const PAPER = "#f2ead8";
const INK = "#141210";
const RED = "#b3201b";
const GREY = "#6f6a60";

const SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const GOTHIC = '"UnifrakturMaguntia", "Old English Text MT", serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  // Coupe uniquement sur les espaces normales (les insécables restent collées).
  const words = text.split(/ +/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function fmtLong(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .toUpperCase();
}

/** Une de journal 1080×1350 pour un titre, entièrement dessinée dans le navigateur. */
export async function renderTitreImage(item: Titre | Breve, date: string, url: string): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const M = 72;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  await Promise.all([
    document.fonts.load(`900 120px ${SERIF}`),
    document.fonts.load(`italic 400 40px ${SERIF}`),
    document.fonts.load(`400 120px ${GOTHIC}`),
    document.fonts.load(`700 30px ${MONO}`),
  ]).catch(() => undefined);

  // Papier + grain
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 9000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? "rgba(60,40,10,0.05)" : "rgba(255,255,255,0.18)";
    ctx.fillRect(Math.random() * W, Math.random() * H, 1.4, 1.4);
  }
  const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(90,60,20,0.18)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // En-tête
  ctx.fillStyle = INK;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.font = `400 118px ${GOTHIC}`;
  ctx.fillText("La Gazette du Chaos", W / 2, 170);
  ctx.fillRect(M, 200, W - 2 * M, 5);
  ctx.fillRect(M, 212, W - 2 * M, 2);
  ctx.font = `700 22px ${MONO}`;
  ctx.textAlign = "left";
  ctx.fillText(fmtLong(date), M, 250);
  ctx.textAlign = "right";
  ctx.fillText("JOURNAL SATIRIQUE · PARODIE", W - M, 250);
  ctx.fillRect(M, 268, W - 2 * M, 2);

  // Rubrique + tampon
  const rubrique = isTitre(item) ? RUBRIQUES[item.rubrique].nom.toUpperCase() : "EN BREF";
  ctx.textAlign = "left";
  ctx.font = `700 28px ${MONO}`;
  ctx.fillStyle = RED;
  ctx.fillText(rubrique, M, 340);

  const tampon = isTitre(item) && item.tampon ? item.tampon : "À LA UNE";
  ctx.save();
  ctx.translate(W - M - 150, 330);
  ctx.rotate(-0.12);
  ctx.strokeStyle = RED;
  ctx.lineWidth = 5;
  ctx.font = `700 30px ${MONO}`;
  const tw = ctx.measureText(tampon).width;
  ctx.strokeRect(-tw / 2 - 18, -36, tw + 36, 52);
  ctx.textAlign = "center";
  ctx.fillText(tampon, 0, 0);
  ctx.restore();

  // Titre : taille ajustée pour remplir l'espace sans déborder
  ctx.fillStyle = INK;
  ctx.textAlign = "left";
  const top = 400;
  const maxH = 690;
  let size = 112;
  let lines: string[] = [];
  for (; size >= 48; size -= 4) {
    ctx.font = `900 ${size}px ${SERIF}`;
    lines = wrap(ctx, item.titre, W - 2 * M);
    if (lines.length * size * 1.08 <= maxH) break;
  }
  lines.forEach((l, i) => ctx.fillText(l, M, top + size + i * size * 1.08));
  let y = top + size + (lines.length - 1) * size * 1.08 + 50;

  if (isTitre(item) && item.chapo && y < 1090) {
    ctx.font = `italic 400 34px ${SERIF}`;
    ctx.fillStyle = "#3a352d";
    for (const l of wrap(ctx, item.chapo, W - 2 * M).slice(0, 3)) {
      ctx.fillText(l, M, y);
      y += 46;
    }
  }

  // Pied de page
  ctx.fillStyle = INK;
  ctx.fillRect(M, H - 170, W - 2 * M, 2);
  ctx.font = `italic 400 30px ${SERIF}`;
  ctx.textAlign = "center";
  ctx.fillText("« L'actualité est déjà assez ridicule. On en rajoute. »", W / 2, H - 120);
  ctx.font = `700 20px ${MONO}`;
  ctx.fillStyle = GREY;
  ctx.fillText(`TITRE PARODIQUE · AUCUN FAIT RÉEL · ${url.replace(/^https?:\/\//, "")}`, W / 2, H - 76);

  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/png"));
}

export async function shareTitreImage(item: Titre | Breve, date: string, url: string): Promise<"shared" | "cancelled" | "failed"> {
  try {
    const blob = await renderTitreImage(item, date, url);
    const file = new File([blob], `gazette-du-chaos-${item.id}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "La Gazette du Chaos" });
        return "shared";
      } catch (e) {
        if ((e as Error).name === "AbortError") return "cancelled";
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return "shared";
  } catch {
    return "failed";
  }
}
