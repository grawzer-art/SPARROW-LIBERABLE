// Une sauvegarde produite par la version précédente (commit 1b24442) se charge-t-elle dans la version actuelle ?
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const old = await (await browser.newContext()).newPage();
  await old.goto('http://localhost:5174/'); await old.fill('#i-seed', '7'); await old.click('#i-new'); await old.waitForTimeout(500);
  const json = await old.evaluate(() => { const g = window.game; g.sim.paused = true; g.sim.runYears(120); g.save(); return { j: localStorage.getItem('godisbored.save') || Object.keys(localStorage).map(k => [k, localStorage.getItem(k).length]), y: g.sim.year, pop: g.sim.citizens.length, b: g.sim.buildings.length }; });
  console.log('ancienne version', typeof json.j === 'string' ? 'sauvegarde ok' : JSON.stringify(json.j), json.y, json.pop, json.b);
  const key = await old.evaluate(() => Object.keys(localStorage)[0]); const raw = await old.evaluate((k) => localStorage.getItem(k), key);
  await old.context().close();
  const page = await (await browser.newContext()).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/'); await page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, raw]);
  await page.reload(); await page.waitForTimeout(500);
  await page.click('#i-continue').catch(() => {}); await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const g = window.game; if (!g.sim) return null; g.sim.runYears(5); return { year: g.sim.year, pop: g.sim.citizens.length, b: g.sim.buildings.length, rotOk: g.sim.buildings.every(b => typeof b.rot === 'number') }; });
  await page.waitForTimeout(1500);
  console.log('nouvelle version après chargement + 5 ans', JSON.stringify(r), 'erreurs', errs.slice(0, 3));
  await browser.close();
})();
