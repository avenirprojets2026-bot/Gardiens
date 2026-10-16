import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { LEVEL_ORDER, LEVELS, WORLDS } from '../../src/data/worlds';
import { CUTSCENES } from '../../src/data/story';
import { HERO_ORDER } from '../../src/data/heroes';
import { reachable } from './reach';
import { BASE_THEMES } from '../../src/data/themes';

const manifest = JSON.parse(readFileSync('public/assets/art/manifest.json', 'utf8'));
const artKeys = new Set<string>([...Object.keys(manifest.images), ...Object.keys(manifest.sheets)]);

describe('données des niveaux', () => {
  it('dix mondes déclarés', () => expect(WORLDS).toHaveLength(10));

  for (const id of LEVEL_ORDER) {
    const L = LEVELS[id];
    describe(id, () => {
      it('identifiant cohérent', () => {
        expect(L.id).toBe(id);
        expect(WORLDS[L.world - 1].levels).toContain(id);
      });
      it('décors existants (ou au cahier des charges si l’art du monde est en attente)', () => {
        const pending = !!L.theme && !BASE_THEMES.includes(L.theme) && !artKeys.has(`bgd_sky.${L.theme}`);
        for (const p of L.props) expect(artKeys.has(p.key) || (pending && p.key.startsWith('k_')), p.key).toBe(true);
      });
      it('cinématiques existantes', () => {
        if (L.intro) expect(CUTSCENES[L.intro]).toBeDefined();
        if (L.outro) expect(CUTSCENES[L.outro]).toBeDefined();
      });
      it('trois étoiles, départ et arrivée sur un sol', () => {
        expect(L.stars).toHaveLength(3);
        const onGround = (x: number, y: number) => L.grounds.some((g) => x >= g.x && x <= g.x + g.w && g.y === y);
        expect(onGround(L.spawn.x, L.spawn.y)).toBe(true);
        expect(onGround(L.goal.x, L.goal.y)).toBe(true);
      });
      it('ennemis au sol posés sur un sol', () => {
        for (const e of L.enemies) {
          if (e.kind === 'flyer') continue;
          expect(L.grounds.some((g) => e.x >= g.x && e.x <= g.x + g.w), `${e.kind ?? 'beetle'} @${e.x}`).toBe(true);
          expect(e.minX).toBeLessThanOrEqual(e.maxX);
        }
      });
      it('interrupteurs liés à quelque chose', () => {
        for (const s of L.switches ?? [])
          expect(L.platforms.some((p) => p.requires === s.id) || (L.barriers ?? []).some((b) => b.id === s.id)).toBe(true);
      });
      it('boss : arène fermée par deux murs', () => {
        if (!L.boss) return;
        expect(L.walls?.length).toBeGreaterThanOrEqual(2);
        expect(L.boss.minX).toBeLessThan(L.boss.maxX);
      });
    });
  }
});

describe('atteignabilité (moteur physique réel)', () => {
  for (const id of LEVEL_ORDER)
    for (const hero of HERO_ORDER)
      it(`${id} avec ${hero}`, () => {
        const r = reachable(LEVELS[id], hero);
        expect(r.ok, `surfaces atteintes ${r.reached}/${r.total}`).toBe(true);
      }, 60000);
});

describe('le contrôle d’atteignabilité détecte un niveau impossible', () => {
  it('fossé de 1500 px infranchissable', () => {
    const L = structuredClone(LEVELS['1-1']);
    L.grounds = [
      { x: -200, w: 1200, y: 560 },
      { x: 2500, w: 6600, y: 560 },
    ];
    L.platforms = [];
    L.springs = [];
    expect(reachable(L, 'hajar').ok).toBe(false);
  });
});
