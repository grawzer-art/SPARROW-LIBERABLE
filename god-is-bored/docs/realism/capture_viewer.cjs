const { chromium } = require('playwright');
const OUT = __dirname + '/v8/';
const modes = (process.env.MODES || 'idle,walk,talk').split(',');
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
  await page.goto('http://localhost:5173/?scene=human' + (process.env.Q ? '&' + process.env.Q : '')); 
  await page.waitForFunction(() => window.hv, null, { timeout: 90000 });
  await page.waitForTimeout(2500);
  for (const m of modes) {
    await page.evaluate((m) => window.hv.setMode(m), m);
    await page.waitForTimeout(m === 'talk' ? 5000 : 3500);
    await page.screenshot({ path: OUT + (process.env.TAG || 'h') + '_' + m + '.png', timeout: 120000 });
    console.log(m, JSON.stringify(await page.evaluate(() => window.__hv)));
  }
  console.log('erreurs', errs.slice(0, 6));
  await browser.close();
})();
