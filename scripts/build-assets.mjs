// Génère les assets statiques du dossier :
//  - photos optimisées (public/photos) à partir de photos-originaux/
//  - icônes PWA (public/icons) + apple-touch-icon + favicon
//  - image de partage Open Graph (public/og.png)
//
// Usage : npm run assets
// Les fichiers générés sont versionnés : Vercel n'a pas besoin de lancer ce script.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import opentype from "opentype.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const SRC = path.join(root, "photos-originaux");
const OUT_PHOTOS = path.join(root, "public/photos");
const OUT_ICONS = path.join(root, "public/icons");

const INK = "#090909";
const PAPER = "#F1EFE8";
const RED = "#E53935";
const STEEL = "#777777";

// Recadrages spécifiques (ex. retirer l'interface d'une capture d'écran).
// Clé = nom du fichier source. Valeurs en pixels de l'image d'origine.
const CROPS = {
  "sparrow-masque-nb.jpg": { left: 0, top: 285, width: 1179, height: 2005 },
};

async function loadFont(rel) {
  const buf = await fs.readFile(path.join(root, "node_modules", rel));
  return opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
}

function textPath(font, text, x, y, size, { anchor = "start", letterSpacing = 0 } = {}) {
  const opts = { kerning: true, letterSpacing: letterSpacing / size };
  const width = font.getAdvanceWidth(text, size, opts);
  const cx = anchor === "middle" ? x - width / 2 : anchor === "end" ? x - width : x;
  return { d: pathData(font.getPath(text, cx, y, size, opts)), width };
}

// Sérialisation maison : toPathData() d'opentype.js produit parfois des « NaN ».
function pathData(p) {
  const n = (v) => (Math.round(v * 100) / 100).toString();
  return p.commands
    .map((c) => {
      if (c.type === "M" || c.type === "L") return `${c.type}${n(c.x)} ${n(c.y)}`;
      if (c.type === "Q") return `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`;
      if (c.type === "C") return `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}`;
      return "Z";
    })
    .join("");
}

async function photos() {
  await fs.mkdir(OUT_PHOTOS, { recursive: true });
  let files = [];
  try {
    files = (await fs.readdir(SRC)).filter((f) => /\.(jpe?g|png|webp|heic|avif)$/i.test(f));
  } catch {
    console.log("· aucun dossier photos-originaux/");
    return;
  }
  for (const f of files) {
    const base = f.replace(/\.[^.]+$/, "");
    let img = sharp(path.join(SRC, f)).rotate();
    if (CROPS[f]) img = img.extract(CROPS[f]);
    img = img.resize({ width: 1080, withoutEnlargement: true });
    await img.clone().jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT_PHOTOS, `${base}.jpg`));
    await img.clone().webp({ quality: 76 }).toFile(path.join(OUT_PHOTOS, `${base}.webp`));
    console.log(`✓ photo ${base}`);
  }
}

function iconSvg(anton, mono, size, { maskable = false } = {}) {
  const s = size;
  const pad = maskable ? s * 0.16 : s * 0.06;
  const inner = s - pad * 2;
  const S = textPath(anton, "S", s / 2, pad + inner * 0.8, inner * 0.86, { anchor: "middle" });
  const barH = inner * 0.15;
  const barY = pad + inner * 0.47;
  const label = textPath(mono, "SP-2031", s / 2, barY + barH * 0.7, barH * 0.62, {
    anchor: "middle",
    letterSpacing: barH * 0.06,
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" fill="${INK}"/>
  ${maskable ? "" : `<rect x="${pad * 0.5}" y="${pad * 0.5}" width="${s - pad}" height="${s - pad}" fill="none" stroke="${STEEL}" stroke-width="${s * 0.004}"/>`}
  <path d="${S.d}" fill="${PAPER}"/>
  <rect x="${pad}" y="${barY}" width="${inner}" height="${barH}" fill="${RED}"/>
  <path d="${label.d}" fill="${INK}"/>
</svg>`;
}

async function icons() {
  await fs.mkdir(OUT_ICONS, { recursive: true });
  const anton = await loadFont("@fontsource/anton/files/anton-latin-400-normal.woff");
  const mono = await loadFont("@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff");
  const jobs = [
    ["icon-192.png", 192, false],
    ["icon-512.png", 512, false],
    ["maskable-512.png", 512, true],
    ["apple-touch-icon.png", 180, true],
    ["favicon-32.png", 32, false],
  ];
  for (const [name, size, maskable] of jobs) {
    await sharp(Buffer.from(iconSvg(anton, mono, size, { maskable }))).png().toFile(path.join(OUT_ICONS, name));
    console.log(`✓ icône ${name}`);
  }
  await fs.writeFile(path.join(root, "public/icons/icon.svg"), iconSvg(anton, mono, 512));
  return { anton, mono };
}

async function ogImage({ anton, mono }) {
  const W = 1200;
  const H = 630;
  const photoPath = path.join(OUT_PHOTOS, "sparrow-lunettes.jpg");
  const photoW = 430;
  let photo = null;
  try {
    photo = await sharp(photoPath)
      .resize({ width: photoW, height: H - 120, fit: "cover", position: "top" })
      .grayscale()
      .linear(1.25, -28)
      .toBuffer();
  } catch {
    /* pas de photo : OG texte seul */
  }
  const t1 = textPath(anton, "SPARROW", 540, 300, 168);
  const t2 = textPath(anton, "EST LIBÉRABLE", 540, 430, 104);
  const meta = textPath(mono, "DOSSIER CLASSIFIÉ · N° SP-2031 · STATUT : EN COURS", 540, 110, 17, { letterSpacing: 1 });
  const date = textPath(mono, "DATE CIBLE : 12.10.2031 — 00:00 PARIS", 540, 530, 23, { letterSpacing: 1 });
  const stamp = textPath(mono, "CONFIDENTIEL", 0, 0, 30, { letterSpacing: 6 });
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <rect x="60" y="60" width="${photoW}" height="${H - 120}" fill="#1a1a1a"/>
    <line x1="540" y1="135" x2="1140" y2="135" stroke="${STEEL}" stroke-width="1"/>
    <path d="${meta.d}" fill="${STEEL}"/>
    <path d="${t1.d}" fill="${PAPER}"/>
    <path d="${t2.d}" fill="${RED}"/>
    <line x1="540" y1="480" x2="1140" y2="480" stroke="${STEEL}" stroke-width="1"/>
    <path d="${date.d}" fill="${PAPER}"/>
  </svg>`;
  const overlay = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="60" y="60" width="${photoW}" height="${H - 120}" fill="${RED}" opacity="0.08"/>
    <g transform="translate(120 520) rotate(-8)">
      <rect x="-14" y="-40" width="${stamp.width + 28}" height="54" fill="none" stroke="${RED}" stroke-width="4"/>
      <path d="${stamp.d}" fill="${RED}"/>
    </g>
  </svg>`;
  const layers = [];
  if (photo) layers.push({ input: photo, left: 60, top: 60 });
  layers.push({ input: Buffer.from(overlay), left: 0, top: 0 });
  await sharp(Buffer.from(svg)).composite(layers).png({ compressionLevel: 9 }).toFile(path.join(root, "public/og.png"));
  console.log("✓ og.png");
}

await photos();
const fonts = await icons();
await ogImage(fonts);
