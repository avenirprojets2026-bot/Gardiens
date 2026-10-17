import { clamp } from '../core/rng';
import type { EnemyDef, EnemyKind } from '../data/types';
import type { Rect } from '../physics/geom';

// Comportements des ennemis, sans rendu (testables) :
// - scarabée : patrouille ;
// - fonceur : patrouille, repère le héros, se ramasse (alerte) puis fonce, et souffle ;
// - feu follet : vole en vagues, plonge vers le héros quand il passe dessous ;
// - champignon cracheur : immobile, gonfle (alerte) puis crache une spore en cloche.

export interface Spore {
  x: number;
  y: number;
  vx: number;
  vy: number;
  alive: boolean;
}

export interface EnemyState {
  kind: EnemyKind;
  x: number;
  /** Bas du sprite (au sol) ; centre pour le feu follet. */
  y: number;
  baseY: number;
  dir: number;
  minX: number;
  maxX: number;
  speed: number;
  alive: boolean;
  t: number;
  mode: 'patrol' | 'alert' | 'charge' | 'tired' | 'swoop' | 'return';
  modeT: number;
  cooldown: number;
  w: number;
  h: number;
}

export interface TargetInfo {
  x: number;
  /** Bas du héros. */
  y: number;
}

export function createEnemy(def: EnemyDef, groundY: number): EnemyState {
  const kind = def.kind ?? 'beetle';
  const flyer = kind === 'flyer';
  return {
    kind,
    x: def.x,
    y: flyer ? (def.y ?? groundY - 220) : groundY,
    baseY: flyer ? (def.y ?? groundY - 220) : groundY,
    dir: -1,
    minX: def.minX,
    maxX: def.maxX,
    speed: def.speed,
    alive: true,
    t: Math.random() * 5,
    mode: 'patrol',
    modeT: 0,
    cooldown: 1.2 + Math.random(),
    w: kind === 'spitter' ? 80 : flyer ? 56 : 70,
    h: kind === 'spitter' ? 70 : flyer ? 56 : 56,
  };
}

export function enemyRect(e: EnemyState): Rect {
  if (e.kind === 'flyer') return { x: e.x - e.w / 2, y: e.y - e.h / 2, w: e.w, h: e.h };
  return { x: e.x - e.w / 2, y: e.y - e.h, w: e.w, h: e.h };
}

function setMode(e: EnemyState, m: EnemyState['mode']) {
  e.mode = m;
  e.modeT = 0;
}

/** Fait avancer un ennemi d'un pas. Renvoie une spore à créer, le cas échéant. */
export function stepEnemy(e: EnemyState, dt: number, target: TargetInfo): Spore | null {
  if (!e.alive) return null;
  e.t += dt;
  e.modeT += dt;
  const dx = target.x - e.x;
  switch (e.kind) {
    case 'beetle':
      patrol(e, dt, e.speed);
      return null;
    case 'charger': {
      const sees = Math.abs(dx) < 380 && Math.abs(target.y - e.y) < 130;
      if (e.mode === 'patrol') {
        patrol(e, dt, e.speed * 0.8);
        if (sees && e.cooldown <= 0) {
          e.dir = Math.sign(dx) || 1;
          setMode(e, 'alert');
        }
        e.cooldown -= dt;
      } else if (e.mode === 'alert') {
        if (e.modeT > 0.55) setMode(e, 'charge');
      } else if (e.mode === 'charge') {
        e.x += e.dir * 430 * dt;
        const lo = e.minX - 120;
        const hi = e.maxX + 120;
        if (e.x < lo || e.x > hi || e.modeT > 1.3) {
          e.x = clamp(e.x, lo, hi);
          setMode(e, 'tired');
        }
      } else if (e.mode === 'tired') {
        if (e.modeT > 0.9) {
          e.cooldown = 1;
          setMode(e, 'patrol');
        }
      }
      return null;
    }
    case 'flyer': {
      if (e.mode === 'patrol') {
        patrol(e, dt, e.speed);
        e.y = e.baseY + Math.sin(e.t * 2.1) * 36;
        e.cooldown -= dt;
        const below = target.y > e.y + 60 && target.y - e.y < 360;
        if (below && Math.abs(dx) < 140 && e.cooldown <= 0) setMode(e, 'swoop');
      } else if (e.mode === 'swoop') {
        // Plongée en arc vers l'endroit où se trouvait le héros (tête).
        const ty = target.y - 70;
        e.y += (ty - e.y) * Math.min(1, dt * 3.2);
        e.x += clamp(dx, -1, 1) * 120 * dt;
        if (e.modeT > 0.85) setMode(e, 'return');
      } else if (e.mode === 'return') {
        e.y += (e.baseY - e.y) * Math.min(1, dt * 2.2);
        if (Math.abs(e.y - e.baseY) < 6 || e.modeT > 1.8) {
          e.cooldown = 1.6;
          setMode(e, 'patrol');
        }
      }
      return null;
    }
    case 'spitter': {
      e.dir = dx < 0 ? -1 : 1;
      if (e.mode === 'patrol') {
        e.cooldown -= dt;
        if (e.cooldown <= 0 && Math.abs(dx) < 720 && Math.abs(target.y - e.y) < 400) setMode(e, 'alert');
      } else if (e.mode === 'alert' && e.modeT > 0.55) {
        setMode(e, 'patrol');
        e.cooldown = 2.4;
        // Tir en cloche : temps de vol fixe, vitesse horizontale bornée.
        const flight = 1.15;
        return { x: e.x + e.dir * 20, y: e.y - 60, vx: clamp(dx / flight, -420, 420), vy: -640, alive: true };
      }
      return null;
    }
  }
}

function patrol(e: EnemyState, dt: number, speed: number) {
  e.x += e.dir * speed * dt;
  if (e.x < e.minX) {
    e.x = e.minX;
    e.dir = 1;
  }
  if (e.x > e.maxX) {
    e.x = e.maxX;
    e.dir = -1;
  }
}

export const SPORE_GRAVITY = 1100;

export function stepSpore(s: Spore, dt: number): void {
  s.vy += SPORE_GRAVITY * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
}

/** Le contact fait-il mal ? (Le fonceur essoufflé est inoffensif : on peut le pousser ou sauter dessus.) */
export function harmful(e: EnemyState): boolean {
  if (!e.alive) return false;
  if (e.kind === 'charger' && e.mode === 'tired') return false;
  return true;
}
