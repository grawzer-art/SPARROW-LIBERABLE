// Une sauvegarde de la version précédente (Living Planet T1, une seule région) se charge dans la nouvelle version.
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const old = await (await browser.newContext()).newPage();
  await old.goto('http://localhost:5174/'); await old.fill('#i-seed', '7'); await old.click('#i-new'); await old.waitForTimeout(800);
  const o = await old.evaluate(() => { const g = window.game; g.sim.paused = true; g.sim.runYears(60); g.save(); const pl = g.sim.planet; return { raw: localStorage.getItem('god-is-bored.save.v1'), pop: g.sim.citizens.length, civs: g.sim.civs.map(c => c.name).join('+'), names: g.sim.citizens.slice(0, 5).map(c => c.name + '#' + c.id).join(','), h: pl.height([0.3, 0.4, Math.sqrt(1 - 0.25)]).toFixed(5), region: pl.regions[0].name + '@' + pl.regions[0].lat.toFixed(4) }; });
  console.log('ancienne version:', JSON.stringify({ ...o, raw: o.raw.length + ' octets' }));
  await old.context().close();
  const page = await (await browser.newContext()).newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/'); await page.evaluate((raw) => localStorage.setItem('god-is-bored.save.v1', raw), o.raw);
  await page.reload(); await page.waitForTimeout(1500);
  const n = await page.evaluate(() => { document.getElementById('i-continue').click(); const g = window.game; const r1 = g.ps.engineOf(1); return { gen: g.ps.planet.gen, regions: g.ps.planet.regions.map(r => r.id + ':' + r.name + (r.inhabited ? '*' : '')).join(' | '), pop1: r1.citizens.length, civs1: r1.civs.map(c => c.name).join('+'), names: r1.citizens.slice(0, 5).map(c => c.name + '#' + c.id).join(','), h: g.ps.planet.height([0.3, 0.4, Math.sqrt(1 - 0.25)]).toFixed(5), engines: g.ps.engines.size, totals: g.ps.totals() }; });
  console.log('nouvelle version:', JSON.stringify(n));
  console.log('Terre Première intacte :', n.pop1 === o.pop && n.civs1 === o.civs && n.names === o.names, '· planète génération 1 conservée :', n.gen === 1 && n.h === o.h, '· région(s) :', n.engines);
  await page.waitForTimeout(3000);
  const later = await page.evaluate(() => { const g = window.game; return { toast: document.getElementById('toasts').innerText.slice(0, 160), year: g.sim.year, tot: g.ps.totals() }; });
  console.log('après 3 s:', JSON.stringify(later), 'erreurs', errs.slice(0, 3));
  await browser.close();
})();
