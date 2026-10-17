// Tests de bout en bout dans Chromium (Playwright) sur le build de production (npm run build).
// Usage : node tests/e2e/run.mjs [dossier-captures]
// Vérifie : menus et boutons, chargement de chaque niveau sans erreur, commandes clavier,
// victoire et sauvegarde, boss, défaite, commandes tactiles en émulation mobile.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright';

const ROOT = new URL('../../docs/', import.meta.url).pathname;
const SHOTS = process.argv[2] ?? new URL('../../docs-screens/', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json' };

const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '');
  try {
    const file = path || 'index.html';
    const data = await readFile(join(ROOT, file));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end();
  }
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

let failures = 0;
const results = [];
const openContexts = new Set();
const FILTER = process.env.E2E_FILTER ? new RegExp(process.env.E2E_FILTER) : null;
async function test(name, fn) {
  if (FILTER && !FILTER.test(name)) return;
  const t0 = Date.now();
  try {
    await fn();
    results.push(`✓ ${name} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  } catch (e) {
    failures++;
    results.push(`✗ ${name}\n    ${String(e?.message ?? e).split('\n').slice(0, 8).join('\n    ')}`);
  } finally {
    for (const c of openContexts) await c.close().catch(() => {});
    openContexts.clear();
  }
  console.log(results[results.length - 1]);
}

async function open(url, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
  openContexts.add(ctx);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && !/favicon|404/.test(m.text()) && errors.push(m.text()));
  await page.goto(BASE + url + (url.includes('?') ? '&' : '?') + 'q=bas', { timeout: 90000 });
  return { page, ctx, errors };
}

const waitScene = (page, key, timeout = 60000) =>
  page.waitForFunction((k) => window.__game?.scene.isActive(k), key, { timeout, polling: 200 });

/** Clique un bouton (conteneur interactif) d'une scène d'après son libellé. */
const click = (page, scene, label) =>
  page.evaluate(
    ([s, l]) => {
      const sc = window.__game.scene.getScene(s);
      const find = (list) => {
        for (const o of list) {
          if (o.label?.text?.includes(l)) return o;
          if (o.list) {
            const f = find(o.list);
            if (f) return f;
          }
        }
        return null;
      };
      const b = find(sc.children.list);
      if (!b) throw new Error(`bouton « ${l} » introuvable dans ${s}`);
      b.emit('pointerdown');
      return true;
    },
    [scene, label],
  );

const level = (page, fn, arg) => page.evaluate(([f, a]) => new Function('L', 'a', f)(window.__level, a), [fn.toString().replace(/^[^{]*{|}$/g, ''), arg]);

// 1. Parcours des menus jusqu'au premier niveau (avec la cinématique d'introduction).
await test('Menus : accueil → héros → carte → cinématique → niveau 1-1', async () => {
  const { page, ctx, errors } = await open('');
  await waitScene(page, 'Title');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/01-accueil.png` });
  await click(page, 'Title', 'Jouer');
  await waitScene(page, 'HeroSelect');
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__game.scene.getScene('HeroSelect').pick('hajar'));
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/02-heros.png` });
  await click(page, 'HeroSelect', 'parti');
  await waitScene(page, 'WorldMap');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/03-carte.png` });
  await click(page, 'WorldMap', '1-1');
  await waitScene(page, 'Cutscene');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${SHOTS}/04-cinematique.png` });
  await click(page, 'Cutscene', 'Passer');
  await waitScene(page, 'Level');
  await page.waitForFunction(() => window.__level?.body, null, { timeout: 30000 });
  const hero = await page.evaluate(() => window.__level.hero.id);
  if (hero !== 'hajar') throw new Error(`héros attendu hajar, obtenu ${hero}`);
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('gardiens.save')).profiles[0].seenCutscenes);
  if (!seen.includes('intro')) throw new Error('cinématique non mémorisée');
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
});

// 2. Commandes clavier réelles.
await test('Clavier : course, saut, pouvoir, pause', async () => {
  const { page, ctx, errors } = await open('?autotest&level=1-1&hero=soumaya');
  await page.waitForFunction(() => window.__level?.body?.grounded, null, { timeout: 60000 });
  const x0 = await page.evaluate(() => window.__level.body.x);
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction((x) => window.__level.body.x > x + 150, x0, { timeout: 30000 }).catch(() => {});
  await page.keyboard.up('ArrowRight');
  const x1 = await page.evaluate(() => window.__level.body.x);
  if (x1 - x0 < 100) throw new Error(`le héros n'avance pas (${x0} → ${x1})`);
  await page.waitForFunction(() => window.__level.body.grounded && Math.abs(window.__level.body.vx) < 5, null, { timeout: 30000 });
  await page.keyboard.down('Space');
  const minY = await page
    .waitForFunction(() => (window.__level.body.vy > 0 ? window.__level.body.y : 0), null, { timeout: 30000, polling: 16 })
    .then((h) => h.jsonValue());
  await page.keyboard.up('Space');
  const y0 = 560 - 104;
  if (y0 - minY < 60) throw new Error(`pas de saut (y min ${minY})`);
  await page.waitForTimeout(800);
  await page.keyboard.press('x');
  const fired = await page
    .waitForFunction(() => window.__level.projectiles.length > 0 || window.__level.powerCooldown > 0, null, { timeout: 15000 })
    .then(() => true, () => false);
  if (!fired) throw new Error('le pouvoir ne se déclenche pas');
  await page.keyboard.press('Escape');
  await waitScene(page, 'Overlay', 10000);
  await page.screenshot({ path: `${SHOTS}/05-pause.png` });
  await click(page, 'Overlay', 'Reprendre');
  await page.waitForTimeout(300);
  const phase = await page.evaluate(() => window.__level.phase);
  if (phase !== 'play') throw new Error(`reprise impossible (${phase})`);
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
});

