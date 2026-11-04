const { chromium } = require('playwright');
const OUT = __dirname + '/v7/';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5173/?scene=sentience&speed=1');
  await page.waitForTimeout(5000);
  const ev = (f, a) => page.evaluate(f, a);
  const shot = async (n, w = 1200) => { await page.waitForTimeout(w); await page.screenshot({ path: OUT + n + '.png', timeout: 120000 }); console.log('shot', n); };
  // on laisse la conversation Mira/Ysa commencer, puis on prend la main (le réalisateur s'efface)
  for (let i = 0; i < 40; i++) { const ok = await ev(() => { const w = window.game.witness, s = window.game.sim; const tk = s.talk.get(w.mira.id, w.ysa.id); return tk && tk.lines.length >= 2 && !tk.over; }); if (ok) break; await page.waitForTimeout(700); }
  await ev(() => { window.game.director.yield(60); window.game.sim.paused = true; document.body.classList.remove('noui'); });
  const pt = await ev(() => { const g = window.game, r = g.renderer, w = g.witness, s = g.sim; const c = w.ysa; r.setPose((w.mira.x + w.ysa.x) / 2, (w.mira.y + w.ysa.y) / 2, 9, 0.5, r.getPose().az); const N = s.world.size; const v = new r.camera.position.constructor(c.x - N / 2, s.world.heightAt(c.x, c.y) + 0.25, c.y - N / 2); return null; });
  await page.waitForTimeout(800);
  const px = await ev(() => { const g = window.game, r = g.renderer, w = g.witness, s = g.sim, c = w.ysa, N = s.world.size; const THREE_V = r.camera.position.constructor; const v = new THREE_V(c.x - N / 2, s.world.heightAt(c.x, c.y) + 0.3, c.y - N / 2).project(r.camera); const rect = r.three.domElement.getBoundingClientRect(); return { x: (v.x * .5 + .5) * rect.width, y: (-v.y * .5 + .5) * rect.height }; });
  await shot('u1_pose_conversation', 300);
  await page.touchscreen.tap(px.x, px.y); await shot('u2_card_conversation', 700);
  console.log(await ev(() => document.getElementById('c-title').textContent + ' | ' + document.getElementById('c-sub').innerText));
  await page.click('#c-actions button:nth-child(2)'); await shot('u3_echanges', 900);
  console.log((await ev(() => document.getElementById('sheet-body').innerText)).slice(0, 600));
  await page.click('#sheet .sx'); await page.waitForTimeout(300);
  await ev(() => { window.game.sim.paused = false; });
  await page.click('#c-actions button:nth-child(1)'); // Écouter : cadrage automatique
  await shot('u4_cadrage_auto', 2500);
  // interaction du joueur avec Lenn : un rêve
  await ev(() => { const g = window.game, w = g.witness; g.sim.paused = true; g.ui.select('citizen', w.lenn.id); g.renderer.focusOn(w.lenn.x, w.lenn.y, 7, true); });
  await shot('u5_lenn_card', 1200);
  await page.click('#c-actions button:nth-child(2)'); await page.click('#c-actions button:nth-child(1)'); await shot('u6_reve_menu', 500);
  await page.locator('#msgs button').first().click(); await shot('u7_reve_resultat', 700);
  console.log('snack', await ev(() => document.getElementById('snack').innerText));
  console.log('lenn', await ev(() => { const w = window.game.witness, m = w.lenn.mind; return JSON.stringify({ trust: m.trust, ideas: m.ideas, mem: m.mem.map(x => x.k + ':' + x.w) }); }));
  console.log('erreurs', errs);
  await browser.close();
})();
