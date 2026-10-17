import type { Mood } from './types';

// Identité visuelle et sonore de chaque univers : palette, lumière, particules d'ambiance,
// étalonnage de la caméra, décors associés. Ajouter un monde = ajouter une entrée ici.

export interface Palette {
  bg: string;
  sun: number;
  sunAlpha: number;
  haze: number;
  rays: number[];
  front: number;
  propFront: number;
  heroTint: number;
  heroGlow: number;
  halo: number;
  fireflies: number[];
  motes: number[];
  confetti: number[];
  gate: number;
}

export interface AmbientParticles {
  key: string;
  tints?: number[];
  additive?: boolean;
  speedY: [number, number];
  scale: [number, number];
  frequency: number;
}

export interface ThemeDef {
  id: string;
  /** Palette selon l'ambiance (jour par défaut). */
  palette: (mood: Mood | undefined) => Palette;
  ambient: AmbientParticles;
  grading: { saturate: number; contrast: number; vignette: number; brighten?: number };
  /** Teinte de la forêt la plus proche (sombre, crée la profondeur). */
  nearTint: number;
  spitterKey: string;
  sporeTint: number;
  wispTint: number;
  goalDecor: [string, string];
  secretCover: string;
  /** Décors qui émettent une lueur (clé → couleur). */
  glowProps: Record<string, number>;
  music: string;
  ambience: string;
}

const FOREST: ThemeDef = {
  id: 'forest',
  palette: (mood) => {
    const dusk = mood === 'dusk';
    return {
      bg: dusk ? '#6e5a8a' : '#9fd4e6', sun: dusk ? 0xffa070 : 0xffe1a0, sunAlpha: 0.42, haze: dusk ? 0xe8c0d8 : 0xe8f4ee,
      rays: [dusk ? 0xffc8a8 : 0xffecbe], front: 0xa8b8a8, propFront: 0xb8d0a0, heroTint: dusk ? 0xfff0ee : 0xffffff,
      heroGlow: dusk ? 0xffc8a0 : 0xfff0c0, halo: dusk ? 0.32 : 0.16, fireflies: [0xd9ff8a, 0xfff1a0], motes: [0xfff1c0, 0xffffff],
      confetti: [0xffd36b, 0xff8a5c, 0x7fd8ff, 0xb8f07a, 0xff7ab8], gate: 0xffd77a,
    };
  },
  ambient: { key: 'leaf', speedY: [35, 70], scale: [0.6, 1.1], frequency: 900 },
  grading: { saturate: 0.14, contrast: 0.07, vignette: 0.35, brighten: 1.03 },
  nearTint: 0x6f9080,
  spitterKey: 'mushrooms',
  sporeTint: 0xe0ff9a,
  wispTint: 0xd8ff8a,
  goalDecor: ['boulder', 'boulder'],
  secretCover: 'bush1',
  glowProps: {},
  music: 'music_forest',
  ambience: 'amb_forest',
};

const CANDY: ThemeDef = {
  id: 'candy',
  palette: (mood) => {
    const dusk = mood === 'dusk';
    return {
      bg: dusk ? '#6e5a8a' : '#9fd4e6', sun: 0xffd0ec, sunAlpha: 0.42, haze: dusk ? 0xf0b8e0 : 0xffe0f0, rays: [0xffe0f0, 0xfff0d0],
      front: 0xc8a8c0, propFront: 0xd8b8d0, heroTint: dusk ? 0xfff0ee : 0xffffff, heroGlow: 0xffd8f0, halo: dusk ? 0.32 : 0.16,
      fireflies: [0xffb3e0, 0xb3fff0, 0xfff3a0], motes: [0xfff0f4, 0xfffac0], confetti: [0xff7ab8, 0x7fe0d0, 0xffe066, 0xb59fff, 0xffffff],
      gate: 0xffb8e8,
    };
  },
  ambient: { key: 'spark', tints: [0xff9ad5, 0x9af0d8, 0xfff08a, 0xb9a5ff], speedY: [35, 70], scale: [0.18, 0.3], frequency: 450 },
  grading: { saturate: 0.2, contrast: 0.07, vignette: 0.35 },
  nearTint: 0x6f9080,
  spitterKey: 'c_jellybush',
  sporeTint: 0xffb0e0,
  wispTint: 0xff9ad5,
  goalDecor: ['c_marshmallow', 'c_gumdrops'],
  secretCover: 'c_cottonbush',
  glowProps: {},
  music: 'music_candy',
  ambience: 'amb_candy',
};

