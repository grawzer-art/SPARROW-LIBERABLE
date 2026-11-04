const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
  await page.goto('http://localhost:5173/?local'); await page.fill('#i-seed', '478'); await page.click('#i-new'); await page.waitForTimeout(4000);
  const ev = (f, a) => page.evaluate(f, a);
  await ev(() => { const g = window.game; g.sim.paused = true; const c = g.sim.cities[0]; g.renderer.focusOn(c.x + .5, c.y + .5, 11, true); });
  await page.waitForTimeout(2500);
  const pt = await ev(() => { const g = window.game, r = g.renderer; const c = g.sim.citizens.find(c => !c.dead && c.age > 14 && Math.hypot(c.x - g.sim.cities[0].x, c.y - g.sim.cities[0].y) < 4); const N = g.sim.world.size; const v = new r.camera.position.constructor(c.x - N / 2, g.sim.world.heightAt(c.x, c.y) + 0.25, c.y - N / 2).project(r.camera); const rect = r.three.domElement.getBoundingClientRect(); return { x: (v.x * .5 + .5) * rect.width, y: (-v.y * .5 + .5) * rect.height, name: c.name }; });
  console.log('tap', JSON.stringify(pt));
  await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(600);
  console.log('card:', await ev(() => document.getElementById('card').className + ' | ' + document.getElementById('c-title').textContent + ' | ' + document.getElementById('c-sub').textContent));
  await page.click('#c-actions button:nth-child(3)'); await page.waitForTimeout(600);
  console.log('sheet:', await ev(() => document.getElementById('sheet').className + ' | ' + document.getElementById('sheet-t').textContent + ' | ' + document.getElementById('sheet-body').innerText.slice(0, 80).replace(/\n/g, ' ')));
  await ev(() => { const el = document.querySelector('#sheet .grab'); const mk = (t, y) => new TouchEvent(t, { bubbles: true, cancelable: true, touches: t === 'touchend' ? [] : [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })], changedTouches: [new Touch({ identifier: 1, target: el, clientX: 200, clientY: y })] }); el.dispatchEvent(mk('touchstart', 340)); for (let y = 350; y <= 520; y += 20) el.dispatchEvent(mk('touchmove', y)); el.dispatchEvent(mk('touchend', 520)); });
  await page.waitForTimeout(700);
  console.log('after swipe sheet hidden:', await ev(() => document.getElementById('sheet').classList.contains('hidden')));
  // pouvoir foudre: armer puis taper le monde
  await page.click('#dock [data-d=powers]'); await page.waitForTimeout(500); console.log('tray', await ev(() => { const t = document.getElementById('tray'); const b = t.querySelector('.pw'); return t.className + ' ' + JSON.stringify(b.getBoundingClientRect()) + ' ' + document.body.className; })); await page.click('.pw[data-p=lightning]', {timeout: 5000});
  await ev(() => { window.game.sim.paused = false; });
  const before = await ev(() => window.game.sim.citizens.length);
  await page.touchscreen.tap(pt.x, pt.y); await page.waitForTimeout(1200);
  console.log('foudre: snack=', await ev(() => document.getElementById('snack').innerText), 'pop', before, '->', await ev(() => window.game.sim.citizens.length));
  console.log('toasts/notifs in DOM:', await ev(() => document.querySelectorAll('.toast, #toasts, #crumbs').length));
  console.log('erreurs', errs);
  await browser.close();
})();
