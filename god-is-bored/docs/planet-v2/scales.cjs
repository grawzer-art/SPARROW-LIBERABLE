const { chromium } = require('playwright');
const OUT = __dirname + '/v4/';
const MOBILE = process.env.MOBILE !== '0';
const seed = process.env.SEED || '42';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 430, height: 932 } : { width: 1000, height: 640 }, deviceScaleFactor: 1, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type()==='warning') errs.push(m.text()); });
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', seed); await page.click('#i-new'); await page.waitForTimeout(3000);
  const info = await page.evaluate(() => { const g = window.game; const p = g.ps.planet; return { regions: p.regions.map(r => [r.id, r.name, r.lat.toFixed(2), r.lon.toFixed(2)]), conts: p.continents().map(c => c.name) }; });
  console.log(JSON.stringify(info));
  const shot = async (n) => { await page.waitForTimeout(+(process.env.WAIT||3500)); await page.screenshot({ path: OUT + `${seed}_${n}.png`, timeout: 120000 }); console.log('shot', n, JSON.stringify(await page.evaluate(() => ({ mode: window.game.mode, st: window.game.planetView.state, ts: window.game.planetView.terrainStats, place: document.getElementById('place').textContent })))); };
  const set = (v) => page.evaluate((v) => { const g = window.game; g.ps.active.paused = true; g.planetView.setView(v); }, v);
  const V = await page.evaluate(() => { const g = window.game, e = g.ps.engines.get(1), r = g.ps.planet.regionById(1); const c = [...e.cities][0] ; const cs = e.cities.map(c => ({ n: c.name, d: g.ps.planet.localToDir(r, c.x + 0.5, c.y + 0.5) })); return cs; });
  console.log(V.map(v=>v.n));
  const P = V[0].d;
  const stages = [['1planet',{P,d:7,el:1.2}],['2continent',{P,d:1.2,el:1.0}],['3region',{P,d:0.3,el:0.8}],['4zone',{P,d:0.1,el:0.7}],['5approach',{P,d:0.04,el:0.6}],['6near',{P,d:0.026,el:0.55}]];
  for (const [n,v] of stages) { await set(v); await shot(n); }
  console.log('erreurs', errs.slice(0, 6));
  await browser.close();
})();
