import { describe, expect, it } from 'vitest';
import { HERO_ORDER } from '../../src/data/heroes';
import { LEVELS, WORLDS } from '../../src/data/worlds';
import { reachable } from './reach';

// Atteignabilité de chaque niveau des mondes 1 à 3, pour chaque héros (moteur physique réel).
describe('atteignabilité (moteur physique réel)', () => {
  for (const w of WORLDS.slice(0, 3))
    for (const id of w.levels)
      for (const hero of HERO_ORDER)
        it(`${id} avec ${hero}`, () => {
          const r = reachable(LEVELS[id], hero);
          expect(r.ok, `surfaces atteintes ${r.reached}/${r.total}, ${r.frontier}`).toBe(true);
        }, 60000);
});
