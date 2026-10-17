import { clamp, lcg } from '../core/rng';
import type { BossEvent, BossLogic, Wave } from './types';

// Boss « fonceur » (Roi Ronchon, Gâteau Grognon) : il marche vers le héros, prévient en
// tremblant (windup), fonce, se cogne contre le bord de l'arène et reste étourdi :
// c'est le moment de lui sauter sur la tête. Dès la phase 2 il saute et crée des ondes de choc.

export class ChargerBoss implements BossLogic {
  state = 'intro';
  t = 0;
  vy = 0;
  dir = -1;
  w = 230;
  h = 150;
  waves: Wave[] = [];
  events: BossEvent[] = [];
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  private rng: () => number;

  constructor(x: number, public groundY: number, public minX: number, public maxX: number, hp = 3, seed = 7) {
    this.x = x;
    this.y = groundY;
    this.hp = hp;
    this.maxHp = hp;
    this.rng = lcg(seed);
  }

  get phase() {
    return this.maxHp - this.hp;
  }
  get vulnerable() {
    return this.state === 'stunned';
  }
  get dangerous() {
    return this.state === 'walk' || this.state === 'windup' || this.state === 'charge' || this.state === 'hop';
  }
  get solidBody() {
    return false;
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
    const lo = this.minX + this.w / 2;
    const hi = this.maxX - this.w / 2;
    switch (this.state) {
      case 'intro':
        if (this.t > 1.8) {
          this.events.push('roar');
          this.go('walk');
        }
        break;
      case 'walk':
        this.dir = targetX < this.x ? -1 : 1;
        this.x = clamp(this.x + this.dir * (70 + 25 * this.phase) * dt, lo, hi);
        if (this.t > 1.6 - 0.3 * this.phase) {
          if (this.phase >= 1 && this.rng() < 0.45) {
            this.vy = -760;
            this.go('hop');
          } else {
            this.events.push('windup');
            this.go('windup');
          }
        }
        break;
      case 'windup':
        this.dir = targetX < this.x ? -1 : 1;
        if (this.t > 0.95 - 0.15 * this.phase) {
          this.events.push('charge');
          this.go('charge');
        }
        break;
      case 'charge':
        this.x += this.dir * (480 + 90 * this.phase) * dt;
        if (this.x <= lo || this.x >= hi) {
          this.x = clamp(this.x, lo, hi);
          this.events.push('bonk');
          this.go('stunned');
        }
        break;
      case 'stunned':
        if (this.t > 2.8 - 0.35 * this.phase) this.go('walk');
        break;
      case 'hop':
        this.vy += 2200 * dt;
        this.y += this.vy * dt;
        this.x = clamp(this.x + this.dir * 120 * dt, lo, hi);
        if (this.y >= this.groundY && this.vy > 0) {
          this.y = this.groundY;
          this.vy = 0;
          this.events.push('land');
          this.waves.push({ x: this.x - this.w / 2, dir: -1, life: 2.2 }, { x: this.x + this.w / 2, dir: 1, life: 2.2 });
          this.go('walk');
        }
        break;
      case 'hurt':
        if (this.t > 1) this.go(this.hp <= 0 ? 'defeated' : 'walk');
        break;
    }
    for (const w of this.waves) {
      w.x += w.dir * 430 * dt;
      w.life -= dt;
    }
    this.waves = this.waves.filter((w) => w.life > 0 && w.x > this.minX && w.x < this.maxX);
  }

  stomped(): boolean {
    if (this.state !== 'stunned') {
      this.events.push('bounceOff');
      return false;
    }
    this.hp--;
    this.events.push('hit');
    if (this.hp <= 0) {
      this.events.push('defeated');
      this.waves = [];
    }
    this.go('hurt');
    return true;
  }
}
