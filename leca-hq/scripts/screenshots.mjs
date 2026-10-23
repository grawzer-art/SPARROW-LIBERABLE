// Captures desktop + iPhone de l'appli (nécessite `npm run build && npm run preview`).
// Usage : node scripts/screenshots.mjs [url] [dossier]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:4173/';
const out = process.argv[3] ?? 'docs/screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? '/opt/pw-browsers/chromium' });

const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  { name: 'iphone', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];
for (const p of profiles) {
  const { name, ...ctxOpts } = p;
  const ctx = await browser.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/${name}-01-qg.png` });
  await page.goto(`${url}#/creative`);
  await page.waitForTimeout(500);
  await page.fill('#new-name', 'Lancement ProBond');
  await page.click('button:has-text("Créer")');
  await page.waitForSelector('#c-name');
  await page.fill('#c-obj', 'Faire connaître la nouvelle colle auprès des professionnelles.');
  await page.fill('#c-brief', 'Esthétique premium, naturelle et moderne. Mettre en valeur la tenue et la finesse de la pose.');
  await page.click('button[role=radio]:has-text("Produit")');
  await page.fill('#c-subj', 'ProBond');
  await page.fill('#shot', 'Gros plan sur la pose des cils');
  await page.press('#shot', 'Enter');
  await page.fill('#shot', 'Application de la colle en plan large');
  await page.press('#shot', 'Enter');
  await page.fill('#idea', 'Avant / après en lumière naturelle');
  await page.press('#idea', 'Enter');
  await page.click('.track__step button:has-text("En préparation")');
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/${name}-02-creative-editor.png`, fullPage: true });
  await page.goto(`${url}#/creative`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-03-creative-library.png` });
  await page.goto(`${url}#/finance`);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/${name}-04-poste-en-developpement.png` });
  await ctx.close();
}
await browser.close();
console.log('captures dans', out);
