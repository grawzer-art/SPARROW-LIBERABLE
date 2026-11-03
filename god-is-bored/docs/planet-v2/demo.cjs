const { chromium } = require('playwright');
const OUT = __dirname + '/v4/demo_';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '478'); await page.click('#i-new'); await page.waitForTimeout(3000);
  const ev = (f, a) => page.evaluate(f, a);
  const snap = async (n) => { await page.waitForTimeout(3500); await page.screenshot({ path: OUT + n + '.png', timeout: 120000 }); const s = await ev(() => { const g = window.game; return { mode: g.mode, level: g.level, d: +g.planetView.state.d.toFixed(4), place: document.getElementById('place').textContent, pop: g.ps.totals().population, ch: g.planetView.terrainStats.drawn }; }); console.log(n, JSON.stringify(s)); return s; };
  await ev(() => { window.game.ps.active.paused = true; });
  // 1 globe
  await ev(() => window.game.planetView.setView({ mode: 'planet' })); await snap('1_globe');
  // 2 choisir Merion (continent de Tharmak) puis zoom
  await ev(() => { const g = window.game; const i = g.planetView.continentChoices().find(c => c.name === 'Merion'); g.planetView.focusContinent(i.id); });
  await page.waitForTimeout(2500); await snap('2_continent');
  // 3 repérer Tharmak
  const T = await ev(() => { const g = window.game, p = g.ps.planet; for (const [id, e] of g.ps.engines) for (const c of e.cities) if (c.name.startsWith('Tharmak')) { const r = p.regionById(id); return { id, name: c.name, x: c.x, y: c.y, pop: c.pop ?? null, dir: p.localToDir(r, c.x + .5, c.y + .5) }; } });
  console.log('Tharmak', JSON.stringify({ ...T, dir: undefined }));
  await ev((T) => window.game.planetView.flyTo({ P: T.dir, d: 0.5, az: -1.57 }, 0.1), T); await snap('3_region_vers_tharmak');
  // 4 autre zone de la région (150 km plus loin) — exploration
  await ev((T) => { const g = window.game; const p = g.ps.planet, r = p.regionById(T.id); g.planetView.flyTo({ P: p.localToDir(r, T.x + 40, T.y - 30), d: 0.12 }, 0.1); }, T); await snap('4_autre_zone');
  await ev((T) => window.game.planetView.flyTo({ P: T.dir, d: 0.06 }, 0.1), T); await snap('5_approche');
  // 6 descente par le zoom (molette) jusqu'à la scène locale
  await page.mouse.move(215, 466);
  for (let k = 0; k < 14 && (await ev(() => window.game.mode)) !== 'local'; k++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(500); }
  await page.waitForTimeout(2500);
  const loc = await snap('6_village');
  const cityBefore = await ev((T) => { const g = window.game; const c = g.sim.cities.find(c => c.name === T.name); return c ? { x: c.x, y: c.y, region: g.ps.activeId } : null; }, T);
  console.log('ville en local', JSON.stringify(cityBefore), 'attendu', T.x, T.y);
  // 7 retour progressif
  await page.click('#crumbs button[data-lvl="region"]'); await page.waitForTimeout(2500); await snap('7_retour_region');
  // 8 autre région du même continent : on vole 14° plus loin et on descend là
  const other = await ev((T) => { const g = window.game, p = g.ps.planet, r = p.regionById(T.id); const dir = p.localToDir(r, T.x + 70, T.y + 10); g.planetView.flyTo({ P: dir, d: 0.05 }, 0.1); return dir; }, T);
  await snap('8_autre_region');
  await ev(() => window.game.planetView.goLevel('planet')); await page.waitForTimeout(4000); await snap('9_retour_planete');
  const after = await ev((T) => { const g = window.game, p = g.ps.planet, r = p.regionById(T.id); const e = g.ps.engines.get(T.id); const c = e.cities.find(c => c.name === T.name); return { x: c.x, y: c.y, dirSame: JSON.stringify(p.localToDir(r, c.x + .5, c.y + .5).map(v => +v.toFixed(5))) === JSON.stringify(T.dir.map(v => +v.toFixed(5))), pop: g.ps.totals().population, regions: g.ps.engines.size }; }, T);
  console.log('après', JSON.stringify(after));
  console.log('erreurs', errs.slice(0, 5));
  await browser.close();
})();
