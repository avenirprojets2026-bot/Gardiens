import { HEROES } from '../../src/data/heroes';
import type { LevelDef } from '../../src/data/types';
import { buildSolids } from '../../src/level/solids';
import { assisted, PlatformerBody, STEP, type BodyParams } from '../../src/physics/body';
import type { Solid } from '../../src/physics/geom';
import { updateMovers } from '../../src/physics/movers';
import type { HeroId } from '../../src/core/save';

// Vérification d'atteignabilité avec le vrai moteur physique : depuis chaque surface,
// on simule des sauts (pleins, courts, double saut + vol plané) et des chutes, à plusieurs
// instants pour les plateformes mobiles, puis on cherche un chemin du départ jusqu'à l'arrivée.

/** hop / hopShort : saut en courant, puis on lâche la direction pour retomber plus court. */
type Action = 'jump' | 'short' | 'walk' | 'double' | 'still' | 'hop' | 'hopShort';

function surfaceUnder(body: PlatformerBody, solids: Solid[]): Solid | undefined {
  return solids.find(
    (s) => !s.off && !s.bounce && Math.abs(s.y - body.bottom) < 1.5 && body.x + body.p.width > s.x && body.x < s.x + s.w,
  );
}

function simulate(L: LevelDef, solids: Solid[], p: BodyParams, from: Solid, x: number, dir: number, action: Action, t0: number): Solid | undefined {
  const b = new PlatformerBody(p, x, from.y - p.height);
  b.grounded = true;
  b.vx = action === 'still' ? 0 : dir * p.maxRun;
  let t = t0;
  updateMovers(solids, t);
  b.y = from.y - p.height;
  let air = false;
  let usedDouble = false;
  for (let i = 0; i < 120 * 4; i++) {
    t += STEP;
    const first = i === 0;
    const holdJump = action === 'jump' || action === 'double' || action === 'still' || action === 'hop' ? true : action === 'short' || action === 'hopShort' ? i < 18 : false;
    const steer = action === 'hop' || action === 'hopShort' ? i < 36 : action !== 'still';
    let pressed = first && action !== 'walk';
    if (action === 'double' && !usedDouble && air && b.vy > -80) {
      pressed = true;
      usedDouble = true;
    }
    updateMovers(solids, t, b);
    const r = b.rect;
    const inside = (z: { x: number; y: number; w: number; h: number }) => r.x < z.x + z.w && r.x + r.w > z.x && r.y < z.y + z.h && r.y + r.h > z.y;
    const env = {
      updraft: Math.max(0, ...(L.updrafts ?? []).filter(inside).map((u) => u.power)),
      wind: (L.winds ?? []).filter(inside).reduce((a, w) => a + w.force, 0),
      gravityScale: Math.min(1, ...(L.lowGravity ?? []).filter(inside).map((z) => z.scale)),
    };
    b.step({ left: dir < 0 && steer, right: dir > 0 && steer, jump: holdJump, jumpPressed: pressed }, solids, STEP, env);
    if (!b.grounded) air = true;
    if (air && b.grounded) {
      const s = surfaceUnder(b, solids);
      if (s) return s;
    }
    if (b.y > L.killY) return undefined;
  }
  return undefined;
}

export function reachable(L: LevelDef, heroId: HeroId): { ok: boolean; reached: number; total: number; frontier?: string } {
  const hero = HEROES[heroId];
  const p = hero.forceAssist ? assisted(hero.params) : hero.params;
  const solids = buildSolids(L, 'normal');
  // Porte de l'arène fermée pendant le combat : on ne la modélise pas (le boss vaincu la rouvre).
  const surfaces = solids.filter((s) => !s.off && !s.bounce && s.h < 2000 && !(s.tag ?? '').startsWith('barrier'));
  const walkable = surfaces.filter((s) => s.oneWay || s.h >= 1000 || s.h <= 60);
  const id = new Map(walkable.map((s, i) => [s, i]));
  const spawn = walkable.find((s) => L.spawn.x >= s.x && L.spawn.x <= s.x + s.w && Math.abs(s.y - L.spawn.y) < 2);
  const goal = walkable.find((s) => L.goal.x >= s.x && L.goal.x <= s.x + s.w && Math.abs(s.y - L.goal.y) < 2);
  if (!spawn || !goal) return { ok: false, reached: 0, total: walkable.length };
  const edges = new Map<number, Set<number>>();
  const base: Action[] = ['jump', 'short', 'walk', 'still', 'hop', 'hopShort'];
  const actions: Action[] = p.airJumps > 0 ? [...base, 'double'] : base;
  const phases = [0, 0.7, 1.4, 2.1, 2.8, 3.5];
  for (const s of walkable) {
    const set = new Set<number>();
    const xs = new Set<number>([s.x + 1, s.x + s.w - p.width - 1]);
    for (let x = s.x + 150; x < s.x + s.w - p.width; x += 300) xs.add(x);
    const animated = !!s.ref && (!!s.ref.move || !!s.ref.bob);
    for (const t0 of animated || walkable.some((o) => o.ref?.move) ? phases : [0]) {
      for (const x0 of xs) {
        for (const dir of [-1, 1]) {
          for (const a of actions) {
            // Repartir d'un état propre pour chaque essai.
            for (const o of solids) delete o._fall;
            const restore = solids.map((o) => ({ o, x: o.x, y: o.y }));
            updateMovers(solids, t0);
            const dx = x0 - s.x;
            const land = simulate(L, solids, p, s, s.x + dx, dir, a, t0);
            for (const r of restore) {
              r.o.x = r.x;
              r.o.y = r.y;
            }
            if (land && id.has(land) && land !== s) set.add(id.get(land)!);
          }
        }
      }
    }
    edges.set(id.get(s)!, set);
  }
  const seen = new Set<number>([id.get(spawn)!]);
  const queue = [id.get(spawn)!];
  while (queue.length) {
    const n = queue.shift()!;
    for (const m of edges.get(n) ?? []) if (!seen.has(m)) {
      seen.add(m);
      queue.push(m);
    }
  }
  // Surface atteinte la plus à droite (pour diagnostiquer un passage bloquant).
  const far = [...seen].map((i) => walkable[i]).sort((a, b) => b.x + b.w - (a.x + a.w))[0];
  const frontier = far ? `bloqué après x=${Math.round(far.x)}..${Math.round(far.x + far.w)} y=${Math.round(far.y)}` : '';
  return { ok: seen.has(id.get(goal)!), reached: seen.size, total: walkable.length, frontier };
}