const ENCHANTED: ThemeDef = {
  id: 'enchanted',
  palette: (mood) => ({
    bg: mood === 'dusk' ? '#6e5a8a' : '#14223a', sun: 0x7fd8ff, sunAlpha: 0.28, haze: 0x6f8ccc, rays: [0x7fe9ff, 0xb59fff], front: 0x8796b8,
    propFront: 0x7f9cb8, heroTint: 0xdce4ff, heroGlow: 0x8fefff, halo: 0.32, fireflies: [0x7fd8ff, 0xc6a5ff, 0xb8ffcf],
    motes: [0x9ff4ff, 0xd0b6ff], confetti: [0x7fd8ff, 0xc6a5ff, 0xffd36b, 0xb8ffcf, 0xff9ad5], gate: 0x8fefff,
  }),
  ambient: { key: 'spark', tints: [0x8fefff, 0xc3a5ff, 0xb8ffcf], additive: true, speedY: [18, 40], scale: [0.12, 0.24], frequency: 380 },
  grading: { saturate: 0.16, contrast: 0.1, vignette: 0.45 },
  nearTint: 0x7d8fb0,
  spitterKey: 'e_mushrooms',
  sporeTint: 0xb0f0ff,
  wispTint: 0x9fd8ff,
  goalDecor: ['e_stump', 'e_mushrooms'],
  secretCover: 'e_fern',
  glowProps: { e_mushrooms: 0x7fd8ff, e_crystal: 0x7fd8ff, e_bells: 0xc6a5ff },
  music: 'music_enchanted',
  ambience: 'amb_enchanted',
};

const CRYSTAL: ThemeDef = {
  id: 'crystal',
  palette: () => ({
    bg: '#0c2a36', sun: 0x5ef0e0, sunAlpha: 0.3, haze: 0x5fb8c8, rays: [0x8ff8ff, 0x5ef0e0], front: 0x6f9fae, propFront: 0x78b0b8,
    heroTint: 0xe0fbff, heroGlow: 0x8ff8ff, halo: 0.34, fireflies: [0x8ff8ff, 0x5ef0e0, 0xc8fff4], motes: [0xb0fff8, 0xe0ffff],
    confetti: [0x5ef0e0, 0x8fd8ff, 0xffffff, 0xffd36b, 0xb59fff], gate: 0x8ff8ff,
  }),
  ambient: { key: 'spore', tints: [0xb0fff8, 0x8fd8ff], additive: true, speedY: [-40, -15], scale: [0.15, 0.35], frequency: 300 },
  grading: { saturate: 0.18, contrast: 0.1, vignette: 0.45 },
  nearTint: 0x5f8f9a,
  spitterKey: 'k_mush',
  sporeTint: 0x9ffff0,
  wispTint: 0x8ff8ff,
  goalDecor: ['k_geode', 'k_coral'],
  secretCover: 'k_kelp',
  glowProps: { k_geode: 0x8ff8ff, k_jelly: 0xc8a5ff, k_mush: 0x5ef0e0 },
  music: 'music_crystal',
  ambience: 'amb_crystal',
};


function makeTheme(id: string, p: Partial<Palette> & { bg: string; sun: number; haze: number; rays: number[]; heroGlow: number; fireflies: number[]; gate: number }, o: Omit<ThemeDef, 'id' | 'palette'>): ThemeDef {
  return {
    id,
    palette: () => ({
      sunAlpha: 0.32, front: 0x8a9ab0, propFront: 0x90a8b8, heroTint: 0xffffff, halo: 0.28, motes: [0xffffff, ...p.fireflies.slice(0, 1)],
      confetti: [0xffd36b, 0xff8a5c, 0x7fd8ff, 0xb8f07a, 0xff7ab8], ...p,
    }) as Palette,
    ...o,
  };
}

