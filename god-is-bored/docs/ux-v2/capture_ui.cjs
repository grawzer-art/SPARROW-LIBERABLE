const { chromium } = require('playwright');
const OUT = __dirname + '/v5/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '478'); await page.waitForTimeout(500);
  await page.screenshot({ path: OUT + '0_intro.png' });
  await page.click('#i-new'); await page.waitForTimeout(3500);
  const shot = async (n, w = 2500) => { await page.waitForTimeout(w); await page.screenshot({ path: OUT + n + '.png', timeout: 120000 }); console.log('shot', n); };
  const ev = (f, a) => page.evaluate(f, a);
  await shot('1_globe');
  await ev(() => { const g = window.game; const i = g.planetView.continentChoices().find(c => c.name === 'Merion'); g.planetView.focusContinent(i.id); }); await shot('2_continent_card', 3500);
  const T = await ev(() => { const g = window.game, p = g.ps.planet; for (const [id, e] of g.ps.engines) for (const c of e.cities) if (c.name.startsWith('Tharmak')) { const r = p.regionById(id); return { id, cid: c.id, dir: p.localToDir(r, c.x + .5, c.y + .5) }; } });
  await ev((T) => { const g = window.game; g.planetView.flyTo({ P: T.dir, d: 0.3 }, 0.1); }, T); await shot('3_region');
  // toucher le village (réel)
  const xy = await ev((T) => { const g = window.game; const pv = g.planetView; return pv.projectDir ? pv.projectDir(T.dir) : null; }, T);
  console.log('proj', JSON.stringify(xy));
  await page.click('#dock [data-d=powers]'); await shot('4_tray', 600);
  await page.click('#dock [data-d=planet]'); await shot('5_planet_sheet', 900);
  await page.click('#sheet .sx'); await page.click('#h-menu'); await shot('6_menu', 900);
  await page.click('#sheet .sx');
  console.log('erreurs', errs.slice(0, 5));
  await browser.close();
})();
