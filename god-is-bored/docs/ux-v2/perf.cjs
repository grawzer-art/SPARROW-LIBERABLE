const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '478'); await page.click('#i-new'); await page.waitForTimeout(3500);
  const ev = (f, a) => page.evaluate(f, a);
  const measure = async (label) => {
    await page.waitForTimeout(2500);
    const r = await ev(() => new Promise((res) => { const g = window.game, t = g.renderer.three; t.info.autoReset = false; t.info.reset(); let n = 0, t0 = performance.now(); const f = () => { n++; if (n < 40) requestAnimationFrame(f); else { const i = t.info.render; res({ frames: n, calls: Math.round(i.calls / n), tris: Math.round(i.triangles / n), geos: t.info.memory.geometries, tex: t.info.memory.textures, ms: ((performance.now() - t0) / n).toFixed(1), pop: g.ps.totals().population, mode: g.mode }); t.info.autoReset = true; } }; requestAnimationFrame(f); }));
    console.log(label, JSON.stringify(r));
  };
  await measure('globe');
  await ev(() => { const g = window.game; const c = g.ps.engines.get(1).cities[0]; const r = g.ps.planet.regionById(1); g.planetView.setView({ P: g.ps.planet.localToDir(r, c.x + .5, c.y + .5), d: 0.3 }); }); await measure('region');
  await ev(() => { const g = window.game; g.ps.active.speed = 10; g.ps.active.paused = false; });
  await page.evaluate(() => { const g = window.game; const c = g.ps.engines.get(1).cities[0]; const r = g.ps.planet.regionById(1); g.planetView.setView({ P: g.ps.planet.localToDir(r, c.x + .5, c.y + .5), d: 0.021 }); });
  await page.waitForTimeout(4000);
  await measure('local x10');
  console.log('erreurs', errs.slice(0, 3));
  await browser.close();
})();
