export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Material = 'grass' | 'wood' | 'stone' | 'ice' | 'mushroom' | 'flower' | 'cloud' | 'crystal' | 'candy';

/** Plateforme ou sol de collision. `ref` relie le solide à sa définition de niveau (plateformes animées). */
export interface Solid extends Rect {
  oneWay?: boolean;
  bounce?: number;
  material?: Material;
  ref?: PlatformDef;
  /** Désactivé (plateforme tombée, barrière ouverte...). */
  off?: boolean;
  tag?: string;
  _fall?: FallState;
}

export interface PlatformDef {
  kind: 'big' | 'med' | 'small' | 'bridge' | 'log' | 'cloud';
  x: number;
  y: number;
  w: number;
  /** Flotte doucement (amplitude en px). */
  bob?: number;
  /** Aller-retour sinusoïdal. */
  move?: { dx: number; dy: number; period: number; phase?: number };
  /** S'effondre après 0,7 s de présence, réapparaît 2,6 s plus tard. */
  fall?: boolean;
  /** N'apparaît qu'une fois l'interrupteur `id` activé. */
  requires?: string;
  /** Apparaît/disparaît en rythme (secondes) : plateformes de cristal, nuages. */
  blink?: { on: number; off: number; phase?: number };
}

export interface FallState {
  stand: number;
  dropping: boolean;
  vy: number;
  off: number;
  away: number;
  lt: number;
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
