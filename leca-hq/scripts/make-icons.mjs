// Génère les icônes PNG (iOS / PWA) à partir de public/icons/icon.svg.
// Usage : node scripts/make-icons.mjs
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icons/icon.svg', import.meta.url));
const out = (n) => new URL(`../public/icons/${n}`, import.meta.url).pathname;
await sharp(svg).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg).resize(512, 512).png().toFile(out('icon-512.png'));
await sharp(svg).resize(180, 180).png().toFile(out('apple-touch-icon.png'));
// maskable : zone sûre → logo réduit à 70 % sur fond plein
const inner = await sharp(svg).resize(360, 360).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#101010' } })
  .composite([{ input: inner, gravity: 'centre' }])
  .png()
  .toFile(out('icon-maskable-512.png'));
console.log('icônes générées');
