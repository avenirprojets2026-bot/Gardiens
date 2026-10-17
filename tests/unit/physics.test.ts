import { describe, expect, it } from 'vitest';
import { BASE_PARAMS, PlatformerBody, STEP, assisted, type BodyInput } from '../../src/physics/body';
import { updateMovers } from '../../src/physics/movers';
import type { Solid } from '../../src/physics/geom';

const idle: BodyInput = { left: false, right: false, jump: false, jumpPressed: false };
const floor: Solid[] = [{ x: -1000, y: 600, w: 4000, h: 1000 }];

function settle(b: PlatformerBody, solids = floor, steps = 240) {
  for (let i = 0; i < steps; i++) b.step(idle, solids);
}

describe('corps du héros', () => {
  it('se pose sur le sol', () => {
    const b = new PlatformerBody(BASE_PARAMS, 0, 400);
    settle(b);
    expect(b.grounded).toBe(true);
    expect(b.bottom).toBeCloseTo(600, 3);
  });

  it('saute à la hauteur réglée (bouton maintenu)', () => {
    const b = new PlatformerBody(BASE_PARAMS, 0, 400);
    settle(b);
    let minY = b.y;
    b.step({ ...idle, jump: true, jumpPressed: true }, floor);
    for (let i = 0; i < 240; i++) {
      b.step({ ...idle, jump: true }, floor);
      minY = Math.min(minY, b.y);
    }
    const h = 600 - BASE_PARAMS.height - minY;
    // Gravité réduite à l'apogée : un peu plus haut que la valeur nominale.
    expect(h).toBeGreaterThan(195);
    expect(h).toBeLessThan(240);
  });

  it('saut court si on relâche tôt', () => {
    const b = new PlatformerBody(BASE_PARAMS, 0, 400);
    settle(b);
    let minY = b.y;
    b.step({ ...idle, jump: true, jumpPressed: true }, floor);
    for (let i = 0; i < 240; i++) {
      b.step(idle, floor);
      minY = Math.min(minY, b.y);
    }
    expect(600 - BASE_PARAMS.height - minY).toBeLessThan(120);
  });

  it('coyote time : saut accepté juste après le bord', () => {
    const ledge: Solid[] = [{ x: 0, y: 600, w: 200, h: 1000 }];
    const b = new PlatformerBody(BASE_PARAMS, 150, 400);
    settle(b, ledge);
    // Court vers la droite jusqu'à quitter le bord.
    let steps = 0;
    while (b.grounded && steps++ < 400) b.step({ ...idle, right: true }, ledge);
    for (let i = 0; i < 6; i++) b.step({ ...idle, right: true }, ledge); // 50 ms en l'air
    b.step({ ...idle, right: true, jump: true, jumpPressed: true }, ledge);
    expect(b.vy).toBeLessThan(-500);
    expect(b.events.some((e) => e.type === 'jump' && !e.air)).toBe(true);
  });

  it('jump buffer : appui juste avant d’atterrir', () => {
    const b = new PlatformerBody(BASE_PARAMS, 0, 300);
    let i = 0;
    while (b.bottom < 600 - 30 && i++ < 400) b.step(idle, floor);
    b.step({ ...idle, jumpPressed: true, jump: true }, floor);
    // L'appui en l'air consomme le double saut de Soumaya ; avec un héros sans double saut il est mis en attente.
    const h = new PlatformerBody({ ...BASE_PARAMS, airJumps: 0 }, 0, 300);
    i = 0;
    while (h.bottom < 600 - 30 && i++ < 400) h.step(idle, floor);
    h.step({ ...idle, jumpPressed: true, jump: true }, floor);
    let jumped = false;
    for (let k = 0; k < 20 && !jumped; k++) {
      h.step({ ...idle, jump: true }, floor);
      jumped = h.events.some((e) => e.type === 'jump');
    }
    expect(jumped).toBe(true);
  });

  it('double saut puis vol plané', () => {
    const b = new PlatformerBody({ ...BASE_PARAMS, glideFall: 150 }, 0, 400);
    settle(b);
    b.step({ ...idle, jump: true, jumpPressed: true }, floor);
    for (let i = 0; i < 30; i++) b.step({ ...idle, jump: true }, floor);
    b.step({ ...idle, jump: true, jumpPressed: true }, floor);
    expect(b.events.some((e) => e.type === 'jump' && e.air)).toBe(true);
    for (let i = 0; i < 120; i++) b.step({ ...idle, jump: true }, floor);
    if (!b.grounded) expect(b.vy).toBeLessThanOrEqual(150.01);
  });

  it('saut mural (Hajar)', () => {
    const wall: Solid[] = [...floor, { x: 300, y: -400, w: 50, h: 1000 }];
    const p = { ...BASE_PARAMS, airJumps: 0, wallJump: true };
    const b = new PlatformerBody(p, 200, 400);
    settle(b, wall);
    b.step({ ...idle, right: true, jump: true, jumpPressed: true }, wall);
    let touched = false;
    for (let i = 0; i < 60 && !touched; i++) {
      b.step({ ...idle, right: true, jump: true }, wall);
      touched = b.wallDir === 1;
    }
    expect(touched).toBe(true);
    b.step({ ...idle, right: true, jump: true, jumpPressed: true }, wall);
    expect(b.events.some((e) => e.type === 'wallJump')).toBe(true);
    expect(b.vx).toBeLessThan(0);
  });

  it('ne traverse pas une plateforme fine en chute rapide', () => {
    const thin: Solid[] = [{ x: -100, y: 600, w: 400, h: 20, oneWay: true }];
    const b = new PlatformerBody(BASE_PARAMS, 0, -800);
    b.vy = 1150;
    for (let i = 0; i < 400; i++) b.step(idle, thin);
    expect(b.grounded).toBe(true);
    expect(b.bottom).toBeCloseTo(600, 3);
  });

  it('plateforme à sens unique : on la traverse par en dessous', () => {
    const plat: Solid[] = [...floor, { x: -100, y: 500, w: 400, h: 20, oneWay: true }];
    const b = new PlatformerBody(BASE_PARAMS, 0, 400);
    settle(b, plat);
    expect(b.bottom).toBeCloseTo(500, 3);
  });

  it('mode assisté : tolérances élargies', () => {
    const a = assisted(BASE_PARAMS);
    expect(a.coyoteTime).toBeGreaterThan(BASE_PARAMS.coyoteTime);
    expect(a.jumpBuffer).toBeGreaterThan(BASE_PARAMS.jumpBuffer);
  });

  it('courant d’air ascendant : le héros monte', () => {
    const b = new PlatformerBody(BASE_PARAMS, 0, 400);
    settle(b);
    b.step({ ...idle, jump: true, jumpPressed: true }, floor);
    for (let i = 0; i < 200; i++) b.step({ ...idle, jump: true }, floor, STEP, { updraft: 3200 });
    expect(b.y).toBeLessThan(0);
  });
});

