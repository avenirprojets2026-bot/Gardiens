import type { LevelDef } from './types';
import { L1_1, L1_2, L1_3 } from './levels/world1';
import { L2_1, L2_2, L2_3 } from './levels/world2';
import { L3_1, L3_2, L3_3 } from './levels/world3';
import { L4_1, L4_2, L4_3 } from './levels/world4';
import { LATE_LEVELS } from './levels/worlds5to10';

// Les dix mondes de l'aventure. Position (x, y) = emplacement relatif sur la carte peinte.

export interface WorldDef {
  n: number;
  name: string;
  short: string;
  /** Gardien du monde (boss). */
  guardian: string;
  blurb: string;
  x: number;
  y: number;
  color: number;
  levels: string[];
  /** Univers visuel : le monde n'est jouable que si ses illustrations sont présentes. */
  theme?: string;
}

export const WORLDS: WorldDef[] = [
  {
    n: 1, name: 'La Forêt des Lucioles', short: 'Forêt des Lucioles', guardian: 'Le Roi Ronchon',
    blurb: 'Une forêt dorée où dansent les lucioles.', x: 0.193, y: 0.784, color: 0xffd36b,
    levels: ['1-1', '1-2', '1-3'],
  },
  {
    n: 2, name: 'Le Royaume des Bonbons', short: 'Royaume des Bonbons', guardian: 'Le Gâteau Grognon',
    blurb: 'Des collines de sucre glacé… attention, ça glisse !', x: 0.392, y: 0.684, color: 0xff9ad5,
    levels: ['2-1', '2-2', '2-3'],
  },
  {
    n: 3, name: 'Le Bois des Champignons Lumineux', short: 'Champignons Lumineux', guardian: 'Le Vieux Chêne Ronchon',
    blurb: 'La nuit, les champignons s’allument comme des lanternes.', x: 0.208, y: 0.41, color: 0x7fd8ff,
    levels: ['3-1', '3-2', '3-3'],
  },
  {
    n: 4, name: 'Le Lac des Cristaux', short: 'Lac des Cristaux', guardian: 'La Sentinelle des Abysses',
    blurb: 'Des cathédrales de cristal turquoise sous un lac lumineux.', x: 0.723, y: 0.781, color: 0x5ef0e0,
    levels: ['4-1', '4-2', '4-3'], theme: 'crystal',
  },
  {
    n: 5, name: 'Les Îles Célestes', short: 'Îles Célestes', guardian: 'Le Prince des Nuages',
    blurb: 'Des palais de nuages et des îles qui flottent dans le vent.', x: 0.578, y: 0.191, color: 0xbfe6ff,
    levels: ['5-1', '5-2', '5-3'], theme: 'sky',
  },
  {
    n: 6, name: 'L’Observatoire Magique', short: 'Observatoire', guardian: 'L’Horloger des Astres',
    blurb: 'Engrenages, lunettes et sphères qui tournent dans le désert.', x: 0.86, y: 0.615, color: 0xffc35c,
    levels: ['6-1', '6-2', '6-3'], theme: 'observatory',
  },
  {
    n: 7, name: 'Le Royaume des Ombres', short: 'Royaume des Ombres', guardian: 'Le Dragon d’Ombre',
    blurb: 'Là où la lumière s’est cachée. Il faudra être courageux.', x: 0.746, y: 0.272, color: 0xb07cff,
    levels: ['7-1', '7-2', '7-3'], theme: 'shadow',
  },
  {
    n: 8, name: 'Le Sanctuaire des Étoiles', short: 'Sanctuaire des Étoiles', guardian: 'Le Veilleur des Étoiles',
    blurb: 'Un temple de cristal au milieu du ciel étoilé.', x: 0.932, y: 0.281, color: 0xd9c2ff,
    levels: ['8-1', '8-2', '8-3'], theme: 'stars',
  },
  {
    n: 9, name: 'La Citadelle des Gardiens', short: 'Citadelle', guardian: 'Les Trois Statues',
    blurb: 'Le château où les anciens gardiens ont caché leurs pouvoirs.', x: 0.47, y: 0.42, color: 0xffe9b0,
    levels: ['9-1', '9-2', '9-3'], theme: 'citadel',
  },
  {
    n: 10, name: 'Le Cœur des Mondes', short: 'Cœur des Mondes', guardian: 'La Fileuse d’Ombre',
    blurb: 'Tous les pouvoirs réunis pour rallumer le grand cristal.', x: 0.62, y: 0.5, color: 0xffffff,
    levels: ['10-1', '10-2', '10-3'], theme: 'heart',
  },
];

export const LEVELS: Record<string, LevelDef> = {};
for (const l of [L1_1, L1_2, L1_3, L2_1, L2_2, L2_3, L3_1, L3_2, L3_3, L4_1, L4_2, L4_3, ...LATE_LEVELS]) LEVELS[l.id] = l;

/** Ordre de progression de tous les niveaux existants. */
export const LEVEL_ORDER: string[] = WORLDS.flatMap((w) => w.levels).filter((id) => LEVELS[id]);

export function worldOf(levelId: string): WorldDef {
  return WORLDS.find((w) => w.levels.includes(levelId)) ?? WORLDS[0];
}

/** Niveau suivant réellement jouable (null si c'est le dernier construit ou si son art manque). */
export function nextPlayable(levelId: string, ready: (theme?: string) => boolean = () => true): string | null {
  const n = LEVELS[levelId]?.next;
  return n && LEVELS[n] && ready(LEVELS[n].theme) ? n : null;
}
