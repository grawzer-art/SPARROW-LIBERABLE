const { chromium } = require('playwright');
const MOBILE = process.env.MOBILE === '1';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 430, height: 932 } : { width: 1000, height: 640 }, deviceScaleFactor: MOBILE ? 2 : 1, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(3000);
  const r = await page.evaluate(async () => {
    const g = window.game, pv = g.planetView, three = g.renderer.three; g.sim.paused = true;
    const out = {};
    // coût de construction du globe (relief, couleurs, nuages, région)
    let t0 = performance.now(); pv.setSim(g.sim); pv.activate(true); out.buildMs = Math.round(performance.now() - t0);
    const orig = three.render.bind(three);
    const measure = (label, view) => {
      pv.setView(view);
      for (let i = 0; i < 5; i++) pv.frame(0.016);
      three.render = () => {};
      let t = performance.now(); for (let i = 0; i < 120; i++) pv.frame(0.016); const js = (performance.now() - t) / 120;
      three.render = orig; pv.frame(0.016);
      const info = three.info;
      out[label] = { jsMs: +js.toFixed(2), calls: info.render.calls, tris: info.render.triangles, geos: info.memory.geometries, tex: info.memory.textures, houses: pv.stats.buildings, trees: pv.stats.trees };
    };
    measure('planet', { mode: 'planet', D: 3.5 });
    measure('region', { mode: 'region', dist: 0.5 });
    measure('regionClose', { mode: 'region', dist: 0.12, el: 0.5 });
    out.quality = g.renderer.qualityLevel; out.mobile = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 940px)').matches;
    return out;
  });
  console.log(MOBILE ? 'MOBILE' : 'DESKTOP', JSON.stringify(r, null, 1));
  await browser.close();
})();
