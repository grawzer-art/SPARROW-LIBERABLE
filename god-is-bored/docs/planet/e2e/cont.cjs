const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-SPARROW-LIBERABLE/d893d3c9-3a76-557d-ab4e-384739530d9a/scratchpad/v3/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1000, height: 640 } }); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(3500);
  const info = await page.evaluate(() => { const g = window.game, pl = g.sim.planet, cs = pl.continents(); const c = cs[0]; g.sim.paused = true; const d = (la, lo) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; g.planetView.setView({ mode: 'planet', D: 3.0, P: d(c.lat, c.lon) }); return { name: c.name, pct: c.areaPct }; });
  await page.waitForTimeout(1500);
  await page.mouse.click(500, 340); await page.waitForTimeout(1200);
  console.log('continent tap:', JSON.stringify(info), await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ')));
  await page.screenshot({ path: OUT + 'cont_d_card.png' });
  await page.mouse.click(120, 520); await page.waitForTimeout(900);
  console.log('autre tap:', await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ')));
  console.log('erreurs', errs);
  await browser.close();
})();
