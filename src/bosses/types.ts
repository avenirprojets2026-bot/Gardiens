import type { Rect } from '../physics/geom';

export type BossEvent = 'roar' | 'windup' | 'charge' | 'bonk' | 'land' | 'hit' | 'defeated' | 'bounceOff' | 'tired';

/** Onde au sol (sauter par-dessus) ou racine qui avance. */
export interface Wave {
  x: number;
  dir: number;
  life: number;
}

export interface Acorn {
  x: number;
  y: number;
  vy: number;
  delay: number;
  landed: boolean;
}

/** Logique pure d'un boss : machine à états à pas fixe, sans rendu. */
export interface BossLogic {
  x: number;
  y: number;
  groundY: number;
  dir: number;
  hp: number;
  maxHp: number;
  state: string;
  t: number;
  vy: number;
  waves: Wave[];
  acorns?: Acorn[];
  events: BossEvent[];
  readonly rect: Rect;
  /** Peut être blessé (saut sur la tête ou pouvoir). */
  readonly vulnerable: boolean;
  /** Le contact fait mal. */
  readonly dangerous: boolean;
  /** Le boss bloque le passage (corps solide). */
  readonly solidBody: boolean;
  update(dt: number, targetX: number): void;
  /** Coup reçu : true si le coup a porté. */
  stomped(): boolean;
}
