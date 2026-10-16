import { describe, expect, it } from 'vitest';
import { migrate, SaveStore, SAVE_KEY, type KeyValueStorage } from '../../src/core/save';

class MemStorage implements KeyValueStorage {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
}

describe('sauvegarde', () => {
  it('crée une sauvegarde par défaut', () => {
    const s = new SaveStore(new MemStorage());
    expect(s.profile.unlocked).toEqual(['1-1']);
    expect(s.data.version).toBe(3);
  });

  it('enregistre le meilleur résultat et débloque la suite', () => {
    const mem = new MemStorage();
    const s = new SaveStore(mem);
    s.recordLevel('1-1', { stars: [true, false, false], crystals: 40, time: 120, chest: false, hero: 'hajar' }, '1-2');
    s.recordLevel('1-1', { stars: [false, true, false], crystals: 30, time: 100, chest: true, hero: 'soumaya' }, '1-2');
    const r = s.profile.levels['1-1'];
    expect(r.stars).toEqual([true, true, false]);
    expect(r.crystals).toBe(40);
    expect(r.bestTime).toBe(100);
    expect(r.chest).toBe(true);
    expect(r.heroes?.sort()).toEqual(['hajar', 'soumaya']);
    expect(s.profile.totalCrystals).toBe(40);
    expect(s.isUnlocked('1-2')).toBe(true);
    // Relecture depuis le stockage.
    const again = new SaveStore(mem);
    expect(again.profile.levels['1-1'].crystals).toBe(40);
    expect(again.starCount).toBe(2);
  });

  it('migre le format v2 du prototype', () => {
    const v2 = {
      version: 2,
      activeProfile: 0,
      profiles: [{ name: 'Joueur 1', hero: 'zakaria', difficulty: 'facile', levels: { '1-1': { completed: true, stars: [true, true, true], crystals: 55, bestTime: 80, chest: true } }, totalCrystals: 55, unlocked: ['1-1', '1-2'] }, null, null],
      settings: { music: 0.5 },
    };
    const d = migrate(v2);
    expect(d.version).toBe(3);
    expect(d.profiles[0]!.hero).toBe('zakaria');
    expect(d.profiles[0]!.levels['1-1'].stars).toEqual([true, true, true]);
    expect(d.profiles[0]!.seenCutscenes).toEqual([]);
    expect(d.settings.music).toBe(0.5);
    expect(d.settings.sfx).toBe(0.9);
  });

  it('résiste aux données corrompues', () => {
    const mem = new MemStorage();
    mem.setItem(SAVE_KEY, '{pas du json');
    expect(new SaveStore(mem).profile.unlocked).toEqual(['1-1']);
    expect(migrate({ version: 2, profiles: [{ hero: 'dragon', levels: { x: 'n' } }] }).profiles[0]!.hero).toBe('soumaya');
    expect(migrate(null).version).toBe(3);
  });

  it('fonctionne sans stockage (navigation privée)', () => {
    const s = new SaveStore(null);
    expect(s.save()).toBe(false);
    expect(s.persistent).toBe(false);
    s.recordLevel('1-1', { stars: [true, true, true], crystals: 1, time: 1, chest: false }, '1-2');
    expect(s.isUnlocked('1-2')).toBe(true);
  });
});
