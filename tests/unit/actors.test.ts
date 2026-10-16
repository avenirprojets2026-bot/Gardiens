import { describe, expect, it } from 'vitest';
import { ChargerBoss } from '../../src/bosses/charger';
import { TreeBoss } from '../../src/bosses/tree';
import { createEnemy, stepEnemy, harmful } from '../../src/enemies/logic';

const DT = 1 / 120;

describe('ennemis', () => {
  it('le scarabée patrouille entre ses bornes', () => {
    const e = createEnemy({ x: 100, minX: 0, maxX: 200, speed: 100 }, 560);
    let minX = 1e9, maxX = -1e9;
    for (let i = 0; i < 120 * 6; i++) {
      stepEnemy(e, DT, { x: 5000, y: 560 });
      minX = Math.min(minX, e.x);
      maxX = Math.max(maxX, e.x);
    }
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(maxX).toBeLessThanOrEqual(200);
    expect(maxX - minX).toBeGreaterThan(150);
  });

  it('le fonceur prévient, fonce, puis souffle (inoffensif)', () => {
    const e = createEnemy({ kind: 'charger', x: 500, minX: 400, maxX: 600, speed: 60 }, 560);
    e.cooldown = 0;
    const modes = new Set<string>();
    for (let i = 0; i < 120 * 3; i++) {
      stepEnemy(e, DT, { x: 300, y: 560 });
      modes.add(e.mode);
      if (e.mode === 'tired') expect(harmful(e)).toBe(false);
    }
    expect([...modes]).toEqual(expect.arrayContaining(['alert', 'charge', 'tired']));
  });

  it('le champignon crache des spores vers le héros', () => {
    const e = createEnemy({ kind: 'spitter', x: 500, minX: 500, maxX: 500, speed: 0 }, 560);
    e.cooldown = 0;
    let spore = null;
    for (let i = 0; i < 120 * 2 && !spore; i++) spore = stepEnemy(e, DT, { x: 200, y: 560 });
    expect(spore).not.toBeNull();
    expect(spore!.vx).toBeLessThan(0);
  });

  it('le feu follet plonge quand le héros passe dessous', () => {
    const e = createEnemy({ kind: 'flyer', x: 500, y: 300, minX: 400, maxX: 600, speed: 70 }, 560);
    e.cooldown = 0;
    let swooped = false;
    for (let i = 0; i < 120 * 2; i++) {
      stepEnemy(e, DT, { x: e.x, y: 560 });
      if (e.mode === 'swoop') swooped = true;
    }
    expect(swooped).toBe(true);
  });
});

describe('boss', () => {
  it('le Roi Ronchon ne prend des coups qu’étourdi, et finit vaincu', () => {
    const b = new ChargerBoss(5500, 560, 4000, 5900, 3);
    expect(b.stomped()).toBe(false);
    let guard = 0;
    while (b.hp > 0 && guard++ < 120 * 120) {
      b.update(DT, 4500);
      if (b.vulnerable) b.stomped();
    }
    expect(b.hp).toBe(0);
    for (let i = 0; i < 240; i++) b.update(DT, 4500);
    expect(b.state).toBe('defeated');
  });

  it('le Vieux Chêne bâille tous les trois cycles', () => {
    const b = new TreeBoss(5300, 560, 4000, 5900, 3);
    let tired = 0;
    let guard = 0;
    while (b.hp > 0 && guard++ < 120 * 180) {
      b.update(DT, 4500);
      if (b.vulnerable) {
        tired++;
        b.stomped();
      }
    }
    expect(tired).toBe(3);
    expect(b.hp).toBe(0);
  });
});

import { PatternBoss } from '../../src/bosses/pattern';
import { BOSS_PATTERNS } from '../../src/bosses/roster';

describe('boss à motifs (mondes 4 à 10)', () => {
  for (const [name, cfg] of Object.entries(BOSS_PATTERNS)) {
    it(`${name} : attaques variées, vulnérable au sol, vaincu en ${name === 'weaver' ? 5 : 3} coups`, () => {
      const hp = name === 'weaver' ? 5 : 3;
      const b = new PatternBoss(5500, 560, 4000, 5900, hp, cfg);
      const seen = new Set<string>();
      let guard = 0;
      let hazards = 0;
      while (b.hp > 0 && guard++ < 120 * 300) {
        b.update(DT, 4600 + Math.sin(guard / 200) * 500);
        seen.add(b.state);
        hazards += b.acorns.length + b.beams.length + b.shots.length + b.waves.length;
        if (b.vulnerable) {
          // Vulnérable seulement posé au sol (on peut lui sauter dessus).
          expect(b.y).toBeCloseTo(560, 0);
          b.stomped();
        }
      }
      expect(b.hp).toBe(0);
      expect(hazards).toBeGreaterThan(0);
      expect(seen.size).toBeGreaterThan(4);
      for (let i = 0; i < 240; i++) b.update(DT, 4600);
      expect(b.state).toBe('defeated');
    });
  }
});
