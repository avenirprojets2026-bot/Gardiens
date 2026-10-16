import { chromium } from 'playwright';
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:4173/?autotest&level=1-1');
await p.waitForFunction(() => window.__level?.body?.grounded, null, { timeout: 90000 });
await p.evaluate(() => { const L = window.__level; L.debugTeleport(L.L.goal.x - 60, L.L.goal.y); });
for (let i = 0; i < 8; i++) {
  await p.waitForTimeout(1500);
  console.log(JSON.stringify(await p.evaluate(() => { const L = window.__level; return { st: window.__game.scene.getScene('Overlay').sys.settings.status, lst: L.sys.settings.status, evs: L.time._active.map(e=>[e.delay,e.elapsed|0]), now: L.time.now, ev: L.time._active?.length, pend: L.time._pendingInsertion?.length, ts: L.time.timeScale, paused: L.time.paused, phase: L.phase, x: L.body.centerX, b: L.body.bottom, g: L.L.goal, done: L.boss.done, ov: window.__game.scene.isActive('Overlay') }; })));
}
await b.close();
