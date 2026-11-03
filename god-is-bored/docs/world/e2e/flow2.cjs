// Démonstration World Expansion (12 étapes) avec vrais gestes. MOBILE=1 pour iPhone.
const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user-SPARROW-LIBERABLE/d893d3c9-3a76-557d-ab4e-384739530d9a/scratchpad/v3/';
const MOBILE = process.env.MOBILE === '1'; const pfx = process.argv[2] || 'we';
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: MOBILE ? { width: 430, height: 932 } : { width: 1000, height: 640 }, deviceScaleFactor: MOBILE ? 2 : 1, isMobile: MOBILE, hasTouch: MOBILE });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const cx = MOBILE ? 215 : 500, cy = MOBILE ? 460 : 330;
  const tapAt = async (x, y) => { if (MOBILE) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); };
  const S = () => page.evaluate(() => { const g = window.game; return { mode: g.mode, active: g.ps.activeId, year: g.sim.year, tot: g.ps.totals(), per: [...g.ps.engines.entries()].map(([id, e]) => id + ':' + e.citizens.length + '@' + e.year).join(' ') }; });
  const shot = async (n) => { await page.waitForTimeout(1200); await page.screenshot({ path: OUT + `${pfx}_${MOBILE ? 'm' : 'd'}_${n}.png`, timeout: 120000 }); };
  const card = () => page.evaluate(() => (document.getElementById('planet-card').classList.contains('hidden') ? '(aucune fiche)' : document.getElementById('pc-title').textContent + ' | ' + [...document.querySelectorAll('#pc-lines div')].map(d => d.textContent).join(' / ') + ' | [' + [...document.querySelectorAll('#pc-actions button')].map(b => b.textContent).join(', ') + ']'));
  const log = async (name) => console.log(name, JSON.stringify(await S()));
  await page.goto('http://localhost:5173/'); await page.fill('#i-seed', '42'); await page.click('#i-new'); await page.waitForTimeout(4500);
  await log('1 partie lancée'); await shot('1_espace');
  // 2-3 continents distincts + rotation sur 360° par glisser
  const dirs0 = [];
  for (let k = 0; k < 8; k++) {
    await page.mouse.move(cx - 60, cy); await page.mouse.down(); for (let i = 1; i <= 10; i++) { await page.mouse.move(cx - 60 + i * 12, cy + 0); await page.waitForTimeout(16); } await page.mouse.up(); await page.waitForTimeout(500);
    dirs0.push(await page.evaluate(() => { const q = window.game.planetView.globe.quaternion; return [+q.x.toFixed(2), +q.y.toFixed(2), +q.z.toFixed(2), +q.w.toFixed(2)].join(','); }));
  }
  console.log('2-3 rotation par glisser (8 gestes) → orientations distinctes:', new Set(dirs0).size, 'sur 8'); await shot('2_rotation');
  const spins = await page.evaluate(() => { const g = window.game; const out = []; const cs = g.ps.planet.continents().filter(c => c.areaPct > 2.5); for (const c of cs) { const d = (la, lo) => [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]; g.planetView.setView({ mode: 'planet', P: d(c.lat, c.lon) }); out.push(c.name + ' ' + c.areaPct.toFixed(1) + '%'); } return out; });
  console.log('   continents accessibles par rotation:', spins.join(' · '));
  // 4 sélectionner Terre Première (puce du sélecteur → carte)
  await page.evaluate(() => { const g = window.game; g.planetView.setView({ mode: 'planet', P: g.ps.planet.regionCenter(g.ps.planet.regionById(1)) }); });
  await page.waitForTimeout(1000); await tapAt(cx, cy); await page.waitForTimeout(800);
  console.log('4 fiche:', await card()); await shot('3_terre_premiere');
  // 5 descendre dans son village
  await page.click('#pc-actions button'); await page.waitForTimeout(3200); await shot('4_region_r1');
  const city = await page.evaluate(() => { const e = [...document.querySelectorAll('.plbl.city')].find(x => x.style.display !== 'none'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height + 14, t: e.textContent }; });
  await tapAt(city.x, city.y); await page.waitForTimeout(700); console.log('5 ville:', city.t, '→', await card());
  await page.click('#pc-actions button'); await page.waitForTimeout(3000); await log('5 village (local)'); await shot('5_village_r1');
  const r1 = await S();
  // 6 revenir au globe
  await page.click('#crumbs button[data-lvl="region"]'); await page.waitForTimeout(2000);
  await page.click('#crumbs button[data-lvl="planet"]'); await page.waitForTimeout(3200); await log('6 globe'); await shot('6_globe');
  // 7 sélectionner un continent différent (puce) puis toucher sa terre
  const chips = await page.evaluate(() => [...document.querySelectorAll('#continents button')].map(b => b.textContent));
  console.log('7 sélecteur de continents:', chips.join(' · '));
  await page.evaluate(() => document.querySelectorAll('#continents button')[2].click()); await page.waitForTimeout(1500);
  console.log('7 fiche continent:', await card()); await shot('7_continent_autre');
  // 8 explorer une région (inhabitée) : terrain = biome
  await page.click('#pc-actions button'); await page.waitForTimeout(3600);
  const reg = await page.evaluate(() => { const g = window.game; const id = g.planetView.state.region; const e = g.ps.engineOf(id); const r = g.ps.planet.regionById(id); let t = 0, f = 0, l = 0; const w = e.world; for (let i = 0; i < 4096; i++) if (w.type[i] !== 0) { l++; t += w.trees[i]; f += w.fertility[i]; } const bio = {}; for (let i = 0; i < 4096; i++) { const b = w.biome[i]; bio[b] = (bio[b] || 0) + 1; } return { id, name: r.name, inhabited: g.ps.isInhabited(e), pop: e.citizens.length, landTiles: l, treesPerLand: +(t / l).toFixed(2), fert: +(f / l).toFixed(2), biomes: bio }; });
  console.log('8 région explorée:', JSON.stringify(reg)); await shot('8_region_inhabitee');
  const tile = await page.evaluate(() => { const g = window.game; const pv = g.planetView; return null; });
  await tapAt(cx, cy); await page.waitForTimeout(700); console.log('8 case:', await card());
  // 9 découvrir une autre civilisation : région habitée n°2
  await page.click('#crumbs button[data-lvl="planet"]'); await page.waitForTimeout(3200);
  const r2id = await page.evaluate(() => window.game.ps.planet.regions.find(r => r.inhabited && r.id !== 1).id);
  await page.evaluate((id) => { const g = window.game; g.planetView.setView({ mode: 'planet', P: g.ps.planet.regionCenter(g.ps.planet.regionById(id)) }); }, r2id);
  await page.waitForTimeout(1000); await tapAt(cx, cy); await page.waitForTimeout(800);
  console.log('9 fiche autre civilisation:', await card()); console.log('   dbg', await page.evaluate(() => JSON.stringify({ body: document.body.className, card: document.getElementById('planet-card').className, disp: getComputedStyle(document.getElementById('planet-card')).display, vis: getComputedStyle(document.getElementById('pc-actions')).display, mode: window.game.mode }))); await shot('9_autre_civ');
  console.log('   dbg2', await page.evaluate(() => JSON.stringify({ body: document.body.className, disp: getComputedStyle(document.getElementById('planet-card')).display, mode: window.game.mode })));
  await page.click('#pc-actions button'); await page.waitForTimeout(3200);
  const c2 = await page.evaluate(() => { const e = [...document.querySelectorAll('.plbl.city')].find(x => x.style.display !== 'none'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height + 14, t: e.textContent }; });
  await tapAt(c2.x, c2.y); await page.waitForTimeout(700); await page.click('#pc-actions button'); await page.waitForTimeout(3000);
  await log('9 village de l\'autre civilisation'); await shot('10_village_r2');
  // 10-11 accélérer, revenir à Terre Première, constater l'évolution
  await page.click('#t-10'); await page.waitForTimeout(7000); await page.click('#t-1');
  const before = r1;
  await page.evaluate(() => window.game.planetView.activate && 0);
  await page.click('#crumbs button[data-lvl="region"]'); await page.waitForTimeout(1500); await page.click('#crumbs button[data-lvl="planet"]'); await page.waitForTimeout(3200);
  await page.evaluate(() => { const g = window.game; g.planetView.setView({ mode: 'planet', P: g.ps.planet.regionCenter(g.ps.planet.regionById(1)) }); });
  await page.waitForTimeout(800); await tapAt(cx, cy); await page.waitForTimeout(800);
  console.log('11 Terre Première après ×10:', await card()); await log('11 état'); console.log('   avant:', before.per, ' après:', (await S()).per); await shot('11_terre_premiere_apres');
  // 12 sauvegarder / recharger
  await page.evaluate(() => { window.game.sim.paused = true; }); await page.waitForTimeout(600);
  const sv = await page.evaluate(() => { const g = window.game; const msg = g.save(); return { msg, sig: [...g.ps.engines.entries()].map(([id, e]) => id + ':' + e.citizens.length + ':' + e.civs.map(c => c.name).join('+')).join(' | '), regions: g.ps.planet.regions.map(r => r.id + r.name).join(',') }; });
  console.log('12 sauvegarde:', sv.msg); console.log('   avant rechargement:', sv.sig);
  await page.reload(); await page.waitForTimeout(1500);
  // chargement synchrone : on lit l'état AVANT le premier tick
  const ld = await page.evaluate(() => { document.getElementById('i-continue').click(); const g = window.game; return { sig: [...g.ps.engines.entries()].map(([id, e]) => id + ':' + e.citizens.length + ':' + e.civs.map(c => c.name).join('+')).join(' | '), regions: g.ps.planet.regions.map(r => r.id + r.name).join(',') }; });
  await page.waitForTimeout(3000);
  ld.sig = ld.sig.split(' | ').sort().join(' | '); sv.sig = sv.sig.split(' | ').sort().join(' | ');
  console.log('   après rechargement:', ld.sig); console.log('   mêmes régions:', ld.regions === sv.regions, '· mêmes populations:', ld.sig === sv.sig); await shot('12_recharge');
  console.log('erreurs', errs.slice(0, 5));
  await browser.close();
})();
