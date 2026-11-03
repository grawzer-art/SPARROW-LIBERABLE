const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-SPARROW-LIBERABLE/d893d3c9-3a76-557d-ab4e-384739530d9a/scratchpad/v3/';
const pfx = process.argv[2] || 'audit';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 700, height: 460 } }); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(3500);
  const info = await page.evaluate(() => {
    const g = window.game, pl = g.sim.planet; g.sim.paused = true;
    const cs = pl.continents();
    return { land: +pl.landFraction().toFixed(3), conts: cs.slice(0, 9).map(c => ({ n: c.name, k: c.kind, pct: +c.areaPct.toFixed(1), lat: +(c.lat * 57.3).toFixed(0), lon: +(c.lon * 57.3).toFixed(0) })), regions: pl.regions.length };
  });
  console.log(JSON.stringify(info));
  const n = Math.min(6, info.conts.length);
  for (let i = 0; i < n; i++) {
    await page.evaluate((i) => { const g = window.game, c = g.sim.planet.continents()[i]; const d = (la, lo) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; document.getElementById('planet-card').classList.add('hidden'); g.planetView.setView({ mode: 'planet', D: 3.6, P: d(c.lat, c.lon) }); }, i);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: OUT + `${pfx}_c${i}.png` });
  }
  console.log('erreurs', errs);
  await browser.close();
})();
