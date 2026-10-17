import type { PatternConfig } from './pattern';

// Les gardiens des mondes 4 à 10 : chacun combine les motifs d'attaque différemment,
// avec une difficulté qui monte doucement.

export const BOSS_PATTERNS: Record<string, PatternConfig> = {
  /** Monde 4 — la Sentinelle des Abysses : pluie d'éclats de cristal, ondes sur l'eau, charge. */
  sentinel: { phases: [['rain', 'wave'], ['rain', 'charge', 'wave'], ['charge', 'rain', 'wave', 'rain']], tiredEvery: 2, tiredTime: 3.2, w: 240, h: 230, speed: 90, rainCount: 4, seed: 41 },
  /** Monde 5 — le Prince des Nuages : vole, fait pleuvoir des grêlons, pique sur le héros. */
  cloud: { phases: [['rain', 'swoop'], ['rain', 'swoop', 'shots'], ['shots', 'swoop', 'rain', 'swoop']], tiredEvery: 2, tiredTime: 3.0, flying: true, hoverY: 330, w: 230, h: 200, speed: 150, rainCount: 4, seed: 51 },
  /** Monde 6 — l'Horloger des Astres : rayons d'étoiles annoncés, bonds à engrenages. */
  clock: { phases: [['beam', 'hop'], ['beam', 'hop', 'wave'], ['beam', 'shots', 'hop', 'beam']], tiredEvery: 2, tiredTime: 3.0, w: 230, h: 260, speed: 80, seed: 61 },
  /** Monde 7 — le Dragon d'Ombre : boules d'ombre en cloche, charge, bonds. */
  dragon: { phases: [['shots', 'charge'], ['shots', 'hop', 'charge'], ['shots', 'charge', 'hop', 'shots']], tiredEvery: 2, tiredTime: 2.8, w: 260, h: 220, speed: 110, seed: 71 },
  /** Monde 8 — le Veilleur des Étoiles : vole, rayons de constellations, pluie d'étoiles. */
  watcher: { phases: [['beam', 'swoop'], ['rain', 'beam', 'swoop'], ['beam', 'rain', 'swoop', 'shots']], tiredEvery: 2, tiredTime: 2.8, flying: true, hoverY: 360, w: 240, h: 220, speed: 140, rainCount: 5, seed: 81 },
  /** Monde 9 — les Trois Statues : toutes les attaques des gardiens précédents. */
  statues: { phases: [['charge', 'rain'], ['beam', 'hop', 'shots'], ['wave', 'beam', 'charge', 'rain']], tiredEvery: 2, tiredTime: 2.6, w: 250, h: 280, speed: 100, rainCount: 5, seed: 91 },
  /** Monde 10 — la Fileuse d'Ombre : combat final en plusieurs phases. */
  weaver: {
    phases: [['shots', 'rain'], ['beam', 'swoop', 'shots'], ['rain', 'beam', 'swoop', 'wave'], ['beam', 'shots', 'swoop', 'rain', 'wave']],
    tiredEvery: 2, tiredTime: 2.6, flying: true, hoverY: 340, w: 260, h: 240, speed: 150, rainCount: 5, seed: 101,
  },
};
