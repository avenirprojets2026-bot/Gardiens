import type { Profile } from '../core/save';
import { LEVEL_ORDER, LEVELS, WORLDS } from './worlds';

// Récompenses de la galerie, calculées à partir de la progression (rien de plus à sauvegarder).

export interface Reward {
  id: string;
  name: string;
  desc: string;
  icon: string;
  tint?: number;
  got: (p: Profile) => boolean;
}

const done = (p: Profile, id: string) => !!p.levels[id]?.completed;
const starsIn = (p: Profile, ids: string[]) => ids.reduce((s, id) => s + (p.levels[id]?.stars.filter(Boolean).length ?? 0), 0);

export const REWARDS: Reward[] = [
  { id: 'first', name: 'Premier pas', desc: 'Termine ton premier niveau', icon: 'crystal', got: (p) => Object.values(p.levels).some((l) => l.completed) },
  { id: 'crystals100', name: 'Collectionneur', desc: '100 cristaux au total', icon: 'crystal', tint: 0x9fe8ff, got: (p) => p.totalCrystals >= 100 },
  { id: 'crystals500', name: 'Trésor de lumière', desc: '500 cristaux au total', icon: 'crystal', tint: 0xffd36b, got: (p) => p.totalCrystals >= 500 },
  { id: 'chest', name: 'Fouineur', desc: 'Ouvre un coffre secret', icon: 'chest', got: (p) => Object.values(p.levels).some((l) => l.chest) },
  { id: 'chests', name: 'Chasseur de coffres', desc: 'Ouvre tous les coffres', icon: 'chest', tint: 0xffe9a0, got: (p) => LEVEL_ORDER.filter((id) => LEVELS[id].chest).every((id) => p.levels[id]?.chest) },
  ...WORLDS.filter((w) => w.levels.length).map<Reward>((w) => ({
    id: `boss${w.n}`,
    name: `Gardien ${w.n}`,
    desc: `${w.guardian} a retrouvé le sourire`,
    icon: w.n === 1 ? 'boss_happy' : w.n === 2 ? 'boss_happy.candy' : w.n === 3 ? 'boss_happy.enchanted' : `boss_happy.${w.theme}`,
    got: (p) => done(p, w.levels[w.levels.length - 1]),
  })),
  ...WORLDS.filter((w) => w.levels.length).map<Reward>((w) => ({
    id: `stars${w.n}`,
    name: `Étoiles du monde ${w.n}`,
    desc: `Les ${w.levels.length * 3} étoiles de ${w.short}`,
    icon: 'star',
    got: (p) => starsIn(p, w.levels) === w.levels.length * 3,
  })),
  {
    id: 'trio', name: 'Les trois gardiens', desc: 'Termine un niveau avec chaque héros', icon: 'heart',
    got: (p) => ['soumaya', 'hajar', 'zakaria'].every((h) => Object.values(p.levels).some((l) => l.heroes?.includes(h as never))),
  },
  { id: 'speed', name: 'Éclair', desc: 'Finis 1-1 en moins de 1 min 30', icon: 'star', tint: 0xffa860, got: (p) => (p.levels['1-1']?.bestTime ?? 1e9) < 90 },
];
