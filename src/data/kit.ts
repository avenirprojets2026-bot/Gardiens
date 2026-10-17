import type { PropDef, Pt } from './types';

// Petits outils d'écriture de niveaux : rangées et arcs de cristaux, listes de décors.

/** Arc de n cristaux de (x, y), espacés de dx, montant de h au milieu. */
export const arc = (x: number, y: number, n: number, dx: number, h: number): Pt[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * dx, y: y - Math.sin((i / (n - 1)) * Math.PI) * h }));

export const row = (x: number, y: number, n: number, dx: number): Pt[] =>
  Array.from({ length: n }, (_, i) => ({ x: x + i * dx, y }));

/** Colonne montante (au-dessus d'un ressort, par exemple). */
export const col = (x: number, y: number, n: number, dy = 110): Pt[] =>
  Array.from({ length: n }, (_, i) => ({ x, y: y - i * dy }));

export const GROUND_Y = 560;

/** [clé, x, y?, échelle?, miroir?] → décors posés au sol. */
export const props = (list: [string, number, number?, number?, boolean?][]): PropDef[] =>
  list.map(([key, x, y = GROUND_Y, scale = 0.32, flip]) => ({ key, x, y, scale, flip }));

export const front = (key: string, x: number, scale = 0.3, flip = false, y = 566): PropDef => ({
  key,
  x,
  y,
  scale,
  flip,
  front: true,
});
