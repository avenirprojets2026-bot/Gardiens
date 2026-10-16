import type { Difficulty } from '../core/save';
import type { LevelDef } from '../data/types';
import type { PlatformDef, Solid } from '../physics/geom';

// Solides de collision d'un niveau (module pur, sans Phaser : utilisé aussi par les tests).

export const PLATFORM_THICKNESS: Record<PlatformDef['kind'], number> = { big: 40, med: 36, small: 30, bridge: 20, log: 24, cloud: 30 };

/** Construit la liste des solides d'un niveau (indépendant du rendu). */
export function buildSolids(L: LevelDef, difficulty: Difficulty): Solid[] {
  const out: Solid[] = [];
  for (const g of L.grounds) out.push({ x: g.x, y: g.y, w: g.w, h: 1400, material: g.material ?? 'grass' });
  for (const p of L.platforms) {
    if (p.kind === 'bridge' && difficulty === 'expert' && !p.requires) continue;
    out.push({
      x: p.x,
      y: p.y,
      w: p.w,
      h: PLATFORM_THICKNESS[p.kind],
      oneWay: true,
      material: p.kind === 'log' || p.kind === 'bridge' ? 'wood' : p.kind === 'cloud' ? 'cloud' : 'grass',
      ref: p,
      off: !!p.requires,
      tag: p.requires,
    });
  }
  for (const s of L.springs) out.push({ x: s.x - 50, y: s.y - 60, w: 100, h: 20, bounce: s.power, material: 'mushroom', oneWay: true });
  // Le premier mur d'un niveau à boss est la porte de l'arène (fermée plus tard).
  for (const w of (L.walls ?? []).slice(1)) out.push({ ...w, material: 'stone' });
  for (const b of L.barriers ?? []) out.push({ x: b.x - 20, y: b.y - b.h, w: 40, h: b.h, material: 'stone', tag: `barrier:${b.id}` });
  return out;
}

