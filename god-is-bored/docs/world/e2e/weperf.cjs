const { chromium } = require('playwright');
const MOBILE = process.env.MOBILE === '1';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 430, height: 932 } : { width: 1000, height: 640 }, deviceScaleFactor: MOBILE ? 2 : 1, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(4000);
  const r = await page.evaluate(async () => {
    const g = window.game, pv = g.planetView, three = g.renderer.three, out = {};
    g.sim.paused = true;
    // exploration d'une 3e région (inhabitée) pour mesurer le coût avec 3 couches
    const pl = g.ps.planet; let d = null;
    for (let i = 0; i < 4000 && !d; i++) { const lat = Math.asin(1 - (2 * (i + 0.5)) / 4000), c = [Math.cos(lat) * Math.cos(i * 2.399), Math.sin(lat), Math.cos(lat) * Math.sin(i * 2.399)]; if (pl.height(c) > 0.1 && Math.abs(lat) < 1 && !pl.regionAt(c, 20)) d = c; }
    let t0 = performance.now(); const reg = pl.ensureRegionAt(d); g.ps.ensure(reg.id); pv.syncLayers(); out.createRegionMs = Math.round(performance.now() - t0);
    t0 = performance.now(); pv.setPlanetSim(g.ps); out.buildGlobeMs = Math.round(performance.now() - t0);
    // coût du changement de région locale (déchargement de l'ancienne scène, construction de la nouvelle)
    t0 = performance.now(); g.activateRegion(1510); g.renderer.frame(0.016, 1); out.switchLocalMs = Math.round(performance.now() - t0);
    t0 = performance.now(); g.activateRegion(1); g.renderer.frame(0.016, 1); out.switchBackMs = Math.round(performance.now() - t0);
    pv.activate(true);
    const orig = three.render.bind(three);
    const measure = (label, view) => {
      pv.setView(view); for (let i = 0; i < 5; i++) pv.frame(0.016);
      three.render = () => {}; let t = performance.now(); for (let i = 0; i < 120; i++) pv.frame(0.016); const js = (performance.now() - t) / 120; three.render = orig; pv.frame(0.016);
      const i = three.info; out[label] = { jsMs: +js.toFixed(2), calls: i.render.calls, tris: i.render.triangles, geos: i.memory.geometries, tex: i.memory.textures, houses: pv.stats.buildings, trees: pv.stats.trees, layers: pv.stats.layers };
    };
    measure('planet', { mode: 'planet', D: g.planetView.state.D });
    measure('regionInhabited', { mode: 'region', region: 1510, dist: 0.5 });
    measure('regionEmpty', { mode: 'region', region: reg.id, dist: 0.5 });
    // coût de simulation de plusieurs régions habitées
    pv.activate(false); g.sim.paused = false; g.ps.runYears(20);
    t0 = performance.now(); for (let i = 0; i < 90; i++) g.ps.advance(100); out.simMsPerTick = +((performance.now() - t0) / 90).toFixed(2); out.pop = g.ps.totals().population; out.inhabited = g.ps.totals().inhabited;
    out.mobile = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 940px)').matches;
    return out;
  });
  console.log(MOBILE ? 'MOBILE' : 'DESKTOP', JSON.stringify(r));
  await browser.close();
})();