// 3. Chaque niveau : chargement, capture, lanternes, arrivée, victoire et sauvegarde.
const LEVELS = ['1-1', '1-2', '1-3', '2-1', '2-2', '2-3', '3-1', '3-2', '3-3'];
const HEROES = ['soumaya', 'hajar', 'zakaria'];
for (const [i, id] of LEVELS.entries()) {
  const hero = HEROES[i % 3];
  await test(`Niveau ${id} (${hero}) : chargement, boss, victoire, sauvegarde`, async () => {
    const { page, ctx, errors } = await open(`?autotest&level=${id}&hero=${hero}`);
    await page.waitForFunction(() => window.__level?.body?.grounded, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SHOTS}/niveau-${id}.png` });
    const hasBoss = await page.evaluate(() => !!window.__level.L.boss);
    // Toutes les lanternes.
    const cps = await page.evaluate(() => window.__level.L.checkpoints);
    for (const c of cps) {
      await page.evaluate(([x, y]) => window.__level.debugTeleport(x + 10, y), [c.x, c.y]);
      await page.waitForTimeout(400);
    }
    const lit = await page.evaluate(() => window.__level.checkpoints.filter((c) => c.lit).length);
    if (lit !== cps.length) throw new Error(`lanternes allumées ${lit}/${cps.length}`);
    if (hasBoss) {
      // Entrer dans l'arène, attendre l'éveil, puis frapper le boss chaque fois qu'il est vulnérable.
      await page.evaluate(() => {
        const L = window.__level;
        L.debugTeleport(L.L.walls[0].x + 200, L.L.boss.y);
      });
      await page.waitForFunction(() => window.__level.boss.gateClosed, null, { timeout: 20000 });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `${SHOTS}/boss-${id}.png` });
      await page.waitForFunction(
        () => {
          const L = window.__level;
          L.invuln = 5;
          const b = L.boss.logic;
          if (b.vulnerable) L.boss.magicHit(b.rect);
          return L.boss.done;
        },
        null,
        { timeout: 120000, polling: 100 },
      );
      await page.waitForTimeout(2600);
    }
    await page.evaluate(() => {
      const L = window.__level;
      L.debugTeleport(L.L.goal.x - 60, L.L.goal.y);
    });
    await waitScene(page, 'Overlay', 20000);
    await page.waitForTimeout(2600);
    await page.screenshot({ path: `${SHOTS}/victoire-${id}.png` });
    const rec = await page.evaluate((lid) => JSON.parse(localStorage.getItem('gardiens.save')).profiles[0].levels[lid], id);
    if (!rec?.completed) throw new Error('victoire non sauvegardée');
    if (errors.length) throw new Error(errors.join('\n'));
    await ctx.close();
  });
}

// 4. Défaite encourageante puis reprise.
await test('Défaite : écran d’encouragement et reprise à la lanterne', async () => {
  const { page, ctx, errors } = await open('?autotest&level=1-2&hero=zakaria');
  await page.waitForFunction(() => window.__level?.body?.grounded, null, { timeout: 60000 });
  await page.evaluate(() => {
    const L = window.__level;
    for (let i = 0; i < 6; i++) {
      L.invuln = 0;
      L.hurt(1);
    }
  });
  await waitScene(page, 'Overlay', 10000);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/06-defaite.png` });
  await click(page, 'Overlay', 'Réessayer');
  await page.waitForTimeout(600);
  const st = await page.evaluate(() => ({ phase: window.__level.phase, hearts: window.__level.hearts }));
  if (st.phase !== 'play' || st.hearts < 3) throw new Error(JSON.stringify(st));
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
});

