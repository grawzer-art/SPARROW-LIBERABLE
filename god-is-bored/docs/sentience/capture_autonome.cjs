const { chromium } = require('playwright');
const OUT = __dirname + '/v7/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto('http://localhost:5173/?scene=sentience&speed=2');
  await page.waitForTimeout(6000);
  const ev = (f, a) => page.evaluate(f, a);
  const info = await ev(() => { const w = window.game.witness; return { home: w.home.name, dest: w.dest.name, year: window.game.sim.year, cast: ['mira','ysa','tobias','garen','lenn','kid'].map(k => w[k].name) }; });
  console.log('scene', JSON.stringify(info));
  const T0 = Date.now();
  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(2000);
    const st = await ev(() => { const g = window.game, s = g.sim, w = g.witness; const names = Object.fromEntries(['mira','ysa','tobias','garen','lenn','kid'].map(k => [w[k].id, w[k].name])); const talks = [...s.talk.talks.values()].filter(t => !t.over && (names[t.a] || names[t.b])).map(t => `${names[t.a]||t.a}+${names[t.b]||t.b}[${t.topic}]#${t.n}`); const goals = ['mira','ysa','kid'].map(k => w[k].name + ':' + (w[k].mind.goal) + '@' + (w[k].city === w.home.id ? 'home' : 'dest')); const site = s.buildingById.get(w.site); return { tick: s.tick, talks, goals, site: site ? Math.round(site.progress*100) : 100, dir: g.director.phase || '' , cam: g.renderer.getPose().dist.toFixed(1) }; });
    console.log(i, JSON.stringify(st));
    await page.screenshot({ path: OUT + `f${String(i).padStart(2,'0')}.png`, timeout: 120000 });
  }
  console.log('director', JSON.stringify(await ev(() => window.game.director.log)));
  console.log('lines', JSON.stringify(await ev(() => { const s = window.game.sim; return [...s.talk.talks.values()].filter(t => t.effect).map(t => t.effect); })));
  console.log('erreurs', errs.slice(0, 5), 'durée', ((Date.now() - T0) / 1000).toFixed(0), 's');
  await browser.close();
})();