const SKY = makeTheme('sky', { bg: '#9fd0f0', sun: 0xfff4d0, sunAlpha: 0.5, haze: 0xf0f8ff, rays: [0xfff8e0], heroGlow: 0xfff0d0, halo: 0.14, fireflies: [0xffffff, 0xfff4b0], gate: 0xbfe6ff, front: 0xc8d8e8, propFront: 0xd0e0f0 }, {
  ambient: { key: 'petal', tints: [0xffffff, 0xffe8f4, 0xe8f4ff], speedY: [20, 45], scale: [0.6, 1.0], frequency: 500 },
  grading: { saturate: 0.12, contrast: 0.05, vignette: 0.3, brighten: 1.04 }, nearTint: 0x8fa8c0, spitterKey: 's_cloudbush', sporeTint: 0xe8f8ff,
  wispTint: 0xfff4b0, goalDecor: ['s_pillar', 's_cloudbush'], secretCover: 's_cloudbush', glowProps: { s_lantern: 0xfff0b0 }, music: 'music_sky', ambience: 'amb_wind',
});
const OBSERVATORY = makeTheme('observatory', { bg: '#3a2850', sun: 0xffc35c, haze: 0xf0c890, rays: [0xffd8a0, 0xffc35c], heroGlow: 0xffe0a0, fireflies: [0xffe0a0, 0xffffff], gate: 0xffc35c }, {
  ambient: { key: 'spark', tints: [0xffe0a0, 0xffffff], additive: true, speedY: [10, 30], scale: [0.1, 0.22], frequency: 420 },
  grading: { saturate: 0.15, contrast: 0.08, vignette: 0.4 }, nearTint: 0x8a7060, spitterKey: 'o_sphere', sporeTint: 0xffd890,
  wispTint: 0xffd890, goalDecor: ['o_telescope', 'o_sphere'], secretCover: 'o_palm', glowProps: { o_lamp: 0xffd890, o_sphere: 0xffc35c }, music: 'music_observatory', ambience: 'amb_night',
});
const SHADOW = makeTheme('shadow', { bg: '#120a24', sun: 0xb07cff, sunAlpha: 0.22, haze: 0x6a4a9a, rays: [0xb07cff, 0x7f5cff], heroGlow: 0xd8b8ff, halo: 0.45, fireflies: [0xb07cff, 0xff9ad5, 0x8fd8ff], gate: 0xd8b8ff, heroTint: 0xe8e0ff }, {
  ambient: { key: 'spark', tints: [0xb07cff, 0x8f6cff], additive: true, speedY: [8, 22], scale: [0.1, 0.2], frequency: 360 },
  grading: { saturate: 0.1, contrast: 0.12, vignette: 0.55 }, nearTint: 0x4a3a6a, spitterKey: 'd_thorns', sporeTint: 0xc8a0ff,
  wispTint: 0xc8a0ff, goalDecor: ['d_crystal', 'd_tree'], secretCover: 'd_thorns', glowProps: { d_lantern: 0xffb060, d_crystal: 0xb07cff, d_flowers: 0xc8a0ff }, music: 'music_shadow', ambience: 'amb_shadow',
});
const STARS = makeTheme('stars', { bg: '#0a0a2a', sun: 0xd9c2ff, haze: 0x8a7ad0, rays: [0xd9c2ff, 0x9fe8ff], heroGlow: 0xe8dcff, halo: 0.4, fireflies: [0xffffff, 0xd9c2ff, 0x9fe8ff], gate: 0xe8dcff }, {
  ambient: { key: 'spark', tints: [0xffffff, 0xd9c2ff], additive: true, speedY: [-15, 15], scale: [0.08, 0.2], frequency: 200 },
  grading: { saturate: 0.18, contrast: 0.1, vignette: 0.5 }, nearTint: 0x5a5a8a, spitterKey: 't_comet', sporeTint: 0xe8dcff,
  wispTint: 0xffffff, goalDecor: ['t_globe', 't_crystal'], secretCover: 't_comet', glowProps: { t_crystal: 0xd9c2ff, t_lantern: 0xffe0a0, t_fountain: 0x9fe8ff }, music: 'music_stars', ambience: 'amb_night',
});
const CITADEL = makeTheme('citadel', { bg: '#e8a868', sun: 0xffd890, sunAlpha: 0.48, haze: 0xffe0c0, rays: [0xffe0b0], heroGlow: 0xfff0c0, halo: 0.2, fireflies: [0xfff0b0, 0xffd890], gate: 0xffe9b0, front: 0xa89888 }, {
  ambient: { key: 'leaf', speedY: [30, 60], scale: [0.5, 0.9], frequency: 800 },
  grading: { saturate: 0.12, contrast: 0.07, vignette: 0.35, brighten: 1.02 }, nearTint: 0x8a7868, spitterKey: 'g_roses', sporeTint: 0xffc0d0,
  wispTint: 0xffe9b0, goalDecor: ['g_statue', 'g_fountain'], secretCover: 'g_roses', glowProps: { g_torch: 0xffb060 }, music: 'music_citadel', ambience: 'amb_wind',
});
const HEART = makeTheme('heart', { bg: '#1a1240', sun: 0xffffff, haze: 0xc8b8ff, rays: [0xff9ad5, 0x9fe8ff, 0xffe066, 0xb8f07a], heroGlow: 0xffffff, halo: 0.4, fireflies: [0xff9ad5, 0x9fe8ff, 0xffe066, 0xb8f07a], gate: 0xffffff }, {
  ambient: { key: 'spark', tints: [0xff9ad5, 0x9fe8ff, 0xffe066, 0xb8f07a], additive: true, speedY: [-20, 20], scale: [0.1, 0.24], frequency: 220 },
  grading: { saturate: 0.2, contrast: 0.1, vignette: 0.45 }, nearTint: 0x6a5a9a, spitterKey: 'z_flower', sporeTint: 0xffffff,
  wispTint: 0xc0c0d0, goalDecor: ['z_prism', 'z_tree'], secretCover: 'z_flower', glowProps: { z_prism: 0xffffff, z_lantern: 0xffe066, z_fountain: 0x9fe8ff }, music: 'music_final', ambience: 'amb_crystal',
});

export const THEMES: Record<string, ThemeDef> = {
  forest: FOREST, candy: CANDY, enchanted: ENCHANTED, crystal: CRYSTAL,
  sky: SKY, observatory: OBSERVATORY, shadow: SHADOW, stars: STARS, citadel: CITADEL, heart: HEART,
};

/** Thèmes dont les illustrations peintes sont livrées avec le jeu d'origine. */
export const BASE_THEMES = ['forest', 'candy', 'enchanted'];

export function themeOf(id: string | undefined): ThemeDef {
  return THEMES[id ?? 'forest'] ?? FOREST;
}