// 5. Mobile (émulation Samsung Galaxy, Samsung Internet) : boutons tactiles.
await test('Mobile (émulation Samsung Internet) : commandes tactiles', async () => {
  const ua = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36';
  const { page, ctx, errors } = await open('?autotest&level=1-1&hero=soumaya', { viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true, userAgent: ua, deviceScaleFactor: 2.6 });
  await page.waitForFunction(() => window.__level?.body?.grounded, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/07-mobile.png` });
  const box = await page.evaluate(() => {
    const r = document.querySelector('canvas').getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const toScreen = (gx, gy) => ({ x: box.x + (gx / 1280) * box.w, y: box.y + (gy / 720) * box.h });
  const hud = await page.evaluate(() => window.__game.scene.getScene('HUD').children.list.filter((o) => o.type === 'Container' && o.input).map((o) => ({ x: o.x, y: o.y })));
  if (hud.length < 4) throw new Error(`boutons tactiles absents (${hud.length})`);
  const right = hud.sort((a, b) => a.x - b.x)[1];
  const p = toScreen(right.x, right.y);
  const x0 = await page.evaluate(() => window.__level.body.x);
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: p.x, y: p.y, id: 1 }] });
  await page.waitForFunction((x) => window.__level.body.x > x + 150, x0, { timeout: 30000 }).catch(() => {});
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const x1 = await page.evaluate(() => window.__level.body.x);
  if (x1 - x0 < 80) throw new Error(`le bouton ▶ tactile ne fait pas avancer (${x0} → ${x1})`);
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
});

// 6. Galerie et réglages.
await test('Galerie des trésors et réglages', async () => {
  const { page, ctx, errors } = await open('?scene=Gallery');
  await waitScene(page, 'Gallery');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/08-tresors.png` });
  await page.evaluate(() => window.__game.scene.start('Title'));
  await waitScene(page, 'Title');
  await click(page, 'Title', 'Réglages');
  await waitScene(page, 'Settings');
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${SHOTS}/09-reglages.png` });
  await click(page, 'Settings', 'Beau');
  const q = await page.evaluate(() => JSON.parse(localStorage.getItem('gardiens.save')).settings.quality);
  if (q !== 'haut') throw new Error(`réglage non sauvegardé (${q})`);
  await click(page, 'Settings', 'Fermer');
  if (errors.length) throw new Error(errors.join('\n'));
  await ctx.close();
});

await browser.close();
server.close();
console.log(`\n${results.length - failures}/${results.length} tests réussis`);
process.exit(failures ? 1 : 0);
