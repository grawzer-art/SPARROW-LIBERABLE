const { chromium } = require('playwright');
const OUT = __dirname + '/v5/';
const tag = process.argv[2] || 'a';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/?local'); await page.fill('#i-seed', '478'); await page.click('#i-new'); await page.waitForTimeout(4000);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (n, w = 2500) => { await page.waitForTimeout(w); await page.screenshot({ path: OUT + `${tag}_${n}.png`, timeout: 120000 }); console.log('shot', n); };
  await ev(() => { const g = window.game; g.sim.paused = false; g.sim.speed = 3; });
  await ev(() => { const g = window.game; const c = g.sim.cities[0]; g.renderer.focusOn(c.x + .5, c.y + .5, 20, true); });
  await shot('1_village', 6000);
  await ev(() => { const g = window.game; const c = g.sim.cities[0]; g.renderer.focusOn(c.x + .5, c.y + .5, 11, true); });
  await shot('2_close', 3000);
  // vrai toucher sur un habitant
  const pt = await ev(() => { const g = window.game; const r = g.renderer; const c = g.sim.citizens.find(c => !c.dead && c.age > 14); const p = r.worldToScreen ? r.worldToScreen(c.x, c.y) : null; return { p, id: c.id, name: c.name }; });
  console.log('pt', JSON.stringify(pt));
  if (pt.p) { await page.touchscreen.tap(pt.p.x, pt.p.y); await shot('3_citizen_card', 800); }
  else { await ev((id) => window.game.ui.select('citizen', id), pt.id); await shot('3_citizen_card', 800); }
  console.log(await ev(() => document.getElementById('c-title').textContent + ' | ' + document.getElementById('c-sub').textContent));
  await page.click('#c-actions button:nth-child(2)'); await shot('4_influence', 500);
  await page.click('#c-actions button:nth-child(1)'); await shot('5_bless', 900);
  await page.click('#card .cx'); await page.click('#card .cx').catch(()=>{});
  await page.click('#dock [data-d=powers]'); await page.click('.pw[data-p=fire]'); await shot('6_armed', 500);
  console.log('erreurs', errs.slice(0, 5));
  await browser.close();
})();
