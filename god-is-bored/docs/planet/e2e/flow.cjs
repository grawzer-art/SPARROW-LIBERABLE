// Séquence de démonstration utilisateur (toucher réel) : planète -> région -> village -> habitant -> globe -> autre civilisation -> accélérer
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-SPARROW-LIBERABLE/d893d3c9-3a76-557d-ab4e-384739530d9a/scratchpad/v3/';
const MOBILE = process.env.MOBILE === '1'; const pfx = process.argv[2] || 'flow';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 430, height: 932 } : { width: 1000, height: 640 }, deviceScaleFactor: MOBILE ? 2 : 1, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage(); const errs = [], log = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const st = () => page.evaluate(() => ({ mode: window.game.mode, pv: window.game.planetView.state.mode, tween: window.game.planetView.state.tween, D: +window.game.planetView.state.D.toFixed(2), dist: +window.game.planetView.state.dist.toFixed(3), year: window.game.sim.year, pop: window.game.sim.citizens.length }));
  const shot = async (n) => { await page.screenshot({ path: OUT + `${pfx}_${MOBILE ? 'm' : 'd'}_${n}.png`, timeout: 120000 }); };
  const step = async (name, fn, wait = 1500) => { await fn(); await page.waitForTimeout(wait); const s = await st(); log.push(name + ' ' + JSON.stringify(s)); console.log(name, JSON.stringify(s)); };
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(3500);
  await step('1 ouverture : planète vue de l\'espace', async () => { }, 500); await shot('1_espace');
  // 2-3 faire tourner avec le doigt (glisser)
  const cx = MOBILE ? 215 : 500, cy = MOBILE ? 460 : 340;
  await step('2 glisser pour tourner', async () => { await page.mouse.move(cx, cy); await page.mouse.down(); for (let i = 1; i <= 14; i++) { await page.mouse.move(cx - i * 12, cy + i * 2); await page.waitForTimeout(25); } await page.mouse.up(); }, 1200); await shot('2_tourne');
  // 4-5 recentrer la région puis la sélectionner par un toucher
  await step('3 recentrer sur la région (API)', async () => { await page.evaluate(() => { const g = window.game; g.planetView.setView({ mode: 'planet', P: g.sim.planet.regionCenter(g.sim.planet.regions[0]) }); }); }, 800);
  const tapAt = async (x, y) => { if (MOBILE) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
  const rp = await page.evaluate(() => { const g = window.game, pv = g.planetView; const c = g.sim.planet.regionCenter(g.sim.planet.regions[0]); const v = new window.THREE_V(c[0], c[1], c[2]); return null; }).catch(() => null);
  await step('4 toucher la région', async () => { await tapAt(cx, cy); }, 800); await shot('3_carte_region');
  console.log('card:', await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ')));
  await step('5 zoomer sur la région', async () => { await page.click('#pc-actions button'); }, 2600); await shot('4_region');
  const rows = await page.evaluate(() => [...document.querySelectorAll('.plbl.city')].map(e => e.textContent));
  console.log('labels villes:', rows.join(' ; '));
  await step('6 toucher une ville', async () => { const p = await page.evaluate(() => { const e = document.querySelector('.plbl.city'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height + 30 }; }); await tapAt(p.x, p.y); }, 800); await shot('5_ville');
  console.log('card:', await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ') + ' | ' + [...document.querySelectorAll('#pc-actions button')].map(b => b.textContent)));
  await step('7 entrer dans le village', async () => { await page.click('#pc-actions button'); }, 2500); await shot('6_local');
  await step('8 toucher un habitant (local)', async () => { const ok = await page.evaluate(() => { const g = window.game, c = g.sim.citizens[0]; g.ui.select('citizen', c.id); g.renderer.focusOn(c.x, c.y, 10, true); return c.name; }); }, 1500); await shot('7_habitant');
  await step('9 retour à la région (🌍)', async () => { await page.click('#crumbs button[data-lvl="region"]'); }, 1500); await shot('8_retour_region');
  await step('10 retour au globe', async () => { await page.click('#crumbs button[data-lvl="planet"]'); }, 2600); await shot('9_globe');
  const sum0 = await page.evaluate(() => { const g = window.game; return g.sim.planet.summary(g.sim, g.sim.planet.regions[0]).civs.map(c => `${c.name}:${c.pop}`).join(' '); });
  console.log('résumé avant:', sum0);
  // sélectionner un continent : toucher la première masse de terre visible (repérée par projection)
  await step('10b toucher un continent', async () => { const p = await page.evaluate(() => { const g = window.game, pv = g.planetView, THREE = null; const c = g.sim.planet.continents()[0]; const L = pv.labels.get('c' + c.id); if (!L) return null; const r = L.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height + 20 }; }); if (p) await tapAt(p.x, p.y); }, 900);
  console.log('card continent:', await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ')));
  await shot('9b_continent');
  await step('10c retour région puis autre civilisation', async () => { await page.evaluate(() => window.game.planetView.dive()); }, 2600);
  await step('10d toucher une autre capitale', async () => { const p = await page.evaluate(() => { const els = [...document.querySelectorAll('.plbl.city')]; const e = els[els.length - 1]; const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height + 6, t: e.textContent }; }); console.log('cible:', p.t); await tapAt(p.x, p.y); }, 800);
  console.log('card:', await page.evaluate(() => document.getElementById('pc-title')?.textContent + ' | ' + document.getElementById('pc-lines')?.innerText.replace(/\n/g, ' / ')));
  await step('10e entrer chez elle', async () => { await page.click('#pc-actions button'); }, 2500); await shot('9c_autre_civ');
  await step('10f retour globe', async () => { await page.click('#crumbs button[data-lvl="planet"]'); }, 3000);
  await step('11 accélérer ×10', async () => { await page.click('#t-10'); }, 6000);
  const sum1 = await page.evaluate(() => { const g = window.game; return g.sim.planet.summary(g.sim, g.sim.planet.regions[0]).civs.map(c => `${c.name}:${c.pop}`).join(' '); });
  console.log('résumé après:', sum1);
  await shot('10_apres');
  console.log('erreurs', errs.slice(0, 5));
  await browser.close();
})();
