import type { PlatformerBody } from './body';
import type { FallState, Solid } from './geom';

// Plateformes animées : flottantes, mobiles (aller-retour) et fragiles (qui tombent).
// Le héros posé dessus est transporté avec elles.

export const FALL_DELAY = 0.7;
export const FALL_RESPAWN = 2.6;

export function isAnimated(s: Solid): boolean {
  const r = s.ref;
  return !!(r && (r.bob || r.move || r.fall || r.blink));
}

/** État d'une plateforme à éclipses au temps t : visible ?, et fraction avant disparition. */
export function blinkState(def: NonNullable<Solid['ref']>, t: number): { on: boolean; warn: number } {
  const b = def.blink!;
  const period = b.on + b.off;
  const k = (((t + (b.phase ?? 0)) % period) + period) % period;
  const on = k < b.on;
  // warn : 0 → 1 pendant la dernière demi-seconde visible (clignotement d'avertissement).
  return { on, warn: on ? Math.max(0, (k - (b.on - 0.6)) / 0.6) : 0 };
}

export function fallState(s: Solid): FallState {
  return (s._fall ??= { stand: 0, dropping: false, vy: 0, off: 0, away: 0, lt: NaN });
}

/** Position théorique (sans chute) de la plateforme au temps t. */
export function platformPose(def: NonNullable<Solid['ref']>, t: number): { x: number; y: number } {
  let x = def.x;
  let y = def.y;
  if (def.bob) y += Math.sin(t * 2.2 + def.x * 0.01) * def.bob;
  if (def.move) {
    const k = (1 - Math.cos((t / def.move.period) * Math.PI * 2 + (def.move.phase ?? 0))) / 2;
    x += def.move.dx * k;
    y += def.move.dy * k;
  }
  return { x, y };
}

function standingOn(b: PlatformerBody | undefined, s: Solid): boolean {
  return !!b && b.grounded && Math.abs(b.bottom - s.y) < 1.5 && b.x + b.p.width > s.x && b.x < s.x + s.w;
}

export function updateMovers(solids: Solid[], t: number, body?: PlatformerBody): void {
  for (const s of solids) {
    if (!isAnimated(s)) continue;
    const def = s.ref!;
    if (def.blink && !def.requires) s.off = !blinkState(def, t).on;
    const pose = platformPose(def, t);
    let { x, y } = pose;
    if (def.fall) {
      const f = fallState(s);
      const dt = Number.isFinite(f.lt) ? Math.min(0.1, Math.max(0, t - f.lt)) : 0;
      f.lt = t;
      const on = standingOn(body, s);
      if (f.away > 0) {
        f.away -= dt;
        if (f.away <= 0) Object.assign(f, { away: 0, off: 0, vy: 0, stand: 0, dropping: false });
        else {
          s.x = x;
          s.y = y + 5000;
          continue;
        }
      } else if (f.dropping) {
        f.vy = Math.min(900, f.vy + 1100 * dt);
        f.off += f.vy * dt;
        if (f.off > 700) {
          f.away = FALL_RESPAWN;
          s.y = y + 5000;
          continue;
        }
      } else if (on) {
        f.stand += dt;
        if (f.stand > FALL_DELAY) {
          f.dropping = true;
          f.vy = 60;
        }
      } else f.stand = Math.max(0, f.stand - dt * 0.5);
      y += f.off;
    }
    const dx = x - s.x;
    const dy = y - s.y;
    if (body && standingOn(body, s)) {
      body.x += dx;
      body.y += dy;
    }
    s.x = x;
    s.y = y;
  }
}