describe('plateformes animées', () => {
  it('transporte le héros sur une plateforme mobile', () => {
    const def = { kind: 'med' as const, x: 0, y: 500, w: 200, move: { dx: 200, dy: 0, period: 4 } };
    const s: Solid[] = [{ x: 0, y: 500, w: 200, h: 36, oneWay: true, ref: def }];
    const b = new PlatformerBody(BASE_PARAMS, 50, 380);
    let t = 0;
    for (let i = 0; i < 120; i++) {
      t += STEP;
      updateMovers(s, t, b);
      b.step(idle, s);
    }
    const x0 = b.x;
    for (let i = 0; i < 120; i++) {
      t += STEP;
      updateMovers(s, t, b);
      b.step(idle, s);
    }
    expect(b.grounded).toBe(true);
    expect(b.x - x0).toBeGreaterThan(30);
  });

  it('feuille fragile : tombe puis réapparaît', () => {
    const def = { kind: 'small' as const, x: 0, y: 500, w: 150, fall: true };
    const s: Solid[] = [{ x: 0, y: 500, w: 150, h: 30, oneWay: true, ref: def }];
    const b = new PlatformerBody(BASE_PARAMS, 40, 380);
    let t = 0;
    let fell = false;
    for (let i = 0; i < 120 * 3; i++) {
      t += STEP;
      updateMovers(s, t, b);
      b.step(idle, s);
      if (s[0].y > 1000) fell = true;
    }
    expect(fell).toBe(true);
    for (let i = 0; i < 120 * 4; i++) {
      t += STEP;
      updateMovers(s, t);
    }
    expect(s[0].y).toBeCloseTo(500, 0);
  });
});
