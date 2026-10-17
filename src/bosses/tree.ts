import { lcg } from '../core/rng';
import type { Acorn, BossEvent, BossLogic, Wave } from './types';

// Boss « arbre » (Vieux Chêne) : immobile, il alterne pluie de glands (ombres au sol = où ils
// tombent) et racines qui rampent au sol (à sauter). Tous les trois cycles il bâille, se penche :
// son nez devient accessible.

export class TreeBoss implements BossLogic {
  state = 'intro';
  t = 0;
  vy = 0;
  dir = -1;
  w = 260;
  waves: Wave[] = [];
  acorns: Acorn[] = [];
  events: BossEvent[] = [];
  cycle = 0;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  private rng: () => number;

  constructor(x: number, public groundY: number, public minX: number, public maxX: number, hp = 3, seed = 11) {
    this.x = x;
    this.y = groundY;
    this.hp = hp;
    this.maxHp = hp;
    this.rng = lcg(seed);
  }

  get phase() {
    return this.maxHp - this.hp;
  }
  get h() {
    return this.state === 'tired' || this.state === 'hurt' ? 230 : 380;
  }
  get vulnerable() {
    return this.state === 'tired';
  }
  get dangerous() {
    return false;
  }
  get solidBody() {
    return true;
  }
  get rect() {
    return { x: this.x - this.w / 2, y: this.y - this.h, w: this.w, h: this.h };
  }

  private go(s: string) {
    this.state = s;
    this.t = 0;
  }

  update(dt: number, targetX: number): void {
    this.events.length = 0;
    this.t += dt;
    switch (this.state) {
      case 'intro':
        if (this.t > 1.8) {
          this.events.push('roar');
          this.go('idle');
        }
        break;
      case 'idle':
        if (this.t > 1.3 - 0.2 * this.phase) {
          this.cycle++;
          if (this.cycle % 3 === 0) {
            this.events.push('tired');
            this.go('tired');
            break;
          }
          if ((this.cycle + this.phase) % 2 === 0) {
            this.events.push('windup');
            const n = 3 + this.phase * 2;
            for (let i = 0; i < n; i++) {
              const spread = (this.rng() - 0.5) * 360;
              const ax = Math.max(this.minX + 40, Math.min(this.x - this.w / 2 - 40, targetX + spread));
              this.acorns.push({ x: ax, y: this.groundY - 720, vy: 0, delay: 0.25 + i * (0.42 - 0.06 * this.phase), landed: false });
            }
            this.go('acorns');
          } else {
            this.events.push('charge');
            const n = 1 + Math.min(this.phase, 1);
            for (let i = 0; i < n; i++) this.waves.push({ x: this.x - this.w / 2 - i * 260, dir: -1, life: 6 });
            this.go('roots');
          }
        }
        break;
      case 'acorns':
        if (this.acorns.length === 0 && this.t > 0.6) this.go('idle');
        break;
      case 'roots':
        if (this.waves.length === 0 && this.t > 0.6) this.go('idle');
        break;
      case 'tired':
        if (this.t > 3.2 - 0.4 * this.phase) {
          this.events.push('windup');
          this.go('idle');
        }
        break;
      case 'hurt':
        if (this.t > 1) this.go(this.hp <= 0 ? 'defeated' : 'idle');
        break;
    }
    for (const a of this.acorns) {
      if (a.delay > 0) a.delay -= dt;
      else {
        a.vy += 1500 * dt;
        a.y += a.vy * dt;
        if (a.y >= this.groundY - 18) {
          a.landed = true;
          this.events.push('land');
        }
      }
    }
    this.acorns = this.acorns.filter((a) => !a.landed);
    for (const w of this.waves) {
      w.x += w.dir * (300 + 50 * this.phase) * dt;
      w.life -= dt;
    }
    this.waves = this.waves.filter((w) => w.life > 0 && w.x > this.minX + 10);
  }

  stomped(): boolean {
    if (this.state !== 'tired') {
      this.events.push('bounceOff');
      return false;
    }
    this.hp--;
    this.events.push('hit');
    if (this.hp <= 0) {
      this.events.push('defeated');
      this.acorns = [];
      this.waves = [];
    }
    this.go('hurt');
    return true;
  }
}
